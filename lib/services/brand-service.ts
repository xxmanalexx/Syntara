import { prisma } from "@/lib/db";
import type { BrandProfile } from "@/types";
import type { BrandProfileInput } from "@/lib/validation";

export class BrandProfileService {
  async create(workspaceId: string, data: BrandProfileInput): Promise<BrandProfile> {
    const brand = await prisma.brandProfile.create({
      data: {
        workspaceId,
        name: data.name,
        description: data.description,
        audienceDesc: data.audienceDesc,
        voiceGuidance: data.voiceGuidance,
        styleKeywords: data.styleKeywords ?? [],
        bannedPhrases: data.bannedPhrases ?? [],
        bannedClaims: data.bannedClaims ?? [],
        ctaPreferences: data.ctaPreferences,
        visualStyle: data.visualStyle,
        colorReferences: data.colorReferences ?? [],
        referenceUrls: data.referenceUrls ?? [],
        negativePrompts: data.negativePrompts ?? [],
      },
    });
    return brand as unknown as BrandProfile;
  }

  async getById(id: string): Promise<BrandProfile | null> {
    const brand = await prisma.brandProfile.findUnique({ where: { id } });
    return brand as unknown as BrandProfile | null;
  }

  async getByWorkspace(workspaceId: string): Promise<BrandProfile[]> {
    const brands = await prisma.brandProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return brands as unknown as BrandProfile[];
  }

  async update(id: string, data: Partial<BrandProfileInput>): Promise<BrandProfile> {
    const brand = await prisma.brandProfile.update({
      where: { id },
      data: {
        ...data,
        styleKeywords: data.styleKeywords,
        bannedPhrases: data.bannedPhrases,
        bannedClaims: data.bannedClaims,
        colorReferences: data.colorReferences,
        referenceUrls: data.referenceUrls,
        negativePrompts: data.negativePrompts,
      },
    });
    return brand as unknown as BrandProfile;
  }

  async delete(id: string): Promise<void> {
    await prisma.brandProfile.delete({ where: { id } });
  }
}
