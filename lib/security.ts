/**
 * Helpers for encrypting secrets at rest (AES-256-GCM) and verifying Meta
 * webhook signatures. Requires the Node.js runtime (uses `node:crypto`) —
 * do not import this from an Edge route handler.
 */
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  // Accept a proper base64-encoded 32-byte key. As a dev convenience, fall
  // back to deriving a 32-byte key from an arbitrary passphrase.
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    const data = Buffer.from(ciphertext, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function maskSecret(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  if (plaintext.length <= 8) return "*".repeat(plaintext.length);
  return `${plaintext.slice(0, 4)}${"*".repeat(plaintext.length - 8)}${plaintext.slice(-4)}`;
}

/** Validates the X-Hub-Signature-256 header Meta sends on every webhook POST. */
export function verifyMetaSignature(
  appSecret: string,
  payload: Buffer,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const [algo, providedDigest] = signatureHeader.split("=");
  if (algo !== "sha256" || !providedDigest) return false;

  const expectedDigest = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
  const expected = Buffer.from(expectedDigest, "utf8");
  const provided = Buffer.from(providedDigest, "utf8");
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}
