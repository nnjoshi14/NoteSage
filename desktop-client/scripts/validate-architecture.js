#!/usr/bin/env node

/**
 * Architecture Validation Script
 * Validates that the Electron application architecture is properly set up
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    log(`✓ ${description}`, 'green');
  } else {
    log(`✗ ${description} (missing: ${filePath})`, 'red');
  }
  
  return exists;
}

function checkDirectoryExists(dirPath, description) {
  const fullPath = path.join(PROJECT_ROOT, dirPath);
  const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  
  if (exists) {
    log(`✓ ${description}`, 'green');
  } else {
    log(`✗ ${description} (missing: ${dirPath})`, 'red');
  }
  
  return exists;
}

function checkPackageJsonDependencies() {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    log('✗ package.json not found', 'red');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredDependencies = [
    '@reduxjs/toolkit',
    'react',
    'react-dom',
    'react-redux',
    'react-router-dom',
    'axios',
    'better-sqlite3',
  ];
  
  const requiredDevDependencies = [
    'electron',
    'electron-builder',
    'typescript',
    'webpack',
    'webpack-cli',
    'webpack-dev-server',
    'ts-loader',
    'html-webpack-plugin',
    'concurrently',
    'cross-env',
  ];
  
  let allDepsPresent = true;
  
  log('\nChecking dependencies:', 'blue');
  requiredDependencies.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      log(`  ✓ ${dep}`, 'green');
    } else {
      log(`  ✗ ${dep} (missing from dependencies)`, 'red');
      allDepsPresent = false;
    }
  });
  
  log('\nChecking dev dependencies:', 'blue');
  requiredDevDependencies.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      log(`  ✓ ${dep}`, 'green');
    } else {
      log(`  ✗ ${dep} (missing from devDependencies)`, 'red');
      allDepsPresent = false;
    }
  });
  
  return allDepsPresent;
}

function checkScripts() {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredScripts = [
    'build',
    'build:main',
    'build:renderer',
    'dev',
    'dev:main',
    'dev:renderer',
    'start',
    'start:dev',
    'test',
    'lint',
    'format',
    'clean',
    'dist',
  ];
  
  let allScriptsPresent = true;
  
  log('\nChecking npm scripts:', 'blue');
  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      log(`  ✓ ${script}`, 'green');
    } else {
      log(`  ✗ ${script} (missing from scripts)`, 'red');
      allScriptsPresent = false;
    }
  });
  
  return allScriptsPresent;
}

function checkTypeScriptConfiguration() {
  const mainTsConfig = path.join(PROJECT_ROOT, 'tsconfig.main.json');
  const rendererTsConfig = path.join(PROJECT_ROOT, 'tsconfig.json');
  
  let configValid = true;
  
  if (fs.existsSync(mainTsConfig)) {
    try {
      const config = JSON.parse(fs.readFileSync(mainTsConfig, 'utf8'));
      if (config.compilerOptions && config.compilerOptions.module === 'CommonJS') {
        log('✓ Main process TypeScript configuration', 'green');
      } else {
        log('✗ Main process TypeScript configuration (invalid module setting)', 'red');
        configValid = false;
      }
    } catch (error) {
      log('✗ Main process TypeScript configuration (invalid JSON)', 'red');
      configValid = false;
    }
  } else {
    log('✗ Main process TypeScript configuration (missing)', 'red');
    configValid = false;
  }
  
  if (fs.existsSync(rendererTsConfig)) {
    try {
      const config = JSON.parse(fs.readFileSync(rendererTsConfig, 'utf8'));
      if (config.compilerOptions && config.compilerOptions.jsx === 'react-jsx') {
        log('✓ Renderer process TypeScript configuration', 'green');
      } else {
        log('✗ Renderer process TypeScript configuration (invalid JSX setting)', 'red');
        configValid = false;
      }
    } catch (error) {
      log('✗ Renderer process TypeScript configuration (invalid JSON)', 'red');
      configValid = false;
    }
  } else {
    log('✗ Renderer process TypeScript configuration (missing)', 'red');
    configValid = false;
  }
  
  return configValid;
}

function checkWebpackConfiguration() {
  const webpackConfigPath = path.join(PROJECT_ROOT, 'webpack.config.js');
  
  if (!fs.existsSync(webpackConfigPath)) {
    log('✗ Webpack configuration (missing)', 'red');
    return false;
  }
  
  try {
    const webpackConfig = require(webpackConfigPath);
    const devConfig = webpackConfig({}, { mode: 'development' });
    const prodConfig = webpackConfig({}, { mode: 'production' });
    
    if (devConfig.target === 'electron-renderer' && prodConfig.target === 'electron-renderer') {
      log('✓ Webpack configuration', 'green');
      return true;
    } else {
      log('✗ Webpack configuration (invalid target)', 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Webpack configuration (error: ${error.message})`, 'red');
    return false;
  }
}

function main() {
  log('NoteSage Desktop - Architecture Validation', 'blue');
  log('==========================================\n', 'blue');
  
  let allChecksPass = true;
  
  // Check directory structure
  log('Checking directory structure:', 'blue');
  allChecksPass &= checkDirectoryExists('src', 'Source directory');
  allChecksPass &= checkDirectoryExists('src/main', 'Main process directory');
  allChecksPass &= checkDirectoryExists('src/renderer', 'Renderer process directory');
  allChecksPass &= checkDirectoryExists('src/components', 'Components directory');
  allChecksPass &= checkDirectoryExists('src/stores', 'Redux stores directory');
  
  // Check main process files
  log('\nChecking main process files:', 'blue');
  allChecksPass &= checkFileExists('src/main/main.ts', 'Main process entry point');
  allChecksPass &= checkFileExists('src/main/preload.ts', 'Preload script');
  allChecksPass &= checkFileExists('src/main/server-connection.ts', 'Server connection manager');
  allChecksPass &= checkFileExists('src/main/offline-cache.ts', 'Offline cache system');
  allChecksPass &= checkFileExists('src/main/sync-manager.ts', 'Sync manager');
  
  // Check renderer process files
  log('\nChecking renderer process files:', 'blue');
  allChecksPass &= checkFileExists('src/renderer/index.tsx', 'Renderer entry point');
  allChecksPass &= checkFileExists('src/renderer/App.tsx', 'Main React component');
  allChecksPass &= checkFileExists('src/renderer/index.html', 'HTML template');
  allChecksPass &= checkFileExists('src/renderer/styles/global.css', 'Global styles');
  
  // Check Redux store files
  log('\nChecking Redux store files:', 'blue');
  allChecksPass &= checkFileExists('src/stores/store.ts', 'Redux store configuration');
  allChecksPass &= checkFileExists('src/stores/hooks.ts', 'Redux hooks');
  allChecksPass &= checkFileExists('src/stores/slices/connectionSlice.ts', 'Connection slice');
  allChecksPass &= checkFileExists('src/stores/slices/notesSlice.ts', 'Notes slice');
  allChecksPass &= checkFileExists('src/stores/slices/peopleSlice.ts', 'People slice');
  allChecksPass &= checkFileExists('src/stores/slices/todosSlice.ts', 'Todos slice');
  
  // Check configuration files
  log('\nChecking configuration files:', 'blue');
  allChecksPass &= checkFileExists('package.json', 'Package configuration');
  allChecksPass &= checkFileExists('tsconfig.json', 'TypeScript configuration');
  allChecksPass &= checkFileExists('tsconfig.main.json', 'Main process TypeScript config');
  allChecksPass &= checkFileExists('webpack.config.js', 'Webpack configuration');
  allChecksPass &= checkFileExists('.eslintrc.js', 'ESLint configuration');
  allChecksPass &= checkFileExists('jest.config.js', 'Jest configuration');
  
  // Check dependencies and scripts
  allChecksPass &= checkPackageJsonDependencies();
  allChecksPass &= checkScripts();
  
  // Check configuration validity
  log('\nChecking configuration validity:', 'blue');
  allChecksPass &= checkTypeScriptConfiguration();
  allChecksPass &= checkWebpackConfiguration();
  
  // Check test files
  log('\nChecking test files:', 'blue');
  allChecksPass &= checkFileExists('src/__tests__/electron-architecture.test.ts', 'Architecture tests');
  
  // Check documentation
  log('\nChecking documentation:', 'blue');
  allChecksPass &= checkFileExists('ELECTRON_ARCHITECTURE.md', 'Architecture documentation');
  
  // Final result
  log('\n==========================================', 'blue');
  if (allChecksPass) {
    log('✓ All architecture checks passed!', 'green');
    log('The Electron application architecture is properly set up.', 'green');
    process.exit(0);
  } else {
    log('✗ Some architecture checks failed.', 'red');
    log('Please review the issues above and fix them.', 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkFileExists,
  checkDirectoryExists,
  checkPackageJsonDependencies,
  checkScripts,
  checkTypeScriptConfiguration,
  checkWebpackConfiguration,
};