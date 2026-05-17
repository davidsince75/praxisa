import { generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} from "./service.js";

// Ephemeral RS256 key pair — no secrets needed in CI
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const privateKeyPem = privateKey.export({
  type: "pkcs8",
  format: "pem",
}) as string;
const publicKeyPem = publicKey.export({
  type: "spki",
  format: "pem",
}) as string;

const TEST_PAYLOAD = {
  sub: "00000000-0000-0000-0000-000000000001",
  role: "student" as const,
  email: "alice@example.com",
};

// ── Password ──────────────────────────────────────────────────────────────────

describe("hashPassword / verifyPassword", () => {
  it("hashes and verifies a correct password", async () => {
    const h = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword(h, "correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const h = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword(h, "wrong-password")).toBe(false);
  });

  it("produces a different hash each call (random salt)", async () => {
    const h1 = await hashPassword("same-password-123");
    const h2 = await hashPassword("same-password-123");
    expect(h1).not.toBe(h2);
  });

  it("returns false (not throws) on a malformed hash", async () => {
    expect(await verifyPassword("not-a-real-hash", "password")).toBe(false);
  });
});

// ── JWT ───────────────────────────────────────────────────────────────────────

describe("signToken / verifyToken", () => {
  it("signs and verifies a token", async () => {
    const token = await signToken(TEST_PAYLOAD, privateKeyPem);
    const verified = await verifyToken(token, publicKeyPem);

    expect(verified.sub).toBe(TEST_PAYLOAD.sub);
    expect(verified.role).toBe(TEST_PAYLOAD.role);
    expect(verified.email).toBe(TEST_PAYLOAD.email);
  });

  it("rejects a token signed with a different key", async () => {
    const { privateKey: otherKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const otherPem = otherKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string;

    const token = await signToken(TEST_PAYLOAD, otherPem);
    await expect(verifyToken(token, publicKeyPem)).rejects.toThrow();
  });

  it("rejects a tampered token", async () => {
    const token = await signToken(TEST_PAYLOAD, privateKeyPem);
    const tampered = token.slice(0, -4) + "XXXX";
    await expect(verifyToken(tampered, publicKeyPem)).rejects.toThrow();
  });
});
