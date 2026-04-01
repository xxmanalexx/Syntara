import { prisma } from "@/lib/db";
import { AnalyticsSyncService } from "@/lib/services/analytics-service";

export class AnalyticsWorker {
  async run(): Promise<{ synced: number; errors: number }> {
    const accounts = await prisma.socialAccount.findMany({
      where: {
        accountStatus: "ACTIVE",
        platform: "INSTAGRAM",
        accessToken: { not: null },
      },
    });

    let synced = 0;
    let errors = 0;

    for (const account of accounts) {
      if (!account.accessToken || !account.instagramId) continue;

      try {
        const service = new AnalyticsSyncService(account.accessToken, account.instagramId);
        const snapshots = await service.syncRecentMedia(account.workspaceId, account.id);
        synced += snapshots.length;
      } catch (err) {
        errors++;
        console.error(`Analytics worker error for account ${account.id}:`, err);
      }
    }

    return { synced, errors };
  }
}
