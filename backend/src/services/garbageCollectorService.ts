import fs from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';
import { config } from '../config/env';
import { getQuotaInfo } from './storageService';
import { broadcastEvent } from './websocketService';

export async function runGarbageCollector() {
  console.log('[GarbageCollector] Executing cycle...');

  // Find physical objects with 0 file pointers
  const orphanObjects = await prisma.physicalObject.findMany({
    where: {
      pointers: {
        none: {},
      },
    },
  });

  let purgedCount = 0;
  let freedBytes = 0;

  for (const obj of orphanObjects) {
    const physicalPath = path.join(config.storagePhysicalPath, `${obj.hashSha256}.bin`);
    
    // Delete file from disk if it exists
    if (fs.existsSync(physicalPath)) {
      try {
        fs.unlinkSync(physicalPath);
      } catch (err) {
        console.error(`[GarbageCollector] Error deleting physical file ${physicalPath}:`, err);
      }
    }

    // Delete record from DB
    await prisma.physicalObject.delete({
      where: { hashSha256: obj.hashSha256 },
    });

    purgedCount++;
    freedBytes += obj.sizeBytes;
  }

  if (purgedCount > 0) {
    console.log(
      `[GarbageCollector] Purged ${purgedCount} orphan object(s), freed ${(
        freedBytes /
        (1024 * 1024)
      ).toFixed(2)} MB.`
    );
    const updatedQuota = await getQuotaInfo();
    broadcastEvent('QUOTA_UPDATE', updatedQuota);
    broadcastEvent('GC_COMPLETED', { purgedCount, freedBytes });
  }

  return { purgedCount, freedBytes };
}

let gcInterval: NodeJS.Timeout | null = null;

export function startGarbageCollectorCron(intervalMs: number = 60 * 1000) {
  if (gcInterval) clearInterval(gcInterval);
  gcInterval = setInterval(() => {
    runGarbageCollector().catch((err) => {
      console.error('[GarbageCollector] Periodic run failed:', err);
    });
  }, intervalMs);
  console.log(`[GarbageCollector] Cron active every ${intervalMs / 1000}s`);
}
