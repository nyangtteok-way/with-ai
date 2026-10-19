import { test, expect, type Page, type Download } from "@playwright/test";
import { parseBackup, type AppData } from "../../src/lib/model";

const stamp = "2026-10-18T23:57:00.000Z";
function projectData(name: string): AppData {
  return {
    version: 1,
    projects: [
      {
        id: name,
        name,
        description: `${name} 설명`,
        createdAt: stamp,
        updatedAt: stamp,
        cards: [
          {
            id: `${name}-card`,
            title: `${name} 작업`,
            description: "작업 설명",
            requirements: "모바일에서 이전 데이터를 보관",
            acceptance: "현재 데이터를 바꾸지 않음",
            status: "doing",
            createdAt: stamp,
            updatedAt: stamp,
            note: {
              done: "기획 완료",
              blocked: "확인 중",
              next: "구현",
              updatedAt: stamp,
            },
          },
        ],
      },
    ],
  };
}
const current = projectData("현재 프로젝트");
const previous = projectData("교체 전 프로젝트");
const recovery = { version: 1, savedAt: stamp, data: previous };

async function seed(page: Page, legacy = false) {
  await page.goto("/");
  await page.evaluate(
    ({ current, recovery, legacy }) => {
      localStorage.setItem(
        "with-ai:data:v1",
        legacy
          ? "broken-json"
          : JSON.stringify({ ...current, importRecovery: recovery }),
      );
      if (legacy)
        localStorage.setItem(
          "with-ai:import-recovery:v1",
          JSON.stringify(recovery),
        );
    },
    { current, recovery, legacy },
  );
  await page.reload();
}
async function storedValues(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
}
async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
async function exportRecovery(page: Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "복구본 JSON 내보내기", exact: true })
    .click();
  return pending;
}

test("복구본을 v1 JSON으로 내보내고 현재 데이터·초안·복구본을 보존한다", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "작업 카드 추가", exact: true })
    .click();
  await page.getByLabel("작업 제목").fill("계속 작성할 초안");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "작성 중 카드 계속", exact: true }),
  ).toBeVisible();
  const before = await storedValues(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const button = page.getByRole("button", {
    name: "복구본 JSON 내보내기",
    exact: true,
  });
  await expect(button).toHaveAccessibleDescription(
    /현재 데이터·초안·복구본을 바꾸지 않아요/,
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await button.scrollIntoViewIfNeeded();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const download = await exportRecovery(page);
  expect(download.suggestedFilename()).toBe(
    "with-ai-recovery-2026-10-18T23-57-00-000Z.json",
  );
  const text = await readDownload(download);
  expect(JSON.parse(text)).toEqual(previous);
  expect(parseBackup(text)).toEqual(previous);
  expect(await storedValues(page)).toEqual(before);
  await expect(page.locator(".import-recovery")).toBeVisible();
  await expect(page.getByRole("status", { name: "작업 알림" })).toContainText(
    "파일이 저장됐는지 확인",
  );

  const currentDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /^JSON 내보내기/ }).click();
  expect(JSON.parse(await readDownload(await currentDownload))).toEqual(
    current,
  );
  expect(await storedValues(page)).toEqual(before);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page
    .getByRole("button", { name: "작성 중 카드 계속", exact: true })
    .click();
  await expect(page.getByLabel("작업 제목")).toHaveValue("계속 작성할 초안");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  const beforeImport = await storedValues(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByLabel("JSON 백업 파일", { exact: true }).setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(
    page.getByRole("dialog", { name: "백업 데이터로 교체할까요?" }),
  ).toContainText("프로젝트 1개 · 작업 카드 1개");
  expect(await storedValues(page)).toEqual(beforeImport);
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "교체 전 프로젝트",
  );
  expect(parseBackup((await storedValues(page))["with-ai:data:v1"]!)).toEqual(
    previous,
  );
});

test("본문이 손상되어도 정상인 이전 형식 복구본을 내보내고 손상 복구본은 숨긴다", async ({
  page,
}) => {
  await seed(page, true);
  const before = await storedValues(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^JSON 내보내기/ }),
  ).toBeDisabled();
  const download = await exportRecovery(page);
  expect(JSON.parse(await readDownload(download))).toEqual(previous);
  expect(await storedValues(page)).toEqual(before);
  await page.evaluate(() =>
    localStorage.setItem("with-ai:import-recovery:v1", '{"version":2}'),
  );
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "복구본 JSON 내보내기", exact: true }),
  ).toHaveCount(0);
});

test("내보내기 시작 실패를 알리고 데이터 보존과 재시도를 지원한다", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page);
  const before = await storedValues(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => {
      URL.createObjectURL = original;
      throw new Error("download unavailable");
    };
  });
  await page.getByRole("button", { name: /^JSON 내보내기/ }).click();
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "내보내기를 시작하지 못했어요",
  );
  expect(await storedValues(page)).toEqual(before);
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = original;
      throw new Error("download click unavailable");
    };
    const originalRevoke = URL.revokeObjectURL;
    (window as typeof window & { revokedUrls: number }).revokedUrls = 0;
    URL.revokeObjectURL = (url) => {
      (window as typeof window & { revokedUrls: number }).revokedUrls++;
      originalRevoke(url);
    };
  });
  await page
    .getByRole("button", { name: "복구본 JSON 내보내기", exact: true })
    .click();
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "데이터는 그대로 유지돼요",
  );
  await expect(page.getByRole("status", { name: "작업 알림" })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { revokedUrls: number }).revokedUrls,
      ),
    )
    .toBe(1);
  expect(await storedValues(page)).toEqual(before);
  expect(JSON.parse(await readDownload(await exportRecovery(page)))).toEqual(
    previous,
  );
  await expect(page.getByRole("status", { name: "작업 알림" })).toContainText(
    "다운로드를 요청했어요",
  );
  expect(await storedValues(page)).toEqual(before);
  expect(errors).toEqual([]);
});
