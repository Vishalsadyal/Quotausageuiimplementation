import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";

function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function copyExtensionFiles() {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const srcDir = resolve(__dirname, "src");
      const distDir = resolve(__dirname, "dist");
      copyDir(srcDir, distDir);
      const manifest = resolve(__dirname, "manifest.json");
      if (existsSync(manifest)) {
        copyFileSync(manifest, resolve(distDir, "manifest.json"));
      }
      const iconsDir = resolve(__dirname, "icons");
      if (existsSync(iconsDir)) {
        copyDir(iconsDir, resolve(distDir, "icons"));
      }
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist",
    emptyDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/background.js"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: [copyExtensionFiles()],
});
