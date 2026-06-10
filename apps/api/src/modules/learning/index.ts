import type { FastifyInstance } from "fastify";
import { coursesRoutes } from "./courses.routes.js";
import { modulesRoutes } from "./modules.routes.js";
import { lessonsRoutes } from "./lessons.routes.js";
import { enrolmentsRoutes } from "./enrolments.routes.js";
import { progressRoutes } from "./progress.routes.js";
import { instructorRoutes } from "./instructor.routes.js";
import { quizRoutes } from "./quiz.routes.js";

/**
 * Learning domain plugin — aggregates the route groups. Each group is a plain
 * function called in the same plugin scope, so auth decorators and prefixes
 * behave exactly as before the split.
 */
export const learningPlugin = (
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
) => {
  coursesRoutes(fastify);
  modulesRoutes(fastify);
  lessonsRoutes(fastify);
  enrolmentsRoutes(fastify);
  progressRoutes(fastify);
  instructorRoutes(fastify);
  quizRoutes(fastify);
  done();
};
