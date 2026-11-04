import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  DELETION_UNDO_KEY,
  loadDeletionUndo,
  removeDeletionUndo,
  restoreDeletion,
  saveDeletionUndo,
  type DeletionUndo,
} from "../src/lib/deletion-undo";
import { MAX_PROJECTS, type AppData, type Card, type Project } from "../src/lib/model";

const stamp = "2026-11-03T23:00:00.000Z";
const restoredAt = "2026-11-03T23:30:00.000Z";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

function card(id: string, title: string): Card {
  return {
    id,
    title,
    description: `${title} 설명`,
    requirements: "저장한 내용 유지",
    acceptance: "삭제 취소 확인",
    status: "doing",
    important: true,
    createdAt: stamp,
    updatedAt: stamp,
    note: {
      done: "구현",
      blocked: "",
      next: "검증",
      updatedAt: stamp,
    },
    noteHistory: [
      { done: "설계", blocked: "", next: "구현", updatedAt: stamp },
    ],
  };
}

function project(id: string, name: string, cards: Card[] = []): Project {
  return {
    id,
    name,
    description: `${name} 설명`,
    createdAt: stamp,
    updatedAt: stamp,
    cards,
  };
}

test("삭제한 프로젝트를 원래 위치에 내용과 메모 이력 그대로 복원한다", () => {
  const removed = project("removed", "되돌릴 프로젝트", [
    card("removed-card", "되돌릴 카드"),
  ]);
  const current: AppData = {
    version: 1,
    projects: [project("first", "첫 프로젝트"), project("last", "마지막 프로젝트")],
  };
  const undo: DeletionUndo = { kind: "project", project: removed, index: 1 };
  const result = restoreDeletion(current, undo, restoredAt);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.data.projects.map((item) => item.id),
    ["first", "removed", "last"],
  );
  assert.deepEqual(result.data.projects[1], removed);
  assert.notEqual(result.data.projects[1], removed);
  assert.notEqual(result.data.projects[1].cards[0].note, removed.cards[0].note);
  assert.equal(result.projectId, "removed");
});

test("삭제한 카드를 원래 위치에 복원하고 대상 프로젝트 수정 시각만 갱신한다", () => {
  const removed = card("removed-card", "되돌릴 카드");
  const current: AppData = {
    version: 1,
    projects: [
      project("target", "대상", [
        card("first-card", "첫 카드"),
        card("last-card", "마지막 카드"),
      ]),
    ],
  };
  const result = restoreDeletion(
    current,
    { kind: "card", projectId: "target", card: removed, index: 1 },
    restoredAt,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.data.projects[0].cards.map((item) => item.id),
    ["first-card", "removed-card", "last-card"],
  );
  assert.deepEqual(result.data.projects[0].cards[1], removed);
  assert.equal(result.data.projects[0].updatedAt, restoredAt);
  assert.equal(result.projectId, "target");
});

test("대상이 사라졌거나 식별자가 겹치거나 프로젝트 한도를 넘으면 복원을 거절한다", () => {
  const removedCard = card("removed-card", "되돌릴 카드");
  const missing = restoreDeletion(
    { version: 1, projects: [] },
    { kind: "card", projectId: "missing", card: removedCard, index: 0 },
    restoredAt,
  );
  assert.equal(missing.ok, false);

  const conflict = restoreDeletion(
    { version: 1, projects: [project("current", "현재", [removedCard])] },
    {
      kind: "project",
      project: project("removed", "복구", [removedCard]),
      index: 0,
    },
    restoredAt,
  );
  assert.equal(conflict.ok, false);

  const full: AppData = {
    version: 1,
    projects: Array.from({ length: MAX_PROJECTS }, (_, index) =>
      project(`project-${index}`, `프로젝트 ${index}`),
    ),
  };
  const limited = restoreDeletion(
    full,
    { kind: "project", project: project("extra", "추가"), index: 0 },
    restoredAt,
  );
  assert.equal(limited.ok, false);
});

test("최근 삭제 1건을 탭 임시 저장소에서 검증해 다시 읽고 명시적으로 정리한다", () => {
  const storage = memoryStorage();
  const undo: DeletionUndo = {
    kind: "project",
    project: project("removed", "되돌릴 프로젝트", [
      card("removed-card", "되돌릴 카드"),
    ]),
    index: 2,
  };

  assert.equal(saveDeletionUndo(undo, storage, restoredAt), true);
  assert.ok(storage.getItem(DELETION_UNDO_KEY));
  assert.deepEqual(loadDeletionUndo(storage), undo);
  assert.equal(removeDeletionUndo(storage), true);
  assert.equal(loadDeletionUndo(storage), null);
});

test("손상되거나 저장할 수 없는 삭제 임시 값은 복구 데이터로 사용하지 않는다", () => {
  const storage = memoryStorage();
  storage.setItem(
    DELETION_UNDO_KEY,
    JSON.stringify({
      version: 1,
      savedAt: restoredAt,
      undo: {
        kind: "card",
        projectId: "target",
        card: { id: "broken" },
        index: 0,
      },
    }),
  );
  assert.equal(loadDeletionUndo(storage), null);
  assert.equal(storage.getItem(DELETION_UNDO_KEY), null);

  const unavailable = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const undo: DeletionUndo = {
    kind: "card",
    projectId: "target",
    card: card("removed-card", "되돌릴 카드"),
    index: 0,
  };
  assert.equal(saveDeletionUndo(undo, unavailable, restoredAt), false);
  assert.equal(loadDeletionUndo(unavailable), null);
  assert.equal(removeDeletionUndo(unavailable), false);
});
