import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  Card,
  Project,
  generatePrompt,
  parseBackup,
  summarize,
} from "../src/lib/model";
const stamp = "2026-10-05T17:00:00.000Z";
const card = (id: string, status: Card["status"]): Card => ({
  id,
  status,
  title: "작업",
  description: "",
  requirements: "",
  acceptance: "",
  createdAt: stamp,
  updatedAt: stamp,
  note: { done: "", blocked: "", next: "", updatedAt: null },
});
const project: Project = {
  id: "project-1",
  name: "실험 프로젝트",
  description: "",
  createdAt: stamp,
  updatedAt: stamp,
  cards: [],
};
test("진행률은 완료 / 활성 작업이며 제외 상태와 0개를 처리한다", () => {
  assert.equal(summarize([]).percent, 0);
  assert.equal(
    summarize([card("1", "skipped"), card("2", "discarded")]).percent,
    0,
  );
  const result = summarize([
    card("1", "todo"),
    card("2", "doing"),
    card("3", "done"),
    card("4", "skipped"),
    card("5", "discarded"),
  ]);
  assert.equal(result.percent, 33);
  assert.equal(result.total, 3);
  assert.equal(result.completed, 1);
  assert.deepEqual(result.counts, {
    todo: 1,
    doing: 1,
    done: 1,
    skipped: 1,
    discarded: 1,
  });
  assert.equal(summarize([card("1", "done"), card("2", "done")]).percent, 100);
});
test("요청문은 빈 항목을 생략하고 사용자 입력을 그대로 담는다", () => {
  const c = card("1", "todo");
  c.requirements = "색상을 변경하지 마";
  c.note.blocked = "테스트 실패";
  const prompt = generatePrompt(project, c);
  assert.ok(prompt.includes("색상을 변경하지 마"));
  assert.ok(prompt.includes("막힌 점\n테스트 실패"));
  assert.ok(!prompt.includes("## 완료 조건"));
  assert.ok(!prompt.includes("## 프로젝트 설명"));
  assert.ok(!prompt.includes("진행 메모 — 한 일"));
  assert.ok(prompt.includes("기존 코드와 저장소의 작업 지침"));
});
test("백업 roundtrip은 메모와 상태, 날짜를 보존한다", () => {
  const c = card("1", "done");
  c.note = { done: "구현 완료", blocked: "", next: "검증", updatedAt: stamp };
  const data = { version: 1, projects: [{ ...project, cards: [c] }] };
  assert.deepEqual(parseBackup(JSON.stringify(data)), data);
});
test("잘못된 버전·타입·상태·날짜·중복 id·빈 제목을 거절한다", () => {
  const valid = () => ({
    version: 1,
    projects: [{ ...project, cards: [card("1", "todo")] }],
  });
  const invalid: unknown[] = [
    null,
    [],
    { version: 2, projects: [] },
    { version: 1, projects: {} },
    { version: 1, projects: [null] },
  ];
  const a = valid();
  a.projects[0].cards[0].title = " ";
  invalid.push(a);
  const b = valid();
  b.projects[0].cards[0].status = "unknown" as Card["status"];
  invalid.push(b);
  const c = valid();
  c.projects[0].createdAt = "not-a-date";
  invalid.push(c);
  const d = valid();
  d.projects[0].cards.push(card("1", "todo"));
  invalid.push(d);
  const e = valid();
  e.projects[0].cards[0].note.done = 42 as unknown as string;
  invalid.push(e);
  const f = valid();
  f.projects[0].name = "x".repeat(101);
  invalid.push(f);
  invalid.forEach((value) =>
    assert.throws(() => parseBackup(JSON.stringify(value))),
  );
  assert.throws(() => parseBackup("{"));
});
