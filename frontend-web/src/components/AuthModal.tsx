import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Power, CheckSquare, Square } from 'lucide-react';
import { apiFetch, setAuthToken } from '../services/api';
import { User } from '../types';

interface AuthModalProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@synccloud.com');
  const [password, setPassword] = useState('admin123');
  const [rememberMe, setRememberMe] = useState(true);
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Electron Detection
  const isElectron = Boolean(
    (window as any).require ||
      (window as any).process?.versions?.electron ||
      navigator.userAgent.toLowerCase().includes('electron')
  );

  useEffect(() => {
    if (isElectron) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const status = ipcRenderer.sendSync('get_autostart_status');
        setOpenAtLogin(Boolean(status));
      } catch (err) {}
    }
  }, [isElectron]);

  const handleToggleAutoStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setOpenAtLogin(checked);
    if (isElectron) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('toggle_autostart', checked);
      } catch (err) {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setAuthToken(data.token);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modalCard} className="card stagger-1">
        <div style={styles.header}>
          <img src="/dcl.svg" alt="Destino Certo" style={styles.brandLogo} />
          <h2 style={styles.title}>Destino Certo</h2>
          <p style={styles.subtitle}>
            Acesse a nuvem corporativa e sincronize seus arquivos
          </p>
        </div>

        {error && <div style={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Endereço de E-mail</label>
            <div style={styles.inputWrapper}>
              <Mail size={16} color="var(--text-muted)" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@destinocerto.com"
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Senha de Acesso</label>
            <div style={styles.inputWrapper}>
              <Lock size={16} color="var(--text-muted)" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={styles.input}
              />
            </div>
          </div>

          {/* Options Row */}
          <div style={styles.optionsCol}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={styles.checkbox}
              />
              <span>Manter conectado (Lembrar Login)</span>
            </label>

            {isElectron && (
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={openAtLogin}
                  onChange={handleToggleAutoStart}
                  style={styles.checkbox}
                />
                <span>Iniciar automaticamente com o Windows</span>
              </label>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Autenticando...' : 'Entrar no Sistema'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={styles.presetsBox}>
          <span style={styles.presetsTitle}>
            <ShieldCheck size={14} color="#0078D4" /> Credenciais Demonstrativas:
          </span>
          <div style={styles.presetsButtons}>
            <button
              className="btn"
              onClick={() => handleQuickPreset('admin@synccloud.com', 'admin123')}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              Admin (admin@synccloud.com)
            </button>
            <button
              className="btn"
              onClick={() => handleQuickPreset('user@synccloud.com', 'user123')}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              Usuário (user@synccloud.com)
            </button>
          </div>
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
    backgroundColor: 'rgba(13, 17, 23, 0.9)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'var(--bg-sidebar)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '28px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '20px',
  },
  brandLogo: {
    width: '54px',
    height: '54px',
    objectFit: 'contain',
    marginBottom: '10px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  errorMessage: {
    backgroundColor: 'rgba(218, 54, 51, 0.15)',
    color: '#F85149',
    border: '1px solid rgba(218, 54, 51, 0.3)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
  },
  input: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
  },
  optionsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: {
    accentColor: '#0078D4',
    width: '15px',
    height: '15px',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px',
    fontSize: '13px',
    fontWeight: '600',
    marginTop: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  presetsBox: {
    marginTop: '18px',
    paddingTop: '14px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  presetsTitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  presetsButtons: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
};
