CREATE TYPE "public"."deal_classification" AS ENUM('red', 'yellow', 'green');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('pending_review', 'under_review', 'approved', 'rejected', 'clear_no', 'potentially', 'high_priority', 'initial_review', 'due_diligence', 'financial_analysis', 'final_review', 'contract_negotiation', 'closing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."listing_source" AS ENUM('loopnet', 'crexi', 'zillow', 'realtor', 'cityfeet', 'other');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'pending', 'sold', 'withdrawn', 'expired', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."match_confidence" AS ENUM('exact', 'high', 'medium', 'low', 'unlikely');--> statement-breakpoint
CREATE TYPE "public"."review_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."review_queue_status" AS ENUM('pending_review', 'assigned', 'in_review', 'approved', 'rejected', 'needs_more_info', 'escalated', 'completed');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('clean', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('active', 'blocked', 'escalated', 'resolved', 'force_approved', 'analyst_override', 'emergency_review', 'insufficient_data', 'emergency_error');--> statement-breakpoint
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
CREATE TABLE "api_data_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"data_field" varchar NOT NULL,
	"data_value" text,
	"primary_source" varchar,
	"backup_sources" jsonb,
	"source_confidence" numeric(5, 2),
	"is_estimated" boolean DEFAULT false,
	"is_mock_data" boolean DEFAULT false,
	"is_user_provided" boolean DEFAULT false,
	"validation_status" varchar,
	"source_metadata" jsonb,
	"retrieved_at" timestamp,
	"last_validated_at" timestamp,
	"accuracy_score" numeric(5, 2),
	"freshness_score" numeric(5, 2),
	"reliability_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_health_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_name" varchar NOT NULL,
	"endpoint" varchar,
	"operation_type" varchar,
	"request_id" varchar,
	"request_data" jsonb,
	"success" boolean NOT NULL,
	"response_time_ms" integer,
	"http_status_code" integer,
	"error_type" varchar,
	"error_message" text,
	"error_details" jsonb,
	"data_received" boolean DEFAULT false,
	"confidence_score" numeric(5, 2),
	"data_completeness" numeric(5, 2),
	"circuit_breaker_state" varchar,
	"retry_attempt" integer DEFAULT 0,
	"deal_id" varchar,
	"user_id" varchar,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_performance_summary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"hour" integer,
	"api_name" varchar NOT NULL,
	"total_requests" integer DEFAULT 0,
	"successful_requests" integer DEFAULT 0,
	"failed_requests" integer DEFAULT 0,
	"success_rate" numeric(5, 2),
	"avg_response_time" numeric(8, 2),
	"min_response_time" integer,
	"max_response_time" integer,
	"p95_response_time" integer,
	"timeout_errors" integer DEFAULT 0,
	"rate_limit_errors" integer DEFAULT 0,
	"authentication_errors" integer DEFAULT 0,
	"server_errors" integer DEFAULT 0,
	"network_errors" integer DEFAULT 0,
	"avg_confidence_score" numeric(5, 2),
	"avg_data_completeness" numeric(5, 2),
	"mock_data_usage" integer DEFAULT 0,
	"health_score" numeric(5, 2),
	"is_healthy" boolean DEFAULT true,
	"circuit_breaker_tripped" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_color" varchar DEFAULT '#0A2B4A',
	"secondary_color" varchar DEFAULT '#4A90E2',
	"accent_color" varchar DEFAULT '#0070F3',
	"background_color" varchar DEFAULT '#FFFFFF',
	"text_color" varchar DEFAULT '#333333',
	"primary_font" varchar DEFAULT 'Inter',
	"heading_font" varchar DEFAULT 'Inter',
	"font_size_base" varchar DEFAULT '16px',
	"border_radius" varchar DEFAULT '0.5rem',
	"spacing" varchar DEFAULT '1rem',
	"button_style" varchar DEFAULT 'modern',
	"button_hover_effect" varchar DEFAULT 'scale',
	"custom_css" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"email" varchar,
	"phone" varchar,
	"markets_covered" text,
	"brokerage" varchar,
	"years_experience" varchar,
	"is_active" boolean DEFAULT true,
	"preferred_contact" varchar DEFAULT 'email',
	"sms_opt_in" boolean DEFAULT false,
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
CREATE TABLE "business_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_templates" jsonb DEFAULT '[]' NOT NULL,
	"sms_templates" jsonb DEFAULT '[]' NOT NULL,
	"primary_color" varchar DEFAULT '#0A2B4A' NOT NULL,
	"secondary_color" varchar DEFAULT '#4A90E2' NOT NULL,
	"background_color" varchar DEFAULT '#FFFFFF' NOT NULL,
	"text_color" varchar DEFAULT '#333333' NOT NULL,
	"font_family" varchar DEFAULT 'Inter, sans-serif' NOT NULL,
	"font_size" varchar DEFAULT '16px' NOT NULL,
	"logo_url" varchar,
	"company_name" varchar DEFAULT 'LandLinq' NOT NULL,
	"support_email" varchar DEFAULT 'deals@landlinq.ai' NOT NULL,
	"support_phone" varchar DEFAULT '(704) 610-1549' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"broker_id" varchar,
	"related_deal_id" varchar,
	"email" varchar,
	"phone" varchar,
	"channel" varchar NOT NULL,
	"direction" varchar NOT NULL,
	"raw_text" text NOT NULL,
	"parsed_json" jsonb,
	"missing_fields" text[],
	"status" varchar DEFAULT 'pending_followup',
	"follow_up_count" integer DEFAULT 0,
	"last_follow_up_at" timestamp,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_fields" jsonb,
	"provider_message_id" varchar,
	"thread_key" varchar,
	"subject" varchar,
	"message" text,
	"recipient_email" varchar,
	"sent_at" timestamp DEFAULT now(),
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_quality_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"deal_id" varchar,
	"source_name" varchar,
	"message" text NOT NULL,
	"confidence_score" numeric(5, 2),
	"is_resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_quality_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"total_validations" integer DEFAULT 0,
	"high_confidence_count" integer DEFAULT 0,
	"medium_confidence_count" integer DEFAULT 0,
	"low_confidence_count" integer DEFAULT 0,
	"average_confidence_score" numeric(5, 2),
	"average_quality_score" numeric(5, 2),
	"total_discrepancies" integer DEFAULT 0,
	"sources_used_count" integer DEFAULT 0,
	"address_validation_rate" numeric(5, 2),
	"demographic_validation_rate" numeric(5, 2),
	"property_validation_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_quality_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp NOT NULL,
	"overall_health_score" numeric(5, 2),
	"active_alerts_count" integer DEFAULT 0,
	"recent_validations_count" integer DEFAULT 0,
	"average_recent_confidence" numeric(5, 2),
	"service_health_scores" jsonb,
	"trending_issues" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_source_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" varchar NOT NULL,
	"date" date NOT NULL,
	"total_requests" integer DEFAULT 0,
	"successful_requests" integer DEFAULT 0,
	"failed_requests" integer DEFAULT 0,
	"average_response_time" numeric(8, 2),
	"success_rate" numeric(5, 2),
	"average_confidence_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "deal_validation_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"validation_type" varchar NOT NULL,
	"overall_confidence" numeric(5, 2),
	"quality_score" numeric(5, 2),
	"sources_used" jsonb,
	"discrepancies" jsonb,
	"address_confidence" numeric(5, 2),
	"size_confidence" numeric(5, 2),
	"valuation_confidence" numeric(5, 2),
	"demographics_confidence" numeric(5, 2),
	"validation_duration" integer,
	"is_successful" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "deals_deal_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"broker_id" varchar NOT NULL,
	"broker_phone" varchar,
	"team_member_emails" jsonb,
	"tagged_emails" jsonb,
	"tagged_linkedin" jsonb,
	"address" text NOT NULL,
	"user_asking_price" numeric(12, 2),
	"user_size_acres" numeric(8, 2),
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
	"estimated_units" integer,
	"estimated_rent_psf" numeric(8, 2),
	"estimated_annual_gross_rent" numeric(12, 2),
	"population_55_plus_5_mile" integer,
	"income_75_plus_55_plus" integer,
	"demographics_notes" text,
	"assigned_analyst" varchar,
	"assigned_developer" varchar,
	"assigned_partner" varchar,
	"next_steps" text,
	"additional_notes" text,
	"status" "deal_status" DEFAULT 'pending_review',
	"classification" "deal_classification",
	"suggested_development_type" varchar,
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
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"flagged" boolean DEFAULT false,
	"risk_level" "risk_level" DEFAULT 'clean',
	"confidence_score" numeric(5, 2),
	"data_quality_issues" jsonb,
	"validation_flags" jsonb,
	"source_conflicts" jsonb,
	"flagged_at" timestamp,
	"flagged_by" varchar,
	"flagging_reason" text,
	"specific_warnings" jsonb,
	"estimated_review_time" integer,
	"last_validation_at" timestamp,
	"validation_history" jsonb,
	"analyst_review_status" varchar DEFAULT 'pending',
	"review_started_at" timestamp,
	"review_completed_at" timestamp,
	"review_notes" text,
	"data_corrections" jsonb,
	"public_listings" jsonb,
	"validation_status" "validation_status" DEFAULT 'active',
	"blocked_at" timestamp,
	"blocked_by" varchar,
	"validation_timeout_at" timestamp,
	"escalated_at" timestamp,
	"analyst_override" boolean DEFAULT false,
	"blocking_reason" text,
	"analyst_override_by" varchar,
	"analyst_override_at" timestamp,
	"analyst_override_reason" text,
	"force_approved" boolean DEFAULT false,
	"escalated" boolean DEFAULT false,
	"emergency_review_flag" boolean DEFAULT false,
	"emergency_triggered_at" timestamp,
	"emergency_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emergency_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"triggered_at" timestamp DEFAULT now(),
	"triggered_by" varchar NOT NULL,
	"affected_services" jsonb,
	"reason" text,
	"status" varchar DEFAULT 'active',
	"deals_pending" integer DEFAULT 0,
	"estimated_resolution" timestamp,
	"resolved_at" timestamp,
	"resolved_by" varchar,
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
CREATE TABLE "public_listing_matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"public_listing_id" varchar NOT NULL,
	"match_confidence" "match_confidence" NOT NULL,
	"match_score" numeric(5, 2),
	"address_match" boolean DEFAULT false,
	"size_match" boolean DEFAULT false,
	"price_match" boolean DEFAULT false,
	"type_match" boolean DEFAULT false,
	"units_match" boolean DEFAULT false,
	"deal_price" numeric(12, 2),
	"listing_price" numeric(12, 2),
	"price_difference_amount" numeric(12, 2),
	"price_difference_percent" numeric(5, 2),
	"price_comparison" varchar,
	"is_widely_marketed" boolean DEFAULT false,
	"marketing_channels" jsonb,
	"days_on_market_when_matched" integer,
	"same_listing_broker" boolean DEFAULT false,
	"broker_conflict_flag" boolean DEFAULT false,
	"is_likely_duplicate" boolean DEFAULT false,
	"is_price_discrepancy" boolean DEFAULT false,
	"requires_analyst_review" boolean DEFAULT false,
	"matching_algorithm" varchar,
	"algorithm_version" varchar,
	"analyst_reviewed" boolean DEFAULT false,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"analyst_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public_listing_searches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"search_address" text NOT NULL,
	"search_radius" numeric(5, 2),
	"sources_searched" jsonb NOT NULL,
	"successful_sources" jsonb,
	"failed_sources" jsonb,
	"total_listings_found" integer DEFAULT 0,
	"exact_matches" integer DEFAULT 0,
	"high_confidence_matches" integer DEFAULT 0,
	"medium_confidence_matches" integer DEFAULT 0,
	"low_confidence_matches" integer DEFAULT 0,
	"search_started_at" timestamp DEFAULT now(),
	"search_completed_at" timestamp,
	"total_search_time_ms" integer,
	"cache_expires_at" timestamp,
	"is_cached" boolean DEFAULT true,
	"search_success" boolean DEFAULT false,
	"error_messages" jsonb,
	"search_confidence" numeric(5, 2),
	"triggered_by" varchar,
	"triggered_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public_listing_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" "listing_source" NOT NULL,
	"source_url" varchar,
	"total_searches" integer DEFAULT 0,
	"successful_searches" integer DEFAULT 0,
	"failed_searches" integer DEFAULT 0,
	"success_rate" numeric(5, 2),
	"average_response_time_ms" integer,
	"last_response_time_ms" integer,
	"average_data_quality" numeric(5, 2),
	"average_result_count" numeric(5, 2),
	"last_successful_search" timestamp,
	"last_failed_search" timestamp,
	"consecutive_failures" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"rate_limit_hits" integer DEFAULT 0,
	"blocked_until" timestamp,
	"search_timeout_ms" integer DEFAULT 30000,
	"max_retries" integer DEFAULT 3,
	"priority_level" integer DEFAULT 5,
	"last_error_message" text,
	"error_patterns" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "listing_source" NOT NULL,
	"source_listing_id" varchar,
	"source_url" text,
	"address" text NOT NULL,
	"standardized_address" text,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"county" varchar,
	"property_type" varchar,
	"size_acres" numeric(8, 2),
	"square_footage" integer,
	"unit_count" integer,
	"lot_size" integer,
	"listing_price" numeric(12, 2),
	"price_per_unit" numeric(10, 2),
	"price_per_acre" numeric(10, 2),
	"price_per_sq_ft" numeric(8, 2),
	"listing_date" timestamp,
	"days_on_market" integer,
	"status" "listing_status" DEFAULT 'active',
	"description" text,
	"zoning" varchar,
	"year_built" integer,
	"has_utilities" boolean,
	"has_entitlements" boolean,
	"cap_rate" numeric(5, 3),
	"noi" numeric(12, 2),
	"average_rent" numeric(8, 2),
	"listing_broker" varchar,
	"broker_company" varchar,
	"broker_phone" varchar,
	"broker_email" varchar,
	"last_scraped_at" timestamp DEFAULT now(),
	"scraping_source" varchar,
	"scraping_confidence" numeric(5, 2),
	"image_urls" jsonb,
	"document_urls" jsonb,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"data_quality" numeric(5, 2),
	"is_verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "review_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_queue_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"action_type" varchar NOT NULL,
	"analyst_id" varchar NOT NULL,
	"analyst_name" varchar NOT NULL,
	"field_name" varchar,
	"old_value" text,
	"new_value" text,
	"correction_source" varchar,
	"confidence_override" numeric(5, 2),
	"notes" text,
	"reasoning" text,
	"time_spent_minutes" integer,
	"difficulty_rating" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_queue_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"analyst_id" varchar NOT NULL,
	"analyst_email" varchar NOT NULL,
	"assigned_by" varchar,
	"assignment_method" varchar DEFAULT 'manual',
	"estimated_time_minutes" integer DEFAULT 30,
	"actual_time_minutes" integer,
	"status" "review_queue_status" DEFAULT 'assigned',
	"accepted_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_corrections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_queue_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"field_path" varchar NOT NULL,
	"field_display_name" varchar NOT NULL,
	"original_value" text,
	"corrected_value" text NOT NULL,
	"original_confidence" numeric(5, 2),
	"new_confidence" numeric(5, 2),
	"original_sources" jsonb,
	"correction_source" varchar NOT NULL,
	"correction_method" varchar,
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"verification_method" varchar,
	"impacts_classification" boolean DEFAULT false,
	"previous_classification" varchar,
	"new_classification" varchar,
	"analyst_id" varchar NOT NULL,
	"analyst_notes" text,
	"review_level" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"applied_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "review_escalations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_queue_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"escalated_by" varchar NOT NULL,
	"escalated_to" varchar NOT NULL,
	"escalation_level" integer DEFAULT 1,
	"escalation_reason" varchar NOT NULL,
	"description" text NOT NULL,
	"original_decision" text,
	"status" varchar DEFAULT 'pending',
	"resolved_by" varchar,
	"resolution" text,
	"final_decision" text,
	"escalated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"target_resolution_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_type" varchar NOT NULL,
	"pattern_name" varchar NOT NULL,
	"description" text,
	"occurrence_count" integer DEFAULT 1,
	"affected_deals" jsonb,
	"affected_sources" jsonb,
	"affected_fields" jsonb,
	"geographic_pattern" jsonb,
	"time_pattern" jsonb,
	"average_impact_on_confidence" numeric(5, 2),
	"resolution_rate" numeric(5, 2),
	"average_resolution_time_minutes" integer,
	"suggested_improvements" jsonb,
	"automation_opportunity" boolean DEFAULT false,
	"automation_description" text,
	"is_active" boolean DEFAULT true,
	"last_occurrence" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"overall_confidence" numeric(5, 2),
	"trigger_reason" varchar NOT NULL,
	"specific_issues" jsonb,
	"address_confidence" numeric(5, 2),
	"size_confidence" numeric(5, 2),
	"valuation_confidence" numeric(5, 2),
	"demographics_confidence" numeric(5, 2),
	"rent_data_confidence" numeric(5, 2),
	"priority" "review_priority" DEFAULT 'medium',
	"status" "review_queue_status" DEFAULT 'pending_review',
	"source_data_snapshot" jsonb,
	"discrepancies" jsonb,
	"sources_used" jsonb,
	"assigned_analyst" varchar,
	"assigned_at" timestamp,
	"flagged_at" timestamp DEFAULT now(),
	"review_started_at" timestamp,
	"review_completed_at" timestamp,
	"target_completion_date" timestamp,
	"resolution" varchar,
	"analyst_notes" text,
	"escalation_reason" text,
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
ALTER TABLE "api_data_sources" ADD CONSTRAINT "api_data_sources_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_health_metrics" ADD CONSTRAINT "api_health_metrics_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_health_metrics" ADD CONSTRAINT "api_health_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD CONSTRAINT "brand_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "communications" ADD CONSTRAINT "communications_related_deal_id_deals_id_fk" FOREIGN KEY ("related_deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_alerts" ADD CONSTRAINT "data_quality_alerts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_tagger_broker_id_brokers_id_fk" FOREIGN KEY ("tagger_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_signed_up_user_id_users_id_fk" FOREIGN KEY ("signed_up_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_validation_history" ADD CONSTRAINT "deal_validation_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "public_listing_matches" ADD CONSTRAINT "public_listing_matches_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_listing_matches" ADD CONSTRAINT "public_listing_matches_public_listing_id_public_listings_id_fk" FOREIGN KEY ("public_listing_id") REFERENCES "public"."public_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_listing_matches" ADD CONSTRAINT "public_listing_matches_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_listing_searches" ADD CONSTRAINT "public_listing_searches_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_listing_searches" ADD CONSTRAINT "public_listing_searches_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referral_link_id_referral_links_id_fk" FOREIGN KEY ("referral_link_id") REFERENCES "public"."referral_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referrer_broker_id_brokers_id_fk" FOREIGN KEY ("referrer_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_referred_broker_id_brokers_id_fk" FOREIGN KEY ("referred_broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_activities" ADD CONSTRAINT "referral_activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_metrics" ADD CONSTRAINT "referral_metrics_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_review_queue_id_review_queue_id_fk" FOREIGN KEY ("review_queue_id") REFERENCES "public"."review_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_analyst_id_users_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_review_queue_id_review_queue_id_fk" FOREIGN KEY ("review_queue_id") REFERENCES "public"."review_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_analyst_id_users_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_corrections" ADD CONSTRAINT "review_corrections_review_queue_id_review_queue_id_fk" FOREIGN KEY ("review_queue_id") REFERENCES "public"."review_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_corrections" ADD CONSTRAINT "review_corrections_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_corrections" ADD CONSTRAINT "review_corrections_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_corrections" ADD CONSTRAINT "review_corrections_analyst_id_users_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_escalations" ADD CONSTRAINT "review_escalations_review_queue_id_review_queue_id_fk" FOREIGN KEY ("review_queue_id") REFERENCES "public"."review_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_escalations" ADD CONSTRAINT "review_escalations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_escalations" ADD CONSTRAINT "review_escalations_escalated_by_users_id_fk" FOREIGN KEY ("escalated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_escalations" ADD CONSTRAINT "review_escalations_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_escalations" ADD CONSTRAINT "review_escalations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_assigned_analyst_users_id_fk" FOREIGN KEY ("assigned_analyst") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "api_data_sources_deal_idx" ON "api_data_sources" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "api_data_sources_field_idx" ON "api_data_sources" USING btree ("data_field");--> statement-breakpoint
CREATE INDEX "api_data_sources_primary_idx" ON "api_data_sources" USING btree ("primary_source");--> statement-breakpoint
CREATE INDEX "api_data_sources_mock_idx" ON "api_data_sources" USING btree ("is_mock_data");--> statement-breakpoint
CREATE INDEX "api_data_sources_confidence_idx" ON "api_data_sources" USING btree ("source_confidence");--> statement-breakpoint
CREATE INDEX "api_health_metrics_api_idx" ON "api_health_metrics" USING btree ("api_name");--> statement-breakpoint
CREATE INDEX "api_health_metrics_timestamp_idx" ON "api_health_metrics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "api_health_metrics_success_idx" ON "api_health_metrics" USING btree ("success");--> statement-breakpoint
CREATE INDEX "api_health_metrics_deal_idx" ON "api_health_metrics" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "api_health_metrics_response_time_idx" ON "api_health_metrics" USING btree ("response_time_ms");--> statement-breakpoint
CREATE INDEX "api_performance_summary_date_idx" ON "api_performance_summary" USING btree ("date");--> statement-breakpoint
CREATE INDEX "api_performance_summary_api_idx" ON "api_performance_summary" USING btree ("api_name");--> statement-breakpoint
CREATE INDEX "api_performance_summary_health_idx" ON "api_performance_summary" USING btree ("health_score");--> statement-breakpoint
CREATE INDEX "api_performance_summary_success_rate_idx" ON "api_performance_summary" USING btree ("success_rate");--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_broker_a" ON "broker_partnerships" USING btree ("broker_a_id");--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_broker_b" ON "broker_partnerships" USING btree ("broker_b_id");--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_type" ON "broker_partnerships" USING btree ("partnership_type");--> statement-breakpoint
CREATE INDEX "idx_broker_partnerships_status" ON "broker_partnerships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_deal_id" ON "commission_splits" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_primary_broker" ON "commission_splits" USING btree ("primary_broker_id");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_referrer" ON "commission_splits" USING btree ("referrer_broker_id");--> statement-breakpoint
CREATE INDEX "idx_commission_splits_status" ON "commission_splits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_quality_alerts_type_idx" ON "data_quality_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "data_quality_alerts_severity_idx" ON "data_quality_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "data_quality_alerts_created_idx" ON "data_quality_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "data_quality_alerts_unresolved_idx" ON "data_quality_alerts" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "data_quality_metrics_date_idx" ON "data_quality_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "data_quality_snapshots_timestamp_idx" ON "data_quality_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "data_source_metrics_date_idx" ON "data_source_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "data_source_metrics_source_date_idx" ON "data_source_metrics" USING btree ("source_name","date");--> statement-breakpoint
CREATE INDEX "deal_validation_history_deal_idx" ON "deal_validation_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_validation_history_created_idx" ON "deal_validation_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deal_validation_history_confidence_idx" ON "deal_validation_history" USING btree ("overall_confidence");--> statement-breakpoint
CREATE INDEX "public_listing_matches_deal_idx" ON "public_listing_matches" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "public_listing_matches_listing_idx" ON "public_listing_matches" USING btree ("public_listing_id");--> statement-breakpoint
CREATE INDEX "public_listing_matches_confidence_idx" ON "public_listing_matches" USING btree ("match_confidence");--> statement-breakpoint
CREATE INDEX "public_listing_matches_score_idx" ON "public_listing_matches" USING btree ("match_score");--> statement-breakpoint
CREATE INDEX "public_listing_matches_duplicate_idx" ON "public_listing_matches" USING btree ("is_likely_duplicate");--> statement-breakpoint
CREATE INDEX "public_listing_matches_review_idx" ON "public_listing_matches" USING btree ("requires_analyst_review");--> statement-breakpoint
CREATE INDEX "public_listing_matches_analyst_reviewed_idx" ON "public_listing_matches" USING btree ("analyst_reviewed");--> statement-breakpoint
CREATE INDEX "public_listing_searches_deal_idx" ON "public_listing_searches" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "public_listing_searches_address_idx" ON "public_listing_searches" USING btree ("search_address");--> statement-breakpoint
CREATE INDEX "public_listing_searches_completed_idx" ON "public_listing_searches" USING btree ("search_completed_at");--> statement-breakpoint
CREATE INDEX "public_listing_searches_cache_idx" ON "public_listing_searches" USING btree ("cache_expires_at");--> statement-breakpoint
CREATE INDEX "public_listing_searches_success_idx" ON "public_listing_searches" USING btree ("search_success");--> statement-breakpoint
CREATE INDEX "public_listing_sources_name_idx" ON "public_listing_sources" USING btree ("source_name");--> statement-breakpoint
CREATE INDEX "public_listing_sources_active_idx" ON "public_listing_sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "public_listing_sources_success_rate_idx" ON "public_listing_sources" USING btree ("success_rate");--> statement-breakpoint
CREATE INDEX "public_listing_sources_priority_idx" ON "public_listing_sources" USING btree ("priority_level");--> statement-breakpoint
CREATE INDEX "public_listing_sources_last_success_idx" ON "public_listing_sources" USING btree ("last_successful_search");--> statement-breakpoint
CREATE INDEX "public_listings_source_idx" ON "public_listings" USING btree ("source");--> statement-breakpoint
CREATE INDEX "public_listings_address_idx" ON "public_listings" USING btree ("address");--> statement-breakpoint
CREATE INDEX "public_listings_standardized_address_idx" ON "public_listings" USING btree ("standardized_address");--> statement-breakpoint
CREATE INDEX "public_listings_city_state_idx" ON "public_listings" USING btree ("city","state");--> statement-breakpoint
CREATE INDEX "public_listings_zip_idx" ON "public_listings" USING btree ("zip_code");--> statement-breakpoint
CREATE INDEX "public_listings_price_idx" ON "public_listings" USING btree ("listing_price");--> statement-breakpoint
CREATE INDEX "public_listings_property_type_idx" ON "public_listings" USING btree ("property_type");--> statement-breakpoint
CREATE INDEX "public_listings_status_idx" ON "public_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "public_listings_listing_date_idx" ON "public_listings" USING btree ("listing_date");--> statement-breakpoint
CREATE INDEX "public_listings_scraped_idx" ON "public_listings" USING btree ("last_scraped_at");--> statement-breakpoint
CREATE INDEX "public_listings_location_idx" ON "public_listings" USING btree ("latitude","longitude");--> statement-breakpoint
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
CREATE INDEX "review_actions_queue_idx" ON "review_actions" USING btree ("review_queue_id");--> statement-breakpoint
CREATE INDEX "review_actions_deal_idx" ON "review_actions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "review_actions_analyst_idx" ON "review_actions" USING btree ("analyst_id");--> statement-breakpoint
CREATE INDEX "review_actions_type_idx" ON "review_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "review_actions_created_idx" ON "review_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "review_assignments_queue_idx" ON "review_assignments" USING btree ("review_queue_id");--> statement-breakpoint
CREATE INDEX "review_assignments_analyst_idx" ON "review_assignments" USING btree ("analyst_id");--> statement-breakpoint
CREATE INDEX "review_assignments_status_idx" ON "review_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_corrections_queue_idx" ON "review_corrections" USING btree ("review_queue_id");--> statement-breakpoint
CREATE INDEX "review_corrections_deal_idx" ON "review_corrections" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "review_corrections_field_idx" ON "review_corrections" USING btree ("field_path");--> statement-breakpoint
CREATE INDEX "review_corrections_analyst_idx" ON "review_corrections" USING btree ("analyst_id");--> statement-breakpoint
CREATE INDEX "review_corrections_applied_idx" ON "review_corrections" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "review_escalations_queue_idx" ON "review_escalations" USING btree ("review_queue_id");--> statement-breakpoint
CREATE INDEX "review_escalations_status_idx" ON "review_escalations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_escalations_level_idx" ON "review_escalations" USING btree ("escalation_level");--> statement-breakpoint
CREATE INDEX "review_patterns_type_idx" ON "review_patterns" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "review_patterns_active_idx" ON "review_patterns" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "review_patterns_occurrence_idx" ON "review_patterns" USING btree ("last_occurrence");--> statement-breakpoint
CREATE INDEX "review_queue_deal_idx" ON "review_queue" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "review_queue_status_idx" ON "review_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_queue_priority_idx" ON "review_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "review_queue_analyst_idx" ON "review_queue" USING btree ("assigned_analyst");--> statement-breakpoint
CREATE INDEX "review_queue_confidence_idx" ON "review_queue" USING btree ("overall_confidence");--> statement-breakpoint
CREATE INDEX "review_queue_flagged_idx" ON "review_queue" USING btree ("flagged_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");