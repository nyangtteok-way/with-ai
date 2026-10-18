import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  IMPORT_RECOVERY_KEY,
  createImportRecovery,
  loadImportRecovery,
  removeLegacyImportRecovery,
  serializeStoredData,
} from "../src/lib/import-recovery";
import { parseBackup, type AppData } from "../src/lib/model";

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
          note: {
            done: "기존 데이터",
            blocked: "",
            next: "복구",
            updatedAt: stamp,
          },
        },
      ],
    },
  ],
};

test("복구본과 현재 데이터를 함께 직렬화하고 v1 백업에는 내부 복구본을 포함하지 않는다", () => {
  const recovery = createImportRecovery(data, stamp);
  const raw = serializeStoredData({ version: 1, projects: [] }, recovery);
  assert.deepEqual(loadImportRecovery(raw), { savedAt: stamp, data });
  assert.deepEqual(parseBackup(raw), { version: 1, projects: [] });
  assert.deepEqual(
    createImportRecovery(
      JSON.parse(serializeStoredData(data, recovery)),
      stamp,
    ),
    { savedAt: stamp, data },
  );
});

test("이전 별도 키의 복구본은 기존 데이터 및 손상 데이터에서도 읽을 수 있다", () => {
  const storage = memoryStorage();
  storage.setItem(
    IMPORT_RECOVERY_KEY,
    JSON.stringify({ version: 1, savedAt: stamp, data }),
  );
  for (const raw of [null, JSON.stringify(data), "broken-json"]) {
    assert.deepEqual(loadImportRecovery(raw, storage), {
      savedAt: stamp,
      data,
    });
  }
  assert.equal(removeLegacyImportRecovery(storage), true);
  assert.equal(loadImportRecovery(null, storage), null);
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
    assert.equal(loadImportRecovery(null, storage), null);
    assert.equal(
      loadImportRecovery(
        JSON.stringify({
          ...data,
          importRecovery: value === "not-json" ? value : JSON.parse(value),
        }),
        storage,
      ),
      null,
    );
  }
  storage.setItem(
    IMPORT_RECOVERY_KEY,
    JSON.stringify({ version: 1, savedAt: stamp, data }),
  );
  assert.equal(
    loadImportRecovery(serializeStoredData(data, null), storage),
    null,
  );
  assert.equal(
    loadImportRecovery(
      JSON.stringify({ ...data, importRecovery: {} }),
      storage,
    ),
    null,
  );
});

test("잘못된 복구본 생성은 거절하고 저장소 읽기·정리 오류는 처리한다", () => {
  assert.throws(() => createImportRecovery(data, "invalid"));
  assert.throws(() =>
    createImportRecovery({ version: 2 } as unknown as AppData),
  );
  const blocked = {
    getItem() {
      throw new DOMException("denied", "SecurityError");
    },
    removeItem() {
      throw new DOMException("denied", "SecurityError");
    },
    setItem() {
      throw new DOMException("denied", "SecurityError");
    },
  };
  assert.equal(loadImportRecovery(null, blocked), null);
  assert.equal(removeLegacyImportRecovery(blocked), false);
});
