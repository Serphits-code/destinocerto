import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  Trash2,
  Edit,
  Folder,
  Lock,
  Key,
  HardDrive,
  User as UserIcon,
  Search,
  Check,
  X,
  Eye,
  Edit3,
} from 'lucide-react';
import { User, Folder as FolderType, Permission } from '../types';
import { apiFetch } from '../services/api';
import { formatBytes } from '../utils/hash';

interface AdminACLProps {
  folders: FolderType[];
  onRefresh: () => void;
}

export const AdminACL: React.FC<AdminACLProps> = ({ folders, onRefresh }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [searchUser, setSearchUser] = useState('');

  // Modals
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [managingPermissionsUser, setManagingPermissionsUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');

  const loadData = async () => {
    try {
      const usersData = await apiFetch('/admin/users');
      const permData = await apiFetch('/admin/permissions');
      setUsers(usersData);
      setPermissions(permData);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      resetForm();
      setIsCreatingUser(false);
      loadData();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await apiFetch(`/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, email, password, role }),
      });
      resetForm();
      setEditingUser(null);
      loadData();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário '${userName}'?`)) return;
    try {
      await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
      loadData();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePermissionChange = async (
    targetUserId: string,
    folderId: string,
    accessLevel: 'NONE' | 'READ' | 'READ_WRITE'
  ) => {
    try {
      await apiFetch('/admin/permissions', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUserId, folderId, accessLevel }),
      });
      loadData();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('USER');
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword(''); // keep blank unless changing
    setRole(u.role);
  };

  const getAccessLevel = (targetUserId: string, folderId: string) => {
    const perm = permissions.find((p) => p.userId === targetUserId && p.folderId === folderId);
    return perm ? perm.accessLevel : 'NONE';
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div style={styles.container} className="stagger-2">
      {/* Header Bar */}
      <div style={styles.topHeader}>
        <div>
          <h2 style={styles.title}>Gerenciamento de Usuários e Permissões</h2>
          <p style={styles.subtitle}>
            Gerencie contas de usuários, redefina senhas e controle o acesso às pastas do sistema
          </p>
        </div>

        <div style={styles.topActions}>
          <div style={styles.searchBox}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Buscar usuário..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <button className="btn btn-primary" onClick={() => { resetForm(); setIsCreatingUser(true); }}>
            <UserPlus size={15} /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Users Cards Grid */}
      <div style={styles.cardsGrid}>
        {filteredUsers.map((u) => {
          const userFolder = folders.find((f) => f.ownerUserId === u.id || f.id === u.folderId);

          return (
            <div key={u.id} style={styles.userCard}>
              <div style={styles.cardHeader}>
                <div style={styles.avatarCircle}>
                  {u.name.charAt(0).toUpperCase()}
                </div>

                <div style={styles.userMainInfo}>
                  <div style={styles.userNameRow}>
                    <h4 style={styles.userName}>{u.name}</h4>
                    <span style={u.role === 'ADMIN' ? styles.roleBadgeAdmin : styles.roleBadgeUser}>
                      {u.role === 'ADMIN' ? 'Administrador' : 'Usuário'}
                    </span>
                  </div>
                  <span style={styles.userEmail}>{u.email}</span>
                </div>
              </div>

              <div style={styles.cardDivider} />

              {/* Storage gauge */}
              <div style={styles.storageBox}>
                <div style={styles.storageHeader}>
                  <span style={styles.storageLabel}>Espaço Utilizado:</span>
                  <strong style={styles.storageValue}>{formatBytes(u.storageBytes || 0)}</strong>
                </div>
              </div>

              {/* User Root Folder */}
              <div style={styles.folderBadgeBox}>
                <Folder size={15} color="#E5C07B" />
                <span style={styles.folderBadgeText}>
                  {userFolder ? userFolder.name : `Pasta de ${u.name}`}
                </span>
              </div>

              {/* Action buttons */}
              <div style={styles.cardActionsRow}>
                {userFolder && (
                  <button
                    className="btn"
                    onClick={() => setManagingPermissionsUser(u)}
                    style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }}
                    title="Permitir acesso da pasta deste usuário para outros usuários"
                  >
                    <Key size={13} color="#0078D4" /> Permissões
                  </button>
                )}

                <button
                  className="btn"
                  onClick={() => openEditModal(u)}
                  style={{ padding: '6px 10px' }}
                  title="Editar Login e Senha"
                >
                  <Edit3 size={13} color="var(--text-secondary)" />
                </button>

                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteUser(u.id, u.name)}
                  style={{ padding: '6px 10px' }}
                  title="Excluir Usuário"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Create User */}
      {isCreatingUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h4 style={styles.modalTitle}>Cadastrar Novo Usuário</h4>
            <form onSubmit={handleCreateUser} style={styles.form}>
              <label style={styles.label}>
                Nome Completo:
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Almeida"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                E-mail (Login):
                <input
                  type="email"
                  required
                  placeholder="carlos@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Senha Inicial:
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Função do Usuário:
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
                  style={styles.input}
                >
                  <option value="USER">Usuário Padrão</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>

              <div style={styles.modalFooter}>
                <button type="button" className="btn" onClick={() => setIsCreatingUser(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Usuário & Pasta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit User (Login & Password) */}
      {editingUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h4 style={styles.modalTitle}>Editar Usuário ({editingUser.name})</h4>
            <form onSubmit={handleUpdateUser} style={styles.form}>
              <label style={styles.label}>
                Nome:
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                E-mail (Login):
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Nova Senha (deixe em branco para manter a atual):
                <input
                  type="password"
                  placeholder="Digite uma nova senha se quiser alterar"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Função:
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
                  style={styles.input}
                >
                  <option value="USER">Usuário Padrão</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>

              <div style={styles.modalFooter}>
                <button type="button" className="btn" onClick={() => setEditingUser(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Manage Access of Target User to Other Folders */}
      {managingPermissionsUser && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, width: '500px' }}>
            <h4 style={styles.modalTitle}>
              🔑 Permissões de Acesso para: {managingPermissionsUser.name}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Defina a quais pastas de outros usuários <strong>{managingPermissionsUser.name}</strong> terá acesso:
            </p>

            <div style={styles.permissionsList}>
              {managingPermissionsUser.role === 'ADMIN' ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#2ECC71', fontSize: '13px' }}>
                  🟢 Como <strong>{managingPermissionsUser.name}</strong> é um Administrador, este usuário possui acesso total a todas as pastas do sistema por padrão.
                </div>
              ) : (
                users
                  .filter((u) => u.id !== managingPermissionsUser.id)
                  .map((otherUser) => {
                    const otherFolder = folders.find(
                      (f) => f.ownerUserId === otherUser.id || f.id === otherUser.folderId
                    ) || {
                      id: `folder-root-${otherUser.id}`,
                      name: `Pasta de ${otherUser.name}`,
                    };

                    const currentLevel = getAccessLevel(managingPermissionsUser.id, otherFolder.id);

                    return (
                      <div key={otherUser.id} style={styles.permRow}>
                        <div>
                          <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Folder size={14} color="#E5C07B" /> {otherFolder.name}
                          </strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Dono: {otherUser.name} ({otherUser.email})
                          </div>
                        </div>

                        <select
                          value={currentLevel}
                          onChange={(e) =>
                            handlePermissionChange(
                              managingPermissionsUser.id,
                              otherFolder.id,
                              e.target.value as 'NONE' | 'READ' | 'READ_WRITE'
                            )
                          }
                          style={styles.permSelect}
                        >
                          <option value="NONE">🔴 Sem Acesso (Privado)</option>
                          <option value="READ">🔵 Apenas Leitura</option>
                          <option value="READ_WRITE">🟢 Leitura e Escrita</option>
                        </select>
                      </div>
                    );
                  })
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                className="btn btn-primary"
                onClick={() => setManagingPermissionsUser(null)}
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    backgroundColor: 'var(--bg-main)',
    flex: 1,
  },
  topHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  topActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    width: '220px',
  },
  searchInput: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  userCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatarCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#0078D4',
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMainInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    overflow: 'hidden',
  },
  userNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  roleBadgeAdmin: {
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: 'rgba(0, 120, 212, 0.2)',
    color: '#0078D4',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  roleBadgeUser: {
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'var(--text-secondary)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  cardDivider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
  },
  storageBox: {
    backgroundColor: 'var(--bg-main)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
  },
  storageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  storageLabel: {
    color: 'var(--text-secondary)',
  },
  storageValue: {
    color: 'var(--text-primary)',
  },
  folderBadgeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  folderBadgeText: {
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  cardActionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'var(--bg-sidebar)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    width: '380px',
    boxShadow: 'var(--shadow-fluent)',
  },
  modalTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  input: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  },
  modalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px',
  },
  permissionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  permRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
  },
  permSelect: {
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 8px',
    fontSize: '12px',
    outline: 'none',
  },
};
