import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning duplicates and seeding strictly unique USER ROOT FOLDERS...');

  // 1. Delete all existing folders and permissions to eliminate duplicates
  await prisma.permission.deleteMany({});
  await prisma.filePointer.deleteMany({});
  await prisma.folder.deleteMany({});

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const userPasswordHash = await bcrypt.hash('user123', 10);
  const gustavoPasswordHash = await bcrypt.hash('gustavo123', 10);

  // 2. Create/Update Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@synccloud.com' },
    update: { name: 'Administrador System' },
    create: {
      name: 'Administrador System',
      email: 'admin@synccloud.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const regularUser = await prisma.user.upsert({
    where: { email: 'user@synccloud.com' },
    update: { name: 'Usuário Demo' },
    create: {
      name: 'Usuário Demo',
      email: 'user@synccloud.com',
      passwordHash: userPasswordHash,
      role: 'USER',
    },
  });

  const gustavoUser = await prisma.user.upsert({
    where: { email: 'gustavo@synccloud.com' },
    update: { name: 'Gustavo' },
    create: {
      name: 'Gustavo',
      email: 'gustavo@synccloud.com',
      passwordHash: gustavoPasswordHash,
      role: 'USER',
    },
  });

  // 3. Create Unique User Root Folders ONLY
  const adminFolder = await prisma.folder.create({
    data: {
      id: 'folder-root-admin',
      name: 'Pasta de Administrador',
      ownerUserId: admin.id,
    },
  });

  const userFolder = await prisma.folder.create({
    data: {
      id: 'folder-root-user-demo',
      name: 'Pasta de Usuário Demo',
      ownerUserId: regularUser.id,
    },
  });

  const gustavoFolder = await prisma.folder.create({
    data: {
      id: 'folder-root-gustavo',
      name: 'Pasta de Gustavo',
      ownerUserId: gustavoUser.id,
    },
  });

  // Assign permissions
  await prisma.permission.create({
    data: { userId: regularUser.id, folderId: userFolder.id, accessLevel: 'READ_WRITE' },
  });

  await prisma.permission.create({
    data: { userId: gustavoUser.id, folderId: gustavoFolder.id, accessLevel: 'READ_WRITE' },
  });

  console.log('Seed completed! Database has exactly 3 unique user root folders.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
