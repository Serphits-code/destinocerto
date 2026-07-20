import { prisma } from '../db/prisma';

export type AccessLevel = 'NONE' | 'READ' | 'READ_WRITE';

export async function getUserFolderAccessLevel(
  userId: string,
  userRole: string,
  folderId: string | null
): Promise<AccessLevel> {
  // ADMIN has full access everywhere
  if (userRole === 'ADMIN') {
    return 'READ_WRITE';
  }

  // Root container level
  if (!folderId) {
    return 'READ_WRITE';
  }

  let currentFolderId: string | null = folderId;
  let isTargetFolder = true;

  while (currentFolderId) {
    // Check explicit permission matrix set by Admin
    const perm = await prisma.permission.findUnique({
      where: {
        userId_folderId: {
          userId,
          folderId: currentFolderId,
        },
      },
    });

    if (perm) {
      return perm.accessLevel as AccessLevel;
    }

    const folder = await prisma.folder.findUnique({
      where: { id: currentFolderId },
      select: { ownerUserId: true, parentFolderId: true },
    });

    if (folder && folder.ownerUserId) {
      // If user is the owner of this user folder -> full access!
      if (folder.ownerUserId === userId) {
        return 'READ_WRITE';
      }
      // If folder belongs to another user and no explicit permission granted by admin -> block!
      return 'NONE';
    }

    currentFolderId = folder ? folder.parentFolderId : null;
    isTargetFolder = false;
  }

  return 'READ_WRITE';
}

export async function canUserAccessFolder(
  userId: string,
  userRole: string,
  folderId: string | null,
  requiredLevel: 'READ' | 'READ_WRITE'
): Promise<boolean> {
  const level = await getUserFolderAccessLevel(userId, userRole, folderId);
  if (level === 'NONE') return false;
  if (requiredLevel === 'READ_WRITE' && level !== 'READ_WRITE') return false;
  return true;
}
