export const APP_SHELL_CACHE_PREFIX = "with-ai-app-shell-";
export const APP_SHELL_CACHE_NAME = `${APP_SHELL_CACHE_PREFIX}v1`;
export const APP_SHELL_FINGERPRINT_PATH =
  "/__with-ai-app-shell-fingerprint";
export const APP_SHELL_UPDATED_MESSAGE = "with-ai:app-shell-updated";

export const APP_SHELL_FIXED_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
] as const;

export function createAppShellFingerprint(assets: Iterable<string>) {
  return JSON.stringify([...new Set(assets)].sort());
}
