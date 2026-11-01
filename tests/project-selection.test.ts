import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  ACTIVE_PROJECT_KEY,
  resolveActiveProjectId,
  saveActiveProjectId,
} from "../src/lib/project-selection";

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

const projects = [{ id: "first" }, { id: "second" }];

test("마지막 프로젝트 선택을 저장하고 존재하는 프로젝트에서만 적용한다", () => {
  const storage = memoryStorage();

  assert.equal(saveActiveProjectId("second", storage), true);
  assert.equal(storage.getItem(ACTIVE_PROJECT_KEY), "second");
  assert.equal(resolveActiveProjectId(projects, "second"), "second");
  assert.equal(resolveActiveProjectId([{ id: "first" }], "second"), null);

  saveActiveProjectId("first", storage);
  assert.equal(saveActiveProjectId(null, storage), true);
  assert.equal(storage.getItem(ACTIVE_PROJECT_KEY), null);
});

test("프로젝트 선택 저장소 오류는 현재 화면 사용을 막지 않는다", () => {
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

  assert.equal(saveActiveProjectId("second", unavailable), false);
  assert.equal(saveActiveProjectId(null, unavailable), false);
});
