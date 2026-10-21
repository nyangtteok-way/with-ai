import { test, expect, type Page, type Download } from "@playwright/test";
import { parseBackup, type AppData, type Card } from "../../src/lib/model";

const stamp = "2026-10-19T23:37:00.000Z";
const initialNote = {
  done: "처음 한 일\n두 번째 줄",
  blocked: "처음 막힌 점",
  next: "처음 계획",
  updatedAt: stamp,
};
function fixture(historyCount = 0): AppData {
  const card: Card = {
    id: "card",
    title: "메모 이력 확인",
    description: "",
    requirements: "",
    acceptance: "",
    status: "doing",
    createdAt: stamp,
    updatedAt: stamp,
    note: initialNote,
  };
  if (historyCount)
    card.noteHistory = Array.from({ length: historyCount }, (_, i) => ({
      done: `보관한 기록 ${i + 1}`,
      blocked: "",
      next: "",
      updatedAt: stamp,
    }));
  return {
    version: 1,
    projects: [
      {
        id: "project",
        name: "진행 기록",
        description: "",
        createdAt: stamp,
        updatedAt: stamp,
        cards: [card],
      },
    ],
  };
}
async function seed(page: Page, data = fixture()) {
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("with-ai:data:v1", JSON.stringify(data)),
    data,
  );
  await page.reload();
}
async function raw(page: Page) {
  return page.evaluate(() => localStorage.getItem("with-ai:data:v1"));
}
async function card(page: Page) {
  return parseBackup((await raw(page))!).projects[0].cards[0];
}
async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
async function importData(page: Page, data: unknown) {
  await page.getByLabel("JSON 백업 파일", { exact: true }).setInputFiles({
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
}

test("이전 메모를 순서대로 보존하고 조회 중 초안·최신 요청문을 유지한다", async ({
  page,
}) => {
  await seed(page);
  await page.locator(".task-card").click();
  await expect(page.locator(".note-history > summary")).toHaveText(
    "이전 메모 0개",
  );
  await page.getByLabel("한 일", { exact: true }).fill("두 번째 한 일");
  await page.getByLabel("막힌 점", { exact: true }).fill("");
  await page.getByLabel("다음 할 일", { exact: true }).fill("두 번째 계획");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  const secondNote = (await card(page)).note;
  expect((await card(page)).noteHistory).toEqual([initialNote]);
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  expect((await card(page)).noteHistory).toEqual([initialNote]);
  const savedSecondNote = (await card(page)).note;
  expect(savedSecondNote.done).toBe(secondNote.done);
  await page
    .getByLabel("한 일", { exact: true })
    .fill("작성 중인 세 번째 기록");
  const beforeView = await page.evaluate(() => JSON.stringify(localStorage));
  const summary = page.locator(".note-history > summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(page.locator(".note-history")).toHaveAttribute("open", "");
  const entry = page.locator(".note-history-list summary").first();
  await entry.focus();
  await entry.press("Enter");
  await expect(page.locator(".note-history-list")).toContainText(
    initialNote.done,
  );
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "작성 중인 세 번째 기록",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(
    beforeView,
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.locator(".task-card").click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "작성 중인 세 번째 기록",
  );
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  expect((await card(page)).noteHistory).toEqual([
    savedSecondNote,
    initialNote,
  ]);
  await page
    .getByRole("button", { name: "AI 작업 요청문", exact: true })
    .click();
  const prompt = await page.getByLabel("AI에게 전달할 요청문").inputValue();
  expect(prompt).toContain("작성 중인 세 번째 기록");
  expect(prompt).not.toContain("처음 한 일");
  expect(prompt).not.toContain("두 번째 한 일");
  await page
    .getByRole("button", { name: "카드로 돌아가기", exact: true })
    .click();
  await page.getByRole("button", { name: "카드 수정", exact: true }).click();
  await page.getByLabel("작업 제목").fill("제목만 변경");
  await page.getByRole("button", { name: "변경 저장", exact: true }).click();
  expect((await card(page)).noteHistory).toEqual([
    savedSecondNote,
    initialNote,
  ]);
  const latest = (await card(page)).note;
  for (const label of ["한 일", "막힌 점", "다음 할 일"])
    await page.getByLabel(label, { exact: true }).fill("");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  expect((await card(page)).noteHistory).toEqual([
    latest,
    savedSecondNote,
    initialNote,
  ]);
});

test("이전 메모를 검색해 현재 입력으로 불러오고 작성 중 내용은 확인 없이 덮지 않는다", async ({
  page,
}) => {
  await seed(page, fixture(12));
  await page.locator(".task-card").click();
  await page.locator(".note-history > summary").click();
  const search = page.getByRole("searchbox", { name: "이전 메모 검색" });
  await search.fill("없는 기록");
  await expect(page.locator(".note-history-list")).toHaveCount(0);
  await expect(page.locator(".note-history-empty")).toHaveText(
    "검색어와 일치하는 이전 메모가 없어요.",
  );
  await expect(page.locator(".note-history-search [role='status']")).toHaveText(
    "0개의 이전 메모를 찾았어요.",
  );
  await page.getByRole("button", { name: "지우기", exact: true }).click();
  await expect(page.locator(".note-history-list > li")).toHaveCount(10);

  await search.fill("보관한 기록 12");
  await expect(page.locator(".note-history-list > li")).toHaveCount(1);
  await expect(page.locator(".note-history-search [role='status']")).toHaveText(
    "1개의 이전 메모를 찾았어요.",
  );
  await page.locator(".note-history-list summary").click();
  await expect(page.locator(".note-history-list")).toContainText(
    "보관한 기록 12",
  );
  const reuse = page.getByRole("button", {
    name: "이 기록을 현재 메모로 불러오기",
    exact: true,
  });
  await page
    .getByLabel("한 일", { exact: true })
    .fill("아직 저장하지 않은 현재 작성 내용");
  let confirmation = "";
  page.once("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await reuse.click();
  expect(confirmation).toContain("저장하지 않은 현재 메모");
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "아직 저장하지 않은 현재 작성 내용",
  );

  page.once("dialog", (dialog) => dialog.accept());
  await reuse.click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "보관한 기록 12",
  );
  await expect(page.getByLabel("한 일", { exact: true })).toBeFocused();
  await expect(page.locator(".note-save [role='status']")).toContainText(
    "이전 기록을 현재 입력으로 불러와",
  );
  expect((await card(page)).note).toEqual(initialNote);

  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect((await search.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await reuse.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.locator(".task-card").click();
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "보관한 기록 12",
  );
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  const saved = await card(page);
  expect(saved.note.done).toBe("보관한 기록 12");
  expect(saved.noteHistory).toHaveLength(13);
  expect(saved.noteHistory![0]).toEqual(initialNote);
  expect(saved.noteHistory!.some((note) => note.done === "보관한 기록 12")).toBe(
    true,
  );
});

test("메모 이력 더 보기와 v1 백업·자동 복구본·재가져오기가 기록을 보존한다", async ({
  page,
}) => {
  const data = fixture(12);
  await seed(page, data);
  await page.locator(".task-card").click();
  await page.locator(".note-history > summary").click();
  await expect(page.locator(".note-history-list > li")).toHaveCount(10);
  const before = await raw(page);
  await page
    .getByRole("button", { name: "이전 메모 더 보기 (2개 남음)", exact: true })
    .click();
  await expect(page.locator(".note-history-list > li")).toHaveCount(12);
  await page.locator(".note-history-list summary").last().click();
  await expect(page.locator(".note-history-list")).toContainText(
    "보관한 기록 12",
  );
  expect(await raw(page)).toBe(before);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /^JSON 내보내기/ }).click();
  const exported = await readDownload(await pending);
  expect(parseBackup(exported)).toEqual(data);
  await importData(page, { version: 1, projects: [] });
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const previous = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "복구본 JSON 내보내기", exact: true })
    .click();
  expect(parseBackup(await readDownload(await previous))).toEqual(data);
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await page
    .getByRole("button", { name: "교체 전 데이터 복구", exact: true })
    .click();
  await page.reload();
  expect(parseBackup((await raw(page))!)).toEqual(data);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const beforeInvalid = await raw(page);
  const invalid = structuredClone(data);
  invalid.projects[0].cards[0].noteHistory![0].updatedAt = "invalid";
  await importData(page, invalid);
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "백업 형식이 맞지 않아요",
  );
  expect(await raw(page)).toBe(beforeInvalid);
  await importData(page, JSON.parse(exported));
  await page.getByRole("button", { name: "데이터 교체", exact: true }).click();
  expect(parseBackup((await raw(page))!)).toEqual(data);
});

test("저장 실패와 여러 탭 충돌은 이력을 추가하지 않고 재저장 성공 때만 이전 메모를 보관한다", async ({
  page,
  context,
}) => {
  await seed(page);
  await page.locator(".task-card").click();
  await page.getByLabel("한 일", { exact: true }).fill("실패 후 저장할 기록");
  const before = await raw(page);
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "with-ai:data:v1") {
        Storage.prototype.setItem = setItem;
        throw new DOMException("full", "QuotaExceededError");
      }
      return setItem.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(page.getByRole("alert", { name: "작업 알림" })).toContainText(
    "저장하지 못했어요",
  );
  expect(await raw(page)).toBe(before);
  await expect(page.getByLabel("한 일", { exact: true })).toHaveValue(
    "실패 후 저장할 기록",
  );
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  const firstSaved = (await card(page)).note;
  expect((await card(page)).noteHistory).toEqual([initialNote]);
  const other = await context.newPage();
  await other.goto("/");
  await other.locator(".task-card").click();
  await page.getByLabel("한 일", { exact: true }).fill("첫 탭의 최종 기록");
  await other.getByLabel("한 일", { exact: true }).fill("다른 탭의 기록");
  await other.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(page.locator(".note-history > summary")).toHaveText(
    "이전 메모 2개",
  );
  const remoteNote = (await card(page)).note;
  const beforeConflict = await raw(page);
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(page.locator(".form-conflict")).toContainText("한 일");
  expect(await raw(page)).toBe(beforeConflict);
  await page
    .getByRole("button", { name: "확인 후 다시 저장", exact: true })
    .click();
  expect((await card(page)).noteHistory).toEqual([
    remoteNote,
    firstSaved,
    initialNote,
  ]);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.reload();
  expect((await card(page)).noteHistory).toEqual([
    remoteNote,
    firstSaved,
    initialNote,
  ]);
  expect((await card(page)).note.done).toBe("첫 탭의 최종 기록");
});
