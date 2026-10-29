import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectAaTextContrast(locator: Locator) {
  const count = await locator.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const ratio = await locator.nth(index).evaluate((element) => {
      type Rgba = [number, number, number, number];
      const parse = (value: string): Rgba => {
        const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
        return [
          channels[0] ?? 0,
          channels[1] ?? 0,
          channels[2] ?? 0,
          channels[3] ?? 1,
        ];
      };
      const composite = (foreground: Rgba, background: Rgba): Rgba => {
        const alpha = foreground[3] + background[3] * (1 - foreground[3]);
        if (alpha === 0) return [0, 0, 0, 0];
        return [
          (foreground[0] * foreground[3] +
            background[0] * background[3] * (1 - foreground[3])) /
            alpha,
          (foreground[1] * foreground[3] +
            background[1] * background[3] * (1 - foreground[3])) /
            alpha,
          (foreground[2] * foreground[3] +
            background[2] * background[3] * (1 - foreground[3])) /
            alpha,
          alpha,
        ];
      };
      const luminance = ([red, green, blue]: Rgba) => {
        const [r, g, b] = [red, green, blue].map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const backgrounds: Rgba[] = [];
      let current: Element | null = element;
      while (current) {
        backgrounds.push(parse(getComputedStyle(current).backgroundColor));
        current = current.parentElement;
      }
      const background = backgrounds
        .reverse()
        .reduce(
          (color, layer) => composite(layer, color),
          [255, 255, 255, 1] as Rgba,
        );
      const foreground = composite(
        parse(getComputedStyle(element).color),
        background,
      );
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    });

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
}

async function expectTouchTargetsAtLeast(locator: Locator, size: number) {
  const count = await locator.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const target = locator.nth(index);
    const box = await target.boundingBox();
    expect(box, `조작 요소 ${index + 1}의 화면 크기를 확인할 수 있어야 합니다`).not.toBeNull();
    expect(
      box!.width,
      `조작 요소 ${index + 1}의 너비가 ${size}px 이상이어야 합니다`,
    ).toBeGreaterThanOrEqual(size);
    expect(
      box!.height,
      `조작 요소 ${index + 1}의 높이가 ${size}px 이상이어야 합니다`,
    ).toBeGreaterThanOrEqual(size);
  }
}

async function createProjectAndCard(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "첫 프로젝트 만들기", exact: true })
    .click();
  await page.getByLabel("프로젝트 이름").fill("접근성 점검");
  await page.getByLabel("프로젝트 설명").fill("모바일 조작 확인");
  await page
    .getByRole("button", { name: "프로젝트 만들기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "작업 카드 추가", exact: true })
    .click();
  await page.getByLabel("작업 제목").fill("읽기 쉬운 작업");
  await page.getByRole("button", { name: "카드 만들기", exact: true }).click();
}

test("모바일 주요 화면과 대화상자의 작은 글자도 AA 대비를 유지한다", async ({
  page,
}) => {
  await page.goto("/");
  for (const selector of [
    ".first-use .eyebrow",
    ".first-use > p:not(.eyebrow)",
    ".first-use .primary",
    ".first-use-note",
    ".mobile-bottom > button",
  ]) {
    await expectAaTextContrast(page.locator(selector));
  }

  await createProjectAndCard(page);
  for (const selector of [
    ".mobile-project-picker",
    ".page-heading .eyebrow",
    ".project-description",
    ".progress-copy .eyebrow",
    ".progress-value p",
    ".progress-help",
    ".progress-stats > div > span:last-child",
    ".section-heading p",
    ".card-search > p",
    ".filters > button:not(.selected)",
    ".card-sort label",
    ".card-description",
    ".content-footer",
    ".mobile-bottom > button",
  ]) {
    await expectAaTextContrast(page.locator(selector));
  }

  await page.getByRole("button", { name: "프로젝트", exact: true }).click();
  await expectAaTextContrast(page.getByRole("dialog").locator(".dialog-heading p"));
  await expectAaTextContrast(page.getByRole("dialog").locator(".add-project"));
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  await page.locator(".task-card").click();
  for (const selector of [
    ".status-badge",
    ".detail-fields .muted",
    ".timestamps",
    ".note-header span",
  ]) {
    await expectAaTextContrast(page.getByRole("dialog").locator(selector));
  }
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  await page.getByRole("button", { name: "설정", exact: true }).click();
  for (const selector of [
    ".dialog-heading p",
    ".info-box p",
    ".backup-actions small",
    ".settings-footnote p",
  ]) {
    await expectAaTextContrast(page.getByRole("dialog").locator(selector));
  }
});

test("모바일의 주요 조작 영역과 현재 프로젝트 의미를 분명하게 제공한다", async ({
  page,
}) => {
  await createProjectAndCard(page);

  const projectPicker = page.locator(".mobile-project-picker");
  const projectNavigation = page.getByRole("navigation", { name: "주요 작업" });
  const projectNavigationButton = projectNavigation.getByRole("button", {
    name: "프로젝트",
    exact: true,
  });

  await expect(projectPicker).toHaveAttribute(
    "aria-label",
    "프로젝트 선택, 현재 접근성 점검",
  );
  await expect(projectPicker).toHaveAttribute("aria-haspopup", "dialog");
  await expect(projectPicker).toHaveAttribute("aria-expanded", "false");
  await expect(projectNavigationButton).toHaveAttribute(
    "aria-haspopup",
    "dialog",
  );
  await expect(projectNavigationButton).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  await expectTouchTargetsAtLeast(projectPicker, 44);
  await expectTouchTargetsAtLeast(page.locator(".filters > button"), 44);
  await expectTouchTargetsAtLeast(
    page.getByRole("button", { name: "알림 닫기" }),
    44,
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await expectTouchTargetsAtLeast(projectPicker, 44);
  await expectTouchTargetsAtLeast(page.locator(".filters > button"), 44);
  await expectTouchTargetsAtLeast(
    page.getByRole("button", { name: "알림 닫기" }),
    44,
  );
  await page.setViewportSize({ width: 390, height: 844 });

  await projectPicker.click();
  await expect(projectPicker).toHaveAttribute("aria-expanded", "true");
  await expect(projectNavigationButton).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const projectDialog = page.getByRole("dialog", { name: "내 프로젝트" });
  const currentProject = projectDialog.locator(
    '.project-nav[aria-current="true"]',
  );
  await expect(currentProject).toHaveCount(1);
  await expect(currentProject).toContainText("접근성 점검");
  await expect(currentProject.locator(".nav-count")).toHaveAttribute(
    "aria-label",
    "작업 카드 1개",
  );
  await projectDialog
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await expect(projectPicker).toHaveAttribute("aria-expanded", "false");

  await page.locator(".task-card").click();
  const detailDialog = page.getByRole("dialog", { name: "읽기 쉬운 작업" });
  await expectTouchTargetsAtLeast(detailDialog.locator(".ai-callout .button"), 44);
  await expectTouchTargetsAtLeast(
    detailDialog.getByRole("button", { name: "알림 닫기" }),
    44,
  );
});
