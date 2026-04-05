/**
 * @file crypto.test.ts
 * Usage: node --test __tests__/lib/crypto.test.ts
 * Or: npx tsx --test __tests__/lib/crypto.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { encryptToken, decryptToken } from "../../lib/crypto";

process.env.ENCRYPTION_KEY = "a".repeat(64); // 32 bytes in hex

describe("crypto", () => {
  describe("encryptToken / decryptToken roundtrip", () => {
    it("encrypts and decrypts a simple string", () => {
      const plaintext = "Hello, world!";
      const encrypted = encryptToken(plaintext);
      assert.notStrictEqual(encrypted, plaintext);
      assert.ok(encrypted.length > plaintext.length);
      assert.strictEqual(decryptToken(encrypted), plaintext);
    });

    it("encrypts and decrypts unicode text", () => {
      const plaintext = "مرحبا بالعالم! Hello! 🎉";
      assert.strictEqual(decryptToken(encryptToken(plaintext)), plaintext);
    });

    it("encrypts and decrypts a long string", () => {
      const plaintext = "A".repeat(1000);
      assert.strictEqual(decryptToken(encryptToken(plaintext)), plaintext);
    });

    it("produces different ciphertexts for same plaintext (random IV)", () => {
      const plaintext = "same text";
      const a = encryptToken(plaintext);
      const b = encryptToken(plaintext);
      assert.notStrictEqual(a, b);
      assert.strictEqual(decryptToken(a), plaintext);
      assert.strictEqual(decryptToken(b), plaintext);
    });

    it("rejects tampered ciphertext", () => {
      const encrypted = encryptToken("secret");
      const tampered = encrypted.slice(0, -4) + "XXXX";
      assert.throws(() => decryptToken(tampered));
    });

    it("rejects invalid base64", () => {
      assert.throws(() => decryptToken("not-valid-base64!!!"));
    });

    it("rejects too-short data", () => {
      assert.throws(() => decryptToken(Buffer.alloc(10).toString("base64")));
    });
  });
});
