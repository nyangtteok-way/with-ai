import { parseBackup, type AppData } from "./model";

export const IMPORT_RECOVERY_KEY = "with-ai:import-recovery:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface StoredImportRecovery {
  version: 1;
  savedAt: string;
  data: AppData;
}

export type ImportRecovery = Pick<StoredImportRecovery, "savedAt" | "data">;

type SaveImportRecoveryResult =
  | { ok: true; recovery: ImportRecovery }
  | { ok: false; message: string };

function getStorage(storage?: StorageLike): StorageLike {
  return storage ?? globalThis.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function loadImportRecovery(
  storage?: StorageLike,
): ImportRecovery | null {
  try {
    const raw = getStorage(storage).getItem(IMPORT_RECOVERY_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !isIsoDate(value.savedAt)
    )
      return null;

    return {
      savedAt: value.savedAt,
      data: parseBackup(JSON.stringify(value.data)),
    };
  } catch {
    return null;
  }
}

export function saveImportRecovery(
  data: AppData,
  storage?: StorageLike,
  savedAt = new Date().toISOString(),
): SaveImportRecoveryResult {
  try {
    if (!isIsoDate(savedAt)) throw new Error("invalid recovery date");
    const recovery: ImportRecovery = {
      savedAt,
      data: parseBackup(JSON.stringify(data)),
    };
    const stored: StoredImportRecovery = { version: 1, ...recovery };
    getStorage(storage).setItem(IMPORT_RECOVERY_KEY, JSON.stringify(stored));
    return { ok: true, recovery };
  } catch {
    return {
      ok: false,
      message:
        "현재 데이터를 안전하게 보관하지 못해 가져오기를 중단했어요. 브라우저 저장 공간이나 권한을 확인하거나 JSON으로 먼저 내보내 주세요.",
    };
  }
}

export function removeImportRecovery(storage?: StorageLike) {
  try {
    getStorage(storage).removeItem(IMPORT_RECOVERY_KEY);
    return true;
  } catch {
    return false;
  }
}
