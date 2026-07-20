import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileExplorer } from './components/FileExplorer';
import { FilePreviewModal } from './components/FilePreviewModal';
import { AdminACL } from './components/AdminACL';
import { AuthModal } from './components/AuthModal';
import { User, Folder, FilePointer, QuotaInfo } from './types';
import { apiFetch, getAuthToken, removeAuthToken } from './services/api';
import { wsClient } from './services/websocket';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'admin'>('files');
  const [wsConnected, setWsConnected] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FilePointer[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<FilePointer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const checkAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }

    try {
      const data = await apiFetch('/auth/me');
      setUser(data.user);
      if (data.user.role !== 'ADMIN') {
        setActiveTab('files');
      }
    } catch (err) {
      removeAuthToken();
      setUser(null);
      setActiveTab('files');
    } finally {
      setAuthChecked(true);
    }
  };

  const loadData = async () => {
    if (!user) return;
    try {
      const tree = await apiFetch('/files/tree');
      const quotaData = await apiFetch('/files/quota');
      setFolders(tree.folders);
      setFiles(tree.files);
      setQuota(quotaData);
    } catch (err: any) {
      console.error('Data load error:', err);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleExpired = () => {
      setUser(null);
      setActiveTab('files');
    };
    window.addEventListener('auth_expired', handleExpired);
    return () => window.removeEventListener('auth_expired', handleExpired);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.role !== 'ADMIN' && activeTab === 'admin') {
      setActiveTab('files');
    }

    loadData();

    wsClient.connect();
    const unsubscribe = wsClient.subscribe((event, payload) => {
      if (event === 'STATUS_CHANGE') {
        setWsConnected(payload.connected);
      } else if (event === 'QUOTA_UPDATE') {
        setQuota(payload);
      } else if (['FILE_SYNCED', 'FILE_DELETED', 'GC_COMPLETED'].includes(event)) {
        loadData();
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    setActiveTab('files');
    setSelectedFolderId(null);
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role !== 'ADMIN') {
      setActiveTab('files');
    }
  };

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const currentFolderPath = currentFolder
    ? `☁️ SyncCloud > ${currentFolder.name}`
    : `☁️ SyncCloud > Início`;

  const handleNavigateUp = () => {
    if (currentFolder && currentFolder.parentFolderId) {
      setSelectedFolderId(currentFolder.parentFolderId);
    } else {
      setSelectedFolderId(null);
    }
  };

  if (!authChecked) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>Carregando SyncCloud...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }}>
      {!user && <AuthModal onLoginSuccess={handleLoginSuccess} />}

      {user && (
        <>
          <Header
            user={user}
            wsConnected={wsConnected}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={handleLogout}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            currentFolderPath={currentFolderPath}
            onNavigateUp={handleNavigateUp}
          />

          {activeTab === 'admin' && user.role === 'ADMIN' ? (
            <AdminACL folders={folders} onRefresh={loadData} />
          ) : (
            <FileExplorer
              user={user}
              folders={folders}
              files={files}
              quota={quota}
              searchQuery={searchQuery}
              onRefresh={loadData}
              onSelectPreview={(file) => setSelectedPreview(file)}
              onSelectFolder={(id) => setSelectedFolderId(id)}
              selectedFolderId={selectedFolderId}
            />
          )}

          <FilePreviewModal
            file={selectedPreview}
            onClose={() => setSelectedPreview(null)}
            onDownload={(file) => {
              const token = getAuthToken();
              const link = document.createElement('a');
              link.href = `/api/v1/files/download/${file.id}?token=${token}`;
              link.download = file.originalName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          />
        </>
      )}
    </div>
  );
};
