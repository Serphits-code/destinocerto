import React, { useState } from 'react';
import {
  Folder as FolderIcon,
  FileText,
  UploadCloud,
  Plus,
  Trash2,
  Download,
  Search,
  Grid,
  List,
  FolderPlus,
  Home,
  HardDrive,
  FileCode,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FolderSync,
  CheckCircle2,
  FolderOpen,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { User, Folder, FilePointer, QuotaInfo } from '../types';
import { formatBytes, calculateFileHash } from '../utils/hash';
import { apiFetch, getAuthToken } from '../services/api';
import { QuotaBar } from './QuotaBar';

interface FileExplorerProps {
  user: User;
  folders: Folder[];
  files: FilePointer[];
  quota: QuotaInfo | null;
  searchQuery: string;
  onRefresh: () => void;
  onSelectPreview: (file: FilePointer) => void;
  onSelectFolder: (folderId: string | null) => void;
  selectedFolderId: string | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  user,
  folders,
  files,
  quota,
  searchQuery,
  onRefresh,
  onSelectPreview,
  onSelectFolder,
  selectedFolderId,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [localSyncPath, setLocalSyncPath] = useState<string>(() => {
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const dir = ipcRenderer.sendSync('get_sync_folder');
        if (dir) return dir;
      } catch (err) {}
    }
    return localStorage.getItem('synccloud_local_sync_path') || 'C:\\Users\\SyncCloud';
  });
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);

  // Electron Environment Detection
  const isElectron = Boolean(
    (window as any).require ||
      (window as any).process?.versions?.electron ||
      navigator.userAgent.toLowerCase().includes('electron')
  );

  // Deduplicate root folders by name & ID
  const uniqueRootFolders = folders
    .filter((f) => f.parentFolderId === null)
    .filter((f, index, self) => self.findIndex((t) => t.name === f.name) === index);

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const currentSubFolders = folders
    .filter((f) => f.parentFolderId === selectedFolderId)
    .filter((f, index, self) => self.findIndex((t) => t.name === f.name) === index);

  // Filter files inside current folder
  const filteredFiles = files.filter((file) => {
    const matchesFolder =
      selectedFolderId === null ? true : file.folderId === selectedFolderId;
    const matchesSearch =
      !searchQuery ||
      file.originalName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let fileList: FileList | null = null;
    if ('files' in e.target && e.target.files) {
      fileList = e.target.files;
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      e.preventDefault();
      fileList = e.dataTransfer.files;
    }

    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    const file = fileList[0];

    try {
      setUploadToast(`Sincronizando ${file.name}...`);
      const hash = await calculateFileHash(file);

      const checkRes = await apiFetch('/files/check-hash', {
        method: 'POST',
        body: JSON.stringify({ hash }),
      });

      const formData = new FormData();
      formData.append('hash', hash);
      formData.append('originalName', file.name);
      if (selectedFolderId) formData.append('folderId', selectedFolderId);

      if (!checkRes.exists) {
        formData.append('file', file);
      }

      await apiFetch('/files/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadToast(`✓ ${file.name} sincronizado com sucesso!`);
      setTimeout(() => setUploadToast(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(`Erro no upload: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await apiFetch('/files/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentFolderId: selectedFolderId,
        }),
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteFile = async (pointerId: string, name: string) => {
    if (!confirm(`Remover '${name}'?`)) return;

    try {
      await apiFetch(`/files/${pointerId}`, { method: 'DELETE' });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadWeb = (file: FilePointer) => {
    const token = getAuthToken();
    const link = document.createElement('a');
    link.href = `/api/v1/files/download/${file.id}?token=${token}`;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenFileElectron = (file: FilePointer) => {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('open_local_file', { fileId: file.id, originalName: file.originalName });
    } catch (err) {
      handleDownloadWeb(file);
    }
  };

  const handleOpenExplorerElectron = (file: FilePointer) => {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('open_in_explorer', { fileId: file.id, originalName: file.originalName });
    } catch (err) {
      handleDownloadWeb(file);
    }
  };

  const handleSelectLocalFolder = () => {
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('select_sync_folder');
        ipcRenderer.once('sync_folder_updated', (e: any, dir: string) => {
          setLocalSyncPath(dir);
        });
        return;
      } catch (err) {}
    }
    setIsSelectingFolder(true);
  };

  const getFileIcon = (ext: string) => {
    const lower = ext.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(lower)) {
      return <ImageIcon size={20} color="#0078D4" />;
    }
    if (['mp4', 'mkv', 'avi', 'mov'].includes(lower)) {
      return <Film size={20} color="#E67E22" />;
    }
    if (['mp3', 'wav', 'flac'].includes(lower)) {
      return <Music size={20} color="#9B59B6" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(lower)) {
      return <Archive size={20} color="#F1C40F" />;
    }
    if (['js', 'ts', 'html', 'css', 'json', 'py', 'cpp', 'c', 'cs'].includes(lower)) {
      return <FileCode size={20} color="#2ECC71" />;
    }
    return <FileText size={20} color="#0078D4" />;
  };

  return (
    <div style={styles.explorerContainer} className="stagger-2">
      {/* Left Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarSection}>
          <span style={styles.sidebarSectionHeader}>Acesso Rápido</span>
          
          <div
            style={{
              ...styles.sidebarItem,
              backgroundColor: selectedFolderId === null ? 'var(--bg-card-hover)' : 'transparent',
              borderLeft: selectedFolderId === null ? '3px solid #0078D4' : '3px solid transparent',
            }}
            onClick={() => onSelectFolder(null)}
          >
            <Home size={16} color="#0078D4" />
            <span>Início (Todas as Pastas)</span>
          </div>
        </div>

        <div style={styles.sidebarSection}>
          <span style={styles.sidebarSectionHeader}>Pastas dos Usuários</span>
          {uniqueRootFolders.map((folder) => (
            <div
              key={folder.id}
              style={{
                ...styles.sidebarItem,
                backgroundColor: selectedFolderId === folder.id ? 'var(--bg-card-hover)' : 'transparent',
                borderLeft: selectedFolderId === folder.id ? '3px solid #0078D4' : '3px solid transparent',
              }}
              onClick={() => onSelectFolder(folder.id)}
            >
              <FolderIcon size={16} color="#E5C07B" />
              <span style={styles.folderNameText}>{folder.name}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {/* Windows Local Folder Auto-Sync Banner */}
        <div style={styles.localSyncBanner}>
          <div style={styles.localSyncInfo}>
            <FolderSync size={20} color="#0078D4" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  Sincronização Automática em Tempo Real
                </strong>
                <span style={{ fontSize: '11px', color: '#2ECC71', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> Ativa
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Pasta monitorada no Windows: <code>{localSyncPath}</code>
              </span>
            </div>
          </div>

          <button className="btn" onClick={handleSelectLocalFolder} style={{ fontSize: '12px' }}>
            Alterar Pasta Local
          </button>
        </div>

        {/* Top Control Bar */}
        <div style={styles.topDropHeader}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <label style={styles.uploadBtnLabel}>
              <input
                type="file"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
              <UploadCloud size={16} color="#FFFFFF" />
              <span>Adicionar Arquivos</span>
            </label>

            {selectedFolderId !== null && (user.role === 'ADMIN' || (currentFolder && currentFolder.ownerUserId === user.id)) && (
              <button className="btn" onClick={() => setIsCreatingFolder(true)} style={{ fontSize: '13px' }}>
                <FolderPlus size={15} color="#E5C07B" /> Criar Subpasta
              </button>
            )}
          </div>

          <div style={styles.viewToggleGroup}>
            <button
              style={{
                ...styles.toggleBtn,
                backgroundColor: viewMode === 'grid' ? 'var(--bg-card-hover)' : 'transparent',
              }}
              onClick={() => setViewMode('grid')}
              title="Grade"
            >
              <Grid size={15} color={viewMode === 'grid' ? '#0078D4' : 'var(--text-muted)'} />
            </button>
            <button
              style={{
                ...styles.toggleBtn,
                backgroundColor: viewMode === 'list' ? 'var(--bg-card-hover)' : 'transparent',
              }}
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <List size={15} color={viewMode === 'list' ? '#0078D4' : 'var(--text-muted)'} />
            </button>
          </div>
        </div>

        {uploadToast && (
          <div style={styles.toastNotice}>
            <span>{uploadToast}</span>
          </div>
        )}

        {/* Drives / Capacity */}
        {selectedFolderId === null && quota && (
          <div style={styles.sectionBlock}>
            <h4 style={styles.sectionHeading}>Dispositivos e Unidades</h4>
            <QuotaBar quota={quota} />
          </div>
        )}

        {/* Sub-Folders */}
        {currentSubFolders.length > 0 && (
          <div style={styles.sectionBlock}>
            <h4 style={styles.sectionHeading}>
              {selectedFolderId === null ? 'Pastas dos Usuários' : 'Subpastas'}
            </h4>
            <div style={styles.folderGrid}>
              {currentSubFolders.map((folder) => (
                <div
                  key={folder.id}
                  style={styles.folderCard}
                  onClick={() => onSelectFolder(folder.id)}
                >
                  <FolderIcon size={36} color="#E5C07B" fill="#E5C07B" fillOpacity={0.2} />
                  <span style={styles.folderCardTitle}>{folder.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files Section */}
        <div style={styles.sectionBlock}>
          <h4 style={styles.sectionHeading}>
            {selectedFolderId === null ? 'Arquivos Recentes' : `Arquivos em ${currentFolder?.name || 'Pasta'}`} ({filteredFiles.length})
          </h4>

          {filteredFiles.length === 0 ? (
            <div style={styles.emptyContainer}>
              <FileText size={42} color="var(--border-color)" />
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
                Nenhum arquivo nesta pasta.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div style={styles.filesGrid}>
              {filteredFiles.map((file) => (
                <div key={file.id} style={styles.fileCard}>
                  <div style={styles.fileCardIconRow}>
                    {getFileIcon(file.fileExtension)}
                    <span style={styles.syncedBadge}>
                      <CheckCircle2 size={11} color="#2ECC71" /> Sincronizado
                    </span>
                  </div>

                  <span style={styles.fileCardName} title={file.originalName}>
                    {file.originalName}
                  </span>

                  <span style={styles.fileCardSize}>
                    {formatBytes(file.physicalObject?.sizeBytes || 0)}
                  </span>

                  <div style={styles.fileCardActions}>
                    {isElectron ? (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleOpenFileElectron(file)}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          title="Abrir Arquivo"
                        >
                          <ExternalLink size={13} /> Abrir
                        </button>
                        <button
                          className="btn"
                          onClick={() => handleOpenExplorerElectron(file)}
                          style={{ padding: '6px 10px' }}
                          title="Abrir Pasta do Explorer"
                        >
                          <FolderOpen size={14} color="#E5C07B" />
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleDownloadWeb(file)}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        title="Baixar Arquivo"
                      >
                        <Download size={13} /> Baixar
                      </button>
                    )}

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteFile(file.id, file.originalName)}
                      style={{ padding: '6px 10px' }}
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.tableCard}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Tamanho</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => (
                    <tr key={file.id}>
                      <td style={styles.tableNameCell}>
                        {getFileIcon(file.fileExtension)}
                        <span>{file.originalName}</span>
                      </td>
                      <td>
                        <span style={styles.syncedBadgeTable}>
                          <CheckCircle2 size={11} color="#2ECC71" /> Sincronizado
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatBytes(file.physicalObject?.sizeBytes || 0)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(file.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {isElectron ? (
                            <>
                              <button
                                className="btn btn-primary"
                                onClick={() => handleOpenFileElectron(file)}
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                                title="Abrir Arquivo"
                              >
                                <ExternalLink size={13} /> Abrir
                              </button>
                              <button
                                className="btn"
                                onClick={() => handleOpenExplorerElectron(file)}
                                style={{ padding: '4px 8px' }}
                                title="Abrir Pasta do Explorer"
                              >
                                <FolderOpen size={13} color="#E5C07B" />
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleDownloadWeb(file)}
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              title="Baixar"
                            >
                              <Download size={13} /> Baixar
                            </button>
                          )}

                          <button
                            className="btn btn-danger"
                            onClick={() => handleDeleteFile(file.id, file.originalName)}
                            style={{ padding: '4px 8px' }}
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* New Folder Modal */}
      {isCreatingFolder && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
              Nova Subpasta
            </h4>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                placeholder="Nome da subpasta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                style={styles.modalInput}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsCreatingFolder(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Select Local Sync Folder Modal */}
      {isSelectingFolder && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
              Selecionar Pasta do Windows para Sincronização
            </h4>
            <input
              type="text"
              value={localSyncPath}
              onChange={(e) => setLocalSyncPath(e.target.value)}
              style={styles.modalInput}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              O cliente Electron sincronizará automaticamente todas as alterações nesta pasta.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button className="btn btn-primary" onClick={() => setIsSelectingFolder(false)}>
                Confirmar Pasta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  explorerContainer: {
    display: 'flex',
    flex: 1,
    backgroundColor: 'var(--bg-app)',
    minHeight: 'calc(100vh - 54px)',
  },
  sidebar: {
    width: '220px',
    backgroundColor: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border-color)',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    userSelect: 'none',
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  sidebarSectionHeader: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    padding: '4px 10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 10px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--text-primary)',
    transition: 'background 0.15s ease',
  },
  folderNameText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mainContent: {
    flex: 1,
    backgroundColor: 'var(--bg-main)',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    overflowY: 'auto',
  },
  localSyncBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 16px',
  },
  localSyncInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  topDropHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadBtnLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--accent-blue)',
    color: '#FFFFFF',
    padding: '7px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    userSelect: 'none',
  },
  viewToggleGroup: {
    display: 'flex',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  toastNotice: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 14px',
    fontSize: '12px',
    color: 'var(--text-primary)',
  },
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeading: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  folderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
  },
  folderCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '16px 12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    userSelect: 'none',
  },
  folderCardTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  filesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
  },
  fileCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    transition: 'all 0.15s ease',
  },
  fileCardIconRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncedBadge: {
    fontSize: '10px',
    fontWeight: '500',
    color: '#2ECC71',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
  },
  syncedBadgeTable: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#2ECC71',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  extBadge: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  fileCardName: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '4px',
  },
  fileCardSize: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  fileCardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '6px',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
  },
  tableCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  tableNameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'var(--bg-sidebar)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
    width: '360px',
  },
  modalInput: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  },
};
