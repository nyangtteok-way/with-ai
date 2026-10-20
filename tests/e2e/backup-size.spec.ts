import { expect, test, type Download, type Page } from "@playwright/test";
import {
  MAX_BACKUP_BYTES,
  createBackupPayload,
  type AppData,
} from "../../src/lib/model";

const stamp = "2026-10-21T00:00:00.000Z";
const data: AppData = {
  version: 1,
  projects: [
    {
      id: "size-project",
      name: "백업 용량 확인",
      description: "한글 메모가 쌓인 프로젝트",
      createdAt: stamp,
      updatedAt: stamp,
      cards: [
        {
          id: "size-card",
          title: "누적 메모",
          description: "",
          requirements: "",
          acceptance: "",
          status: "doing",
          createdAt: stamp,
          updatedAt: stamp,
          note: {
            done: "최신 기록",
            blocked: "",
            next: "백업",
            updatedAt: stamp,
          },
          noteHistory: Array.from({ length: 140 }, () => ({
            done: "가".repeat(10000),
            blocked: "",
            next: "",
            updatedAt: stamp,
          })),
        },
      ],
    },
  ],
};
const payload = createBackupPayload(data);

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate((text) => {
    localStorage.setItem("with-ai:data:v1", text);
  }, payload.text);
  await page.reload();
}

test("백업의 UTF-8 실제 용량을 미리 경고하고 작은 JSON으로 다시 가져온다", async ({
  page,
}) => {
  expect(payload.bytes).toBeGreaterThanOrEqual(MAX_BACKUP_BYTES * 0.8);
  expect(payload.bytes).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
  await seed(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();

  const size = page.locator(".backup-size");
  await expect(size).toContainText("4.0MB / 5MB");
  await expect(size).toContainText("가져오기 한도에 가까워요");
  await expect(
    page.getByRole("progressbar", { name: "현재 JSON 백업 예상 크기" }),
  ).toHaveAttribute("aria-valuetext", "4.0MB, 가져오기 한도 5MB");

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await size.scrollIntoViewIfNeeded();
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
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /^JSON 내보내기/ }).click();
  const file = await readDownload(await pending);
  expect(file.byteLength).toBe(payload.bytes);
  expect(file.byteLength).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
  expect(file.toString("utf8")).toBe(payload.text);
  expect(file.toString("utf8")).not.toContain("\n");

  await page.getByLabel("JSON 백업 파일", { exact: true }).setInputFiles({
    name: "with-ai-backup-size.json",
    mimeType: "application/json",
    buffer: file,
  });
  const confirmation = page.getByRole("dialog", {
    name: "백업 데이터로 교체할까요?",
  });
  await expect(confirmation).toContainText("프로젝트 1개 · 작업 카드 1개");
  await expect(confirmation).toContainText("파일 4.0MB");
});
