CREATE TYPE "public"."deal_classification" AS ENUM('red', 'yellow', 'green');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('pending_review', 'under_review', 'approved', 'rejected', 'clear_no', 'potentially', 'high_priority', 'initial_review', 'due_diligence', 'financial_analysis', 'final_review', 'contract_negotiation', 'closing', 'completed');--> statement-breakpoint
CREATE TABLE "acquisition_criteria" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"classification" varchar NOT NULL,
	"min_score" integer,
	"max_score" integer,
	"weight" integer DEFAULT 1,
	"rules" jsonb NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp DEFAULT now(),
	"total_deals" integer DEFAULT 0,
	"pending_deals" integer DEFAULT 0,
	"approved_deals" integer DEFAULT 0,
	"rejected_deals" integer DEFAULT 0,
	"avg_review_time" numeric(4, 1),
	"total_pipeline_value" numeric(15, 2)
);
--> statement-breakpoint
CREATE TABLE "broker_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"achievement_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"icon" varchar NOT NULL,
	"points_awarded" integer DEFAULT 0,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broker_partnerships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_a_id" varchar NOT NULL,
	"broker_b_id" varchar NOT NULL,
	"partnership_type" varchar NOT NULL,
	"status" varchar DEFAULT 'active',
	"commission_split_percentage" numeric(5, 2) DEFAULT '10.00',
	"total_deals_shared" integer DEFAULT 0,
	"total_commission_shared" numeric(10, 2) DEFAULT '0',
	"notes" text,
	"established_at" timestamp DEFAULT now(),
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broker_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"points" integer NOT NULL,
	"reason" varchar NOT NULL,
	"deal_id" varchar,
	"referral_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broker_rewards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"reward_type" varchar NOT NULL,
	"reward_value" numeric(10, 2),
	"reward_description" text NOT NULL,
	"points_cost" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"claimed_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brokers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"markets_covered" text NOT NULL,
	"brokerage" varchar,
	"years_experience" varchar,
	"is_active" boolean DEFAULT true,
	"preferred_contact" varchar DEFAULT 'email',
	"total_points" integer DEFAULT 0,
	"current_level" integer DEFAULT 1,
	"referral_code" varchar,
	"referred_by" varchar,
	"share_count" integer DEFAULT 0,
	"consecutive_deals" integer DEFAULT 0,
	"viral_signups_generated" integer DEFAULT 0,
	"total_tags_sent" integer DEFAULT 0,
	"last_activity_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "brokers_email_unique" UNIQUE("email"),
	CONSTRAINT "brokers_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "commission_earnings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"commission_amount" integer NOT NULL,
	"commission_type" varchar NOT NULL,
	"deal_value" integer,
	"commission_percent" integer,
	"payout_status" varchar DEFAULT 'pending',
	"payout_date" timestamp,
	"tagged_emails" varchar[],
	"notifications_sent" boolean DEFAULT false,
	"notifications_sent_at" timestamp,
	"signups_from_notification" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commission_splits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"primary_broker_id" varchar NOT NULL,
	"referrer_broker_id" varchar,
	"total_commission" numeric(10, 2) NOT NULL,
	"primary_broker_share" numeric(10, 2) NOT NULL,
	"referrer_share" numeric(10, 2) DEFAULT '0',
	"platform_fee" numeric(10, 2) DEFAULT '0',
	"split_type" varchar NOT NULL,
	"split_percentage" numeric(5, 2),
	"status" varchar DEFAULT 'pending',
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"deal_id" varchar,
	"type" varchar NOT NULL,
	"subject" varchar,
	"message" text NOT NULL,
	"recipient_email" varchar,
	"status" varchar DEFAULT 'sent',
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"tagger_broker_id" varchar NOT NULL,
	"tagged_email" varchar NOT NULL,
	"tagged_linkedin" varchar,
	"tagged_name" varchar,
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"clicked_notification" boolean DEFAULT false,
	"clicked_at" timestamp,
	"signed_up" boolean DEFAULT false,
	"signed_up_at" timestamp,
	"signed_up_user_id" varchar,
	"viewed_deal" boolean DEFAULT false,
	"viewed_at" timestamp,
	"points_awarded" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"broker_phone" varchar,
	"team_member_emails" jsonb,
	"tagged_emails" jsonb,
	"tagged_linkedin" jsonb,
	"address" text NOT NULL,
	"asking_price" numeric(12, 2),
	"pricing_type" varchar DEFAULT 'whole_deal',
	"size_acres" numeric(8, 2),
	"unit_count" integer,
	"has_entitlements" boolean DEFAULT false,
	"parcel_id" varchar,
	"zoning" varchar,
	"sewer_available" boolean,
	"rent_comparable" numeric(8, 2),
	"product_types" jsonb,
	"property_name" varchar,
	"construction_cost_per_sf" numeric(8, 2),
	"projected_rent_per_sf" numeric(8, 2),
	"total_project_cost" numeric(12, 2),
	"projected_noi" numeric(12, 2),
	"market_cap_rate" numeric(5, 3),
	"development_timeline_months" integer,
	"unit_size" numeric(8, 2),
	"population_55_plus_5_mile" integer,
	"income_75_plus_55_plus" integer,
	"demographics_notes" text,
	"assigned_analyst" varchar,
	"developer" varchar,
	"partner" varchar,
	"next_steps" text,
	"additional_notes" text,
	"status" "deal_status" DEFAULT 'pending_review',
	"classification" "deal_classification",
	"status_updated_at" timestamp DEFAULT now(),
	"status_updated_by" varchar,
	"pipeline_stage" integer DEFAULT 1,
	"time_in_current_stage" integer DEFAULT 0,
	"total_pipeline_time" integer DEFAULT 0,
	"stage_history" jsonb,
	"priority" varchar DEFAULT 'medium',
	"estimated_close_date" date,
	"actual_close_date" date,
	"ai_analysis_data" jsonb,
	"submission_method" varchar NOT NULL,
	"document_urls" jsonb,
	"analyst_notes" text,
	"rejection_reason" text,
	"calculated_fields" jsonb,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"level" varchar NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"context" text,
	"user_id" varchar,
	"request_id" varchar,
	"endpoint" varchar,
	"user_agent" text,
	"ip_address" varchar,
	"session_id" varchar
);
--> statement-breakpoint
CREATE TABLE "market_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar,
	"market_area" varchar NOT NULL,
	"avg_rent_per_sf" numeric(8, 2),
	"vacancy_rate" numeric(5, 3),
	"rent_growth_rate" numeric(5, 3),
	"avg_sale_price_per_sf" numeric(8, 2),
	"days_on_market" integer,
	"price_appreciation" numeric(5, 3),
	"units_under_construction" integer,
	"planned_developments" integer,
	"population_growth" numeric(5, 3),
	"job_growth" numeric(5, 3),
	"cap_rates" jsonb,
	"gross_rent_multiplier" numeric(6, 2),
	"price_to_rent_ratio" numeric(6, 2),
	"data_sources" jsonb,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partnership_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_broker_id" varchar NOT NULL,
	"invitee_email" varchar NOT NULL,
	"invitee_name" varchar NOT NULL,
	"invitee_type" varchar NOT NULL,
	"personal_message" varchar,
	"status" varchar DEFAULT 'sent',
	"viewed_at" timestamp,
	"signed_up_at" timestamp,
	"accepted_at" timestamp,
	"new_user_id" varchar,
	"points_awarded" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "platform_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"share_type" varchar NOT NULL,
	"platform" varchar,
	"share_url" varchar,
	"click_count" integer DEFAULT 0,
	"conversion_count" integer DEFAULT 0,
	"points_earned" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "preferred_partners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"partner_email" varchar NOT NULL,
	"partner_name" varchar NOT NULL,
	"partner_type" varchar NOT NULL,
	"partner_company" varchar,
	"partner_phone" varchar,
	"status" varchar DEFAULT 'pending',
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"accepted_at" timestamp,
	"partner_user_id" varchar,
	"partner_broker_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"deal_ids" jsonb,
	"assigned_team" jsonb,
	"status" varchar DEFAULT 'active',
	"priority" varchar DEFAULT 'medium',
	"target_completion_date" date,
	"actual_completion_date" date,
	"budget" numeric(12, 2),
	"estimated_roi" numeric(5, 3),
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar,
	"author_id" varchar NOT NULL,
	"author_name" varchar NOT NULL,
	"comment" text NOT NULL,
	"comment_type" varchar DEFAULT 'general',
	"is_resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar,
	"parcel_id" varchar,
	"coordinates" jsonb,
	"boundaries" jsonb,
	"area" numeric(12, 4),
	"current_zoning" varchar,
	"allowed_uses" jsonb,
	"density_limits" jsonb,
	"height_restrictions" numeric(6, 2),
	"setbacks" jsonb,
	"sewer_access" boolean DEFAULT false,
	"water_access" boolean DEFAULT false,
	"power_access" boolean DEFAULT false,
	"gas_access" boolean DEFAULT false,
	"road_access" varchar,
	"flood_zone" varchar,
	"wetlands" boolean DEFAULT false,
	"soil_type" varchar,
	"slope" numeric(5, 2),
	"environmental_constraints" jsonb,
	"market_area" varchar,
	"median_household_income" numeric(10, 2),
	"population_density" numeric(8, 2),
	"demographics" jsonb,
	"comparables" jsonb,
	"market_trends" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "property_data_parcel_id_unique" UNIQUE("parcel_id")
);
--> statement-breakpoint
CREATE TABLE "referral_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_link_id" varchar NOT NULL,
	"referrer_broker_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"referred_user_id" varchar,
	"referred_broker_id" varchar,
	"deal_id" varchar,
	"conversion_value" numeric(10, 2),
	"ip_address" varchar,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"referral_code" varchar NOT NULL,
	"link_type" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"click_count" integer DEFAULT 0,
	"conversion_count" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "referral_links_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "referral_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"metric_date" date NOT NULL,
	"total_referrals" integer DEFAULT 0,
	"successful_referrals" integer DEFAULT 0,
	"clicks_generated" integer DEFAULT 0,
	"signups_generated" integer DEFAULT 0,
	"deals_generated" integer DEFAULT 0,
	"commission_earned" numeric(10, 2) DEFAULT '0',
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"avg_deal_value" numeric(10, 2) DEFAULT '0',
	"top_performer" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar,
	"property_data_id" varchar,
	"plan_name" varchar NOT NULL,
	"total_units" integer,
	"buildable_area" numeric(10, 4),
	"open_space_percentage" numeric(5, 2),
	"parking_spaces" integer,
	"unit_mix" jsonb,
	"average_unit_size" numeric(8, 2),
	"estimated_construction_cost" numeric(12, 2),
	"estimated_sales_price" numeric(12, 2),
	"projected_rent_roll" numeric(12, 2),
	"estimated_noi" numeric(12, 2),
	"projected_irr" numeric(5, 3),
	"development_phases" jsonb,
	"estimated_timeline_months" integer,
	"ai_optimized" boolean DEFAULT false,
	"ai_recommendations" jsonb,
	"status" varchar DEFAULT 'draft',
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_metrics" (
	"timestamp" timestamp PRIMARY KEY DEFAULT now() NOT NULL,
	"memory_heap_used" bigint,
	"memory_heap_total" bigint,
	"memory_external" bigint,
	"memory_rss" bigint,
	"cpu_user" numeric(10, 6),
	"cpu_system" numeric(10, 6),
	"event_loop_delay" numeric(10, 2),
	"active_connections" integer,
	"requests_per_minute" integer,
	"error_rate" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "valuation_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"valuation_id" varchar NOT NULL,
	"shared_by_broker_id" varchar NOT NULL,
	"shared_with_email" varchar NOT NULL,
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"viewed_report" boolean DEFAULT false,
	"viewed_at" timestamp,
	"signed_up" boolean DEFAULT false,
	"signed_up_at" timestamp,
	"signed_up_user_id" varchar,
	"points_awarded" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"address" varchar NOT NULL,
	"size_acres" varchar NOT NULL,
	"zoning" varchar,
	"market_comps" varchar,
	"notes" varchar,
	"price_per_acre" integer NOT NULL,
	"total_value" integer NOT NULL,
	"pdf_url" varchar,
	"is_shared" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "viral_signups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_tag_id" varchar NOT NULL,
	"tagger_broker_id" varchar NOT NULL,
	"new_user_id" varchar NOT NULL,
	"new_user_email" varchar NOT NULL,
	"signup_source" varchar DEFAULT 'deal_tag',
	"deal_id" varchar NOT NULL,
	"points_awarded" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "broker_achievements" ADD CONSTRAINT "broker_achievements_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_partnerships" ADD CONSTRAINT "broker_partnerships_broker_a_id_brokers_id_fk" FOREIGN KEY ("broker_a_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_partnerships" ADD CONSTRAINT "broker_partnerships_broker_b_id_brokers_id_fk" FOREIGN KEY ("broker_b_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_points" ADD CONSTRAINT "broker_points_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_points" ADD CONSTRAINT "broker_points_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_points" ADD CONSTRAINT "broker_points_referral_id_brokers_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_rewards" ADD CONSTRAINT "broker_rewards_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_referred_by_brokers_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_earnings" ADD CONSTRAINT "commission_earnings_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_earnings" ADD CONSTRAINT "commission_earnings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_splits" ADD CONSTRAINT "commission_splits_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_splits" ADD CONSTRAINT "commission_splits_primary_broker_id_brokers_id_fk" FOREIGN KEY ("primary_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_splits" ADD CONSTRAINT "commission_splits_referrer_broker_id_brokers_id_fk" FOREIGN KEY ("referrer_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_tagger_broker_id_brokers_id_fk" FOREIGN KEY ("tagger_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_signed_up_user_id_users_id_fk" FOREIGN KEY ("signed_up_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_status_updated_by_users_id_fk" FOREIGN KEY ("status_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_analysis" ADD CONSTRAINT "market_analysis_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_invitations" ADD CONSTRAINT "partnership_invitations_inviter_broker_id_brokers_id_fk" FOREIGN KEY ("inviter_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_invitations" ADD CONSTRAINT "partnership_invitations_new_user_id_users_id_fk" FOREIGN KEY ("new_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_shares" ADD CONSTRAINT "platform_shares_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferred_partners" ADD CONSTRAINT "preferred_partners_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferred_partners" ADD CONSTRAINT "preferred_partners_partner_user_id_users_id_fk" FOREIGN KEY ("partner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferred_partners" ADD CONSTRAINT "preferred_partners_partner_broker_id_brokers_id_fk" FOREIGN KEY ("partner_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_comments" ADD CONSTRAINT "property_comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_comments" ADD CONSTRAINT "property_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_comments" ADD CONSTRAINT "property_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_data" ADD CONSTRAINT "property_data_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referral_link_id_referral_links_id_fk" FOREIGN KEY ("referral_link_id") REFERENCES "public"."referral_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referrer_broker_id_brokers_id_fk" FOREIGN KEY ("referrer_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referred_broker_id_brokers_id_fk" FOREIGN KEY ("referred_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_metrics" ADD CONSTRAINT "referral_metrics_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_plans" ADD CONSTRAINT "site_plans_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_plans" ADD CONSTRAINT "site_plans_property_data_id_property_data_id_fk" FOREIGN KEY ("property_data_id") REFERENCES "public"."property_data"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_plans" ADD CONSTRAINT "site_plans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_shares" ADD CONSTRAINT "valuation_shares_valuation_id_valuations_id_fk" FOREIGN KEY ("valuation_id") REFERENCES "public"."valuations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_shares" ADD CONSTRAINT "valuation_shares_shared_by_broker_id_brokers_id_fk" FOREIGN KEY ("shared_by_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_shares" ADD CONSTRAINT "valuation_shares_signed_up_user_id_users_id_fk" FOREIGN KEY ("signed_up_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viral_signups" ADD CONSTRAINT "viral_signups_deal_tag_id_deal_tags_id_fk" FOREIGN KEY ("deal_tag_id") REFERENCES "public"."deal_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viral_signups" ADD CONSTRAINT "viral_signups_tagger_broker_id_brokers_id_fk" FOREIGN KEY ("tagger_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viral_signups" ADD CONSTRAINT "viral_signups_new_user_id_users_id_fk" FOREIGN KEY ("new_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viral_signups" ADD CONSTRAINT "viral_signups_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_broker_a" ON "broker_partnerships" USING btree ("broker_a_id");--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_broker_b" ON "broker_partnerships" USING btree ("broker_b_id");--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_type" ON "broker_partnerships" USING btree ("partnership_type");--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_status" ON "broker_partnerships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_deal_id" ON "commission_splits" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_primary_broker" ON "commission_splits" USING btree ("primary_broker_id");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_referrer" ON "commission_splits" USING btree ("referrer_broker_id");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_status" ON "commission_splits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_referral_activities_link_id" ON "referral_activities" USING btree ("referral_link_id");--> statement-breakpoint
CREATE INDEX "idx_referral_activities_referrer" ON "referral_activities" USING btree ("referrer_broker_id");--> statement-breakpoint
CREATE INDEX "idx_referral_activities_type" ON "referral_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_referral_activities_created" ON "referral_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_referral_links_broker_id" ON "referral_links" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "idx_referral_links_code" ON "referral_links" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "idx_referral_links_type" ON "referral_links" USING btree ("link_type");--> statement-breakpoint
CREATE INDEX "idx_referral_metrics_broker_id" ON "referral_metrics" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "idx_referral_metrics_date" ON "referral_metrics" USING btree ("metric_date");--> statement-breakpoint
CREATE INDEX "idx_referral_metrics_top_performer" ON "referral_metrics" USING btree ("top_performer");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");