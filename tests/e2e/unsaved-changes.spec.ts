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

test("저장 전 종료된 진행 메모를 복구하고 저장·버리기 때 임시 메모를 정리한다", async ({
  page,
  context,
}) => {
  await seedProject(page);
  await page.locator(".task-card").click();
  await page.getByLabel("한 일", { exact: true }).fill("강제 종료 전 구현 내용");
  await page.getByLabel("막힌 점", { exact: true }).fill("테스트 환경 확인 필요");
  await page.getByLabel("다음 할 일", { exact: true }).fill("모바일에서 검증");
  await expect(page.getByText(/이 기기에 임시 저장됨/)).toBeVisible();
  const storedBeforeSave = await page.evaluate(() =>
    localStorage.getItem("with-ai:data:v1"),
  );
  expect(storedBeforeSave).not.toContain("강제 종료 전 구현 내용");

  await page.close({ runBeforeUnload: false });
  let recovered = await context.newPage();
  await recovered.goto("/");
  await expect(recovered.locator(".task-card")).toContainText("임시 메모 있음");
  await recovered.locator(".task-card").click();
  await expect(recovered.getByText(/임시 메모를 복구했어요/)).toBeVisible();
  await expect(recovered.getByLabel("한 일", { exact: true })).toHaveValue(
    "강제 종료 전 구현 내용",
  );
  await expect(recovered.getByLabel("막힌 점", { exact: true })).toHaveValue(
    "테스트 환경 확인 필요",
  );
  await expect(recovered.getByLabel("다음 할 일", { exact: true })).toHaveValue(
    "모바일에서 검증",
  );
  for (const width of [320, 390, 1440]) {
    await recovered.setViewportSize({ width, height: 844 });
    expect(
      await recovered
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await recovered.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await recovered.setViewportSize({ width: 390, height: 844 });

  await recovered.getByRole("button", { name: "닫기", exact: true }).click();
  const confirm = recovered.getByRole("dialog", {
    name: "작성 중인 내용을 버릴까요?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await expect(recovered.getByLabel("한 일", { exact: true })).toHaveValue(
    "강제 종료 전 구현 내용",
  );
  await recovered.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(recovered.getByText(/메모 수정/)).toBeVisible();
  expect(
    await recovered.evaluate(() =>
      Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).some((key) => key?.startsWith("with-ai:note-draft:v1:")),
    ),
  ).toBe(false);
  await recovered
    .getByLabel("다음 할 일", { exact: true })
    .fill("저장 직후 계속 작성한 내용");
  await expect(recovered.getByText(/이 기기에 임시 저장됨/)).toBeVisible();
  const draftBase = await recovered.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("with-ai:data:v1")!);
    const draftKey = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index),
    ).find((key) => key?.startsWith("with-ai:note-draft:v1:"));
    const draft = JSON.parse(localStorage.getItem(draftKey!)!);
    return {
      draft: draft.baseUpdatedAt,
      saved: data.projects[0].cards[0].note.updatedAt,
    };
  });
  expect(draftBase.draft).toBe(draftBase.saved);
  await recovered.close({ runBeforeUnload: false });
  recovered = await context.newPage();
  await recovered.goto("/");
  await expect(recovered.locator(".task-card")).toContainText("임시 메모 있음");
  await recovered.locator(".task-card").click();
  await expect(recovered.getByText(/임시 메모를 복구했어요/)).toBeVisible();
  await expect(recovered.getByLabel("다음 할 일", { exact: true })).toHaveValue(
    "저장 직후 계속 작성한 내용",
  );
  await recovered.getByRole("button", { name: "메모 저장", exact: true }).click();
  await recovered.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(recovered.locator(".task-card")).toContainText("진행 메모 있음");

  await recovered.locator(".task-card").click();
  await recovered.getByLabel("다음 할 일", { exact: true }).fill("버릴 임시 내용");
  await recovered.getByRole("button", { name: "닫기", exact: true }).click();
  await recovered
    .getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" })
    .getByRole("button", { name: "버리고 이동" })
    .click();
  await expect(recovered.locator(".task-card")).toContainText("진행 메모 있음");
  await recovered.locator(".task-card").click();
  await expect(recovered.getByLabel("다음 할 일", { exact: true })).toHaveValue(
    "저장 직후 계속 작성한 내용",
  );
});

test("진행 메모 임시 저장 실패를 알리고 입력과 영구 저장 경로를 유지한다", async ({
  page,
}) => {
  await seedProject(page);
  await page.locator(".task-card").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (
      window as typeof window & { restoreDraftSetItem?: () => void }
    ).restoreDraftSetItem = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("with-ai:note-draft:v1:")) {
        throw new DOMException("full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByLabel("한 일", { exact: true }).fill("실패해도 유지할 메모");
  await expect(page.locator(".field-error")).toContainText(
    "진행 메모를 임시 저장하지 못했어요",
  );
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "실패해도 유지할 메모",
  );
  await expect(page.locator(".task-card")).not.toContainText("임시 메모 있음");
  await page.evaluate(() => {
    (
      window as typeof window & { restoreDraftSetItem?: () => void }
    ).restoreDraftSetItem?.();
  });
  await page
    .getByLabel("한 일", { exact: true })
    .fill("실패 후 다시 임시 저장한 메모");
  await expect(page.getByText(/이 기기에 임시 저장됨/)).toBeVisible();
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(page.getByText(/메모 수정/)).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.reload();
  await page.locator(".task-card").click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "실패 후 다시 임시 저장한 메모",
  );
});

test("저장 전 종료된 새 카드와 수정 카드를 복구하고 영구 저장 뒤 초안을 정리한다", async ({
  page,
  context,
}) => {
  await seedProject(page);
  await page.getByRole("button", { name: "작업 카드 추가", exact: true }).click();
  await page.getByLabel("작업 제목").fill("강제 종료 전 새 카드");
  await page.getByLabel("작업 상태", { exact: true }).selectOption("doing");
  await page.getByLabel("작업 설명", { exact: true }).fill("복구할 카드 설명");
  await page.getByLabel("요구사항", { exact: true }).fill("모바일에서도 이어 쓰기");
  await page.getByLabel("완료 조건", { exact: true }).fill("모든 필드가 복구됨");
  await expect(page.getByText(/이 기기에 카드 초안 저장됨/)).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("with-ai:data:v1")),
  ).not.toContain("강제 종료 전 새 카드");

  await page.close({ runBeforeUnload: false });
  let recovered = await context.newPage();
  await recovered.goto("/");
  await expect(
    recovered.getByRole("button", {
      name: "작성 중 카드 계속",
      exact: true,
    }),
  ).toBeVisible();
  await recovered
    .getByRole("button", { name: "작성 중 카드 계속", exact: true })
    .click();
  await expect(recovered.getByText(/임시 저장한 카드 내용을 복구했어요/)).toBeVisible();
  await expect(recovered.getByLabel("작업 제목")).toHaveValue(
    "강제 종료 전 새 카드",
  );
  await expect(recovered.getByLabel("작업 상태", { exact: true })).toHaveValue(
    "doing",
  );
  await expect(recovered.getByLabel("작업 설명", { exact: true })).toHaveValue(
    "복구할 카드 설명",
  );
  await expect(recovered.getByLabel("요구사항", { exact: true })).toHaveValue(
    "모바일에서도 이어 쓰기",
  );
  await expect(recovered.getByLabel("완료 조건", { exact: true })).toHaveValue(
    "모든 필드가 복구됨",
  );
  for (const width of [320, 390, 1440]) {
    await recovered.setViewportSize({ width, height: 844 });
    expect(
      await recovered
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await recovered.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await recovered.setViewportSize({ width: 390, height: 844 });
  await recovered.getByRole("button", { name: "닫기", exact: true }).click();
  const confirm = recovered.getByRole("dialog", {
    name: "작성 중인 내용을 버릴까요?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await expect(recovered.getByLabel("작업 제목")).toHaveValue(
    "강제 종료 전 새 카드",
  );
  await recovered
    .getByRole("button", { name: "카드 만들기", exact: true })
    .click();
  expect(
    await recovered.evaluate(() =>
      Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).some((key) => key?.startsWith("with-ai:card-draft:v1:")),
    ),
  ).toBe(false);

  const savedCard = recovered
    .locator(".task-card")
    .filter({ hasText: "강제 종료 전 새 카드" });
  await savedCard.click();
  await recovered.getByRole("button", { name: "카드 수정", exact: true }).click();
  await recovered.getByLabel("작업 제목").fill("수정 중인 카드 제목");
  await recovered
    .getByLabel("완료 조건", { exact: true })
    .fill("수정 초안도 복구됨");
  await expect(recovered.getByText(/이 기기에 카드 초안 저장됨/)).toBeVisible();
  await recovered.close({ runBeforeUnload: false });

  recovered = await context.newPage();
  await recovered.goto("/");
  const cardWithDraft = recovered
    .locator(".task-card")
    .filter({ hasText: "강제 종료 전 새 카드" });
  await expect(cardWithDraft).toContainText("카드 수정 초안 있음");
  await cardWithDraft.click();
  await recovered.getByRole("button", { name: "카드 수정", exact: true }).click();
  await expect(recovered.getByText(/임시 저장한 카드 내용을 복구했어요/)).toBeVisible();
  await expect(recovered.getByLabel("작업 제목")).toHaveValue(
    "수정 중인 카드 제목",
  );
  await expect(recovered.getByLabel("완료 조건", { exact: true })).toHaveValue(
    "수정 초안도 복구됨",
  );
  await recovered
    .getByRole("button", { name: "변경 저장", exact: true })
    .click();
  await expect(
    recovered.getByRole("dialog", { name: "수정 중인 카드 제목" }),
  ).toBeVisible();
  expect(
    await recovered.evaluate(() =>
      Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).some((key) => key?.startsWith("with-ai:card-draft:v1:")),
    ),
  ).toBe(false);
  await recovered.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    recovered.locator(".task-card").filter({ hasText: "수정 중인 카드 제목" }),
  ).not.toContainText("초안 있음");
});

test("작업 카드 초안 저장 실패를 알리고 입력과 영구 저장 경로를 유지한다", async ({
  page,
}) => {
  await seedProject(page);
  await page.getByRole("button", { name: "작업 카드 추가", exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (
      window as typeof window & { restoreCardDraftSetItem?: () => void }
    ).restoreCardDraftSetItem = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("with-ai:card-draft:v1:")) {
        throw new DOMException("full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByLabel("작업 제목").fill("실패해도 유지할 카드");
  await expect(page.locator(".field-error")).toContainText(
    "작업 카드 초안을 임시 저장하지 못했어요",
  );
  await expect(page.getByLabel("작업 제목")).toHaveValue(
    "실패해도 유지할 카드",
  );
  await page.evaluate(() => {
    (
      window as typeof window & { restoreCardDraftSetItem?: () => void }
    ).restoreCardDraftSetItem?.();
  });
  await page.getByLabel("작업 제목").fill("실패 후 저장할 카드");
  await expect(page.getByText(/이 기기에 카드 초안 저장됨/)).toBeVisible();
  await page.getByRole("button", { name: "카드 만들기", exact: true }).click();
  await expect(
    page.locator(".task-card").filter({ hasText: "실패 후 저장할 카드" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".task-card").filter({ hasText: "실패 후 저장할 카드" }),
  ).toBeVisible();
});

test("저장 전 종료된 새 프로젝트와 수정 프로젝트를 복구하고 영구 저장 뒤 초안을 정리한다", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .locator(".first-use")
    .getByRole("button", { name: "첫 프로젝트 만들기", exact: true })
    .click();
  await page.getByLabel("프로젝트 이름").fill("강제 종료 전 프로젝트");
  await page
    .getByLabel("프로젝트 설명")
    .fill("모바일에서 이어 쓸 프로젝트 설명");
  await expect(page.getByText(/이 기기에 프로젝트 초안 저장됨/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("with-ai:data:v1"))).toBeNull();

  await page.close({ runBeforeUnload: false });
  let recovered = await context.newPage();
  await recovered.goto("/");
  const continueProject = recovered
    .locator(".first-use")
    .getByRole("button", {
      name: "작성 중 프로젝트 계속",
      exact: true,
    });
  await expect(continueProject).toBeVisible();
  await continueProject.click();
  await expect(
    recovered.getByText(/임시 저장한 프로젝트 내용을 복구했어요/),
  ).toBeVisible();
  await expect(recovered.getByLabel("프로젝트 이름")).toHaveValue(
    "강제 종료 전 프로젝트",
  );
  await expect(recovered.getByLabel("프로젝트 설명")).toHaveValue(
    "모바일에서 이어 쓸 프로젝트 설명",
  );
  for (const width of [320, 390, 1440]) {
    await recovered.setViewportSize({ width, height: 844 });
    expect(
      await recovered
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await recovered.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await recovered.setViewportSize({ width: 390, height: 844 });
  await recovered.getByRole("button", { name: "닫기", exact: true }).click();
  const confirm = recovered.getByRole("dialog", {
    name: "작성 중인 내용을 버릴까요?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await expect(recovered.getByLabel("프로젝트 이름")).toHaveValue(
    "강제 종료 전 프로젝트",
  );
  await recovered
    .getByRole("button", { name: "프로젝트 만들기", exact: true })
    .click();
  await expect(
    recovered.getByRole("heading", { name: "강제 종료 전 프로젝트" }),
  ).toBeVisible();
  expect(
    await recovered.evaluate(() =>
      Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).some((key) => key?.startsWith("with-ai:project-draft:v1:")),
    ),
  ).toBe(false);

  await recovered
    .getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true })
    .click();
  await recovered.getByLabel("프로젝트 이름").fill("수정 중인 프로젝트 이름");
  await recovered
    .getByLabel("프로젝트 설명")
    .fill("종료 뒤 복구할 수정 설명");
  await expect(
    recovered.getByText(/이 기기에 프로젝트 초안 저장됨/),
  ).toBeVisible();
  await recovered.close({ runBeforeUnload: false });

  recovered = await context.newPage();
  await recovered.goto("/");
  await expect(
    recovered.getByText("수정 초안 있음", { exact: true }),
  ).toBeVisible();
  await recovered
    .getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true })
    .click();
  await expect(
    recovered.getByText(/임시 저장한 프로젝트 내용을 복구했어요/),
  ).toBeVisible();
  await expect(recovered.getByLabel("프로젝트 이름")).toHaveValue(
    "수정 중인 프로젝트 이름",
  );
  await expect(recovered.getByLabel("프로젝트 설명")).toHaveValue(
    "종료 뒤 복구할 수정 설명",
  );
  await recovered
    .getByRole("button", { name: "변경 저장", exact: true })
    .click();
  await expect(
    recovered.getByRole("heading", { name: "수정 중인 프로젝트 이름" }),
  ).toBeVisible();
  await expect(
    recovered.getByText("수정 초안 있음", { exact: true }),
  ).toHaveCount(0);
  expect(
    await recovered.evaluate(() =>
      Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).some((key) => key?.startsWith("with-ai:project-draft:v1:")),
    ),
  ).toBe(false);
});

test("프로젝트 초안 저장 실패를 알리고 입력과 영구 저장 경로를 유지한다", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".first-use")
    .getByRole("button", { name: "첫 프로젝트 만들기", exact: true })
    .click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (
      window as typeof window & { restoreProjectDraftSetItem?: () => void }
    ).restoreProjectDraftSetItem = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("with-ai:project-draft:v1:")) {
        throw new DOMException("full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByLabel("프로젝트 이름").fill("실패해도 유지할 프로젝트");
  await expect(page.locator(".field-error")).toContainText(
    "프로젝트 초안을 임시 저장하지 못했어요",
  );
  await expect(page.getByLabel("프로젝트 이름")).toHaveValue(
    "실패해도 유지할 프로젝트",
  );
  await page.evaluate(() => {
    (
      window as typeof window & { restoreProjectDraftSetItem?: () => void }
    ).restoreProjectDraftSetItem?.();
  });
  await page.getByLabel("프로젝트 이름").fill("실패 후 저장할 프로젝트");
  await expect(page.getByText(/이 기기에 프로젝트 초안 저장됨/)).toBeVisible();
  await page
    .getByRole("button", { name: "프로젝트 만들기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "실패 후 저장할 프로젝트" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "실패 후 저장할 프로젝트" }),
  ).toBeVisible();
});
