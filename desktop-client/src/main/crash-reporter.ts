import { crashReporter, app } from 'electron';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CrashReport {
  id: string;
  timestamp: string;
  version: string;
  platform: string;
  arch: string;
  error: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export class CrashReporterService {
  private crashReportsDir: string;
  private maxReports = 10;

  constructor() {
    this.crashReportsDir = path.join(app.getPath('userData'), 'crash-reports');
    this.ensureCrashReportsDir();
    this.setupCrashReporter();
    this.setupErrorHandlers();
  }

  private ensureCrashReportsDir(): void {
    if (!fs.existsSync(this.crashReportsDir)) {
      fs.mkdirSync(this.crashReportsDir, { recursive: true });
    }
  }

  private setupCrashReporter(): void {
    // Configure Electron's built-in crash reporter
    crashReporter.start({
      productName: 'NoteSage',
      companyName: 'NoteSage Team',
      submitURL: process.env.CRASH_REPORT_URL || '', // Set this to your crash reporting service
      uploadToServer: !!process.env.CRASH_REPORT_URL,
      ignoreSystemCrashHandler: false,
      rateLimit: true,
      compress: true,
      extra: {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node
      }
    });

    log.info('Crash reporter initialized');
  }

  private setupErrorHandlers(): void {
    // Handle uncaught exceptions in main process
    process.on('uncaughtException', (error) => {
      log.error('Uncaught Exception:', error);
      this.saveCrashReport(error, 'uncaughtException');
      
      // Don't exit immediately, give time to save the report
      setTimeout(() => {
        app.exit(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      log.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.saveCrashReport(error, 'unhandledRejection');
    });

    // Handle renderer process crashes
    app.on('render-process-gone', (event, webContents, details) => {
      log.error('Renderer process gone:', details);
      const error = new Error(`Renderer process crashed: ${details.reason}`);
      this.saveCrashReport(error, 'rendererCrash', {
        reason: details.reason,
        exitCode: details.exitCode
      });
    });

    // Handle child process crashes
    app.on('child-process-gone', (event, details) => {
      log.error('Child process gone:', details);
      const error = new Error(`Child process crashed: ${details.reason}`);
      this.saveCrashReport(error, 'childProcessCrash', {
        type: details.type,
        reason: details.reason,
        exitCode: details.exitCode,
        serviceName: details.serviceName,
        name: details.name
      });
    });
  }

  private saveCrashReport(error: Error, type: string, metadata?: Record<string, any>): void {
    try {
      const report: CrashReport = {
        id: this.generateReportId(),
        timestamp: new Date().toISOString(),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        error: error.message,
        stack: error.stack,
        metadata: {
          type,
          electronVersion: process.versions.electron,
          nodeVersion: process.versions.node,
          osVersion: os.release(),
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          uptime: process.uptime(),
          ...metadata
        }
      };

      const reportPath = path.join(this.crashReportsDir, `crash-${report.id}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      log.info(`Crash report saved: ${reportPath}`);
      
      // Clean up old reports
      this.cleanupOldReports();
      
    } catch (saveError) {
      log.error('Failed to save crash report:', saveError);
    }
  }

  private generateReportId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupOldReports(): void {
    try {
      const files = fs.readdirSync(this.crashReportsDir)
        .filter(file => file.startsWith('crash-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.crashReportsDir, file),
          mtime: fs.statSync(path.join(this.crashReportsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent reports
      if (files.length > this.maxReports) {
        const filesToDelete = files.slice(this.maxReports);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
            log.info(`Deleted old crash report: ${file.name}`);
          } catch (deleteError) {
            log.error(`Failed to delete crash report ${file.name}:`, deleteError);
          }
        });
      }
    } catch (cleanupError) {
      log.error('Failed to cleanup old crash reports:', cleanupError);
    }
  }

  public getCrashReports(): CrashReport[] {
    try {
      const files = fs.readdirSync(this.crashReportsDir)
        .filter(file => file.startsWith('crash-') && file.endsWith('.json'))
        .sort()
        .reverse();

      return files.map(file => {
        try {
          const content = fs.readFileSync(path.join(this.crashReportsDir, file), 'utf8');
          return JSON.parse(content) as CrashReport;
        } catch (parseError) {
          log.error(`Failed to parse crash report ${file}:`, parseError);
          return null;
        }
      }).filter(report => report !== null) as CrashReport[];
    } catch (error) {
      log.error('Failed to get crash reports:', error);
      return [];
    }
  }

  public deleteCrashReport(reportId: string): boolean {
    try {
      const reportPath = path.join(this.crashReportsDir, `crash-${reportId}.json`);
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
        log.info(`Deleted crash report: ${reportId}`);
        return true;
      }
      return false;
    } catch (error) {
      log.error(`Failed to delete crash report ${reportId}:`, error);
      return false;
    }
  }

  public clearAllCrashReports(): void {
    try {
      const files = fs.readdirSync(this.crashReportsDir)
        .filter(file => file.startsWith('crash-') && file.endsWith('.json'));

      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(this.crashReportsDir, file));
        } catch (deleteError) {
          log.error(`Failed to delete crash report ${file}:`, deleteError);
        }
      });

      log.info('Cleared all crash reports');
    } catch (error) {
      log.error('Failed to clear crash reports:', error);
    }
  }
}

// Export singleton instance
export const crashReporterService = new CrashReporterService();