import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
} as unknown;

beforeEach(() => {
  vi.resetAllMocks();
  mockInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
});

describe("createNotification", () => {
  it("inserts a notification row with correct fields", async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: valuesFn });

    const { createNotification } = await import("./service.js");
    await createNotification(
      mockDb as Parameters<typeof createNotification>[0],
      "user-123",
      "new_message",
      "Nouveau message",
      "Bonjour, ceci est un test",
      "thread",
      "thread-456",
    );

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(valuesFn).toHaveBeenCalledWith({
      userId: "user-123",
      type: "new_message",
      title: "Nouveau message",
      body: "Bonjour, ceci est un test",
      entityType: "thread",
      entityId: "thread-456",
    });
  });

  it("inserts without optional entity fields", async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: valuesFn });

    const { createNotification } = await import("./service.js");
    await createNotification(
      mockDb as Parameters<typeof createNotification>[0],
      "user-789",
      "grading_returned",
      "Travail noté",
      "Votre travail a été évalué.",
    );

    expect(valuesFn).toHaveBeenCalledWith({
      userId: "user-789",
      type: "grading_returned",
      title: "Travail noté",
      body: "Votre travail a été évalué.",
      entityType: undefined,
      entityId: undefined,
    });
  });
});

describe("notification types", () => {
  it("NOTIFICATION_TYPES contains all expected values", async () => {
    const { NOTIFICATION_TYPES } =
      await import("../../db/schema/notifications.js");
    expect(NOTIFICATION_TYPES).toEqual([
      "new_message",
      "grading_returned",
      "campaign_sent",
      "enrolment_created",
    ]);
  });

  it("NOTIFICATION_TYPES has exactly 4 entries", async () => {
    const { NOTIFICATION_TYPES } =
      await import("../../db/schema/notifications.js");
    expect(NOTIFICATION_TYPES).toHaveLength(4);
  });
});
