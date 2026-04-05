/**
 * Seed default pipeline stages for existing workspaces.
 * Run after `npx prisma migrate dev` or `npx prisma db push`.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json prisma/seed-pipeline.ts
 * Or:
 *   npx tsx prisma/seed-pipeline.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_STAGES = [
  { name: "New Lead", position: 0, color: "#6366f1", is_default: true },
  { name: "Qualifying", position: 1, color: "#8b5cf6", is_default: false },
  { name: "Proposal Sent", position: 2, color: "#f59e0b", is_default: false },
  { name: "Follow Up", position: 3, color: "#3b82f6", is_default: false },
  { name: "Ready to Buy", position: 4, color: "#10b981", is_default: false },
];

async function main() {
  console.log("Seeding default pipeline stages...");

  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true },
  });

  console.log(`Found ${workspaces.length} workspace(s)`);

  for (const workspace of workspaces) {
    const existing = await prisma.pipelineStage.findMany({
      where: { workspaceId: workspace.id },
    });

    if (existing.length > 0) {
      console.log(`  [${workspace.name}] Already has ${existing.length} stages — skipping`);
      continue;
    }

    await Promise.all(
      DEFAULT_STAGES.map((stage) =>
        prisma.pipelineStage.create({
          data: { ...stage, workspaceId: workspace.id },
        }),
      ),
    );

    console.log(`  [${workspace.name}] Created ${DEFAULT_STAGES.length} pipeline stages`);
  }

  console.log("Done!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
