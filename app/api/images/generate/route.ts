import { NextResponse } from "next/server";
import { imageGenerationSchema } from "@/lib/validation";
import { NanoBananaClient } from "@/lib/integrations/nanobanana/client";
import { NanoBananaImageService } from "@/lib/integrations/nanobanana/image-service";

const nanobananaClient = new NanoBananaClient({
  apiKey: process.env.NANO_BANANA_API_KEY ?? "",
  baseUrl: process.env.NANO_BANANA_BASE_URL ?? "https://api.nanobanana.io/v1",
});

const imageService = new NanoBananaImageService(nanobananaClient);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = imageGenerationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { asset, jobId } = await imageService.generateImageForDraft(parsed.data);
    return NextResponse.json({ asset, jobId }, { status: 201 });
  } catch (err: any) {
    console.error("Image generation error:", err);
    return NextResponse.json({ error: err.message ?? "Image generation failed" }, { status: 500 });
  }
}
