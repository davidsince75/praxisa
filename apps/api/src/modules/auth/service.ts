import { hash, verify } from "@node-rs/argon2";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import type { JwtPayload } from "./types.js";

const ALGORITHM = "RS256";
const TOKEN_TTL = "8h";

// ── Email-purpose token purposes ───────────────────────────────────────────────

export type EmailTokenPurpose = "email_verify" | "pwd_reset";

// ── Password ───────────────────────────────────────────────────────────────────

/**
 * Hash a password with Argon2id (OWASP recommended parameters).
 * @node-rs/argon2 defaults: algorithm=Argon2id, memoryCost=65536, timeCost=3, parallelism=4
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/**
 * Verify a plaintext password against an Argon2id hash.
 * Returns false (not throws) on mismatch so callers can branch cleanly.
 */
export async function verifyPassword(
  hashedPassword: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(hashedPassword, password);
  } catch {
    return false;
  }
}

// ── JWT ────────────────────────────────────────────────────────────────────────

/**
 * Sign a JWT with RS256. The private key PEM is decoded from Doppler at startup.
 * Key is imported fresh each call — for production at scale, cache the key object.
 */
export async function signToken(
  payload: JwtPayload,
  privateKeyPem: string,
): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem, ALGORITHM);
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(privateKey);
}

/**
 * Verify a JWT and return the typed payload.
 * Throws JWTExpired / JWSSignatureVerificationFailed on invalid tokens.
 */
export async function verifyToken(
  token: string,
  publicKeyPem: string,
): Promise<JwtPayload> {
  const publicKey = await importSPKI(publicKeyPem, ALGORITHM);
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [ALGORITHM],
  });

  return {
    sub: payload.sub ?? "",
    role: (payload["role"] ?? "student") as JwtPayload["role"],
    email: (payload["email"] ?? "") as string,
  };
}

// ── Short-lived email-purpose tokens ───────────────────────────────────────────

const EMAIL_TOKEN_TTL: Record<EmailTokenPurpose, string> = {
  email_verify: "24h",
  pwd_reset: "30m",
};

/**
 * Sign a short-lived RS256 token for email verification or password reset.
 * The `purpose` claim prevents cross-use between the two flows.
 */
export async function signEmailToken(
  userId: string,
  purpose: EmailTokenPurpose,
  privateKeyPem: string,
): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem, ALGORITHM);
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(EMAIL_TOKEN_TTL[purpose])
    .sign(privateKey);
}

/**
 * Verify a short-lived email-purpose token and return the userId.
 * Throws if the token is expired, invalid, or has the wrong purpose.
 */
export async function verifyEmailToken(
  token: string,
  purpose: EmailTokenPurpose,
  publicKeyPem: string,
): Promise<string> {
  const publicKey = await importSPKI(publicKeyPem, ALGORITHM);
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [ALGORITHM],
  });

  if (payload["purpose"] !== purpose) {
    throw new Error("Token purpose mismatch");
  }

  return payload.sub ?? "";
}
