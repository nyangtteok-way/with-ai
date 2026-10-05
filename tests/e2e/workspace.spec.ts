import { test, expect, type Page } from "@playwright/test";
async function newProject(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "첫 프로젝트 만들기", exact: true })
    .click();
  await page.getByLabel("프로젝트 이름").fill("모바일 실험");
  await page.getByLabel("프로젝트 설명").fill("작업 진행 관리");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "프로젝트 만들기", exact: true })
    .click();
}
async function newCard(page: Page, title: string, status = "todo") {
  await page
    .getByRole("button", { name: "작업 카드 추가", exact: true })
    .click();
  await page.getByLabel("작업 제목").fill(title);
  await page.getByLabel("작업 설명", { exact: true }).fill(`${title} 설명`);
  await page.getByLabel("작업 상태", { exact: true }).selectOption(status);
  await page.getByLabel("요구사항", { exact: true }).fill("모바일 사용");
  await page.getByLabel("완료 조건", { exact: true }).fill("실행 확인");
  await page.getByRole("button", { name: "카드 만들기", exact: true }).click();
}
async function openCard(page: Page, title: string) {
  await page
    .locator(".task-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .click();
}
test("모바일 CRUD, 메모, 필터, 집계, 지속 저장, 요청문, 백업 교체", async ({
  page,
  context,
}) => {
  await newProject(page);
  await newCard(page, "첫 작업", "todo");
  await newCard(page, "완료 작업", "done");
  await newCard(page, "이번엔 제외", "skipped");
  await newCard(page, "폐기 대상", "discarded");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  await expect(page.getByText("1 / 2개 완료")).toBeVisible();
  await openCard(page, "첫 작업");
  await page.getByLabel("한 일", { exact: true }).fill("설계 완료");
  await page.getByLabel("막힌 점", { exact: true }).fill("없음");
  await page.getByLabel("다음 할 일", { exact: true }).fill("구현");
  await expect(
    page.getByRole("button", { name: "AI 작업 요청문", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(page.getByText(/메모 수정/)).toBeVisible();
  await page.getByRole("button", { name: "카드 수정", exact: true }).click();
  await page.getByLabel("작업 제목").fill("변경한 작업");
  await page.getByLabel("작업 상태", { exact: true }).selectOption("doing");
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("진행 중");
  await page
    .getByRole("button", { name: "AI 작업 요청문", exact: true })
    .click();
  const prompt = page.getByLabel("AI에게 전달할 요청문");
  await expect(prompt).toContainText("설계 완료");
  await expect(prompt).toContainText("모바일 실험");
  await prompt.fill((await prompt.inputValue()) + "\n추가 확인");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "요청문 복사", exact: true }).click();
  await expect(
    page.getByText("요청문을 복사했어요.", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "추가 확인",
  );
  await page
    .getByRole("button", { name: "카드로 돌아가기", exact: true })
    .click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: /진행 중\s*1/ }).click();
  await expect(page.locator(".task-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".task-card")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "변경한 작업", exact: true }),
  ).toBeVisible();
  await openCard(page, "변경한 작업");
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "설계 완료",
  );
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSON 내보내기", exact: false }).click(),
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await openCard(page, "변경한 작업");
  await page.getByRole("button", { name: "카드 삭제", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("변경한 작업");
  await page.getByRole("button", { name: "카드 삭제", exact: true }).click();
  await page.getByRole("button", { name: "카드 삭제", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(3);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByLabel("JSON 백업 파일", { exact: true })
    .setInputFiles(downloadPath!);
  await expect(page.getByRole("dialog")).toContainText(
    "백업 데이터로 교체할까요?",
  );
  await expect(page.locator(".task-card")).toHaveCount(3);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page
    .getByLabel("JSON 백업 파일", { exact: true })
    .setInputFiles(downloadPath!);
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(4);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true })
    .click();
  await page.getByLabel("프로젝트 이름").fill("이름 변경");
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("이름 변경");
  await page
    .getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "프로젝트 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "프로젝트 삭제", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "첫 프로젝트 만들기", exact: true }),
  ).toBeVisible();
});
test("입력 오류, 잘못된 백업, 복사 실패 및 직접 선택", async ({ page }) => {
  await newProject(page);
  await page
    .getByRole("button", { name: "작업 카드 추가", exact: true })
    .click();
  await page.getByRole("button", { name: "카드 만들기", exact: true }).click();
  await expect(
    page.getByText("작업 제목을 입력해 주세요.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await newCard(page, "복사 실험");
  await openCard(page, "복사 실험");
  await page
    .getByRole("button", { name: "AI 작업 요청문", exact: true })
    .click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
  });
  await page.getByRole("button", { name: "요청문 복사", exact: true }).click();
  await expect(
    page.getByText("복사하지 못했어요.", { exact: false }),
  ).toBeVisible();
  expect(
    await page
      .getByLabel("AI에게 전달할 요청문")
      .evaluate(
        (e: HTMLTextAreaElement) =>
          e.selectionEnd === e.value.length && e.selectionStart === 0,
      ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "카드로 돌아가기", exact: true })
    .click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByLabel("JSON 백업 파일", { exact: true }).setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2,"projects":[]}'),
  });
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "백업 형식이 맞지",
  );
  await expect(page.locator(".task-card")).toHaveCount(1);
});
test("데스크톱 반응형 및 손상 저장소 복구", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() =>
    localStorage.setItem("with-ai:data:v1", "broken-json"),
  );
  await page.goto("/");
  await expect(
    page.getByRole("alert", { name: "저장 데이터 오류" }),
  ).toContainText("저장 데이터 확인");
  expect(
    await page.evaluate(() => localStorage.getItem("with-ai:data:v1")),
  ).toBe("broken-json");
  await page
    .getByRole("button", { name: "백업으로 복구", exact: true })
    .click();
  await page.getByLabel("JSON 백업 파일", { exact: true }).setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"projects":[]}'),
  });
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "첫 프로젝트 만들기", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".sidebar")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("저장 실패는 성공으로 표시하지 않고 입력 내용을 유지한다", async ({
  page,
}) => {
  await newProject(page);
  await page
    .getByRole("button", { name: "작업 카드 추가", exact: true })
    .click();
  await page.getByLabel("작업 제목").fill("유지할 입력");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "카드 만들기", exact: true }).click();
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "저장하지 못했어요",
  );
  await expect(page.getByLabel("작업 제목")).toHaveValue("유지할 입력");
  await expect(page.locator(".task-card")).toHaveCount(0);
});
