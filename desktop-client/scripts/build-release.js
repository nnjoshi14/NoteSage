#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class ReleaseBuilder {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.projectRoot = path.join(__dirname, '..');
    this.releaseDir = path.join(this.projectRoot, 'release');
    this.buildStartTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async checkPrerequisites() {
    this.log('Checking build prerequisites...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
    }
    this.log(`✅ Node.js version: ${nodeVersion}`);

    // Check if we're in the right directory
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found. Are you in the right directory?');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.name !== 'notesage-desktop') {
      throw new Error('This script must be run from the NoteSage desktop client directory');
    }
    this.log(`✅ Project: ${packageJson.name} v${packageJson.version}`);

    // Check for required dependencies
    const requiredDeps = ['electron', 'electron-builder'];
    for (const dep of requiredDeps) {
      if (!packageJson.devDependencies[dep]) {
        throw new Error(`Missing required dependency: ${dep}`);
      }
    }
    this.log('✅ Required dependencies found');

    // Platform-specific checks
    if (this.platform === 'darwin') {
      await this.checkMacOSPrerequisites();
    } else if (this.platform === 'linux') {
      await this.checkLinuxPrerequisites();
    }
  }

  async checkMacOSPrerequisites() {
    this.log('Checking macOS-specific prerequisites...');
    
    // Check for Xcode command line tools
    try {
      execSync('xcode-select -p', { stdio: 'ignore' });
      this.log('✅ Xcode command line tools installed');
    } catch (error) {
      this.log('⚠️  Xcode command line tools not found. Code signing may not work.', 'warning');
    }

    // Check for signing certificates (if environment variables are set)
    if (process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID) {
      this.log('✅ Apple signing credentials configured');
    } else {
      this.log('⚠️  Apple signing credentials not configured. App will not be notarized.', 'warning');
    }
  }

  async checkLinuxPrerequisites() {
    this.log('Checking Linux-specific prerequisites...');
    
    // Check for required system packages
    const requiredPackages = ['dpkg', 'fakeroot'];
    for (const pkg of requiredPackages) {
      try {
        execSync(`which ${pkg}`, { stdio: 'ignore' });
        this.log(`✅ ${pkg} found`);
      } catch (error) {
        throw new Error(`Required package not found: ${pkg}. Install with: sudo apt install ${pkg}`);
      }
    }
  }

  async cleanBuildDirectory() {
    this.log('Cleaning build directory...');
    
    const dirsToClean = ['dist', 'release'];
    for (const dir of dirsToClean) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        this.log(`Cleaned: ${dir}`);
      }
    }
  }

  async installDependencies() {
    this.log('Installing dependencies...');
    
    try {
      execSync('npm ci', { 
        cwd: this.projectRoot, 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
      this.log('✅ Dependencies installed');
    } catch (error) {
      throw new Error('Failed to install dependencies');
    }
  }

  async runTests() {
    this.log('Running tests...');
    
    try {
      execSync('npm test -- --run', { 
        cwd: this.projectRoot, 
        stdio: 'inherit' 
      });
      this.log('✅ Tests passed');
    } catch (error) {
      throw new Error('Tests failed. Fix issues before building release.');
    }
  }

  async buildApplication() {
    this.log('Building application...');
    
    try {
      execSync('npm run build', { 
        cwd: this.projectRoot, 
        stdio: 'inherit' 
      });
      this.log('✅ Application built');
    } catch (error) {
      throw new Error('Application build failed');
    }
  }

  async createInstallers() {
    this.log('Creating installers...');
    
    const buildCommand = this.platform === 'darwin' ? 'npm run dist:mac' : 'npm run dist:linux';
    
    try {
      execSync(buildCommand, { 
        cwd: this.projectRoot, 
        stdio: 'inherit',
        env: {
          ...process.env,
          // Ensure proper environment for signing
          CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY || 'false'
        }
      });
      this.log('✅ Installers created');
    } catch (error) {
      throw new Error('Installer creation failed');
    }
  }

  async generateChecksums() {
    this.log('Generating checksums...');
    
    if (!fs.existsSync(this.releaseDir)) {
      throw new Error('Release directory not found');
    }

    const files = fs.readdirSync(this.releaseDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.dmg', '.zip', '.deb', '.appimage', '.tar.gz'].includes(ext);
    });

    const checksums = {};
    
    for (const file of files) {
      const filePath = path.join(this.releaseDir, file);
      const fileBuffer = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      checksums[file] = {
        sha256: hash,
        size: fileBuffer.length
      };
      this.log(`Checksum for ${file}: ${hash}`);
    }

    const checksumFile = path.join(this.releaseDir, 'checksums.json');
    fs.writeFileSync(checksumFile, JSON.stringify(checksums, null, 2));
    this.log(`✅ Checksums saved to ${checksumFile}`);
  }

  async createReleaseNotes() {
    this.log('Creating release notes...');
    
    const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    const version = packageJson.version;
    const buildDate = new Date().toISOString().split('T')[0];
    
    const releaseNotes = `# NoteSage Desktop v${version}

Released: ${buildDate}

## Installation

### macOS
- Download \`NoteSage-${version}.dmg\`
- Open the DMG file and drag NoteSage to Applications
- Launch NoteSage from Applications folder

### Ubuntu Linux
- Download \`notesage-desktop_${version}_amd64.deb\`
- Install with: \`sudo dpkg -i notesage-desktop_${version}_amd64.deb\`
- Or use the AppImage: \`chmod +x NoteSage-${version}.AppImage && ./NoteSage-${version}.AppImage\`

## Features
- Rich text note editing with markdown support
- People and contact management
- Todo tracking and calendar integration
- Knowledge graph visualization
- AI-powered insights and todo extraction
- Offline-first with cloud synchronization
- Auto-updates and crash reporting

## System Requirements
- macOS 10.15+ or Ubuntu 18.04+
- 4GB RAM minimum, 8GB recommended
- 500MB disk space

## Verification
All release files include SHA256 checksums in \`checksums.json\`.

## Support
- Documentation: https://notesage.com/docs
- Issues: https://github.com/notesage/desktop/issues
- Community: https://github.com/notesage/desktop/discussions
`;

    const releaseNotesPath = path.join(this.releaseDir, 'RELEASE_NOTES.md');
    fs.writeFileSync(releaseNotesPath, releaseNotes);
    this.log(`✅ Release notes created: ${releaseNotesPath}`);
  }

  async validateRelease() {
    this.log('Validating release...');
    
    // Import and run the installer tester
    const InstallerTester = require('./test-installer.js');
    const tester = new InstallerTester();
    
    try {
      await tester.runAllTests();
      this.log('✅ Release validation passed');
    } catch (error) {
      throw new Error(`Release validation failed: ${error.message}`);
    }
  }

  async generateBuildReport() {
    const buildTime = Date.now() - this.buildStartTime;
    const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    
    const report = {
      version: packageJson.version,
      buildDate: new Date().toISOString(),
      buildTime: `${Math.round(buildTime / 1000)}s`,
      platform: this.platform,
      arch: this.arch,
      nodeVersion: process.version,
      electronVersion: packageJson.devDependencies.electron,
      files: []
    };

    if (fs.existsSync(this.releaseDir)) {
      const files = fs.readdirSync(this.releaseDir);
      for (const file of files) {
        const filePath = path.join(this.releaseDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          report.files.push({
            name: file,
            size: stats.size,
            sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
          });
        }
      }
    }

    const reportPath = path.join(this.releaseDir, 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`✅ Build report generated: ${reportPath}`);
    
    return report;
  }

  async build() {
    try {
      this.log('🚀 Starting NoteSage desktop release build...');
      
      await this.checkPrerequisites();
      await this.cleanBuildDirectory();
      await this.installDependencies();
      await this.runTests();
      await this.buildApplication();
      await this.createInstallers();
      await this.generateChecksums();
      await this.createReleaseNotes();
      await this.validateRelease();
      
      const report = await this.generateBuildReport();
      
      this.log('\n🎉 Release build completed successfully!');
      this.log(`Version: ${report.version}`);
      this.log(`Build time: ${report.buildTime}`);
      this.log(`Platform: ${report.platform} (${report.arch})`);
      this.log('\nGenerated files:');
      for (const file of report.files) {
        this.log(`  - ${file.name} (${file.sizeFormatted})`);
      }
      this.log(`\nRelease files are in: ${this.releaseDir}`);
      
    } catch (error) {
      this.log(`❌ Build failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run build if this script is executed directly
if (require.main === module) {
  const builder = new ReleaseBuilder();
  builder.build();
}

module.exports = ReleaseBuilder;