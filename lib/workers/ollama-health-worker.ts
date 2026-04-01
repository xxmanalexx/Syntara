import { prisma } from "@/lib/db";
import { OllamaClient } from "@/lib/integrations/ollama/client";

export class OllamaHealthWorker {
  async run(): Promise<{ available: boolean; models: string[]; latencyMs: number }> {
    const client = new OllamaClient();
    const start = Date.now();

    try {
      const health = await client.healthCheck();
      return {
        available: health.ok,
        models: health.models,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { available: false, models: [], latencyMs: Date.now() - start };
    }
  }
}
