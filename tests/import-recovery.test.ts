import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  IMPORT_RECOVERY_KEY,
  loadImportRecovery,
  removeImportRecovery,
  saveImportRecovery,
} from "../src/lib/import-recovery";
import type { AppData } from "../src/lib/model";

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
  } as Storage;
}

const stamp = "2026-10-17T00:00:00.000Z";
const data: AppData = {
  version: 1,
  projects: [
    {
      id: "project-before-import",
      name: "가져오기 전 프로젝트",
      description: "자동 복구할 데이터",
      createdAt: stamp,
      updatedAt: stamp,
      cards: [
        {
          id: "card-before-import",
          title: "보존할 작업",
          description: "",
          requirements: "",
          acceptance: "",
          status: "doing",
          createdAt: stamp,
          updatedAt: stamp,
          note: { done: "기존 데이터", blocked: "", next: "복구", updatedAt: stamp },
        },
      ],
    },
  ],
};

test("가져오기 전 데이터를 저장하고 검증해 다시 불러온다", () => {
  const storage = memoryStorage();
  const saved = saveImportRecovery(data, storage, stamp);
  assert.equal(saved.ok, true);
  assert.deepEqual(loadImportRecovery(storage), { savedAt: stamp, data });
  assert.equal(removeImportRecovery(storage), true);
  assert.equal(loadImportRecovery(storage), null);
});

test("손상되거나 지원하지 않는 복구 지점은 사용하지 않는다", () => {
  const storage = memoryStorage();
  for (const value of [
    "not-json",
    JSON.stringify({ version: 2, savedAt: stamp, data }),
    JSON.stringify({ version: 1, savedAt: "not-a-date", data }),
    JSON.stringify({ version: 1, savedAt: "0", data }),
    JSON.stringify({ version: 1, savedAt: stamp, data: { version: 2 } }),
  ]) {
    storage.setItem(IMPORT_RECOVERY_KEY, value);
    assert.equal(loadImportRecovery(storage), null);
  }
});

test("복구 지점을 저장할 수 없으면 실패를 알리고 가져오기 근거를 만들지 않는다", () => {
  const storage = memoryStorage();
  const blocked = {
    getItem: storage.getItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),
    setItem() {
      throw new DOMException("full", "QuotaExceededError");
    },
  };
  const result = saveImportRecovery(data, blocked, stamp);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /가져오기를 중단/);
  assert.equal(loadImportRecovery(storage), null);
});
