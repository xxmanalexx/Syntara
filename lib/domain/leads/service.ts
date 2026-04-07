import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client"; // eslint-disable-line @typescript-eslint/no-unused-vars
import type {
  Lead,
  Contact,
  Task,
  LeadActivity,
  LeadStatus,
  Conversation,
} from "@prisma/client";

export type LeadWithDetails = Prisma.LeadGetPayload<{
  include: {
    contact: true;
    tasks: { orderBy: { createdAt: "desc" } };
    activities: { orderBy: { createdAt: "desc" }; take: 50 };
    conversations: true;
    assignedTo: { include: { user: { select: { name: true; email: true } } } };
    pipelineStage: true;
    conversation: true;
    workspace: true;
  };
}>;

export type CreateLeadData = {
  contactId: string;
  conversationId?: string;
  source?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  estimated_value?: number;
  currency?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  assignedToId?: string;
  status?: LeadStatus;
  pipelineStageId?: string;
};

export type UpdateLeadData = Partial<Omit<Lead, "id" | "createdAt" | "workspaceId">>;

export async function getLeads(
  workspaceId: string,
  filters?: {
    status?: LeadStatus;
    assignedToId?: string;
    pipelineStageId?: string;
  },
): Promise<Lead[]> {
  const where: Record<string, unknown> = { workspaceId };
  if (filters?.status) where.status = filters.status;
  if (filters?.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters?.pipelineStageId) where.pipelineStageId = filters.pipelineStageId;

  return prisma.lead.findMany({
    where,
    include: {
      contact: true,
      assignedTo: { include: { user: { select: { name: true, email: true } } } },
      pipelineStage: true,
      tasks: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getLeadWithDetails(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      contact: true,
      tasks: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      conversations: true,
      assignedTo: { include: { user: { select: { name: true, email: true } } } },
      pipelineStage: true,
    },
  });
}

export async function createLead(
  workspaceId: string,
  data: CreateLeadData,
): Promise<Lead> {
  // Get or create default pipeline stage
  let pipelineStageId = data.pipelineStageId;
  if (!pipelineStageId) {
    const defaultStage = await prisma.pipelineStage.findFirst({
      where: { workspaceId, is_default: true },
    });
    pipelineStageId = defaultStage?.id;
  }

  return prisma.lead.create({
    data: {
      workspaceId,
      contactId: data.contactId,
      conversationId: data.conversationId,
      source: data.source,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      estimated_value: data.estimated_value,
      currency: data.currency ?? "OMR",
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      assignedToId: data.assignedToId,
      status: data.status ?? "NEW_INQUIRY",
      pipelineStageId,
    },
  });
}

export async function updateLead(leadId: string, data: UpdateLeadData): Promise<Lead> {
  return prisma.lead.update({
    where: { id: leadId },
    data,
  });
}

export async function moveLeadStage(leadId: string, stageId: string): Promise<Lead> {
  return prisma.lead.update({
    where: { id: leadId },
    data: { pipelineStageId: stageId },
  });
}

export async function markLeadWon(leadId: string): Promise<Lead> {
  return prisma.lead.update({
    where: { id: leadId },
    data: { status: "WON", closedAt: new Date() },
  });
}

export async function markLeadLost(leadId: string): Promise<Lead> {
  return prisma.lead.update({
    where: { id: leadId },
    data: { status: "LOST", closedAt: new Date() },
  });
}

export async function createTask(
  workspaceId: string,
  data: {
    leadId?: string;
    assignedToId?: string;
    title: string;
    description?: string;
    type?: "FOLLOW_UP" | "CALL" | "QUOTE" | "BOOKING" | "MEETING" | "OTHER";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate?: Date;
  },
): Promise<Task> {
  return prisma.task.create({
    data: {
      workspaceId,
      leadId: data.leadId,
      assignedToId: data.assignedToId,
      title: data.title,
      description: data.description,
      type: data.type ?? "FOLLOW_UP",
      priority: data.priority ?? "MEDIUM",
      dueDate: data.dueDate,
    },
  });
}

export async function completeTask(taskId: string): Promise<Task> {
  return prisma.task.update({
    where: { id: taskId },
    data: { completedAt: new Date() },
  });
}

export async function getTasksForLead(leadId: string): Promise<Task[]> {
  return prisma.task.findMany({
    where: { leadId },
    include: { assignedTo: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function logActivity(
  workspaceId: string,
  leadId: string,
  type: string,
  description: string,
  metadata?: Record<string, unknown> | null,
  conversationId?: string,
): Promise<LeadActivity> {
  return prisma.leadActivity.create({
    data: {
      workspaceId,
      leadId,
      conversationId,
      type,
      description,
      metadata: metadata === null
        ? Prisma.JsonNull
        : (metadata as Prisma.InputJsonValue | undefined),
    },
  });
}
