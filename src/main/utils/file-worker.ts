/**
 * 文件操作 Worker 线程
 * 用于处理耗时的文件遍历、计数等操作，避免阻塞主进程
 */
import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs-extra';
import * as path from 'path';

interface IgnoreRule {
  id: string;
  type: 'extension' | 'pattern' | 'name' | 'folder';
  value: string;
  enabled: boolean;
}

interface FileCountTask {
  type: 'countFiles';
  folderPath: string;
  recursive: boolean;
  ignoreRules: IgnoreRule[];
}

interface DiffTask {
  type: 'diff';
  originalContent: string;
  backupContent: string;
}

type WorkerTask = FileCountTask | DiffTask;

/**
 * 忽略规则匹配器接口
 */
interface IgnoreMatcher {
  matchName: (name: string) => boolean;
  matchPath: (fullPath: string) => boolean;
}

/**
 * 构建忽略规则匹配器
 */
function buildIgnoreMatchers(ignoreRules: IgnoreRule[] = []): IgnoreMatcher[] {
  const matchers: IgnoreMatcher[] = [];

  for (const rule of ignoreRules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case 'extension':
        // 扩展名匹配，如 .log
        const extPattern = rule.value.startsWith('.') ? rule.value : '.' + rule.value;
        matchers.push({
          matchName: (name) => name.endsWith(extPattern),
          matchPath: () => false,
        });
        break;

      case 'name':
        // 精确文件名匹配
        matchers.push({
          matchName: (name) => name === rule.value,
          matchPath: () => false,
        });
        break;

      case 'pattern':
        // 正则表达式匹配
        try {
          const regex = new RegExp(rule.value);
          matchers.push({
            matchName: (name) => regex.test(name),
            matchPath: (fullPath) => regex.test(fullPath),
          });
        } catch {
          console.error('[FileWorker] 无效的正则表达式:', rule.value);
        }
        break;

      case 'folder':
        // 文件夹匹配
        matchers.push({
          matchName: (name) => name === rule.value,
          matchPath: (fullPath) => {
            // 检查路径中是否包含该文件夹
            const parts = fullPath.split(/[/\\]/);
            return parts.includes(rule.value);
          },
        });
        break;
    }
  }

  // 默认忽略隐藏文件和文件夹（以 . 开头）
  matchers.push({
    matchName: (name) => name.startsWith('.') && name !== '.', // 忽略隐藏文件但不忽略当前目录
    matchPath: () => false,
  });

  return matchers;
}

/**
 * 检查路径是否应该被忽略
 */
function shouldIgnore(name: string, fullPath: string, matchers: IgnoreMatcher[]): boolean {
  for (const matcher of matchers) {
    if (matcher.matchName(name) || matcher.matchPath(fullPath)) {
      return true;
    }
  }
  return false;
}

/**
 * 计算文件数量（考虑忽略规则，统计不被忽略的文件）
 */
async function countFilesIterative(
  folderPath: string,
  recursive: boolean,
  ignoreRules: IgnoreRule[] = [],
  progressInterval: number = 100
): Promise<number> {
  const matchers = buildIgnoreMatchers(ignoreRules);

  let count = 0;
  let lastProgressUpdate = Date.now();

  // 使用队列进行迭代式遍历
  const dirQueue: string[] = [folderPath];

  while (dirQueue.length > 0) {
    const currentDir = dirQueue.shift()!;

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const isIgnored = shouldIgnore(entry.name, fullPath, matchers);

        if (isIgnored) {
          continue;
        }

        if (entry.isFile()) {
          count++;

          // 定期发送进度更新
          const now = Date.now();
          if (now - lastProgressUpdate > progressInterval) {
            parentPort?.postMessage({ type: 'progress', count, currentPath: fullPath });
            lastProgressUpdate = now;
          }
        } else if (entry.isDirectory() && recursive) {
          dirQueue.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略目录读取错误，继续处理其他目录
    }
  }

  return count;
}

// 简单的 diff 计算（用于 Worker）
function computeDiff(originalContent: string, backupContent: string): Array<[number, string]> {
  // 使用简化的行级 diff 算法
  const originalLines = originalContent.split('\n');
  const backupLines = backupContent.split('\n');

  const diffs: Array<[number, string]> = [];
  const maxLines = Math.max(originalLines.length, backupLines.length);

  // 构建 LCS (最长公共子序列) 表
  const lcs: number[][] = [];
  for (let i = 0; i <= backupLines.length; i++) {
    lcs[i] = [];
    for (let j = 0; j <= originalLines.length; j++) {
      if (i === 0 || j === 0) {
        lcs[i][j] = 0;
      } else if (backupLines[i - 1] === originalLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // 回溯生成 diff
  let i = backupLines.length;
  let j = originalLines.length;
  const result: Array<[number, string]> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && backupLines[i - 1] === originalLines[j - 1]) {
      result.unshift([0, backupLines[i - 1] + '\n']);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      result.unshift([1, originalLines[j - 1] + '\n']); // 新增
      j--;
    } else if (i > 0) {
      result.unshift([-1, backupLines[i - 1] + '\n']); // 删除
      i--;
    }
  }

  return result;
}

// 处理任务的通用函数
async function handleTask(task: WorkerTask): Promise<void> {
  try {
    switch (task.type) {
      case 'countFiles': {
        const count = await countFilesIterative(
          task.folderPath,
          task.recursive,
          task.ignoreRules
        );
        parentPort?.postMessage({ type: 'result', count });
        break;
      }
      case 'diff': {
        const diffs = computeDiff(task.originalContent, task.backupContent);
        parentPort?.postMessage({ type: 'result', diffs });
        break;
      }
    }
  } catch (error) {
    console.error('[FileWorker] 处理任务时出错:', error);
    parentPort?.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// 监听后续的 postMessage（作为备用通道）
parentPort?.on('message', async (task: WorkerTask) => {
  console.log('[FileWorker] 通过 postMessage 收到任务');
  await handleTask(task);
});

// 优先处理 workerData 中的初始任务（避免竞态条件）
if (workerData && workerData.type) {
  console.log('[FileWorker] 通过 workerData 收到初始任务:', workerData.type);
  handleTask(workerData as WorkerTask);
}
