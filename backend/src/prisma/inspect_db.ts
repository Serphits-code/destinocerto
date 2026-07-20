import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== USERS ===');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  console.log(users);

  console.log('=== FOLDERS ===');
  const folders = await prisma.folder.findMany({
    select: { id: true, name: true, ownerUserId: true, parentFolderId: true },
  });
  console.log(folders);

  console.log('=== FILE POINTERS ===');
  const files = await prisma.filePointer.findMany({
    select: { id: true, originalName: true, userId: true, folderId: true },
  });
  console.log(files);

  console.log('=== PERMISSIONS ===');
  const perms = await prisma.permission.findMany();
  console.log(perms);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
