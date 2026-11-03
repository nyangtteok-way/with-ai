import {
  MAX_CARDS,
  MAX_PROJECTS,
  type AppData,
  type Card,
  type Project,
} from "./model";

export type DeletionUndo =
  | { kind: "project"; project: Project; index: number }
  | { kind: "card"; projectId: string; card: Card; index: number };

type RestoreDeletionResult =
  | { ok: true; data: AppData; projectId: string }
  | { ok: false; message: string };

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
