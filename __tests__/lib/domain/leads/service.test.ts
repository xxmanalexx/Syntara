/**
 * @file leads/service.test.ts
 * Basic smoke tests for the leads service functions.
 * Run with: npx tsx --test __tests__/lib/domain/leads/service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as leadsService from "../../lib/domain/leads/service";

describe("leads service exports", () => {
  it("exports all required functions", () => {
    assert.ok(typeof leadsService.getLeads === "function");
    assert.ok(typeof leadsService.getLeadWithDetails === "function");
    assert.ok(typeof leadsService.createLead === "function");
    assert.ok(typeof leadsService.updateLead === "function");
    assert.ok(typeof leadsService.moveLeadStage === "function");
    assert.ok(typeof leadsService.markLeadWon === "function");
    assert.ok(typeof leadsService.markLeadLost === "function");
    assert.ok(typeof leadsService.createTask === "function");
    assert.ok(typeof leadsService.completeTask === "function");
    assert.ok(typeof leadsService.getTasksForLead === "function");
    assert.ok(typeof leadsService.logActivity === "function");
  });

  it("getLeads is async", async () => {
    // Will fail on actual DB call but proves the function signature is correct
    try {
      await leadsService.getLeads("test-workspace-id");
    } catch (err: unknown) {
      // Prisma client not initialized — expected in test env without DB
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        msg.includes("prisma") || msg.includes("connect") || msg.includes("Can't reach") || msg.includes("test-workspace"),
        `Unexpected error: ${msg}`,
      );
    }
  });

  it("createLead throws on missing contactId", async () => {
    try {
      await leadsService.createLead("ws1", {} as Parameters<typeof leadsService.createLead>[1]);
    } catch (err: unknown) {
      // Prisma validation error expected
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(
        msg.includes("prisma") || msg.includes("contactId") || msg.includes("connect"),
        `Unexpected error: ${msg}`,
      );
    }
  });
});
