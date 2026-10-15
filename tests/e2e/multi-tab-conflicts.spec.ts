import { expect, test, type Page } from "@playwright/test";

async function seedWorkspace(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "첫 프로젝트 만들기", exact: true })
    .click();
  await page.getByLabel("프로젝트 이름").fill("동시 편집 확인");
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await page
    .getByRole("button", { name: "작업 카드 추가", exact: true })
    .click();
  await page.getByLabel("작업 제목").fill("기존 카드");
  await page.getByRole("button", { name: "카드 만들기" }).click();
}

async function storedCard(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("with-ai:data:v1");
    if (!raw) throw new Error("저장 데이터가 없습니다.");
    return JSON.parse(raw).projects[0].cards[0] as {
      title: string;
      description: string;
      status: string;
      note: { done: string; blocked: string; next: string };
    };
  });
}

test("여러 탭의 프로젝트·카드·메모 수정을 병합하고 확인 전에는 덮어쓰지 않는다", async ({
  page: first,
  context,
}) => {
  const browserErrors: string[] = [];
  const captureErrors = (page: Page) => {
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
  };
  captureErrors(first);
  await seedWorkspace(first);
  const second = await context.newPage();
  captureErrors(second);
  await second.goto("/");

  await first
    .getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true })
    .click();
  await first.getByLabel("프로젝트 설명").fill("첫 탭에서 작성한 설명");

  await second
    .getByRole("button", { name: "프로젝트 수정 및 삭제", exact: true })
    .click();
  await second.getByLabel("프로젝트 이름").fill("다른 탭 프로젝트");
  await second.getByLabel("프로젝트 설명").fill("");
  await second.getByRole("button", { name: "변경 저장" }).click();
  await expect(first.locator(".project-title-row h1")).toHaveText(
    "다른 탭 프로젝트",
  );

  await first.getByRole("button", { name: "변경 저장" }).click();
  await expect(first.locator(".form-conflict")).toContainText(
    "프로젝트 이름",
  );
  await expect(first.getByLabel("프로젝트 이름")).toHaveValue(
    "다른 탭 프로젝트",
  );
  await expect(first.getByLabel("프로젝트 설명")).toHaveValue(
    "첫 탭에서 작성한 설명",
  );
  expect(
    await first.evaluate(() =>
      JSON.parse(localStorage.getItem("with-ai:data:v1")!).projects[0]
        .description,
    ),
  ).toBe("");
  await first
    .getByRole("button", { name: "확인 후 다시 저장", exact: true })
    .click();
  await expect(first.locator(".project-description")).toHaveText(
    "첫 탭에서 작성한 설명",
  );

  await first.locator(".task-card").click();
  await first.getByRole("button", { name: "카드 수정", exact: true }).click();
  await first.getByLabel("작업 제목").fill("첫 탭 카드");

  await second.locator(".task-card").click();
  await second
    .getByRole("button", { name: "카드 수정", exact: true })
    .click();
  await second.getByLabel("작업 제목").fill("다른 탭 카드");
  await second
    .getByLabel("작업 설명", { exact: true })
    .fill("다른 탭에서 작성한 설명");
  await second.getByLabel("작업 상태", { exact: true }).selectOption("doing");
  await second.getByRole("button", { name: "변경 저장" }).click();
  await expect(first.locator(".task-card h3")).toHaveText("다른 탭 카드");

  await first.getByRole("button", { name: "변경 저장" }).click();
  await expect(first.locator(".form-conflict")).toContainText("작업 제목");
  await expect(first.getByLabel("작업 제목")).toHaveValue("첫 탭 카드");
  await expect(first.getByLabel("작업 설명", { exact: true })).toHaveValue(
    "다른 탭에서 작성한 설명",
  );
  await expect(first.getByLabel("작업 상태", { exact: true })).toHaveValue(
    "doing",
  );
  expect((await storedCard(first)).title).toBe("다른 탭 카드");

  for (const width of [320, 390, 1440]) {
    await first.setViewportSize({ width, height: 844 });
    expect(
      await first
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await first.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await first.setViewportSize({ width: 390, height: 844 });
  await first
    .getByRole("button", { name: "확인 후 다시 저장", exact: true })
    .click();
  await expect(first.getByRole("dialog", { name: "첫 탭 카드" })).toBeVisible();
  expect(await storedCard(first)).toMatchObject({
    title: "첫 탭 카드",
    description: "다른 탭에서 작성한 설명",
    status: "doing",
  });

  await first.getByLabel("한 일", { exact: true }).fill("첫 탭에서 한 일");
  await second.getByLabel("한 일", { exact: true }).fill("다른 탭에서 한 일");
  await second.getByLabel("막힌 점", { exact: true }).fill("다른 탭의 막힌 점");
  await second.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(first.locator(".task-card")).toContainText("진행 메모 있음");

  await first.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(first.locator(".form-conflict")).toContainText("한 일");
  await expect(first.getByLabel("한 일", { exact: true })).toHaveValue(
    "첫 탭에서 한 일",
  );
  await expect(first.getByLabel("막힌 점", { exact: true })).toHaveValue(
    "다른 탭의 막힌 점",
  );
  expect((await storedCard(first)).note).toMatchObject({
    done: "다른 탭에서 한 일",
    blocked: "다른 탭의 막힌 점",
  });
  await first
    .getByRole("button", { name: "확인 후 다시 저장", exact: true })
    .click();
  expect((await storedCard(first)).note).toMatchObject({
    done: "첫 탭에서 한 일",
    blocked: "다른 탭의 막힌 점",
  });

  await first.getByRole("button", { name: "닫기", exact: true }).click();
  await first.reload();
  await first.locator(".task-card").click();
  await expect(first.getByLabel("한 일", { exact: true })).toHaveValue(
    "첫 탭에서 한 일",
  );
  await expect(first.getByLabel("막힌 점", { exact: true })).toHaveValue(
    "다른 탭의 막힌 점",
  );
  expect(browserErrors).toEqual([]);
});
