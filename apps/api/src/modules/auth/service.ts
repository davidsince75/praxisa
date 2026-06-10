import { hash, verify } from "@node-rs/argon2";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import type { JwtPayload } from "./types.js";

const ALGORITHM = "RS256";
const TOKEN_TTL = "8h";

/** Session JWT lifetime in seconds — TTL for Redis session-invalidation keys. */
export const TOKEN_TTL_SECONDS = 8 * 60 * 60;

// ── Email-purpose token purposes ───────────────────────────────────────────────

export type EmailTokenPurpose = "email_verify" | "pwd_reset";

const EMAIL_TOKEN_TTL: Record<EmailTokenPurpose, string> = {
  email_verify: "24h",
  pwd_reset: "30m",
};

/** pwd_reset token lifetime in seconds — TTL for the single-use jti marker. */
export const RESET_TOKEN_TTL_SECONDS = 30 * 60;

// ── Redis key builders (auth security controls) ────────────────────────────────

/**
 * Holds an epoch-seconds watermark: session JWTs issued before this moment
 * are rejected by the authenticate decorator. Set on password reset.
 */
export function passwordInvalidationKey(userId: string): string {
  return `auth:pwd-invalidate:${userId}`;
}

/** Single-use marker for consumed password-reset tokens (keyed by jti). */
export function resetTokenUsedKey(jti: string): string {
  return `auth:reset-used:${jti}`;
}

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

// ── Key caching ────────────────────────────────────────────────────────────────
// PEM → imported key object, cached for the process lifetime. Importing a key
// is non-trivial crypto work; without the cache it ran on every request.

const privateKeyCache = new Map<string, ReturnType<typeof importPKCS8>>();
const publicKeyCache = new Map<string, ReturnType<typeof importSPKI>>();

function getPrivateKey(pem: string): ReturnType<typeof importPKCS8> {
  let key = privateKeyCache.get(pem);
  if (key === undefined) {
    key = importPKCS8(pem, ALGORITHM);
    // Evict rejected imports so a transient failure is not cached forever
    void key.catch(() => {
      privateKeyCache.delete(pem);
    });
    privateKeyCache.set(pem, key);
  }
  return key;
}

function getPublicKey(pem: string): ReturnType<typeof importSPKI> {
  let key = publicKeyCache.get(pem);
  if (key === undefined) {
    key = importSPKI(pem, ALGORITHM);
    void key.catch(() => {
      publicKeyCache.delete(pem);
    });
    publicKeyCache.set(pem, key);
  }
  return key;
}

// ── JWT ────────────────────────────────────────────────────────────────────────

/**
 * Sign a JWT with RS256. The private key PEM is decoded from Doppler at startup;
 * the imported key object is cached per process.
 */
export async function signToken(
  payload: JwtPayload,
  privateKeyPem: string,
): Promise<string> {
  const privateKey = await getPrivateKey(privateKeyPem);
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(privateKey);
}

/**
 * Verify a JWT and return the typed payload (including iat, used by the
 * authenticate decorator to reject tokens issued before a password reset).
 * Throws JWTExpired / JWSSignatureVerificationFailed on invalid tokens.
 */
export async function verifyToken(
  token: string,
  publicKeyPem: string,
): Promise<JwtPayload> {
  const publicKey = await getPublicKey(publicKeyPem);
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [ALGORITHM],
  });

  return {
    sub: payload.sub ?? "",
    role: (payload["role"] ?? "student") as JwtPayload["role"],
    email: (payload["email"] ?? "") as string,
    ...(typeof payload.iat === "number" ? { iat: payload.iat } : {}),
  };
}

// ── Short-lived email-purpose tokens ───────────────────────────────────────────

export interface VerifiedEmailToken {
  userId: string;
  /** Unique token id — enforces single-use for pwd_reset tokens. */
  jti: string | null;
}

/**
 * Sign a short-lived RS256 token for email verification or password reset.
 * The `purpose` claim prevents cross-use between the two flows; the `jti`
 * claim lets the reset flow mark a token as consumed.
 */
export async function signEmailToken(
  userId: string,
  purpose: EmailTokenPurpose,
  privateKeyPem: string,
): Promise<string> {
  const privateKey = await getPrivateKey(privateKeyPem);
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(EMAIL_TOKEN_TTL[purpose])
    .sign(privateKey);
}

/**
 * Verify a short-lived email-purpose token and return the userId + jti.
 * Throws if the token is expired, invalid, or has the wrong purpose.
 */
export async function verifyEmailToken(
  token: string,
  purpose: EmailTokenPurpose,
  publicKeyPem: string,
): Promise<VerifiedEmailToken> {
  const publicKey = await getPublicKey(publicKeyPem);
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [ALGORITHM],
  });

  if (payload["purpose"] !== purpose) {
    throw new Error("Token purpose mismatch");
  }

  return { userId: payload.sub ?? "", jti: payload.jti ?? null };
}
