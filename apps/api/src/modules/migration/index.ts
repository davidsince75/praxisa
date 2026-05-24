import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  migrationBatches,
  migrationRows,
  migrationIssues,
  users,
} from "../../db/schema/index.js";
import { hashPassword } from "../auth/service.js";
import { processRows } from "./service.js";
import { createBatchSchema } from "./types.js";
import type { ReconciliationReport, ReconciliationCheck } from "./types.js";

// ── Role guard helper ──────────────────────────────────────────────────────────

function requireRole(
  reply: FastifyReply,
  role: string,
  allowed: string[],
): boolean {
  if (!allowed.includes(role)) {
    void reply.status(403).send({ error: "Accès interdit" });
    return false;
  }
  return true;
}

// ── Plugin ─────────────────────────────────────────────────────────────────────

export const migrationPlugin = (
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
) => {
  // ── POST /migration/batches ────────────────────────────────────────────────
  // Upload a batch of raw rows for validation.
  // Accessible to migration_lead and admin.

  fastify.post(
    "/migration/batches",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub, role } = request.jwtPayload;
      if (!requireRole(reply, role, ["admin", "migration_lead"])) return;

      const parse = createBatchSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const results = processRows(body.rows);
      const errorsCount = results.filter((r) =>
        r.issues.some((i) => i.severity === "error"),
      ).length;
      const warningsCount = results.filter(
        (r) =>
          !r.issues.some((i) => i.severity === "error") &&
          r.issues.some((i) => i.severity === "warning"),
      ).length;
      const acceptedCount = results.filter((r) => r.accepted).length;
      const batchStatus = errorsCount === 0 ? "validated" : "validated"; // always validated after parse

      // Insert batch
      const batchInserted = await fastify.db
        .insert(migrationBatches)
        .values({
          sourceFile: body.sourceFile,
          sha256: body.sha256,
          rowCount: body.rows.length,
          status: batchStatus,
          errorsCount,
          warningsCount,
          importedBy: sub,
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .returning();

      const batch = batchInserted[0];
      if (batch === undefined) throw new Error("Batch insert returned no rows");

      // Insert rows and issues
      for (const result of results) {
        const rowInserted = await fastify.db
          .insert(migrationRows)
          .values({
            batchId: batch.id,
            rowRef: result.rowRef,
            rawData: result.rawData,
            normalizedData: result.normalised,
            status: result.accepted ? "accepted" : "rejected",
          })
          .returning();

        const row = rowInserted[0];
        if (row === undefined) continue;

        if (result.issues.length > 0) {
          await fastify.db.insert(migrationIssues).values(
            result.issues.map((issue) => ({
              batchId: batch.id,
              rowId: row.id,
              severity: issue.severity,
              ruleId: issue.ruleId,
              field: issue.field,
              message: issue.message,
            })),
          );
        }
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "migration.batch.created",
        entityType: "migration_batch",
        entityId: batch.id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({
        batchId: batch.id,
        rowCount: body.rows.length,
        acceptedCount,
        rejectedCount: body.rows.length - acceptedCount,
        errorsCount,
        warningsCount,
        status: batch.status,
      });
    },
  );

  // ── GET /migration/batches ─────────────────────────────────────────────────

  fastify.get(
    "/migration/batches",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (!requireRole(reply, role, ["admin", "migration_lead"])) return;

      const rows = await fastify.db
        .select({
          id: migrationBatches.id,
          sourceFile: migrationBatches.sourceFile,
          rowCount: migrationBatches.rowCount,
          status: migrationBatches.status,
          errorsCount: migrationBatches.errorsCount,
          warningsCount: migrationBatches.warningsCount,
          createdAt: migrationBatches.createdAt,
          completedAt: migrationBatches.completedAt,
        })
        .from(migrationBatches)
        .orderBy(migrationBatches.createdAt);

      return reply.send({ batches: rows });
    },
  );

  // ── GET /migration/batches/:batchId ────────────────────────────────────────

  fastify.get(
    "/migration/batches/:batchId",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (!requireRole(reply, role, ["admin", "migration_lead"])) return;

      const { batchId } = request.params as { batchId: string };

      const batchRows = await fastify.db
        .select()
        .from(migrationBatches)
        .where(eq(migrationBatches.id, batchId))
        .limit(1);

      const batch = batchRows[0];
      if (batch === undefined) {
        return reply.status(404).send({ error: "Lot introuvable" });
      }

      const rowList = await fastify.db
        .select({
          id: migrationRows.id,
          rowRef: migrationRows.rowRef,
          status: migrationRows.status,
          normalizedData: migrationRows.normalizedData,
          targetUserId: migrationRows.targetUserId,
        })
        .from(migrationRows)
        .where(eq(migrationRows.batchId, batchId));

      return reply.send({ batch, rows: rowList });
    },
  );

  // ── GET /migration/batches/:batchId/issues ─────────────────────────────────

  fastify.get(
    "/migration/batches/:batchId/issues",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (!requireRole(reply, role, ["admin", "migration_lead"])) return;

      const { batchId } = request.params as { batchId: string };

      const issues = await fastify.db
        .select()
        .from(migrationIssues)
        .where(eq(migrationIssues.batchId, batchId))
        .orderBy(migrationIssues.severity);

      return reply.send({ batchId, issues });
    },
  );

  // ── POST /migration/batches/:batchId/load ──────────────────────────────────
  // Load all accepted rows from a validated batch into the users table.

  fastify.post(
    "/migration/batches/:batchId/load",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub, role } = request.jwtPayload;
      if (!requireRole(reply, role, ["admin", "migration_lead"])) return;

      const { batchId } = request.params as { batchId: string };

      const batchRows = await fastify.db
        .select()
        .from(migrationBatches)
        .where(eq(migrationBatches.id, batchId))
        .limit(1);

      const batch = batchRows[0];
      if (batch === undefined) {
        return reply.status(404).send({ error: "Lot introuvable" });
      }
      if (batch.status !== "validated") {
        return reply.status(409).send({
          error: `Batch cannot be loaded in status '${batch.status}'`,
        });
      }

      // Mark batch as loading
      await fastify.db
        .update(migrationBatches)
        .set({ status: "loading", startedAt: new Date() })
        .where(eq(migrationBatches.id, batchId));

      const acceptedRows = await fastify.db
        .select()
        .from(migrationRows)
        .where(
          and(
            eq(migrationRows.batchId, batchId),
            eq(migrationRows.status, "accepted"),
          ),
        );

      let loadedCount = 0;
      let skippedCount = 0;

      for (const row of acceptedRows) {
        // normalizedData from jsonb may come back as the stored object
        const norm = row.normalizedData as {
          firstName: string;
          lastName: string;
          email: string;
          role: "student" | "instructor" | "admin" | "migration_lead";
          phone?: string;
        } | null;

        if (!norm) {
          skippedCount++;
          continue;
        }

        // Check for existing user with same email
        const existing = await fastify.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, norm.email))
          .limit(1);

        if (existing.length > 0) {
          // Email conflict — mark row as rejected with an issue
          await fastify.db
            .update(migrationRows)
            .set({ status: "rejected", updatedAt: new Date() })
            .where(eq(migrationRows.id, row.id));

          await fastify.db.insert(migrationIssues).values({
            batchId,
            rowId: row.id,
            severity: "error",
            ruleId: "conflict.email",
            field: "email",
            message: `Email '${norm.email}' already exists in the users table`,
          });

          skippedCount++;
          continue;
        }

        // Generate a secure temporary password — user must reset on first login
        const tempPassword = randomBytes(24).toString("base64url");
        const passwordHash = await hashPassword(tempPassword);

        const inserted = await fastify.db
          .insert(users)
          .values({
            email: norm.email,
            firstName: norm.firstName,
            lastName: norm.lastName,
            passwordHash,
            role: norm.role,
            emailVerified: false,
            isActive: true,
          })
          .returning({ id: users.id });

        const newUser = inserted[0];
        if (newUser === undefined) {
          skippedCount++;
          continue;
        }

        await fastify.db
          .update(migrationRows)
          .set({
            status: "loaded",
            targetUserId: newUser.id,
            updatedAt: new Date(),
          })
          .where(eq(migrationRows.id, row.id));

        loadedCount++;
      }

      // Mark batch as loaded
      await fastify.db
        .update(migrationBatches)
        .set({ status: "loaded", completedAt: new Date() })
        .where(eq(migrationBatches.id, batchId));

      await emitEvent({
        actorUserId: sub,
        eventType: "migration.batch.loaded",
        entityType: "migration_batch",
        entityId: batchId,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ batchId, loadedCount, skippedCount });
    },
  );

  // ── GET /migration/batches/:batchId/reconcile ──────────────────────────────
  // Run post-load reconciliation checks and return a structured report.

  fastify.get(
    "/migration/batches/:batchId/reconcile",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (!requireRole(reply, role, ["admin", "migration_lead"])) return;

      const { batchId } = request.params as { batchId: string };

      const batchRows = await fastify.db
        .select()
        .from(migrationBatches)
        .where(eq(migrationBatches.id, batchId))
        .limit(1);

      const batch = batchRows[0];
      if (batch === undefined) {
        return reply.status(404).send({ error: "Lot introuvable" });
      }

      const allRows = await fastify.db
        .select({
          id: migrationRows.id,
          status: migrationRows.status,
          targetUserId: migrationRows.targetUserId,
          normalizedData: migrationRows.normalizedData,
        })
        .from(migrationRows)
        .where(eq(migrationRows.batchId, batchId));

      const checks: ReconciliationCheck[] = [];

      // Check 1: loaded row count matches users with targetUserId set
      const loadedRows = allRows.filter((r) => r.status === "loaded");
      const targetUserIds = loadedRows
        .map((r) => r.targetUserId)
        .filter((id): id is string => id !== null);

      let confirmedCount = 0;
      if (targetUserIds.length > 0) {
        const confirmedUsers = await fastify.db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, targetUserIds));
        confirmedCount = confirmedUsers.length;
      }

      const countCheck = loadedRows.length === confirmedCount;
      checks.push({
        checkId: "loaded_count_matches",
        description: "Loaded row count matches confirmed users in users table",
        passed: countCheck,
        detail: {
          loadedRows: loadedRows.length,
          confirmedUsers: confirmedCount,
        },
      });

      // Check 2: no accepted rows left unloaded
      const acceptedUnloaded = allRows.filter(
        (r) => r.status === "accepted",
      ).length;
      checks.push({
        checkId: "no_pending_accepted_rows",
        description: "No accepted rows remain unloaded",
        passed: acceptedUnloaded === 0,
        detail: { acceptedUnloadedCount: acceptedUnloaded },
      });

      // Check 3: all loaded rows have a targetUserId
      const loadedWithoutTarget = loadedRows.filter(
        (r) => r.targetUserId === null,
      ).length;
      checks.push({
        checkId: "all_loaded_have_target",
        description: "All loaded rows have a corresponding targetUserId",
        passed: loadedWithoutTarget === 0,
        detail: { loadedWithoutTarget },
      });

      // Check 4: batch status is 'loaded'
      checks.push({
        checkId: "batch_status_loaded",
        description: "Batch status is 'loaded'",
        passed: batch.status === "loaded",
        detail: { batchStatus: batch.status },
      });

      const report: ReconciliationReport = {
        batchId,
        runAt: new Date().toISOString(),
        checks,
        passed: checks.every((c) => c.passed),
      };

      return reply.send({ report });
    },
  );

  done();
};
