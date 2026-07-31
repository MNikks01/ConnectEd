-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'SCHOOL');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'PARENT', 'TEACHER', 'PRINCIPAL', 'USER');

-- CreateEnum
CREATE TYPE "Medium" AS ENUM ('ENGLISH', 'HINDI');

-- CreateEnum
CREATE TYPE "ClassLevel" AS ENUM ('PRE_NURSERY', 'NURSERY', 'KG1', 'KG2', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5', 'CLASS_6', 'CLASS_7', 'CLASS_8', 'CLASS_9', 'CLASS_10', 'CLASS_11', 'CLASS_12');

-- CreateEnum
CREATE TYPE "Section" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AcademicItemType" AS ENUM ('HOMEWORK', 'ASSIGNMENT', 'PROJECT');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveKind" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('COMPLAINT', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ReadReceiptSubject" AS ENUM ('NOTICE', 'ACADEMIC_ITEM', 'EVENT', 'TIMETABLE');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ACADEMIC', 'NOTICE', 'EVENT', 'LEAVE', 'SOCIAL', 'MESSAGE', 'VERIFICATION', 'BILLING');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "type" "AccountType" NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential" (
    "account_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "algo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credential_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "account_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "mobile" TEXT,
    "gender" TEXT,
    "dob" DATE,
    "bio" TEXT,
    "display_pic_key" TEXT,
    "achievements" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "school_profile" (
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "admin_name" TEXT,
    "phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "about" TEXT,
    "mission" TEXT,
    "vision" TEXT,
    "facilities" TEXT,
    "establishment_year" INTEGER,
    "affiliation" TEXT,
    "display_pic_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_profile_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "class" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "medium" "Medium" NOT NULL,
    "level" "ClassLevel" NOT NULL,
    "section" "Section" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profile" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_allocation" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_teacher" (
    "class_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_teacher_pkey" PRIMARY KEY ("class_id")
);

-- CreateTable
CREATE TABLE "child" (
    "id" UUID NOT NULL,
    "parent_account_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "school_id" UUID,
    "class_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_request" (
    "id" UUID NOT NULL,
    "requester_account_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "class_id" UUID,
    "child_id" UUID,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "class_id" UUID,
    "child_id" UUID,
    "scope_key" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_item" (
    "id" UUID NOT NULL,
    "type" "AcademicItemType" NOT NULL,
    "class_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "author_account_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_key" TEXT,
    "due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "academic_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "author_account_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "event_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "image_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_progress" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "read_receipt" (
    "id" UUID NOT NULL,
    "subject_type" "ReadReceiptSubject" NOT NULL,
    "subject_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "read_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_application" (
    "id" UUID NOT NULL,
    "kind" "LeaveKind" NOT NULL,
    "applicant_account_id" UUID NOT NULL,
    "child_id" UUID,
    "class_id" UUID,
    "school_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'RECEIVED',
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "author_account_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" UUID NOT NULL,
    "author_account_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "image_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_like" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comment" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "post_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow" (
    "id" UUID NOT NULL,
    "follower_account_id" UUID NOT NULL,
    "followee_account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection" (
    "id" UUID NOT NULL,
    "a_account_id" UUID NOT NULL,
    "b_account_id" UUID NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_thread" (
    "id" UUID NOT NULL,
    "participant_a" UUID NOT NULL,
    "participant_b" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "sender_account_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "recipient_account_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_pref" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_token" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limits" JSONB,
    "features" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_account_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_email_key" ON "account"("email");

-- CreateIndex
CREATE INDEX "account_type_idx" ON "account"("type");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_account_id_idx" ON "refresh_token"("account_id");

-- CreateIndex
CREATE INDEX "refresh_token_family_id_idx" ON "refresh_token"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_handle_key" ON "user_profile"("handle");

-- CreateIndex
CREATE INDEX "user_profile_role_idx" ON "user_profile"("role");

-- CreateIndex
CREATE INDEX "school_profile_name_idx" ON "school_profile"("name");

-- CreateIndex
CREATE INDEX "class_school_id_idx" ON "class"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_school_id_medium_level_section_key" ON "class"("school_id", "medium", "level", "section");

-- CreateIndex
CREATE INDEX "subject_class_id_idx" ON "subject"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_class_id_name_key" ON "subject"("class_id", "name");

-- CreateIndex
CREATE INDEX "teacher_profile_school_id_idx" ON "teacher_profile"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profile_account_id_school_id_key" ON "teacher_profile"("account_id", "school_id");

-- CreateIndex
CREATE INDEX "subject_allocation_subject_id_idx" ON "subject_allocation"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_allocation_teacher_id_subject_id_key" ON "subject_allocation"("teacher_id", "subject_id");

-- CreateIndex
CREATE INDEX "class_teacher_teacher_id_idx" ON "class_teacher"("teacher_id");

-- CreateIndex
CREATE INDEX "child_parent_account_id_idx" ON "child"("parent_account_id");

-- CreateIndex
CREATE INDEX "child_class_id_idx" ON "child"("class_id");

-- CreateIndex
CREATE INDEX "verification_request_requester_account_id_idx" ON "verification_request"("requester_account_id");

-- CreateIndex
CREATE INDEX "verification_request_school_id_status_idx" ON "verification_request"("school_id", "status");

-- CreateIndex
CREATE INDEX "membership_account_id_status_idx" ON "membership"("account_id", "status");

-- CreateIndex
CREATE INDEX "membership_class_id_status_idx" ON "membership"("class_id", "status");

-- CreateIndex
CREATE INDEX "membership_school_id_idx" ON "membership"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_account_id_school_id_role_scope_key_key" ON "membership"("account_id", "school_id", "role", "scope_key");

-- CreateIndex
CREATE INDEX "academic_item_class_id_created_at_idx" ON "academic_item"("class_id", "created_at");

-- CreateIndex
CREATE INDEX "academic_item_subject_id_idx" ON "academic_item"("subject_id");

-- CreateIndex
CREATE INDEX "academic_item_author_account_id_idx" ON "academic_item"("author_account_id");

-- CreateIndex
CREATE INDEX "notice_school_id_created_at_idx" ON "notice"("school_id", "created_at");

-- CreateIndex
CREATE INDEX "notice_author_account_id_idx" ON "notice"("author_account_id");

-- CreateIndex
CREATE INDEX "event_school_id_event_at_idx" ON "event"("school_id", "event_at");

-- CreateIndex
CREATE INDEX "timetable_class_id_idx" ON "timetable"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_class_id_version_key" ON "timetable"("class_id", "version");

-- CreateIndex
CREATE INDEX "syllabus_progress_subject_id_idx" ON "syllabus_progress"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_progress_subject_id_topic_key" ON "syllabus_progress"("subject_id", "topic");

-- CreateIndex
CREATE INDEX "read_receipt_account_id_idx" ON "read_receipt"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "read_receipt_subject_type_subject_id_account_id_key" ON "read_receipt"("subject_type", "subject_id", "account_id");

-- CreateIndex
CREATE INDEX "leave_application_applicant_account_id_idx" ON "leave_application"("applicant_account_id");

-- CreateIndex
CREATE INDEX "leave_application_class_id_status_idx" ON "leave_application"("class_id", "status");

-- CreateIndex
CREATE INDEX "leave_application_school_id_status_idx" ON "leave_application"("school_id", "status");

-- CreateIndex
CREATE INDEX "feedback_author_account_id_idx" ON "feedback"("author_account_id");

-- CreateIndex
CREATE INDEX "feedback_school_id_status_idx" ON "feedback"("school_id", "status");

-- CreateIndex
CREATE INDEX "post_author_account_id_created_at_idx" ON "post"("author_account_id", "created_at");

-- CreateIndex
CREATE INDEX "post_like_account_id_idx" ON "post_like"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_like_post_id_account_id_key" ON "post_like"("post_id", "account_id");

-- CreateIndex
CREATE INDEX "post_comment_post_id_created_at_idx" ON "post_comment"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "post_comment_account_id_idx" ON "post_comment"("account_id");

-- CreateIndex
CREATE INDEX "follow_followee_account_id_idx" ON "follow"("followee_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_follower_account_id_followee_account_id_key" ON "follow"("follower_account_id", "followee_account_id");

-- CreateIndex
CREATE INDEX "connection_b_account_id_status_idx" ON "connection"("b_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connection_a_account_id_b_account_id_key" ON "connection"("a_account_id", "b_account_id");

-- CreateIndex
CREATE INDEX "message_thread_participant_b_idx" ON "message_thread"("participant_b");

-- CreateIndex
CREATE UNIQUE INDEX "message_thread_participant_a_participant_b_key" ON "message_thread"("participant_a", "participant_b");

-- CreateIndex
CREATE INDEX "message_thread_id_created_at_idx" ON "message"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "message_sender_account_id_idx" ON "message"("sender_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_event_id_key" ON "notification"("event_id");

-- CreateIndex
CREATE INDEX "notification_recipient_account_id_read_at_idx" ON "notification"("recipient_account_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_pref_account_id_category_key" ON "notification_pref"("account_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "push_token_token_key" ON "push_token"("token");

-- CreateIndex
CREATE INDEX "push_token_account_id_idx" ON "push_token"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_code_key" ON "plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_school_id_key" ON "subscription"("school_id");

-- CreateIndex
CREATE INDEX "subscription_plan_id_idx" ON "subscription"("plan_id");

-- CreateIndex
CREATE INDEX "subscription_status_idx" ON "subscription"("status");

-- CreateIndex
CREATE INDEX "audit_log_actor_account_id_idx" ON "audit_log"("actor_account_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_profile" ADD CONSTRAINT "school_profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject" ADD CONSTRAINT "subject_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_allocation" ADD CONSTRAINT "subject_allocation_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_allocation" ADD CONSTRAINT "subject_allocation_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_request" ADD CONSTRAINT "verification_request_requester_account_id_fkey" FOREIGN KEY ("requester_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_request" ADD CONSTRAINT "verification_request_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_request" ADD CONSTRAINT "verification_request_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_request" ADD CONSTRAINT "verification_request_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_item" ADD CONSTRAINT "academic_item_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_item" ADD CONSTRAINT "academic_item_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_item" ADD CONSTRAINT "academic_item_author_account_id_fkey" FOREIGN KEY ("author_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice" ADD CONSTRAINT "notice_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice" ADD CONSTRAINT "notice_author_account_id_fkey" FOREIGN KEY ("author_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable" ADD CONSTRAINT "timetable_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "read_receipt" ADD CONSTRAINT "read_receipt_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_application" ADD CONSTRAINT "leave_application_applicant_account_id_fkey" FOREIGN KEY ("applicant_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_application" ADD CONSTRAINT "leave_application_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_application" ADD CONSTRAINT "leave_application_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_application" ADD CONSTRAINT "leave_application_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_author_account_id_fkey" FOREIGN KEY ("author_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_author_account_id_fkey" FOREIGN KEY ("author_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_account_id_fkey" FOREIGN KEY ("follower_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_followee_account_id_fkey" FOREIGN KEY ("followee_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_a_account_id_fkey" FOREIGN KEY ("a_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_b_account_id_fkey" FOREIGN KEY ("b_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_thread" ADD CONSTRAINT "message_thread_participant_a_fkey" FOREIGN KEY ("participant_a") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_thread" ADD CONSTRAINT "message_thread_participant_b_fkey" FOREIGN KEY ("participant_b") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_account_id_fkey" FOREIGN KEY ("sender_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_account_id_fkey" FOREIGN KEY ("recipient_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_pref" ADD CONSTRAINT "notification_pref_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_token" ADD CONSTRAINT "push_token_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
