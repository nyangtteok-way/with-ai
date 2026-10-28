import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/sw.js/route";
import {
  APP_SHELL_CACHE_NAME,
  APP_SHELL_CACHE_PREFIX,
  SERVICE_WORKER_SOURCE,
} from "../src/lib/service-worker-source";
import {
  APP_SHELL_FINGERPRINT_PATH,
  APP_SHELL_FIXED_ASSETS,
  APP_SHELL_UPDATED_MESSAGE,
  createAppShellFingerprint,
} from "../src/lib/service-worker-contract";

test("서비스 워커는 캐시되지 않는 안전한 자바스크립트 응답으로 제공된다", async () => {
  const response = GET();

  assert.equal(
    response.headers.get("content-type"),
    "application/javascript; charset=utf-8",
  );
  assert.equal(
    response.headers.get("cache-control"),
    "no-cache, no-store, must-revalidate",
  );
  assert.equal(
    response.headers.get("content-security-policy"),
    "default-src 'self'; script-src 'self'",
  );
  assert.equal(response.headers.get("service-worker-allowed"), "/");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), SERVICE_WORKER_SOURCE);
  assert.doesNotThrow(() => new Function(SERVICE_WORKER_SOURCE));
});

test("앱 셸 캐시는 사용자 데이터 대신 같은 출처의 읽기 전용 파일만 다룬다", () => {
  assert.match(SERVICE_WORKER_SOURCE, new RegExp(APP_SHELL_CACHE_NAME));
  assert.match(SERVICE_WORKER_SOURCE, new RegExp(APP_SHELL_CACHE_PREFIX));
  assert.match(SERVICE_WORKER_SOURCE, /request\.method !== "GET"/);
  assert.match(SERVICE_WORKER_SOURCE, /url\.origin !== self\.location\.origin/);
  assert.match(SERVICE_WORKER_SOURCE, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.doesNotMatch(SERVICE_WORKER_SOURCE, /with-ai:data:v1/);
  assert.doesNotMatch(SERVICE_WORKER_SOURCE, /localStorage/);
});

test("앱 셸 지문은 순서와 중복에 흔들리지 않고 준비 완료 뒤에만 전달된다", () => {
  assert.equal(
    createAppShellFingerprint(["/b.js", "/a.css", "/b.js"]),
    JSON.stringify(["/a.css", "/b.js"]),
  );
  assert.match(SERVICE_WORKER_SOURCE, new RegExp(APP_SHELL_FINGERPRINT_PATH));
  assert.match(SERVICE_WORKER_SOURCE, new RegExp(APP_SHELL_UPDATED_MESSAGE));
  assert.match(SERVICE_WORKER_SOURCE, /clients\.matchAll/);
  assert.match(SERVICE_WORKER_SOURCE, /client\.postMessage/);
  for (const asset of APP_SHELL_FIXED_ASSETS) {
    assert.match(SERVICE_WORKER_SOURCE, new RegExp(asset.replaceAll(".", "\\.")));
  }
});
