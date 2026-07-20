import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing file pointer folder IDs in database...');

  const gustavoFolder = await prisma.folder.findFirst({
    where: { name: { contains: 'Gustavo' } },
  });

  const adminFolder = await prisma.folder.findFirst({
    where: { name: { contains: 'Administrador' } },
  });

  const defaultFolderId = gustavoFolder?.id || adminFolder?.id;

  if (!defaultFolderId) {
    console.log('No user folder found.');
    return;
  }

  // Update all file pointers that have null or empty folderId
  const result = await prisma.filePointer.updateMany({
    where: {
      OR: [
        { folderId: null },
        { folderId: '' },
      ],
    },
    data: {
      folderId: defaultFolderId,
    },
  });

  console.log(`Updated ${result.count} file(s) to folder ID: ${defaultFolderId} (${gustavoFolder?.name})`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
