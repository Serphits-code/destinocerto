import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';
import { authenticateJwt, AuthRequest } from '../middleware/authMiddleware';
import {
  checkHash,
  savePhysicalObject,
  createFilePointer,
  getQuotaInfo,
  getPhysicalObjectPath,
} from '../services/storageService';
import { canUserAccessFolder, getUserFolderAccessLevel } from '../services/aclService';
import { runGarbageCollector } from '../services/garbageCollectorService';

const upload = multer({ dest: path.resolve(process.cwd(), './storage/temp') });
const router = Router();

// Check if SHA-256 hash already exists physically
router.post('/check-hash', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { hash } = req.body;
    if (!hash) {
      return res.status(400).json({ error: 'Hash SHA-256 é obrigatório' });
    }

    const result = await checkHash(hash);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Upload file (either full upload or linking existing hash pointer)
router.post(
  '/upload',
  authenticateJwt,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { hash, originalName, folderId } = req.body;
      let targetFolderId = folderId && folderId !== 'null' && folderId !== 'undefined' && folderId !== '' ? folderId : null;

      // If upload has no target folder, auto-route to user's own root folder (e.g. Pasta de Gustavo)
      if (!targetFolderId) {
        const userRoot = await prisma.folder.findFirst({
          where: { ownerUserId: userId, parentFolderId: null },
        });
        if (userRoot) {
          targetFolderId = userRoot.id;
        }
      }

      if (!hash || !originalName) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Hash e nome do arquivo são obrigatórios' });
      }

      // ACL Check: READ_WRITE permission required on folder
      const hasPermission = await canUserAccessFolder(userId, userRole, targetFolderId, 'READ_WRITE');
      if (!hasPermission) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Permissão insuficiente para upload nesta pasta' });
      }

      let saveResult;
      if (req.file) {
        // Full file uploaded
        saveResult = await savePhysicalObject(hash, req.file.path, req.file.size);
      } else {
        // Link existing hash directly (deduplication without upload stream)
        const check = await checkHash(hash);
        if (!check.exists) {
          return res.status(400).json({
            error: 'Arquivo físico não encontrado na VPS. Envie o conteúdo do arquivo.',
          });
        }
        saveResult = { deduplicated: true, hashSha256: hash, sizeBytes: check.sizeBytes! };
      }

      // Create Logical Pointer
      const pointer = await createFilePointer(userId, targetFolderId, originalName, hash);

      return res.status(201).json({
        message: saveResult.deduplicated
          ? 'Arquivo sincronizado instantaneamente via deduplicação por Hash!'
          : 'Upload realizado com sucesso!',
        deduplicated: saveResult.deduplicated,
        filePointer: pointer,
      });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: err.message });
    }
  }
);

// Download file pointer
router.get('/download/:pointerId', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { pointerId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const pointer = await prisma.filePointer.findUnique({
      where: { id: pointerId },
      include: { physicalObject: true },
    });

    if (!pointer) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // ACL Check
    const hasPermission = await canUserAccessFolder(userId, userRole, pointer.folderId, 'READ');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permissão negada para acessar este arquivo' });
    }

    const physicalPath = getPhysicalObjectPath(pointer.hashSha256);
    if (!fs.existsSync(physicalPath)) {
      return res.status(404).json({ error: 'Objeto físico não encontrado em disco na VPS' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(pointer.originalName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const fileStream = fs.createReadStream(physicalPath);
    fileStream.pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete file pointer
router.delete('/:pointerId', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { pointerId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const pointer = await prisma.filePointer.findUnique({ where: { id: pointerId } });
    if (!pointer) {
      return res.status(404).json({ error: 'Ponteiro de arquivo não encontrado' });
    }

    const hasPermission = await canUserAccessFolder(userId, userRole, pointer.folderId, 'READ_WRITE');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permissão insuficiente para excluir este arquivo' });
    }

    await prisma.filePointer.delete({ where: { id: pointerId } });

    // Trigger Garbage Collector to clean orphaned physical files if applicable
    runGarbageCollector().catch((err) => console.error('GC trigger error:', err));

    return res.json({ message: 'Arquivo excluído com sucesso' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get file & folder tree
router.get('/tree', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const allFolders = await prisma.folder.findMany({
      orderBy: { name: 'asc' },
    });

    // Filter folders accessible to user & deduplicate by ID
    const accessibleFolders = [];
    const seenFolderIds = new Set<string>();

    for (const f of allFolders) {
      if (seenFolderIds.has(f.id)) continue;
      const level = await getUserFolderAccessLevel(userId, userRole, f.id);
      if (level !== 'NONE') {
        seenFolderIds.add(f.id);
        accessibleFolders.push({ ...f, accessLevel: level });
      }
    }

    const filePointers = await prisma.filePointer.findMany({
      include: {
        physicalObject: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter file pointers according to user ACL and map null folderId to owner's root folder
    const accessibleFiles = [];
    for (const file of filePointers) {
      let effectiveFolderId = file.folderId;
      if (!effectiveFolderId) {
        const ownerRoot = accessibleFolders.find((f) => f.ownerUserId === file.userId && f.parentFolderId === null);
        if (ownerRoot) {
          effectiveFolderId = ownerRoot.id;
        }
      }
      const level = await getUserFolderAccessLevel(userId, userRole, effectiveFolderId);
      if (level !== 'NONE') {
        accessibleFiles.push({ ...file, folderId: effectiveFolderId });
      }
    }

    return res.json({
      folders: accessibleFolders,
      files: accessibleFiles,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper to resolve the top-level owner of a folder tree
async function getFolderRootOwner(folderId: string): Promise<string | null> {
  let currentId: string | null = folderId;
  while (currentId) {
    const folder = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { ownerUserId: true, parentFolderId: true },
    });
    if (!folder) return null;
    if (folder.ownerUserId) return folder.ownerUserId;
    currentId = folder.parentFolderId;
  }
  return null;
}

// Create Folder (Restricted to original account owner or Admin)
router.post('/folders', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentFolderId } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!name) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    }

    const parentId = parentFolderId && parentFolderId !== 'null' ? parentFolderId : null;

    // Enforce rule: Only original folder owner or Admin can create subfolders
    if (parentId && userRole !== 'ADMIN') {
      const rootOwnerUserId = await getFolderRootOwner(parentId);
      if (rootOwnerUserId && rootOwnerUserId !== userId) {
        return res.status(403).json({
          error: 'Apenas o dono original da conta pode criar e organizar subpastas nesta pasta.',
        });
      }
    }

    const hasPermission = await canUserAccessFolder(userId, userRole, parentId, 'READ_WRITE');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permissão insuficiente nesta pasta' });
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        parentFolderId: parentId,
        ownerUserId: parentId ? null : userId,
      },
    });

    return res.status(201).json(folder);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete Folder
router.delete('/folders/:folderId', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const hasPermission = await canUserAccessFolder(userId, userRole, folderId, 'READ_WRITE');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permissão insuficiente para excluir esta pasta' });
    }

    await prisma.folder.delete({ where: { id: folderId } });

    // Trigger Garbage Collector
    runGarbageCollector().catch((err) => console.error('GC trigger error:', err));

    return res.json({ message: 'Pasta excluída com sucesso' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get Quota info
router.get('/quota', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const info = await getQuotaInfo();
    return res.json(info);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
