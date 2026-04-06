import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

// Debug: check workspace + IG account alignment
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  let payload: any;
  try {
    ({ payload } = await jwtVerify(token, JWT_SECRET));
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const jwtWsId = payload.workspaceId as string;
  const userId = payload.sub as string;

  // Find the user's workspaces via the User->WorkspaceMember->Workspace join
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });

  // Get the draft being published (if id provided)
  const draftId = new URL(req.url).searchParams.get("draftId");
  let draftWsId: string | null = null;
  if (draftId) {
    const draft = await prisma.draft.findUnique({ where: { id: draftId } });
    draftWsId = draft?.workspaceId ?? null;
  }

  // Get all IG accounts in the user's workspaces AND in the JWT's workspace
  const wsIds = memberships.map(m => m.workspaceId);
  // Also include the JWT's workspaceId directly (handles cases where memberships aren't set up)
  const allWsIds = [...new Set([jwtWsId, ...wsIds])];

  const igAccounts = await prisma.socialAccount.findMany({
    where: { workspaceId: { in: allWsIds }, platform: "INSTAGRAM", instagramId: { not: null } },
  });

  // Try decrypting tokens
  const accountsWithDecrypt = igAccounts
    .filter(a => a.accessToken)
    .map(a => {
      try {
        const decrypted = decryptToken(a.accessToken!);
        return { ...a, tokenDecrypts: true, tokenPrefix: decrypted.slice(0, 10) };
      } catch {
        return { ...a, tokenDecrypts: false, tokenPrefix: null };
      }
    });

  return NextResponse.json({
    userId,
    jwtWorkspaceId: jwtWsId,
    userWorkspaces: memberships.map(m => ({ wsId: m.workspaceId, name: m.workspace.name })),
    draftWorkspaceId: draftWsId,
    igAccounts: accountsWithDecrypt.map(a => ({
      wsId: a.workspaceId,
      igId: a.instagramId,
      username: a.username,
      tokenDecrypts: a.tokenDecrypts,
      tokenPrefix: a.tokenPrefix,
      isProfessional: a.isProfessional,
      accountStatus: a.accountStatus,
    })),
  });
}
