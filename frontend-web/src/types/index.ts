export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt?: string;
  storageBytes?: number;
  folderId?: string | null;
  folderName?: string | null;
}

export interface Folder {
  id: string;
  parentFolderId: string | null;
  ownerUserId?: string | null;
  name: string;
  accessLevel?: 'NONE' | 'READ' | 'READ_WRITE';
  createdAt: string;
}

export interface FilePointer {
  id: string;
  folderId: string | null;
  userId: string;
  originalName: string;
  fileExtension: string;
  hashSha256: string;
  createdAt: string;
  physicalObject?: {
    sizeBytes: number;
    createdAt: string;
  };
  user?: {
    name: string;
    email: string;
  };
}

export interface QuotaInfo {
  maxStorageGb: number;
  maxBytes: number;
  usedBytes: number;
  availableBytes: number;
  percentageUsed: number;
}

export interface Permission {
  id: string;
  userId: string;
  folderId: string;
  accessLevel: 'NONE' | 'READ' | 'READ_WRITE';
  user: {
    id: string;
    name: string;
    email: string;
  };
  folder: {
    id: string;
    name: string;
  };
}
