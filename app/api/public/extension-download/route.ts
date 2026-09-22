import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";
import { normalizeExtensionProvider } from "src/lib/extension-providers";
import { getExtensionRelease } from "src/lib/extension-package";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEGACY_ZIP_FILE_NAME = "AutoApplyCVLinkedInExtension.zip";
const FALLBACK_GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/Celestiatech/Quotausageuiimplementation/main/public/downloads/AutoApplyCVLinkedInExtension.zip";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function addToZip(zip: JSZip, absolutePath: string, zipPath: string) {
  const stats = await fs.stat(absolutePath);
  if (stats.isDirectory()) {
    const entries = (await fs.readdir(absolutePath)).sort((a, b) => a.localeCompare(b));
    for (const entry of entries) {
      await addToZip(zip, path.join(absolutePath, entry), `${zipPath}/${entry}`);
    }
    return;
  }

  const file = await fs.readFile(absolutePath);
  zip.file(zipPath, file);
}

// In-memory cache for generated zip buffers by provider and version
const zipCache = new Map<string, { buffer: Buffer; version: string; cachedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: Request) {
  const provider = normalizeExtensionProvider(new URL(req.url).searchParams.get("provider"));
  const release = await getExtensionRelease(provider);
  const cacheKey = `${provider}:${release.version}`;
  const now = Date.now();

  const cached = zipCache.get(cacheKey);
  if (cached && (now - cached.cachedAt) < CACHE_TTL_MS) {
    const res = new NextResponse(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${release.zipFileName}"`,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Extension-Version": release.version,
        "X-Extension-Provider": provider,
      },
    });
    return res;
  }

  try {
    const zip = new JSZip();
    for (const entry of release.includeEntries) {
      const absolutePath = path.join(release.rootPath, entry);
      await addToZip(zip, absolutePath, `${release.rootDirName}/${entry}`);
    }
    const file = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    zipCache.set(cacheKey, { buffer: file, version: release.version, cachedAt: now });

    const res = new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${release.zipFileName}"`,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Extension-Version": release.version,
        "X-Extension-Provider": provider,
      },
    });
    return res;
  } catch {
    if (provider !== "linkedin") {
      return noStore(
        NextResponse.json(
          { success: false, message: `Failed to package ${provider} extension` },
          { status: 500 },
        ),
      );
    }
    const localZipPath = path.join(process.cwd(), "public", "downloads", LEGACY_ZIP_FILE_NAME);
    try {
      const file = await fs.readFile(localZipPath);
      const res = new NextResponse(new Uint8Array(file), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${release.zipFileName}"`,
          "X-Extension-Version": release.version,
          "X-Extension-Provider": provider,
        },
      });
      return noStore(res);
    } catch {
      const redirect = NextResponse.redirect(FALLBACK_GITHUB_RAW_URL, 307);
      return noStore(redirect);
    }
  }
}
