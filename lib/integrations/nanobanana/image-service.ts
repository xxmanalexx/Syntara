import { prisma } from "@/lib/db";
import { NanoBananaClient } from "./client";
import type {
  NanoBananaGenerateRequest,
  NanoBananaEditRequest,
  NanoBananaVariantsRequest,
} from "./types";

// Local types matching @/types — avoids import chain issues
type AssetSource = "UPLOAD" | "GENERATED" | "INSTAGRAM" | "URL";
type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL";

interface ImageAsset {
  id: string;
  workspaceId: string;
  draftId?: string;
  instagramId?: string;
  assetSource: AssetSource;
  mediaType: MediaType;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  altText?: string;
  promptVersionId?: string;
  meta?: ImageAssetMeta;
  createdAt: Date;
}

interface ImageAssetMeta {
  prompt?: string;
  model?: string;
  style?: string;
  seed?: string;
  steps?: number;
  dimensions?: { width: number; height: number };
}

interface PromptVersion {
  id: string;
  assetId: string | null;
  draftSectionId: string | null;
  provider: string;
  prompt: string;
  normalizedPrompt: string | null;
  modelUsed: string | null;
  parameters: unknown;
  outputUrl: string | null;
  outputMeta: unknown;
  createdAt: Date;
}

export class NanoBananaImageService {
  constructor(private client: NanoBananaClient) {}

  private async resolveWorkspaceId(draftId?: string): Promise<string> {
    if (draftId) {
      const draft = await prisma.draft.findUnique({ where: { id: draftId }, select: { workspaceId: true } });
      if (draft) return draft.workspaceId;
    }
    return "default";
  }

  async generateImageForDraft(req: {
    draftId?: string;
    draftSectionId?: string;
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    style?: string;
    seed?: number;
    referenceImageUrl?: string;
    referenceImageStrength?: number;
  }): Promise<{ asset: ImageAsset; jobId: string }> {
    const workspaceId = await this.resolveWorkspaceId(req.draftId);

    const nbReq: NanoBananaGenerateRequest = {
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width ?? 1024,
      height: req.height ?? 1024,
      style: req.style,
      seed: req.seed,
      referenceImageUrl: req.referenceImageUrl,
      referenceImageStrength: req.referenceImageStrength,
    };

    const result = await this.client.generateImage(nbReq);
    const image = result.images[0];

    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId,
        draftId: req.draftId,
        assetSource: "GENERATED",
        mediaType: "IMAGE",
        url: image.url,
        thumbnailUrl: image.url,
        width: image.dimensions?.width,
        height: image.dimensions?.height,
        meta: {
          prompt: req.prompt,
          normalizedPrompt: image.revisedPrompt ?? req.prompt,
          model: "nanobanana",
          seed: image.seed !== undefined ? String(image.seed) : undefined,
          dimensions: image.dimensions,
        } as ImageAssetMeta,
      },
    });

    const pv = await prisma.promptVersion.create({
      data: {
        assetId: asset.id,
        provider: "nanobanana",
        prompt: req.prompt,
        normalizedPrompt: image.revisedPrompt ?? req.prompt,
        modelUsed: "nanobanana",
        parameters: nbReq as unknown as object,
        outputUrl: image.url,
        outputMeta: { jobId: result.jobId, dimensions: image.dimensions },
      },
    });

    await prisma.imageGenerationJob.create({
      data: {
        assetId: asset.id,
        promptId: pv.id,
        status: "COMPLETED",
        providerJobId: result.jobId,
        requestMeta: nbReq as unknown as object,
        responseMeta: { jobId: result.jobId, dimensions: image.dimensions } as object,
        completedAt: new Date(),
      },
    });

    return { asset: asset as unknown as ImageAsset, jobId: result.jobId };
  }

  async regenerateImage(
    _assetId: string,
    newPrompt: string
  ): Promise<{ newAsset: ImageAsset; jobId: string }> {
    const result = await this.client.generateImage({ prompt: newPrompt, width: 1024, height: 1024 });
    const image = result.images[0];

    const newAsset = await prisma.mediaAsset.create({
      data: {
        workspaceId: "default",
        assetSource: "GENERATED",
        mediaType: "IMAGE",
        url: image.url,
        thumbnailUrl: image.url,
        width: image.dimensions?.width,
        height: image.dimensions?.height,
        meta: {
          prompt: newPrompt,
          normalizedPrompt: image.revisedPrompt ?? newPrompt,
          seed: image.seed !== undefined ? String(image.seed) : undefined,
        } as ImageAssetMeta,
      },
    });

    return { newAsset: newAsset as unknown as ImageAsset, jobId: result.jobId };
  }

  async editImageForDraft(
    assetId: string,
    req: {
      draftId?: string;
      draftSectionId?: string;
      prompt: string;
      originalImageUrl?: string;
      strength?: number;
    }
  ): Promise<{ newAsset: ImageAsset; jobId: string }> {
    const existing = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    const originalUrl = req.originalImageUrl ?? existing?.url;
    if (!originalUrl) throw new Error("No original image URL available");

    const editReq: NanoBananaEditRequest = {
      prompt: req.prompt,
      originalImageUrl: originalUrl,
      strength: req.strength,
    };

    const result = await this.client.editImage(editReq);

    const newAsset = await prisma.mediaAsset.create({
      data: {
        workspaceId: existing?.workspaceId ?? "default",
        draftId: req.draftId,
        assetSource: "GENERATED",
        mediaType: "IMAGE",
        url: result.image.url,
        thumbnailUrl: result.image.url,
        width: result.image.dimensions?.width,
        height: result.image.dimensions?.height,
        meta: {
          prompt: req.prompt,
          normalizedPrompt: result.image.revisedPrompt ?? req.prompt,
        } as ImageAssetMeta,
      },
    });

    return { newAsset: newAsset as unknown as ImageAsset, jobId: result.jobId };
  }

  async createVariantsForDraft(
    assetId: string,
    prompt?: string,
    numVariants?: number
  ): Promise<{ assets: ImageAsset[]; jobId: string }> {
    const existing = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!existing) throw new Error("Asset not found");

    const result = await this.client.createVariants({
      imageUrl: existing.url,
      prompt,
      numVariants: numVariants ?? 2,
    });

    const createdAssets: ImageAsset[] = [];
    for (const image of result.images) {
      const asset = await prisma.mediaAsset.create({
        data: {
          workspaceId: existing.workspaceId,
          draftId: existing.draftId ?? undefined,
          assetSource: "GENERATED",
          mediaType: "IMAGE",
          url: image.url,
          thumbnailUrl: image.url,
          width: image.dimensions?.width,
          height: image.dimensions?.height,
          meta: {
            prompt: prompt ?? "",
            normalizedPrompt: image.revisedPrompt ?? prompt ?? "",
          } as ImageAssetMeta,
        },
      });
      createdAssets.push(asset as unknown as ImageAsset);
    }

    return { assets: createdAssets, jobId: result.jobId };
  }

  async attachToDraft(assetId: string, draftId: string, isPrimary = false): Promise<void> {
    const count = await prisma.draftMedia.count({ where: { draftId } });
    await prisma.draftMedia.upsert({
      where: { draftId_assetId: { draftId, assetId } },
      create: { draftId, assetId, isPrimary, sortOrder: count },
      update: { isPrimary },
    });
  }

  async getImageHistory(draftId: string): Promise<{ asset: ImageAsset; promptVersion: PromptVersion }[]> {
    const assets = await prisma.mediaAsset.findMany({
      where: { draftId },
      include: { promptVersions: true },
    });

    return assets.flatMap((asset: typeof assets[number]) =>
      asset.promptVersions.map((pv: typeof asset.promptVersions[number]) => ({
        asset: asset as unknown as ImageAsset,
        promptVersion: pv as PromptVersion,
      }))
    );
  }
}
