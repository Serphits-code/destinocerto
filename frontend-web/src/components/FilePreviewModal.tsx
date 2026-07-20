import React from 'react';
import { X, Download, FileText, Calendar, HardDrive, User as UserIcon } from 'lucide-react';
import { FilePointer } from '../types';
import { formatBytes } from '../utils/hash';
import { getAuthToken } from '../services/api';

interface FilePreviewModalProps {
  file: FilePointer | null;
  onClose: () => void;
  onDownload: (file: FilePointer) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
}) => {
  if (!file) return null;

  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(file.fileExtension);
  const token = getAuthToken();
  const downloadUrl = `/api/v1/files/download/${file.id}`;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="stagger-1">
        <div style={styles.header}>
          <div style={styles.titleContainer}>
            <FileText size={18} color="#0078D4" />
            <h3 style={styles.title}>{file.originalName}</h3>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={16} color="var(--text-secondary)" />
          </button>
        </div>

        <div style={styles.content}>
          {isImage ? (
            <div style={styles.previewContainer}>
              <img
                src={`${downloadUrl}?token=${token}`}
                alt={file.originalName}
                style={styles.imagePreview}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div style={styles.placeholderPreview}>
              <FileText size={48} color="var(--text-muted)" />
              <p style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Arquivo .{file.fileExtension.toUpperCase()}
              </p>
            </div>
          )}

          <div style={styles.metadataGrid}>
            <div style={styles.metaItem}>
              <HardDrive size={14} color="var(--text-muted)" />
              <span>Tamanho:</span>
              <strong>{formatBytes(file.physicalObject?.sizeBytes || 0)}</strong>
            </div>

            <div style={styles.metaItem}>
              <UserIcon size={14} color="var(--text-muted)" />
              <span>Proprietário:</span>
              <strong>{file.user?.name || 'Eu'}</strong>
            </div>

            <div style={{ ...styles.metaItem, gridColumn: '1 / -1' }}>
              <Calendar size={14} color="var(--text-muted)" />
              <span>Modificado em:</span>
              <strong>{new Date(file.createdAt).toLocaleString('pt-BR')}</strong>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={() => onDownload(file)}>
            <Download size={15} /> Baixar Arquivo
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: 'var(--bg-sidebar)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '540px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-fluent)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-color)',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    overflow: 'hidden',
  },
  title: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  previewContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'var(--bg-main)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    maxHeight: '260px',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '230px',
    objectFit: 'contain',
    borderRadius: '4px',
  },
  placeholderPreview: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-main)',
    borderRadius: 'var(--radius-md)',
    padding: '30px 20px',
    border: '1px solid var(--border-color)',
  },
  metadataGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    border: '1px solid var(--border-color)',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '12px 18px',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-main)',
  },
};
