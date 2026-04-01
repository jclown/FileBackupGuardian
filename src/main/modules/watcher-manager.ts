import * as parcelWatcher from '@parcel/watcher';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { WatchPath, WatcherStatus, IgnoreRule, IPC_CHANNELS } from '../types';
import { workerManager } from '../utils/worker-manager';
import { configManager } from './config-manager';

interface FileChangeEvent {
  pathId: string;
  filePath: string;
  eventType: string;
  timestamp: number;
}

interface CacheEntry {
  content: Buffer;
  timestamp: number;
  size: number;
}

class LRUCache<K, V extends CacheEntry> {
  private cache: Map<K, V> = new Map();
  private maxSize: number;
  private currentSize: number = 0;

  constructor(maxSizeBytes: number) {
    this.maxSize = maxSizeBytes;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
    return entry;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }

    while (this.currentSize + value.size > this.maxSize && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        const oldest = this.cache.get(firstKey)!;
        this.currentSize -= oldest.size;
        this.cache.delete(firstKey);
      } else {
        break;
      }
    }

    this.cache.set(key, value);
    this.currentSize += value.size;
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
    }
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  get totalBytes(): number {
    return this.currentSize;
  }
}

export class WatcherManager {
  private watchers: Map<string, parcelWatcher.AsyncSubscription> = new Map();
  private statuses: Map<string, WatcherStatus> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private onFileChange: ((filePath: string, watchPathId: string, eventType: 'add') => Promise<void>) | null = null;
  private onFileBeforeChange: ((filePath: string, watchPathId: string, eventType: 'change' | 'unlink') => Promise<string | undefined>) | null = null;
  private onFileAfterChange: ((filePath: string, watchPathId: string, preBackupId?: string) => Promise<void>) | null = null;
  private onFileEvent: ((filePath: string, watchPathId: string, eventType: string) => void) | null = null;
  private fileCounts: Map<string, number> = new Map();
  private lastActivities: Map<string, number> = new Map();
  private fileContentCache: LRUCache<string, CacheEntry> = new LRUCache(100 * 1024 * 1024);
  private processedChanges: Map<string, number> = new Map();
  private knownFilesByWatcher: Map<string, Set<string>> = new Map();

  private pendingFileChanges: FileChangeEvent[] = [];
  private fileChangesFlushTimer: NodeJS.Timeout | null = null;
  private static readonly FILE_CHANGES_BATCH_INTERVAL = 200;
  private static readonly FILE_CHANGES_MAX_BATCH = 50;
  private statusUpdateTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingStatusUpdates: Map<string, Partial<WatcherStatus>> = new Map();
  private static readonly STATUS_UPDATE_THROTTLE = 100;
  private static readonly MAX_SINGLE_FILE_CACHE_SIZE = 10 * 1024 * 1024;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setOnFileChange(callback: (filePath: string, watchPathId: string, eventType: 'add') => Promise<void>): void {
    this.onFileChange = callback;
  }

  setOnFileBeforeChange(callback: (filePath: string, watchPathId: string, eventType: 'change' | 'unlink') => Promise<string | undefined>): void {
    this.onFileBeforeChange = callback;
  }

  setOnFileAfterChange(callback: (filePath: string, watchPathId: string, preBackupId?: string) => Promise<void>): void {
    this.onFileAfterChange = callback;
  }

  setOnFileEvent(callback: (filePath: string, watchPathId: string, eventType: string) => void): void {
    this.onFileEvent = callback;
  }

  async startWatching(watchPath: WatchPath): Promise<void> {
    const watchRoot = path.resolve(watchPath.path);
    const exists = await fs.pathExists(watchRoot);
    if (!exists) {
      throw new Error(`路径不存在: ${watchPath.path}`);
    }

    const existingStatus = this.statuses.get(watchPath.id);
    if (this.watchers.has(watchPath.id) && existingStatus?.isRunning) {
      return;
    }

    const oldWatcher = this.watchers.get(watchPath.id);
    if (oldWatcher) {
      void oldWatcher.unsubscribe().catch((error: unknown) => {
        console.error(`[Watcher] Failed to unsubscribe old watcher: ${watchPath.id}`, error);
      });
      this.watchers.delete(watchPath.id);
    }

    this.statuses.set(watchPath.id, {
      pathId: watchPath.id,
      isRunning: true,
      fileCount: 0,
      lastActivity: null,
      error: null,
    });
    this.fileCounts.set(watchPath.id, 0);

    const subscription = await parcelWatcher.subscribe(
      watchRoot,
      async (error: Error | null, events: parcelWatcher.Event[]) => {
        if (error) {
          this.updateStatus(watchPath.id, {
            error: error.message,
            isRunning: false,
          });
          return;
        }

        if (!Array.isArray(events) || events.length === 0) {
          return;
        }

        try {
          await this.handleParcelEvents(watchPath, watchRoot, events);
        } catch (err) {
          console.error(`[Watcher] Failed to handle parcel events: ${watchPath.path}`, err);
        }
      },
    );

    this.watchers.set(watchPath.id, subscription);

    this.getFileCount(watchRoot, watchPath.recursive, watchPath.ignoreRules)
      .then((count) => {
        this.fileCounts.set(watchPath.id, count);
        this.updateStatus(watchPath.id, { fileCount: count });
      })
      .catch((error: unknown) => {
        console.error(`[Watcher] Failed to initialize file count: ${watchPath.path}`, error);
      });

    this.initializeKnownFilesAndCache(watchPath.id, watchRoot, watchPath.recursive, watchPath.ignoreRules)
      .then((knownFiles) => {
        this.knownFilesByWatcher.set(watchPath.id, knownFiles);
      })
      .catch((error: unknown) => {
        console.error(`[Watcher] Failed to initialize known files: ${watchPath.path}`, error);
      });
  }

  stopWatching(id: string): void {
    const watcher = this.watchers.get(id);
    if (watcher) {
      void watcher.unsubscribe().catch((error: unknown) => {
        console.error(`[Watcher] Failed to unsubscribe watcher: ${id}`, error);
      });
      this.watchers.delete(id);
      this.knownFilesByWatcher.delete(id);
      this.updateStatus(id, { isRunning: false, error: null });
    }
  }

  getAllStatus(): WatcherStatus[] {
    return Array.from(this.statuses.values());
  }

  getStatus(id: string): WatcherStatus | undefined {
    return this.statuses.get(id);
  }

  private async handleParcelEvents(
    watchPath: WatchPath,
    watchRoot: string,
    events: parcelWatcher.Event[],
  ): Promise<void> {
    const knownFiles = this.knownFilesByWatcher.get(watchPath.id) || new Set<string>();

    for (const event of events) {
      const eventPath = path.normalize(path.resolve(event.path));

      if (!this.isInWatchScope(eventPath, watchRoot, watchPath.recursive)) {
        continue;
      }

      if (this.shouldIgnoreFile(eventPath, watchRoot, watchPath.ignoreRules)) {
        continue;
      }

      if (event.type === 'create' || event.type === 'update') {
        const isFile = await this.isRegularFile(eventPath);
        if (!isFile) {
          continue;
        }
      }

      if (event.type === 'delete' && !knownFiles.has(eventPath) && !this.getFileContentCache(eventPath)) {
        continue;
      }

      const mappedType = this.mapParcelEventType(event.type);
      if (!mappedType) {
        continue;
      }

      if (mappedType === 'add') {
        if (!knownFiles.has(eventPath)) {
          knownFiles.add(eventPath);
          this.incrementFileCount(watchPath.id);
        }
      } else if (mappedType === 'unlink') {
        if (knownFiles.has(eventPath)) {
          knownFiles.delete(eventPath);
          this.decrementFileCount(watchPath.id);
        }
      } else if (mappedType === 'change') {
        knownFiles.add(eventPath);
      }

      await this.handleFileChange(eventPath, watchPath.id, mappedType);
    }

    this.knownFilesByWatcher.set(watchPath.id, knownFiles);
  }

  private mapParcelEventType(eventType: parcelWatcher.EventType): 'add' | 'change' | 'unlink' | null {
    if (eventType === 'create') {
      return 'add';
    }
    if (eventType === 'update') {
      return 'change';
    }
    if (eventType === 'delete') {
      return 'unlink';
    }
    return null;
  }

  private isInWatchScope(filePath: string, watchRoot: string, recursive: boolean): boolean {
    const relative = path.relative(watchRoot, filePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return false;
    }

    if (recursive) {
      return true;
    }

    return !relative.includes(path.sep);
  }

  private shouldIgnoreFile(filePath: string, watchRoot: string, ignoreRules: IgnoreRule[]): boolean {
    const relativePath = path.relative(watchRoot, filePath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return true;
    }

    const normalizedRelative = relativePath.split(path.sep).join('/');
    const fileName = path.basename(filePath);

    if (normalizedRelative.split('/').some((segment) => segment.startsWith('.'))) {
      return true;
    }

    for (const rule of ignoreRules) {
      if (!rule.enabled) continue;

      switch (rule.type) {
        case 'extension': {
          const ruleExt = rule.value.startsWith('.') ? rule.value.toLowerCase() : `.${rule.value.toLowerCase()}`;
          if (path.extname(filePath).toLowerCase() === ruleExt) {
            return true;
          }
          break;
        }
        case 'name':
          if (fileName === rule.value) {
            return true;
          }
          break;
        case 'pattern':
          try {
            const regex = new RegExp(rule.value);
            if (regex.test(normalizedRelative) || regex.test(filePath)) {
              return true;
            }
          } catch {
            if (normalizedRelative.includes(rule.value) || filePath.includes(rule.value)) {
              return true;
            }
          }
          break;
        case 'folder': {
          const segments = normalizedRelative.split('/');
          if (segments.slice(0, -1).includes(rule.value)) {
            return true;
          }
          break;
        }
      }
    }

    return false;
  }

  private async isRegularFile(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async initializeKnownFilesAndCache(
    watchPathId: string,
    watchRoot: string,
    recursive: boolean,
    ignoreRules: IgnoreRule[],
  ): Promise<Set<string>> {
    const knownFiles = new Set<string>();

    const walk = async (dirPath: string, depth: number): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.normalize(path.join(dirPath, entry.name));
        if (this.shouldIgnoreFile(fullPath, watchRoot, ignoreRules)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (!recursive && depth >= 0) {
            continue;
          }
          await walk(fullPath, depth + 1);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        knownFiles.add(fullPath);
        await this.cacheCurrentFileContent(fullPath);
      }
    };

    await walk(watchRoot, 0);

    this.fileCounts.set(watchPathId, knownFiles.size);
    this.updateStatus(watchPathId, { fileCount: knownFiles.size });

    return knownFiles;
  }

  private async handleFileChange(filePath: string, watchPathId: string, eventType: 'add' | 'change' | 'unlink'): Promise<void> {
    const normalizedPath = path.normalize(filePath);
    console.log(`[Watcher] File change event: ${eventType}, path: ${normalizedPath}`);

    this.lastActivities.set(watchPathId, Date.now());
    this.updateStatus(watchPathId, { lastActivity: Date.now() });

    const dedupeKey = `${watchPathId}:${normalizedPath}:${eventType}`;
    const now = Date.now();
    const lastProcessed = this.processedChanges.get(dedupeKey) || 0;
    if (now - lastProcessed < 1000) {
      console.log(`[Watcher] Skipping duplicate event for: ${normalizedPath}`);
      return;
    }
    this.processedChanges.set(dedupeKey, now);

    if (this.onFileEvent) {
      this.onFileEvent(normalizedPath, watchPathId, eventType);
    }

    this.queueFileChange({
      pathId: watchPathId,
      filePath: normalizedPath,
      eventType,
      timestamp: Date.now(),
    });

    if ((eventType === 'change' || eventType === 'unlink') && this.onFileBeforeChange) {
      const cachedContent = this.fileContentCache.get(normalizedPath);
      if (cachedContent) {
        console.log(`[Watcher] Using cached content for: ${normalizedPath}`);
        const preBackupId = await this.onFileBeforeChange(normalizedPath, watchPathId, eventType);
        if (this.onFileAfterChange && preBackupId) {
          await this.onFileAfterChange(normalizedPath, watchPathId, preBackupId);
        }
      } else {
        console.log(`[Watcher] No cached content for: ${normalizedPath}, skipping pre-change backup`);
      }
    }

    if (this.onFileChange && eventType === 'add') {
      await this.onFileChange(normalizedPath, watchPathId, 'add');
    }

    if (eventType === 'add' || eventType === 'change') {
      await this.cacheCurrentFileContent(normalizedPath);
    }
  }

  private async cacheCurrentFileContent(filePath: string): Promise<void> {
    try {
      const exists = await fs.pathExists(filePath);
      if (!exists) return;

      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) return;
      if (stat.size > WatcherManager.MAX_SINGLE_FILE_CACHE_SIZE) return;

      const content = await fs.readFile(filePath);
      this.fileContentCache.set(filePath, {
        content,
        timestamp: Date.now(),
        size: content.length,
      });
    } catch {
      // Best-effort cache update; backup flow should not fail because of this.
    }
  }

  private updateStatus(id: string, updates: Partial<WatcherStatus>): void {
    const current = this.statuses.get(id);
    if (!current) return;

    const pending = this.pendingStatusUpdates.get(id) || {};
    const mergedUpdates = { ...pending, ...updates };
    this.pendingStatusUpdates.set(id, mergedUpdates);

    const updated = { ...current, ...mergedUpdates };
    this.statuses.set(id, updated);

    const existingTimer = this.statusUpdateTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      const latest = this.statuses.get(id);
      if (latest) {
        this.sendToRenderer(IPC_CHANNELS.WATCHER_STATUS_UPDATE, latest);
      }
      this.pendingStatusUpdates.delete(id);
      this.statusUpdateTimers.delete(id);
    }, WatcherManager.STATUS_UPDATE_THROTTLE);

    this.statusUpdateTimers.set(id, timer);
  }

  private queueFileChange(event: FileChangeEvent): void {
    this.pendingFileChanges.push(event);

    if (this.pendingFileChanges.length >= WatcherManager.FILE_CHANGES_MAX_BATCH) {
      this.flushFileChanges();
      return;
    }

    if (!this.fileChangesFlushTimer) {
      this.fileChangesFlushTimer = setTimeout(() => {
        this.flushFileChanges();
      }, WatcherManager.FILE_CHANGES_BATCH_INTERVAL);
    }
  }

  private flushFileChanges(): void {
    if (this.fileChangesFlushTimer) {
      clearTimeout(this.fileChangesFlushTimer);
      this.fileChangesFlushTimer = null;
    }

    if (this.pendingFileChanges.length === 0) return;

    const events = [...this.pendingFileChanges];
    this.pendingFileChanges = [];

    this.sendToRenderer(IPC_CHANNELS.WATCHER_FILE_CHANGED, {
      batch: true,
      events,
    });
  }

  private incrementFileCount(id: string): void {
    const count = (this.fileCounts.get(id) || 0) + 1;
    this.fileCounts.set(id, count);
    this.updateStatus(id, { fileCount: count });
  }

  private decrementFileCount(id: string): void {
    const count = Math.max(0, (this.fileCounts.get(id) || 0) - 1);
    this.fileCounts.set(id, count);
    this.updateStatus(id, { fileCount: count });
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  getFileContentCache(filePath: string): Buffer | undefined {
    const entry = this.fileContentCache.get(filePath);
    return entry?.content;
  }

  clearFileContentCache(filePath: string): void {
    this.fileContentCache.delete(filePath);
  }

  closeAll(): void {
    if (this.fileChangesFlushTimer) {
      clearTimeout(this.fileChangesFlushTimer);
      this.fileChangesFlushTimer = null;
    }
    for (const timer of this.statusUpdateTimers.values()) {
      clearTimeout(timer);
    }
    this.statusUpdateTimers.clear();
    this.pendingStatusUpdates.clear();
    this.pendingFileChanges = [];

    for (const [id] of this.watchers) {
      this.stopWatching(id);
    }

    this.knownFilesByWatcher.clear();
  }

  async getFileCount(folderPath: string, recursive: boolean, ignoreRules?: IgnoreRule[]): Promise<number> {
    try {
      const exists = await fs.pathExists(folderPath);
      if (!exists) {
        return 0;
      }

      const config = configManager.getConfig();
      const effectiveIgnoreRules =
        Array.isArray(ignoreRules) && ignoreRules.length > 0
          ? ignoreRules.filter((rule) => rule.enabled)
          : config.defaultIgnoreRules || [];

      const count = await workerManager.countFiles(folderPath, recursive, effectiveIgnoreRules);
      return count;
    } catch (error) {
      console.error('文件计数失败:', error);
      return 0;
    }
  }
}

