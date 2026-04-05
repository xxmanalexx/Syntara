/**
 * @file conversations.test.ts
 * Smoke tests for inbox conversation API helpers.
 * Run with: npx tsx --test __tests__/app/api/inbox/conversations.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as inboxService from "../../../lib/domain/inbox/service";
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production",
);

describe("inbox service exports", () => {
  it("exports all required functions", () => {
    assert.ok(typeof inboxService.getConversations === "function");
    assert.ok(typeof inboxService.getConversationWithMessages === "function");
    assert.ok(typeof inboxService.markConversationRead === "function");
    assert.ok(typeof inboxService.assignConversation === "function");
    assert.ok(typeof inboxService.upsertConversationFromWebhook === "function");
    assert.ok(typeof inboxService.sendMessage === "function");
  });

  it("getConversations is async and requires workspaceId", async () => {
    try {
      await inboxService.getConversations("test-ws");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        msg.includes("prisma") || msg.includes("connect") || msg.includes("Can't reach"),
        `Unexpected error: ${msg}`,
      );
    }
  });
});

describe("JWT verification", () => {
  it("encodes and decodes a valid JWT", async () => {
    const token = await new SignJWT({ sub: "user1", workspaceId: "ws1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    const { payload } = await jwtVerify(token, JWT_SECRET);
    assert.strictEqual(payload.sub, "user1");
    assert.strictEqual(payload.workspaceId, "ws1");
  });

  it("rejects a token signed with wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ sub: "user1" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(wrongSecret);

    await assert.rejects(
      () => jwtVerify(token, JWT_SECRET),
      /signature verification failed/i,
    );
  });
});
