import Store from 'electron-store';
import { AppConfig, WatchPath, IgnoreRule, BackupConfig, LogEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import * as path from 'path';

interface StoreSchema {
  config: AppConfig;
  logs: LogEntry[];
}

const defaultBackupPath = path.join(app.getPath('home'), 'FileGuardian', 'Backup');

const defaultIgnoreRules: IgnoreRule[] = [
  { id: uuidv4(), type: 'extension', value: '.tmp', enabled: true },
  { id: uuidv4(), type: 'extension', value: '.temp', enabled: true },
  { id: uuidv4(), type: 'extension', value: '.swp', enabled: true },
  { id: uuidv4(), type: 'name', value: '.DS_Store', enabled: true },
  { id: uuidv4(), type: 'name', value: 'Thumbs.db', enabled: true },
  { id: uuidv4(), type: 'folder', value: 'node_modules', enabled: true },
  { id: uuidv4(), type: 'folder', value: '.git', enabled: true },
  { id: uuidv4(), type: 'folder', value: 'dist', enabled: true },
];

const defaultBackupConfig: BackupConfig = {
  backupPath: defaultBackupPath,
  backupDelay: 10,
  backupStrategy: 'full',
  retentionDays: 30,
  maxBackups: 100,
};

const store = new Store<StoreSchema>({
  defaults: {
    config: {
      watchPaths: [],
      backup: defaultBackupConfig,
      defaultIgnoreRules,
    },
    logs: [],
  },
});

function normalizeBackupConfig(backup: BackupConfig): BackupConfig {
  const normalized = { ...backup };

  // Backward compatibility: old versions used milliseconds.
  if (normalized.backupDelay > 600) {
    normalized.backupDelay = Math.max(1, Math.round(normalized.backupDelay / 1000));
  }

  normalized.backupStrategy = 'full';
  return normalized;
}

function normalizeConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    backup: normalizeBackupConfig(config.backup),
    defaultIgnoreRules: Array.isArray(config.defaultIgnoreRules) ? config.defaultIgnoreRules : [],
    watchPaths: Array.isArray(config.watchPaths) ? config.watchPaths : [],
  };
}

export class ConfigManager {
  getConfig(): AppConfig {
    const config = normalizeConfig(store.get('config'));
    store.set('config', config);
    return config;
  }

  setConfig(config: AppConfig): void {
    store.set('config', normalizeConfig(config));
  }

  getWatchPaths(): WatchPath[] {
    return this.getConfig().watchPaths;
  }

  addWatchPath(folderPath: string, recursive = true, ignoreRules?: IgnoreRule[]): WatchPath {
    const config = this.getConfig();
    const newPath: WatchPath = {
      id: uuidv4(),
      path: folderPath,
      enabled: true,
      recursive,
      ignoreRules: ignoreRules || [...config.defaultIgnoreRules],
      createdAt: Date.now(),
    };

    config.watchPaths.push(newPath);
    this.setConfig(config);
    return newPath;
  }

  removeWatchPath(id: string): boolean {
    const config = this.getConfig();
    const index = config.watchPaths.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    config.watchPaths.splice(index, 1);
    this.setConfig(config);
    return true;
  }

  updateWatchPath(id: string, updates: Partial<WatchPath>): WatchPath | null {
    const config = this.getConfig();
    const pathConfig = config.watchPaths.find((p) => p.id === id);
    if (!pathConfig) {
      return null;
    }

    Object.assign(pathConfig, updates);
    this.setConfig(config);
    return pathConfig;
  }

  getBackupConfig(): BackupConfig {
    return normalizeBackupConfig(this.getConfig().backup);
  }

  updateBackupConfig(updates: Partial<BackupConfig>): BackupConfig {
    const config = this.getConfig();
    Object.assign(config.backup, updates);
    config.backup = normalizeBackupConfig(config.backup);
    this.setConfig(config);
    return config.backup;
  }

  getLogs(limit = 1000): LogEntry[] {
    const logs = store.get('logs');
    return logs.slice(-limit);
  }

  addLog(
    level: LogEntry['level'],
    module: LogEntry['module'],
    message: string,
    details?: Record<string, unknown>,
  ): LogEntry {
    const logs = store.get('logs');
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      level,
      module,
      message,
      details,
    };

    logs.push(entry);
    if (logs.length > 10000) {
      logs.splice(0, logs.length - 10000);
    }
    store.set('logs', logs);
    return entry;
  }

  clearLogs(): void {
    store.set('logs', []);
  }

  exportLogs(): string {
    return JSON.stringify(store.get('logs'), null, 2);
  }
}

export const configManager = new ConfigManager();
