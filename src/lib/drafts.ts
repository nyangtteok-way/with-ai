import { STATUSES, type Card, type ProgressNote, type Project } from "./model";

export const PROGRESS_NOTE_DRAFT_PREFIX = "with-ai:note-draft:v1:";
export const CARD_FORM_DRAFT_PREFIX = "with-ai:card-draft:v1:";
export const PROJECT_FORM_DRAFT_PREFIX = "with-ai:project-draft:v1:";
export const PROMPT_DRAFT_PREFIX = "with-ai:prompt-draft:v1:";

const MAX_PROMPT_LENGTH = 100000;

type NoteFields = Pick<ProgressNote, "done" | "blocked" | "next">;
export type CardDraftFields = Pick<
  Card,
  "title" | "description" | "requirements" | "acceptance" | "status"
>;
export type ProjectDraftFields = Pick<Project, "name" | "description">;
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

interface StoredCardFormDraft {
  version: 1;
  projectId: string;
  cardId: string | null;
  base: CardDraftFields | null;
  fields: CardDraftFields;
  savedAt: string;
}

interface StoredProjectFormDraft {
  version: 1;
  projectId: string | null;
  base: ProjectDraftFields | null;
  fields: ProjectDraftFields;
  savedAt: string;
}

interface StoredPromptDraft {
  version: 1;
  projectId: string;
  cardId: string;
  basePrompt: string;
  prompt: string;
  savedAt: string;
}

export type ProgressNoteDraft = Pick<
  StoredProgressNoteDraft,
  "note" | "savedAt"
>;

export type CardFormDraft = Pick<StoredCardFormDraft, "fields" | "savedAt">;
export type ProjectFormDraft = Pick<
  StoredProjectFormDraft,
  "fields" | "savedAt"
>;
export type PromptDraft = Pick<StoredPromptDraft, "prompt" | "savedAt">;

type DraftResult =
  | { ok: true; savedAt: string }
  | { ok: false; message: string };

function getStorage(storage?: StorageLike): StorageLike {
  return storage ?? globalThis.localStorage;
}

function noteKey(cardId: string) {
  return `${PROGRESS_NOTE_DRAFT_PREFIX}${cardId}`;
}

function cardKey(projectId: string, cardId: string | null) {
  const projectPart = encodeURIComponent(projectId);
  const cardPart = cardId === null ? "new" : `edit:${encodeURIComponent(cardId)}`;
  return `${CARD_FORM_DRAFT_PREFIX}${projectPart}:${cardPart}`;
}

function cardProjectPrefix(projectId: string) {
  return `${CARD_FORM_DRAFT_PREFIX}${encodeURIComponent(projectId)}:`;
}

function projectKey(projectId: string | null) {
  const target = projectId === null ? "new" : `edit:${encodeURIComponent(projectId)}`;
  return `${PROJECT_FORM_DRAFT_PREFIX}${target}`;
}

function promptKey(projectId: string, cardId: string) {
  return `${PROMPT_DRAFT_PREFIX}${encodeURIComponent(projectId)}:${encodeURIComponent(cardId)}`;
}

function promptProjectPrefix(projectId: string) {
  return `${PROMPT_DRAFT_PREFIX}${encodeURIComponent(projectId)}:`;
}

function isNote(value: unknown): value is NoteFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const note = value as Record<string, unknown>;
  return [note.done, note.blocked, note.next].every(
    (field) => typeof field === "string" && field.length <= 10000,
  );
}

function isCardFields(value: unknown): value is CardDraftFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.title === "string" &&
    fields.title.length <= 120 &&
    [fields.description, fields.requirements, fields.acceptance].every(
      (field) => typeof field === "string" && field.length <= 10000,
    ) &&
    STATUSES.some((status) => status.value === fields.status)
  );
}

function sameCardFields(
  first: CardDraftFields | null,
  second: CardDraftFields | null,
) {
  if (first === null || second === null) return first === second;
  return (
    first.title === second.title &&
    first.description === second.description &&
    first.requirements === second.requirements &&
    first.acceptance === second.acceptance &&
    first.status === second.status
  );
}

function isProjectFields(value: unknown): value is ProjectDraftFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === "string" &&
    fields.name.length <= 100 &&
    typeof fields.description === "string" &&
    fields.description.length <= 10000
  );
}

function sameProjectFields(
  first: ProjectDraftFields | null,
  second: ProjectDraftFields | null,
) {
  if (first === null || second === null) return first === second;
  return (
    first.name === second.name && first.description === second.description
  );
}

function isPromptText(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_PROMPT_LENGTH;
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
    const raw = target.getItem(noteKey(cardId));
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
    getStorage(storage).setItem(noteKey(cardId), JSON.stringify(draft));
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
    getStorage(storage).removeItem(noteKey(cardId));
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
  removeDraftsWithPrefix(PROGRESS_NOTE_DRAFT_PREFIX, storage);
}

function isStoredCardFormDraft(
  value: unknown,
  projectId: string,
  cardId: string | null,
  base: CardDraftFields | null,
): value is StoredCardFormDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  const storedBase = draft.base === null ? null : draft.base;
  return (
    draft.version === 1 &&
    draft.projectId === projectId &&
    draft.cardId === cardId &&
    (storedBase === null || isCardFields(storedBase)) &&
    sameCardFields(storedBase as CardDraftFields | null, base) &&
    isCardFields(draft.fields) &&
    typeof draft.savedAt === "string" &&
    Number.isFinite(Date.parse(draft.savedAt))
  );
}

export function loadCardFormDraft(
  projectId: string,
  cardId: string | null,
  base: CardDraftFields | null,
  storage?: StorageLike,
): CardFormDraft | null {
  try {
    const raw = getStorage(storage).getItem(cardKey(projectId, cardId));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!isStoredCardFormDraft(value, projectId, cardId, base)) return null;
    return { fields: value.fields, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function saveCardFormDraft(
  projectId: string,
  cardId: string | null,
  base: CardDraftFields | null,
  fields: CardDraftFields,
  storage?: StorageLike,
): DraftResult {
  try {
    if (!isCardFields(fields) || (base !== null && !isCardFields(base)))
      throw new Error("invalid card draft");
    const savedAt = new Date().toISOString();
    const draft: StoredCardFormDraft = {
      version: 1,
      projectId,
      cardId,
      base,
      fields,
      savedAt,
    };
    getStorage(storage).setItem(cardKey(projectId, cardId), JSON.stringify(draft));
    return { ok: true, savedAt };
  } catch {
    return {
      ok: false,
      message:
        "작업 카드 초안을 임시 저장하지 못했어요. 브라우저 저장 공간이나 권한을 확인해 주세요.",
    };
  }
}

export function removeCardFormDraft(
  projectId: string,
  cardId: string | null,
  storage?: StorageLike,
) {
  try {
    getStorage(storage).removeItem(cardKey(projectId, cardId));
    return true;
  } catch {
    return false;
  }
}

export function hasCardFormDraft(
  projectId: string,
  card?: Pick<
    Card,
    "id" | "title" | "description" | "requirements" | "acceptance" | "status"
  >,
  storage?: StorageLike,
) {
  const base: CardDraftFields | null = card
    ? {
        title: card.title,
        description: card.description,
        requirements: card.requirements,
        acceptance: card.acceptance,
        status: card.status,
      }
    : null;
  return !!loadCardFormDraft(projectId, card?.id ?? null, base, storage);
}

export function removeProjectCardFormDrafts(
  projectId: string,
  storage?: StorageLike,
) {
  removeDraftsWithPrefix(cardProjectPrefix(projectId), storage);
}

export function removeAllCardFormDrafts(storage?: StorageLike) {
  removeDraftsWithPrefix(CARD_FORM_DRAFT_PREFIX, storage);
}

function isStoredProjectFormDraft(
  value: unknown,
  projectId: string | null,
  base: ProjectDraftFields | null,
): value is StoredProjectFormDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  const storedBase = draft.base === null ? null : draft.base;
  return (
    draft.version === 1 &&
    draft.projectId === projectId &&
    (storedBase === null || isProjectFields(storedBase)) &&
    sameProjectFields(storedBase as ProjectDraftFields | null, base) &&
    isProjectFields(draft.fields) &&
    typeof draft.savedAt === "string" &&
    Number.isFinite(Date.parse(draft.savedAt))
  );
}

export function loadProjectFormDraft(
  projectId: string | null,
  base: ProjectDraftFields | null,
  storage?: StorageLike,
): ProjectFormDraft | null {
  try {
    const raw = getStorage(storage).getItem(projectKey(projectId));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!isStoredProjectFormDraft(value, projectId, base)) return null;
    return { fields: value.fields, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function saveProjectFormDraft(
  projectId: string | null,
  base: ProjectDraftFields | null,
  fields: ProjectDraftFields,
  storage?: StorageLike,
): DraftResult {
  try {
    if (
      !isProjectFields(fields) ||
      (base !== null && !isProjectFields(base)) ||
      (projectId === null) !== (base === null)
    )
      throw new Error("invalid project draft");
    const savedAt = new Date().toISOString();
    const draft: StoredProjectFormDraft = {
      version: 1,
      projectId,
      base,
      fields,
      savedAt,
    };
    getStorage(storage).setItem(projectKey(projectId), JSON.stringify(draft));
    return { ok: true, savedAt };
  } catch {
    return {
      ok: false,
      message:
        "프로젝트 초안을 임시 저장하지 못했어요. 브라우저 저장 공간이나 권한을 확인해 주세요.",
    };
  }
}

export function removeProjectFormDraft(
  projectId: string | null,
  storage?: StorageLike,
) {
  try {
    getStorage(storage).removeItem(projectKey(projectId));
    return true;
  } catch {
    return false;
  }
}

export function hasProjectFormDraft(
  project?: Pick<Project, "id" | "name" | "description">,
  storage?: StorageLike,
) {
  const base: ProjectDraftFields | null = project
    ? { name: project.name, description: project.description }
    : null;
  return !!loadProjectFormDraft(project?.id ?? null, base, storage);
}

export function removeAllProjectFormDrafts(storage?: StorageLike) {
  removeDraftsWithPrefix(PROJECT_FORM_DRAFT_PREFIX, storage);
}

function isStoredPromptDraft(
  value: unknown,
  projectId: string,
  cardId: string,
  basePrompt: string,
): value is StoredPromptDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    draft.version === 1 &&
    draft.projectId === projectId &&
    draft.cardId === cardId &&
    draft.basePrompt === basePrompt &&
    isPromptText(draft.basePrompt) &&
    isPromptText(draft.prompt) &&
    typeof draft.savedAt === "string" &&
    Number.isFinite(Date.parse(draft.savedAt))
  );
}

export function loadPromptDraft(
  projectId: string,
  cardId: string,
  basePrompt: string,
  storage?: StorageLike,
): PromptDraft | null {
  try {
    if (!isPromptText(basePrompt)) return null;
    const raw = getStorage(storage).getItem(promptKey(projectId, cardId));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!isStoredPromptDraft(value, projectId, cardId, basePrompt)) return null;
    return { prompt: value.prompt, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function savePromptDraft(
  projectId: string,
  cardId: string,
  basePrompt: string,
  prompt: string,
  storage?: StorageLike,
): DraftResult {
  try {
    if (!projectId || !cardId || !isPromptText(basePrompt) || !isPromptText(prompt))
      throw new Error("invalid prompt draft");
    const savedAt = new Date().toISOString();
    const draft: StoredPromptDraft = {
      version: 1,
      projectId,
      cardId,
      basePrompt,
      prompt,
      savedAt,
    };
    getStorage(storage).setItem(promptKey(projectId, cardId), JSON.stringify(draft));
    return { ok: true, savedAt };
  } catch {
    return {
      ok: false,
      message:
        "요청문 초안을 임시 저장하지 못했어요. 브라우저 저장 공간이나 권한을 확인해 주세요.",
    };
  }
}

export function removePromptDraft(
  projectId: string,
  cardId: string,
  storage?: StorageLike,
) {
  try {
    getStorage(storage).removeItem(promptKey(projectId, cardId));
    return true;
  } catch {
    return false;
  }
}

export function hasPromptDraft(
  projectId: string,
  cardId: string,
  basePrompt: string,
  storage?: StorageLike,
) {
  return !!loadPromptDraft(projectId, cardId, basePrompt, storage);
}

export function removeProjectPromptDrafts(
  projectId: string,
  storage?: StorageLike,
) {
  removeDraftsWithPrefix(promptProjectPrefix(projectId), storage);
}

export function removeAllPromptDrafts(storage?: StorageLike) {
  removeDraftsWithPrefix(PROMPT_DRAFT_PREFIX, storage);
}

function removeDraftsWithPrefix(prefix: string, storage?: StorageLike) {
  try {
    const target = getStorage(storage);
    const keys: string[] = [];
    for (let index = 0; index < target.length; index += 1) {
      const storageKey = target.key(index);
      if (storageKey?.startsWith(prefix)) keys.push(storageKey);
    }
    keys.forEach((storageKey) => target.removeItem(storageKey));
  } catch {
    // Draft cleanup must never block confirmed data replacement or deletion.
  }
}
