import { strict as assert } from "node:assert";
import { test } from "node:test";
import manifest from "../src/app/manifest";

test("PWA 매니페스트는 한국어 앱 이름과 설치용 아이콘을 제공한다", () => {
  assert.deepEqual(manifest(), {
    id: "/",
    name: "with-ai — 프로젝트 계획과 AI 요청문",
    short_name: "with-ai",
    description:
      "프로젝트 계획, 작업 카드와 진행 메모를 관리하고 AI 작업 요청문을 준비하세요.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f9fb",
    theme_color: "#242a35",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  });
});
