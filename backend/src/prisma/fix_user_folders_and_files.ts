import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing dual Gustavo folders and mapping files...');

  const almeidaUser = await prisma.user.findFirst({
    where: { email: 'almeidaestudios@outlook.com' },
  });

  const demoUser = await prisma.user.findFirst({
    where: { email: 'user@synccloud.com' },
  });

  if (!almeidaUser) return;

  // 1. Rename almeidaestudios folder to be distinct and unambiguous
  const almeidaFolder = await prisma.folder.findFirst({
    where: { ownerUserId: almeidaUser.id },
  });

  if (almeidaFolder) {
    await prisma.folder.update({
      where: { id: almeidaFolder.id },
      data: { name: 'Pasta de Gustavo (almeidaestudios)' },
    });

    // 2. Re-assign files created by almeidaestudios to almeidaFolder.id
    await prisma.filePointer.updateMany({
      where: { userId: almeidaUser.id },
      data: { folderId: almeidaFolder.id },
    });

    // 3. Grant READ_WRITE permission to Demo User on almeidaFolder
    if (demoUser) {
      await prisma.permission.upsert({
        where: {
          userId_folderId: { userId: demoUser.id, folderId: almeidaFolder.id },
        },
        update: { accessLevel: 'READ_WRITE' },
        create: { userId: demoUser.id, folderId: almeidaFolder.id, accessLevel: 'READ_WRITE' },
      });
    }
  }

  console.log('Database folders and file pointers updated cleanly!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
