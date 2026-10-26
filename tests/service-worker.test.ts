import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/sw.js/route";
import {
  APP_SHELL_CACHE_NAME,
  APP_SHELL_CACHE_PREFIX,
  SERVICE_WORKER_SOURCE,
} from "../src/lib/service-worker-source";

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
