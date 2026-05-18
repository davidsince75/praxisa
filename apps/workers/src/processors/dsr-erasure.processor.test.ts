import { describe, it, expect, vi, beforeEach } from "vitest";
import { eraseUserPii, runErasureSweep } from "./dsr-erasure.processor.js";
import type { WorkerDb } from "../db.js";
import type { WorkerConfig } from "../config.js";
import type { Logger } from "pino";

// ── Shared test fixtures ───────────────────────────────────────────────────────

const mockConfig: WorkerConfig = {
  nodeEnv: "development",
  logLevel: "info",
  databaseUrl: "postgresql://test:test@localhost/test",
  redisUrl: "redis://localhost:6379",
  brevo: {
    apiKey: "test-key",
    senderEmail: "no-reply@praxisa.fr",
    senderName: "Praxisa",
  },
  adminEmail: "admin@praxisa.fr",
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

// ── eraseUserPii ───────────────────────────────────────────────────────────────

describe("eraseUserPii", () => {
  it("calls db.update with the correct anonymised fields", async () => {
    const mockSet = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });

    const db = { update: mockUpdate } as unknown as WorkerDb;

    await eraseUserPii(db, "user-123");

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "erased_user-123@praxisa.invalid",
        firstName: "[Erased]",
        lastName: "[Erased]",
        passwordHash: "ERASED",
        isActive: false,
      }),
    );
  });
});

// ── runErasureSweep ────────────────────────────────────────────────────────────

describe("runErasureSweep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Suppress fetch calls in unit tests
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns 0 when there are no pending requests", async () => {
    // Simulate db.update().set().where().returning() → []
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

    const db = { update: mockUpdate } as unknown as WorkerDb;

    const count = await runErasureSweep(db, mockConfig, mockLogger);

    expect(count).toBe(0);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it("logs a warning when the user record is missing", async () => {
    const requestId = "req-001";
    const userId = "user-missing";

    // First update: claim request (transition to in_progress)
    const mockClaimReturning = vi
      .fn()
      .mockResolvedValue([{ id: requestId, userId }]);
    const mockClaimWhere = vi
      .fn()
      .mockReturnValue({ returning: mockClaimReturning });
    const mockClaimSet = vi.fn().mockReturnValue({ where: mockClaimWhere });

    // Second update: mark completed (when user not found)
    const mockCompletedWhere = vi.fn().mockResolvedValue([]);
    const mockCompletedSet = vi
      .fn()
      .mockReturnValue({ where: mockCompletedWhere });

    let updateCallCount = 0;
    const mockUpdate = vi.fn().mockImplementation(() => {
      updateCallCount++;
      if (updateCallCount === 1) return { set: mockClaimSet };
      return { set: mockCompletedSet };
    });

    // Select: user not found
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    // Delete: not reached in this branch
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });

    const db = {
      update: mockUpdate,
      select: mockSelect,
      delete: mockDelete,
    } as unknown as WorkerDb;

    const count = await runErasureSweep(db, mockConfig, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ requestId, userId }),
      expect.stringContaining("user not found"),
    );
    // User missing → request closed, not counted as "processed"
    expect(count).toBe(0);
  });
});
