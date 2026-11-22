-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('FORMAL_JOB', 'QUICK_JOB', 'TASK', 'PROJECT', 'SERVICE');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkModality" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "WorkSchedule" AS ENUM ('FULL_TIME', 'PART_TIME', 'SHIFTS', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RatedRole" AS ENUM ('WORKER', 'PUBLISHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_APPLICANT', 'APPLICATION_STATUS_CHANGED', 'SELECTION_RECEIVED', 'SELECTION_ACCEPTED', 'SELECTION_REJECTED', 'SELECTION_EXPIRED', 'OPPORTUNITY_UPDATED', 'OPPORTUNITY_CANCELLED', 'JOB_FINISH_MARKED', 'JOB_COMPLETED', 'JOB_CANCELLED', 'RATING_AVAILABLE');

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "publisher_profile_id" UUID NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "people_needed" INTEGER,
    "payment_cop" INTEGER,
    "scheduled_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "conditions" VARCHAR(1000),
    "salary_min_cop" INTEGER,
    "salary_max_cop" INTEGER,
    "modality" "WorkModality",
    "schedule" "WorkSchedule",
    "experience_required" VARCHAR(500),
    "requirements" VARCHAR(2000),
    "closes_at" TIMESTAMP(3),
    "labor_warning_codes" TEXT[],
    "labor_warning_acknowledged_at" TIMESTAMP(3),
    "exact_address" VARCHAR(300),
    "status_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_warning_rules" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_warning_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "worker_profile_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'RECEIVED',
    "message" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selections" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "status" "SelectionStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "terms_accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "selection_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "worker_profile_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "finish_marked_at" TIMESTAMP(3),
    "finish_marked_by_id" UUID,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "cancel_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "rater_user_id" UUID NOT NULL,
    "ratee_user_id" UUID NOT NULL,
    "ratee_role" "RatedRole" NOT NULL,
    "fulfillment" INTEGER NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "quality" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_summaries" (
    "user_id" UUID NOT NULL,
    "role" "RatedRole" NOT NULL,
    "ratings_count" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "avg_overall" DECIMAL(3,2),
    "avg_fulfillment" DECIMAL(3,2),
    "avg_punctuality" DECIMAL(3,2),
    "avg_communication" DECIMAL(3,2),
    "avg_quality" DECIMAL(3,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reputation_summaries_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "link" VARCHAR(300),
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "emailed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "opportunities_status_type_created_at_idx" ON "opportunities"("status", "type", "created_at");

-- CreateIndex
CREATE INDEX "opportunities_publisher_profile_id_status_idx" ON "opportunities"("publisher_profile_id", "status");

-- CreateIndex
CREATE INDEX "opportunities_category_id_idx" ON "opportunities"("category_id");

-- CreateIndex
CREATE INDEX "opportunities_zone_id_idx" ON "opportunities"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "labor_warning_rules_code_key" ON "labor_warning_rules"("code");

-- CreateIndex
CREATE INDEX "applications_worker_profile_id_status_idx" ON "applications"("worker_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_opportunity_id_worker_profile_id_key" ON "applications"("opportunity_id", "worker_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "selections_application_id_key" ON "selections"("application_id");

-- CreateIndex
CREATE INDEX "selections_status_expires_at_idx" ON "selections"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_selection_id_key" ON "jobs"("selection_id");

-- CreateIndex
CREATE INDEX "jobs_worker_profile_id_status_idx" ON "jobs"("worker_profile_id", "status");

-- CreateIndex
CREATE INDEX "jobs_opportunity_id_status_idx" ON "jobs"("opportunity_id", "status");

-- CreateIndex
CREATE INDEX "jobs_status_scheduled_at_idx" ON "jobs"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "ratings_ratee_user_id_ratee_role_published_at_idx" ON "ratings"("ratee_user_id", "ratee_role", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_job_id_rater_user_id_key" ON "ratings"("job_id", "rater_user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_publisher_profile_id_fkey" FOREIGN KEY ("publisher_profile_id") REFERENCES "publisher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_worker_profile_id_fkey" FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "selections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_worker_profile_id_fkey" FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_user_id_fkey" FOREIGN KEY ("rater_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratee_user_id_fkey" FOREIGN KEY ("ratee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_summaries" ADD CONSTRAINT "reputation_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reglas que Prisma no expresa: la base las garantiza aunque falle una validación del API.
-- RN-19: montos en COP mayores que cero.
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_payment_cop_positive" CHECK ("payment_cop" IS NULL OR "payment_cop" > 0);
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_salary_positive" CHECK (("salary_min_cop" IS NULL OR "salary_min_cop" > 0) AND ("salary_max_cop" IS NULL OR "salary_max_cop" > 0));
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_salary_range" CHECK ("salary_min_cop" IS NULL OR "salary_max_cop" IS NULL OR "salary_max_cop" >= "salary_min_cop");
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_people_needed_positive" CHECK ("people_needed" IS NULL OR "people_needed" >= 1);
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_duration_positive" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0);

-- HU-007: cada dimensión de 1 a 5, y nadie se califica a sí mismo.
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_scores_range" CHECK (
  "fulfillment" BETWEEN 1 AND 5 AND "punctuality" BETWEEN 1 AND 5 AND
  "communication" BETWEEN 1 AND 5 AND "quality" BETWEEN 1 AND 5
);
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_not_self" CHECK ("rater_user_id" <> "ratee_user_id");
