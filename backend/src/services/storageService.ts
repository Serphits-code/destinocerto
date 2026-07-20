import fs from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';
import { config } from '../config/env';
import { broadcastEvent } from './websocketService';

export function ensureStorageDirExists() {
  if (!fs.existsSync(config.storagePhysicalPath)) {
    fs.mkdirSync(config.storagePhysicalPath, { recursive: true });
  }
}

export async function getPhysicalUsageBytes(): Promise<number> {
  const result = await prisma.physicalObject.aggregate({
    _sum: {
      sizeBytes: true,
    },
  });
  return result._sum.sizeBytes || 0;
}

export async function getQuotaInfo() {
  const usedBytes = await getPhysicalUsageBytes();
  const maxBytes = Math.floor(config.maxStorageGb * 1024 * 1024 * 1024);
  const percentageUsed = maxBytes > 0 ? (usedBytes / maxBytes) * 100 : 0;

  return {
    maxStorageGb: config.maxStorageGb,
    maxBytes,
    usedBytes,
    availableBytes: Math.max(0, maxBytes - usedBytes),
    percentageUsed: parseFloat(percentageUsed.toFixed(2)),
  };
}

export async function checkHash(hashSha256: string) {
  ensureStorageDirExists();
  const existing = await prisma.physicalObject.findUnique({
    where: { hashSha256 },
  });

  const targetPath = path.join(config.storagePhysicalPath, `${hashSha256}.bin`);
  const fileExistsOnDisk = fs.existsSync(targetPath);

  if (existing && fileExistsOnDisk) {
    return { exists: true, sizeBytes: existing.sizeBytes };
  }
  return { exists: false };
}

export async function savePhysicalObject(
  hashSha256: string,
  tempFilePath: string,
  sizeBytes: number
) {
  ensureStorageDirExists();

  const quota = await getQuotaInfo();
  const existing = await checkHash(hashSha256);

  if (existing.exists) {
    // Already exists physical object! Deduplication achieved!
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        // ignore temp file cleanup errors
      }
    }
    return { deduplicated: true, hashSha256, sizeBytes: existing.sizeBytes };
  }

  // Enforce global storage quota limit
  if (quota.usedBytes + sizeBytes > quota.maxBytes) {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {}
    }
    throw new Error(
      `Cota de armazenamento da VPS excedida (${config.maxStorageGb} GB). Upload bloqueado.`
    );
  }

  const destinationPath = path.join(config.storagePhysicalPath, `${hashSha256}.bin`);
  fs.renameSync(tempFilePath, destinationPath);

  const physicalObj = await prisma.physicalObject.create({
    data: {
      hashSha256,
      sizeBytes,
    },
  });

  // Broadcast quota update
  const updatedQuota = await getQuotaInfo();
  broadcastEvent('QUOTA_UPDATE', updatedQuota);

  return { deduplicated: false, hashSha256, sizeBytes: physicalObj.sizeBytes };
}

export async function createFilePointer(
  userId: string,
  folderId: string | null,
  originalName: string,
  hashSha256: string
) {
  const ext = path.extname(originalName).replace('.', '').toLowerCase();

  // Check if pointer with same name in same folder already exists for user
  const existingPointer = await prisma.filePointer.findFirst({
    where: {
      userId,
      folderId: folderId || null,
      originalName,
    },
  });

  let pointer;
  if (existingPointer) {
    pointer = await prisma.filePointer.update({
      where: { id: existingPointer.id },
      data: { hashSha256, fileExtension: ext, updatedAt: new Date() },
    });
  } else {
    pointer = await prisma.filePointer.create({
      data: {
        userId,
        folderId: folderId || null,
        originalName,
        fileExtension: ext,
        hashSha256,
      },
    });
  }

  broadcastEvent('FILE_SYNCED', { pointerId: pointer.id, originalName, userId });
  return pointer;
}

export function getPhysicalObjectPath(hashSha256: string): string {
  return path.join(config.storagePhysicalPath, `${hashSha256}.bin`);
}
