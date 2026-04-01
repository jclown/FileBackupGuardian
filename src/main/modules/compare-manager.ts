import * as fs from 'fs-extra';
import * as path from 'path';
import { CompareResult, FileDiff } from '../types';
import { workerManager } from '../utils/worker-manager';

// 文件大小阈值，超过此值使用简化对比
const MAX_DIFF_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 文本文件扩展名缓存
const textFileCache = new Map<string, boolean>();

interface DMP {
  diff_main: (text1: string, text2: string) => [number, string][];
  diff_cleanupSemantic: (diffs: [number, string][]) => void;
}

export class CompareManager {
  private dmp: DMP | null = null;
  // 动态加载 diff-match-patch（延迟加载）
  private getDiffMatchPatch(): DMP {
    if (!this.dmp) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.dmp = new (require('diff-match-patch'))() as DMP;
    }
    return this.dmp;
  }

  /**
   * 对比两个文件
   */
  async compare(originalPath: string, backupPath: string): Promise<CompareResult> {
    // 检查文件是否存在
    const [originalExists, backupExists] = await Promise.all([
      fs.pathExists(originalPath),
      fs.pathExists(backupPath),
    ]);

    if (!originalExists) {
      throw new Error(`原文件不存在: ${originalPath}`);
    }
    if (!backupExists) {
      throw new Error(`备份文件不存在: ${backupPath}`);
    }

    // 获取文件信息
    const [originalStat, backupStat] = await Promise.all([
      fs.stat(originalPath),
      fs.stat(backupPath),
    ]);

    const isTextFile = await this.isTextFile(originalPath);
    const fileSize = Math.max(originalStat.size, backupStat.size);

    const result: CompareResult = {
      originalPath,
      backupPath,
      isTextFile,
      diffs: [],
      originalSize: originalStat.size,
      backupSize: backupStat.size,
      originalModifiedTime: originalStat.mtimeMs,
      backupModifiedTime: backupStat.mtimeMs,
    };

    if (isTextFile) {
      // 大文件使用 Worker 线程计算，小文件直接计算
      if (fileSize > MAX_DIFF_FILE_SIZE) {
        result.diffs = await this.compareTextFilesInWorker(originalPath, backupPath);
      } else {
        result.diffs = await this.compareTextFiles(originalPath, backupPath);
      }
    }

    return result;
  }

  /**
   * 在 Worker 线程中对比文本文件（大文件）
   */
  private async compareTextFilesInWorker(originalPath: string, backupPath: string): Promise<FileDiff[]> {
    const [originalContent, backupContent] = await Promise.all([
      fs.readFile(originalPath, 'utf-8'),
      fs.readFile(backupPath, 'utf-8'),
    ]);

    try {
      // 使用 Worker 线程计算 diff
      const dmpDiffs = await workerManager.computeDiff(originalContent, backupContent);
      return this.convertDiffsToFileDiffs(dmpDiffs);
    } catch (error) {
      console.error('[CompareManager] Worker diff failed, falling back to simple comparison:', error);
      // 降级为简化对比
      return this.simpleCompare(originalContent, backupContent);
    }
  }

  /**
   * 对比文本文件（小文件，直接计算）
   */
  private async compareTextFiles(originalPath: string, backupPath: string): Promise<FileDiff[]> {
    const [originalContent, backupContent] = await Promise.all([
      fs.readFile(originalPath, 'utf-8'),
      fs.readFile(backupPath, 'utf-8'),
    ]);

    const dmp = this.getDiffMatchPatch();
    const dmpDiffs = dmp.diff_main(backupContent, originalContent);
    dmp.diff_cleanupSemantic(dmpDiffs);

    return this.convertDiffsToFileDiffs(dmpDiffs);
  }

  /**
   * 将 dmp 差异转换为 FileDiff 数组
   */
  private convertDiffsToFileDiffs(dmpDiffs: [number, string][]): FileDiff[] {
    const diffs: FileDiff[] = [];
    let lineNumber = 1;
    let currentContent = '';
    let currentOldContent = '';

    for (const [op, text] of dmpDiffs) {
      const lines = text.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isLastLine = i === lines.length - 1;

        if (op === 0) {
          // 无变化
          if (!isLastLine || text.endsWith('\n')) {
            lineNumber++;
          }
        } else if (op === 1) {
          // 新增
          currentContent += line;
          if (!isLastLine || text.endsWith('\n')) {
            diffs.push({
              type: 'add',
              lineNumber: lineNumber++,
              content: currentContent,
            });
            currentContent = '';
          }
        } else if (op === -1) {
          // 删除
          currentOldContent += line;
          if (!isLastLine || text.endsWith('\n')) {
            diffs.push({
              type: 'delete',
              lineNumber: lineNumber,
              content: currentOldContent,
            });
            currentOldContent = '';
          }
        }
      }
    }

    // 处理修改（删除+新增）
    return this.mergeConsecutiveDiffs(diffs);
  }

  /**
   * 简化对比（降级方案，仅比较行差异）
   */
  private simpleCompare(originalContent: string, backupContent: string): FileDiff[] {
    const originalLines = originalContent.split('\n');
    const backupLines = backupContent.split('\n');
    const diffs: FileDiff[] = [];
    
    const maxLines = Math.max(originalLines.length, backupLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const backupLine = backupLines[i];
      
      if (origLine === undefined && backupLine !== undefined) {
        diffs.push({ type: 'delete', lineNumber: i + 1, content: backupLine });
      } else if (backupLine === undefined && origLine !== undefined) {
        diffs.push({ type: 'add', lineNumber: i + 1, content: origLine });
      } else if (origLine !== backupLine) {
        diffs.push({
          type: 'modify',
          lineNumber: i + 1,
          content: origLine || '',
          oldContent: backupLine || '',
        });
      }
    }
    
    return diffs;
  }

  /**
   * 合并连续的差异（将连续的删除和新增合并为修改）
   */
  private mergeConsecutiveDiffs(diffs: FileDiff[]): FileDiff[] {
    const result: FileDiff[] = [];
    let i = 0;

    while (i < diffs.length) {
      const current = diffs[i];

      if (current.type === 'delete' && i + 1 < diffs.length && diffs[i + 1].type === 'add') {
        // 合并为修改
        result.push({
          type: 'modify',
          lineNumber: current.lineNumber,
          content: diffs[i + 1].content,
          oldContent: current.content,
        });
        i += 2;
      } else {
        result.push(current);
        i++;
      }
    }

    return result;
  }

  /**
   * 判断是否为文本文件（带缓存）
   */
  private async isTextFile(filePath: string): Promise<boolean> {
    const ext = path.extname(filePath).toLowerCase();
    
    // 先检查缓存
    if (textFileCache.has(ext)) {
      return textFileCache.get(ext)!;
    }

    const textExtensions = [
      '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.vue', '.css', '.scss', '.html',
      '.xml', '.yaml', '.yml', '.ini', '.conf', '.log', '.py', '.java', '.c', '.cpp', '.h',
      '.go', '.rs', '.rb', '.php', '.sql', '.sh', '.bat', '.ps1', '.env', '.gitignore',
    ];

    if (textExtensions.includes(ext)) {
      textFileCache.set(ext, true);
      return true;
    }

    // 检查文件是否为二进制
    try {
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(8192);
      await fs.read(fd, buffer, 0, 8192, 0);
      await fs.close(fd);

      // 如果前 8KB 中有空字节，则认为是二进制文件
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) {
          textFileCache.set(ext, false);
          return false;
        }
      }
      textFileCache.set(ext, true);
      return true;
    } catch {
      textFileCache.set(ext, false);
      return false;
    }
  }

  /**
   * 获取差异统计
   */
  getDiffStats(diffs: FileDiff[]): { added: number; deleted: number; modified: number } {
    return {
      added: diffs.filter(d => d.type === 'add').length,
      deleted: diffs.filter(d => d.type === 'delete').length,
      modified: diffs.filter(d => d.type === 'modify').length,
    };
  }

  /**
   * 生成差异报告
   */
  generateDiffReport(result: CompareResult): string {
    const lines: string[] = [];

    lines.push(`文件对比报告`);
    lines.push(`=================`);
    lines.push(`原文件: ${result.originalPath}`);
    lines.push(`备份文件: ${result.backupPath}`);
    lines.push(``);

    if (!result.isTextFile) {
      lines.push(`文件类型: 二进制文件`);
      lines.push(`原文件大小: ${this.formatSize(result.originalSize)}`);
      lines.push(`备份文件大小: ${this.formatSize(result.backupSize)}`);
      lines.push(`大小差异: ${this.formatSize(Math.abs(result.originalSize - result.backupSize))}`);
    } else {
      lines.push(`文件类型: 文本文件`);
      const stats = this.getDiffStats(result.diffs);
      lines.push(`新增行数: ${stats.added}`);
      lines.push(`删除行数: ${stats.deleted}`);
      lines.push(`修改行数: ${stats.modified}`);
      lines.push(``);
      lines.push(`详细差异:`);
      lines.push(`---------`);

      for (const diff of result.diffs) {
        const prefix = diff.type === 'add' ? '+' : diff.type === 'delete' ? '-' : '~';
        const typeLabel = diff.type === 'add' ? '新增' : diff.type === 'delete' ? '删除' : '修改';
        
        lines.push(`行 ${diff.lineNumber} [${typeLabel}]:`);
        
        if (diff.type === 'modify' && diff.oldContent) {
          lines.push(`  - ${diff.oldContent}`);
          lines.push(`  + ${diff.content}`);
        } else {
          lines.push(`  ${prefix} ${diff.content}`);
        }
      }
    }

    return lines.join('\n');
  }

  async compareBackups(preBackupPath: string, postBackupPath: string): Promise<CompareResult> {
    return this.compare(preBackupPath, postBackupPath);
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
