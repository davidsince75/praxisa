-- Migration 0016: Add ON DELETE CASCADE to learning hierarchy FK constraints
-- Fixes: deleting a module with lessons (or lesson with exercises) silently fails
-- due to FK NO ACTION constraints.

-- lessons.module_id -> course_modules.id
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_module_id_course_modules_id_fk";
--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_modules_id_fk"
  FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id")
  ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint

-- exercises.lesson_id -> lessons.id
ALTER TABLE "exercises" DROP CONSTRAINT "exercises_lesson_id_lessons_id_fk";
--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id")
  ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint

-- lesson_progress.lesson_id -> lessons.id
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk";
--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id")
  ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint

-- lesson_progress.enrolment_id -> enrolments.id
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_enrolment_id_enrolments_id_fk";
--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrolment_id_enrolments_id_fk"
  FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolments"("id")
  ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint

-- submissions.exercise_id -> exercises.id (inline FK, auto-named)
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_exercise_id_fkey";
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_exercise_id_fkey"
  FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id")
  ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint

-- submissions.enrolment_id -> enrolments.id (inline FK, auto-named)
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_enrolment_id_fkey";
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_enrolment_id_fkey"
  FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolments"("id")
  ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint

-- material_embeddings.lesson_id -> lessons.id (inline FK, auto-named)
ALTER TABLE "material_embeddings" DROP CONSTRAINT "material_embeddings_lesson_id_fkey";
--> statement-breakpoint
ALTER TABLE "material_embeddings" ADD CONSTRAINT "material_embeddings_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id")
  ON DELETE CASCADE ON UPDATE no action;
