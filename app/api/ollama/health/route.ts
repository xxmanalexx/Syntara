import { NextResponse } from "next/server";
import { OllamaClient } from "@/lib/integrations/ollama/client";

const client = new OllamaClient();

export async function GET() {
  try {
    const health = await client.healthCheck();
    return NextResponse.json(health);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
  }
}
