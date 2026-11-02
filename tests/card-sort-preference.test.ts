import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CARD_SORT_KEY,
  parseCardSort,
  saveCardSort,
} from "../src/lib/card-sort-preference";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

test("카드 정렬 선택을 별도 화면 설정에 저장하고 허용된 값만 복원한다", () => {
  const storage = memoryStorage();

  assert.equal(saveCardSort("important", storage), true);
  assert.equal(storage.getItem(CARD_SORT_KEY), "important");
  assert.equal(parseCardSort(storage.getItem(CARD_SORT_KEY)), "important");
  assert.equal(parseCardSort("recent"), "recent");
  assert.equal(parseCardSort("unknown"), "default");
  assert.equal(parseCardSort(null), "default");
});

test("정렬 설정 저장소 오류는 현재 화면 사용을 막지 않는다", () => {
  const unavailable = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(saveCardSort("recent", unavailable), false);
});
