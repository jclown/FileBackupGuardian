import { ipcMain, shell } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import { configManager } from './modules/config-manager';
import { WatcherManager } from './modules/watcher-manager';
import { BackupManager } from './modules/backup-manager';
import { CompareManager } from './modules/compare-manager';
import { IPC_CHANNELS, AppConfig, IgnoreRule } from './types';

export class IpcHandler {
  private watcherManager: WatcherManager;
  private backupManager: BackupManager;
  private compareManager: CompareManager;
  private mainWindow: Electron.BrowserWindow | null = null;

  constructor() {
    this.watcherManager = new WatcherManager();
    this.backupManager = new BackupManager();
    this.compareManager = new CompareManager();
  }

  setMainWindow(window: Electron.BrowserWindow) {
    this.mainWindow = window;
    this.watcherManager.setMainWindow(window);
    this.backupManager.setMainWindow(window);
  }

  registerHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.WATCHER_ADD_PATH, async (_, filePath: string, recursive?: boolean) => {
      try {
        const watchPath = configManager.addWatchPath(filePath, recursive);
        await this.watcherManager.startWatching(watchPath);
        configManager.addLog('info', 'watcher', `添加监听路径: ${filePath}`);
        return { success: true, data: watchPath };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        configManager.addLog('error', 'watcher', `添加监听路径失败: ${filePath}`, { error: msg });
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.WATCHER_REMOVE_PATH, async (_, id: string) => {
      try {
        this.watcherManager.stopWatching(id);
        const removed = configManager.removeWatchPath(id);
        if (removed) {
          configManager.addLog('info', 'watcher', `删除监听路径: ${id}`);
        }
        return { success: removed };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        configManager.addLog('error', 'watcher', `删除监听路径失败: ${id}`, { error: msg });
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.WATCHER_TOGGLE_PATH, async (_, id: string, enabled: boolean) => {
      try {
        const watchPath = configManager.updateWatchPath(id, { enabled });
        if (watchPath) {
          if (enabled) {
            await this.watcherManager.startWatching(watchPath);
          } else {
            this.watcherManager.stopWatching(id);
          }
          configManager.addLog('info', 'watcher', `${enabled ? '启用' : '暂停'}监听: ${watchPath.path}`);
        }
        return { success: true, data: watchPath };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.WATCHER_GET_STATUS, () => this.watcherManager.getAllStatus());

    ipcMain.handle(
      IPC_CHANNELS.WATCHER_GET_FILE_COUNT,
      async (_, folderPath: string, recursive: boolean, ignoreRules: IgnoreRule[]) => {
        try {
          const count = await this.watcherManager.getFileCount(folderPath, recursive, ignoreRules);
          return { success: true, data: count };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: msg };
        }
      },
    );

    ipcMain.handle(IPC_CHANNELS.BACKUP_GET_LIST, async (_, originalPath?: string) => {
      try {
        const backups = await this.backupManager.getBackupList(originalPath);
        return { success: true, data: backups };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.BACKUP_DELETE, async (_, backupId: string) => {
      try {
        await this.backupManager.deleteBackup(backupId);
        configManager.addLog('info', 'backup', `删除备份: ${backupId}`);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        configManager.addLog('error', 'backup', `删除备份失败: ${backupId}`, { error: msg });
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async (_, backupId: string, targetPath?: string) => {
      try {
        await this.backupManager.restoreBackup(backupId, targetPath);
        configManager.addLog('info', 'backup', `恢复备份: ${backupId} -> ${targetPath || '原路径'}`);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        configManager.addLog('error', 'backup', `恢复备份失败: ${backupId}`, { error: msg });
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(
      IPC_CHANNELS.BACKUP_GET_HISTORY,
      async (_, options?: { startDate?: number; endDate?: number; pathFilter?: string }) => {
        try {
          const history = await this.backupManager.getHistory(options);
          return { success: true, data: history };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: msg };
        }
      },
    );

    ipcMain.handle(IPC_CHANNELS.BACKUP_GET_SKIPPING_FILES, async () => {
      try {
        const skippingFiles = this.backupManager.getSkippingFiles();
        return { success: true, data: skippingFiles };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.COMPARE_FILES, async (_, originalPath: string, backupPath: string) => {
      try {
        const result = await this.compareManager.compare(originalPath, backupPath);
        configManager.addLog('info', 'compare', `文件对比: ${path.basename(originalPath)}`);
        return { success: true, data: result };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        configManager.addLog('error', 'compare', '文件对比失败', { error: msg });
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.COMPARE_PAIRED_BACKUPS, async (_, preBackupId: string) => {
      try {
        const preBackup = await this.backupManager.getBackupById(preBackupId);
        if (!preBackup) {
          return { success: false, error: 'Pre-backup not found' };
        }

        const postBackup = await this.backupManager.getPairedBackup(preBackupId);
        if (!postBackup) {
          return { success: false, error: 'Paired backup not found' };
        }

        const result = await this.compareManager.compareBackups(preBackup.backupPath, postBackup.backupPath);
        configManager.addLog('info', 'compare', `前后备份对比: ${path.basename(preBackup.originalPath)}`);
        return { success: true, data: { preBackup, postBackup, compareResult: result } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        configManager.addLog('error', 'compare', '前后备份对比失败', { error: msg });
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.BACKUP_GET_PAIRS, async (_, originalPath?: string) => {
      try {
        const pairs = await this.backupManager.getBackupPairs(originalPath);
        return { success: true, data: pairs };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.BACKUP_GET_PAIRED, async (_, backupId: string) => {
      try {
        const pairedBackup = await this.backupManager.getPairedBackup(backupId);
        return { success: true, data: pairedBackup };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
      return { success: true, data: configManager.getConfig() };
    });

    ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_, config: Partial<AppConfig>) => {
      try {
        const currentConfig = configManager.getConfig();
        const newConfig = { ...currentConfig, ...config };
        configManager.setConfig(newConfig);
        this.backupManager.updateConfig(newConfig.backup);
        configManager.addLog('info', 'config', '配置已更新');
        return { success: true, data: newConfig };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.LOG_GET_LIST, (_, limit?: number) => {
      return { success: true, data: configManager.getLogs(limit) };
    });

    ipcMain.handle(IPC_CHANNELS.LOG_EXPORT, async () => {
      try {
        const logs = configManager.exportLogs();
        return { success: true, data: logs };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_, filePath: string) => {
      try {
        await shell.openPath(filePath);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER, async (_, filePath: string) => {
      try {
        shell.showItemInFolder(filePath);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_, filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, data: content };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    ipcMain.handle(IPC_CHANNELS.FILE_COPY, async (_, sourcePath: string, targetPath: string) => {
      try {
        const exists = await fs.pathExists(sourcePath);
        if (!exists) {
          return { success: false, error: `Source file not found: ${sourcePath}` };
        }

        await fs.ensureDir(path.dirname(targetPath));
        await fs.copy(sourcePath, targetPath, { overwrite: true, errorOnExist: false });
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });
  }

  send(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  async initialize(): Promise<void> {
    const config = configManager.getConfig();
    this.backupManager.updateConfig(config.backup);

    for (const watchPath of config.watchPaths) {
      if (!watchPath.enabled) continue;
      try {
        await this.watcherManager.startWatching(watchPath);
      } catch (error) {
        configManager.addLog('error', 'watcher', `恢复监听失败: ${watchPath.path}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.watcherManager.setOnFileEvent((filePath, watchPathId, eventType) => {
      const labels: Record<string, string> = {
        add: '新增文件',
        change: '修改文件',
        unlink: '删除文件',
      };
      configManager.addLog('info', 'watcher', `${labels[eventType] || '文件变更'}: ${filePath}`, {
        filePath,
        watchPathId,
        eventType,
      });
    });

    this.watcherManager.setOnFileBeforeChange(async (filePath, watchPathId, eventType) => {
      try {
        const normalizedPath = path.normalize(filePath);
        if (this.backupManager.shouldSkipBackup(normalizedPath)) {
          console.log(`[Backup] Skipping backup for file being restored or recently restored: ${normalizedPath}`);
          return undefined;
        }

        const cachedContent = this.watcherManager.getFileContentCache(normalizedPath);
        if (!cachedContent) return undefined;

        const record = await this.backupManager.createBackupWithContent(normalizedPath, watchPathId, cachedContent, eventType);
        this.watcherManager.clearFileContentCache(normalizedPath);
        return record.id;
      } catch (error) {
        configManager.addLog('error', 'backup', `变更前备份失败：${filePath}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    });

    this.watcherManager.setOnFileAfterChange(async (filePath, watchPathId, preBackupId) => {
      try {
        const normalizedPath = path.normalize(filePath);
        if (this.backupManager.shouldSkipBackup(normalizedPath)) {
          console.log(`[Backup] Skipping post-change backup for file being restored or recently restored: ${normalizedPath}`);
          return;
        }

        const exists = await fs.pathExists(normalizedPath);
        if (!exists) return;

        await this.backupManager.createPostChangeBackup(normalizedPath, watchPathId, preBackupId);
      } catch (error) {
        configManager.addLog('error', 'backup', `变更后备份失败：${filePath}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.watcherManager.setOnFileChange(async (filePath, watchPathId, eventType) => {
      try {
        const normalizedPath = path.normalize(filePath);
        // 检查文件是否应该被跳过（正在恢复或最近恢复）
        if (this.backupManager.shouldSkipBackup(normalizedPath)) {
          console.log(`[Backup] Skipping backup for file being restored or recently restored: ${normalizedPath}`);
          return;
        }

        const exists = await fs.pathExists(normalizedPath);
        if (!exists) return;

        await this.backupManager.createBackup(normalizedPath, watchPathId, eventType);
      } catch (error) {
        configManager.addLog('error', 'backup', `新增文件备份失败：${filePath}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }
}
