import type { Card, ProgressNote, Project } from "./model";

export const PROGRESS_NOTE_DRAFT_PREFIX = "with-ai:note-draft:v1:";

type NoteFields = Pick<ProgressNote, "done" | "blocked" | "next">;
type StorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

interface StoredProgressNoteDraft {
  version: 1;
  cardId: string;
  baseUpdatedAt: string | null;
  note: NoteFields;
  savedAt: string;
}

export type ProgressNoteDraft = Pick<
  StoredProgressNoteDraft,
  "note" | "savedAt"
>;

type DraftResult =
  | { ok: true; savedAt: string }
  | { ok: false; message: string };

function getStorage(storage?: StorageLike): StorageLike {
  return storage ?? globalThis.localStorage;
}

function key(cardId: string) {
  return `${PROGRESS_NOTE_DRAFT_PREFIX}${cardId}`;
}

function isNote(value: unknown): value is NoteFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const note = value as Record<string, unknown>;
  return [note.done, note.blocked, note.next].every(
    (field) => typeof field === "string" && field.length <= 10000,
  );
}

function isStoredDraft(
  value: unknown,
  cardId: string,
  baseUpdatedAt: string | null,
): value is StoredProgressNoteDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    draft.version === 1 &&
    draft.cardId === cardId &&
    draft.baseUpdatedAt === baseUpdatedAt &&
    isNote(draft.note) &&
    typeof draft.savedAt === "string" &&
    Number.isFinite(Date.parse(draft.savedAt))
  );
}

export function loadProgressNoteDraft(
  cardId: string,
  baseUpdatedAt: string | null,
  storage?: StorageLike,
): ProgressNoteDraft | null {
  try {
    const target = getStorage(storage);
    const raw = target.getItem(key(cardId));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!isStoredDraft(value, cardId, baseUpdatedAt)) return null;
    return { note: value.note, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function saveProgressNoteDraft(
  cardId: string,
  baseUpdatedAt: string | null,
  note: NoteFields,
  storage?: StorageLike,
): DraftResult {
  try {
    if (!isNote(note)) throw new Error("invalid note");
    const savedAt = new Date().toISOString();
    const draft: StoredProgressNoteDraft = {
      version: 1,
      cardId,
      baseUpdatedAt,
      note,
      savedAt,
    };
    getStorage(storage).setItem(key(cardId), JSON.stringify(draft));
    return { ok: true, savedAt };
  } catch {
    return {
      ok: false,
      message:
        "진행 메모를 임시 저장하지 못했어요. 브라우저 저장 공간이나 권한을 확인하고 메모 저장을 눌러 주세요.",
    };
  }
}

export function removeProgressNoteDraft(
  cardId: string,
  storage?: StorageLike,
) {
  try {
    getStorage(storage).removeItem(key(cardId));
    return true;
  } catch {
    return false;
  }
}

export function hasProgressNoteDraft(
  card: Pick<Card, "id" | "note">,
  storage?: StorageLike,
) {
  return !!loadProgressNoteDraft(card.id, card.note.updatedAt, storage);
}

export function removeProjectProgressNoteDrafts(
  project: Pick<Project, "cards">,
  storage?: StorageLike,
) {
  project.cards.forEach((card) => removeProgressNoteDraft(card.id, storage));
}

export function removeAllProgressNoteDrafts(storage?: StorageLike) {
  try {
    const target = getStorage(storage);
    const keys: string[] = [];
    for (let index = 0; index < target.length; index += 1) {
      const storageKey = target.key(index);
      if (storageKey?.startsWith(PROGRESS_NOTE_DRAFT_PREFIX)) keys.push(storageKey);
    }
    keys.forEach((storageKey) => target.removeItem(storageKey));
  } catch {
    // Draft cleanup must never block confirmed data replacement.
  }
}
