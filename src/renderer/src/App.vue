<template>
  <div class="app-container">
    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 全局头部栏 -->
      <div class="global-header">
        <div class="header-content">
          <h1 class="app-title">FileBackupGuardian</h1>
          <button class="btn-icon settings-btn" @click="showSettings = true" title="设置">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="content-wrapper">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- 设置窗口 -->
    <SettingsModal :show="showSettings" @close="showSettings = false" />

    <!-- 全局通知 -->
    <div class="notification-container">
      <TransitionGroup name="notification">
        <div 
          v-for="notification in notifications" 
          :key="notification.id"
          class="notification"
          :class="notification.type"
        >
          <div class="notification-icon">
            <svg v-if="notification.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <svg v-else-if="notification.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <svg v-else-if="notification.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </div>
          <span class="notification-message">{{ notification.message }}</span>
          <button class="notification-close" @click="removeNotification(notification.id)">X</button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from './stores/app';
import SettingsModal from './components/SettingsModal.vue';

const store = useAppStore();
const showSettings = ref(false);
const notifications = computed(() => store.notifications);

function removeNotification(id: string) {
  store.removeNotification(id);
}

const isElectron = typeof window !== 'undefined' && window.electronAPI;

onMounted(async () => {
  if (isElectron) {
    await store.init();
  }
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-secondary);
}

/* 主内容区 */
.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* 全局头部栏 */
.global-header {
  background: white;
  border-bottom: 1px solid var(--border-light);
  padding: 16px 24px;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.settings-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: var(--text-secondary);
}

.settings-btn:hover {
  background: var(--primary-500);
  color: white;
  transform: rotate(45deg);
}

.settings-btn svg {
  width: 20px;
  height: 20px;
}

.content-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.content-wrapper > div {
  max-width: 1200px;
  margin: 0 auto;
}

/* 通知容器 */
.notification-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 1000;
  max-width: 400px;
}

.notification {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  min-width: 280px;
  border-left: 4px solid;
}

.notification.info {
  border-left-color: var(--info-500);
}

.notification.success {
  border-left-color: var(--success-500);
}

.notification.warning {
  border-left-color: var(--warning-500);
}

.notification.error {
  border-left-color: var(--danger-500);
}

.notification-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.notification.info .notification-icon {
  color: var(--info-500);
}

.notification.success .notification-icon {
  color: var(--success-500);
}

.notification.warning .notification-icon {
  color: var(--warning-500);
}

.notification.error .notification-icon {
  color: var(--danger-500);
}

.notification-icon svg {
  width: 100%;
  height: 100%;
}

.notification-message {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.5;
}

.notification-close {
  border: none;
  background: none;
  font-size: 18px;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.notification-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-base) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.notification-enter-active,
.notification-leave-active {
  transition: all var(--transition-slow) ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* 响应式 */
@media (max-width: 768px) {
  .notification-container {
    left: var(--space-4);
    right: var(--space-4);
  }

  .notification {
    min-width: auto;
  }
}
</style>
