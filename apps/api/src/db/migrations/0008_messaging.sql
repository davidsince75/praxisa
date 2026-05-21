-- Migration 0008: messaging tables
--> statement-breakpoint
CREATE TABLE "message_threads" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "participant_a" UUID        NOT NULL REFERENCES "users"("id"),
  "participant_b" UUID        NOT NULL REFERENCES "users"("id"),
  "course_id"     UUID        REFERENCES "courses"("id"),
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "thread_id"  UUID        NOT NULL REFERENCES "message_threads"("id"),
  "sender_id"  UUID        NOT NULL REFERENCES "users"("id"),
  "body"       TEXT        NOT NULL,
  "read_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_message_threads_participant_a" ON "message_threads"("participant_a");
--> statement-breakpoint
CREATE INDEX "idx_message_threads_participant_b" ON "message_threads"("participant_b");
--> statement-breakpoint
CREATE INDEX "idx_messages_thread_id" ON "messages"("thread_id");
--> statement-breakpoint
CREATE INDEX "idx_messages_sender_id" ON "messages"("sender_id");
