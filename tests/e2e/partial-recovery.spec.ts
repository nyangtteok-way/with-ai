import { test, expect, type Page } from "@playwright/test";
import { parseBackup, type AppData, type Project } from "../../src/lib/model";

const stamp = "2026-10-23T23:30:00.000Z";

function card(id: string, title: string) {
  return {
    id,
    title,
    description: `${title} 설명`,
    requirements: "현재 데이터를 유지할 것",
    acceptance: "선택한 프로젝트만 추가할 것",
    status: "doing" as const,
    createdAt: stamp,
    updatedAt: stamp,
    note: {
      done: "복구 흐름 확인",
      blocked: "",
      next: "검증",
      updatedAt: stamp,
    },
  };
}

const current: AppData = {
  version: 1,
  projects: [
    {
      id: "shared-project",
      name: "현재 프로젝트",
      description: "계속 유지할 데이터",
      createdAt: stamp,
      updatedAt: stamp,
      cards: [card("shared-card", "현재 작업")],
    },
  ],
};

const source: Project = {
  id: "shared-project",
  name: "골라서 복구할 프로젝트",
  description: "현재 프로젝트와 내부 id가 겹치는 이전 데이터",
  createdAt: stamp,
  updatedAt: stamp,
  cards: [
    {
      ...card("shared-card", "중요한 이전 작업"),
      important: true,
      noteHistory: [
        {
          done: "이전 메모",
          blocked: "검토 중",
          next: "복구",
          updatedAt: stamp,
        },
      ],
    },
  ],
};

const recoveryData: AppData = {
  version: 1,
  projects: [
    source,
    {
      id: "other-project",
      name: "다른 이전 프로젝트",
      description: "선택 변경 확인",
      createdAt: stamp,
      updatedAt: stamp,
      cards: [],
    },
  ],
};

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate(
    ({ current, recoveryData, stamp }) =>
      localStorage.setItem(
        "with-ai:data:v1",
        JSON.stringify({
          ...current,
          importRecovery: {
            version: 1,
            savedAt: stamp,
            data: recoveryData,
          },
        }),
      ),
    { current, recoveryData, stamp },
  );
  await page.reload();
}

async function storedExceptData(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key !== "with-ai:data:v1")
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
}

test("복구본의 프로젝트 하나를 현재 데이터·초안·복구본을 유지하며 추가한다", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  const draftsBefore = await storedExceptData(page);

  await page.getByRole("button", { name: "설정", exact: true }).click();
  const recoveryButton = page.getByRole("button", {
    name: "프로젝트 선택 복구",
    exact: true,
  });
  await expect(recoveryButton).toHaveAccessibleDescription(
    /현재 데이터·초안·복구본을 유지/,
  );
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await recoveryButton.scrollIntoViewIfNeeded();
    expect((await recoveryButton.boundingBox())!.height).toBeGreaterThanOrEqual(
      44,
    );
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
  }
  await recoveryButton.click();

  const dialog = page.getByRole("dialog", {
    name: "프로젝트 하나만 복구할까요?",
  });
  const projectSelect = dialog.getByLabel("복구할 프로젝트", { exact: true });
  await expect(projectSelect).toHaveValue("shared-project");
  await projectSelect.selectOption("other-project");
  await expect(dialog).toContainText("다른 이전 프로젝트");
  await projectSelect.selectOption("shared-project");
  await expect(dialog).toContainText("작업 카드 1개");
  const addButton = dialog.getByRole("button", {
    name: "현재 데이터에 추가",
    exact: true,
  });
  await expect(addButton).toHaveAccessibleDescription(
    /현재 프로젝트와 작성 중인 초안은 그대로/,
  );
  expect((await projectSelect.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await addButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(
    await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);

  await addButton.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(source.name);
  await expect(page.getByRole("status", { name: "작업 알림" })).toContainText(
    "현재 데이터에 추가했어요",
  );
  expect(await storedExceptData(page)).toEqual(draftsBefore);

  const stored = await page.evaluate(() =>
    localStorage.getItem("with-ai:data:v1"),
  );
  const parsed = parseBackup(stored!);
  expect(parsed.projects).toHaveLength(2);
  expect(parsed.projects[0]).toEqual(current.projects[0]);
  const restored = parsed.projects[1];
  expect(restored.id).not.toBe(source.id);
  expect(restored.cards[0].id).not.toBe(source.cards[0].id);
  expect({
    ...restored,
    id: source.id,
    cards: restored.cards.map((item, index) => ({
      ...item,
      id: source.cards[index].id,
    })),
  }).toEqual(source);
  expect(JSON.parse(stored!).importRecovery).toEqual({
    version: 1,
    savedAt: stamp,
    data: recoveryData,
  });

  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator(".import-recovery")).toContainText(
    "프로젝트 2개 · 작업 카드 1개",
  );
  await expect(
    page.getByRole("button", { name: "프로젝트 선택 복구", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "교체 전 데이터 복구", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
