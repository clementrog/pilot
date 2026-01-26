#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const help = args.includes('--help') || args.includes('-h');
const prdArg = args.find(a => !a.startsWith('-'));

if (help) {
  console.log(`
create-pilot - Scaffold Pilot protocol into your project

Usage:
  npx create-pilot              # scaffold only
  npx create-pilot ./prd.md     # scaffold + copy PRD
  npx create-pilot -            # scaffold + read PRD from stdin
  npx create-pilot --force      # overwrite existing pilot/

Options:
  -f, --force   Overwrite existing pilot/ directory
  -h, --help    Show this help message
`);
  process.exit(0);
}

const targetDir = process.cwd();

// Check for existing pilot/
if (existsSync(join(targetDir, 'pilot')) && !force) {
  console.error('Error: pilot/ already exists. Use --force to overwrite.');
  process.exit(1);
}

// Copy directory recursively
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// Scaffold
console.log('Scaffolding Pilot protocol...\n');

// Copy pilot/
copyDir(join(PACKAGE_ROOT, 'pilot'), join(targetDir, 'pilot'));
console.log('✓ Created pilot/');

// Copy prd/
copyDir(join(PACKAGE_ROOT, 'prd'), join(targetDir, 'prd'));
console.log('✓ Created prd/');

// Copy root files
copyFileSync(join(PACKAGE_ROOT, 'ORCHESTRATOR.md'), join(targetDir, 'ORCHESTRATOR.md'));
console.log('✓ Added ORCHESTRATOR.md');

copyFileSync(join(PACKAGE_ROOT, 'BOOT.txt'), join(targetDir, 'BOOT.txt'));
console.log('✓ Added BOOT.txt');

copyFileSync(join(PACKAGE_ROOT, 'cursorrules'), join(targetDir, '.cursorrules'));
console.log('✓ Added .cursorrules');

copyFileSync(join(PACKAGE_ROOT, 'claude-md'), join(targetDir, 'claude.md'));
console.log('✓ Added claude.md');

// Handle PRD input
async function handlePrd() {
  let prdContent = null;

  if (prdArg === '-') {
    prdContent = await readStdin();
  } else if (prdArg && existsSync(prdArg)) {
    prdContent = readFileSync(prdArg, 'utf-8');
  }

  if (prdContent) {
    writeFileSync(join(targetDir, 'prd', 'input.md'), prdContent);
    console.log('✓ Saved PRD to prd/input.md');
  }

  console.log('\n────────────────────────────────────');
  console.log('Ready. Open your LLM and say:');
  console.log('\n  Read BOOT.txt');
  console.log('────────────────────────────────────\n');
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

handlePrd();
