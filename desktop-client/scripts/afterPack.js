const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;
  
  console.log(`Running afterPack for ${electronPlatformName}...`);
  
  // Create version info file
  const packageJson = require('../package.json');
  const versionInfo = {
    version: packageJson.version,
    buildDate: new Date().toISOString(),
    platform: electronPlatformName,
    arch: context.arch
  };
  
  const versionPath = path.join(appOutDir, 'version.json');
  fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
  
  console.log(`Created version info at ${versionPath}`);
  
  // Platform-specific post-processing
  if (electronPlatformName === 'linux') {
    await processLinuxBuild(context);
  } else if (electronPlatformName === 'darwin') {
    await processMacBuild(context);
  }
};

async function processLinuxBuild(context) {
  const { appOutDir } = context;
  console.log('Processing Linux build...');
  
  // Create desktop file with proper permissions
  const desktopFile = path.join(appOutDir, 'notesage.desktop');
  if (fs.existsSync(desktopFile)) {
    fs.chmodSync(desktopFile, 0o755);
    console.log('Set executable permissions on desktop file');
  }
  
  // Ensure binary has correct permissions
  const binaryPath = path.join(appOutDir, 'notesage-desktop');
  if (fs.existsSync(binaryPath)) {
    fs.chmodSync(binaryPath, 0o755);
    console.log('Set executable permissions on binary');
  }
}

async function processMacBuild(context) {
  const { appOutDir } = context;
  console.log('Processing macOS build...');
  
  // Additional macOS-specific processing can be added here
  // For example, setting extended attributes, creating additional symlinks, etc.
}