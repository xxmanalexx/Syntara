import { PrismaClient } from "@prisma/client";
import { leadOrchestrator } from "../lib/services/ollama-agent";

const prisma = new PrismaClient();

async function main() {
  // Clear the existing empty suggestions so the guard doesn't block re-processing
  await prisma.message.updateMany({
    where: { content: "Demo", ai_suggestion: "" },
    data: { ai_suggestion: null, ai_confidence: null, response_zone: null },
  });

  const msgs = await prisma.message.findMany({
    where: { content: "Demo" },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { conversation: true },
  });

  console.log("Demo messages to re-process:", msgs.length);
  for (const m of msgs) {
    console.log("Processing:", m.id, "| conversation:", m.conversationId);
    try {
      await leadOrchestrator.processInboundMessage(m.conversationId, m.id);
      const updated = await prisma.message.findUnique({ where: { id: m.id } });
      console.log(
        "Result → suggestion:",
        updated?.ai_suggestion?.slice(0, 80) ?? "(empty)",
        "| zone:",
        updated?.response_zone,
        "| confidence:",
        updated?.ai_confidence
      );
    } catch (e: unknown) {
      console.error("Error:", (e as Error).message);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
