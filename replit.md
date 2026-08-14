# Overview

This full-stack land acquisition platform for Catalyst Capital Partners automates and streamlines the land deal submission and evaluation process. It features a web interface for deal submission, an analyst dashboard for review, and AI-powered deal analysis against specific acquisition criteria extracted from PDF specifications. The platform automatically classifies deals (high priority, potential, or clear no) and automates team assignments. It also includes a recurring monthly broker outreach system for automated email/SMS campaigns. The project aims to enhance efficiency, consistency, and market engagement in land acquisition, boosting deal flow and investment opportunities.

# User Preferences

Preferred communication style: Simple, everyday language.

**CRITICAL USER PREFERENCE: NO MOCK DATA**
- NEVER generate mock, fake, or placeholder data under any circumstances
- User explicitly prefers NO DATA over mock/fake data
- When APIs fail or return no results, return empty arrays/null values
- Always be transparent about data availability and sources
- This applies to ALL data types: comparables, demographics, financial estimates, API costs, etc.
- **API Monitoring Dashboard**: Shows ONLY real API costs from database - zero hardcoded infrastructure costs or placeholder values
- If user hasn't made any API calls, dashboard shows $0.00 (not fake hosting/database costs)

**CRITICAL SYSTEM RULE: OUTREACH MANAGEMENT TEMPLATES ONLY**
- ALL email and SMS templates MUST come from the Outreach Management tab (businessSettings)
- ZERO hardcoded templates, HTML, subjects, or content allowed anywhere in the codebase
- NO fallback templates - if a template is missing from outreach management, the system must fail with a clear error
- This includes: welcome emails, deal confirmations, rejections, password resets, daily digests, and ALL other communications
- Branding colors and contact info must come from `businessSettings` - no hardcoded branding constants allowed
- **EXCEPTION - Email Logo**: The "CATALYST - Powered By LandLinq™" logo is HARDCODED to ALL emails (`/attached_assets/Add%20a%20heading%20copy_1762196498512.png`) per explicit user requirement. This overrides the dynamic logo system.
- **SendGrid Dynamic Templates Toggle System**: Each email template has a per-template toggle switch in Outreach Management for choosing between Outreach Tab (database) and SendGrid Dynamic Templates. Toggle OFF removes `sendgridTemplateId` field entirely (uses Outreach Tab), toggle ON sets it to empty string and reveals the template ID input field (uses SendGrid when ID is provided). Auto-routing logic: if `sendgridTemplateId` exists (not null/undefined) → use SendGrid; otherwise → use Outreach Tab. SMS templates remain exclusively on Outreach Tab. The `templateSource` field is deprecated but kept for backward compatibility.

**CRITICAL SYSTEM RULE: PROFILE COMPLETION**
- **Profile is complete with ONE contact method (email OR phone)** - name and markets are OPTIONAL
- SMS brokers have phone verified → profile automatically complete, NO collection flows triggered
- Email brokers have email verified → profile automatically complete
- Name and markets can be collected opportunistically if AI extracts them, but are never required
- Conversations start in 'active' state for SMS (since phone is verified)
- Temp emails (`sms-<phone>-<timestamp>@temp.landlinq.ai`) are excluded from contact method checks

# System Architecture

## Frontend
The frontend uses React 18, TypeScript, Wouter for routing, and React Query. UI components are built with shadcn/ui and Radix UI, styled with Tailwind CSS. Key UI/UX features include mobile responsiveness, consistent button design, an onboarding tour, and interactive deal mapping via ArcGIS Maps SDK with color-coded markers and bidirectional table-map navigation.

## Backend
The backend is an Express.js application in TypeScript, using Drizzle ORM and PostgreSQL. Authentication is handled by Replit Auth, and API endpoints are RESTful.

## Data Storage
PostgreSQL is the primary database for all application data, including user authentication, broker profiles, deal submissions, communications, and session data, utilizing UUID primary keys and indexing.

## Authentication
Authentication is managed through Replit Auth, which uses OpenID Connect, with session data stored in PostgreSQL.

## AI Analysis
An automated deal analysis system uses GPT-5 for intelligent parsing and data extraction from PDF specifications to evaluate properties against acquisition criteria. It includes automatic deal assignment, a "Re-Run Analysis" feature, and QCT (Qualified Census Tract) overrides for affordable housing deals. AI Explanatory Notes provide concise explanations for classification decisions.

## Notification System
The system implements an idempotent notification system using `EventDispatchService` for asynchronous email and SMS delivery, with deduplication and an SMS follow-up system. Phone numbers are normalized to E.164.

## Key Features
- **Auto-Classification Engine**: Multi-step workflow with hard rejection rules and QCT exceptions.
- **HelloData Comparable Search**: Automates property analysis and provides comparable data.
- **Manual Classification Fallback**: For deals where AI/HelloData cannot find sufficient comparables.
- **API Call Tracking & Cost Optimization**: Comprehensive monitoring, real-time tracking, spending caps, and circuit breakers.
- **Recurring Monthly Broker Outreach System**: Automated email/SMS campaigns with a three-table architecture and hourly cron scheduler. Includes a multi-step drip campaign builder with rich text editing and personalization tokens.
- **Shared Campaign Templates (Scalable Outreach)**: Tag-based campaign routing for 80,000+ contacts. HubSpot Owner ID determines WHO sends (sender's OAuth/signature), while HubSpot Tag determines WHAT content (shared campaign template). Any sender can send any campaign based on contact tags. UI in Outreach Setup → Step 4: Campaign Templates.
- **Enrollment Queue Architecture**: Replaced immediate-send with queue-based processing for 80k+ contact scalability:
  - **Database Table**: `drip_campaign_enrollments` tracks each contact's campaign progress with `next_send_at` scheduling, `current_step_index`, and status (pending/in_progress/completed/failed)
  - **HubSpot Poll Redesign**: Enrolls ALL tagged contacts into queue with staggered send dates (500/day batches) instead of sending immediately
  - **Daily Drip Worker**: `processDripEnrollments()` runs every hour at :05, sends emails where `next_send_at <= now`, then advances to next step based on day offsets
  - **Step Progression**: Uses `advanceToNextStep()` to calculate next_send_at from campaign step day_number differences (e.g., Day 1→30→90)
  - **API Endpoints**: `/api/outreach/enrollment-stats` and `/api/outreach/enrollments` for monitoring queue status
- **Two-Way SMS Messaging Dashboard**: Direct conversation system with WebSocket updates and unread tracking.
- **MSA Management Interface**: CRUD operations for 232 target markets.
- **New Broker Onboarding**: Automated account creation for email/SMS submissions.
- **SMS Opt-In Campaign**: Automated email campaign to maximize SMS notification opt-in rates.
- **Email & SMS Parsing Enhancements**: GPT-5-powered intelligent preprocessing, including PDF attachment parsing, multi-property detection, and intelligent SMS profile parsing with confidence scoring. Communication-first email processing preserves original email content.
- **Address Typo Preservation**: AI parsers are instructed not to correct typos in street names.
- **API Timeout Protection**: Timeouts added to all Geocodio and HelloData API calls.
- **Phone Normalization for Broker Matching**: Prevents duplicate broker profiles.
- **SMS Missing Info Reply Fallback**: Automatically updates incomplete deals with extracted location data from broker SMS replies and reclassifies.
- **Object Storage Protection**: Bucket change detection with email alerts, nightly file backup with 7-day retention, and periodic health checks.
- **Coordinate Submission Support**: Quick Add form accepts DMS or decimal coordinates, using reverse geocoding to determine county/state/city for QCT and other analyses.
- **White-Label Outreach Onboarding**: SaaS-ready onboarding with team/sender configuration, Microsoft Outlook OAuth, HubSpot CRM integration (webhook for broker sync), and configurable multi-step drip campaigns for white-label resale.
- **HubSpot Integration**: Bidirectional sync for brokers; webhook syncs tagged contacts from HubSpot to LandLinq, creating broker profiles and assigning to senders.
- **API Monitoring**: Displays only real API costs, success rates, and average response times.
- **One-Page PDF Deal Reports**: Download button generates branded PDF reports with Catalyst logo, property info, financials, enhanced broker details (company/email/phone/markets), market demographics (QCT status, median income), Google Maps aerial view with property pins (subject=red S, comparables=blue 1-9), full HelloData comparables table (Name, Vintage, Units, Distance, Rent PSF), and classification notes using jsPDF. Backend proxy at `/api/public/static-map` handles Google Maps Static API to avoid CORS issues.
- **MSA Re-Run Bypass**: When re-running a deal that's outside target MSA, the system adds an informational note ("⚠️ NOTE: Property is OUTSIDE target acquisition markets") instead of rejecting. Other criteria (vintage, units) are still evaluated, allowing deals to pass if they meet non-MSA requirements.
- **Import Deal from Email**: AI-powered extraction from pasted email content with manual approval modal before creating deals.
- **Mecklenburg County Tax Scraper**: Web tool at `/tax-scraper` (accessible from Launchpad). Upload an Excel file with parcel IDs in column P (rows 3–227). Scrapes 2024 property tax bill data from two sources: Polaris3G REST API (assessed value) and taxbill.co.mecklenburg.nc.us via Playwright headless Chromium (millage rate, direct assessments, interest, total tax bill). Writes results back into columns J–N. Background job system with concurrency=3, live progress bar, cancel, export to Excel, and print-to-PDF. Chromium binary at `/home/runner/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`.
- **USDA NRCS Soil Survey**: On-demand soil data lookup in the deal detail panel using the NRCS Web Soil Survey (SDA) REST API. Shows map unit name, dominant soil component, drainage class, flooding frequency (from comonth table), hydric/wetland rating, USDA Land Capability Class (1-8), slope, and soil taxonomy. Derives a construction suitability rating (Good/Moderate/Poor) with specific notes for drainage issues, flooding risk, wetland jurisdiction, and slope. Served from `/api/soil-data?lat=X&lng=Y`. No API key required (USDA_API_KEY reserved for future USDA services).
- **AI Training System**: Upload pipeline review session transcripts to train the AI on team decision-making patterns. The system extracts deal discussions, pros/cons/risks, and team decisions from transcripts. Uses GPT-4o to generate structured insights linked to deals.
  - **Database Tables**: `pipeline_review_transcripts` (stores transcripts), `transcript_deal_mentions` (extracted deal discussions), `ai_deal_analysis` (AI-generated analysis per deal)
  - **AI Deal Analysis**: Generates pros, cons, risks, key considerations, and overall score (1-100) for each deal based on deal data and training examples
  - **API Endpoints**: `/api/ai-training/transcripts` (CRUD), `/api/ai-training/transcripts/:id/process` (extract deals from transcript), `/api/ai-analysis/:dealId` (get/generate analysis)

# External Dependencies

## Database Services
*   **Neon Database**: PostgreSQL hosting.
*   **Drizzle Kit**: Database migration and schema management.

## Authentication Services
*   **Replit Auth**: OpenID Connect authentication.
*   **connect-pg-simple**: PostgreSQL session store.

## Property Data Services
*   **HelloData.ai**: Property enrichment and acreage data.
*   **Geocodio v1.9**: Geocoding service (forward and reverse).
*   **ArcGIS**: Demographics (55+ population, $75K+ households), GeoEnrichment, and interactive mapping.
*   **US Census Bureau API**: ACS 5-year demographic data including total population, median household income, median age, housing vacancy rate, and renter occupancy rate. Fetched automatically during deal enrichment using coordinates and census tract lookup.

## AI Services
*   **GPT-5 (OpenAI)**: Intelligent parsing and content analysis.

## Email Intake Queue (email-to-deal pipeline)
*   Inbound emails to `deals@landlinq.ai` POST to `/api/inbound-email` via SendGrid Inbound Parse.
*   `server/emailIntakeService.ts` parses with GPT-4o (Vision for images, pdf-parse for PDFs), deduplicates by SHA-256 hash, and saves a pending record to `email_intake_queue` table.
*   Analysts visit `/email-intake` to review each email, edit parsed fields, then Approve (creates deal + queues enrichment job) or Reject.
*   Nothing auto-posts to the `deals` table — every email requires explicit analyst approval.
*   API routes: `GET /api/email-intake?status=pending|approved|rejected`, `GET /api/email-intake/count`, `POST /api/email-intake/:id/approve`, `POST /api/email-intake/:id/reject`, `PATCH /api/email-intake/:id`.

## Communication Integration
*   **Twilio**: SMS integration.
*   **SendGrid**: Email services, including Inbound Parse Email webhook.
*   **Microsoft Graph API**: For Outlook OAuth connection in outreach.
*   **HubSpot API**: CRM integration for contact management and webhooks.