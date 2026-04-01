import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import * as path from 'path';
import { IpcHandler } from './ipc-handlers';
import { IPC_CHANNELS } from './types';

class MainProcess {
  private mainWindow: BrowserWindow | null = null;
  private ipcHandler: IpcHandler;

  constructor() {
    this.ipcHandler = new IpcHandler();
  }

  async createWindow(): Promise<void> {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: 'FileGuardian',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        session: session.fromPartition('nopersist')
      },
      icon: path.join(__dirname, '../../build/icon.png')
    });

    // 设置 IPC 主窗口引用
    this.ipcHandler.setMainWindow(this.mainWindow);

    // 注册对话框处理 - 必须在窗口创建后立即注册
    this.registerDialogHandlers();

    // 注册 IPC 处理器
    this.ipcHandler.registerHandlers();
    
    // 初始化（恢复之前的监听状态）
    await this.ipcHandler.initialize();

    // 开发模式加载开发服务器，生产模式加载打包文件
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
      // 开发模式
      await this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      // 生产模式
      await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // 窗口准备好后显示
    this.mainWindow.show();


    // 处理窗口关闭
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // 处理所有窗口关闭
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // macOS 激活应用
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      }
    });

    // 应用退出前清理
    app.on('before-quit', () => {
      // 清理工作
    });
  }

  /**
   * 注册对话框相关处理
   */
  private registerDialogHandlers(): void {
    // 打开目录选择对话框
    ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async () => {
      try {
        // 获取当前焦点窗口，如果没有则使用存储的主窗口
        const focusedWindow = BrowserWindow.getFocusedWindow() || this.mainWindow;
        
        if (!focusedWindow || focusedWindow.isDestroyed()) {
          console.warn('[Dialog] No valid window available for directory dialog');
          return { success: false, error: '窗口未初始化' };
        }

        console.log('[Dialog] Opening directory selection dialog...');
        
        const result = await dialog.showOpenDialog(focusedWindow, {
          properties: ['openDirectory', 'createDirectory'],
          title: '选择要监听的目录',
        });

        console.log('[Dialog] Directory dialog result:', result);

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        return { success: true, path: result.filePaths[0] };
      } catch (error) {
        console.error('[Dialog] Error opening directory dialog:', error);
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });

    // 打开文件选择对话框
    ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async (_, options?: {
      multiple?: boolean;
      filters?: { name: string; extensions: string[] }[];
    }) => {
      try {
        // 获取当前焦点窗口，如果没有则使用存储的主窗口
        const focusedWindow = BrowserWindow.getFocusedWindow() || this.mainWindow;
        
        if (!focusedWindow || focusedWindow.isDestroyed()) {
          console.warn('[Dialog] No valid window available for file dialog');
          return { success: false, error: '窗口未初始化' };
        }

        const properties: ('openFile' | 'multiSelections')[] = ['openFile'];
        if (options?.multiple) {
          properties.push('multiSelections');
        }

        console.log('[Dialog] Opening file selection dialog...');

        const result = await dialog.showOpenDialog(focusedWindow, {
          properties,
          filters: options?.filters || [{ name: '所有文件', extensions: ['*'] }],
          title: '选择文件',
        });

        console.log('[Dialog] File dialog result:', result);

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        return { success: true, paths: result.filePaths };
      } catch (error) {
        console.error('[Dialog] Error opening file dialog:', error);
        return { success: false, error: error instanceof Error ? error.message : '未知错误' };
      }
    });
  }
}

// 启动应用
const mainProcess = new MainProcess();

app.whenReady().then(async () => {
  await mainProcess.createWindow();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
