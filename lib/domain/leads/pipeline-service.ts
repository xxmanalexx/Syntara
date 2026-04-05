import { prisma } from "@/lib/db";
import type { PipelineStage } from "@prisma/client";

const DEFAULT_STAGES = [
  { name: "New Lead", position: 0, color: "#6366f1", is_default: true },
  { name: "Qualifying", position: 1, color: "#8b5cf6", is_default: false },
  { name: "Proposal Sent", position: 2, color: "#f59e0b", is_default: false },
  { name: "Follow Up", position: 3, color: "#3b82f6", is_default: false },
  { name: "Ready to Buy", position: 4, color: "#10b981", is_default: false },
];

export async function seedDefaultPipeline(workspaceId: string): Promise<PipelineStage[]> {
  const stages = await Promise.all(
    DEFAULT_STAGES.map((stage) =>
      prisma.pipelineStage.create({
        data: { ...stage, workspaceId },
      }),
    ),
  );
  return stages;
}

export async function getOrCreatePipeline(workspaceId: string): Promise<PipelineStage[]> {
  const existing = await prisma.pipelineStage.findMany({
    where: { workspaceId },
    orderBy: { position: "asc" },
  });

  if (existing.length > 0) return existing;

  return seedDefaultPipeline(workspaceId);
}
