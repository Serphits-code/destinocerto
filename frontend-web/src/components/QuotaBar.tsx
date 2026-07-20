import React from 'react';
import { HardDrive } from 'lucide-react';
import { QuotaInfo } from '../types';
import { formatBytes } from '../utils/hash';

interface QuotaBarProps {
  quota: QuotaInfo | null;
}

export const QuotaBar: React.FC<QuotaBarProps> = ({ quota }) => {
  if (!quota) return null;

  const percentage = Math.min(100, Math.max(0, quota.percentageUsed));
  let barColor = '#0078D4'; // Modern Windows Blue

  if (percentage >= 90) {
    barColor = '#E74C3C'; // Red
  }

  return (
    <div style={styles.driveCard}>
      <div style={styles.iconContainer}>
        <HardDrive size={28} color="#0078D4" />
      </div>
      <div style={styles.infoContainer}>
        <div style={styles.titleRow}>
          <span style={styles.driveTitle}>Nuvem Destino Certo (S:)</span>
        </div>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${percentage}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
        <span style={styles.driveSubtitle}>
          {formatBytes(quota.availableBytes)} livres de {quota.maxStorageGb} GB
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  driveCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    width: '280px',
    userSelect: 'none',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driveTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  progressTrack: {
    height: '6px',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    margin: '2px 0',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  driveSubtitle: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
};
