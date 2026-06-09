import { describe, it, expect, vi } from "vitest";
import { createNotification } from "./service.js";

// Derive the exact Db type the service expects — no manual generic needed.
type Db = Parameters<typeof createNotification>[0];

// Minimal Drizzle insert chain: db.insert(table).values(data)
function makeMockDb() {
  const valuesMock = vi.fn().mockResolvedValue([]);
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
  return {
    db: { insert: insertMock } as unknown as Db,
    insertMock,
    valuesMock,
  };
}

// ── createNotification service ─────────────────────────────────────────────

describe("createNotification", () => {
  it("inserts a row with the correct userId and type", async () => {
    const { db, valuesMock } = makeMockDb();

    await createNotification(
      db,
      "user-abc",
      "new_message",
      "Nouveau message",
      "Vous avez un nouveau message",
    );

    expect(valuesMock).toHaveBeenCalledOnce();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-abc",
        type: "new_message",
      }),
    );
  });

  it("includes title and body in the inserted row", async () => {
    const { db, valuesMock } = makeMockDb();

    await createNotification(
      db,
      "u1",
      "grading_returned",
      "Travail noté",
      "Votre travail a été évalué.",
    );

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Travail noté",
        body: "Votre travail a été évalué.",
      }),
    );
  });

  it("passes entityType and entityId when provided", async () => {
    const { db, valuesMock } = makeMockDb();

    await createNotification(
      db,
      "u2",
      "campaign_sent",
      "Campagne envoyée",
      "Une campagne a été envoyée",
      "campaign",
      "camp-99",
    );

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "campaign",
        entityId: "camp-99",
      }),
    );
  });

  it("leaves entityType and entityId undefined when not provided", async () => {
    const { db, valuesMock } = makeMockDb();

    await createNotification(
      db,
      "u3",
      "enrolment_created",
      "Inscrit",
      "Vous êtes inscrit à un cours",
    );

    const arg = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg["entityType"]).toBeUndefined();
    expect(arg["entityId"]).toBeUndefined();
  });

  it("resolves to undefined — does not throw on success", async () => {
    const { db } = makeMockDb();

    await expect(
      createNotification(db, "u4", "new_message", "Test", "Body"),
    ).resolves.toBeUndefined();
  });

  it("supports all four notification types without error", async () => {
    const types = [
      "new_message",
      "grading_returned",
      "campaign_sent",
      "enrolment_created",
    ] as const;

    for (const type of types) {
      const { db } = makeMockDb();
      await expect(
        createNotification(db, "u", type, "T", "B"),
      ).resolves.toBeUndefined();
    }
  });
});
