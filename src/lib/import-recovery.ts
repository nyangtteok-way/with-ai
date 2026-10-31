import {
  newId,
  parseBackup,
  type AppData,
  type Card,
  type Project,
} from "./model";

export const IMPORT_RECOVERY_KEY = "with-ai:import-recovery:v1";

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

interface StoredImportRecovery {
  version: 1;
  savedAt: string;
  data: AppData;
}

export type ImportRecovery = Pick<StoredImportRecovery, "savedAt" | "data">;

function createRecoveryIdGenerator(
  reservedIds: Iterable<string>,
  sourceIds: Iterable<string>,
  createId: () => string,
  message: string,
) {
  const usedIds = new Set(reservedIds);
  for (const id of sourceIds) usedIds.add(id);
  return () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = createId();
      if (
        candidate.trim() &&
        candidate.length <= 128 &&
        !usedIds.has(candidate)
      ) {
        usedIds.add(candidate);
        return candidate;
      }
    }
    throw new Error(message);
  };
}

function cloneCard(card: Card, id: string): Card {
  return {
    ...card,
    id,
    note: { ...card.note },
    ...(card.noteHistory
      ? { noteHistory: card.noteHistory.map((note) => ({ ...note })) }
      : {}),
  };
}

export function cloneRecoveryCard(
  card: Card,
  reservedIds: Iterable<string>,
  createId: () => string = newId,
): Card {
  const nextId = createRecoveryIdGenerator(
    reservedIds,
    [card.id],
    createId,
    "복구할 카드의 새 식별자를 만들지 못했어요.",
  );
  return cloneCard(card, nextId());
}

export function cloneRecoveryProject(
  project: Project,
  reservedIds: Iterable<string>,
  createId: () => string = newId,
): Project {
  const nextId = createRecoveryIdGenerator(
    reservedIds,
    [project.id, ...project.cards.map((card) => card.id)],
    createId,
    "복구할 프로젝트의 새 식별자를 만들지 못했어요.",
  );
  return {
    ...project,
    id: nextId(),
    cards: project.cards.map((card) => cloneCard(card, nextId())),
  };
}

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

function parseRecovery(value: unknown): ImportRecovery | null {
  try {
    if (!isRecord(value) || value.version !== 1 || !isIsoDate(value.savedAt))
      return null;

    return {
      savedAt: value.savedAt,
      data: parseBackup(JSON.stringify(value.data)),
    };
  } catch {
    return null;
  }
}

export function loadImportRecovery(
  rawData: string | null,
  storage?: StorageLike,
): ImportRecovery | null {
  // An explicit null prevents an old, separately stored recovery from returning
  // after recovery is intentionally cleared, even if removing that legacy key
  // was denied.
  try {
    const value: unknown = rawData === null ? null : JSON.parse(rawData);
    if (isRecord(value) && Object.hasOwn(value, "importRecovery"))
      return parseRecovery(value.importRecovery);
  } catch {
    // A legacy recovery may still help when the main data is damaged.
  }
  try {
    const raw = getStorage(storage).getItem(IMPORT_RECOVERY_KEY);
    return raw === null ? null : parseRecovery(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function createImportRecovery(
  data: AppData,
  savedAt = new Date().toISOString(),
): ImportRecovery {
  if (!isIsoDate(savedAt)) throw new Error("invalid recovery date");
  return { savedAt, data: parseBackup(JSON.stringify(data)) };
}

export function serializeStoredData(
  data: AppData,
  recovery: ImportRecovery | null,
) {
  const importRecovery: StoredImportRecovery | null = recovery
    ? { version: 1, ...recovery }
    : null;
  // Keep the v1 project schema; this local-only field is excluded by parseBackup
  // and therefore never appears in exported JSON or nests in a new recovery.
  return JSON.stringify({ ...data, importRecovery });
}

export function removeLegacyImportRecovery(storage?: StorageLike) {
  try {
    getStorage(storage).removeItem(IMPORT_RECOVERY_KEY);
    return true;
  } catch {
    return false;
  }
}
