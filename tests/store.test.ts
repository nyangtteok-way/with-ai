import { strict as assert } from "node:assert";
import { test, type TestContext } from "node:test";
import { STORAGE_KEY, retryLoad, saveData } from "../src/lib/store";
import {
  IMPORT_RECOVERY_KEY,
  createImportRecovery,
  loadImportRecovery,
  serializeStoredData,
} from "../src/lib/import-recovery";
import { parseBackup, type AppData } from "../src/lib/model";

function projectData(name: string): AppData {
  return {
    version: 1,
    projects: [
      {
        id: name,
        name,
        description: "",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-18T00:00:00.000Z",
        cards: [],
      },
    ],
  };
}
const previous = projectData("이전 복구 데이터");
const current = projectData("현재 데이터");
const next = projectData("가져올 데이터");
const recovery = createImportRecovery(previous, "2026-10-17T00:00:00.000Z");
const legacyRaw = JSON.stringify({ version: 1, ...recovery });

function setup(t: TestContext, raw = JSON.stringify(current)) {
  const values = new Map([
    [STORAGE_KEY, raw],
    [IMPORT_RECOVERY_KEY, legacyRaw],
  ]);
  const controls = { failWrite: "", failRead: false, failRemove: false };
  const storage = {
    getItem(key: string) {
      if (controls.failRead) throw new DOMException("denied", "SecurityError");
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (controls.failWrite)
        throw new DOMException("blocked", controls.failWrite);
      values.set(key, value);
    },
    removeItem(key: string) {
      if (controls.failRemove)
        throw new DOMException("denied", "SecurityError");
      values.delete(key);
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  t.after(() => {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  retryLoad();
  return { storage, values, controls };
}

test("가져오기 실패는 기존 본문과 이전 복구본을 바꾸지 않으며 재시도는 함께 저장한다", (t) => {
  const { storage, controls } = setup(t);
  for (const error of ["QuotaExceededError", "SecurityError"]) {
    controls.failWrite = error;
    const result = saveData(next, { kind: "import" });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /이전 복구본은 유지/);
    assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(current));
    assert.equal(storage.getItem(IMPORT_RECOVERY_KEY), legacyRaw);
    retryLoad();
    assert.deepEqual(
      loadImportRecovery(storage.getItem(STORAGE_KEY), storage),
      recovery,
    );
  }
  controls.failWrite = "";
  assert.equal(saveData(next, { kind: "import" }).ok, true);
  const raw = storage.getItem(STORAGE_KEY)!;
  assert.deepEqual(parseBackup(raw), next);
  assert.deepEqual(loadImportRecovery(raw, storage)?.data, current);
  assert.equal(storage.getItem(IMPORT_RECOVERY_KEY), null);
});

test("전체 복구는 교체 직전 데이터를 새 복구 지점으로 맞바꾼다", (t) => {
  const { storage, controls } = setup(
    t,
    serializeStoredData(current, recovery),
  );
  assert.equal(saveData(next).ok, true);
  const before = storage.getItem(STORAGE_KEY)!;
  assert.deepEqual(loadImportRecovery(before, storage), recovery);
  controls.failWrite = "QuotaExceededError";
  assert.equal(saveData(current, { kind: "import" }).ok, false);
  assert.equal(saveData(previous, { kind: "restore", recovery }).ok, false);
  assert.equal(storage.getItem(STORAGE_KEY), before);
  controls.failWrite = "";
  assert.equal(saveData(previous, { kind: "restore", recovery }).ok, true);
  retryLoad();
  const stored = storage.getItem(STORAGE_KEY)!;
  assert.deepEqual(parseBackup(stored), previous);
  assert.deepEqual(loadImportRecovery(stored, storage)?.data, next);
  assert.notEqual(
    loadImportRecovery(stored, storage)?.savedAt,
    recovery.savedAt,
  );
});

test("프로젝트 선택 복구는 현재 데이터에 합치고 복구 지점은 그대로 유지한다", (t) => {
  const { storage } = setup(t, serializeStoredData(current, recovery));
  const merged: AppData = {
    version: 1,
    projects: [...current.projects, ...previous.projects],
  };

  assert.equal(
    saveData(merged, { kind: "restore-project", recovery }).ok,
    true,
  );
  const stored = storage.getItem(STORAGE_KEY)!;
  assert.deepEqual(parseBackup(stored), merged);
  assert.deepEqual(loadImportRecovery(stored, storage), recovery);
  assert.equal(storage.getItem(IMPORT_RECOVERY_KEY), null);
});

test("아직 읽지 않은 다른 탭 변경은 복구본을 만들기 전에 가져오기를 중단한다", (t) => {
  const { storage } = setup(t);
  const changed = serializeStoredData(projectData("다른 탭 변경"), recovery);
  storage.setItem(STORAGE_KEY, changed);
  const result = saveData(next, { kind: "import" });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /다른 탭/);
  assert.equal(storage.getItem(STORAGE_KEY), changed);
  assert.equal(storage.getItem(IMPORT_RECOVERY_KEY), legacyRaw);
});

test("확인 중 복구 지점이 바뀌면 오래된 복구 확인으로 덮어쓰지 않는다", (t) => {
  const { storage } = setup(t);
  const latest = createImportRecovery(next);
  storage.setItem(
    IMPORT_RECOVERY_KEY,
    JSON.stringify({ version: 1, ...latest }),
  );
  const result = saveData(previous, { kind: "restore", recovery });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /복구 지점이 바뀌었어요/);
  const partialResult = saveData(previous, {
    kind: "restore-project",
    recovery,
  });
  assert.equal(partialResult.ok, false);
  assert.match(
    partialResult.ok ? "" : partialResult.message,
    /복구 지점이 바뀌었어요/,
  );
  assert.deepEqual(parseBackup(storage.getItem(STORAGE_KEY)!), current);
  assert.deepEqual(
    loadImportRecovery(storage.getItem(STORAGE_KEY), storage),
    latest,
  );
});

test("기존 복구본 정리가 실패해도 전체 복구 뒤 새 복구 지점만 유지한다", (t) => {
  const { storage, controls } = setup(t);
  controls.failRemove = true;
  assert.equal(saveData(next).ok, true);
  assert.deepEqual(
    loadImportRecovery(storage.getItem(STORAGE_KEY), storage),
    recovery,
  );
  assert.equal(saveData(previous, { kind: "restore", recovery }).ok, true);
  assert.equal(storage.getItem(IMPORT_RECOVERY_KEY), legacyRaw);
  retryLoad();
  assert.deepEqual(
    loadImportRecovery(storage.getItem(STORAGE_KEY), storage)?.data,
    next,
  );
  assert.equal(saveData(current).ok, true);
  assert.deepEqual(
    loadImportRecovery(storage.getItem(STORAGE_KEY), storage)?.data,
    next,
  );
});

test("손상된 본문을 전체 복구할 때는 검증할 수 없는 현재 데이터를 보관하지 않는다", (t) => {
  const { storage } = setup(t, "broken-json");
  assert.equal(saveData(previous, { kind: "restore", recovery }).ok, true);
  const stored = storage.getItem(STORAGE_KEY)!;
  assert.deepEqual(parseBackup(stored), previous);
  assert.equal(loadImportRecovery(stored, storage), null);
});

test("손상된 본문을 백업으로 복구할 때 기존 복구본을 빈 데이터로 덮지 않는다", (t) => {
  const { storage } = setup(t, "broken-json");
  assert.equal(saveData(next).ok, false);
  assert.equal(storage.getItem(STORAGE_KEY), "broken-json");
  assert.equal(saveData(next, { kind: "import" }).ok, true);
  assert.deepEqual(parseBackup(storage.getItem(STORAGE_KEY)!), next);
  assert.deepEqual(
    loadImportRecovery(storage.getItem(STORAGE_KEY), storage),
    recovery,
  );
});

test("저장소 읽기 실패 시 기존 데이터와 복구본은 변경하지 않는다", (t) => {
  const { values, controls } = setup(t);
  controls.failRead = true;
  assert.equal(saveData(next, { kind: "import" }).ok, false);
  assert.equal(values.get(STORAGE_KEY), JSON.stringify(current));
  assert.equal(values.get(IMPORT_RECOVERY_KEY), legacyRaw);
});

test("복구본이 없던 첫 가져오기도 실패하면 가짜 복구 지점을 만들지 않는다", (t) => {
  const { storage, controls } = setup(t);
  storage.removeItem(IMPORT_RECOVERY_KEY);
  retryLoad();
  controls.failWrite = "QuotaExceededError";
  assert.equal(saveData(next, { kind: "import" }).ok, false);
  assert.equal(loadImportRecovery(storage.getItem(STORAGE_KEY), storage), null);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(current));
});
