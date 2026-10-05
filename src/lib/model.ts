export const STATUSES = [
  { value: "todo", label: "할 일", help: "앞으로 시작할 작업" },
  { value: "doing", label: "진행 중", help: "지금 진행하고 있는 작업" },
  { value: "done", label: "완료", help: "완료 조건을 충족한 작업" },
  {
    value: "skipped",
    label: "안 할 거",
    help: "이번 프로젝트에서는 진행하지 않기로 한 작업",
  },
  {
    value: "discarded",
    label: "폐기 아이디어",
    help: "검토 후 아이디어 자체를 폐기한 작업",
  },
] as const;
export type Status = (typeof STATUSES)[number]["value"];
export interface ProgressNote {
  done: string;
  blocked: string;
  next: string;
  updatedAt: string | null;
}
export interface Card {
  id: string;
  title: string;
  description: string;
  requirements: string;
  acceptance: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  note: ProgressNote;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  cards: Card[];
}
export interface AppData {
  version: 1;
  projects: Project[];
}
export const EMPTY_DATA: AppData = { version: 1, projects: [] };
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export function newId() {
  return crypto.randomUUID();
}
export function now() {
  return new Date().toISOString();
}
export function statusLabel(status: Status) {
  return STATUSES.find((s) => s.value === status)!.label;
}
export function summarize(cards: Card[]) {
  const counts: Record<Status, number> = {
    todo: 0,
    doing: 0,
    done: 0,
    skipped: 0,
    discarded: 0,
  };
  cards.forEach((card) => counts[card.status]++);
  const total = counts.todo + counts.doing + counts.done;
  return {
    counts,
    total,
    completed: counts.done,
    percent: total ? Math.round((counts.done / total) * 100) : 0,
  };
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}
export function generatePrompt(project: Project, card: Card) {
  const fields: [string, string][] = [
    ["프로젝트 이름", project.name],
    ["프로젝트 설명", project.description],
    ["작업 제목", card.title],
    ["작업 설명", card.description],
    ["요구사항", card.requirements],
    ["완료 조건", card.acceptance],
    ["진행 메모 — 한 일", card.note.done],
    ["진행 메모 — 막힌 점", card.note.blocked],
    ["진행 메모 — 다음 할 일", card.note.next],
  ];
  return [
    "아래 프로젝트의 작업을 구현해줘.",
    ...fields
      .filter(([, value]) => value.trim())
      .map(([label, value]) => `## ${label}\n${value.trim()}`),
    "## 작업 안내\n먼저 기존 코드와 저장소의 작업 지침을 확인하고, 기존 구조와 기술을 따라 구현해줘.\n사용자가 작성하지 않은 요구사항을 임의로 추가하지 마.\n구현 후 변경 내용과 검증 결과를 정리해줘.",
  ].join("\n\n");
}

// 신뢰하지 않는 JSON을 검증하고 알려진 필드만 새 객체로 복원한다.
export function parseBackup(text: string): AppData {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 파일이 아니에요.");
  }
  const fail = (): never => {
    throw new Error(
      "백업 형식이 맞지 않아요. with-ai에서 내보낸 버전 1 JSON 파일을 선택해 주세요.",
    );
  };
  const obj = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail();
  const str = (v: unknown, max = 10000): string =>
    typeof v === "string" && v.length <= max ? v : fail();
  const required = (v: unknown, max: number): string => {
    const s = str(v, max);
    return s.trim() ? s : fail();
  };
  const date = (v: unknown): string => {
    const s = str(v, 40);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(s) &&
      Number.isFinite(Date.parse(s))
      ? s
      : fail();
  };
  const ids = new Set<string>();
  const id = (v: unknown): string => {
    const s = required(v, 128);
    if (ids.has(s)) fail();
    ids.add(s);
    return s;
  };
  const root = obj(input);
  if (
    root.version !== 1 ||
    !Array.isArray(root.projects) ||
    root.projects.length > 1000
  )
    fail();
  let cardCount = 0;
  const projects = (root.projects as unknown[]).map((value) => {
    const p = obj(value);
    if (!Array.isArray(p.cards) || (cardCount += p.cards.length) > 10000)
      fail();
    return {
      id: id(p.id),
      name: required(p.name, 100),
      description: str(p.description),
      createdAt: date(p.createdAt),
      updatedAt: date(p.updatedAt),
      cards: (p.cards as unknown[]).map((value) => {
        const c = obj(value),
          n = obj(c.note);
        if (!STATUSES.some((s) => s.value === c.status)) fail();
        return {
          id: id(c.id),
          title: required(c.title, 120),
          description: str(c.description),
          requirements: str(c.requirements),
          acceptance: str(c.acceptance),
          status: c.status as Status,
          createdAt: date(c.createdAt),
          updatedAt: date(c.updatedAt),
          note: {
            done: str(n.done),
            blocked: str(n.blocked),
            next: str(n.next),
            updatedAt: n.updatedAt === null ? null : date(n.updatedAt),
          },
        };
      }),
    };
  });
  return { version: 1, projects };
}
