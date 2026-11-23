-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MODERATION_NOTICE';

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('OPPORTUNITY', 'USER');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('FRAUD', 'INAPPROPRIATE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ADMIN_LOGIN', 'ADMIN_ACCESS_DENIED', 'USER_SUSPENDED', 'USER_BLOCKED', 'USER_REACTIVATED', 'OPPORTUNITY_HIDDEN', 'OPPORTUNITY_UNHIDDEN', 'REPORT_DISMISSED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'LABOR_RULE_UPDATED', 'TERMS_ACCEPTED', 'AGREEMENT_ACCEPTED');

-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "hidden_at" TIMESTAMP(3),
ADD COLUMN     "hidden_reason" VARCHAR(500);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" VARCHAR(500),
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "target_type" VARCHAR(40),
    "target_id" VARCHAR(64),
    "reason" VARCHAR(500),
    "ip" VARCHAR(45),
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_user_id_target_type_target_id_key" ON "reports"("reporter_user_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- HU-019 CA3: el motivo "Otro" exige una descripción.
ALTER TABLE "reports" ADD CONSTRAINT "reports_other_needs_description" CHECK ("reason" <> 'OTHER' OR length(trim(coalesce("description", ''))) >= 10);

-- HU-038 CA3 / RN-25: la auditoría solo admite inserción, para cualquier rol y cualquier cliente.
CREATE FUNCTION audit_logs_solo_insercion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs solo admite inserción (HU-038)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_sin_cambios BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_solo_insercion();
CREATE TRIGGER audit_logs_sin_truncate BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_solo_insercion();
