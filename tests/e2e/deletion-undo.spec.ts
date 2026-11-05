import { expect, test, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "첫 프로젝트 만들기", exact: true })
    .click();
  await page.getByLabel("프로젝트 이름").fill("삭제 보호 프로젝트");
  await page.getByLabel("프로젝트 설명").fill("실수로 지운 데이터 복구");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "프로젝트 만들기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "작업 카드 추가", exact: true })
    .click();
  await page.getByLabel("작업 제목").fill("되돌릴 작업");
  await page.getByLabel("작업 상태", { exact: true }).selectOption("doing");
  await page.getByRole("button", { name: "카드 만들기", exact: true }).click();
  await page.locator(".task-card").click();
  await page.getByLabel("한 일", { exact: true }).fill("복구할 진행 메모");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await page
    .getByRole("button", { name: "중요 작업으로 표시", exact: true })
    .click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
}

test("삭제한 카드와 프로젝트의 저장 데이터를 직후 되돌린다", async ({
  page,
}) => {
  await seed(page);
  const beforeCardDelete = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("with-ai:data:v1")!);
    return data.projects[0].cards[0];
  });

  await page.locator(".task-card").click();
  await page.getByRole("button", { name: "카드 삭제", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "작업 카드를 삭제할까요?" }),
  ).toContainText("삭제 직후 알림");
  await page.getByRole("button", { name: "카드 삭제", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(0);

  const undo = page.getByRole("button", { name: "되돌리기", exact: true });
  await expect(undo).toBeVisible();
  await expect(undo).toBeFocused();
  await expect(page.locator(".toast")).toHaveAttribute("aria-atomic", "true");
  expect((await undo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("with-ai:deletion-undo:v1"),
    ),
  ).not.toBeNull();
  await page.reload();
  await expect(undo).toBeVisible();
  await expect(undo).not.toBeFocused();
  await expect(page.locator(".toast")).toContainText("새로고침 전에 삭제한");
  await undo.click();
  await expect(
    page.getByRole("heading", { name: "되돌릴 작업", exact: true }),
  ).toBeVisible();
  const afterCardUndo = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("with-ai:data:v1")!);
    return data.projects[0].cards[0];
  });
  expect(afterCardUndo).toEqual(beforeCardDelete);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("with-ai:deletion-undo:v1"),
    ),
  ).toBeNull();

  await page.locator(".task-card").click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "복구할 진행 메모",
  );
  await expect(
    page.getByRole("button", { name: "중요 작업 해제", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  const beforeProjectDelete = await page.evaluate(() =>
    localStorage.getItem("with-ai:data:v1"),
  );
  await page
    .getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "프로젝트 삭제", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "프로젝트를 삭제할까요?" }),
  ).toContainText("작성 중 초안은 되돌아오지 않아요.");
  await page
    .getByRole("button", { name: "프로젝트 삭제", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "첫 프로젝트 만들기", exact: true }),
  ).toBeVisible();
  await expect(undo).toBeFocused();

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(undo).toBeVisible();
    const box = (await page.locator(".toast").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
  await page.reload();
  await expect(undo).toBeVisible();
  await expect(undo).not.toBeFocused();
  await expect(page.locator(".toast")).toContainText("새로고침 전에 삭제한");
  await undo.click();
  await expect(
    page.getByRole("heading", { name: "삭제 보호 프로젝트", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("with-ai:data:v1")),
  ).toBe(beforeProjectDelete);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "삭제 보호 프로젝트", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "되돌릴 작업", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
