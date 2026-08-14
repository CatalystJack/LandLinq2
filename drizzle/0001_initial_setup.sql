CREATE TYPE "public"."outreach_campaign_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."outreach_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."outreach_message_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."outreach_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."deal_classification" ADD VALUE 'unclassified' BEFORE 'red';--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"status" "outreach_campaign_status" DEFAULT 'active',
	"cadence" varchar DEFAULT 'monthly',
	"day_of_month" integer DEFAULT 1,
	"send_hour_utc" integer DEFAULT 14,
	"channels" jsonb DEFAULT '["email"]',
	"email_template_key" varchar DEFAULT 'monthlyOutreachReminder',
	"sms_template_key" varchar DEFAULT 'monthlyOutreachReminder',
	"broker_filter" jsonb DEFAULT '{}',
	"rate_limit_per_minute" integer DEFAULT 10,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_by" varchar,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"deleted_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"run_id" varchar NOT NULL,
	"broker_id" varchar NOT NULL,
	"channel" "outreach_channel" NOT NULL,
	"period_key" varchar NOT NULL,
	"template_key" varchar NOT NULL,
	"subject" varchar,
	"body" text NOT NULL,
	"provider_ids" jsonb,
	"status" "outreach_message_status" DEFAULT 'queued',
	"reason" text,
	"sent_at" timestamp,
	"error_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "outreach_messages_dedup_unique" UNIQUE("campaign_id","broker_id","channel","period_key")
);
--> statement-breakpoint
CREATE TABLE "outreach_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"status" "outreach_run_status" DEFAULT 'running',
	"total_targets" integer DEFAULT 0,
	"sent_email_count" integer DEFAULT 0,
	"sent_sms_count" integer DEFAULT 0,
	"failures_count" integer DEFAULT 0,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "api_data_sources" DROP CONSTRAINT "api_data_sources_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "api_health_metrics" DROP CONSTRAINT "api_health_metrics_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "broker_points" DROP CONSTRAINT "broker_points_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "commission_earnings" DROP CONSTRAINT "commission_earnings_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "commission_splits" DROP CONSTRAINT "commission_splits_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "communications" DROP CONSTRAINT "communications_related_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_tags" DROP CONSTRAINT "deal_tags_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_validation_history" DROP CONSTRAINT "deal_validation_history_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "market_analysis" DROP CONSTRAINT "market_analysis_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "property_comments" DROP CONSTRAINT "property_comments_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "property_data" DROP CONSTRAINT "property_data_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "public_listing_matches" DROP CONSTRAINT "public_listing_matches_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "public_listing_searches" DROP CONSTRAINT "public_listing_searches_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "referral_activities" DROP CONSTRAINT "referral_activities_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "review_actions" DROP CONSTRAINT "review_actions_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "review_assignments" DROP CONSTRAINT "review_assignments_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "review_corrections" DROP CONSTRAINT "review_corrections_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "review_escalations" DROP CONSTRAINT "review_escalations_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "review_queue" DROP CONSTRAINT "review_queue_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "site_plans" DROP CONSTRAINT "site_plans_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "viral_signups" DROP CONSTRAINT "viral_signups_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "business_settings" ALTER COLUMN "support_email" SET DEFAULT 'catalyst@landlinq.ai';--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "has_entitlements" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "classification" SET DEFAULT 'unclassified';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "acquisition_criteria" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "deal_assignments" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "assigned_jr_analyst" varchar;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_run_id_outreach_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."outreach_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_runs" ADD CONSTRAINT "outreach_runs_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_campaigns_status_idx" ON "outreach_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_campaigns_next_run_idx" ON "outreach_campaigns" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "outreach_messages_campaign_idx" ON "outreach_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "outreach_messages_run_idx" ON "outreach_messages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "outreach_messages_broker_idx" ON "outreach_messages" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "outreach_messages_status_idx" ON "outreach_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_messages_period_idx" ON "outreach_messages" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "outreach_runs_campaign_idx" ON "outreach_runs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "outreach_runs_started_idx" ON "outreach_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "outreach_runs_status_idx" ON "outreach_runs" USING btree ("status");--> statement-breakpoint
ALTER TABLE "api_data_sources" ADD CONSTRAINT "api_data_sources_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_health_metrics" ADD CONSTRAINT "api_health_metrics_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_points" ADD CONSTRAINT "broker_points_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_earnings" ADD CONSTRAINT "commission_earnings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_splits" ADD CONSTRAINT "commission_splits_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_related_deal_id_deals_id_fk" FOREIGN KEY ("related_deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_validation_history" ADD CONSTRAINT "deal_validation_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_analysis" ADD CONSTRAINT "market_analysis_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_comments" ADD CONSTRAINT "property_comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_data" ADD CONSTRAINT "property_data_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_listing_matches" ADD CONSTRAINT "public_listing_matches_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_listing_searches" ADD CONSTRAINT "public_listing_searches_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_corrections" ADD CONSTRAINT "review_corrections_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_escalations" ADD CONSTRAINT "review_escalations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_plans" ADD CONSTRAINT "site_plans_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viral_signups" ADD CONSTRAINT "viral_signups_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;