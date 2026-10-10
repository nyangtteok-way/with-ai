import { test, expect, type Page } from "@playwright/test";

test("작성 중 닫기·취소·Esc 확인에서 입력을 유지하고 명시적으로 버린다", async ({ page }) => {
  await page.goto("/");
  const create = page.getByRole("button", { name: "첫 프로젝트 만들기", exact: true });
  await create.click();
  // Nothing changed: no confirmation is needed.
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await create.click();
  await page.getByLabel("프로젝트 이름").fill("보호할 아이디어");
  await page.getByLabel("프로젝트 설명").fill("아직 저장하지 않은 설명");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "계속 작성" })).toBeFocused();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await confirm.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await expect(page.getByLabel("프로젝트 이름")).toHaveValue("보호할 아이디어");
  await expect(page.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(page.getByLabel("프로젝트 설명")).toHaveValue("아직 저장하지 않은 설명");
  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "버리고 이동" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(create).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(await page.evaluate(() => localStorage.getItem("with-ai:data:v1"))).toBeNull();
});

async function seedProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "첫 프로젝트 만들기", exact: true }).click();
  await page.getByLabel("프로젝트 이름").fill("편집 보호");
  await page.getByRole("dialog").getByRole("button", { name: "프로젝트 만들기", exact: true }).click();
  await page.getByRole("button", { name: "작업 카드 추가", exact: true }).click();
  await page.getByLabel("작업 제목").fill("저장된 카드");
  await page.getByRole("button", { name: "카드 만들기", exact: true }).click();
}

test("프로젝트 삭제 전환과 새 카드·카드 수정에서 변경을 보호하고 되돌린 값은 바로 닫는다", async ({ page }) => {
  await seedProject(page);
  const stored = await page.evaluate(() => localStorage.getItem("with-ai:data:v1"));
  const confirm = page.getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" });
  await page.getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true }).click();
  await page.getByLabel("프로젝트 설명").fill("버리기 전 확인");
  await page.getByRole("button", { name: "프로젝트 삭제", exact: true }).click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await expect(page.getByLabel("프로젝트 설명")).toHaveValue("버리기 전 확인");
  await page.getByRole("button", { name: "프로젝트 삭제", exact: true }).click();
  await confirm.getByRole("button", { name: "버리고 이동" }).click();
  await expect(page.getByRole("dialog", { name: "프로젝트를 삭제할까요?" })).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "작업 카드 추가", exact: true }).click();
  await page.getByLabel("작업 상태", { exact: true }).selectOption("doing");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await page.getByLabel("작업 상태", { exact: true }).selectOption("todo");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".task-card").click();
  await page.getByRole("button", { name: "카드 수정", exact: true }).click();
  for (const field of ["작업 제목", "작업 설명", "요구사항", "완료 조건"]) {
    const input = page.getByLabel(field, { exact: field !== "작업 제목" });
    const original = await input.inputValue();
    await input.fill("수정 내용");
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "계속 작성" }).click();
    await expect(input).toHaveValue("수정 내용");
    await input.fill(original);
  }
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("with-ai:data:v1"))).toBe(stored);
});

test("진행 메모는 닫기·수정·삭제 전환을 취소해도 유지되고 저장 후 확인이 해제된다", async ({ page }) => {
  await seedProject(page);
  await page.locator(".task-card").click();
  const confirm = page.getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" });
  await page.getByLabel("한 일", { exact: true }).fill("임시 메모");
  await page.getByLabel("막힌 점", { exact: true }).fill("입력 보호 확인");
  await page.getByLabel("다음 할 일", { exact: true }).fill("메모 저장");
  for (const action of ["닫기", "카드 수정", "카드 삭제"]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "계속 작성" }).click();
    await expect(page.getByLabel("한 일", { exact: true })).toHaveValue("임시 메모");
    await expect(page.getByLabel("막힌 점", { exact: true })).toHaveValue("입력 보호 확인");
    await expect(page.getByLabel("다음 할 일", { exact: true })).toHaveValue("메모 저장");
  }
  await page.getByRole("button", { name: "카드 수정", exact: true }).click();
  await confirm.getByRole("button", { name: "버리고 이동" }).click();
  await expect(page.getByRole("dialog", { name: "작업 카드 수정" })).toBeVisible();
  await page.getByLabel("작업 제목").fill("수정 후 저장");
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue("");
  await page.getByLabel("한 일", { exact: true }).fill("저장할 메모");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.locator(".task-card").click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue("저장할 메모");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("요청문은 복사 실패 시 보호하고 실제로 복사한 버전만 확인을 해제한다", async ({ page, context }) => {
  await seedProject(page);
  await page.locator(".task-card").click();
  await page.getByRole("button", { name: "AI 작업 요청문", exact: true }).click();
  const prompt = page.getByLabel("AI에게 전달할 요청문");
  const confirm = page.getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" });
  const original = await prompt.inputValue();
  await prompt.fill(original + "\n사용자가 추가한 내용");
  await page.getByRole("button", { name: "카드로 돌아가기", exact: true }).click();
  await expect(confirm).toContainText("아직 복사하지 않은 요청문");
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => { throw new Error("denied"); } },
  }));
  await page.getByRole("button", { name: "요청문 복사", exact: true }).click();
  await expect(page.getByText("복사하지 못했어요.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await page.evaluate(() => Reflect.deleteProperty(navigator, "clipboard"));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "요청문 복사", exact: true }).click();
  await expect(page.getByText("요청문을 복사했어요.", { exact: false })).toBeVisible();
  const copied = await prompt.inputValue();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copied);
  await prompt.fill(copied + "\n복사 후 수정");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await prompt.fill(copied);
  await page.getByRole("button", { name: "카드로 돌아가기", exact: true }).click();
  await expect(page.getByLabel("한 일", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "AI 작업 요청문", exact: true }).click();
  await expect(prompt).toHaveValue(original);
});

test("새로고침 확인을 취소하면 입력을 유지하고 저장 후에는 경고 없이 새로고침한다", async ({ page }) => {
  await seedProject(page);
  await page.locator(".task-card").click();
  await page.getByLabel("한 일", { exact: true }).fill("새로고침에서 유지");
  const warning = page.waitForEvent("dialog");
  // A canceled reload never reaches Playwright's navigation completion event.
  const reload = page.evaluate(() => window.location.reload());
  const dialog = await warning;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reload;
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue("새로고침에서 유지");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  let warnedAfterSave = false;
  page.on("dialog", async (event) => { warnedAfterSave = true; await event.accept(); });
  await page.reload();
  expect(warnedAfterSave).toBe(false);
  await page.locator(".task-card").click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue("새로고침에서 유지");
});
