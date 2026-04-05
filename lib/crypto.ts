import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY env var is not set");
  const buffer = Buffer.from(key, "hex");
  if (buffer.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${buffer.length} bytes`);
  }
  return buffer;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string: salt (32) + iv (16) + ciphertext + tag (16).
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Concatenate: salt + iv + ciphertext + tag
  return Buffer.concat([salt, iv, encrypted, tag]).toString("base64");
}

/**
 * Decrypt a base64-encoded ciphertext produced by encryptToken.
 */
export function decryptToken(encrypted: string): string {
  const key = getKey();
  const buffer = Buffer.from(encrypted, "base64");

  if (buffer.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted token: data too short");
  }

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const ciphertext = buffer.subarray(SALT_LENGTH + IV_LENGTH, buffer.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
