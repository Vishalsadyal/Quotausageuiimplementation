import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const workspaceRoot = 'e:\\Autoapply';

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Package AutoApply CV Unified Suite Extension (v3.1.0)
console.log('Packaging AutoApply CV Unified Extension Suite (v3.1.0)...');
const stagingDir = path.join(workspaceRoot, '.ext_staging_suite');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Copy manifest.json
fs.copyFileSync(
  path.join(workspaceRoot, 'CareerPilotLinkedInExtension', 'manifest.json'),
  path.join(stagingDir, 'manifest.json')
);

// Copy icons
copyDirRecursive(
  path.join(workspaceRoot, 'CareerPilotLinkedInExtension', 'icons'),
  path.join(stagingDir, 'icons')
);

// Copy src
copyDirRecursive(
  path.join(workspaceRoot, 'CareerPilotLinkedInExtension', 'src'),
  path.join(stagingDir, 'src')
);

// Read version from manifest
const manifest = JSON.parse(fs.readFileSync(path.join(stagingDir, 'manifest.json'), 'utf8'));
const version = manifest.version || '3.1.0';
console.log(`Manifest Version: ${version}`);

const zipTargets = [
  path.join(workspaceRoot, `AutoApplyCV-Suite-v${version}-ChromeStore.zip`),
  path.join(workspaceRoot, `AutoApplyCV-Copilot-v${version}-chrome-store.zip`),
  path.join(workspaceRoot, 'CareerPilotLinkedInExtension.zip'),
];

for (const z of zipTargets) {
  if (fs.existsSync(z)) fs.unlinkSync(z);
  execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${z}' -CompressionLevel Optimal"`);
  const stats = fs.statSync(z);
  console.log(`✓ Created: ${path.basename(z)} (${(stats.size / 1024).toFixed(1)} KB)`);
}

fs.rmSync(stagingDir, { recursive: true, force: true });
console.log('\n✅ Chrome Web Store upload packages created successfully!');
