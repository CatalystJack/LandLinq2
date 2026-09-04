/**
 * Email Intake Service
 * Processes inbound deal emails → AI parse → review queue.
 * Nothing auto-creates a deal. Analyst must approve each item.
 *
 * CONTINUOUS LEARNING:
 * Every analyst correction becomes a training signal.
 * Approved examples are injected as few-shot context into future parses,
 * making the AI progressively more accurate over time.
 */

import { db } from './db.js';
import { emailIntakeQueue, emailIntakeTrainingExamples } from '../shared/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { apiCallTracker } from './apiCallTracker.js';
import { simpleParser } from 'mailparser';

// ── Types ────────────────────────────────────────────────────────────────────

interface RawEmail {
  from: string;
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content?: string;
    url?: string;
  }>;
  envelope?: string;
}

interface ParsedFields {
  dealType?: 'land_development' | 'existing_multifamily' | 'unknown';
  propertyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  acres?: number;
  price?: number;
  unitCount?: number;
  vintage?: number;
  brokerName?: string;
  brokerEmail?: string;
  brokerPhone?: string;
  notes?: string;
  zoning?: string;
}

interface FieldConfidences {
  address: number;
  city: number;
  state: number;
  zip: number;
  acres: number;
  price: number;
  unitCount: number;
  vintage: number;
}

interface ParseResult {
  fields: ParsedFields;
  confidences: FieldConfidences;
  overallConfidence: number;
}

// A single email can list several distinct, unrelated tracts/properties
// (e.g. a broker sending "here are 4 sites we discussed"). aiParseEmail
// always returns an array — length 1 for the normal single-property case,
// length >1 when multiple distinct properties are detected.

// ── Main Service Class ───────────────────────────────────────────────────────

export class EmailIntakeService {

  /**
   * Primary entry point — called by the /api/inbound-email webhook.
   */
  static async processInboundEmail(rawBody: any, files?: Array<{ fieldname: string; originalname: string; mimetype: string; buffer: Buffer }>): Promise<{ intakeId: string; intakeIds: string[] } | null> {
    const email = await EmailIntakeService.extractEmailFields(rawBody, files);
    if (!email) return null;

    console.log(`📧 [INTAKE] Processing email from ${email.from} — "${email.subject}"`);

    // Loop prevention
    const fromLower = email.from.toLowerCase();
    if (['@landlinq.ai', 'catalyst.landlinq.ai'].some(d => fromLower.includes(d))) {
      console.log(`🔄 [INTAKE] Blocked — loop prevention`);
      return null;
    }

    // Recipient check
    let envelopeTo = '';
    try {
      if (rawBody.envelope) {
        const env = typeof rawBody.envelope === 'string' ? JSON.parse(rawBody.envelope) : rawBody.envelope;
        envelopeTo = (env.to || []).join(',').toLowerCase();
      }
    } catch { /* ignore */ }

    const toField = (email.to || '').toLowerCase();
    const ccField = (rawBody.cc || '').toLowerCase();
    const validRecipient =
      toField.includes('deals@landlinq.ai') ||
      toField.includes('deal@landlinq.ai') ||
      ccField.includes('deals@landlinq.ai') ||
      ccField.includes('deal@landlinq.ai') ||
      envelopeTo.includes('deals@landlinq.ai') ||
      envelopeTo.includes('deal@landlinq.ai') ||
      toField.includes('deals@catalyst.landlinq.ai') ||
      toField.includes('deal@catalyst.landlinq.ai') ||
      envelopeTo.includes('deals@catalyst.landlinq.ai') ||
      envelopeTo.includes('deal@catalyst.landlinq.ai');

    if (!validRecipient) {
      console.log(`📧 [INTAKE] Ignored — not addressed to deal(s)@landlinq.ai`);
      return null;
    }

    // Deduplication
    const crypto = await import('crypto');
    const hashSource = rawBody.graphMessageId
      ? `graph:${String(rawBody.graphMessageId)}`
      : `${email.from}|${email.subject || ''}|${(email.text || '').substring(0, 200)}`;
    const emailHash = crypto.createHash('sha256').update(hashSource).digest('hex');

    const existing = await db.select().from(emailIntakeQueue)
      .where(eq(emailIntakeQueue.emailHash, emailHash)).limit(1);
    if (existing.length > 0) {
      console.log(`⏭️ [INTAKE] Duplicate blocked`);
      const groupRows = existing[0].groupId
        ? await db.select({ id: emailIntakeQueue.id }).from(emailIntakeQueue)
            .where(eq(emailIntakeQueue.groupId, existing[0].groupId))
        : [{ id: existing[0].id }];
      return { intakeId: existing[0].id, intakeIds: groupRows.map(row => row.id) };
    }

    // Attachment text extraction + buffer collection for object storage upload
    let attachmentText = '';
    const attachmentNames: string[] = [];
    // Collect raw buffers alongside text so we can persist them after DB insert
    const attachmentBuffers: Array<{ filename: string; contentType: string; buffer: Buffer }> = [];
    if (email.attachments?.length) {
      for (const att of email.attachments) {
        if (att.filename) attachmentNames.push(att.filename);
        // Collect raw buffer for storage — handles both inline base64 content and URL-based attachments (SendGrid large files)
        try {
          if (att.content) {
            const buf = Buffer.from(att.content, 'base64');
            if (buf.length > 0) {
              attachmentBuffers.push({ filename: att.filename || 'attachment', contentType: att.contentType || 'application/octet-stream', buffer: buf });
            }
          } else if (att.url) {
            // SendGrid delivers large attachments as URLs — fetch and buffer them
            const res = await fetch(att.url, { signal: AbortSignal.timeout(30000) });
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer();
              const buf = Buffer.from(arrayBuf);
              if (buf.length > 0) {
                attachmentBuffers.push({ filename: att.filename || 'attachment', contentType: att.contentType || res.headers.get('content-type') || 'application/octet-stream', buffer: buf });
              }
            } else {
              console.warn(`⚠️ [INTAKE] URL attachment fetch failed (${res.status}): ${att.filename}`);
            }
          }
        } catch (e) { console.warn(`⚠️ [INTAKE] Buffer collect failed for ${att.filename}:`, e); }
        // Text extraction (existing)
        try {
          const fname = (att.filename || '').toLowerCase();
          if (att.contentType?.includes('pdf') || fname.endsWith('.pdf')) {
            const t = await EmailIntakeService.extractPdfText(att);
            if (t) attachmentText += `\n\nPDF ATTACHMENT (${att.filename}):\n${t}`;
          } else if (att.contentType?.startsWith('image/')) {
            const t = await EmailIntakeService.describeImageAttachment(att, email.subject);
            if (t) attachmentText += `\n\nIMAGE ATTACHMENT (${att.filename}):\n${t}`;
          } else if (fname.endsWith('.docx') || att.contentType?.includes('wordprocessingml')) {
            const t = await EmailIntakeService.extractDocxText(att);
            if (t) attachmentText += `\n\nWORD DOCUMENT (${att.filename}):\n${t}`;
          } else if (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname.endsWith('.csv') ||
                     att.contentType?.includes('spreadsheetml') || att.contentType?.includes('ms-excel') || att.contentType?.includes('csv')) {
            const t = await EmailIntakeService.extractSpreadsheetText(att);
            if (t) attachmentText += `\n\nSPREADSHEET (${att.filename}):\n${t}`;
          }
        } catch (e) { console.warn(`⚠️ [INTAKE] Attachment read failed:`, e); }
      }
    }

    // Follow deal links (package, OM, due diligence) found in the HTML body
    let linkedContent = '';
    if (email.html) {
      try {
        linkedContent = await EmailIntakeService.fetchLinkedPackageContent(email.html);
      } catch (e) {
        console.warn('⚠️ [INTAKE] Link following failed:', e);
      }
    }

    // AI parse with few-shot examples
    const fullText = [email.text || '', attachmentText, linkedContent].filter(Boolean).join('\n\n');
    // Don't pre-seed with internal team emails — forwarders (catalystcp.com, landlinq.ai) are not the broker
    // Also treat distribution list senders (listings@, noreply@, no-reply@, info@, etc.) as non-broker
    const isInternalSender = /(@catalystcp\.com|@landlinq\.ai)/i.test(email.from);
    const isDistributionList = /\b(listings|noreply|no-reply|donotreply|do-not-reply|info|newsletter|updates|notifications|mailer|blast)@/i.test(email.from);
    const useFromAsBroker = !isInternalSender && !isDistributionList;

    // For forwarded emails, pre-extract the original broker's From: line from the body
    // so we can give the AI a reliable, labeled broker email/name rather than hoping
    // it reads forwarding headers correctly.
    const isForwarded = isInternalSender ||
      /^(fwd|fw):/i.test(email.subject || '') ||
      /begin forwarded message|forwarded message|-----original message-----/i.test(fullText);
    const originalSender = isForwarded
      ? EmailIntakeService.extractOriginalSenderFromForwarded(fullText)
      : null;

    if (isForwarded && originalSender) {
      console.log(`📧 [INTAKE] Forwarded email — original broker: ${originalSender.name || '(no name)'} <${originalSender.email || 'unknown'}>`);
    }

    const fallbackFields = useFromAsBroker ? { brokerEmail: email.from, brokerName: EmailIntakeService.nameFromEmail(email.from) } : {};
    let parseResults: ParseResult[] = [{
      fields: fallbackFields,
      confidences: { address: 0, city: 0, state: 0, zip: 0, acres: 0, price: 0, unitCount: 0, vintage: 0 },
      overallConfidence: 0,
    }];
    try {
      parseResults = await EmailIntakeService.aiParseEmail(fullText, email.from, email.subject, email.replyTo, isForwarded, originalSender);
      if (!parseResults || parseResults.length === 0) {
        parseResults = [{
          fields: fallbackFields,
          confidences: { address: 0, city: 0, state: 0, zip: 0, acres: 0, price: 0, unitCount: 0, vintage: 0 },
          overallConfidence: 0,
        }];
      }
    } catch (e) {
      console.error('❌ [INTAKE] AI parse failed:', e);
    }

    const isMultiProperty = parseResults.length > 1;
    const groupId = isMultiProperty ? crypto.randomUUID() : null;
    if (isMultiProperty) {
      console.log(`📧 [INTAKE] Multi-property email detected — splitting into ${parseResults.length} intake entries (group ${groupId})`);
    }

    const insertedRows: { id: string }[] = [];
    for (let i = 0; i < parseResults.length; i++) {
      const parseResult = parseResults[i];
      // Ensure broker info isn't lost for properties where the AI didn't repeat it
      if (!parseResult.fields.brokerEmail && fallbackFields.brokerEmail) {
        parseResult.fields.brokerEmail = fallbackFields.brokerEmail;
      }
      if (!parseResult.fields.brokerName && fallbackFields.brokerName) {
        parseResult.fields.brokerName = fallbackFields.brokerName;
      }

      const [row] = await db.insert(emailIntakeQueue).values({
        fromEmail: email.from,
        fromName: EmailIntakeService.nameFromEmail(email.from),
        subject: isMultiProperty ? `${email.subject || '(No Subject)'} (${i + 1}/${parseResults.length})` : (email.subject || '(No Subject)'),
        emailBody: email.text || '',
        emailHtml: email.html || '',
        // Only the first row in a group carries the hash to preserve the existing
        // duplicate-detection behavior for the raw inbound email.
        emailHash: i === 0 ? emailHash : `${emailHash}-p${i + 1}`,
        attachmentCount: email.attachments?.length ?? 0,
        attachmentNames: attachmentNames.length > 0 ? attachmentNames : [],
        parsedDealType: parseResult.fields.dealType ?? 'unknown',
        parsedPropertyName: parseResult.fields.propertyName ?? null,
        parsedAddress: parseResult.fields.address ?? null,
        parsedCity: parseResult.fields.city ?? null,
        parsedState: parseResult.fields.state ?? null,
        parsedZip: parseResult.fields.zip ?? null,
        parsedAcres: parseResult.fields.acres != null ? String(parseResult.fields.acres) : null,
        parsedPrice: parseResult.fields.price ?? null,
        parsedUnitCount: parseResult.fields.unitCount ?? null,
        parsedVintage: parseResult.fields.vintage ?? null,
        parsedBrokerName: parseResult.fields.brokerName ?? null,
        parsedBrokerEmail: parseResult.fields.brokerEmail ?? null,
        parsedBrokerPhone: parseResult.fields.brokerPhone ?? null,
        parsedNotes: parseResult.fields.notes ?? null,
        parsedZoning: parseResult.fields.zoning ?? null,
        overallConfidence: String(parseResult.overallConfidence),
        fieldConfidences: parseResult.confidences as any,
        status: 'pending',
        groupId,
        groupIndex: isMultiProperty ? i + 1 : null,
        groupTotal: isMultiProperty ? parseResults.length : null,
      }).returning();
      insertedRows.push(row);
    }

    // Upload all attachment buffers to object storage now that we have intake IDs.
    // Shared attachments (e.g. one PDF listing all properties) are attached to every
    // row in the group so each analyst review has full context.
    if (attachmentBuffers.length > 0) {
      try {
        const { ObjectStorageService } = await import('./objectStorage.js');
        const storageService = new ObjectStorageService();
        for (const row of insertedRows) {
          const storedFiles: Array<{ filename: string; objectPath: string; contentType: string; sizeBytes: number }> = [];
          for (const ab of attachmentBuffers) {
            try {
              const objectPath = await storageService.uploadIntakeAttachment(ab.buffer, ab.filename, ab.contentType, row.id);
              storedFiles.push({ filename: ab.filename, objectPath, contentType: ab.contentType, sizeBytes: ab.buffer.length });
            } catch (uploadErr) {
              console.warn(`⚠️ [INTAKE] Failed to upload ${ab.filename}:`, uploadErr);
            }
          }
          if (storedFiles.length > 0) {
            await db.execute(sql`
              UPDATE email_intake_queue
              SET attachment_files = ${JSON.stringify(storedFiles)}::jsonb
              WHERE id = ${row.id}
            `);
            console.log(`📎 [INTAKE] Stored ${storedFiles.length} attachment(s) for intake ${row.id}`);
          }
        }
      } catch (storageErr) {
        console.warn('⚠️ [INTAKE] Object storage upload skipped (not configured?):', (storageErr as Error).message);
      }
    }

    console.log(`✅ [INTAKE] Saved ${insertedRows.length} entr${insertedRows.length === 1 ? 'y' : 'ies'}: ${insertedRows.map(r => r.id).join(', ')}`);
    return { intakeId: insertedRows[0].id, intakeIds: insertedRows.map(row => row.id) };
  }

  /**
   * Provider adapter for the Microsoft Graph deals mailbox.
   * A true result means the message is durably represented by either an
   * automated deal outcome or a pending manual-review queue item.
   */
  static async processGraphMessage(message: {
    id: string;
    from: string;
    to: string;
    cc?: string;
    replyTo?: string;
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename: string; contentType: string; content: string }>;
  }): Promise<boolean> {
    const htmlAsText = String(message.html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const rawBody = {
      graphMessageId: message.id,
      from: message.from,
      to: message.to || 'deals@landlinq.ai',
      cc: message.cc || '',
      subject: message.subject || '',
      text: message.text || htmlAsText,
      html: message.html || '',
      replyTo: message.replyTo,
      envelope: JSON.stringify({ to: ['deals@landlinq.ai'], from: message.from }),
      attachments: message.attachments || [],
    };
    const queued = await EmailIntakeService.processInboundEmail(rawBody);
    if (!queued) return false;
    const { processAutomatedDealEmailIntake } = await import('./automatedDealEmailPipeline.js');
    for (const intakeId of queued.intakeIds) {
      const result = await processAutomatedDealEmailIntake(intakeId);
      if (!result.handled) return false;
    }
    return true;
  }

  // ── Extract original sender from a forwarded email body ─────────────────

  /**
   * When a team member forwards a broker email, the body contains forwarding
   * headers that include the ORIGINAL From: line. Extract name + email from it.
   *
   * Handles patterns like:
   *   "---------- Forwarded message ---------\nFrom: Jay Smith <jay@broker.com>"
   *   "-----Original Message-----\nFrom: Jay Smith [mailto:jay@broker.com]"
   *   "Begin forwarded message:\nFrom: Jay Smith <jay@broker.com>"
   */
  static extractOriginalSenderFromForwarded(text: string): { name: string | null; email: string | null } | null {
    if (!text) return null;

    // Locate any forwarding header block
    const fwdMarkerRe = /(?:[-─]{3,}\s*(?:forwarded message|original message|begin forwarded message)[^]*?[-─]{0,3}|begin forwarded message\s*:?\s*)/i;
    const markerMatch = fwdMarkerRe.exec(text);
    // Search in a window: either after the marker or in the first 3000 chars
    const searchStart = markerMatch ? markerMatch.index + markerMatch[0].length : 0;
    const searchText = text.substring(searchStart, searchStart + 3000);

    // Pattern 1: From: Name <email@example.com>
    const angleMatch = /^From:\s*(.+?)\s*<([^>@]+@[^>]+)>/im.exec(searchText);
    if (angleMatch) {
      const name = angleMatch[1].replace(/"/g, '').trim() || null;
      const email = angleMatch[2].trim();
      return { name, email };
    }

    // Pattern 2: From: Name [mailto:email@example.com]
    const mailtoMatch = /^From:\s*(.+?)\s*\[mailto:([^\]@]+@[^\]]+)\]/im.exec(searchText);
    if (mailtoMatch) {
      return { name: mailtoMatch[1].trim() || null, email: mailtoMatch[2].trim() };
    }

    // Pattern 3: From: email@example.com (plain email, no display name)
    const plainMatch = /^From:\s*([^\s@<]+@[^\s>]+)/im.exec(searchText);
    if (plainMatch) {
      return { name: null, email: plainMatch[1].trim() };
    }

    return null;
  }

  // ── GPT-4o structured parser with few-shot injection ─────────────────────

  private static async aiParseEmail(
    text: string,
    fromEmail: string,
    subject?: string,
    replyTo?: string,
    isForwarded?: boolean,
    originalSender?: { name: string | null; email: string | null } | null
  ): Promise<ParseResult[]> {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Pull up to 5 curated training examples to inject as few-shot context
    const fewShotBlock = await EmailIntakeService.buildFewShotBlock();

    const replyToLine = replyTo ? `REPLY-TO: ${replyTo}` : '';

    // Build forwarded-email header block for the prompt
    let forwardedSenderBlock = '';
    if (isForwarded) {
      if (originalSender?.email) {
        forwardedSenderBlock = `⚠️ FORWARDED EMAIL — the FROM address above is a Catalyst Capital team member who forwarded this email. They are NOT the broker.
ORIGINAL BROKER EMAIL (pre-extracted from forwarding headers): ${originalSender.email}${originalSender.name ? ` (${originalSender.name})` : ''}
Use this as brokerEmail and brokerName — do NOT use the FROM address.`;
      } else {
        forwardedSenderBlock = `⚠️ FORWARDED EMAIL — the FROM address above is a Catalyst Capital team member who forwarded this email. They are NOT the broker.
Find the original broker's name and email from the forwarded email body (sign-off like "Best, Jay", signature block, or "From: Name <email>" in the forwarding headers).`;
      }
    }

    const prompt = `You are a real estate deal analyst. Extract property information from this broker email.
Return ONLY valid JSON matching the exact schema below.
${fewShotBlock}
EMAIL FROM: ${fromEmail}
${replyToLine}
${forwardedSenderBlock}
SUBJECT: ${subject || '(none)'}

EMAIL CONTENT:
${text.substring(0, 40000)}

⚠️ MULTIPLE PROPERTIES: Brokers often list SEVERAL distinct, unrelated tracts/sites in ONE email (e.g. "here are the four sites we discussed plus a new opportunity"), each with its own address/acreage/notes. You MUST return ONE ENTRY PER DISTINCT PROPERTY in the "properties" array below. Do NOT merge them into one, and do NOT only extract the first one. Only treat something as a SEPARATE property if it has its own distinct address/site identifier — do not split a single property's details (e.g. two parcels of the SAME site that must be sold together) into multiple entries; that stays as ONE property.

Return this exact JSON structure:
{
  "properties": [
    {
      "dealType": "land_development" if this is raw/vacant land being sold for future development, OR "existing_multifamily" if this is an existing apartment complex/multifamily property for sale, OR "unknown" if unclear,
      "propertyName": the explicitly named listing or project name as written in THIS email subject or body headline only. Use the name exactly as written. Return null if NO name is given in THIS email. NEVER use example names — only what literally appears in this specific email.,
      "address": the explicit street address (number + street name) verbatim from THIS email only. Common patterns: "1234 Street Name — City, ST ZIP" or an address in the subject line. CRITICAL: if no street number + street name exists anywhere in this email or its attachments, you MUST return null. DO NOT generate, guess, or use placeholder addresses like "123 Main St", "456 Oak Ave", or any invented address. NEVER use a county name, region, or project name as an address. NEVER include city/state/zip here. NEVER copy an address from a training example.,
      "city": "city name — explicitly stated in THIS email OR inferred from a named neighborhood/district/landmark you recognize. Never use a region or submarket name as a city." or null,
      "state": "2-letter US state code" or null,
      "zip": "5-digit ZIP code — look for it after city/state in address lines like 'Boiling Springs, SC 29316'. Extract it if present." or null,
      "acres": number — look for patterns like "19.7 acres", "~19.7 acres", "(~19.7 acres)", "±20 acres", "12.5 ac". The ~ and ± symbols mean 'approximately' — still extract the number. NEVER invent or estimate acreage. or null,
      "price": number in whole dollars — ONLY if a specific dollar amount is explicitly stated as the ASKING or LIST price for THIS property (e.g. "$4,500,000", "asking $2.1M"). NEVER guess, infer, or use income/rent figures as the price. If no asking price is stated, return null.,
      "unitCount": integer — VERY IMPORTANT: look for patterns like "306-unit", "306 units", "306 apartments", "approved for 306 units", "entitled for 274 apartment units". Extract the number. For land/development deals, look for approved or entitled unit counts. or null,
      "vintage": for a single year use that year; for MULTIPLE years (e.g. "1985, 1987 & 1989") use the MOST RECENT year (1989); 4-digit integer or null,
      "brokerName": the name of the person who WROTE the email or signed it. Check in this order: (1) sign-off at bottom of email body ("Best, Jay" → "Jay"; "Thanks, John Smith" → "John Smith"; "Sincerely, [Name]" → that name), (2) signature block in body, (3) REPLY-TO name. For forwarded emails: ignore the forwarding person entirely — use the ORIGINAL author's sign-off/signature. NEVER use an @catalystcp.com or @landlinq.ai person. or null,
      "brokerEmail": the primary/first broker's email. Priority order: (1) email from the signature block in the body, (2) REPLY-TO addresses, (3) FROM address only if it is a real person (not a distribution list). NEVER use @catalystcp.com or @landlinq.ai. or null,
      "brokerPhone": phone number from the primary broker's signature or null,
      "notes": "2-4 sentence summary of key deal details SPECIFIC TO THIS PROPERTY: entitlement status, approved unit count, value-add opportunity, renovation status, NOI/rent premium potential, proximity to major employment/highways, supply constraints, permits, utilities, or other notable deal terms mentioned for this specific site." or null,
      "zoning": "zoning code or description" or null,
      "confidences": {
        "address": 0-100,
        "city": 0-100,
        "state": 0-100,
        "zip": 0-100,
        "acres": 0-100,
        "price": 0-100,
        "unitCount": 0-100,
        "vintage": 0-100
      }
    }
  ]
}

CRITICAL RULES:
- EVERY field must come VERBATIM from THIS email. NEVER use values from training examples. NEVER invent or hallucinate any field — return null if not in the email.
- FORWARDED EMAILS: If the subject starts with "Fwd:" or "Fw:" or the body contains "Begin forwarded message" or "Forwarded message", the forwarding person is NEVER the broker. Extract broker info from the body of the forwarded email (sign-off, signature block, REPLY-TO).
- address: ONLY a real street number + street name explicitly written in THIS email or its PDF attachment. If the email only mentions a county, city, region, or project name with NO street address, you MUST return null — never generate a placeholder like "123 Main St". A county name ("Brunswick County") is NOT an address and must NOT be placed in the address field.
- city vs county: A "county" is NOT a city. "Brunswick County, NC" → city=null (or the specific city if named), NOT city="Brunswick County". Only use a real city/town name in the city field.
- propertyName: use ONLY names that literally appear in THIS email. NEVER invent a property name or use one from a training example.
- ZIP code: explicitly look for 5-digit codes in address lines. "Boiling Springs, SC 29316" → zip = "29316".
- acres: "~19.7 acres" → 19.7. "(~19.7 acres)" → 19.7. "±20 ac" → 20. The ~ and ± are approximation symbols, not negatives — extract the number.
- unitCount: "306-unit multifamily" → 306. "approved for 274 apartment units" → 274. Look in BOTH the subject line and body.
- price: if the email does NOT explicitly state an asking or list price for that property, return null. Do NOT use rent figures, valuations, or any other dollar amounts.
- brokerName: if the email ends with "Best, Jay" or "Thanks, Jay" or "Sincerely, Jay", brokerName = "Jay". If the email ends with "Best, Jay Smith", brokerName = "Jay Smith". The broker is usually the SAME person for every property in the email — reuse the same brokerName/brokerEmail/brokerPhone across all entries unless the email clearly states a different broker per property.
- state: must be a valid 2-letter US state code (NC, SC, GA, FL, TX, TN, etc.)
- brokerEmail: NEVER @catalystcp.com or @landlinq.ai
- confidence: 100 = explicitly stated verbatim, 70-90 = inferred from recognized landmark, 40-60 = inferred from context, 0 = null
- If the email describes only ONE property, return a "properties" array with exactly ONE entry.`;

    const startTime = Date.now();
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    // GPT-5 gives materially better extraction accuracy than gpt-4o (matches Claude/ChatGPT chat-level quality)
    // Note: GPT-5 only supports default temperature of 1, custom values not allowed
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: 'You are a real estate data extraction expert that always responds with valid JSON only. Never add explanations outside the JSON. Extract values ONLY from the email provided — never invent or hallucinate values.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4000,
    });
    apiCallTracker.logCall('OpenAI', 'email_intake_parse', true, Date.now() - startTime);

    const raw = JSON.parse(response.choices[0].message.content || '{}');
    let rawProperties: any[] = Array.isArray(raw.properties) ? raw.properties : [];
    // Backward-compat: if the model ever returns a flat single-property shape, wrap it.
    if (rawProperties.length === 0 && (raw.address || raw.propertyName || raw.dealType)) {
      rawProperties = [raw];
    }
    if (rawProperties.length === 0) {
      rawProperties = [{}];
    }

    return rawProperties.map((rawProp) => {
      const confs = rawProp.confidences || {};
      const confidences: FieldConfidences = {
        address: Number(confs.address) || 0,
        city: Number(confs.city) || 0,
        state: Number(confs.state) || 0,
        zip: Number(confs.zip) || 0,
        acres: Number(confs.acres) || 0,
        price: Number(confs.price) || 0,
        unitCount: Number(confs.unitCount) || 0,
        vintage: Number(confs.vintage) || 0,
      };
      const keyConfs = [confidences.address, confidences.city, confidences.state];
      const overallConfidence = Math.round(keyConfs.reduce((a, b) => a + b, 0) / keyConfs.length);

      return {
        fields: {
          dealType: ['land_development', 'existing_multifamily', 'unknown'].includes(rawProp.dealType) ? rawProp.dealType : 'unknown',
          propertyName: rawProp.propertyName || undefined,
          address: rawProp.address || undefined,
          city: rawProp.city || undefined,
          state: rawProp.state || undefined,
          zip: rawProp.zip || undefined,
          acres: rawProp.acres != null ? Number(rawProp.acres) : undefined,
          price: rawProp.price != null ? Math.round(Number(rawProp.price)) : undefined,
          unitCount: rawProp.unitCount != null ? Number(rawProp.unitCount) : undefined,
          vintage: rawProp.vintage != null ? Number(rawProp.vintage) : undefined,
          brokerName: rawProp.brokerName || undefined,
          brokerEmail: rawProp.brokerEmail && !rawProp.brokerEmail.match(/@catalystcp\.com|@landlinq\.ai/i) ? rawProp.brokerEmail : undefined,
          brokerPhone: rawProp.brokerPhone || undefined,
          notes: rawProp.notes || undefined,
          zoning: rawProp.zoning || undefined,
        },
        confidences,
        overallConfidence,
      };
    });
  }

  // ── Few-shot context builder ──────────────────────────────────────────────
  // Pulls the most recent curated examples from the training table and formats
  // them as input-output demonstrations for the prompt.

  private static async buildFewShotBlock(): Promise<string> {
    try {
      const examples = await db
        .select()
        .from(emailIntakeTrainingExamples)
        .where(eq(emailIntakeTrainingExamples.useInPrompt, true))
        .orderBy(desc(emailIntakeTrainingExamples.createdAt))
        .limit(5);

      if (examples.length === 0) return '';

      let block = '\n\nLEARNED EXAMPLES — these are real emails our analysts have corrected. Use them as ground truth for how to extract fields:\n\n';
      for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        const correctOutput = ex.correctedOutput || ex.parsedOutput;
        const snippet = (ex.emailBody || '').substring(0, 800).replace(/\n{3,}/g, '\n\n');
        block += `=== EXAMPLE ${i + 1} ===\n`;
        block += `Subject: ${ex.subject || '(none)'}\nFrom: ${ex.fromEmail || '(none)'}\n`;
        block += `Email body (truncated):\n${snippet}\n\n`;
        // If analyst corrected the AI, show what was WRONG and what is RIGHT
        if (ex.correctedOutput && ex.parsedOutput) {
          const wrong = ex.parsedOutput as any;
          const right = ex.correctedOutput as any;
          const corrections: string[] = [];
          for (const k of Object.keys(right)) {
            if (JSON.stringify(right[k]) !== JSON.stringify((wrong as any)[k]) && right[k] != null) {
              corrections.push(`  "${k}": AI said ${JSON.stringify((wrong as any)[k])} → CORRECT is ${JSON.stringify(right[k])}`);
            }
          }
          if (corrections.length > 0) {
            block += `ANALYST CORRECTIONS (AI was wrong on these fields):\n${corrections.join('\n')}\n`;
          }
        }
        block += `CORRECT JSON OUTPUT: ${JSON.stringify(correctOutput, null, 0)}\n\n`;
      }
      block += '=== END OF EXAMPLES ===\n\n';
      return block;
    } catch (e) {
      console.warn('⚠️ [INTAKE] Could not load few-shot examples:', e);
      return '';
    }
  }

  // ── PDF extraction ───────────────────────────────────────────────────────

  private static async extractPdfText(att: any): Promise<string> {
    let buffer: Buffer;
    if (typeof att.content === 'string') {
      buffer = Buffer.from(att.content, 'base64');
    } else if (Buffer.isBuffer(att.content)) {
      buffer = att.content;
    } else if (att.url) {
      const axios = (await import('axios')).default;
      const resp = await axios.get(att.url, { responseType: 'arraybuffer', timeout: 10000 });
      buffer = Buffer.from(resp.data);
    } else {
      return '';
    }
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const text = (data.text || '').trim();

    // A real text layer for a typical single-page flyer/OM should yield well over
    // a couple hundred characters per page. If it's suspiciously short, this is
    // almost certainly a scanned/image-only PDF (no text layer) — fall back to
    // rendering pages as images and running vision OCR, same as Claude/ChatGPT do.
    const numPages = data.numpages || 1;
    const isLikelyScanned = text.length < 40 * numPages;
    if (isLikelyScanned) {
      console.log(`📠 [INTAKE] PDF "${att.filename}" looks scanned/image-only (${text.length} chars over ${numPages} pages) — falling back to image OCR`);
      try {
        const ocrText = await EmailIntakeService.extractPdfViaImageOCR(buffer, att.filename || 'attachment.pdf');
        if (ocrText.trim().length > text.length) {
          return ocrText.trim().substring(0, 20000);
        }
      } catch (e) {
        console.warn(`⚠️ [INTAKE] PDF image-OCR fallback failed for ${att.filename}:`, e);
      }
    }

    return text.substring(0, 20000);
  }

  // ── PDF → image OCR fallback (for scanned/image-only PDFs with no text layer) ──

  private static async extractPdfViaImageOCR(pdfBuffer: Buffer, filename: string): Promise<string> {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const jobId = crypto.randomUUID();
    const tmpDir = os.tmpdir();
    const pdfPath = path.join(tmpDir, `intake-${jobId}.pdf`);
    const outPrefix = path.join(tmpDir, `intake-${jobId}-page`);
    const MAX_PAGES = 5; // cap cost/latency — most broker flyers/OMs are 1-3 pages

    const cleanupPaths: string[] = [pdfPath];
    try {
      await fs.writeFile(pdfPath, pdfBuffer);

      // Render pages to PNG at 150 DPI using poppler's pdftoppm (already available in this environment)
      await execFileAsync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', String(MAX_PAGES), pdfPath, outPrefix], { timeout: 60000 });

      const dirFiles = await fs.readdir(tmpDir);
      const pageFiles = dirFiles
        .filter(f => f.startsWith(`intake-${jobId}-page`))
        .sort();

      if (pageFiles.length === 0) {
        console.warn(`⚠️ [INTAKE] pdftoppm produced no pages for ${filename}`);
        return '';
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      let combinedText = '';
      for (const pageFile of pageFiles) {
        const fullPath = path.join(tmpDir, pageFile);
        cleanupPaths.push(fullPath);
        const imgBuffer = await fs.readFile(fullPath);
        const base64Image = imgBuffer.toString('base64');

        try {
          // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
          const response = await openai.chat.completions.create({
            model: 'gpt-5',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: `This is a scanned page from a real estate deal PDF (${filename}). Transcribe ALL visible text exactly as it appears, including any property address, price, acreage, unit count, zoning, and broker contact info. Return plain text only — no commentary.` },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}`, detail: 'high' } },
              ],
            }],
            max_completion_tokens: 1500,
          });
          const pageText = response.choices[0].message.content || '';
          if (pageText.trim()) {
            combinedText += `\n${pageText.trim()}\n`;
          }
        } catch (e) {
          console.warn(`⚠️ [INTAKE] Vision OCR failed for page ${pageFile}:`, e);
        }
      }

      return combinedText;
    } finally {
      // Always clean up temp files, even on failure
      await Promise.all(cleanupPaths.map(p => fs.unlink(p).catch(() => {})));
    }
  }

  // ── Attachment buffer helper (shared by docx/xlsx extractors) ────────────

  private static async attachmentToBuffer(att: any): Promise<Buffer | null> {
    if (typeof att.content === 'string') {
      return Buffer.from(att.content, 'base64');
    } else if (Buffer.isBuffer(att.content)) {
      return att.content;
    } else if (att.url) {
      const axios = (await import('axios')).default;
      const resp = await axios.get(att.url, { responseType: 'arraybuffer', timeout: 10000 });
      return Buffer.from(resp.data);
    }
    return null;
  }

  // ── Word (.docx) extraction ───────────────────────────────────────────────

  private static async extractDocxText(att: any): Promise<string> {
    try {
      const buffer = await EmailIntakeService.attachmentToBuffer(att);
      if (!buffer) return '';
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || '').trim().substring(0, 20000);
    } catch (e) {
      console.warn(`⚠️ [INTAKE] .docx extraction failed for ${att.filename}:`, e);
      return '';
    }
  }

  // ── Spreadsheet (.xlsx/.xls/.csv) extraction ─────────────────────────────

  private static async extractSpreadsheetText(att: any): Promise<string> {
    try {
      const buffer = await EmailIntakeService.attachmentToBuffer(att);
      if (!buffer) return '';
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let out = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
          out += `\n[Sheet: ${sheetName}]\n${csv.trim()}\n`;
        }
        if (out.length > 20000) break;
      }
      return out.trim().substring(0, 20000);
    } catch (e) {
      console.warn(`⚠️ [INTAKE] Spreadsheet extraction failed for ${att.filename}:`, e);
      return '';
    }
  }

  // ── Vision API for image attachments ────────────────────────────────────

  private static async describeImageAttachment(att: any, subject?: string): Promise<string> {
    if (!att.content && !att.url) return '';
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      let imageUrl: string;
      if (att.url) {
        imageUrl = att.url;
      } else if (typeof att.content === 'string') {
        imageUrl = `data:${att.contentType || 'image/jpeg'};base64,${att.content}`;
      } else {
        return '';
      }
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Real estate deal email attachment (subject: "${subject || 'deal'}"). Extract: address, location, acreage, price, unit count, zoning, broker name/contact. Return as plain text.` },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        }],
        max_completion_tokens: 800,
      });
      return response.choices[0].message.content || '';
    } catch (e) {
      console.warn('⚠️ [INTAKE-VISION] Failed:', e);
      return '';
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Extracts email fields from a SendGrid Inbound Parse webhook body.
   * Handles BOTH modes:
   *  - Normal (Send Raw OFF): body has `from`, `to`, `subject`, `text` fields directly.
   *  - Raw MIME (Send Raw ON):  body has a single `email` field with full MIME source.
   */
  private static async extractEmailFields(body: any, files?: Array<{ fieldname: string; originalname: string; mimetype: string; buffer: Buffer }>): Promise<RawEmail | null> {
    if (!body || typeof body !== 'object') return null;

    // ── Raw MIME mode (Send Raw ON in SendGrid) ──────────────────────────────
    if (body.email && typeof body.email === 'string' && !body.from) {
      try {
        const parsed = await simpleParser(body.email);
        const from = parsed.from?.text || '';
        if (!from) return null;

        // Build envelope-like to string from the parsed addresses
        const toAddresses = parsed.to
          ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to])
              .flatMap((a: any) => a.value?.map((v: any) => v.address) || [])
              .join(', ')
          : '';
        const ccAddresses = parsed.cc
          ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc])
              .flatMap((a: any) => a.value?.map((v: any) => v.address) || [])
              .join(', ')
          : '';

        // Build synthetic envelope JSON (so the recipient check works)
        const allTo = [toAddresses, ccAddresses].filter(Boolean).join(', ');
        const syntheticEnvelope = JSON.stringify({
          to: allTo ? [allTo] : [],
          from: parsed.from?.value?.[0]?.address || from,
        });

        // Map attachments from mailparser format
        const attachments: RawEmail['attachments'] = (parsed.attachments || []).map((att: any) => ({
          filename: att.filename || 'attachment',
          contentType: att.contentType || 'application/octet-stream',
          content: att.content ? att.content.toString('base64') : undefined,
        }));

        const replyTo = parsed.replyTo
          ? (Array.isArray(parsed.replyTo) ? parsed.replyTo : [parsed.replyTo])
              .flatMap((a: any) => a.value?.map((v: any) => v.address) || [])
              .filter(Boolean)
              .join(', ')
          : '';

        console.log(`📧 [INTAKE] Parsed raw MIME — from: ${from}, to: ${toAddresses || ccAddresses}${replyTo ? `, reply-to: ${replyTo}` : ''}`);

        return {
          from,
          to: toAddresses,
          subject: parsed.subject || '',
          text: parsed.text || '',
          html: parsed.html || '',
          replyTo: replyTo || undefined,
          attachments,
          envelope: syntheticEnvelope,
        };
      } catch (err) {
        console.error('❌ [INTAKE] Failed to parse raw MIME email:', err);
        return null;
      }
    }

    // ── Normal (parsed) mode ─────────────────────────────────────────────────
    const from = body.from || '';
    if (!from) return null;
    return {
      from,
      to: body.to || '',
      subject: body.subject || '',
      text: body.text || '',
      html: body.html || '',
      replyTo: body['reply-to'] || body.replyTo || undefined,
      attachments: EmailIntakeService.parseAttachments(body, files),
      envelope: body.envelope,
    };
  }

  private static parseAttachments(body: any, files?: Array<{ fieldname: string; originalname: string; mimetype: string; buffer: Buffer }>): RawEmail['attachments'] {
    const attachments: RawEmail['attachments'] = [];

    // SendGrid Inbound Parse (Send Raw OFF) delivers each attachment as a
    // separate multipart/form-data FILE part named attachment1, attachment2, ...
    // multer.any() puts those in req.files, NOT req.body — so we must read
    // the binary content from `files`, falling back to any base64 string
    // that might still land directly in `body` (some proxies/webhooks do this).
    if (files && files.length > 0) {
      const attachmentInfo = body['attachment-info'] ? JSON.parse(body['attachment-info']) : null;
      for (const file of files) {
        if (!/^attachment\d+$/.test(file.fieldname)) continue;
        attachments.push({
          filename: attachmentInfo?.[file.fieldname]?.filename || file.originalname || file.fieldname,
          contentType: file.mimetype || attachmentInfo?.[file.fieldname]?.type || 'application/octet-stream',
          content: file.buffer ? file.buffer.toString('base64') : undefined,
        });
      }
    }

    let i = 1;
    while (body[`attachment${i}`]) {
      const att = body[`attachment${i}`];
      attachments.push({
        filename: body['attachment-info']
          ? JSON.parse(body['attachment-info'])[`attachment${i}`]?.filename || `attachment${i}`
          : `attachment${i}`,
        contentType: att.contentType || 'application/octet-stream',
        content: typeof att === 'string' ? att : att.content,
        url: att.url,
      });
      i++;
    }
    if (body.attachments && Array.isArray(body.attachments)) {
      for (const att of body.attachments) {
        attachments.push({
          filename: att.filename || att.name || 'attachment',
          contentType: att.type || att.contentType || 'application/octet-stream',
          content: att.content,
          url: att.url,
        });
      }
    }
    return attachments;
  }

  private static nameFromEmail(email: string): string {
    const nameMatch = email.match(/^([^<]+)<.+>$/);
    if (nameMatch) return nameMatch[1].trim();
    const local = email.split('@')[0];
    return local.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
  }

  // ── Link follower ─────────────────────────────────────────────────────────
  // Extracts deal-relevant links from email HTML (package, OM, due diligence,
  // brochure, flyer), fetches each URL, parses PDF or HTML, and returns the
  // combined text so the AI gets the full package content.

  private static extractDealLinks(html: string): Array<{ url: string; label: string }> {
    if (!html) return [];
    const DEAL_KEYWORDS = /package|due.?diligence|offering.?mem|brochure|flyer|om\b|marketing|property.?info|deal.?room|data.?room|costar|loopnet|crexi/i;
    const SKIP_DOMAINS = /mailto:|landlinq|unsubscribe|google\.com\/maps|linkedin|facebook|twitter|instagram/i;
    const links: Array<{ url: string; label: string }> = [];
    const seen = new Set<string>();
    // Match all <a href="...">text</a> pairs
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const url = m[1].trim();
      const label = m[2].replace(/<[^>]+>/g, '').trim();
      if (!url.startsWith('http')) continue;
      if (SKIP_DOMAINS.test(url)) continue;
      if (seen.has(url)) continue;
      if (DEAL_KEYWORDS.test(label) || DEAL_KEYWORDS.test(url)) {
        seen.add(url);
        links.push({ url, label: label || url });
      }
    }
    return links.slice(0, 4); // cap at 4 links to avoid runaway fetching
  }

  private static async fetchLinkedPackageContent(html: string): Promise<string> {
    const links = EmailIntakeService.extractDealLinks(html);
    if (links.length === 0) return '';

    const fetch = (await import('node-fetch')).default;
    const pdfParse = (await import('pdf-parse')).default;
    const results: string[] = [];

    for (const { url, label } of links) {
      try {
        console.log(`🔗 [INTAKE] Fetching linked content: ${label} — ${url}`);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000); // 10s timeout
        const res = await fetch(url, {
          signal: controller.signal as any,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LandLinq/1.0; +https://landlinq.ai)' },
          redirect: 'follow',
        });
        clearTimeout(timer);

        const contentType = res.headers.get('content-type') || '';
        const buf = await res.buffer();

        if (contentType.includes('pdf') || url.toLowerCase().includes('.pdf')) {
          const parsed = await pdfParse(buf);
          const text = parsed.text?.substring(0, 4000).trim();
          if (text) {
            results.push(`\n\nLINKED PACKAGE (${label}):\n${text}`);
            console.log(`✅ [INTAKE] PDF fetched: ${text.length} chars from ${label}`);
          }
        } else if (contentType.includes('html') || contentType.includes('text')) {
          // Strip HTML tags and collapse whitespace
          const text = buf.toString('utf8')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .substring(0, 4000)
            .trim();
          if (text) {
            results.push(`\n\nLINKED PAGE (${label}):\n${text}`);
            console.log(`✅ [INTAKE] HTML page fetched: ${text.length} chars from ${label}`);
          }
        }
      } catch (e: any) {
        const reason = e?.name === 'AbortError' ? 'timeout' : e?.message || 'error';
        console.warn(`⚠️ [INTAKE] Link fetch failed (${label}): ${reason}`);
      }
    }
    return results.join('');
  }

  // ── Correction diff helper ───────────────────────────────────────────────
  // Returns which fields the analyst changed and by how much.

  private static computeCorrectionDiff(
    item: any,
    overrides: Record<string, any>
  ): Record<string, { ai: any; analyst: any }> {
    const fieldMap: Record<string, string> = {
      address: 'parsedAddress',
      city: 'parsedCity',
      state: 'parsedState',
      zip: 'parsedZip',
      acres: 'parsedAcres',
      price: 'parsedPrice',
      unitCount: 'parsedUnitCount',
      vintage: 'parsedVintage',
      brokerName: 'parsedBrokerName',
      brokerEmail: 'parsedBrokerEmail',
      brokerPhone: 'parsedBrokerPhone',
      notes: 'parsedNotes',
      zoning: 'parsedZoning',
    };
    const diff: Record<string, { ai: any; analyst: any }> = {};
    for (const [overrideKey, dbColumn] of Object.entries(fieldMap)) {
      if (overrides[overrideKey] !== undefined) {
        const aiVal = item[dbColumn];
        const analystVal = overrides[overrideKey];
        if (String(aiVal ?? '') !== String(analystVal ?? '')) {
          diff[overrideKey] = { ai: aiVal ?? null, analyst: analystVal };
        }
      }
    }
    return diff;
  }

  // ── Approve an intake item and create a deal ─────────────────────────────

  static async approveIntakeItem(
    intakeId: string,
    overrides: Partial<Record<string, any>>,
    reviewerEmail: string
  ): Promise<{ dealId: string }> {
    const [item] = await db.select().from(emailIntakeQueue)
      .where(eq(emailIntakeQueue.id, intakeId)).limit(1);

    if (!item) throw new Error('Intake item not found');
    if (item.status !== 'pending') throw new Error('Item is no longer pending');

    // Compute correction diff — this is our training signal
    const correctionDiff = EmailIntakeService.computeCorrectionDiff(item, overrides);
    const correctionCount = Object.keys(correctionDiff).length;
    const wasFullyCorrect = correctionCount === 0;

    // Merge analyst edits over parsed fields
    const propertyName = overrides.propertyName ?? item.parsedPropertyName ?? '';
    const address    = overrides.address    ?? item.parsedAddress   ?? '';
    const city       = overrides.city       ?? item.parsedCity      ?? '';
    const state      = overrides.state      ?? item.parsedState     ?? '';
    const zip        = overrides.zip        ?? item.parsedZip       ?? '';
    const acres      = overrides.acres      ?? (item.parsedAcres ? Number(item.parsedAcres) : null);
    const price      = overrides.price      ?? item.parsedPrice     ?? null;
    const unitCount  = overrides.unitCount  ?? item.parsedUnitCount ?? null;
    const vintage    = overrides.vintage    ?? item.parsedVintage   ?? null;
    const brokerName = overrides.brokerName ?? item.parsedBrokerName ?? '';
    const brokerEmail = overrides.brokerEmail ?? item.parsedBrokerEmail ?? item.fromEmail;
    const brokerPhone = overrides.brokerPhone ?? item.parsedBrokerPhone ?? '';
    const notes      = overrides.notes      ?? item.parsedNotes     ?? '';
    const zoning     = overrides.zoning     ?? item.parsedZoning    ?? '';

    // Find or create broker
    const { storage } = await import('./storage.js');
    let brokerId: string | null = null;
    try {
      const nameParts = brokerName.trim().split(/\s+/);
      const { broker } = await storage.findOrCreateBroker({
        email: brokerEmail,
        firstName: nameParts[0] || 'Email',
        lastName: nameParts.slice(1).join(' ') || 'Submission',
        phone: brokerPhone || undefined,
      });
      brokerId = broker?.id || null;
    } catch (e) {
      console.warn('⚠️ [INTAKE-APPROVE] Broker find/create failed:', e);
    }

    // Read stored attachment file paths from object storage (saved during intake processing)
    let intakeDocumentUrls: string[] = [];
    try {
      const rawIntake = await db.execute(sql`SELECT attachment_files FROM email_intake_queue WHERE id = ${intakeId}`);
      const attachmentFiles = (rawIntake.rows?.[0] as any)?.attachment_files;
      if (Array.isArray(attachmentFiles) && attachmentFiles.length > 0) {
        intakeDocumentUrls = attachmentFiles.map((f: any) => f.objectPath).filter(Boolean);
        console.log(`📎 [INTAKE-APPROVE] Attaching ${intakeDocumentUrls.length} file(s) to deal`);
      }
    } catch (e) {
      console.warn('⚠️ [INTAKE-APPROVE] Could not read attachment_files:', e);
    }

    // Create deal
    const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
    const deal = await storage.createDeal({
      propertyName: propertyName || null,
      address: address || fullAddress,
      city: city || null,
      state: state || null,
      zip: zip || null,
      sizeAcres: acres ? String(acres) : null,
      askingPrice: price ? String(price) : null,
      unitCount: unitCount ? String(unitCount) : null,
      vintage: vintage ? String(vintage) : null,
      zoning: zoning || null,
      brokerNotes: notes || null,
      brokerId,
      sourceEmail: item.fromEmail,
      submissionMethod: 'email',
      status: 'pending_info',
      documentUrls: intakeDocumentUrls.length > 0 ? intakeDocumentUrls : undefined,
    } as any);

    // Mark approved + store correction diff
    await db.execute(sql`
      UPDATE email_intake_queue SET
        status = 'approved',
        deal_id = ${deal.id},
        reviewed_at = NOW(),
        reviewed_by = ${reviewerEmail},
        correction_diff = ${JSON.stringify(correctionDiff)}::jsonb,
        correction_count = ${correctionCount},
        is_training_example = ${wasFullyCorrect}
      WHERE id = ${intakeId}
    `);

    // Auto-save as training example if fully correct OR if corrections are made
    // (corrections are the most valuable signal — they teach the AI what it got wrong)
    try {
      const aiOutput = {
        address: item.parsedAddress,
        city: item.parsedCity,
        state: item.parsedState,
        zip: item.parsedZip,
        acres: item.parsedAcres ? Number(item.parsedAcres) : null,
        price: item.parsedPrice,
        unitCount: item.parsedUnitCount,
        vintage: item.parsedVintage,
        brokerName: item.parsedBrokerName,
        brokerEmail: item.parsedBrokerEmail,
        brokerPhone: item.parsedBrokerPhone,
        notes: item.parsedNotes,
        zoning: item.parsedZoning,
      };
      const finalOutput = {
        address, city, state, zip,
        acres: acres ? Number(acres) : null,
        price: price ? Number(price) : null,
        unitCount: unitCount ? Number(unitCount) : null,
        vintage: vintage ? Number(vintage) : null,
        brokerName, brokerEmail, brokerPhone, notes, zoning,
      };

      await db.insert(emailIntakeTrainingExamples).values({
        intakeId,
        emailBody: (item.emailBody || '').substring(0, 4000),
        subject: item.subject,
        fromEmail: item.fromEmail,
        parsedOutput: aiOutput as any,
        correctedOutput: correctionCount > 0 ? finalOutput as any : null,
        label: correctionCount > 0 ? 'correction' : 'positive',
        useInPrompt: true,
        addedBy: reviewerEmail,
      });
      console.log(`📚 [TRAINING] Saved ${correctionCount > 0 ? 'correction' : 'positive'} example from ${intakeId}`);
    } catch (trainingErr) {
      console.warn('⚠️ [TRAINING] Could not save training example:', trainingErr);
    }

    // Queue enrichment job
    try {
      const { backgroundJobs } = await import('../shared/schema.js');
      await db.insert(backgroundJobs).values({
        jobType: 'quick_deal_enrichment',
        payload: { dealId: deal.id, triggerSource: 'email_intake_approve' } as any,
        status: 'pending',
        scheduledFor: new Date(),
        attempts: 0,
        maxAttempts: 3,
      });
    } catch (jobErr) {
      console.warn('⚠️ [INTAKE-APPROVE] Could not queue enrichment job:', jobErr);
    }

    console.log(`✅ [INTAKE-APPROVE] Deal ${deal.id} created — ${correctionCount} AI corrections recorded`);
    return { dealId: deal.id };
  }

  // ── Training data management ─────────────────────────────────────────────

  /** Manually save an approved item as a training example (called from API route). */
  static async saveAsTrainingExample(intakeId: string, addedBy: string): Promise<void> {
    const [item] = await db.select().from(emailIntakeQueue)
      .where(eq(emailIntakeQueue.id, intakeId)).limit(1);
    if (!item) throw new Error('Item not found');

    // Mark it
    await db.execute(sql`
      UPDATE email_intake_queue SET is_training_example = TRUE WHERE id = ${intakeId}
    `);

    // Check if already in training table
    const existing = await db.select().from(emailIntakeTrainingExamples)
      .where(eq(emailIntakeTrainingExamples.intakeId, intakeId)).limit(1);
    if (existing.length > 0) {
      // Update to ensure it's enabled
      await db.update(emailIntakeTrainingExamples)
        .set({ useInPrompt: true })
        .where(eq(emailIntakeTrainingExamples.intakeId, intakeId));
      return;
    }

    await db.insert(emailIntakeTrainingExamples).values({
      intakeId,
      emailBody: (item.emailBody || '').substring(0, 4000),
      subject: item.subject,
      fromEmail: item.fromEmail,
      parsedOutput: {
        address: item.parsedAddress,
        city: item.parsedCity,
        state: item.parsedState,
        zip: item.parsedZip,
        acres: item.parsedAcres ? Number(item.parsedAcres) : null,
        price: item.parsedPrice,
        unitCount: item.parsedUnitCount,
        vintage: item.parsedVintage,
        brokerName: item.parsedBrokerName,
        brokerEmail: item.parsedBrokerEmail,
        brokerPhone: item.parsedBrokerPhone,
        notes: item.parsedNotes,
        zoning: item.parsedZoning,
      } as any,
      label: 'positive',
      useInPrompt: true,
      addedBy,
    });
    console.log(`📚 [TRAINING] Manually saved training example for ${intakeId}`);
  }

  /** Toggle whether an example is used in prompts. */
  static async toggleTrainingExample(exampleId: string, useInPrompt: boolean): Promise<void> {
    await db.update(emailIntakeTrainingExamples)
      .set({ useInPrompt })
      .where(eq(emailIntakeTrainingExamples.id, exampleId));
  }

  /** Aggregate correction stats — which fields does the AI most often get wrong? */
  static async getTrainingStats(): Promise<{
    totalApproved: number;
    totalWithCorrections: number;
    avgCorrectionsPerEmail: number;
    fieldCorrectionRates: Record<string, number>;
    trainingExampleCount: number;
    recentAccuracyTrend: { label: string; accuracy: number }[];
  }> {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved') AS total_approved,
        COUNT(*) FILTER (WHERE status = 'approved' AND correction_count > 0) AS total_with_corrections,
        COALESCE(AVG(correction_count) FILTER (WHERE status = 'approved'), 0) AS avg_corrections,
        jsonb_agg(correction_diff) FILTER (WHERE status = 'approved' AND correction_diff IS NOT NULL AND correction_diff != '{}'::jsonb) AS all_diffs
      FROM email_intake_queue
    `);

    const trainingCount = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM email_intake_training_examples WHERE use_in_prompt = TRUE
    `);

    // Recent trend: last 20 approved grouped into batches of 5
    const recentRows = await db.execute(sql`
      SELECT correction_count
      FROM email_intake_queue
      WHERE status = 'approved'
      ORDER BY reviewed_at DESC
      LIMIT 20
    `);

    const row = rows.rows[0] as any;
    const totalApproved = Number(row?.total_approved ?? 0);
    const totalWithCorrections = Number(row?.total_with_corrections ?? 0);
    const avgCorrectionsPerEmail = Number(row?.avg_corrections ?? 0);

    // Compute per-field correction rates
    const fieldCorrectionRates: Record<string, number> = {};
    const allFields = ['address', 'city', 'state', 'zip', 'acres', 'price', 'unitCount', 'vintage', 'brokerName', 'brokerEmail', 'notes', 'zoning'];
    if (row?.all_diffs && Array.isArray(row.all_diffs) && totalApproved > 0) {
      const counts: Record<string, number> = {};
      for (const diff of row.all_diffs) {
        if (!diff) continue;
        for (const field of Object.keys(diff)) {
          counts[field] = (counts[field] || 0) + 1;
        }
      }
      for (const field of allFields) {
        fieldCorrectionRates[field] = totalApproved > 0
          ? Math.round(((counts[field] || 0) / totalApproved) * 100)
          : 0;
      }
    } else {
      for (const field of allFields) fieldCorrectionRates[field] = 0;
    }

    // Build trend: group recent into batches of 5
    const recentCounts = (recentRows.rows as any[]).map(r => Number(r.correction_count ?? 0));
    const recentAccuracyTrend: { label: string; accuracy: number }[] = [];
    for (let i = 0; i < recentCounts.length; i += 5) {
      const batch = recentCounts.slice(i, i + 5);
      const perfectCount = batch.filter(c => c === 0).length;
      const accuracy = Math.round((perfectCount / batch.length) * 100);
      recentAccuracyTrend.unshift({ label: `Last ${i + batch.length}`, accuracy });
    }

    return {
      totalApproved,
      totalWithCorrections,
      avgCorrectionsPerEmail: Math.round(avgCorrectionsPerEmail * 10) / 10,
      fieldCorrectionRates,
      trainingExampleCount: Number((trainingCount.rows[0] as any)?.cnt ?? 0),
      recentAccuracyTrend,
    };
  }
}
