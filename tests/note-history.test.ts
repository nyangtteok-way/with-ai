import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  generatePrompt,
  parseBackup,
  updateCardNote,
  type AppData,
  type Card,
  type ProgressNote,
} from "../src/lib/model";
import {
  createImportRecovery,
  loadImportRecovery,
  serializeStoredData,
} from "../src/lib/import-recovery";

const stamp = "2026-10-19T23:37:00.000Z";
const later = "2026-10-20T00:00:00.000Z";
const original: Card = {
  id: "card",
  title: "작업",
  description: "",
  requirements: "",
  acceptance: "",
  status: "doing",
  createdAt: stamp,
  updatedAt: stamp,
  note: {
    done: "이전 한 일",
    blocked: "이전 막힘",
    next: "이전 계획",
    updatedAt: stamp,
  },
};
const next = { done: "새 한 일", blocked: "", next: "새 계획" };
function data(card: Card): AppData {
  return {
    version: 1,
    projects: [
      {
        id: "project",
        name: "프로젝트",
        description: "",
        createdAt: stamp,
        updatedAt: stamp,
        cards: [card],
      },
    ],
  };
}

test("변경된 메모는 이전 저장본을 최근 교체 순으로 보존하고 원본은 바꾸지 않는다", () => {
  const before = structuredClone(original);
  const first = updateCardNote(original, next, later);
  assert.deepEqual(first.noteHistory, [original.note]);
  assert.deepEqual(original, before);
  const second = updateCardNote(first, { ...next, done: "그다음" }, later);
  assert.deepEqual(second.noteHistory, [first.note, original.note]);
  assert.deepEqual(first.noteHistory, [original.note]);
});

test("같은 내용 재저장과 첫 입력은 가짜 이력을 만들지 않고 빈 메모로 변경해도 이전 값을 보존한다", () => {
  const blank: ProgressNote = {
    done: "",
    blocked: "",
    next: "",
    updatedAt: null,
  };
  const first = updateCardNote({ ...original, note: blank }, next, later);
  assert.equal(first.noteHistory, undefined);
  assert.equal(updateCardNote(first, next, later).noteHistory, undefined);
  const cleared = updateCardNote(first, blank, later);
  assert.deepEqual(cleared.noteHistory, [first.note]);
  assert.deepEqual(updateCardNote(cleared, blank, later).noteHistory, [
    first.note,
  ]);
  const withoutTime = { ...original.note, updatedAt: null };
  assert.deepEqual(
    updateCardNote({ ...original, note: withoutTime }, next, later).noteHistory,
    [withoutTime],
  );
});

test("기존 v1 백업과 이력이 있는 백업·복구본은 내용과 순서를 그대로 왕복한다", () => {
  assert.deepEqual(parseBackup(JSON.stringify(data(original))), data(original));
  const withHistory = data(updateCardNote(original, next, later));
  assert.deepEqual(parseBackup(JSON.stringify(withHistory)), withHistory);
  const recovery = createImportRecovery(withHistory, later);
  const serialized = serializeStoredData(data(original), recovery);
  assert.deepEqual(loadImportRecovery(serialized)?.data, withHistory);
  assert.deepEqual(parseBackup(serialized), data(original));
  const longHistory = data({
    ...original,
    noteHistory: Array.from({ length: 101 }, () => ({ ...original.note })),
  });
  assert.deepEqual(parseBackup(JSON.stringify(longHistory)), longHistory);
});

test("손상된 이력·메모 타입·날짜·길이를 조용히 버리지 않고 백업 전체를 거절한다", () => {
  for (const noteHistory of [
    null,
    {},
    [null],
    [{ ...original.note, done: 1 }],
    [{ ...original.note, updatedAt: "invalid" }],
    [{ ...original.note, next: "x".repeat(10001) }],
  ]) {
    const value = data({
      ...original,
      noteHistory: noteHistory as ProgressNote[],
    });
    assert.throws(() => parseBackup(JSON.stringify(value)));
  }
  const source = data({
    ...original,
    noteHistory: [{ ...original.note, extra: "ignored" } as ProgressNote],
  });
  assert.deepEqual(
    parseBackup(JSON.stringify(source)).projects[0].cards[0].noteHistory,
    [original.note],
  );
});

test("AI 요청문은 이전 이력을 삽입하지 않고 최신 저장 메모만 사용한다", () => {
  const card = updateCardNote(original, next, later);
  const prompt = generatePrompt(data(card).projects[0], card);
  assert.match(prompt, /새 한 일/);
  assert.match(prompt, /새 계획/);
  assert.doesNotMatch(prompt, /이전 한 일|이전 막힘|이전 계획/);
});
