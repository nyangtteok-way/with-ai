"use client";
import { useSyncExternalStore } from "react";
import { AppData, EMPTY_DATA, parseBackup } from "./model";
import {
  IMPORT_RECOVERY_KEY,
  createImportRecovery,
  loadImportRecovery,
  removeLegacyImportRecovery,
  serializeStoredData,
  type ImportRecovery,
} from "./import-recovery";
export const STORAGE_KEY = "with-ai:data:v1";
type Snapshot = {
  data: AppData;
  ready: boolean;
  error: string | null;
  importRecovery: ImportRecovery | null;
};
export type SaveOptions =
  | { kind?: "edit" }
  | { kind: "import" }
  | { kind: "restore"; recovery: ImportRecovery };
const serverSnapshot: Snapshot = {
  data: EMPTY_DATA,
  ready: false,
  error: null,
  importRecovery: null,
};
let snapshot = serverSnapshot;
let raw: string | null = null;
const listeners = new Set<() => void>();
function load() {
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    snapshot = {
      ready: true,
      data: raw === null ? { version: 1, projects: [] } : parseBackup(raw),
      error: null,
      importRecovery: loadImportRecovery(raw),
    };
  } catch {
    snapshot = {
      ready: true,
      data: EMPTY_DATA,
      importRecovery: loadImportRecovery(raw),
      error:
        "저장된 데이터를 읽을 수 없어요. 원본은 유지했어요. 브라우저 저장 권한을 확인하거나 정상 백업을 가져와 복구해 주세요.",
    };
  }
}
function emit() {
  listeners.forEach((listener) => listener());
}
function onStorage(event: StorageEvent) {
  if (
    event.key === STORAGE_KEY ||
    event.key === IMPORT_RECOVERY_KEY ||
    event.key === null
  ) {
    load();
    emit();
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}
function getSnapshot() {
  if (!snapshot.ready) load();
  return snapshot;
}
export function useAppStore() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
export function retryLoad() {
  load();
  emit();
}
export function saveData(
  data: AppData,
  options: SaveOptions = {},
): { ok: true } | { ok: false; message: string } {
  if (snapshot.error && options.kind !== "import" && options.kind !== "restore")
    return {
      ok: false,
      message:
        "데이터를 읽을 수 없어 변경을 저장하지 않았어요. 먼저 백업으로 복구해 주세요.",
    };
  try {
    if (localStorage.getItem(STORAGE_KEY) !== raw) {
      load();
      emit();
      return {
        ok: false,
        message:
          "다른 탭에서 데이터가 바뀌었어요. 최신 내용을 확인하고 다시 시도해 주세요.",
      };
    }
    let importRecovery = loadImportRecovery(raw);
    if (options.kind === "restore") {
      if (
        !importRecovery ||
        JSON.stringify(importRecovery) !== JSON.stringify(options.recovery)
      ) {
        load();
        emit();
        return {
          ok: false,
          message:
            "복구 지점이 바뀌었어요. 설정에서 최신 복구 지점을 다시 확인해 주세요.",
        };
      }
      importRecovery = null;
    } else if (options.kind === "import" && !snapshot.error) {
      importRecovery = createImportRecovery(snapshot.data);
    }
    // Data and its recovery must succeed or fail together. Never overwrite the
    // legacy recovery first, and never attempt a second write to roll back.
    const serialized = serializeStoredData(data, importRecovery);
    localStorage.setItem(STORAGE_KEY, serialized);
    raw = serialized;
    snapshot = { data, ready: true, error: null, importRecovery };
    // The embedded value (including null) is authoritative if cleanup fails.
    removeLegacyImportRecovery();
    emit();
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        options.kind === "import"
          ? "데이터와 복구 지점을 저장하지 못해 가져오기를 중단했어요. 현재 데이터와 이전 복구본은 유지돼요. 브라우저 저장 공간이나 권한을 확인해 주세요."
          : "저장하지 못했어요. 브라우저 저장 공간이나 권한을 확인해 주세요. 입력 내용은 그대로 유지돼요.",
    };
  }
}
