import { CHROME_STORE_URL } from "src/lib/extension-store";

export type ExtensionProvider = "linkedin" | "indeed";

export type ExtensionProviderConfig = {
  provider: ExtensionProvider;
  code: string;
  displayName: string;
  shortLabel: string;
  rootDir: string;
  sourceKey: string;
  zipPrefix: string;
  storeUrl: string | null;
};

const EXTENSION_PROVIDERS: Record<ExtensionProvider, ExtensionProviderConfig> = {
  linkedin: {
    provider: "linkedin",
    code: "li",
    displayName: "AutoApply CV LinkedIn Copilot",
    shortLabel: "LinkedIn",
    rootDir: "CareerPilotLinkedInExtension",
    sourceKey: "linkedin_extension",
    zipPrefix: "AutoApplyCVLinkedInExtensionVersion",
    storeUrl: CHROME_STORE_URL,
  },
  indeed: {
    provider: "indeed",
    code: "indeed",
    displayName: "AutoApply CV Indeed Copilot",
    shortLabel: "Indeed",
    rootDir: "CareerPilotIndeedExtension",
    sourceKey: "indeed_extension",
    zipPrefix: "AutoApplyCVIndeedExtensionVersion",
    storeUrl: null,
  },
};

export const HR_OUTREACH_EXTENSION_STORE_URL =
  "https://chromewebstore.google.com/detail/cilkgachncgahbonpdcfjmjifingpnah";

export function getExtensionStoreUrl(provider: unknown, fallback: ExtensionProvider = "linkedin"): string | null {
  return getExtensionProviderConfig(provider, fallback).storeUrl;
}

export function normalizeExtensionProvider(
  value: unknown,
  fallback: ExtensionProvider = "linkedin",
): ExtensionProvider {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "indeed" || raw === "id" || raw === "in") return "indeed";
  if (raw === "linkedin" || raw === "li") return "linkedin";
  return fallback;
}

export function getExtensionProviderConfig(
  provider: unknown,
  fallback: ExtensionProvider = "linkedin",
): ExtensionProviderConfig {
  return EXTENSION_PROVIDERS[normalizeExtensionProvider(provider, fallback)];
}

export function listExtensionProviderConfigs(): ExtensionProviderConfig[] {
  return Object.values(EXTENSION_PROVIDERS);
}

export function extensionIdempotencyPrefix(provider: unknown): string {
  return `ext:${getExtensionProviderConfig(provider).code}:`;
}

export function extensionSourceKey(provider: unknown): string {
  return getExtensionProviderConfig(provider).sourceKey;
}
