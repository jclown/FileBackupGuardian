<template>
  <div class="compare-view">
    <header class="compare-header">
      <div class="header-main">
        <button class="back-btn-modern" @click="goBack" title="返回">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 class="page-title">备份前后对比</h1>
          <p class="page-desc">{{ headerDescription }}</p>
        </div>
      </div>
    </header>

    <section class="workspace" :class="{ single: !backupPairs.length, collapsed: isBackupListCollapsed }">
      <aside v-if="backupPairs.length > 0" class="versions-panel" :class="{ collapsed: isBackupListCollapsed }">
        <div class="panel-head">
          <div class="panel-head-left">
            <span v-if="!isBackupListCollapsed" class="panel-title">备份对列表</span>
            <span v-else class="panel-title-mini">备份对</span>
          </div>
          <div class="panel-head-right">
            <span v-if="!isBackupListCollapsed" class="panel-count">{{ backupPairs.length }}</span>
            <button
              class="splitter-toggle"
              :title="isBackupListCollapsed ? '展开备份列表' : '收起备份列表'"
              :aria-label="isBackupListCollapsed ? '展开备份列表' : '收起备份列表'"
              @click="toggleBackupList"
            >
              <svg class="collapse-icon" :class="{ collapsed: isBackupListCollapsed }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-show="!isBackupListCollapsed" class="panel-content">
          <div v-if="loadingBackups" class="state-block">
            <span class="loading-spinner"></span>
            <span>加载备份列表...</span>
          </div>

          <div v-else-if="backupPairs.length === 0" class="state-block empty">
            <p>暂无可对比的备份对</p>
            <p class="hint">文件修改后会生成前后备份对</p>
          </div>

          <div v-else class="version-list">
            <button
              v-for="(pair, index) in backupPairs"
              :key="index"
              class="version-item pair-item"
              :class="{ active: selectedPairIndex === index }"
              @click="selectPairToCompare(index)"
            >
              <div class="version-top">
                <span class="file-name">{{ getFileName(pair[0].originalPath) }}</span>
              </div>
              <div class="version-meta">
                <span class="time-range">{{ formatFullTime(pair[0].timestamp) }} → {{ formatFullTime(pair[1].timestamp) }}</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <main class="result-panel">
        <div class="result-toolbar">
          <div class="toolbar-title">
            <h2>对比结果</h2>
            <p>{{ compareHint }}</p>
          </div>

          <div class="toolbar-actions" v-if="compareResult && compareResult.isTextFile">
                        <button class="btn btn-primary-modern" :class="{ active: showOnlyChanges }" @click="toggleOnlyChanges">
              {{ showOnlyChanges ? '显示全部' : '仅看差异' }}
            </button>
            <button class="btn btn-primary-modern" :disabled="diffEntries.length === 0" @click="jumpDiff(-1)">上一处</button>
            <button class="btn btn-primary-modern" :disabled="diffEntries.length === 0" @click="jumpDiff(1)">下一处</button>
          </div>
        </div>

        <div v-if="comparing" class="state-block">
          <span class="loading-spinner large"></span>
          <span>正在计算差异...</span>
        </div>

        <div v-else-if="!compareResult" class="state-block empty result-empty">
          <p>请从左侧备份对列表中选择一项开始对比。</p>
          <p class="hint">备份对包含文件修改前后的版本</p>
        </div>

        <template v-else>
          <div class="file-info-card" v-if="selectedBackupPair">
            <div class="file-info-main">
              <div class="file-info-text">
                <span class="file-path">{{ compareResult.originalPath }}</span>
                <span class="file-meta">
                  大小: {{ formatSize(compareResult.originalSize) }} → {{ formatSize(compareResult.backupSize) }}
                  <span :class="['size-change', sizeChangeClass]">{{ sizeChangeText }}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="stats-grid" v-if="compareResult.isTextFile">
            <div class="stat-card add">
              <span class="stat-num">+{{ diffStats.added }}</span>
              <span class="stat-label">新增行</span>
            </div>
            <div class="stat-card del">
              <span class="stat-num">-{{ diffStats.deleted }}</span>
              <span class="stat-label">删除行</span>
            </div>
            <div class="stat-card same">
              <span class="stat-num">{{ diffStats.unchanged }}</span>
              <span class="stat-label">未变更行</span>
            </div>
          </div>

          <div class="legend" v-if="compareResult.isTextFile">
            <span class="legend-item"><i class="dot add"></i> 绿色：新增行</span>
            <span class="legend-item"><i class="dot del"></i> 红色：删除行</span>
            <span class="legend-item"><i class="dot same"></i> 白色：未变化</span>
          </div>

          <div class="diff-container" v-if="compareResult.isTextFile">
            <div class="split-diff-view">
              <section class="code-panel original">
                <header class="code-head">
                  <div class="code-head-left">
                    <strong>修改前版本</strong>
                    <span>{{ formatSize(compareResult.originalSize || 0) }}</span>
                  </div>
                  <button class="btn btn-primary-modern btn-restore" @click="restoreFromPreBackup" :disabled="comparing">
                    恢复修改前
                  </button>
                </header>

                <div ref="originalBodyRef" class="code-body" :class="{ 'only-changes': showOnlyChanges }" @scroll="handleScroll('original', $event)">
                  <div
                    v-for="(line, index) in originalLines"
                    :key="`orig-${index}`"
                    :data-side="'original'"
                    :data-line="index + 1"
                    :class="getLineClasses('original', index + 1)"
                  >
                    <span class="line-no">{{ index + 1 }}</span>
                    <span class="line-text">{{ line }}</span>
                  </div>
                </div>
              </section>

              <section class="code-panel backup">
                <header class="code-head">
                  <div class="code-head-left">
                    <strong>修改后版本</strong>
                    <span>{{ formatSize(compareResult.backupSize || 0) }}</span>
                  </div>
                  <button class="btn btn-primary-modern btn-restore" @click="restoreFromPostBackup" :disabled="comparing">
                    恢复修改后
                  </button>
                </header>

                <div ref="backupBodyRef" class="code-body" :class="{ 'only-changes': showOnlyChanges }" @scroll="handleScroll('backup', $event)">
                  <div
                    v-for="(line, index) in backupLines"
                    :key="`back-${index}`"
                    :data-side="'backup'"
                    :data-line="index + 1"
                    :class="getLineClasses('backup', index + 1)"
                  >
                    <span class="line-no">{{ index + 1 }}</span>
                    <span class="line-text">{{ line }}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div class="binary-state" v-else>
            <div class="binary-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p>二进制文件，无法按行展示差异</p>
            <p class="hint">文件大小: {{ formatSize(compareResult.originalSize) }} → {{ formatSize(compareResult.backupSize) }}</p>
          </div>
        </template>
      </main>
    </section>

    <ConfirmDialog
      v-model:visible="restoreDialog.visible"
      :title="restoreDialog.title"
      :message="restoreDialog.message"
      :details="restoreDialogDetails"
      confirm-text="确认恢复"
      loading-text="恢复中..."
      :loading="restoreDialog.loading"
      @confirm="confirmRestore"
      @cancel="closeRestoreDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAppStore } from '../stores/app';
import ConfirmDialog from '../components/ConfirmDialog.vue';

interface CompareResult {
  originalPath: string;
  backupPath: string;
  isTextFile: boolean;
  diffs: Array<{ type: string; lineNumber?: number; content: string; oldContent?: string }>;
  originalSize: number;
  backupSize: number;
  originalModifiedTime: number;
  backupModifiedTime: number;
}

interface BackupRecord {
  id: string;
  originalPath: string;
  backupPath: string;
  timestamp: number;
  type: 'full';
  changeType?: 'add' | 'change' | 'unlink';
  fileSize: number;
  pairedBackupId?: string;
}

interface DiffChange {
  type: 'add' | 'delete' | 'unchanged';
  originalLine?: number;
  backupLine?: number;
}

interface DiffEntry {
  line: number;
  type: 'add' | 'delete';
  backupLine: number; // 在 backup 侧的对应位置
}

const store = useAppStore();
const router = useRouter();
const route = useRoute();

const backupPairs = ref<BackupRecord[][]>([]);
const selectedPairIndex = ref<number>(-1);
const loadingBackups = ref(false);

const comparing = ref(false);
const currentPreBackup = ref<BackupRecord | null>(null);
const currentPostBackup = ref<BackupRecord | null>(null);
const compareResult = ref<CompareResult | null>(null);
const originalContent = ref('');
const backupContent = ref('');

const isBackupListCollapsed = ref(false);
const showOnlyChanges = ref(false);
const currentDiffIndex = ref(0);
const focusedDiff = ref<DiffEntry | null>(null);

const isScrollSyncing = ref(false);

const originalBodyRef = ref<HTMLElement | null>(null);
const backupBodyRef = ref<HTMLElement | null>(null);

const restoreDialog = ref<{
  visible: boolean;
  loading: boolean;
  title: string;
  message: string;
  fileName: string;
  versionLabel: string;
  mode: 'pre' | 'post';
}>({
  visible: false,
  loading: false,
  title: '',
  message: '',
  fileName: '',
  versionLabel: '',
  mode: 'pre',
});

const restoreDialogDetails = computed(() => [
  { label: '文件', value: restoreDialog.value.fileName },
  { label: '版本', value: restoreDialog.value.versionLabel },
]);

const selectedBackupPair = computed(() => {
  if (selectedPairIndex.value >= 0 && selectedPairIndex.value < backupPairs.value.length) {
    return backupPairs.value[selectedPairIndex.value];
  }
  return null;
});

const headerDescription = computed(() => {
  if (selectedBackupPair.value) {
    const pair = selectedBackupPair.value;
    return `${pair[0].originalPath}`;
  }
  return '查看文件修改前后的对比';
});

const compareHint = computed(() => {
  if (selectedBackupPair.value) {
    const pair = selectedBackupPair.value;
    return `修改前: ${formatFullTime(pair[0].timestamp)} → 修改后: ${formatFullTime(pair[1].timestamp)}`;
  }
  if (compareResult.value) {
    return '已加载对比结果';
  }
  return '未选择备份对';
});

const originalLines = computed(() => originalContent.value.split('\n'));
const backupLines = computed(() => backupContent.value.split('\n'));

const sizeChangeClass = computed(() => {
  if (!compareResult.value) return '';
  const diff = compareResult.value.backupSize - compareResult.value.originalSize;
  if (diff > 0) return 'increase';
  if (diff < 0) return 'decrease';
  return 'same';
});

const sizeChangeText = computed(() => {
  if (!compareResult.value) return '';
  const diff = compareResult.value.backupSize - compareResult.value.originalSize;
  if (diff > 0) return `(+${formatSize(diff)})`;
  if (diff < 0) return `(-${formatSize(Math.abs(diff))})`;
  return '(无变化)';
});

const diffMap = computed(() => {
  const origLines = originalLines.value;
  const backLines = backupLines.value;

  const origMap = new Map<number, DiffChange>();
  const backMap = new Map<number, DiffChange>();

  const m = origLines.length;
  const n = backLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (origLines[i - 1] === backLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === backLines[j - 1]) {
      origMap.set(i, { type: 'unchanged', originalLine: i, backupLine: j });
      backMap.set(j, { type: 'unchanged', originalLine: i, backupLine: j });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      backMap.set(j, { type: 'add', backupLine: j });
      j -= 1;
    } else if (i > 0) {
      origMap.set(i, { type: 'delete', originalLine: i });
      i -= 1;
    }
  }

  return { origMap, backMap };
});

const diffStats = computed(() => {
  let added = 0;
  let deleted = 0;
  let unchanged = 0;

  diffMap.value.origMap.forEach(change => {
    if (change.type === 'delete') deleted += 1;
    else if (change.type === 'unchanged') unchanged += 1;
  });

  diffMap.value.backMap.forEach(change => {
    if (change.type === 'add') added += 1;
  });

  return { added, deleted, unchanged };
});

function getLineClasses(side: 'original' | 'backup', lineNum: number): string[] {
  const map = side === 'original' ? diffMap.value.origMap : diffMap.value.backMap;
  const change = map.get(lineNum);
  // focus 判断：backup 侧直接比较行号，original 侧需要通过映射比较
  let isFocused = false;
  if (focusedDiff.value) {
    if (side === 'backup') {
      isFocused = focusedDiff.value.backupLine === lineNum;
    } else {
      // original 侧：如果是 add 类型，focus 在对应 backup 行之前的 unchanged 行
      // 如果是 delete 类型，focus 在原始行
      if (focusedDiff.value.type === 'delete') {
        isFocused = focusedDiff.value.line === lineNum;
      }
    }
  }
  return ['code-line', change?.type || '', isFocused ? 'focused' : ''];
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}


function formatFullTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function toggleBackupList() {
  isBackupListCollapsed.value = !isBackupListCollapsed.value;
}

function toggleOnlyChanges() {
  showOnlyChanges.value = !showOnlyChanges.value;
}

function goBack() {
  router.back();
}

async function loadBackupPairs() {
  loadingBackups.value = true;
  try {
    const filePath = route.query.filePath as string | undefined;
    const result = await window.electronAPI.backup.getPairs(filePath);
    if (result.success && result.data) {
      backupPairs.value = result.data as BackupRecord[][];
      if (backupPairs.value.length > 0) {
        await selectPairToCompare(0);
      }
    }
  } catch (error) {
    store.addNotification({
      type: 'error',
      message: '加载备份对列表失败: ' + (error instanceof Error ? error.message : String(error)),
    });
  } finally {
    loadingBackups.value = false;
  }
}

async function selectPairToCompare(index: number) {
  selectedPairIndex.value = index;
  const pair = backupPairs.value[index];
  if (!pair || pair.length < 2) return;
  
  await comparePairedBackups(pair[0].id);
}

async function comparePairedBackups(preBackupId: string) {
  comparing.value = true;
  focusedDiff.value = null;
  currentPreBackup.value = null;
  currentPostBackup.value = null;
  
  try {
    const result = await window.electronAPI.compare.pairedBackups(preBackupId);
    if (result.success && result.data) {
      const data = result.data as { preBackup: BackupRecord; postBackup: BackupRecord; compareResult: CompareResult };
      compareResult.value = data.compareResult;
      currentPreBackup.value = data.preBackup;
      currentPostBackup.value = data.postBackup;
      
      if (compareResult.value.isTextFile) {
        try {
          const origResult = await window.electronAPI.readFile(data.preBackup.backupPath);
          const backResult = await window.electronAPI.readFile(data.postBackup.backupPath);
          originalContent.value = origResult.success ? ((origResult.data as string) || '') : '';
          backupContent.value = backResult.success ? ((backResult.data as string) || '') : '';
        } catch {
          originalContent.value = '';
          backupContent.value = '';
        }
      } else {
        originalContent.value = '';
        backupContent.value = '';
      }
    } else {
      store.addNotification({ type: 'error', message: result.error || '对比失败' });
    }
  } catch (error) {
    store.addNotification({
      type: 'error',
      message: '对比失败: ' + (error instanceof Error ? error.message : String(error)),
    });
  } finally {
    comparing.value = false;
  }
}

// 收集所有变更在 backup 侧的对应位置
const diffEntries = computed<DiffEntry[]>(() => {
  const entries: DiffEntry[] = [];
  const { origMap, backMap } = diffMap.value;

  // 从 backup 侧收集新增行（直接使用 backup 行号）
  backMap.forEach((change, lineNum) => {
    if (change.type === 'add') {
      entries.push({ line: lineNum, type: 'add', backupLine: lineNum });
    }
  });

  // 从 original 侧收集删除行，并计算其在 backup 侧的对应位置
  origMap.forEach((change, origLineNum) => {
    if (change.type === 'delete') {
      // 找到删除行在 backup 侧的对应位置
      // 方法：找到删除行之前最后一个 unchanged 行的 backupLine
      let backupLine = 1;
      for (let i = origLineNum - 1; i >= 1; i--) {
        const prevChange = origMap.get(i);
        if (prevChange && prevChange.type === 'unchanged' && prevChange.backupLine) {
          backupLine = prevChange.backupLine + 1;
          break;
        }
      }
      entries.push({ line: origLineNum, type: 'delete', backupLine });
    }
  });

  // 按 backup 行号排序
  entries.sort((a, b) => a.backupLine - b.backupLine);
  return entries;
});

function jumpToDiff(index: number, smooth = true) {
  const entry = diffEntries.value[index];
  if (!entry) return;

  focusedDiff.value = entry;

  // 使用多次 nextTick 确保 DOM 完全更新
  nextTick(() => {
    nextTick(() => {
      // 始终跳转到 backup 侧（修改后版本）
      const container = backupBodyRef.value;
      const otherContainer = originalBodyRef.value;
      if (!container || !otherContainer) {
        console.warn('Container not found');
        return;
      }

      // 使用 backupLine 作为跳转目标
      const target = container.querySelector<HTMLElement>(`[data-line="${entry.backupLine}"]`);
      if (!target) {
        console.warn('Target element not found for line:', entry.backupLine);
        return;
      }

      // 阻止滚动事件处理器干扰
      isScrollSyncing.value = true;

      // 使用 getBoundingClientRect 精确计算相对位置
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;

      // 计算目标相对于容器的位置
      const relativeTop = targetRect.top - containerRect.top + currentScrollTop;
      const scrollTo = relativeTop - (containerRect.height / 2) + (targetRect.height / 2);

      container.scrollTo({
        top: Math.max(0, scrollTo),
        behavior: smooth ? 'smooth' : 'auto',
      });

      // 同步滚动另一侧到相同比例位置
      const maxScroll = container.scrollHeight - container.clientHeight;
      const otherMaxScroll = otherContainer.scrollHeight - otherContainer.clientHeight;
      const scrollRatio = Math.max(0, scrollTo) / maxScroll;
      const otherScrollTo = scrollRatio * otherMaxScroll;

      otherContainer.scrollTo({
        top: Math.max(0, otherScrollTo),
        behavior: smooth ? 'smooth' : 'auto',
      });

      // 滚动完成后释放锁
      setTimeout(() => {
        isScrollSyncing.value = false;
      }, smooth ? 500 : 100);
    });
  });
}

function jumpDiff(step: number) {
  const total = diffEntries.value.length;
  if (total === 0) return;

  const direction = step >= 0 ? 1 : -1;
  let nextIndex = currentDiffIndex.value + direction;
  if (nextIndex >= total) nextIndex = 0;
  if (nextIndex < 0) nextIndex = total - 1;

  currentDiffIndex.value = nextIndex;
  jumpToDiff(nextIndex);
}

function handleScroll(side: 'original' | 'backup', event: Event) {
  if (isScrollSyncing.value) return;
  isScrollSyncing.value = true;
  
  const source = event.target as HTMLElement;
  const target = side === 'original' ? backupBodyRef.value : originalBodyRef.value;
  
  if (target && source) {
    const scrollRatio = source.scrollTop / (source.scrollHeight - source.clientHeight);
    target.scrollTop = scrollRatio * (target.scrollHeight - target.clientHeight);
  }
  
  requestAnimationFrame(() => {
    isScrollSyncing.value = false;
  });
}

function restoreFromPreBackup() {
  if (!currentPreBackup.value) return;
  const backup = currentPreBackup.value;
  restoreDialog.value = {
    visible: true,
    loading: false,
    title: '恢复修改前版本',
    message: '恢复后将覆盖当前文件内容，确定要继续吗？',
    fileName: backup.originalPath.split(/[/\\]/).pop() || backup.originalPath,
    versionLabel: `修改前版本 (${formatFullTime(backup.timestamp)})`,
    mode: 'pre',
  };
}

function restoreFromPostBackup() {
  if (!currentPostBackup.value) return;
  const backup = currentPostBackup.value;
  restoreDialog.value = {
    visible: true,
    loading: false,
    title: '恢复修改后版本',
    message: '恢复后将覆盖当前文件内容，确定要继续吗？',
    fileName: backup.originalPath.split(/[/\\]/).pop() || backup.originalPath,
    versionLabel: `修改后版本 (${formatFullTime(backup.timestamp)})`,
    mode: 'post',
  };
}

function closeRestoreDialog() {
  if (restoreDialog.value.loading) return;
  restoreDialog.value.visible = false;
}

async function confirmRestore() {
  if (restoreDialog.value.loading) return;
  restoreDialog.value.loading = true;

  const backup = restoreDialog.value.mode === 'pre' ? currentPreBackup.value : currentPostBackup.value;
  if (!backup) {
    restoreDialog.value.visible = false;
    return;
  }

  try {
    const result = await window.electronAPI.backup.restore(backup.id);
    if (result.success) {
      store.addNotification({ type: 'success', message: '恢复成功' });
      restoreDialog.value.visible = false;
    } else {
      store.addNotification({ type: 'error', message: result.error || '恢复失败' });
    }
  } catch (error) {
    store.addNotification({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    restoreDialog.value.loading = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!compareResult.value?.isTextFile) return;
  
  switch (event.key) {
    case 'j':
    case 'ArrowDown':
      if (!event.target || (event.target as HTMLElement).tagName !== 'INPUT') {
        event.preventDefault();
        jumpDiff(1);
      }
      break;
    case 'k':
    case 'ArrowUp':
      if (!event.target || (event.target as HTMLElement).tagName !== 'INPUT') {
        event.preventDefault();
        jumpDiff(-1);
      }
      break;
  }
}

onMounted(() => {
  loadBackupPairs();
  document.addEventListener('keydown', handleKeydown);
});

watch(
  diffEntries,
  (entries) => {
    currentDiffIndex.value = 0;
    if (entries.length > 0) {
      focusedDiff.value = entries[0];
    }
  }
);
</script>

<style scoped>
.compare-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.compare-header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn-modern {
  width: 40px;
  height: 40px;
  border: none;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.back-btn-modern:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.back-btn-modern svg {
  width: 20px;
  height: 20px;
  color: white;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.page-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0 0 0;
}

.header-steps {
  display: flex;
  gap: 8px;
}

.step-chip {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  background: #f3f4f6;
  color: #9ca3af;
  transition: all 0.2s;
}

.step-chip.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.workspace {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.workspace.collapsed {
  padding-left: 48px;
}

.versions-panel {
  width: 280px;
  background: white;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  flex-shrink: 0;
}

.versions-panel.collapsed {
  width: 48px;
}

.panel-head {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.panel-title-mini {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.panel-count {
  background: #dbeafe;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.splitter-toggle {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.splitter-toggle:hover {
  background: #f3f4f6;
}

.collapse-icon {
  width: 16px;
  height: 16px;
  color: #6b7280;
  transition: transform 0.3s;
}

.collapse-icon.collapsed {
  transform: rotate(180deg);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6b7280;
  text-align: center;
}

.state-block p {
  margin: 0;
}

.state-block .hint {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

.loading-spinner.large {
  width: 40px;
  height: 40px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.version-item:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.version-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.version-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.file-icon {
  font-size: 16px;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.time-range {
  font-size: 11px;
  color: #6b7280;
}

.result-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: white;
  overflow: hidden;
}

.result-toolbar {
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.toolbar-title h2 {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.toolbar-title p {
  font-size: 12px;
  color: #6b7280;
  margin: 4px 0 0 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary.active {
  background: #dbeafe;
  color: #2563eb;
}

.btn-primary-modern {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-primary-modern:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.btn-primary-modern:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.diff-counter {
  font-size: 12px;
  color: #6b7280;
  padding: 4px 8px;
  background: #f3f4f6;
  border-radius: 4px;
}

.file-info-card {
  padding: 8px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.file-info-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon-large {
  font-size: 24px;
}

.file-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-path {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.file-meta {
  font-size: 12px;
  color: #6b7280;
}

.size-change {
  margin-left: 8px;
  font-weight: 500;
}

.size-change.increase {
  color: #059669;
}

.size-change.decrease {
  color: #dc2626;
}

.size-change.same {
  color: #6b7280;
}

.file-info-actions {
  display: flex;
  gap: 8px;
}

.btn-restore {
  padding: 6px 12px;
  font-size: 12px;
}

.stats-grid {
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.stat-card {
  flex: 1;
  padding: 6px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.stat-card.add {
  border-left: 3px solid #10b981;
}

.stat-card.del {
  border-left: 3px solid #ef4444;
}

.stat-card.same {
  border-left: 3px solid #6b7280;
}

.stat-num {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.stat-card.add .stat-num {
  color: #10b981;
}

.stat-card.del .stat-num {
  color: #ef4444;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.legend {
  display: flex;
  gap: 12px;
  padding: 6px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.dot.add {
  background: #d1fae5;
  border: 1px solid #10b981;
}

.dot.del {
  background: #fee2e2;
  border: 1px solid #ef4444;
}

.dot.same {
  background: white;
  border: 1px solid #d1d5db;
}

.diff-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.split-diff-view {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.code-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.code-panel:last-child {
  border-right: none;
}

.code-head {
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.code-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.code-head-left strong {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.code-head-left span {
  font-size: 12px;
  color: #6b7280;
}

.code-body {
  flex: 1;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.code-body.only-changes .code-line.unchanged {
  display: none;
}

.code-line {
  display: flex;
  padding: 0 16px;
  transition: background 0.15s;
}

.code-line:hover {
  background: #f8fafc;
}

.code-line.focused {
  background: #fef3c7;
}

.code-line .line-no {
  width: 40px;
  text-align: right;
  padding-right: 16px;
  color: #9ca3af;
  user-select: none;
  flex-shrink: 0;
}

.code-line .line-text {
  flex: 1;
  white-space: pre;
  overflow-x: auto;
  color: #374151;
}

.code-line.add {
  background: #ecfdf5;
}

.code-line.add .line-text {
  color: #065f46;
}

.code-line.delete {
  background: #fef2f2;
}

.code-line.delete .line-text {
  color: #991b1b;
}

.binary-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.binary-icon {
  width: 64px;
  height: 64px;
  background: #f3f4f6;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.binary-icon svg {
  width: 32px;
  height: 32px;
  color: #6b7280;
}

.binary-state p {
  margin: 0;
  color: #374151;
  font-size: 14px;
}

.binary-state .hint {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}

.result-empty {
  flex: 1;
}
</style>
