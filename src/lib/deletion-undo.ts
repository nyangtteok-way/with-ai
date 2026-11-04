import {
  MAX_CARDS,
  MAX_PROJECTS,
  parseBackup,
  type AppData,
  type Card,
  type Project,
} from "./model";

export const DELETION_UNDO_KEY = "with-ai:deletion-undo:v1";

export type DeletionUndo =
  | { kind: "project"; project: Project; index: number }
  | { kind: "card"; projectId: string; card: Card; index: number };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface StoredDeletionUndo {
  version: 1;
  savedAt: string;
  undo: DeletionUndo;
}

type RestoreDeletionResult =
  | { ok: true; data: AppData; projectId: string }
  | { ok: false; message: string };

function getStorage(storage?: StorageLike): StorageLike {
  return storage ?? globalThis.sessionStorage;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validIndex(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function parseStoredDeletion(value: unknown): DeletionUndo | null {
  const stored = objectValue(value);
  const undo = objectValue(stored?.undo);
  if (stored?.version !== 1 || !validDate(stored.savedAt) || !undo) return null;

  if (undo.kind === "project") {
    if (!validIndex(undo.index, MAX_PROJECTS)) return null;
    const project = parseBackup(
      JSON.stringify({ version: 1, projects: [undo.project] }),
    ).projects[0];
    return project
      ? { kind: "project", project, index: undo.index }
      : null;
  }

  if (undo.kind === "card") {
    if (
      !validIndex(undo.index, MAX_CARDS) ||
      typeof undo.projectId !== "string"
    )
      return null;
    const card = objectValue(undo.card);
    if (!card) return null;
    const project = parseBackup(
      JSON.stringify({
        version: 1,
        projects: [
          {
            id: undo.projectId,
            name: "삭제 복원 대상",
            description: "",
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            cards: [card],
          },
        ],
      }),
    ).projects[0];
    return project?.cards[0]
      ? {
          kind: "card",
          projectId: project.id,
          card: project.cards[0],
          index: undo.index,
        }
      : null;
  }

  return null;
}

export function loadDeletionUndo(storage?: StorageLike): DeletionUndo | null {
  let target: StorageLike | null = null;
  try {
    target = getStorage(storage);
    const raw = target.getItem(DELETION_UNDO_KEY);
    if (raw === null) return null;
    const undo = parseStoredDeletion(JSON.parse(raw));
    if (undo) return undo;
  } catch {
    // 손상되거나 접근할 수 없는 임시 값은 복구 데이터로 사용하지 않는다.
  }
  try {
    target?.removeItem(DELETION_UNDO_KEY);
  } catch {
    // 저장소 접근이 막혀도 앱 본문 데이터는 계속 사용할 수 있다.
  }
  return null;
}

export function saveDeletionUndo(
  undo: DeletionUndo,
  storage?: StorageLike,
  savedAt = new Date().toISOString(),
) {
  try {
    if (!validDate(savedAt)) return false;
    const stored: StoredDeletionUndo = { version: 1, savedAt, undo };
    getStorage(storage).setItem(DELETION_UNDO_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function removeDeletionUndo(storage?: StorageLike) {
  try {
    getStorage(storage).removeItem(DELETION_UNDO_KEY);
    return true;
  } catch {
    return false;
  }
}

function cardCount(data: AppData) {
  return data.projects.reduce((count, project) => count + project.cards.length, 0);
}

function allIds(data: AppData) {
  return new Set(
    data.projects.flatMap((project) => [
      project.id,
      ...project.cards.map((card) => card.id),
    ]),
  );
}

function insertAt<T>(items: readonly T[], index: number, item: T) {
  const position = Math.min(Math.max(0, Math.trunc(index)), items.length);
  return [...items.slice(0, position), item, ...items.slice(position)];
}

function cloneCard(card: Card): Card {
  return {
    ...card,
    note: { ...card.note },
    ...(card.noteHistory
      ? { noteHistory: card.noteHistory.map((note) => ({ ...note })) }
      : {}),
  };
}

function cloneProject(project: Project): Project {
  return {
    ...project,
    cards: project.cards.map(cloneCard),
  };
}

export function restoreDeletion(
  data: AppData,
  undo: DeletionUndo,
  restoredAt: string,
): RestoreDeletionResult {
  const usedIds = allIds(data);
  if (undo.kind === "project") {
    if (data.projects.length >= MAX_PROJECTS)
      return {
        ok: false,
        message: `프로젝트는 최대 ${MAX_PROJECTS.toLocaleString("ko-KR")}개까지 저장할 수 있어 삭제를 되돌리지 못했어요.`,
      };
    if (cardCount(data) + undo.project.cards.length > MAX_CARDS)
      return {
        ok: false,
        message: `전체 작업 카드는 최대 ${MAX_CARDS.toLocaleString("ko-KR")}개까지 저장할 수 있어 삭제를 되돌리지 못했어요.`,
      };
    if (
      [undo.project.id, ...undo.project.cards.map((card) => card.id)].some(
        (id) => usedIds.has(id),
      )
    )
      return {
        ok: false,
        message: "같은 프로젝트나 카드가 이미 있어 삭제를 되돌리지 못했어요.",
      };

    const project = cloneProject(undo.project);
    return {
      ok: true,
      data: {
        ...data,
        projects: insertAt(data.projects, undo.index, project),
      },
      projectId: project.id,
    };
  }

  const projectIndex = data.projects.findIndex(
    (project) => project.id === undo.projectId,
  );
  if (projectIndex < 0)
    return {
      ok: false,
      message: "카드를 되돌릴 프로젝트가 없어 복구하지 못했어요.",
    };
  if (cardCount(data) >= MAX_CARDS)
    return {
      ok: false,
      message: `전체 작업 카드는 최대 ${MAX_CARDS.toLocaleString("ko-KR")}개까지 저장할 수 있어 삭제를 되돌리지 못했어요.`,
    };
  if (usedIds.has(undo.card.id))
    return {
      ok: false,
      message: "같은 카드가 이미 있어 삭제를 되돌리지 못했어요.",
    };

  const card = cloneCard(undo.card);
  return {
    ok: true,
    data: {
      ...data,
      projects: data.projects.map((project, index) =>
        index === projectIndex
          ? {
              ...project,
              updatedAt: restoredAt,
              cards: insertAt(project.cards, undo.index, card),
            }
          : project,
      ),
    },
    projectId: undo.projectId,
  };
}
