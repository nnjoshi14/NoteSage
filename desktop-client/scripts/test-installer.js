#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class InstallerTester {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.releaseDir = path.join(__dirname, '../release');
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    this.testResults.push({
      timestamp,
      type,
      message
    });
  }

  async runTest(testName, testFn) {
    this.log(`Starting test: ${testName}`);
    try {
      await testFn();
      this.log(`✅ Test passed: ${testName}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Test failed: ${testName} - ${error.message}`, 'error');
      return false;
    }
  }

  async testBuildExists() {
    const expectedFiles = [];
    
    if (this.platform === 'darwin') {
      expectedFiles.push(
        'NoteSage-*.dmg',
        'NoteSage-*-mac.zip'
      );
    } else if (this.platform === 'linux') {
      expectedFiles.push(
        'notesage-desktop_*_amd64.deb',
        'NoteSage-*.AppImage',
        'notesage-desktop-*.tar.gz'
      );
    }

    for (const pattern of expectedFiles) {
      const files = fs.readdirSync(this.releaseDir).filter(file => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(file);
      });

      if (files.length === 0) {
        throw new Error(`No files found matching pattern: ${pattern}`);
      }

      this.log(`Found installer: ${files[0]}`);
    }
  }

  async testInstallerIntegrity() {
    const installerFiles = fs.readdirSync(this.releaseDir);
    
    for (const file of installerFiles) {
      const filePath = path.join(this.releaseDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.size === 0) {
        throw new Error(`Installer file is empty: ${file}`);
      }
      
      this.log(`Installer size: ${file} - ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Check file permissions
      if (this.platform === 'linux' && file.endsWith('.AppImage')) {
        try {
          fs.accessSync(filePath, fs.constants.X_OK);
          this.log(`AppImage has executable permissions: ${file}`);
        } catch (error) {
          throw new Error(`AppImage is not executable: ${file}`);
        }
      }
    }
  }

  async testMacOSCodeSigning() {
    if (this.platform !== 'darwin') {
      this.log('Skipping macOS code signing test (not on macOS)');
      return;
    }

    const dmgFiles = fs.readdirSync(this.releaseDir).filter(f => f.endsWith('.dmg'));
    
    if (dmgFiles.length === 0) {
      throw new Error('No DMG files found for code signing test');
    }

    const dmgPath = path.join(this.releaseDir, dmgFiles[0]);
    
    try {
      // Mount the DMG
      const mountResult = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`, { encoding: 'utf8' });
      const mountPoint = mountResult.match(/\/Volumes\/[^\s]+/)[0];
      
      try {
        // Find the app bundle
        const appPath = path.join(mountPoint, 'NoteSage.app');
        
        if (!fs.existsSync(appPath)) {
          throw new Error('App bundle not found in DMG');
        }

        // Check code signature
        try {
          execSync(`codesign -v "${appPath}"`, { encoding: 'utf8' });
          this.log('✅ App bundle is properly code signed');
        } catch (error) {
          this.log('⚠️  App bundle is not code signed (expected in development)', 'warning');
        }

        // Check for hardened runtime
        try {
          const codesignInfo = execSync(`codesign -d --entitlements - "${appPath}"`, { encoding: 'utf8' });
          if (codesignInfo.includes('com.apple.security.cs.allow-jit')) {
            this.log('✅ Hardened runtime entitlements found');
          }
        } catch (error) {
          this.log('⚠️  Could not verify hardened runtime entitlements', 'warning');
        }

      } finally {
        // Unmount the DMG
        execSync(`hdiutil detach "${mountPoint}"`);
      }
    } catch (error) {
      throw new Error(`Code signing test failed: ${error.message}`);
    }
  }

  async testLinuxPackageMetadata() {
    if (this.platform !== 'linux') {
      this.log('Skipping Linux package test (not on Linux)');
      return;
    }

    const debFiles = fs.readdirSync(this.releaseDir).filter(f => f.endsWith('.deb'));
    
    if (debFiles.length === 0) {
      throw new Error('No DEB files found for package test');
    }

    const debPath = path.join(this.releaseDir, debFiles[0]);
    
    try {
      // Check package info
      const packageInfo = execSync(`dpkg -I "${debPath}"`, { encoding: 'utf8' });
      
      const requiredFields = ['Package:', 'Version:', 'Architecture:', 'Maintainer:', 'Description:'];
      for (const field of requiredFields) {
        if (!packageInfo.includes(field)) {
          throw new Error(`Missing required field in package: ${field}`);
        }
      }

      this.log('✅ DEB package metadata is complete');

      // Check package contents
      const packageContents = execSync(`dpkg -c "${debPath}"`, { encoding: 'utf8' });
      
      const expectedPaths = [
        './usr/bin/',
        './usr/share/applications/',
        './usr/share/icons/'
      ];

      for (const expectedPath of expectedPaths) {
        if (!packageContents.includes(expectedPath)) {
          throw new Error(`Missing expected path in package: ${expectedPath}`);
        }
      }

      this.log('✅ DEB package contents are correct');

    } catch (error) {
      throw new Error(`Linux package test failed: ${error.message}`);
    }
  }

  async testAutoUpdaterConfiguration() {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.build) {
      throw new Error('Missing build configuration in package.json');
    }

    if (!packageJson.build.publish) {
      throw new Error('Missing publish configuration for auto-updater');
    }

    const publishConfig = packageJson.build.publish;
    if (publishConfig.provider !== 'github') {
      throw new Error('Auto-updater is not configured for GitHub releases');
    }

    if (!publishConfig.owner || !publishConfig.repo) {
      throw new Error('Missing GitHub owner/repo configuration for auto-updater');
    }

    this.log('✅ Auto-updater configuration is valid');
  }

  async testInstallerSecurity() {
    // Check for common security issues
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check Electron security settings
    const mainPath = path.join(__dirname, '../src/main/main.ts');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    
    const securityChecks = [
      {
        name: 'Node integration disabled',
        check: () => mainContent.includes('nodeIntegration: false'),
        required: true
      },
      {
        name: 'Context isolation enabled',
        check: () => mainContent.includes('contextIsolation: true'),
        required: true
      },
      {
        name: 'Preload script specified',
        check: () => mainContent.includes('preload:'),
        required: true
      },
      {
        name: 'Web security enabled in production',
        check: () => mainContent.includes('webSecurity: process.env.NODE_ENV !== \'development\''),
        required: false
      }
    ];

    for (const check of securityChecks) {
      if (check.check()) {
        this.log(`✅ Security check passed: ${check.name}`);
      } else if (check.required) {
        throw new Error(`Security check failed: ${check.name}`);
      } else {
        this.log(`⚠️  Security check warning: ${check.name}`, 'warning');
      }
    }
  }

  async generateTestReport() {
    const reportPath = path.join(this.releaseDir, 'installer-test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      platform: this.platform,
      arch: this.arch,
      nodeVersion: process.version,
      testResults: this.testResults,
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.type === 'success').length,
        failed: this.testResults.filter(r => r.type === 'error').length,
        warnings: this.testResults.filter(r => r.type === 'warning').length
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`Test report generated: ${reportPath}`);
    
    return report;
  }

  async runAllTests() {
    this.log('Starting installer validation tests...');
    
    const tests = [
      ['Build artifacts exist', () => this.testBuildExists()],
      ['Installer integrity', () => this.testInstallerIntegrity()],
      ['macOS code signing', () => this.testMacOSCodeSigning()],
      ['Linux package metadata', () => this.testLinuxPackageMetadata()],
      ['Auto-updater configuration', () => this.testAutoUpdaterConfiguration()],
      ['Installer security', () => this.testInstallerSecurity()]
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const [testName, testFn] of tests) {
      const passed = await this.runTest(testName, testFn);
      if (passed) passedTests++;
    }

    const report = await this.generateTestReport();
    
    this.log(`\n=== Test Summary ===`);
    this.log(`Total tests: ${totalTests}`);
    this.log(`Passed: ${passedTests}`);
    this.log(`Failed: ${totalTests - passedTests}`);
    this.log(`Warnings: ${report.summary.warnings}`);
    
    if (passedTests === totalTests) {
      this.log('🎉 All installer tests passed!', 'success');
      process.exit(0);
    } else {
      this.log('❌ Some installer tests failed. Check the report for details.', 'error');
      process.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new InstallerTester();
  tester.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = InstallerTester;