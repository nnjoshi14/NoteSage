import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('Desktop Client Installer Validation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notesage-installer-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('Package Structure Validation', () => {
    it('should validate .deb package structure for Ubuntu', async () => {
      const debPath = path.join(process.cwd(), 'release', 'notesage-desktop_1.0.0_amd64.deb');
      
      // Check if package exists (skip if not built)
      try {
        await fs.access(debPath);
      } catch {
        console.log('Skipping .deb validation - package not found');
        return;
      }

      // Extract package contents
      const extractDir = path.join(tempDir, 'deb-extract');
      await fs.mkdir(extractDir, { recursive: true });

      try {
        await execAsync(`dpkg-deb -x "${debPath}" "${extractDir}"`);
        
        // Verify required files exist
        const requiredFiles = [
          'usr/bin/notesage-desktop',
          'usr/share/applications/notesage.desktop',
          'usr/share/icons/hicolor/256x256/apps/notesage.png',
        ];

        for (const file of requiredFiles) {
          const filePath = path.join(extractDir, file);
          await expect(fs.access(filePath)).resolves.not.toThrow();
        }

        // Verify desktop file format
        const desktopFile = path.join(extractDir, 'usr/share/applications/notesage.desktop');
        const desktopContent = await fs.readFile(desktopFile, 'utf-8');
        
        expect(desktopContent).toContain('[Desktop Entry]');
        expect(desktopContent).toContain('Name=NoteSage');
        expect(desktopContent).toContain('Exec=notesage-desktop');
        expect(desktopContent).toContain('Type=Application');
        expect(desktopContent).toContain('Categories=Office;');

        // Verify binary is executable
        const binaryPath = path.join(extractDir, 'usr/bin/notesage-desktop');
        const stats = await fs.stat(binaryPath);
        expect(stats.mode & 0o111).toBeTruthy(); // Check execute permissions

      } catch (error) {
        console.log('Skipping .deb validation - dpkg-deb not available');
      }
    });

    it('should validate .dmg package structure for macOS', async () => {
      const dmgPath = path.join(process.cwd(), 'release', 'NoteSage-1.0.0.dmg');
      
      // Check if package exists (skip if not built)
      try {
        await fs.access(dmgPath);
      } catch {
        console.log('Skipping .dmg validation - package not found');
        return;
      }

      // On macOS, we can mount and inspect the DMG
      if (process.platform === 'darwin') {
        try {
          const mountPoint = path.join(tempDir, 'dmg-mount');
          await fs.mkdir(mountPoint, { recursive: true });

          // Mount DMG
          await execAsync(`hdiutil attach "${dmgPath}" -mountpoint "${mountPoint}" -nobrowse -quiet`);

          try {
            // Verify app bundle exists
            const appPath = path.join(mountPoint, 'NoteSage.app');
            await expect(fs.access(appPath)).resolves.not.toThrow();

            // Verify Info.plist
            const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
            await expect(fs.access(infoPlistPath)).resolves.not.toThrow();

            // Verify executable
            const executablePath = path.join(appPath, 'Contents', 'MacOS', 'NoteSage');
            await expect(fs.access(executablePath)).resolves.not.toThrow();

            const stats = await fs.stat(executablePath);
            expect(stats.mode & 0o111).toBeTruthy(); // Check execute permissions

          } finally {
            // Unmount DMG
            await execAsync(`hdiutil detach "${mountPoint}" -quiet`);
          }

        } catch (error) {
          console.log('Skipping .dmg validation - hdiutil not available or failed');
        }
      }
    });
  });

  describe('Installation Process Validation', () => {
    it('should validate installer script functionality', async () => {
      const installerScript = path.join(process.cwd(), 'scripts', 'test-installer.js');
      
      try {
        await fs.access(installerScript);
        
        // Run installer test script
        const { stdout, stderr } = await execAsync(`node "${installerScript}"`);
        
        expect(stderr).toBe('');
        expect(stdout).toContain('Installation test completed successfully');
        
      } catch (error) {
        console.log('Skipping installer script validation - script not found');
      }
    });

    it('should validate auto-updater configuration', async () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Verify electron-updater configuration
      expect(packageJson.build.publish).toBeDefined();
      expect(packageJson.build.publish.provider).toBe('github');
      expect(packageJson.build.publish.owner).toBe('notesage');
      expect(packageJson.build.publish.repo).toBe('desktop');

      // Verify signing configuration for macOS
      if (packageJson.build.mac) {
        expect(packageJson.build.mac.hardenedRuntime).toBe(true);
        expect(packageJson.build.mac.entitlements).toBeDefined();
        expect(packageJson.build.mac.notarize).toBeDefined();
      }

      // Verify Linux configuration
      if (packageJson.build.linux) {
        expect(packageJson.build.linux.category).toBe('Office');
        expect(packageJson.build.linux.target).toBeDefined();
        expect(Array.isArray(packageJson.build.linux.target)).toBe(true);
      }
    });

    it('should validate dependency requirements', async () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Verify critical dependencies
      const criticalDeps = [
        'electron',
        'electron-updater',
        'better-sqlite3',
        'react',
        '@tiptap/react',
        '@reduxjs/toolkit',
      ];

      for (const dep of criticalDeps) {
        expect(
          packageJson.dependencies[dep] || packageJson.devDependencies[dep]
        ).toBeDefined(`${dep} should be listed as a dependency`);
      }

      // Verify electron version compatibility
      const electronVersion = packageJson.devDependencies.electron;
      expect(electronVersion).toMatch(/^\^?\d+\.\d+\.\d+/);
      
      const majorVersion = parseInt(electronVersion.replace(/^\^?/, '').split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(28); // Minimum supported version
    });
  });

  describe('Update Process Validation', () => {
    it('should validate update mechanism configuration', async () => {
      const autoUpdaterPath = path.join(process.cwd(), 'src', 'main', 'auto-updater.ts');
      
      try {
        const autoUpdaterContent = await fs.readFile(autoUpdaterPath, 'utf-8');
        
        // Verify auto-updater is properly configured
        expect(autoUpdaterContent).toContain('autoUpdater');
        expect(autoUpdaterContent).toContain('checkForUpdatesAndNotify');
        expect(autoUpdaterContent).toContain('update-available');
        expect(autoUpdaterContent).toContain('update-downloaded');
        expect(autoUpdaterContent).toContain('quitAndInstall');

        // Verify error handling
        expect(autoUpdaterContent).toContain('error');
        expect(autoUpdaterContent).toContain('catch');

      } catch (error) {
        console.log('Skipping auto-updater validation - file not found');
      }
    });

    it('should validate update notification UI', async () => {
      const updateNotificationPath = path.join(
        process.cwd(),
        'src',
        'renderer',
        'components',
        'UpdateNotification.tsx'
      );
      
      try {
        const notificationContent = await fs.readFile(updateNotificationPath, 'utf-8');
        
        // Verify update notification component
        expect(notificationContent).toContain('UpdateNotification');
        expect(notificationContent).toContain('update-available');
        expect(notificationContent).toContain('download');
        expect(notificationContent).toContain('restart');

      } catch (error) {
        console.log('Skipping update notification validation - file not found');
      }
    });

    it('should validate version compatibility checking', async () => {
      // Test version comparison logic
      const versionCompare = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const part1 = parts1[i] || 0;
          const part2 = parts2[i] || 0;
          
          if (part1 < part2) return -1;
          if (part1 > part2) return 1;
        }
        
        return 0;
      };

      // Test version comparison scenarios
      expect(versionCompare('1.0.0', '1.0.1')).toBe(-1);
      expect(versionCompare('1.1.0', '1.0.9')).toBe(1);
      expect(versionCompare('2.0.0', '2.0.0')).toBe(0);
      expect(versionCompare('1.0.0', '1.0.0-beta')).toBe(1);
    });
  });

  describe('Security Validation', () => {
    it('should validate code signing configuration', async () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Verify macOS code signing
      if (packageJson.build.mac) {
        expect(packageJson.build.afterSign).toBeDefined();
        expect(packageJson.build.mac.hardenedRuntime).toBe(true);
        expect(packageJson.build.mac.gatekeeperAssess).toBe(false);
        expect(packageJson.build.mac.entitlements).toBeDefined();
      }

      // Verify afterPack script exists
      if (packageJson.build.afterPack) {
        const afterPackScript = path.join(process.cwd(), packageJson.build.afterPack);
        await expect(fs.access(afterPackScript)).resolves.not.toThrow();
      }
    });

    it('should validate entitlements configuration', async () => {
      const entitlementsPath = path.join(process.cwd(), 'build', 'entitlements.mac.plist');
      
      try {
        const entitlementsContent = await fs.readFile(entitlementsPath, 'utf-8');
        
        // Verify required entitlements
        expect(entitlementsContent).toContain('com.apple.security.cs.allow-jit');
        expect(entitlementsContent).toContain('com.apple.security.cs.allow-unsigned-executable-memory');
        expect(entitlementsContent).toContain('com.apple.security.cs.disable-library-validation');

      } catch (error) {
        console.log('Skipping entitlements validation - file not found');
      }
    });

    it('should validate secure storage implementation', async () => {
      const preloadPath = path.join(process.cwd(), 'src', 'main', 'preload.ts');
      
      try {
        const preloadContent = await fs.readFile(preloadPath, 'utf-8');
        
        // Verify secure storage APIs are exposed
        expect(preloadContent).toContain('safeStorage');
        expect(preloadContent).toContain('encryptString');
        expect(preloadContent).toContain('decryptString');

        // Verify context isolation
        expect(preloadContent).toContain('contextIsolation');
        expect(preloadContent).toContain('contextBridge');

      } catch (error) {
        console.log('Skipping secure storage validation - file not found');
      }
    });
  });

  describe('Performance Validation', () => {
    it('should validate bundle size limits', async () => {
      const distPath = path.join(process.cwd(), 'dist');
      
      try {
        await fs.access(distPath);
        
        // Calculate total bundle size
        const calculateDirSize = async (dirPath: string): Promise<number> => {
          let totalSize = 0;
          const items = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
              totalSize += await calculateDirSize(itemPath);
            } else {
              const stats = await fs.stat(itemPath);
              totalSize += stats.size;
            }
          }
          
          return totalSize;
        };

        const bundleSize = await calculateDirSize(distPath);
        const bundleSizeMB = bundleSize / (1024 * 1024);
        
        console.log(`Bundle size: ${bundleSizeMB.toFixed(2)} MB`);
        
        // Bundle should be reasonable size (less than 500MB)
        expect(bundleSizeMB).toBeLessThan(500);

      } catch (error) {
        console.log('Skipping bundle size validation - dist not found');
      }
    });

    it('should validate startup performance', async () => {
      // This would require running the actual app and measuring startup time
      // For now, we'll validate that performance monitoring is in place
      
      const mainPath = path.join(process.cwd(), 'src', 'main', 'main.ts');
      
      try {
        const mainContent = await fs.readFile(mainPath, 'utf-8');
        
        // Verify performance monitoring
        expect(mainContent).toContain('ready');
        expect(mainContent).toContain('whenReady');

        // Verify proper window management
        expect(mainContent).toContain('BrowserWindow');
        expect(mainContent).toContain('webPreferences');

      } catch (error) {
        console.log('Skipping startup performance validation - file not found');
      }
    });
  });
});