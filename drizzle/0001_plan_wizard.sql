ALTER TABLE "fitness_plans" ADD COLUMN "focus" jsonb;--> statement-breakpoint
ALTER TABLE "fitness_plans" ADD COLUMN "weekly_mix" jsonb;--> statement-breakpoint
ALTER TABLE "fitness_plans" ADD COLUMN "split_type" text;--> statement-breakpoint
ALTER TABLE "fitness_plans" ADD COLUMN "progressive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fitness_plans" ADD COLUMN "duration_weeks" integer;--> statement-breakpoint
ALTER TABLE "fitness_plans" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_day_exercises" ADD COLUMN "target_rest_seconds" integer;--> statement-breakpoint
ALTER TABLE "plan_day_exercises" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "week_number" integer;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "day_of_week" integer;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "scheduled_date" timestamp;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "day_type" text;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "notes" text;