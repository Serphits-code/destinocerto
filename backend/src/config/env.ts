import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root or local .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  websocketPort: parseInt(process.env.WEBSOCKET_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  maxStorageGb: parseFloat(process.env.MAX_STORAGE_GB || '20'),
  storagePhysicalPath: path.resolve(
    process.cwd(),
    process.env.STORAGE_PHYSICAL_PATH || './storage/objects'
  ),
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_almeida_studios_2026',
  hashSaltRounds: parseInt(process.env.HASH_SALT_ROUNDS || '12', 10),
};
