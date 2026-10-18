import { test, expect, type Page } from "@playwright/test";

function projectData(name: string) {
  return {
    version: 1,
    projects: [
      {
        id: name,
        name,
        description: "백업 보존 확인",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-18T00:00:00.000Z",
        cards: [],
      },
    ],
  };
}

async function importProject(page: Page, name: string) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByLabel("JSON 백업 파일", { exact: true }).setInputFiles({
    name: "next.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(projectData(name))),
  });
}

async function blockWrites(page: Page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "with-ai:data:v1")
        throw new DOMException("full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
}

test("백업 본문 저장 실패 시 현재 데이터와 이전 복구본을 모두 유지한다", async ({
  page,
}) => {
  const current = projectData("현재 프로젝트");
  const previous = {
    version: 1,
    savedAt: "2026-10-17T00:00:00.000Z",
    data: projectData("이전 복구 프로젝트"),
  };
  await page.goto("/");
  await page.evaluate(
    ({ current, previous }) => {
      localStorage.setItem("with-ai:data:v1", JSON.stringify(current));
      localStorage.setItem(
        "with-ai:import-recovery:v1",
        JSON.stringify(previous),
      );
    },
    { current, previous },
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "현재 프로젝트",
  );
  await importProject(page, "가져올 프로젝트");
  await blockWrites(page);
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(page.getByRole("alert", { name: "작업 알림" })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "백업 데이터로 교체할까요?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("with-ai:data:v1")),
  ).toBe(JSON.stringify(current));
  expect(
    await page.evaluate(() =>
      localStorage.getItem("with-ai:import-recovery:v1"),
    ),
  ).toBe(JSON.stringify(previous));
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "이전 복구 프로젝트",
  );
});

test("연속 가져오기 실패·재시도와 복구 실패에서 확정 데이터·복구본·백업 호환성을 유지한다", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("with-ai:data:v1", JSON.stringify(data)),
    projectData("첫 프로젝트"),
  );
  await page.reload();
  await importProject(page, "둘째 프로젝트");
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "둘째 프로젝트",
  );
  const before = await page.evaluate(() =>
    localStorage.getItem("with-ai:data:v1"),
  );
  expect(JSON.parse(before!).importRecovery.data).toEqual(
    projectData("첫 프로젝트"),
  );
  await importProject(page, "셋째 프로젝트");
  await blockWrites(page);
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "이전 복구본은 유지돼요",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("with-ai:data:v1")),
  ).toBe(before);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await importProject(page, "셋째 프로젝트");
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "셋째 프로젝트",
  );
  const after = await page.evaluate(() =>
    localStorage.getItem("with-ai:data:v1"),
  );
  expect(JSON.parse(after!).importRecovery.data).toEqual(
    projectData("둘째 프로젝트"),
  );
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /JSON 내보내기/ }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(
    projectData("셋째 프로젝트"),
  );
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await blockWrites(page);
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "저장하지 못했어요",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("with-ai:data:v1")),
  ).toBe(after);
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "둘째 프로젝트",
  );
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator(".import-recovery")).toHaveCount(0);
});

test("다른 탭에서 가져오면 복구 목록이 갱신되고 오래된 복구 확인은 거절한다", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("with-ai:data:v1", JSON.stringify(data)),
    projectData("첫 프로젝트"),
  );
  await page.reload();
  await importProject(page, "둘째 프로젝트");
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "설정", exact: true }).click();
  await other
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await importProject(page, "셋째 프로젝트");
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(other.getByRole("heading", { level: 1 })).toHaveText(
    "셋째 프로젝트",
  );
  await other
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await expect(other.getByRole("alert", { name: "작업 알림" })).toContainText(
    "복구 지점이 바뀌었어요",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "셋째 프로젝트",
  );
  await other.getByRole("button", { name: "취소", exact: true }).click();
  await other
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await other
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "둘째 프로젝트",
  );
});
