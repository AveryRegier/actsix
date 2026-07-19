#!/usr/bin/env node

/**
 * Fix broken file: dependencies in git worktrees
 *
 * When npm install runs in a git worktree, the relative paths in package.json for
 * sengo and clox (file:../sengo/client/dist, file:../clox/dist) may resolve
 * incorrectly depending on the worktree depth. This script recreates the junctions
 * to point at the correct absolute paths.
 *
 * Usage: node scripts/fix-e2e-worktree-setup.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const nodeModules = path.join(projectRoot, 'node_modules');
const sengoLink = path.join(nodeModules, 'sengo');
const cloxLink = path.join(nodeModules, 'clox');

// Detect the dev directory root (parent of actsix.worktrees or direct actsix repo)
let devRoot = path.resolve(projectRoot, '..');
if (path.basename(devRoot) === 'actsix.worktrees') {
  devRoot = path.resolve(devRoot, '..');
}

const sengoTarget = path.join(devRoot, 'sengo', 'client', 'dist');
const cloxTarget = path.join(devRoot, 'clox', 'dist');

const isWindows = process.platform === 'win32';

function removeLink(linkPath) {
  if (!fs.existsSync(linkPath)) {
    return;
  }
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      if (isWindows) {
        // On Windows, junctions are directories, use rmdir
        fs.rmSync(linkPath, { force: true, recursive: false });
      } else {
        fs.unlinkSync(linkPath);
      }
      console.log(`✓ Removed ${path.relative(projectRoot, linkPath)}`);
    }
  } catch (e) {
    console.warn(`⚠ Failed to remove ${path.relative(projectRoot, linkPath)}: ${e.message}`);
  }
}

function createLink(linkPath, target) {
  if (!fs.existsSync(target)) {
    console.error(`✗ Target does not exist: ${target}`);
    process.exit(1);
  }

  removeLink(linkPath);

  try {
    if (isWindows) {
      // Use junction on Windows for better compatibility
      execSync(`mklink /J "${linkPath}" "${target}"`, { stdio: 'pipe' });
    } else {
      // Use relative symlink on Unix
      const relativeTarget = path.relative(nodeModules, target);
      fs.symlinkSync(relativeTarget, linkPath, 'dir');
    }
    console.log(`✓ Created link: ${path.relative(projectRoot, linkPath)} → ${path.relative(devRoot, target)}`);
  } catch (e) {
    console.error(`✗ Failed to create link ${linkPath}: ${e.message}`);
    process.exit(1);
  }
}

function verifyLink(linkPath, target) {
  try {
    if (!fs.existsSync(linkPath)) {
      return false;
    }
    const stat = fs.lstatSync(linkPath);
    if (!stat.isSymbolicLink() && !stat.isDirectory()) {
      return false;
    }
    // Verify the target is accessible
    return fs.existsSync(path.join(linkPath, 'package.json'));
  } catch (e) {
    return false;
  }
}

console.log('E2E Worktree Setup Fix');
console.log('======================\n');
console.log(`Project root: ${projectRoot}`);
console.log(`Dev root: ${devRoot}`);
console.log(`Sengo target: ${sengoTarget}`);
console.log(`Clox target: ${cloxTarget}\n`);

if (!fs.existsSync(sengoTarget)) {
  console.error(`✗ Cannot find sengo at ${sengoTarget}`);
  console.error('  Make sure sengo repo exists as a sibling to actsix.');
  process.exit(1);
}

if (!fs.existsSync(cloxTarget)) {
  console.error(`✗ Cannot find clox at ${cloxTarget}`);
  console.error('  Make sure clox repo exists as a sibling to actsix.');
  process.exit(1);
}

console.log('Fixing junctions...\n');
createLink(sengoLink, sengoTarget);
createLink(cloxLink, cloxTarget);

console.log('\nVerifying...\n');
const sengoOk = verifyLink(sengoLink, sengoTarget);
const cloxOk = verifyLink(cloxLink, cloxTarget);

if (sengoOk && cloxOk) {
  console.log('✓ All links verified!\n');
  console.log('Next steps:');
  console.log('  npm run e2e:mcp:smoke    # Run smoke tests');
  console.log('  npm run e2e:mcp          # Run full e2e suite');
  process.exit(0);
} else {
  console.error('✗ Verification failed');
  process.exit(1);
}
