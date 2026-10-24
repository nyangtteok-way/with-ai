import { expect, test } from "@playwright/test";

test("모바일 홈 화면 설치용 매니페스트와 아이콘을 제공한다", async ({
  context,
  page,
  request,
}) => {
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
});
