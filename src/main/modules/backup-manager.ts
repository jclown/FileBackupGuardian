import * as fs from 'fs-extra';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { BackupRecord, BackupConfig, IPC_CHANNELS } from '../types';
import { configManager } from './config-manager';

interface BackupIndex {
  records: BackupRecord[];
}

interface RestoringFileInfo {
  timestamp: number;
  filePath: string;
}

export class BackupManager {
  private config: BackupConfig;
  private mainWindow: BrowserWindow | null = null;
  private pendingBackups: Map<string, NodeJS.Timeout> = new Map();
  private backupIndex: BackupIndex = { records: [] };
  private indexPath = '';
  private restoringFiles: Set<string> = new Set();
  // 记录最近恢复的文件及其时间戳，用于在延迟窗口内跳过备份
  private recentlyRestoredFiles: Map<string, RestoringFileInfo> = new Map();
  // 恢复后的跳过窗口（毫秒），默认为备份延迟的 2 倍
  private restoreSkipWindow = 60000;
  private pendingPreChangeBackup: Map<string, string> = new Map();

  constructor() {
    this.config = configManager.getBackupConfig();
    this.restoreSkipWindow = Math.max(30000, this.config.backupDelay * 1000 * 2);
    void this.loadIndex();
    // 定期清理过期的恢复记录
    setInterval(() => this.cleanupRestoreRecords(), 10000);
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  updateConfig(config: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...config, backupStrategy: 'full' };
    void this.ensureBackupDirectory();
  }

  async createBackupWithContent(
    filePath: string,
    watchPathId: string,
    content: Buffer,
    changeType: 'change' | 'unlink',
  ): Promise<BackupRecord> {
    void watchPathId;

    const pending = this.pendingBackups.get(filePath);
    if (pending) {
      clearTimeout(pending);
      this.pendingBackups.delete(filePath);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        this.pendingBackups.delete(filePath);
        try {
          const record = await this.executeBackupWithContent(filePath, content, changeType);
          resolve(record);
        } catch (error) {
          reject(error);
        }
      }, this.config.backupDelay * 1000);

      this.pendingBackups.set(filePath, timeout);
    });
  }

  async createPostChangeBackup(
    filePath: string,
    watchPathId: string,
    preBackupId?: string,
  ): Promise<BackupRecord> {
    void watchPathId;

    const pending = this.pendingBackups.get(filePath);
    if (pending) {
      clearTimeout(pending);
      this.pendingBackups.delete(filePath);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        this.pendingBackups.delete(filePath);
        try {
          const record = await this.executePostChangeBackup(filePath, preBackupId);
          resolve(record);
        } catch (error) {
          reject(error);
        }
      }, this.config.backupDelay * 1000);

      this.pendingBackups.set(filePath, timeout);
    });
  }

  getPendingPreBackupId(filePath: string): string | undefined {
    return this.pendingPreChangeBackup.get(filePath);
  }

  setPendingPreBackupId(filePath: string, backupId: string): void {
    this.pendingPreChangeBackup.set(filePath, backupId);
  }

  clearPendingPreBackupId(filePath: string): void {
    this.pendingPreChangeBackup.delete(filePath);
  }

  async createBackup(filePath: string, watchPathId: string, changeType: 'add'): Promise<BackupRecord> {
    void watchPathId;

    const pending = this.pendingBackups.get(filePath);
    if (pending) {
      clearTimeout(pending);
      this.pendingBackups.delete(filePath);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        this.pendingBackups.delete(filePath);
        try {
          const record = await this.executeBackup(filePath, changeType);
          resolve(record);
        } catch (error) {
          reject(error);
        }
      }, this.config.backupDelay * 1000);

      this.pendingBackups.set(filePath, timeout);
    });
  }

  private async executeBackup(filePath: string, changeType: 'add'): Promise<BackupRecord> {
    await this.ensureBackupDirectory();

    const exists = await fs.pathExists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = await fs.stat(filePath);
    const timestamp = Date.now();
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const backupFileName = `${baseName}_${timestamp}${ext}`;
    const backupPath = path.join(this.getBackupDir(filePath), backupFileName);

    await fs.ensureDir(path.dirname(backupPath));
    await fs.copy(filePath, backupPath, { overwrite: true, errorOnExist: false });

    const record: BackupRecord = {
      id: uuidv4(),
      originalPath: filePath,
      backupPath,
      timestamp,
      type: 'full',
      changeType,
      fileSize: stat.size,
    };

    this.backupIndex.records.push(record);
    await this.saveIndex();
    await this.cleanupOldBackups(filePath);
    this.sendToRenderer(IPC_CHANNELS.BACKUP_LIST_UPDATE, record);

    configManager.addLog('info', 'backup', `Backup created: ${path.basename(filePath)}`, {
      originalPath: filePath,
      backupPath,
      size: stat.size,
      changeType,
    });

    return record;
  }

  private async executeBackupWithContent(
    filePath: string,
    content: Buffer,
    changeType: 'change' | 'unlink',
  ): Promise<BackupRecord> {
    await this.ensureBackupDirectory();

    const timestamp = Date.now();
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const backupFileName = `${baseName}_${timestamp}${ext}`;
    const backupPath = path.join(this.getBackupDir(filePath), backupFileName);

    await fs.ensureDir(path.dirname(backupPath));
    await fs.writeFile(backupPath, content);

    const record: BackupRecord = {
      id: uuidv4(),
      originalPath: filePath,
      backupPath,
      timestamp,
      type: 'full',
      changeType,
      fileSize: content.length,
    };

    this.backupIndex.records.push(record);
    await this.saveIndex();
    await this.cleanupOldBackups(filePath);
    this.sendToRenderer(IPC_CHANNELS.BACKUP_LIST_UPDATE, record);

    configManager.addLog('info', 'backup', `Pre-change backup created: ${path.basename(filePath)}`, {
      originalPath: filePath,
      backupPath,
      size: content.length,
      changeType,
    });

    return record;
  }

  private async executePostChangeBackup(
    filePath: string,
    preBackupId?: string,
  ): Promise<BackupRecord> {
    await this.ensureBackupDirectory();

    const exists = await fs.pathExists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = await fs.stat(filePath);
    const timestamp = Date.now();
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const backupFileName = `${baseName}_post_${timestamp}${ext}`;
    const backupPath = path.join(this.getBackupDir(filePath), backupFileName);

    await fs.ensureDir(path.dirname(backupPath));
    await fs.copy(filePath, backupPath, { overwrite: true, errorOnExist: false });

    const record: BackupRecord = {
      id: uuidv4(),
      originalPath: filePath,
      backupPath,
      timestamp,
      type: 'full',
      changeType: 'change',
      fileSize: stat.size,
      pairedBackupId: preBackupId,
    };

    if (preBackupId) {
      const preRecord = this.backupIndex.records.find((r) => r.id === preBackupId);
      if (preRecord) {
        preRecord.pairedBackupId = record.id;
      }
    }

    this.backupIndex.records.push(record);
    await this.saveIndex();
    await this.cleanupOldBackups(filePath);
    this.sendToRenderer(IPC_CHANNELS.BACKUP_LIST_UPDATE, record);

    configManager.addLog('info', 'backup', `Post-change backup created: ${path.basename(filePath)}`, {
      originalPath: filePath,
      backupPath,
      size: stat.size,
      pairedBackupId: preBackupId,
    });

    return record;
  }

  async getBackupList(originalPath?: string): Promise<BackupRecord[]> {
    let records = [...this.backupIndex.records];
    if (originalPath) {
      records = records.filter((r) => r.originalPath === originalPath);
    }
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getHistory(options?: { startDate?: number; endDate?: number; pathFilter?: string }): Promise<BackupRecord[]> {
    let records = [...this.backupIndex.records];

    if (options?.startDate) {
      records = records.filter((r) => r.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      records = records.filter((r) => r.timestamp <= options.endDate!);
    }
    if (options?.pathFilter) {
      records = records.filter((r) => r.originalPath.includes(options.pathFilter!));
    }

    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getBackupById(backupId: string): Promise<BackupRecord | undefined> {
    return this.backupIndex.records.find((r) => r.id === backupId);
  }

  async getPairedBackup(backupId: string): Promise<BackupRecord | undefined> {
    const record = this.backupIndex.records.find((r) => r.id === backupId);
    if (!record || !record.pairedBackupId) {
      return undefined;
    }
    return this.backupIndex.records.find((r) => r.id === record.pairedBackupId);
  }

  async getBackupPairs(originalPath?: string): Promise<BackupRecord[][]> {
    const records = await this.getBackupList(originalPath);
    const pairs: BackupRecord[][] = [];
    const processed = new Set<string>();

    for (const record of records) {
      if (processed.has(record.id)) continue;

      if (record.pairedBackupId) {
        const pairedRecord = records.find((r) => r.id === record.pairedBackupId);
        if (pairedRecord) {
          pairs.push([record, pairedRecord].sort((a, b) => a.timestamp - b.timestamp));
          processed.add(record.id);
          processed.add(pairedRecord.id);
        }
      }
    }

    return pairs;
  }

  async deleteBackup(backupId: string): Promise<void> {
    const index = this.backupIndex.records.findIndex((r) => r.id === backupId);
    if (index === -1) {
      throw new Error('Backup record not found');
    }

    const record = this.backupIndex.records[index];
    try {
      await fs.remove(record.backupPath);
    } catch {
      // ignore missing file
    }

    this.backupIndex.records.splice(index, 1);
    await this.saveIndex();
  }

  async restoreBackup(backupId: string, targetPath?: string): Promise<void> {
    const record = this.backupIndex.records.find((r) => r.id === backupId);
    if (!record) {
      throw new Error('Backup record not found');
    }

    const exists = await fs.pathExists(record.backupPath);
    if (!exists) {
      throw new Error('Backup file not found');
    }

    const destination = path.normalize(targetPath || record.originalPath);
    
    // 标记文件为正在恢复状态
    this.restoringFiles.add(destination);
    // 同时记录到最近恢复列表，用于延迟窗口内的跳过
    this.recentlyRestoredFiles.set(destination, {
      timestamp: Date.now(),
      filePath: destination,
    });
    
    try {
      await fs.ensureDir(path.dirname(destination));
      await fs.copy(record.backupPath, destination, { overwrite: true, errorOnExist: false });
    } finally {
      // 恢复完成后移除正在恢复标记（但保留在 recentlyRestoredFiles 中用于延迟窗口）
      this.restoringFiles.delete(destination);
    }
  }

  /**
   * 检查文件是否应该被跳过备份（正在恢复或最近恢复）
   */
  shouldSkipBackup(filePath: string): boolean {
    // 检查是否正在恢复中
    if (this.restoringFiles.has(filePath)) {
      return true;
    }

    // 检查是否在恢复后的跳过窗口内
    const restoredInfo = this.recentlyRestoredFiles.get(filePath);
    if (restoredInfo) {
      const elapsed = Date.now() - restoredInfo.timestamp;
      if (elapsed < this.restoreSkipWindow) {
        return true;
      }
    }

    return false;
  }

  /**
   * 清理过期的恢复记录
   */
  private cleanupRestoreRecords(): void {
    const now = Date.now();
    for (const [filePath, info] of this.recentlyRestoredFiles.entries()) {
      if (now - info.timestamp > this.restoreSkipWindow) {
        this.recentlyRestoredFiles.delete(filePath);
      }
    }
  }

  /**
   * 获取恢复跳过窗口的剩余时间（毫秒）
   */
  getRestoreSkipWindowRemaining(filePath: string): number {
    const restoredInfo = this.recentlyRestoredFiles.get(filePath);
    if (!restoredInfo) return 0;
    
    const elapsed = Date.now() - restoredInfo.timestamp;
    const remaining = this.restoreSkipWindow - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * 获取所有正在跳过备份的文件列表
   */
  getSkippingFiles(): Array<{ filePath: string; remainingMs: number }> {
    const result: Array<{ filePath: string; remainingMs: number }> = [];
    const now = Date.now();
    
    for (const [filePath, info] of this.recentlyRestoredFiles.entries()) {
      const elapsed = now - info.timestamp;
      const remaining = this.restoreSkipWindow - elapsed;
      if (remaining > 0) {
        result.push({ filePath, remainingMs: remaining });
      }
    }
    
    return result;
  }

  private async cleanupOldBackups(originalPath: string): Promise<void> {
    const records = this.backupIndex.records
      .filter((r) => r.originalPath === originalPath)
      .sort((a, b) => b.timestamp - a.timestamp);

    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const toDelete: BackupRecord[] = [];

    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      if (now - record.timestamp > retentionMs || i >= this.config.maxBackups) {
        toDelete.push(record);
      }
    }

    for (const record of toDelete) {
      try {
        await fs.remove(record.backupPath);
      } catch {
        // ignore
      }
      const idx = this.backupIndex.records.findIndex((r) => r.id === record.id);
      if (idx > -1) {
        this.backupIndex.records.splice(idx, 1);
      }
    }

    if (toDelete.length > 0) {
      await this.saveIndex();
    }
  }

  private getBackupDir(originalPath: string): string {
    const hash = this.hashPath(originalPath);
    return path.join(this.config.backupPath, hash);
  }

  private hashPath(filePath: string): string {
    let hash = 0;
    for (let i = 0; i < filePath.length; i += 1) {
      const char = filePath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  private async ensureBackupDirectory(): Promise<void> {
    await fs.ensureDir(this.config.backupPath);
    if (!this.indexPath) {
      this.indexPath = path.join(this.config.backupPath, 'backup-index.json');
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      await this.ensureBackupDirectory();
      if (await fs.pathExists(this.indexPath)) {
        const content = await fs.readFile(this.indexPath, 'utf-8');
        const parsed = JSON.parse(content) as BackupIndex;
        this.backupIndex = {
          records: Array.isArray(parsed.records)
            ? parsed.records.map((r) => ({
                ...r,
                type: 'full',
                changeType:
                  r.changeType === 'add' || r.changeType === 'change' || r.changeType === 'unlink'
                    ? r.changeType
                    : 'change',
              }))
            : [],
        };
      }
    } catch {
      this.backupIndex = { records: [] };
    }
  }

  private async saveIndex(): Promise<void> {
    await this.ensureBackupDirectory();
    await fs.writeFile(this.indexPath, JSON.stringify(this.backupIndex, null, 2));
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  isRestoringFile(filePath: string): boolean {
    return this.restoringFiles.has(filePath);
  }
}
