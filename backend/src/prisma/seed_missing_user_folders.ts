import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring all users have matching user root folders in DB...');

  const users = await prisma.user.findMany({
    include: { ownedFolders: true },
  });

  for (const u of users) {
    if (u.ownedFolders.length === 0) {
      console.log(`Creating missing root folder for user ${u.name} (${u.email})...`);
      const userFolder = await prisma.folder.create({
        data: {
          id: `folder-root-${u.id}`,
          name: `Pasta de ${u.name}`,
          ownerUserId: u.id,
        },
      });

      await prisma.permission.upsert({
        where: {
          userId_folderId: { userId: u.id, folderId: userFolder.id },
        },
        update: { accessLevel: 'READ_WRITE' },
        create: { userId: u.id, folderId: userFolder.id, accessLevel: 'READ_WRITE' },
      });
    }
  }

  console.log('All user root folders verified!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
