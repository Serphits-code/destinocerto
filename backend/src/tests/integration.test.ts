import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';
import { savePhysicalObject, createFilePointer, getPhysicalUsageBytes, checkHash } from '../services/storageService';
import { runGarbageCollector } from '../services/garbageCollectorService';

async function runTests() {
  console.log('--- RUNNING BACKEND DEDUPLICATION & GC INTEGRATION TESTS ---');

  // 1. Create dummy user & folder in DB
  const user = await prisma.user.upsert({
    where: { email: 'test_runner@synccloud.com' },
    update: {},
    create: {
      name: 'Test Runner',
      email: 'test_runner@synccloud.com',
      passwordHash: 'hashed',
      role: 'USER',
    },
  });

  const folder = await prisma.folder.upsert({
    where: { id: 'test-folder-1' },
    update: {},
    create: {
      id: 'test-folder-1',
      name: 'Test Folder',
    },
  });

  // 2. Create sample file content & calculate SHA-256 hash
  const fileContent = 'SyncCloud SHA-256 Deduplication Test Content 2026!';
  const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
  const tempFilePath1 = path.resolve(__dirname, './temp_test_file_1.txt');
  const tempFilePath2 = path.resolve(__dirname, './temp_test_file_2.txt');

  fs.writeFileSync(tempFilePath1, fileContent);
  fs.writeFileSync(tempFilePath2, fileContent);

  console.log(`[Test 1] SHA-256 Hash calculated: ${hash}`);

  // 3. Save first physical object
  const save1 = await savePhysicalObject(hash, tempFilePath1, Buffer.byteLength(fileContent));
  console.log(`[Test 2] First save result (deduplicated: ${save1.deduplicated})`);
  if (save1.deduplicated) throw new Error('First save should NOT be deduplicated');

  // 4. Save second physical object with SAME hash (should deduplicate!)
  const save2 = await savePhysicalObject(hash, tempFilePath2, Buffer.byteLength(fileContent));
  console.log(`[Test 3] Second save result (deduplicated: ${save2.deduplicated})`);
  if (!save2.deduplicated) throw new Error('Second save SHOULD be deduplicated');

  // 5. Create two pointers for different users/names pointing to same physical object
  const p1 = await createFilePointer(user.id, folder.id, 'UserA_Report.pdf', hash);
  const p2 = await createFilePointer(user.id, folder.id, 'UserB_Document.pdf', hash);
  console.log(`[Test 4] Logical Pointers created: ${p1.id} (${p1.originalName}) & ${p2.id} (${p2.originalName})`);

  // 6. Check physical object count in DB
  const physicalObjCount = await prisma.physicalObject.count({ where: { hashSha256: hash } });
  console.log(`[Test 5] Physical Objects in DB for hash: ${physicalObjCount} (Expected: 1)`);
  if (physicalObjCount !== 1) throw new Error('Expected exactly 1 physical object in DB');

  // 7. Delete 1 pointer & run GC -> Physical file must REMAIN
  await prisma.filePointer.delete({ where: { id: p1.id } });
  const gcResult1 = await runGarbageCollector();
  console.log(`[Test 6] GC run after deleting 1 of 2 pointers -> Purged count: ${gcResult1.purgedCount}`);
  if (gcResult1.purgedCount !== 0) throw new Error('Physical file should NOT be purged while 1 pointer exists');

  // 8. Delete 2nd pointer & run GC -> Physical file must BE PURGED
  await prisma.filePointer.delete({ where: { id: p2.id } });
  const gcResult2 = await runGarbageCollector();
  console.log(`[Test 7] GC run after deleting last pointer -> Purged count: ${gcResult2.purgedCount}`);
  if (gcResult2.purgedCount !== 1) throw new Error('Physical file SHOULD be purged when 0 pointers remain');

  console.log('✅ ALL BACKEND DEDUPLICATION & GC INTEGRATION TESTS PASSED!');
}

runTests()
  .catch((err) => {
    console.error('❌ Integration tests failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
