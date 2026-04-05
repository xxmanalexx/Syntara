import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const workspaceId = payload.workspaceId as string;

    const settings = await prisma.workspaceSettings.findUnique({
      where: { workspaceId },
    });

    return NextResponse.json({ settings: settings ? { ...settings, workspaceId } : null });
  } catch (err) {
    console.error("Settings GET error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", detail: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const workspaceId = payload.workspaceId as string;

    const body = await req.json();
    const {
      ollamaBaseUrl,
      ollamaTextModel,
      ollamaEmbeddingsModel,
      nanobananaApiKey,
      nanobananaBaseUrl,
    } = body;

    const settings = await prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        ollamaBaseUrl: ollamaBaseUrl ?? "http://localhost:11434",
        ollamaTextModel: ollamaTextModel ?? "llama3.2:latest",
        ollamaEmbeddingsModel: ollamaEmbeddingsModel ?? "nomic-embed-text:latest",
        nanobananaApiKey: nanobananaApiKey ?? null,
        nanobananaBaseUrl: nanobananaBaseUrl ?? "https://api.nanobanana.io/v1",
      },
      update: {
        ...(ollamaBaseUrl !== undefined && { ollamaBaseUrl }),
        ...(ollamaTextModel !== undefined && { ollamaTextModel }),
        ...(ollamaEmbeddingsModel !== undefined && { ollamaEmbeddingsModel }),
        ...(nanobananaApiKey !== undefined && { nanobananaApiKey }),
        ...(nanobananaBaseUrl !== undefined && { nanobananaBaseUrl }),
      },
    });

    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Settings PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
