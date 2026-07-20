import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { authenticateJwt, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import { runGarbageCollector } from '../services/garbageCollectorService';

const router = Router();

router.use(authenticateJwt, requireAdmin);

// List all users with calculated storage usage and root folder ID
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        ownedFolders: {
          select: { id: true, name: true },
        },
        filePointers: {
          select: {
            physicalObject: {
              select: { sizeBytes: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map((u) => {
      const storageBytes = u.filePointers.reduce(
        (acc, fp) => acc + (fp.physicalObject?.sizeBytes || 0),
        0
      );
      const userFolder = u.ownedFolders[0] || null;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        storageBytes,
        folderId: userFolder?.id || null,
        folderName: userFolder?.name || null,
      };
    });

    return res.json(formattedUsers);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create user + unique user root folder
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      },
    });

    // Create unique user root folder
    const userFolder = await prisma.folder.create({
      data: {
        name: `Pasta de ${newUser.name}`,
        ownerUserId: newUser.id,
      },
    });

    // Grant owner READ_WRITE permission
    await prisma.permission.create({
      data: {
        userId: newUser.id,
        folderId: userFolder.id,
        accessLevel: 'READ_WRITE',
      },
    });

    return res.status(201).json(newUser);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update user details (Login, Email, Password, Role)
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    if (password && password.trim().length > 0) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true },
    });

    return res.json(updatedUser);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Não é possível excluir a própria conta logada' });
    }

    await prisma.user.delete({ where: { id } });

    runGarbageCollector().catch((err) => console.error(err));

    return res.json({ message: 'Usuário removido com sucesso' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get ACL permissions list
router.get('/permissions', async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        folder: { select: { id: true, name: true } },
      },
    });
    return res.json(permissions);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update ACL permission matrix
router.post('/permissions', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, folderId, accessLevel } = req.body;
    if (!userId || !folderId || !accessLevel) {
      return res.status(400).json({ error: 'userId, folderId e accessLevel são obrigatórios' });
    }

    if (!['NONE', 'READ', 'READ_WRITE'].includes(accessLevel)) {
      return res.status(400).json({ error: 'accessLevel inválido (use NONE, READ ou READ_WRITE)' });
    }

    // Ensure target folder exists in DB first to prevent Foreign Key constraint errors
    let targetFolder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!targetFolder) {
      const ownerUserId = folderId.startsWith('folder-root-') ? folderId.replace('folder-root-', '') : null;
      const ownerUser = ownerUserId ? await prisma.user.findUnique({ where: { id: ownerUserId } }) : null;

      targetFolder = await prisma.folder.create({
        data: {
          id: folderId,
          name: ownerUser ? `Pasta de ${ownerUser.name}` : 'Pasta de Usuário',
          ownerUserId: ownerUser ? ownerUser.id : null,
        },
      });
    }

    const perm = await prisma.permission.upsert({
      where: {
        userId_folderId: { userId, folderId: targetFolder.id },
      },
      update: { accessLevel },
      create: { userId, folderId: targetFolder.id, accessLevel },
    });

    return res.json(perm);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Run Garbage Collector
router.post('/gc/run', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await runGarbageCollector();
    return res.json({
      message: 'Garbage Collector executado com sucesso!',
      ...summary,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
