/**
 * Worker 线程管理器
 * 用于在后台线程执行耗时操作，避免阻塞主进程
 */
import { Worker } from 'worker_threads';
import * as path from 'path';
import { IgnoreRule } from '../types';

interface FileCountResult {
  type: 'result';
  count: number;
}

interface DiffResult {
  type: 'result';
  diffs: Array<[number, string]>;
}

interface ProgressUpdate {
  type: 'progress';
  count: number;
  currentPath: string;
}

interface ErrorResponse {
  type: 'error';
  error: string;
}

type WorkerMessage = FileCountResult | DiffResult | ProgressUpdate | ErrorResponse;

export class WorkerManager {
  private workerPath: string;

  constructor() {
    // Worker 脚本路径
    this.workerPath = path.join(__dirname, 'file-worker.js');
  }

  /**
   * 在 Worker 中计算文件数量
   */
  async countFiles(
    folderPath: string,
    recursive: boolean,
    ignoreRules: IgnoreRule[],
    onProgress?: (count: number, currentPath: string) => void
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerPath, {
        workerData: { type: 'countFiles', folderPath, recursive, ignoreRules }
      });

      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'result' && 'count' in message) {
          resolve(message.count);
          worker.terminate();
        } else if (message.type === 'progress' && onProgress) {
          onProgress(message.count, message.currentPath);
        } else if (message.type === 'error') {
          reject(new Error(message.error));
          worker.terminate();
        }
      });

      worker.on('error', (error) => {
        reject(error);
        worker.terminate();
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });

    });
  }

  /**
   * 在 Worker 中计算文件差异
   */
  async computeDiff(
    originalContent: string,
    backupContent: string
  ): Promise<Array<[number, string]>> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerPath, {
        workerData: { type: 'diff', originalContent, backupContent }
      });

      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'result' && 'diffs' in message) {
          resolve(message.diffs);
          worker.terminate();
        } else if (message.type === 'error') {
          reject(new Error(message.error));
          worker.terminate();
        }
      });

      worker.on('error', (error) => {
        reject(error);
        worker.terminate();
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });

    });
  }
}

// 单例
export const workerManager = new WorkerManager();
