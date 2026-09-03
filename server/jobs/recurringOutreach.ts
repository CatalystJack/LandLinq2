// Recurring Outreach Scheduler for LandLinq
// Monthly cron jobs:
// - First Monday at 9 AM EST: Email campaigns
// - Third Monday at 9 AM EST: SMS campaigns

import * as cron from 'node-cron';
import { outreachService } from '../services/outreachService';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Convert markdown-style content to email-safe HTML with proper bullet formatting
 */
function convertContentToHtml(content: string): string {
  if (!content) return '';
  
  // DETECT HTML CONTENT from rich text editor
  // Rich text editor outputs content with tags like <p>, <ul>, <li>, <strong>, etc.
  const isHtmlContent = /<(p|ul|ol|li|strong|em|u|br|div|span)\b/i.test(content);
  
  if (isHtmlContent) {
    // Keep bold and bullets but strip the newsletter-style indentation and spacing.
    let htmlContent = content;

    // Strip ProseMirror's editor-only trailing break markers (inside paragraphs, not real line breaks)
    htmlContent = htmlContent.replace(/<br\s[^>]*class="ProseMirror-trailingBreak"[^>]*>/gi, '');

    // Lists: match native Outlook bullet styling — no extra block margins
    htmlContent = htmlContent.replace(/<ul([^>]*)>/gi, '<ul$1 style="margin: 0; padding: 0 0 0 20px; list-style-type: disc;">');
    htmlContent = htmlContent.replace(/<ol([^>]*)>/gi, '<ol$1 style="margin: 0; padding: 0 0 0 20px;">');
    htmlContent = htmlContent.replace(/<li([^>]*)>/gi, '<li$1 style="margin: 0; padding: 0; line-height: 1.2;">');

    // Empty paragraphs → blank-line spacer matching Outlook's native blank-paragraph height (~1.2×)
    htmlContent = htmlContent.replace(/<p[^>]*>\s*(<br[^>]*>)?\s*<\/p>/gi, '<p style="margin: 0; line-height: 1.2;">&nbsp;</p>');
    // Paragraphs: zero bottom margin so consecutive paragraphs flow like native Outlook
    htmlContent = htmlContent.replace(/<p([^>]*)>/gi, '<p$1 style="margin: 0; line-height: 1.2;">');
    // <p> inside <li> — no extra margin
    htmlContent = htmlContent.replace(/(<li[^>]*>)\s*<p[^>]*>/gi, '$1<p style="margin: 0; line-height: 1.2;">');

    // Final pass: strip any trailing empty nodes (including spacer divs) that survived the above
    htmlContent = trimEmailBody(htmlContent);

    // Strip bottom margin from the very last paragraph so there's no extra gap before the signature
    const lastPIdx = htmlContent.lastIndexOf('<p');
    if (lastPIdx !== -1) {
      const endTagIdx = htmlContent.indexOf('>', lastPIdx);
      if (endTagIdx !== -1) {
        const tag = htmlContent.substring(lastPIdx, endTagIdx + 1);
        const fixedTag = tag.replace(/margin:\s*0\s+0\s+[\d.]+px\s+0/i, 'margin: 0');
        htmlContent = htmlContent.substring(0, lastPIdx) + fixedTag + htmlContent.substring(endTagIdx + 1);
      }
    }

    return htmlContent;
  }
  
  // ========================================
  // LEGACY MARKDOWN PROCESSING FOR OLD CONTENT
  // ========================================
  
  // PRE-PROCESSING: Normalize dash-bullet formatting BEFORE markdown processing
  // Fix "-**Bold**" → "- **Bold**" (add space after dash when missing)
  let html = content.replace(/^(\s*)-(\*\*)/gm, '$1- $2');
  html = html.replace(/\n(\s*)-(\*\*)/g, '\n$1- $2');
  
  // Handle inline bullet items mashed together (e.g., "**text- **Next:**" → "**text**\n- **Next:**")
  html = html.replace(/(\*\*[^*]+)- \*\*([A-Z])/g, '$1**\n- **$2');
  
  // Convert standalone bold headings to bullet points
  // This handles lines like "**Complexity:** text" → "- **Complexity:** text"
  html = html.replace(/^(\s*)(\*\*[^*]+\*\*:)/gm, '$1- $2');
  html = html.replace(/\n(\s*)(\*\*[^*]+\*\*:)(?!\s*\n)/gm, '\n$1- $2');
  
  // Handle bold headings that appear inline (after other text on same line)
  html = html.replace(/([^\n])(\*\*[A-Z][^*]+\*\*:)/g, '$1\n- $2');
  
  // Apply text formatting (bold, italic, underline, links)
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #0078D4; text-decoration: underline;">$1</a>');
  
  // Handle inline dashes/bullets that start a new bullet
  html = html.replace(/([^\n\s])[-•]<strong>/g, '$1\n- <strong>');
  html = html.replace(/([^\n\s])•([A-Z])/g, '$1\n• $2');
  
  // STEP 1: Handle inline bullets BEFORE normalizing to dash
  // First, detect inline bullets (•BoldWord:) and add line breaks before them
  html = html.replace(/([^\n\s])•\s*(?=[A-Z][a-z]*:)/g, '$1\n• ');
  html = html.replace(/([^\n\s])•\s+(?=[A-Z])/g, '$1\n• ');
  
  // STEP 2: Add space after bullets directly followed by letters (before normalization)
  while (html.match(/•(?=[A-Za-z<])/)) {
    html = html.replace(/•(?=[A-Za-z<])/g, '• ');
  }
  
  // STEP 3: Now normalize bullet characters to dash for list matching
  // PRESERVE leading whitespace! Match: (start or newline)(leading whitespace)(bullet)(trailing whitespace)
  // Replace with: $1$2- (preserves the leading whitespace)
  html = html.replace(/^(\s*)•\s*/gm, '$1- ');
  html = html.replace(/\n(\s*)•\s*/g, '\n$1- ');
  
  // STEP 3.5: Normalize |> (pipe-arrow) sub-bullet character - convert to 2-space indented bullet
  // Convert |> at line start to "  - " (2-space indent)
  html = html.replace(/^\|>\s*/gm, '  - ');
  html = html.replace(/\n\|>\s*/g, '\n  - ');
  // Also handle when |> has leading whitespace already - add 2 more spaces
  html = html.replace(/^(\s+)\|>\s*/gm, '$1  - ');
  html = html.replace(/\n(\s+)\|>\s*/g, '\n$1  - ');
  
  // STEP 3.6: Handle Tab character as indent - convert each tab to 2 spaces
  html = html.replace(/^\t+/gm, (match) => '  '.repeat(match.length));
  html = html.replace(/\n\t+/g, (match) => '\n' + '  '.repeat(match.length - 1));
  
  // STEP 4: Also normalize other bullet Unicode characters - PRESERVE leading whitespace
  html = html.replace(/^(\s*)[●○◦▪▫■□▸▹►▻‣⦿⦾◉◎★☆✦✧◆◇·∙※\u2022\u2023\u2043\u204C\u204D\u2219\u25AA\u25AB\u25CF\u25CB\u25E6\u2B24]\s*/gm, '$1- ');
  html = html.replace(/\n(\s*)[●○◦▪▫■□▸▹►▻‣⦿⦾◉◎★☆✦✧◆◇·∙※\u2022\u2023\u2043\u204C\u204D\u2219\u25AA\u25AB\u25CF\u25CB\u25E6\u2B24]\s*/g, '\n$1- ');
  
  // Normalize dash bullets at start of lines
  html = html.replace(/(^|\n)(\s*)-\s*(?=\S)/gm, '$1$2- ');
  
  // For bullets/dashes followed by <strong>, ensure proper spacing
  html = html.replace(/•\s*<strong>/g, '• <strong>');
  html = html.replace(/(^|\n)(\s*)-\s*<strong>/gm, '$1$2- <strong>');
  
  // Parse lines to handle nested bullets with SEMANTIC detection
  // Parent bullets end with ":" and subsequent bullets are children until next parent
  const lines = html.split('\n');
  let result: string[] = [];
  
  // Use consistent filled bullet (•) for ALL levels
  const bulletSymbol = '•';
  
  // STEP 1: Pre-scan to identify parent bullets (lines that end with only ":")
  const parentBulletIndices = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)[•\-–—]\s*(.+)$/);
    if (bulletMatch) {
      const text = bulletMatch[2].replace(/^[•\-–—\s]+/, '');
      const plainText = text.replace(/<[^>]*>/g, '').trim();
      // Parent bullet: ends with colon, has few words (is a label), and no content after
      const endsWithColonOnly = /:\s*$/.test(plainText) && 
                                plainText.replace(/:\s*$/, '').split(/\s+/).length <= 3;
      if (endsWithColonOnly || /:<\/strong>\s*$/.test(text)) {
        parentBulletIndices.add(i);
      }
    }
  }
  
  // STEP 2: Process lines with parent-child awareness
  let lastParentIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match any leading whitespace before a bullet/dash
    const bulletMatch = line.match(/^(\s*)[•\-–—]\s*(.+)$/);
    
    if (bulletMatch) {
      const rawPrefix = bulletMatch[1] || '';
      let text = bulletMatch[2].replace(/^[•\-–—\s]+/, '');
      
      const isParentBullet = parentBulletIndices.has(i);
      
      // Determine indent level from whitespace (spaces and tabs)
      let wsIndent = 0;
      for (let j = 0; j < rawPrefix.length; j++) {
        wsIndent += rawPrefix[j] === '\t' ? 4 : 1;
      }
      
      // Calculate level: 2 spaces = 1 level of indentation
      let level = Math.floor(wsIndent / 2);
      
      // Check if this line has explicit indentation
      const hasExplicitIndent = wsIndent > 0;
      
      // SEMANTIC OVERRIDE: If this bullet comes AFTER a parent bullet (with no other parent in between)
      // and this is NOT itself a parent, it should be indented as a child
      if (isParentBullet) {
        lastParentIndex = i;
        level = 0; // Parent bullets are always level 0
      } else if (hasExplicitIndent) {
        // Has explicit indentation (from markers or whitespace) - use calculated level, minimum 1
        level = Math.max(1, level);
      } else if (lastParentIndex >= 0) {
        // After a parent but NO explicit indent - reset parent context, this is new top-level
        lastParentIndex = -1;
        level = 0;
      }
      
      // Cap at level 4
      level = Math.min(level, 4);
      const marginLeft = level * 24; // 24px per indentation level
      
      // Each bullet is its own table for maximum email client compatibility
      result.push(`<table border="0" cellpadding="0" cellspacing="0" style="margin-left: ${marginLeft}px; margin-bottom: 4px;">`);
      result.push(`<tr><td valign="top" style="padding-right: 8px; font-size: 14px; line-height: 1;">${bulletSymbol}</td><td style="font-size: 14px; line-height: 1;">${text}</td></tr>`);
      result.push('</table>');
    } else {
      // Non-bullet line - check if it resets the parent context
      const trimmed = line.trim();
      if (trimmed && !trimmed.match(/^<br\s*\/?>$/)) {
        lastParentIndex = -1;
      }
      result.push(line ? `<p style="margin: 0; font-size: 14px; line-height: 1.5;">${line}</p>` : `<p style="margin: 0; font-size: 14px; line-height: 1.5;">&nbsp;</p>`);
    }
  }
  
  let finalHtml = result.join('');
  
  // Final cleanup: ensure any remaining bullet characters have proper spacing
  finalHtml = finalHtml.replace(/•(?=[A-Za-z<])/g, '• ');
  finalHtml = finalHtml.replace(/-(?=<strong>)/g, '- ');
  
  // Strip any trailing empty nodes so there's no gap before the signature
  return trimEmailBody(finalHtml);
}

/**
 * Strip trailing empty paragraphs, &nbsp; paragraphs, and <br> tags from
 * email body HTML so the signature sits right after the last real line.
 */
function trimEmailBody(html: string): string {
  if (!html) return html;
  let prev = '';
  while (prev !== html) {
    prev = html;
    // Remove trailing <br> / <br/> with optional whitespace
    html = html.replace(/(\s*<br\s*\/?>\s*)+$/gi, '');
    // Remove trailing empty <p> tags (may contain only whitespace, &nbsp;, <br>, or empty spans)
    // The span variant catches ProseMirror's <p><span> </span></p> empty paragraphs
    html = html.replace(/<p[^>]*>(\s|&nbsp;|<br\s*\/?>|<span[^>]*>(?:\s|&nbsp;)*<\/span>)*<\/p>\s*$/gi, '');
    // Remove trailing empty <div> tags
    html = html.replace(/<div[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/div>\s*$/gi, '');
  }
  return html.trimEnd();
}

/**
 * Remove Outlook Web App (OWA) UI artifacts from stored signature HTML before sending.
 *
 * When a sender pastes their signature from Outlook's web interface, the clipboard
 * includes hidden overlay divs and <button> elements that OWA uses for image controls
 * (e.g. "show original size" ↗ buttons).  These are invisible in OWA because of
 * inline `opacity:0; position:absolute` styles, but:
 *   - Gmail and other clients strip `opacity` → buttons render as visible ↗ icons
 *   - Clients that strip `position:absolute` → hidden div enters document flow → blank gap
 *
 * Fix: strip all <button> elements, then drop any content before the first <table>
 * (the OWA junk always precedes the real table-based email signature).
 */
function sanitizeSignatureForSend(html: string): string {
  if (!html) return html;

  // Remove all <button> elements and their content — never valid in email signatures
  let cleaned = html.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '');

  // Drop everything before the first <table> tag.
  // Real Catalyst/Outlook signatures are table-based; the OWA overlay divs always
  // come before that table.
  const tableStart = cleaned.indexOf('<table');
  if (tableStart > 0) {
    cleaned = cleaned.substring(tableStart);
  }

  return cleaned.trim();
}

/**
 * Strip leading empty paragraphs and <br> tags from signature HTML,
 * and zero out any top margin/padding on the outermost element so
 * it sits tight against the single <br/> separator we insert.
 */
function trimSignatureTop(html: string): string {
  if (!html) return html;
  let prev = '';
  while (prev !== html) {
    prev = html;
    html = html.replace(/^(\s*<br\s*\/?>\s*)+/gi, '');
    html = html.replace(/^<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>\s*/gi, '');
    html = html.replace(/^<div[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/div>\s*/gi, '');
  }
  html = html.trimStart();

  // Zero out margin-top and padding-top on the first opening tag so there's
  // no extra whitespace between the body text and the signature block.
  html = html.replace(
    /^(<(?:table|div|p|span|td|tr)\b[^>]*?)(\s*style\s*=\s*["'])([^"']*)["']/i,
    (match, tagStart, styleAttrStart, existingStyles, quote) => {
      // Remove existing margin-top and padding-top, then prepend zeros
      const cleaned = existingStyles
        .replace(/margin-top\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/padding-top\s*:\s*[^;]+;?\s*/gi, '');
      return `${tagStart}${styleAttrStart}margin-top:0;padding-top:0;${cleaned}"`;
    }
  );

  // If the first tag has no style attribute, inject one
  html = html.replace(
    /^(<(?:table|div|p|span|td|tr)\b)(\s)(?![^>]*style\s*=)/i,
    '$1 style="margin-top:0;padding-top:0;" $2'
  );

  return html;
}

/**
 * Wrap the final email HTML in minimal styling — plain personal-email look,
 * no centered newsletter column or heavy padding.
 */
function wrapEmailContent(html: string): string {
  if (!html) return html;
  return (
    '<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #333333;">' +
    html +
    '</div>'
  );
}

let isOutreachJobRunning = false;
let lastOutreachRun: Date | null = null;
let isSchedulerRunning = false; // Track if scheduler is started/stopped
let isDripWorkerRunning = false; // Track drip worker state

/**
 * DAILY DRIP WORKER - Processes due enrollments and sends emails
 * Runs every hour, sends to contacts where next_send_at <= now
 */
export async function processDripEnrollments(): Promise<void> {
  if (isDripWorkerRunning) {
    console.log('⏭️ [DRIP] Worker already running, skipping');
    return;
  }

  // Only send emails between 9 AM and 5 PM Eastern time (handles DST automatically)
  const nowEastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hourEastern = nowEastern.getHours();
  if (hourEastern < 9 || hourEastern >= 17) {
    console.log(`⏰ [DRIP] Outside business hours (${hourEastern}:00 Eastern) - emails only sent 9 AM–5 PM ET`);
    return;
  }
  
  isDripWorkerRunning = true;
  const startTime = new Date();
  
  try {
    console.log('🚀 [DRIP] Starting drip campaign worker...');
    
    // Check if dry run mode is enabled
    const settingsResult = await db.execute(sql`
      SELECT drip_dry_run_mode as "dripDryRunMode" FROM business_settings LIMIT 1
    `);
    const isDryRunMode = ((settingsResult.rows || settingsResult)?.[0] as any)?.dripDryRunMode === true;
    
    if (isDryRunMode) {
      console.log('🧪 [DRIP] *** DRY RUN MODE ENABLED *** - Emails will be logged but NOT sent');
    }
    
    // Per-sender daily send limit: 150 emails per sender per day
    const DAILY_SEND_LIMIT_PER_SENDER = 150;
    // Per-sender hourly send limit: spread evenly across the 8-hour window (9 AM–5 PM)
    // 150 / 8 hours = ~19 per run so emails trickle out rather than blast all at once
    const HOURLY_SEND_LIMIT_PER_SENDER = Math.ceil(DAILY_SEND_LIMIT_PER_SENDER / 8); // 19

    // Auto-retry failed enrollments from previous days (e.g. Microsoft throttle 429s).
    // Enrollments marked 'failed' with updated_at before today's midnight get reset to
    // 'in_progress' so they re-enter the queue on the next run.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Reset failed enrollments from previous days back into the queue
    const retryResult = await db.execute(sql`
      UPDATE drip_campaign_enrollments
      SET status = 'in_progress', paused_reason = NULL, updated_at = NOW()
      WHERE status = 'failed'
        AND updated_at < ${todayStart.toISOString()}
    `);
    const retryCount = (retryResult as any).rowCount ?? (retryResult as any).count ?? 0;
    if (retryCount > 0) {
      console.log(`🔄 [DRIP] Reset ${retryCount} failed enrollments from previous days back to in_progress for retry`);
    }

    const senderSentTodayResult = await db.execute(sql`
      SELECT sender_id, COUNT(*) AS sent_count
      FROM drip_campaign_enrollments
      WHERE last_sent_at >= ${todayStart.toISOString()}
      GROUP BY sender_id
    `);
    const senderSentToday: Record<string, number> = {};
    for (const row of (senderSentTodayResult.rows || senderSentTodayResult) as any[]) {
      senderSentToday[row.sender_id] = parseInt(row.sent_count || '0');
    }

    // Today's sent counts per sender PER STATE (for geo-split limiting)
    const senderStateSentTodayResult = await db.execute(sql`
      SELECT sender_id, COALESCE(target_state, '__none__') as target_state, COUNT(*) AS sent_count
      FROM drip_campaign_enrollments
      WHERE last_sent_at >= ${todayStart.toISOString()}
      GROUP BY sender_id, target_state
    `);
    // senderStateSentToday[senderId][state] = count
    const senderStateSentToday: Record<string, Record<string, number>> = {};
    for (const row of (senderStateSentTodayResult.rows || senderStateSentTodayResult) as any[]) {
      if (!senderStateSentToday[row.sender_id]) senderStateSentToday[row.sender_id] = {};
      senderStateSentToday[row.sender_id][row.target_state] = parseInt(row.sent_count || '0');
    }

    // Count how many distinct active geo-states each sender has pending/in_progress
    // NULL target_state counts as "Unknown" — one of the equal segments
    const senderActiveStatesResult = await db.execute(sql`
      SELECT sender_id, COUNT(DISTINCT COALESCE(target_state, '__none__')) AS state_count
      FROM drip_campaign_enrollments
      WHERE status IN ('pending', 'in_progress')
      GROUP BY sender_id
    `);
    const senderActiveStateCount: Record<string, number> = {};
    for (const row of (senderActiveStatesResult.rows || senderActiveStatesResult) as any[]) {
      senderActiveStateCount[row.sender_id] = parseInt(row.state_count || '1');
    }

    // Get due enrollments using round-robin interleaving across senders.
    // Without this, if one sender has many older-timestamped enrollments they fill
    // the entire batch and starve other senders (e.g. AJ's 1,638 block Jack's 885).
    // ROW_NUMBER() OVER (PARTITION BY sender_id) ranks each sender's rows 1,2,3...
    // ordering by rn first means: AJ#1, Jack#1, AJ#2, Jack#2, ... — perfectly fair.
    const dueEnrollmentsResult = await db.execute(sql`
      WITH due AS (
        SELECT 
          e.id, e.contact_email, e.contact_first_name, e.contact_last_name,
          e.hubspot_contact_id, e.template_id, e.sender_id,
          e.current_step_index, e.total_steps_sent,
          e.next_send_at,
          e.target_state,
          t.name as template_name,
          s.name as sender_name, s.email as sender_email,
          s.microsoft_access_token, s.microsoft_refresh_token, s.microsoft_token_expiry,
          s.signature_html, s.daily_limit_override,
          ROW_NUMBER() OVER (PARTITION BY e.sender_id ORDER BY e.next_send_at ASC) AS rn
        FROM drip_campaign_enrollments e
        JOIN outreach_campaign_templates t ON e.template_id = t.id
        JOIN outreach_senders s ON e.sender_id = s.id
        WHERE e.next_send_at <= NOW()
          AND e.status IN ('pending', 'in_progress')
          AND t.is_active = true
          AND s.is_active = true
          AND NOT EXISTS (
            SELECT 1
            FROM outreach_campaigns c
            WHERE c.broker_filter->>'templateId' = e.template_id
              AND c.status <> 'active'
          )
      )
      SELECT * FROM due
      ORDER BY rn ASC, next_send_at ASC
      LIMIT 1000
    `);
    const dueEnrollments = (dueEnrollmentsResult.rows || dueEnrollmentsResult) as any[];
    
    if (dueEnrollments.length === 0) {
      console.log('✅ [DRIP] No enrollments due at this time');
      return;
    }
    
    // DEBUG: log sent-today counts and active-state counts per sender so we can diagnose cap issues
    console.log(`📧 [DRIP] Processing ${dueEnrollments.length} due enrollments...`);
    console.log(`🔍 [DRIP-DEBUG] senderSentToday:`, JSON.stringify(senderSentToday));
    console.log(`🔍 [DRIP-DEBUG] senderActiveStateCount:`, JSON.stringify(senderActiveStateCount));
    console.log(`🔍 [DRIP-DEBUG] DAILY_SEND_LIMIT_PER_SENDER:`, DAILY_SEND_LIMIT_PER_SENDER);
    
    let sent = 0;
    let failed = 0;
    let completed = 0;
    let skipped = 0;
    
    let skippedDailyLimit = 0;
    let skippedHourlyLimit = 0;

    // Track how many emails sent PER SENDER in this single worker run (hourly cap)
    const senderSentThisRun: Record<string, number> = {};
    // Track per-sender-per-state this run
    const senderStateSentThisRun: Record<string, Record<string, number>> = {};

    for (const enrollment of dueEnrollments) {
      try {
        // Per-sender daily limit: use daily_limit_override from DB, fall back to global default
        const senderDailyLimit = parseInt(enrollment.daily_limit_override || '0') || DAILY_SEND_LIMIT_PER_SENDER;

        // Geo-split: divide the sender's daily limit evenly across ALL active geo segments,
        // including "Unknown" (null target_state). Every segment gets an equal share.
        // Guard with Math.max(1, ...) so limit never rounds to zero (which would block all sends).
        const geoState = enrollment.target_state || '__none__';
        const numActiveStates = senderActiveStateCount[enrollment.sender_id] || 1;
        const effectiveDailyLimit = Math.max(1, Math.floor(senderDailyLimit / numActiveStates));
        const senderHourlyLimit = Math.max(1, Math.ceil(effectiveDailyLimit / 8));

        // Overall sender daily limit (total cap across all states)
        const senderSentCount = senderSentToday[enrollment.sender_id] || 0;
        if (senderSentCount >= senderDailyLimit) {
          skippedDailyLimit++;
          continue;
        }

        // Per-sender hourly limit: cap this run so emails spread across the day
        const sentThisRun = senderSentThisRun[enrollment.sender_id] || 0;
        if (sentThisRun >= senderHourlyLimit) {
          skippedHourlyLimit++;
          continue;
        }

        // Get the current step for this enrollment
        const stepResult = await db.execute(sql`
          SELECT id, day_number, subject, content, channel, attachments
          FROM outreach_campaign_template_steps
          WHERE template_id = ${enrollment.template_id}
            AND sequence_index = ${enrollment.current_step_index}
            AND is_active = true
          LIMIT 1
        `);
        const currentStep = (stepResult.rows || stepResult)?.[0] as any;
        
        if (!currentStep) {
          // No more steps - mark as completed
          await db.execute(sql`
            UPDATE drip_campaign_enrollments
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = ${enrollment.id}
          `);
          completed++;
          console.log(`   ✅ [${enrollment.sender_name}] ${enrollment.contact_email}: Campaign completed (no more steps)`);
          continue;
        }
        
        // Skip non-email steps for now (SMS can be added later)
        if (currentStep.channel !== 'email') {
          // Move to next step
          await advanceToNextStep(enrollment);
          continue;
        }
        
        // Prepare email content with personalization
        const brokerFirstName = enrollment.contact_first_name || 'there';
        const brokerName = `${enrollment.contact_first_name || ''} ${enrollment.contact_last_name || ''}`.trim() || 'there';
        
        let emailContent = currentStep.content || '';
        let emailSubject = currentStep.subject || 'Hello from Catalyst Capital Partners';
        
        // Replace personalization tokens
        emailContent = emailContent
          .replace(/\{\{broker\.firstname\}\}/gi, brokerFirstName)
          .replace(/\{\{broker\.firstName\}\}/gi, brokerFirstName)
          .replace(/\{\{firstname\}\}/gi, brokerFirstName)
          .replace(/\{\{broker\.lastname\}\}/gi, enrollment.contact_last_name || '')
          .replace(/\{\{broker\.email\}\}/gi, enrollment.contact_email)
          .replace(/\{\{brokerName\}\}/gi, brokerName)
          .replace(/\{\{brokerFirstName\}\}/gi, brokerFirstName)
          .replace(/\{\{sender\.name\}\}/gi, enrollment.sender_name || '')
          .replace(/\{\{sender\.email\}\}/gi, enrollment.sender_email);
        
        emailSubject = emailSubject
          .replace(/\{\{broker\.firstname\}\}/gi, brokerFirstName)
          .replace(/\{\{brokerName\}\}/gi, brokerName);
        
        // Convert to HTML
        let emailHtml = convertContentToHtml(emailContent);
        
        // Always trim trailing whitespace from the body first
        emailHtml = trimEmailBody(emailHtml);

        // Always append <br/><br/> so senders without a stored signature get the same
        // clean gap before Exchange auto-appended signatures as those with a stored one.
        // Without this, a trailing block-level <p> margin creates a much larger gap.
        if (enrollment.signature_html) {
          const sanitizedSig = sanitizeSignatureForSend(enrollment.signature_html);
          const cleanSig = trimSignatureTop(sanitizedSig);
          emailHtml += `<br/><br/><div style="margin:0;padding:0;line-height:1;">${cleanSig}</div>`;
        } else {
          // No DB signature — add nothing; Exchange appends its native card with its own spacing.
          // Any trailing <br/> we add stacks on top and widens the gap.
        }
        
        // Wrap in padded email container so content doesn't run edge-to-edge
        emailHtml = wrapEmailContent(emailHtml);
        
        // DRY RUN MODE: Log but don't actually send
        if (isDryRunMode) {
          console.log(`   🧪 [DRY RUN] Would send to: ${enrollment.contact_email}`);
          console.log(`   🧪 [DRY RUN]   Subject: ${emailSubject}`);
          console.log(`   🧪 [DRY RUN]   Day: ${currentStep.day_number}, Step: ${enrollment.current_step_index}`);
          console.log(`   🧪 [DRY RUN]   From: ${enrollment.sender_name} <${enrollment.sender_email}>`);
          
          // In dry-run mode, skip database insert entirely - just log to console
          // This prevents polluting the outreach_messages table during testing
          console.log(`   🧪 [DRY RUN] ✅ Simulated send complete (no DB record created)`);
          
          // Advance to next step (so we can test full flow)
          await advanceToNextStep(enrollment, currentStep.id);
          sent++;
          continue;
        }
        
        // LIVE MODE: Microsoft Graph only — no SendGrid fallback
        let emailSent = false;
        let skipEmail = false;

        // HARD DB CAP: Re-query actual DB count right before sending.
        // This prevents over-sending if the server restarted mid-day (which resets
        // the in-memory senderSentToday counter back to 0, allowing a full new batch).
        const hardCapResult = await db.execute(sql`
          SELECT COUNT(*) AS cnt
          FROM drip_campaign_enrollments
          WHERE sender_id = ${enrollment.sender_id}
            AND last_sent_at >= ${todayStart.toISOString()}
        `);
        const hardCapCount = parseInt((hardCapResult.rows || hardCapResult as any[])?.[0]?.cnt || '0');
        if (hardCapCount >= senderDailyLimit) {
          skippedDailyLimit++;
          // Also update in-memory counter so remaining iterations skip fast without more DB hits
          senderSentToday[enrollment.sender_id] = hardCapCount;
          continue;
        }

        if (!enrollment.microsoft_access_token) {
          // Sender has not connected Outlook — skip silently, leave queued for retry
          console.log(`   ⏭️ [DRIP] [${enrollment.sender_name}] Skipping ${enrollment.contact_email} — no Microsoft token connected`);
          skipEmail = true;
          skipped++;
        } else {
          // Send via Microsoft Graph
          try {
            // Fetch attachments from object storage if the step has any
            const graphAttachments: Array<{ filename: string; contentType: string; contentBytes: string }> = [];
            if (currentStep.attachments) {
              try {
                const attachmentList = typeof currentStep.attachments === 'string'
                  ? JSON.parse(currentStep.attachments)
                  : currentStep.attachments;
                if (Array.isArray(attachmentList) && attachmentList.length > 0) {
                  const { ObjectStorageService } = await import('../objectStorage');
                  const objectStorage = new ObjectStorageService();
                  for (const att of attachmentList) {
                    try {
                      const fileBuffer = await objectStorage.getFileAsBuffer(att.url);
                      graphAttachments.push({
                        filename: att.filename,
                        contentType: att.contentType || 'application/octet-stream',
                        contentBytes: fileBuffer.toString('base64'),
                      });
                    } catch (attErr: any) {
                      console.error(`   ⚠️ [DRIP] Could not load attachment ${att.filename}: ${attErr.message}`);
                    }
                  }
                }
              } catch (parseErr) {
                console.error(`   ⚠️ [DRIP] Failed to parse attachments for step:`, parseErr);
              }
            }

            const { sendDripEmailViaMicrosoft } = await import('../microsoftAuth');
            const msPayload = {
              subject: emailSubject,
              htmlBody: emailHtml,
              ...(graphAttachments.length > 0 && { attachments: graphAttachments }),
            };
            // Attempt send with exponential backoff on 429 throttle (Microsoft IncomingBytes limit)
            const MAX_429_RETRIES = 4;
            const BACKOFF_SCHEDULE_MS = [3000, 8000, 20000, 45000];
            let attempt = 0;
            while (true) {
              try {
                await sendDripEmailViaMicrosoft(enrollment, msPayload);
                break;
              } catch (sendErr: any) {
                const is429 = sendErr.message?.includes('429') || sendErr.message?.includes('ApplicationThrottled') || sendErr.message?.includes('IncomingBytes');
                if (!is429 || attempt >= MAX_429_RETRIES) {
                  throw sendErr;
                }
                const waitMs = BACKOFF_SCHEDULE_MS[attempt];
                console.warn(`   ⚠️ [DRIP] [${enrollment.sender_name}] 429 throttle (attempt ${attempt + 1}/${MAX_429_RETRIES}) — waiting ${waitMs / 1000}s then retrying ${enrollment.contact_email}`);
                await new Promise(r => setTimeout(r, waitMs));
                attempt++;
              }
            }
            emailSent = true;
            // Pace sends: 2s delay between each Microsoft Graph call to avoid IncomingBytes throttle
            await new Promise(r => setTimeout(r, 2000));
          } catch (msError: any) {
            const { isMailboxBounceError } = await import('../microsoftAuth');
            if (isMailboxBounceError(msError.message || '')) {
              await db.execute(sql`
                UPDATE drip_campaign_enrollments
                SET status = 'cancelled',
                    paused_reason = 'Hard bounce — mailbox does not exist',
                    updated_at = NOW()
                WHERE id = ${enrollment.id} AND sender_id = ${enrollment.sender_id}
              `);
              console.warn(`   ⚠️ [DRIP] Cancelled bounced enrollment ${enrollment.id} for sender ${enrollment.sender_id}`);
              continue;
            }
            if (isMailboxBounceError(msError.message || '')) {
              // Hard bounce — this address no longer exists. Delete the broker entirely.
              console.warn(`   🗑️ [DRIP] Hard bounce detected for ${enrollment.contact_email} — permanently deleting from system. Error: ${msError.message}`);
              try {
                const brokerLookup = await db.execute(sql`SELECT id, first_name, last_name FROM brokers WHERE email = ${enrollment.contact_email} LIMIT 1`);
                const brokerRow = (brokerLookup.rows as any[])[0];
                if (brokerRow) {
                  const bId = brokerRow.id;
                  await db.transaction(async (tx) => {
                    await tx.execute(sql`UPDATE brokers SET referred_by = NULL WHERE referred_by = ${bId}`);
                    await tx.execute(sql`UPDATE deals SET broker_id = NULL WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM commission_splits WHERE broker_id = ${bId} OR primary_broker_id = ${bId} OR referrer_broker_id = ${bId}`);
                    await tx.execute(sql`UPDATE broker_points SET referral_id = NULL WHERE referral_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM referral_activities WHERE referrer_broker_id = ${bId} OR referred_broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM referral_metrics WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM referral_links WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM broker_partnerships WHERE broker_a_id = ${bId} OR broker_b_id = ${bId} OR broker_id = ${bId} OR partner_broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM preferred_partners WHERE broker_id = ${bId} OR partner_broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM partnership_invitations WHERE inviter_broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM broker_achievements WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM broker_points WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM broker_rewards WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM commission_earnings WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM platform_shares WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM deal_tags WHERE tagger_broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM viral_signups WHERE tagger_broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM valuations WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM valuation_shares WHERE shared_by_broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM outreach_sender_assignments WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM drip_campaign_enrollments WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM outreach_messages WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM communications WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM projects WHERE broker_id = ${bId}`);
                    await tx.execute(sql`DELETE FROM brokers WHERE id = ${bId}`);
                  });
                  console.log(`   ✅ [DRIP] Bounced broker deleted: ${enrollment.contact_email} (${brokerRow.first_name || ''} ${brokerRow.last_name || ''}) id=${bId}`);
                } else {
                  // No broker record — just cancel all enrollments for this email
                  await db.execute(sql`
                    UPDATE drip_campaign_enrollments
                    SET status = 'cancelled', paused_reason = 'Hard bounce — mailbox does not exist', updated_at = NOW()
                    WHERE contact_email = ${enrollment.contact_email}
                  `);
                  console.log(`   ⚠️ [DRIP] Hard bounce for ${enrollment.contact_email} — no broker record found, enrollment cancelled`);
                }
              } catch (deleteErr: any) {
                console.error(`   ❌ [DRIP] Failed to delete bounced contact ${enrollment.contact_email}:`, deleteErr.message);
              }
              continue; // Skip the normal emailSent/failed accounting — this contact is gone
            }
            console.error(`   ❌ [DRIP] [${enrollment.sender_name}] Microsoft send failed for ${enrollment.contact_email}: ${msError.message}`);
          }
        }
        
        if (skipEmail) {
          // Leave enrollment untouched — it stays queued and will be retried next run
          continue;
        }
        
        if (emailSent) {
          // Update enrollment - advance to next step
          await advanceToNextStep(enrollment, currentStep.id);
          sent++;
          // Track in-memory so both daily and hourly limits apply correctly within this run
          senderSentToday[enrollment.sender_id] = (senderSentToday[enrollment.sender_id] || 0) + 1;
          senderSentThisRun[enrollment.sender_id] = (senderSentThisRun[enrollment.sender_id] || 0) + 1;
          // Track per-state counters
          const gs = enrollment.target_state || '__none__';
          if (!senderStateSentToday[enrollment.sender_id]) senderStateSentToday[enrollment.sender_id] = {};
          senderStateSentToday[enrollment.sender_id][gs] = (senderStateSentToday[enrollment.sender_id][gs] || 0) + 1;
          if (!senderStateSentThisRun[enrollment.sender_id]) senderStateSentThisRun[enrollment.sender_id] = {};
          senderStateSentThisRun[enrollment.sender_id][gs] = (senderStateSentThisRun[enrollment.sender_id][gs] || 0) + 1;
          const stateLabel = enrollment.target_state ? `[${enrollment.target_state}]` : '';
          const numStates = senderActiveStateCount[enrollment.sender_id] || 1;
          const effLimit = enrollment.target_state ? Math.floor((parseInt(enrollment.daily_limit_override || '0') || DAILY_SEND_LIMIT_PER_SENDER) / numStates) : DAILY_SEND_LIMIT_PER_SENDER;
          console.log(`   📧 [${enrollment.sender_name}]${stateLabel ? ' ' + stateLabel : ''} ${enrollment.contact_email}: Day ${currentStep.day_number} sent via Microsoft Graph (state: ${senderStateSentToday[enrollment.sender_id][gs]}/${effLimit}, day total: ${senderSentToday[enrollment.sender_id]}/${DAILY_SEND_LIMIT_PER_SENDER})`);
        } else {
          // Mark as failed — the auto-retry sweep (see todayStart logic above) will
          // reset 'failed' enrollments back to 'in_progress' on the next day's run
          // so persistent throttling doesn't permanently drop a contact.
          await db.execute(sql`
            UPDATE drip_campaign_enrollments
            SET status = 'failed', paused_reason = 'Email send failed after retries', updated_at = NOW()
            WHERE id = ${enrollment.id}
          `);
          failed++;
        }
        
      } catch (enrollmentError: any) {
        console.error(`   ❌ Error processing enrollment ${enrollment.id}:`, enrollmentError.message);
        failed++;
      }
    }
    
    const duration = (Date.now() - startTime.getTime()) / 1000;
    console.log(`✅ [DRIP] Worker complete: ${sent} sent, ${completed} completed, ${failed} failed, ${skipped} skipped (no Outlook token), ${skippedHourlyLimit} held (hourly cap ~${HOURLY_SEND_LIMIT_PER_SENDER}/sender), ${skippedDailyLimit} held (daily cap ${DAILY_SEND_LIMIT_PER_SENDER}/sender) (${duration.toFixed(1)}s)`);
    
  } catch (error: any) {
    console.error('❌ [DRIP] Worker error:', error.message);
  } finally {
    isDripWorkerRunning = false;
  }
}

/**
 * Advance enrollment to the next step
 */
async function advanceToNextStep(enrollment: any, lastStepId?: string): Promise<void> {
  const nextStepIndex = enrollment.current_step_index + 1;
  
  // Get next step to calculate next_send_at
  const nextStepResult = await db.execute(sql`
    SELECT day_number FROM outreach_campaign_template_steps
    WHERE template_id = ${enrollment.template_id}
      AND sequence_index = ${nextStepIndex}
      AND is_active = true
    LIMIT 1
  `);
  const nextStep = (nextStepResult.rows || nextStepResult)?.[0] as any;
  
  if (nextStep) {
    // Calculate days until next step
    const currentStepResult = await db.execute(sql`
      SELECT day_number FROM outreach_campaign_template_steps
      WHERE template_id = ${enrollment.template_id}
        AND sequence_index = ${enrollment.current_step_index}
      LIMIT 1
    `);
    const currentStepDay = ((currentStepResult.rows || currentStepResult)?.[0] as any)?.day_number || 1;
    const daysUntilNext = nextStep.day_number - currentStepDay;
    
    const nextSendAt = new Date();
    nextSendAt.setDate(nextSendAt.getDate() + daysUntilNext);
    nextSendAt.setHours(10, 0, 0, 0); // Send at 10 AM
    
    await db.execute(sql`
      UPDATE drip_campaign_enrollments
      SET current_step_index = ${nextStepIndex},
          total_steps_sent = total_steps_sent + 1,
          last_sent_at = NOW(),
          last_sent_step_id = ${lastStepId || null},
          next_send_at = ${nextSendAt.toISOString()},
          status = 'in_progress',
          updated_at = NOW()
      WHERE id = ${enrollment.id}
    `);
  } else {
    // No more steps - mark completed
    await db.execute(sql`
      UPDATE drip_campaign_enrollments
      SET total_steps_sent = total_steps_sent + 1,
          last_sent_at = NOW(),
          last_sent_step_id = ${lastStepId || null},
          status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${enrollment.id}
    `);
  }
}

/**
 * Helper: Check if today is the Nth occurrence of a weekday in the month
 * @param date The date to check
 * @param weekday Day of week (0=Sunday, 1=Monday, etc.)
 * @param occurrence Which occurrence (1=first, 2=second, 3=third, etc.)
 */
function isNthWeekdayOfMonth(date: Date, weekday: number, occurrence: number): boolean {
  if (date.getDay() !== weekday) return false;
  
  // Calculate which occurrence of this weekday this is
  const dayOfMonth = date.getDate();
  const weekdayOccurrence = Math.ceil(dayOfMonth / 7);
  
  return weekdayOccurrence === occurrence;
}

/**
 * Monthly job to check for and execute due outreach campaigns
 * Filters campaigns by type based on schedule:
 * - First Monday: Email campaigns only
 * - Third Monday: SMS campaigns only
 */
async function runOutreachJob(campaignType: 'email' | 'sms'): Promise<void> {
  // Prevent overlapping executions
  if (isOutreachJobRunning) {
    console.log('⏭️ Outreach job already running, skipping this execution');
    return;
  }

  isOutreachJobRunning = true;
  const startTime = new Date();
  
  try {
    console.log(`🚀 Starting ${campaignType.toUpperCase()} outreach job check...`);
    
    // Get all due campaigns
    const allDueCampaigns = await outreachService.getDueCampaigns();
    
    // Filter by campaign type (email vs SMS)
    const dueCampaigns = allDueCampaigns.filter(campaign => {
      const isSMS = campaign.smsTemplateKey && campaign.smsTemplateKey.trim().length > 0;
      const isEmail = campaign.emailTemplateKey && campaign.emailTemplateKey.trim().length > 0;
      
      if (campaignType === 'email') {
        return isEmail && !isSMS; // Email-only campaigns
      } else {
        return isSMS; // SMS campaigns (may also have email)
      }
    });
    
    if (dueCampaigns.length === 0) {
      console.log(`✅ No ${campaignType.toUpperCase()} campaigns due at this time`);
      return;
    }
    
    console.log(`📅 Found ${dueCampaigns.length} due ${campaignType.toUpperCase()} campaigns, executing...`);
    
    // Execute each due campaign
    const results = [];
    for (const campaign of dueCampaigns) {
      try {
        console.log(`🎯 Executing campaign: ${campaign.name}`);
        
        const result = await outreachService.executeOutreachRun(campaign, {
          // Production execution settings
          dryRun: false,
          rateLimitPerMinute: campaign.rateLimitPerMinute || 10
        });
        
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: true,
          result
        });
        
        console.log(`✅ Campaign "${campaign.name}" completed: ${result.sentEmailCount} emails, ${result.sentSMSCount} SMS, ${result.failuresCount} failures`);
        
      } catch (error: any) {
        console.error(`❌ Error executing campaign "${campaign.name}":`, error);
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: false,
          error: error?.message || 'Unknown error'
        });
      }
    }
    
    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalEmails = results.reduce((sum, r) => sum + (r.result?.sentEmailCount || 0), 0);
    const totalSMS = results.reduce((sum, r) => sum + (r.result?.sentSMSCount || 0), 0);
    const totalFailures = results.reduce((sum, r) => sum + (r.result?.failuresCount || 0), 0);
    
    console.log(`📊 Outreach job summary: ${successful} campaigns completed, ${failed} failed`);
    console.log(`📤 Total messages sent: ${totalEmails} emails, ${totalSMS} SMS, ${totalFailures} failures`);
    
    lastOutreachRun = new Date();
    
  } catch (error) {
    console.error('❌ Critical error in outreach job:', error);
  } finally {
    isOutreachJobRunning = false;
    const duration = new Date().getTime() - startTime.getTime();
    console.log(`⏱️ Outreach job completed in ${duration}ms`);
  }
}

/**
 * Start the recurring outreach scheduler
 */
export function startOutreachScheduler(): void {
  console.log('📅 Starting recurring outreach scheduler...');
  
  // Run every Monday at 10 AM EST - check if it's 1st or 3rd Monday
  cron.schedule('0 10 * * 1', async () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // First Monday = Email campaigns
    if (isNthWeekdayOfMonth(now, 1, 1)) {
      console.log('📧 First Monday of the month - Running EMAIL campaigns');
      await runOutreachJob('email');
    }
    // Third Monday = SMS campaigns
    else if (isNthWeekdayOfMonth(now, 1, 3)) {
      console.log('📱 Third Monday of the month - Running SMS campaigns');
      await runOutreachJob('sms');
    }
    // Other Mondays - skip
    else {
      console.log('⏭️ Not 1st or 3rd Monday - skipping outreach');
    }
  }, {
    timezone: 'America/New_York' // EST/EDT timezone
  });
  
  isSchedulerRunning = true; // Mark scheduler as running
  console.log('✅ Recurring outreach scheduler started:');
  console.log('   📧 Email campaigns: First Monday at 10 AM EST');
  console.log('   📱 SMS campaigns: Third Monday at 10 AM EST');
}

/**
 * Stop the recurring outreach scheduler
 */
export function stopOutreachScheduler(): void {
  console.log('⏹️ Stopping recurring outreach scheduler...');
  cron.getTasks().forEach(task => {
    if (task.toString().includes('outreach')) {
      task.stop();
    }
  });
  isSchedulerRunning = false; // Mark scheduler as stopped
  console.log('✅ Recurring outreach scheduler stopped');
}

/**
 * Manual trigger for testing and immediate execution
 */
export async function triggerOutreachJobManually(campaignType: 'email' | 'sms' = 'email'): Promise<void> {
  console.log(`🔧 Manually triggering ${campaignType.toUpperCase()} outreach job...`);
  await runOutreachJob(campaignType);
}

/**
 * Get scheduler status and last run info
 */
export function getOutreachSchedulerStatus(): {
  isRunning: boolean;
  isJobCurrentlyExecuting: boolean;
  lastRun: Date | null;
  nextRun: string;
  nextEmailRun: string;
  nextSMSRun: string;
} {
  // Helper to find next Nth weekday - returns Date in UTC that corresponds to 10 AM EST
  function getNextNthWeekday(weekday: number, occurrence: number): Date {
    const now = new Date();
    
    // Get current time in EST for comparison
    const nowESTString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nowEST = new Date(nowESTString);
    
    // Start from first of current month (in EST)
    let checkYear = nowEST.getFullYear();
    let checkMonth = nowEST.getMonth();
    
    // Find the Nth weekday of the month
    function findNthWeekday(year: number, month: number, weekday: number, n: number): Date {
      // Start from first of the month
      let date = new Date(year, month, 1);
      
      // Find the first occurrence of the weekday
      while (date.getDay() !== weekday) {
        date.setDate(date.getDate() + 1);
      }
      
      // Move to the Nth occurrence
      date.setDate(date.getDate() + (n - 1) * 7);
      
      // Set to 10 AM EST = 15:00 UTC (EST is UTC-5)
      // But in winter (EST) it's UTC-5, in summer (EDT) it's UTC-4
      // For simplicity, we'll set the time in local terms then adjust
      date.setHours(15, 0, 0, 0); // 10 AM EST = 3 PM UTC
      
      return date;
    }
    
    let checkDate = findNthWeekday(checkYear, checkMonth, weekday, occurrence);
    
    // If this date is in the past, move to next month
    if (checkDate <= now) {
      checkMonth++;
      if (checkMonth > 11) {
        checkMonth = 0;
        checkYear++;
      }
      checkDate = findNthWeekday(checkYear, checkMonth, weekday, occurrence);
    }
    
    return checkDate;
  }
  
  const nextEmailDate = getNextNthWeekday(1, 1); // First Monday
  const nextSMSDate = getNextNthWeekday(1, 3);   // Third Monday
  
  // nextRun is the soonest of the two for backward compatibility
  const nextRunDate = nextEmailDate < nextSMSDate ? nextEmailDate : nextSMSDate;
  
  return {
    isRunning: isSchedulerRunning,
    isJobCurrentlyExecuting: isOutreachJobRunning,
    lastRun: lastOutreachRun,
    nextRun: nextRunDate.toISOString(),           // Soonest of email/SMS
    nextEmailRun: nextEmailDate.toISOString(),    // First Monday at 10 AM EST
    nextSMSRun: nextSMSDate.toISOString()         // Third Monday at 10 AM EST
  };
}

/**
 * Health check for outreach scheduler
 */
export function checkOutreachSchedulerHealth(): {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details: any;
} {
  try {
    const status = getOutreachSchedulerStatus();
    
    if (!status.isRunning) {
      return {
        status: 'error',
        message: 'Outreach scheduler is not running',
        details: status
      };
    }
    
    // Check if last run was within reasonable time (should run monthly on 1st/3rd Monday)
    if (status.lastRun && Date.now() - status.lastRun.getTime() > 45 * 24 * 60 * 60 * 1000) {
      return {
        status: 'warning',
        message: 'Outreach scheduler has not run recently (>45 days ago)',
        details: status
      };
    }
    
    // Check if job has been stuck running too long
    if (status.isJobCurrentlyExecuting && status.lastRun && 
        Date.now() - status.lastRun.getTime() > 30 * 60 * 1000) {
      return {
        status: 'warning',
        message: 'Outreach job appears to be stuck (running >30 minutes)',
        details: status
      };
    }
    
    return {
      status: 'healthy',
      message: 'Outreach scheduler is running normally',
      details: status
    };
    
  } catch (error: any) {
    return {
      status: 'error',
      message: `Error checking outreach scheduler: ${error?.message || 'Unknown error'}`,
      details: { error: error?.message || 'Unknown error' }
    };
  }
}

// Scheduler is started from server/index.ts during server initialization
// No auto-start needed here to prevent duplicate initialization

let crmPollTask: cron.ScheduledTask | null = null;

// Legacy immediate-send code removed - all email sending now via daily drip worker
// ─── CRM-NATIVE POLL ────────────────────────────────────────────────────────
// Replaces the HubSpot poll for contacts already in our CRM.
// Runs every 10 minutes; finds CRM contacts tagged with campaign trigger tags
// and enrolls them in the drip queue (same staggering logic as HubSpot poll).

let isCrmPollRunning = false;
let lastCrmPoll: Date | null = null;

export async function processCrmTaggedContacts(): Promise<{
  enrolled: number; skipped: number; alreadyEnrolled: number;
}> {
  if (isCrmPollRunning) {
    console.log('⏭️ [CRM-POLL] Already running, skipping');
    return { enrolled: 0, skipped: 0, alreadyEnrolled: 0 };
  }
  isCrmPollRunning = true;
  let totalEnrolled = 0, totalSkipped = 0, totalAlready = 0;
  // Track no-sender skips per template so we log one summary line, not one per contact
  const noSenderSkips: Record<string, number> = {};

  // Helper: enroll a single broker into a template
  async function enrollContact(
    broker: any,
    templateId: string,
    senderId: string | null,
    initialStepIndex = 1,
  ) {
    if (!broker.email || broker.email.includes('@temp.landlinq.ai')) {
      totalSkipped++;
      return;
    }
    if (!senderId) {
      noSenderSkips[templateId] = (noSenderSkips[templateId] || 0) + 1;
      totalSkipped++;
      return;
    }
    try {
      // Check by broker_id OR email — exclude only truly cancelled ones so we never re-enroll completed sequences
      const existing = await db.execute(sql`
        SELECT id FROM drip_campaign_enrollments
        WHERE template_id = ${templateId} AND status != 'cancelled'
          AND (broker_id = ${broker.id} OR contact_email = ${broker.email})
        LIMIT 1
      `);
      if ((existing.rows || []).length > 0) { totalAlready++; return; }

      const nextSendAt = new Date();
      nextSendAt.setHours(10, 0, 0, 0);
      await db.execute(sql`
        INSERT INTO drip_campaign_enrollments (
          broker_id, contact_email, contact_first_name, contact_last_name, contact_phone,
          template_id, sender_id, current_step_index, next_send_at, status, enrolled_at
        ) VALUES (
          ${broker.id}, ${broker.email}, ${broker.first_name || null}, ${broker.last_name || null}, ${broker.phone || null},
          ${templateId}, ${senderId}, ${initialStepIndex}, ${nextSendAt.toISOString()}, 'pending', NOW()
        )
      `);
      totalEnrolled++;
    } catch (err: any) {
      console.error(`   ❌ [CRM-POLL] Failed to enroll ${broker.email}: ${err.message}`);
      totalSkipped++;
    }
  }

  try {
    console.log('🔍 [CRM-POLL] Starting CRM-native enrollment sync...');

    // ── PASS 1A: Catalyst tag matching ────────────────────────────────────────
    // Developer templates are linked to developer-owned outreach campaigns and
    // are handled separately below. Catalyst matching is limited to shared
    // contacts so an internal tag can never enroll a developer-owned contact.
    const templatesResult = await db.execute(sql`
      SELECT ct.id, ct.name, ct.hubspot_trigger_tag,
        (SELECT s.id FROM outreach_senders s
         WHERE s.is_active = true
           AND s.developer_profile_id IS NULL
           AND ct.hubspot_trigger_tag = ANY(s.hubspot_trigger_tags)
         ORDER BY s.created_at ASC LIMIT 1) AS sender_id
      FROM outreach_campaign_templates ct
      WHERE ct.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM outreach_campaigns c
          WHERE c.developer_profile_id IS NOT NULL
            AND c.broker_filter->>'templateId' = ct.id
        )
    `);
    const templates = (templatesResult.rows || []) as any[];

    for (const template of templates) {
      const taggedResult = await db.execute(sql`
        SELECT b.id, b.email, b.first_name, b.last_name, b.phone
        FROM brokers b
        WHERE ${template.hubspot_trigger_tag} = ANY(b.crm_tags)
          AND b.is_active = true
          AND b.owner_developer_profile_id IS NULL
      `);
      const tagged = (taggedResult.rows || []) as any[];
      if (!tagged.length) continue;
      console.log(`   🏷️  [PASS 1] Campaign "${template.name}": ${tagged.length} tagged contacts`);
      for (const broker of tagged) await enrollContact(broker, template.id, template.sender_id);
    }

    // ── PASS 1B: Investment Company tag matching ─────────────────────────────
    // Every side of this join is tied to the same developer profile:
    // campaign, template, sender, and broker. This prevents cross-company and
    // Catalyst/developer tag leakage even when contacts carry identical tags.
    const developerTemplatesResult = await db.execute(sql`
      SELECT ct.id, ct.name, ct.hubspot_trigger_tag,
        c.developer_profile_id, s.id AS sender_id
      FROM outreach_campaigns c
      INNER JOIN outreach_campaign_templates ct
        ON ct.id = (c.broker_filter->>'templateId')
        AND ct.team_id = c.developer_profile_id
      INNER JOIN outreach_senders s
        ON s.id = (c.broker_filter->>'senderId')
        AND s.developer_profile_id = c.developer_profile_id
      WHERE c.developer_profile_id IS NOT NULL
        AND c.status = 'active'
        AND COALESCE(c.is_archived, false) = false
        AND COALESCE(c.is_deleted, false) = false
        AND ct.is_active = true
        AND s.is_active = true
    `);
    const developerTemplates = (developerTemplatesResult.rows || []) as any[];

    for (const template of developerTemplates) {
      const taggedResult = await db.execute(sql`
        SELECT b.id, b.email, b.first_name, b.last_name, b.phone
        FROM brokers b
        WHERE b.owner_developer_profile_id = ${template.developer_profile_id}
          AND ${template.hubspot_trigger_tag} = ANY(b.crm_tags)
          AND b.is_active = true
      `);
      const tagged = (taggedResult.rows || []) as any[];
      if (!tagged.length) continue;
      console.log(`   🏷️  [DEVELOPER] Campaign "${template.name}": ${tagged.length} tagged contacts`);
      for (const broker of tagged) {
        await enrollContact(broker, template.id, template.sender_id, 0);
      }
    }

    // ── PASS 2: Catalyst assigned_to matching ────────────────────────────────
    // Picks the best template per sender based on contact's CRM tags:
    //   • tag contains "Known"   → prefer a "Known" template for that sender
    //   • tag contains "Unknown" → prefer an "Unknown" template for that sender
    //   • no signal              → use the first active template for that sender
    const sendersResult = await db.execute(sql`
      SELECT id, name
      FROM outreach_senders
      WHERE is_active = true AND developer_profile_id IS NULL
      ORDER BY name
    `);
    const senders = (sendersResult.rows || []) as any[];

    for (const sender of senders) {
      // All templates that belong to this sender (by name match in template name)
      const senderTemplatesResult = await db.execute(sql`
        SELECT ct.id, ct.name FROM outreach_campaign_templates ct
        WHERE ct.is_active = true
          AND NOT EXISTS (
            SELECT 1
            FROM outreach_campaigns c
            WHERE c.developer_profile_id IS NOT NULL
              AND c.broker_filter->>'templateId' = ct.id
          )
          AND (
            ct.hubspot_trigger_tag = ANY(
              SELECT unnest(hubspot_trigger_tags) FROM outreach_senders WHERE id = ${sender.id}
            )
            OR ct.name ILIKE ${'%' + sender.name.split(' ')[0] + '%'}
          )
        ORDER BY ct.name
      `);
      const senderTemplates = (senderTemplatesResult.rows || []) as any[];
      if (!senderTemplates.length) continue;

      // Contacts assigned to this sender — match full name ("Jack Berg") OR first name only ("Jack")
      const senderFirstName = sender.name.split(' ')[0];
      const contactsResult = await db.execute(sql`
        SELECT b.id, b.email, b.first_name, b.last_name, b.phone, b.crm_tags
        FROM brokers b
        WHERE (b.assigned_to = ${sender.name} OR b.assigned_to = ${senderFirstName})
          AND b.is_active = true
          AND b.owner_developer_profile_id IS NULL
          AND b.email IS NOT NULL
          AND b.email NOT ILIKE '%@temp.landlinq.ai'
      `);
      const contacts = (contactsResult.rows || []) as any[];
      if (!contacts.length) continue;

      console.log(`   👤 [PASS 2] Sender "${sender.name}": ${contacts.length} assigned contacts, ${senderTemplates.length} templates`);

      for (const broker of contacts) {
        const tags: string[] = Array.isArray(broker.crm_tags) ? broker.crm_tags : [];
        // NOTE: "unknown".includes('known') === true, so always check unknown FIRST
        const hasUnknown = tags.some(t => t.toLowerCase().includes('unknown'));
        const hasKnown = !hasUnknown && tags.some(t => t.toLowerCase().includes('known'));

        // Pick template: same substring-safety rule applies to template names
        // A "Known" template name must not contain "unknown" or it would also match unknown contacts
        // If a contact has a specific tier tag (Known/Unknown) but the sender has no matching template,
        // skip rather than force-enrolling in the wrong tier's template.
        let chosenTemplate: typeof senderTemplates[0] | undefined;
        if (hasKnown) {
          chosenTemplate = senderTemplates.find(t => t.name.toLowerCase().includes('known') && !t.name.toLowerCase().includes('unknown'));
        } else if (hasUnknown) {
          chosenTemplate = senderTemplates.find(t => t.name.toLowerCase().includes('unknown'));
        } else {
          // Contact has no Known/Unknown tier tag — use first available template (general contacts)
          chosenTemplate = senderTemplates[0];
        }

        if (!chosenTemplate) {
          totalSkipped++;
          continue;
        }

        await enrollContact(broker, chosenTemplate.id, sender.id);
      }
    }

    // Log one summary line per template that had no sender — instead of one line per contact
    for (const [templateId, count] of Object.entries(noSenderSkips)) {
      console.warn(`   ⚠️  [CRM-POLL] No sender for template ${templateId} — skipped ${count} contact(s). Assign a sender to this template in Outreach Setup.`);
    }
    lastCrmPoll = new Date();
    console.log(`✅ [CRM-POLL] Done — enrolled: ${totalEnrolled}, already in queue: ${totalAlready}, skipped: ${totalSkipped}`);
    return { enrolled: totalEnrolled, skipped: totalSkipped, alreadyEnrolled: totalAlready };
  } catch (err: any) {
    console.error('❌ [CRM-POLL] Error:', err.message);
    return { enrolled: 0, skipped: 0, alreadyEnrolled: 0 };
  } finally {
    isCrmPollRunning = false;
  }
}

export function getCrmPollStatus() {
  return { isRunning: isCrmPollRunning, lastPoll: lastCrmPoll };
}

/**
 * Poll each connected Outlook sender's inbox for bounce-back emails and
 * hard-delete the corresponding broker from the CRM (same cascade as the
 * drip worker's immediate-bounce handler).
 */
export async function processOutlookBouncedEmails(): Promise<void> {
  try {
    const { pollOutlookInboxForBounces } = await import('../microsoftAuth');

    // Get all senders that have a live Microsoft token
    const sendersResult = await db.execute(sql`
      SELECT id, name, email, microsoft_access_token, microsoft_refresh_token, microsoft_token_expiry
      FROM outreach_senders
      WHERE microsoft_access_token IS NOT NULL
        AND microsoft_access_token != ''
    `);
    const senders = sendersResult.rows as any[];

    if (senders.length === 0) return;

    for (const sender of senders) {
      try {
        // Refresh token if expiring within 5 min
        let accessToken: string = sender.microsoft_access_token;
        const expiry = sender.microsoft_token_expiry ? new Date(sender.microsoft_token_expiry) : null;
        if (expiry && expiry <= new Date(Date.now() + 5 * 60 * 1000) && sender.microsoft_refresh_token) {
          try {
            const { refreshMicrosoftToken } = await import('../microsoftAuth');
            const newTokens = await refreshMicrosoftToken(sender.microsoft_refresh_token);
            accessToken = newTokens.accessToken;
            await db.execute(sql`
              UPDATE outreach_senders
              SET microsoft_access_token = ${newTokens.accessToken},
                  microsoft_refresh_token = ${newTokens.refreshToken ?? sender.microsoft_refresh_token},
                  microsoft_token_expiry  = ${newTokens.expiresAt},
                  updated_at              = NOW()
              WHERE id = ${sender.id}
            `);
          } catch { /* skip if refresh fails */ }
        }

        const bouncedEmails = await pollOutlookInboxForBounces(accessToken);
        if (bouncedEmails.length === 0) continue;

        console.log(`📬 [BOUNCE-POLL] Sender ${sender.name}: found ${bouncedEmails.length} bounce(s) — ${bouncedEmails.join(', ')}`);

        for (const email of bouncedEmails) {
          try {
            await db.execute(sql`
              UPDATE drip_campaign_enrollments
              SET status = 'cancelled',
                  paused_reason = 'Hard bounce — mailbox does not exist',
                  updated_at = NOW()
              WHERE sender_id = ${sender.id}
                AND LOWER(contact_email) = LOWER(${email})
                AND status IN ('pending', 'in_progress')
            `);
            console.log(`   ⚠️ [BOUNCE-POLL] Cancelled bounced enrollments for ${email} under sender ${sender.id}`);
            continue;
            const lookup = await db.execute(sql`SELECT id, first_name, last_name FROM brokers WHERE email = ${email} LIMIT 1`);
            const brokerRow = (lookup.rows as any[])[0];

            if (brokerRow) {
              const bId = brokerRow.id;
              await db.transaction(async (tx) => {
                await tx.execute(sql`UPDATE brokers SET referred_by = NULL WHERE referred_by = ${bId}`);
                await tx.execute(sql`UPDATE deals SET broker_id = NULL WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM commission_splits WHERE broker_id = ${bId} OR primary_broker_id = ${bId} OR referrer_broker_id = ${bId}`);
                await tx.execute(sql`UPDATE broker_points SET referral_id = NULL WHERE referral_id = ${bId}`);
                await tx.execute(sql`DELETE FROM referral_activities WHERE referrer_broker_id = ${bId} OR referred_broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM referral_metrics WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM referral_links WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM broker_partnerships WHERE broker_a_id = ${bId} OR broker_b_id = ${bId} OR broker_id = ${bId} OR partner_broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM preferred_partners WHERE broker_id = ${bId} OR partner_broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM partnership_invitations WHERE inviter_broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM broker_achievements WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM broker_points WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM broker_rewards WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM commission_earnings WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM platform_shares WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM deal_tags WHERE tagger_broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM viral_signups WHERE tagger_broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM valuations WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM valuation_shares WHERE shared_by_broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM outreach_sender_assignments WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM drip_campaign_enrollments WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM outreach_messages WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM communications WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM projects WHERE broker_id = ${bId}`);
                await tx.execute(sql`DELETE FROM brokers WHERE id = ${bId}`);
              });
              console.log(`   🗑️ [BOUNCE-POLL] Deleted bounced broker: ${email} (${brokerRow.first_name || ''} ${brokerRow.last_name || ''}) id=${bId}`);
            } else {
              // No broker record — cancel enrollments only
              await db.execute(sql`
                UPDATE drip_campaign_enrollments
                SET status = 'cancelled', paused_reason = 'Hard bounce — mailbox does not exist', updated_at = NOW()
                WHERE contact_email = ${email}
              `);
              console.log(`   ⚠️ [BOUNCE-POLL] No broker for ${email} — enrollments cancelled`);
            }
          } catch (deleteErr: any) {
            console.error(`   ❌ [BOUNCE-POLL] Failed to delete ${email}:`, deleteErr.message);
          }
        }
      } catch (senderErr: any) {
        // Non-fatal — skip this sender and continue
        console.warn(`   ⚠️ [BOUNCE-POLL] Skipping sender ${sender.name}: ${senderErr.message}`);
      }
    }
  } catch (err: any) {
    console.error('❌ [BOUNCE-POLL] Unexpected error:', err.message);
  }
}

/**
 * Start CRM-native poll scheduler (every 10 minutes), plus drip worker and bounce poller
 */
export function startHubspotPollScheduler(): void {
  if (crmPollTask) {
    console.log('⏭️ CRM poll scheduler already running');
    return;
  }

  crmPollTask = cron.schedule('*/10 * * * *', async () => {
    await processCrmTaggedContacts();
  });

  console.log('🗂️  CRM-native poll scheduler started (every 10 minutes)');

  // DRIP CAMPAIGN WORKER - Process due enrollments every hour at :05 (9 AM–5 PM ET only)
  cron.schedule('5 * * * *', async () => {
    console.log('⏰ [DRIP] Hourly drip worker triggered');
    await processDripEnrollments();
  });
  
  console.log('📧 Drip campaign worker scheduled (every hour at :05, 9 AM–5 PM ET)');

  // OUTLOOK BOUNCE POLLER - Check sender inboxes every 4 hours for bounce-back emails
  cron.schedule('30 */4 * * *', async () => {
    console.log('📬 [BOUNCE-POLL] Running Outlook inbox bounce check...');
    await processOutlookBouncedEmails();
  });

  console.log('📬 Outlook bounce poller scheduled (every 4 hours)');

  // Run CRM poll on startup after a short delay
  setTimeout(() => processCrmTaggedContacts(), 30000);
  
  // Also run drip worker on startup
  setTimeout(() => processDripEnrollments(), 60000);

  // Run bounce check on startup after 2 minutes
  setTimeout(() => processOutlookBouncedEmails(), 120000);
}

/**
 * Stop CRM-native poll scheduler
 */
export function stopHubspotPollScheduler(): void {
  if (crmPollTask) {
    crmPollTask.stop();
    crmPollTask = null;
    console.log('🛑 CRM poll scheduler stopped');
  }
}

/**
 * Get CRM-native poll status
 */
export function getHubspotPollStatus(): {
  isRunning: boolean;
  lastPoll: Date | null;
  isCurrentlyPolling: boolean;
} {
  return {
    isRunning: crmPollTask !== null,
    lastPoll: lastCrmPoll,
    isCurrentlyPolling: isCrmPollRunning
  };
}