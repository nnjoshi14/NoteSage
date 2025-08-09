import { autoUpdater, AppUpdater } from 'electron-updater';
import { BrowserWindow, dialog, shell } from 'electron';
import log from 'electron-log';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  releaseName?: string;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export class AutoUpdaterService {
  private updater: AppUpdater;
  private mainWindow: BrowserWindow | null = null;
  private updateCheckInProgress = false;
  private updateDownloadInProgress = false;

  constructor() {
    this.updater = autoUpdater;
    this.setupUpdater();
    this.setupEventHandlers();
  }

  private setupUpdater(): void {
    // Configure updater
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    
    // Set update server (GitHub releases by default)
    if (process.env.NODE_ENV === 'development') {
      // In development, you might want to use a different update server
      // this.updater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');
    }

    // Configure logging
    this.updater.logger = log;
    log.transports.file.level = 'info';
  }

  private setupEventHandlers(): void {
    this.updater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.updateCheckInProgress = true;
      this.sendToRenderer('update-checking');
    });

    this.updater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateCheckInProgress = false;
      this.sendToRenderer('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        releaseName: info.releaseName
      });
      this.showUpdateAvailableDialog(info);
    });

    this.updater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.updateCheckInProgress = false;
      this.sendToRenderer('update-not-available');
    });

    this.updater.on('error', (error) => {
      log.error('Update error:', error);
      this.updateCheckInProgress = false;
      this.updateDownloadInProgress = false;
      this.sendToRenderer('update-error', error.message);
      this.showUpdateErrorDialog(error);
    });

    this.updater.on('download-progress', (progress) => {
      log.info('Download progress:', progress);
      this.sendToRenderer('update-download-progress', {
        bytesPerSecond: progress.bytesPerSecond,
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total
      });
    });

    this.updater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.updateDownloadInProgress = false;
      this.sendToRenderer('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        releaseName: info.releaseName
      });
      this.showUpdateDownloadedDialog(info);
    });
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public async checkForUpdates(): Promise<void> {
    if (this.updateCheckInProgress) {
      log.info('Update check already in progress');
      return;
    }

    try {
      log.info('Manually checking for updates');
      await this.updater.checkForUpdates();
    } catch (error) {
      log.error('Failed to check for updates:', error);
      throw error;
    }
  }

  public async downloadUpdate(): Promise<void> {
    if (this.updateDownloadInProgress) {
      log.info('Update download already in progress');
      return;
    }

    try {
      log.info('Starting update download');
      this.updateDownloadInProgress = true;
      this.sendToRenderer('update-download-started');
      await this.updater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      this.updateDownloadInProgress = false;
      throw error;
    }
  }

  public quitAndInstall(): void {
    log.info('Quitting and installing update');
    this.updater.quitAndInstall();
  }

  public async checkForUpdatesAndNotify(): Promise<void> {
    try {
      await this.updater.checkForUpdatesAndNotify();
    } catch (error) {
      log.error('Failed to check for updates and notify:', error);
    }
  }

  private sendToRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`auto-updater-${channel}`, data);
    }
  }

  private async showUpdateAvailableDialog(info: any): Promise<void> {
    if (!this.mainWindow) return;

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `NoteSage ${info.version} is available`,
      detail: `You are currently running version ${process.env.npm_package_version}. Would you like to download the update now?`,
      buttons: ['Download Now', 'View Release Notes', 'Later'],
      defaultId: 0,
      cancelId: 2
    });

    switch (result.response) {
      case 0: // Download Now
        await this.downloadUpdate();
        break;
      case 1: // View Release Notes
        if (info.releaseNotes) {
          // Open release notes in external browser
          await shell.openExternal(`https://github.com/notesage/desktop/releases/tag/v${info.version}`);
        }
        break;
      case 2: // Later
        // Do nothing
        break;
    }
  }

  private async showUpdateDownloadedDialog(info: any): Promise<void> {
    if (!this.mainWindow) return;

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `NoteSage ${info.version} has been downloaded`,
      detail: 'The update will be installed when you restart the application. Would you like to restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      this.quitAndInstall();
    }
  }

  private async showUpdateErrorDialog(error: Error): Promise<void> {
    if (!this.mainWindow) return;

    await dialog.showMessageBox(this.mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: `An error occurred while checking for updates: ${error.message}`,
      buttons: ['OK']
    });
  }
}

// Export singleton instance
export const autoUpdaterService = new AutoUpdaterService();