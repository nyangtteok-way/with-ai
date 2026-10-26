import { expect, test } from "@playwright/test";

test("모바일 홈 화면 설치용 매니페스트와 아이콘을 제공한다", async ({
  context,
  page,
  request,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()["content-type"]).toContain(
    "application/manifest+json",
  );

  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "with-ai — 프로젝트 계획과 AI 요청문",
    short_name: "with-ai",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f9fb",
    theme_color: "#242a35",
  });
  expect(manifest.icons).toEqual([
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
  ]);

  for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#242a35",
  );
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    "light",
  );
  await expect(
    page.locator('meta[name="mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-title"]'),
  ).toHaveAttribute("content", "with-ai");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-icon\.png/,
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    /icon\.svg/,
  );

  const iconSizes = await page.evaluate(async () => {
    const sources = [
      "/icon-192.png",
      "/icon-512.png",
      "/icon-maskable-512.png",
      "/apple-icon.png",
    ];
    return Promise.all(
      sources.map(
        (src) =>
          new Promise<{ src: string; width: number; height: number }>(
            (resolve, reject) => {
              const image = new Image();
              image.onload = () =>
                resolve({
                  src,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });
              image.onerror = () => reject(new Error(`${src} 아이콘 로드 실패`));
              image.src = src;
            },
          ),
      ),
    );
  });
  expect(iconSizes).toEqual([
    { src: "/icon-192.png", width: 192, height: 192 },
    { src: "/icon-512.png", width: 512, height: 512 },
    { src: "/icon-maskable-512.png", width: 512, height: 512 },
    { src: "/apple-icon.png", width: 180, height: 180 },
  ]);

  const client = await context.newCDPSession(page);
  const appManifest = await client.send("Page.getAppManifest");
  expect(appManifest.errors).toEqual([]);
  expect(JSON.parse(appManifest.data!)).toMatchObject({
    name: "with-ai — 프로젝트 계획과 AI 요청문",
    start_url: "/",
    display: "standalone",
  });

  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "브라우저 메뉴의 앱 설치/홈 화면에 추가",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("준비된 앱 셸과 기기 데이터를 네트워크 없이 다시 연다", async ({
  context,
  page,
  request,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.ok()).toBe(true);
  expect(workerResponse.headers()["content-type"]).toContain(
    "application/javascript",
  );
  expect(workerResponse.headers()["cache-control"]).toBe(
    "no-cache, no-store, must-revalidate",
  );
  expect(workerResponse.headers()["content-security-policy"]).toBe(
    "default-src 'self'; script-src 'self'",
  );
  expect(workerResponse.headers()["service-worker-allowed"]).toBe("/");
  expect(workerResponse.headers()["x-content-type-options"]).toBe("nosniff");

  await page.goto("/icon.svg");
  await page.evaluate(async () => {
    const oldCache = await caches.open("with-ai-app-shell-old");
    await oldCache.put("/old", new Response("old"));
  });

  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
      });
    }
  });

  const cacheState = await page.evaluate(async () => {
    const names = await caches.keys();
    const current = names.find((name) => name === "with-ai-app-shell-v1");
    const entries = current
      ? (await (await caches.open(current)).keys()).map((entry) => entry.url)
      : [];
    return { names, entries };
  });
  expect(cacheState.names).toContain("with-ai-app-shell-v1");
  expect(cacheState.names).not.toContain("with-ai-app-shell-old");
  expect(cacheState.entries).toContain("http://127.0.0.1:3000/");
  expect(
    cacheState.entries.some(
      (url) => url.includes("/_next/static/") && url.endsWith(".js"),
    ),
  ).toBe(true);
  expect(cacheState.entries.some((url) => url.includes("with-ai:data:v1"))).toBe(
    false,
  );

  await page.evaluate(async () => {
    const cache = await caches.open("with-ai-app-shell-v1");
    await cache.put(
      "/",
      new Response("<!doctype html><title>stale shell</title>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cache = await caches.open("with-ai-app-shell-v1");
        return (await (await cache.match("/"))!.text()).includes("stale shell");
      }),
    )
    .toBe(false);

  await page
    .getByRole("button", { name: "첫 프로젝트 만들기", exact: true })
    .click();
  await page.getByLabel("프로젝트 이름").fill("오프라인 계획");
  await page.getByLabel("프로젝트 설명").fill("연결이 없어도 이어서 확인");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "프로젝트 만들기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오프라인 계획", exact: true }),
  ).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "오프라인 계획", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("with-ai:data:v1")!).projects.some(
          (project: { name: string }) => project.name === "오프라인 계획",
        ),
      ),
    ).toBe(true);

    await page.goto("about:blank");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "오프라인 계획", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(runtimeErrors).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
});
