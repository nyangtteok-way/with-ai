import { strict as assert } from "node:assert";
import { test } from "node:test";
import { reconcileFields, sameFields } from "../src/lib/conflicts";

const base = {
  title: "기존 제목",
  description: "기존 설명",
  status: "todo",
};

test("다른 필드의 원격 변경은 현재 입력과 함께 병합한다", () => {
  const result = reconcileFields(
    base,
    { ...base, title: "현재 탭 제목" },
    { ...base, description: "다른 탭 설명", status: "doing" },
  );

  assert.deepEqual(result.fields, {
    title: "현재 탭 제목",
    description: "다른 탭 설명",
    status: "doing",
  });
  assert.deepEqual(result.remoteChangedKeys, ["description", "status"]);
  assert.deepEqual(result.conflictingKeys, []);
});

test("같은 필드를 서로 다르게 수정하면 현재 탭 입력을 보존하고 충돌을 알린다", () => {
  const result = reconcileFields(
    base,
    { ...base, title: "현재 탭 제목" },
    { ...base, title: "다른 탭 제목" },
  );

  assert.equal(result.fields.title, "현재 탭 제목");
  assert.deepEqual(result.remoteChangedKeys, ["title"]);
  assert.deepEqual(result.conflictingKeys, ["title"]);
});

test("두 탭이 같은 값으로 수정한 필드는 충돌로 처리하지 않는다", () => {
  const shared = { ...base, title: "같은 제목" };
  const result = reconcileFields(base, shared, shared);

  assert.deepEqual(result.fields, shared);
  assert.deepEqual(result.remoteChangedKeys, ["title"]);
  assert.deepEqual(result.conflictingKeys, []);
  assert.equal(sameFields(result.fields, shared), true);
  assert.equal(sameFields(result.fields, base), false);
});
