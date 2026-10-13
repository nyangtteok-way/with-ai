import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CARD_FORM_DRAFT_PREFIX,
  PROGRESS_NOTE_DRAFT_PREFIX,
  hasCardFormDraft,
  hasProgressNoteDraft,
  loadCardFormDraft,
  loadProgressNoteDraft,
  removeAllCardFormDrafts,
  removeAllProgressNoteDrafts,
  removeCardFormDraft,
  removeProgressNoteDraft,
  removeProjectCardFormDrafts,
  removeProjectProgressNoteDrafts,
  saveCardFormDraft,
  saveProgressNoteDraft,
  type CardDraftFields,
} from "../src/lib/drafts";
import type { Card, Project } from "../src/lib/model";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
  } as Storage;
}

const stamp = "2026-10-12T00:00:00.000Z";
const note = { done: "화면 구현", blocked: "없음", next: "검증" };
const cardFields: CardDraftFields = {
  title: "임시 저장 테스트",
  description: "카드 설명",
  requirements: "모바일 복구",
  acceptance: "입력 유지",
  status: "doing",
};
const card = (id: string, updatedAt: string | null = null): Card => ({
  id,
  title: "임시 저장 테스트",
  description: "",
  requirements: "",
  acceptance: "",
  status: "doing",
  createdAt: stamp,
  updatedAt: stamp,
  note: { done: "", blocked: "", next: "", updatedAt },
});

test("새 카드와 수정 카드 초안은 프로젝트·카드·저장 기준에 맞게 복구된다", () => {
  const storage = memoryStorage();
  assert.equal(saveCardFormDraft("project-1", null, null, cardFields, storage).ok, true);
  assert.deepEqual(
    loadCardFormDraft("project-1", null, null, storage)?.fields,
    cardFields,
  );
  assert.equal(hasCardFormDraft("project-1", undefined, storage), true);
  assert.equal(loadCardFormDraft("project-2", null, null, storage), null);

  const changed = { ...cardFields, title: "수정 중인 제목" };
  assert.equal(
    saveCardFormDraft("project-1", "card-1", cardFields, changed, storage).ok,
    true,
  );
  assert.deepEqual(
    loadCardFormDraft("project-1", "card-1", cardFields, storage)?.fields,
    changed,
  );
  assert.equal(
    loadCardFormDraft(
      "project-1",
      "card-1",
      { ...cardFields, description: "다른 탭에서 변경" },
      storage,
    ),
    null,
  );
});

test("잘못된 작업 카드 초안과 저장소 오류를 복구 데이터로 사용하지 않는다", () => {
  const storage = memoryStorage();
  storage.setItem(`${CARD_FORM_DRAFT_PREFIX}project:new`, "not-json");
  assert.equal(loadCardFormDraft("project", null, null, storage), null);
  assert.equal(
    saveCardFormDraft(
      "project",
      null,
      null,
      { ...cardFields, title: "x".repeat(121) },
      storage,
    ).ok,
    false,
  );
  assert.equal(
    saveCardFormDraft(
      "project",
      null,
      null,
      { ...cardFields, status: "unknown" as CardDraftFields["status"] },
      storage,
    ).ok,
    false,
  );
  const blocked = {
    ...storage,
    setItem() {
      throw new DOMException("full", "QuotaExceededError");
    },
  } as Storage;
  assert.equal(
    saveCardFormDraft("project", null, null, cardFields, blocked).ok,
    false,
  );
});

test("작업 카드 초안을 카드·프로젝트·전체 범위로 정리한다", () => {
  const storage = memoryStorage();
  saveCardFormDraft("project-1", null, null, cardFields, storage);
  saveCardFormDraft("project-1", "card-1", cardFields, cardFields, storage);
  saveCardFormDraft("project-2", null, null, cardFields, storage);
  storage.setItem("unrelated", "keep");
  assert.equal(removeCardFormDraft("project-1", "card-1", storage), true);
  assert.equal(
    loadCardFormDraft("project-1", "card-1", cardFields, storage),
    null,
  );
  removeProjectCardFormDrafts("project-1", storage);
  assert.equal(loadCardFormDraft("project-1", null, null, storage), null);
  assert.ok(loadCardFormDraft("project-2", null, null, storage));
  removeAllCardFormDrafts(storage);
  assert.equal(loadCardFormDraft("project-2", null, null, storage), null);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("진행 메모 초안은 같은 카드와 저장 기준에서만 복구된다", () => {
  const storage = memoryStorage();
  const saved = saveProgressNoteDraft("card-1", null, note, storage);
  assert.equal(saved.ok, true);
  assert.deepEqual(loadProgressNoteDraft("card-1", null, storage)?.note, note);
  assert.equal(hasProgressNoteDraft(card("card-1"), storage), true);
  assert.equal(loadProgressNoteDraft("card-2", null, storage), null);
  assert.equal(loadProgressNoteDraft("card-1", stamp, storage), null);
});

test("잘못되거나 너무 긴 초안과 저장소 오류는 기존 데이터로 취급하지 않는다", () => {
  const storage = memoryStorage();
  storage.setItem(`${PROGRESS_NOTE_DRAFT_PREFIX}broken`, "not-json");
  assert.equal(loadProgressNoteDraft("broken", null, storage), null);
  assert.equal(
    saveProgressNoteDraft(
      "too-long",
      null,
      { ...note, done: "x".repeat(10001) },
      storage,
    ).ok,
    false,
  );
  const blocked = {
    ...storage,
    setItem() {
      throw new DOMException("full", "QuotaExceededError");
    },
  } as Storage;
  assert.equal(saveProgressNoteDraft("blocked", null, note, blocked).ok, false);
});

test("카드·프로젝트·전체 범위로 진행 메모 초안을 정리한다", () => {
  const storage = memoryStorage();
  const first = card("first");
  const second = card("second");
  const project: Project = {
    id: "project",
    name: "프로젝트",
    description: "",
    createdAt: stamp,
    updatedAt: stamp,
    cards: [first, second],
  };
  saveProgressNoteDraft(first.id, null, note, storage);
  saveProgressNoteDraft(second.id, null, note, storage);
  storage.setItem("unrelated", "keep");
  assert.equal(removeProgressNoteDraft(first.id, storage), true);
  assert.equal(hasProgressNoteDraft(first, storage), false);
  removeProjectProgressNoteDrafts(project, storage);
  assert.equal(hasProgressNoteDraft(second, storage), false);
  saveProgressNoteDraft(first.id, null, note, storage);
  removeAllProgressNoteDrafts(storage);
  assert.equal(hasProgressNoteDraft(first, storage), false);
  assert.equal(storage.getItem("unrelated"), "keep");
});
