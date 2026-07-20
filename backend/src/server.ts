import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/env';
import { ensureStorageDirExists } from './services/storageService';
import { startGarbageCollectorCron } from './services/garbageCollectorService';
import { initWebSocketServer } from './services/websocketService';
import authRoutes from './routes/authRoutes';
import fileRoutes from './routes/fileRoutes';
import adminRoutes from './routes/adminRoutes';

ensureStorageDirExists();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', system: 'SyncCloud Deduplication Backend', time: new Date() });
});

const server = http.createServer(app);

// Attach WebSocket server
initWebSocketServer(server);

// Start Garbage Collector (checks every 60s)
startGarbageCollectorCron(60 * 1000);

server.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SyncCloud VPS Backend Server Running`);
  console.log(`🌐 HTTP API: http://localhost:${config.port}/api/v1`);
  console.log(`⚡ WebSocket Server attached to http://localhost:${config.port}`);
  console.log(`💾 Storage Quota: ${config.maxStorageGb} GB`);
  console.log(`📂 Physical Storage: ${config.storagePhysicalPath}`);
  console.log(`=======================================================`);
});
