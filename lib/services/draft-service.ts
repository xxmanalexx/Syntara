// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonObject = Record<string, any>;

import { prisma } from "@/lib/db";
import type {
  Draft,
  DraftVariant,
  ContentVariantData,
  ContentType,
  TonePreset,
  DraftStatus,
} from "@/types";
import type { UpdateDraftInput } from "@/lib/validation";

export class DraftService {
  async create(opts: {
    workspaceId: string;
    brandId: string;
    contentType: ContentType;
    tone?: TonePreset;
    sourceId?: string;
  }): Promise<Draft> {
    const draft = await prisma.draft.create({
      data: {
        workspaceId: opts.workspaceId,
        brandId: opts.brandId,
        contentType: opts.contentType,
        tone: opts.tone ?? "CASUAL",
        status: "DRAFT",
        sourceId: opts.sourceId,
      },
    });
    return draft as unknown as Draft;
  }

  async getById(id: string): Promise<Draft | null> {
    const draft = await prisma.draft.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { createdAt: "asc" } },
        mediaAssets: {
          include: { asset: true },
          orderBy: { sortOrder: "asc" },
        },
        insights: { orderBy: { createdAt: "desc" } },
        brand: true,
      },
    });
    return draft as unknown as Draft | null;
  }

  async listByWorkspace(workspaceId: string, opts?: {
    status?: DraftStatus;
    brandId?: string;
    limit?: number;
  }): Promise<Draft[]> {
    const drafts = await prisma.draft.findMany({
      where: {
        workspaceId,
        ...(opts?.status && { status: opts.status }),
        ...(opts?.brandId && { brandId: opts.brandId }),
      },
      include: {
        brand: true,
        mediaAssets: { include: { asset: true }, take: 1 },
        scheduledPost: true,
      },
      orderBy: { updatedAt: "desc" },
      take: opts?.limit ?? 50,
    });
    return drafts as unknown as Draft[];
  }

  async update(id: string, data: UpdateDraftInput): Promise<Draft> {
    const draft = await prisma.draft.update({
      where: { id },
      data: {
        ...data,
        storyFrames: data.storyFrames as any,
      },
    });
    return draft as unknown as Draft;
  }

  async addVariant(draftId: string, variant: ContentVariantData, name: string): Promise<DraftVariant> {
    const v = await prisma.draftVariant.create({
      data: { draftId, name, isSelected: false, data: variant as unknown as JsonObject },
    });
    return v as unknown as DraftVariant;
  }

  async selectVariant(draftId: string, variantId: string): Promise<void> {
    await prisma.$transaction([
      prisma.draftVariant.updateMany({
        where: { draftId },
        data: { isSelected: false },
      }),
      prisma.draftVariant.update({
        where: { id: variantId },
        data: { isSelected: true },
      }),
    ]);
  }

  async saveGeneratedVariants(draftId: string, variants: ContentVariantData[]): Promise<DraftVariant[]> {
    // Insert variants one at a time to avoid createManyAndReturn field-mapping issues
    const created: DraftVariant[] = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const variant = await prisma.draftVariant.create({
        data: {
          draftId,
          name: String.fromCharCode(65 + i),
          isSelected: i === 0,
          data: {
            caption: v.caption ?? null,
            hook: v.hook ?? null,
            body: v.body ?? null,
            cta: v.cta ?? null,
            hashtags: Array.isArray(v.hashtags) ? v.hashtags : [],
            slideTexts: Array.isArray(v.slideTexts) ? v.slideTexts : [],
            frameCopies: Array.isArray(v.frameCopies) ? v.frameCopies : [],
            visualPrompts: Array.isArray(v.visualPrompts) ? v.visualPrompts : [],
            visualConceptPrompts: Array.isArray(v.visualPrompts) ? v.visualPrompts : [],
          },
        },
      });
      created.push(variant as unknown as DraftVariant);
    }
    return created;
  }

  async addSection(draftId: string, sectionType: string, content: string, sortOrder: number, promptUsed?: string) {
    return prisma.draftSection.create({
      data: { draftId, sectionType: sectionType as any, content, sortOrder, promptUsed },
    });
  }

  async updateSection(sectionId: string, content: string): Promise<void> {
    await prisma.draftSection.update({
      where: { id: sectionId },
      data: { content },
    });
  }

  async updateScores(draftId: string, scores: {
    readinessScore?: number;
    brandScore?: number;
    completenessScore?: number;
    duplicateFlag?: boolean;
  }): Promise<void> {
    await prisma.draft.update({
      where: { id: draftId },
      data: scores,
    });
  }

  async duplicate(draftId: string): Promise<Draft> {
    const original = await this.getById(draftId);
    if (!original) throw new Error("Draft not found");

    const copy = await prisma.draft.create({
      data: {
        workspaceId: original.workspaceId,
        brandId: original.brandId,
        contentType: original.contentType,
        tone: original.tone,
        caption: original.caption,
        captionVariants: original.captionVariants,
        cta: original.cta,
        hashtags: original.hashtags,
        altText: original.altText,
        reelHook: original.reelHook,
        reelScript: original.reelScript,
        reelShotList: original.reelShotList,
        reelCaption: original.reelCaption,
        storyFrames: original.storyFrames as any,
        status: "DRAFT",
      },
    });
    return copy as unknown as Draft;
  }

  async attachImage(draftId: string, imageUrl: string): Promise<void> {
    // Find or create workspace from draft
    const draft = await prisma.draft.findUnique({ where: { id: draftId }, select: { workspaceId: true } });
    if (!draft) throw new Error("Draft not found");

    // Create the media asset
    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId: draft.workspaceId,
        draftId,
        assetSource: "UPLOAD",
        mediaType: "IMAGE",
        url: imageUrl,
      },
    });

    // Link to draft
    await prisma.draftMedia.create({
      data: {
        draftId,
        assetId: asset.id,
        isPrimary: true,
        sortOrder: 0,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.draft.delete({ where: { id } });
  }
}
