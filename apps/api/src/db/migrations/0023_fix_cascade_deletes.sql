-- Migration 0023: guarantee CASCADE deletes on learning hierarchy
-- Uses NOT VALID so existing rows are not scanned (avoids FK violation on orphaned rows).
-- Each statement is isolated by breakpoints so one failure cannot block the chain.

-- lessons.module_id -> course_modules.id
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_module_id_course_modules_id_fk;
--> statement-breakpoint
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_module_id_fkey;
--> statement-breakpoint
ALTER TABLE lessons ADD CONSTRAINT lessons_module_id_course_modules_id_fk
  FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE ON UPDATE NO ACTION
  NOT VALID;
--> statement-breakpoint

-- exercises.lesson_id -> lessons.id
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_lesson_id_lessons_id_fk;
--> statement-breakpoint
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_lesson_id_fkey;
--> statement-breakpoint
ALTER TABLE exercises ADD CONSTRAINT exercises_lesson_id_lessons_id_fk
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE NO ACTION
  NOT VALID;
--> statement-breakpoint

-- lesson_progress.lesson_id -> lessons.id
ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_lesson_id_lessons_id_fk;
--> statement-breakpoint
ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_lesson_id_fkey;
--> statement-breakpoint
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_lesson_id_lessons_id_fk
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE NO ACTION
  NOT VALID;
--> statement-breakpoint

-- lesson_progress.enrolment_id -> enrolments.id
ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_enrolment_id_enrolments_id_fk;
--> statement-breakpoint
ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_enrolment_id_fkey;
--> statement-breakpoint
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_enrolment_id_enrolments_id_fk
  FOREIGN KEY (enrolment_id) REFERENCES enrolments(id) ON DELETE CASCADE ON UPDATE NO ACTION
  NOT VALID;
--> statement-breakpoint

-- material_embeddings.lesson_id -> lessons.id
ALTER TABLE material_embeddings DROP CONSTRAINT IF EXISTS material_embeddings_lesson_id_fkey;
--> statement-breakpoint
ALTER TABLE material_embeddings DROP CONSTRAINT IF EXISTS material_embeddings_lesson_id_lessons_id_fk;
--> statement-breakpoint
ALTER TABLE material_embeddings ADD CONSTRAINT material_embeddings_lesson_id_fkey
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE NO ACTION
  NOT VALID;
--> statement-breakpoint

-- submissions.exercise_id -> exercises.id
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_exercise_id_fkey;
--> statement-breakpoint
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_exercise_id_exercises_id_fk;
--> statement-breakpoint
ALTER TABLE submissions ADD CONSTRAINT submissions_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE ON UPDATE NO ACTION
  NOT VALID;
