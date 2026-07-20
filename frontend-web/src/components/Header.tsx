import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Search,
  HardDrive,
  Folder,
  Shield,
  User as UserIcon,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  wsConnected: boolean;
  activeTab: 'files' | 'admin';
  setActiveTab: (tab: 'files' | 'admin') => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  currentFolderPath: string;
  onNavigateUp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  wsConnected,
  activeTab,
  setActiveTab,
  onLogout,
  searchQuery,
  setSearchQuery,
  currentFolderPath,
  onNavigateUp,
}) => {
  return (
    <header style={styles.topToolbar} className="stagger-1">
      {/* Brand Logo & Name */}
      <div style={styles.brandContainer}>
        <img src="/dcl.svg" alt="Destino Certo" style={styles.brandLogo} />
        <strong style={styles.brandTitle}>Destino Certo</strong>
      </div>

      {/* Navigation Controls */}
      <div style={styles.navButtonsGroup}>
        <button className="btn" style={styles.iconNavBtn} title="Voltar">
          <ArrowLeft size={15} color="var(--text-secondary)" />
        </button>
        <button className="btn" style={styles.iconNavBtn} title="Avançar">
          <ArrowRight size={15} color="var(--text-muted)" />
        </button>
        <button className="btn" style={styles.iconNavBtn} onClick={onNavigateUp} title="Subir Nível">
          <ArrowUp size={15} color="var(--text-secondary)" />
        </button>
      </div>

      {/* Windows Explorer Address Bar */}
      <div style={styles.addressBar}>
        <span style={styles.addressText}>{currentFolderPath}</span>
      </div>

      {/* Search Bar */}
      <div style={styles.searchContainer}>
        <Search size={14} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Pesquisar em Destino Certo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Admin / Profile controls */}
      <div style={styles.rightSection}>
        {user?.role === 'ADMIN' && (
          <button
            className={`btn ${activeTab === 'admin' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab(activeTab === 'files' ? 'admin' : 'files')}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            <Shield size={14} /> {activeTab === 'admin' ? 'Arquivos' : 'Painel Admin'}
          </button>
        )}

        {user && (
          <div style={styles.userBadge} title={`Conectado como ${user.name}`}>
            <UserIcon size={14} color="var(--text-secondary)" />
            <span style={styles.userName}>{user.name}</span>
            <button
              onClick={onLogout}
              title="Sair"
              style={styles.logoutBtn}
            >
              <LogOut size={13} color="var(--text-muted)" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  topToolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    backgroundColor: 'var(--bg-sidebar)',
    borderBottom: '1px solid var(--border-color)',
    gap: '12px',
    userSelect: 'none',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginRight: '4px',
  },
  brandLogo: {
    height: '24px',
    width: '24px',
    objectFit: 'contain',
  },
  brandTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  navButtonsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  iconNavBtn: {
    padding: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
  },
  addressBar: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: '400',
  },
  addressText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    width: '240px',
  },
  searchInput: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 10px',
  },
  userName: {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '2px',
  },
};
