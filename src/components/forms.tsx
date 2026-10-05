"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy, FileText, Pencil, Sparkles, Trash2 } from "lucide-react";
import {
  Card,
  Project,
  STATUSES,
  Status,
  formatDate,
  generatePrompt,
  statusLabel,
} from "@/lib/model";
export function Field({
  label,
  name,
  value,
  onChange,
  multiline = false,
  max = 10000,
  error,
  hint,
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  max?: number;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = `field-${name}`;
  const props = {
    id,
    name,
    value,
    maxLength: max,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
    "aria-invalid": !!error,
    "aria-required": required,
    "aria-describedby": error || hint ? `${id}-help` : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      {multiline ? (
        <textarea {...props} rows={4} />
      ) : (
        <input {...props} autoComplete="off" />
      )}
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? "field-error" : "field-hint"}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
export function FormActions({
  onClose,
  children = "저장하기",
}: {
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="form-actions">
      <button type="button" className="button secondary" onClick={onClose}>
        취소
      </button>
      <button className="button primary" type="submit">
        <Check size={18} />
        {children}
      </button>
    </div>
  );
}
export function ProjectForm({
  project,
  onSave,
  onClose,
}: {
  project?: Project;
  onSave: (name: string, description: string) => boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("프로젝트 이름을 입력해 주세요.");
      document.getElementById("field-project-name")?.focus();
      return;
    }
    onSave(name.trim(), description.trim());
  }
  return (
    <form onSubmit={submit} noValidate>
      <Field
        label="프로젝트 이름"
        name="project-name"
        value={name}
        onChange={(v) => {
          setName(v);
          setError("");
        }}
        max={100}
        required
        error={error}
        hint="어떤 아이디어를 만들어 볼까요? 최대 100자"
      />
      <Field
        label="프로젝트 설명"
        name="project-description"
        value={description}
        onChange={setDescription}
        multiline
        hint="목적과 만들고 싶은 모습을 자유롭게 적어 주세요."
      />
      <FormActions onClose={onClose}>
        {project ? "변경 저장" : "프로젝트 만들기"}
      </FormActions>
    </form>
  );
}
export type CardFields = Pick<
  Card,
  "title" | "description" | "requirements" | "acceptance" | "status"
>;
export function CardForm({
  card,
  onSave,
  onClose,
}: {
  card?: Card;
  onSave: (fields: CardFields) => boolean;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<CardFields>({
    title: card?.title ?? "",
    description: card?.description ?? "",
    requirements: card?.requirements ?? "",
    acceptance: card?.acceptance ?? "",
    status: card?.status ?? "todo",
  });
  const [error, setError] = useState("");
  function update(key: keyof CardFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    if (key === "title") setError("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!fields.title.trim()) {
      setError("작업 제목을 입력해 주세요.");
      document.getElementById("field-card-title")?.focus();
      return;
    }
    onSave({
      ...fields,
      title: fields.title.trim(),
      description: fields.description.trim(),
      requirements: fields.requirements.trim(),
      acceptance: fields.acceptance.trim(),
    });
  }
  return (
    <form onSubmit={submit} noValidate>
      <Field
        label="작업 제목"
        name="card-title"
        value={fields.title}
        onChange={(v) => update("title", v)}
        required
        max={120}
        error={error}
        hint="한 번에 진행할 수 있는 작업으로 적어 주세요. 최대 120자"
      />
      <div className="field">
        <label htmlFor="card-status">작업 상태</label>
        <select
          id="card-status"
          value={fields.status}
          onChange={(e) => update("status", e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="field-hint">
          {STATUSES.find((s) => s.value === fields.status)!.help}
        </p>
      </div>
      <Field
        label="작업 설명"
        name="card-description"
        value={fields.description}
        onChange={(v) => update("description", v)}
        multiline
      />
      <Field
        label="요구사항"
        name="card-requirements"
        value={fields.requirements}
        onChange={(v) => update("requirements", v)}
        multiline
        hint="구현해야 하는 기능과 지켜야 할 내용을 적어 주세요."
      />
      <Field
        label="완료 조건"
        name="card-acceptance"
        value={fields.acceptance}
        onChange={(v) => update("acceptance", v)}
        multiline
        hint="어떤 결과를 확인하면 완료인가요?"
      />
      <FormActions onClose={onClose}>
        {card ? "변경 저장" : "카드 만들기"}
      </FormActions>
    </form>
  );
}
export function Badge({ status }: { status: Status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}
export function CardDetail({
  card,
  onEdit,
  onDelete,
  onNoteSave,
  onPrompt,
}: {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
  onNoteSave: (
    note: Pick<Card["note"], "done" | "blocked" | "next">,
  ) => boolean;
  onPrompt: () => void;
}) {
  const [note, setNote] = useState({
    done: card.note.done,
    blocked: card.note.blocked,
    next: card.note.next,
  });
  const dirty =
    note.done !== card.note.done ||
    note.blocked !== card.note.blocked ||
    note.next !== card.note.next;
  return (
    <>
      <div className="detail-toolbar">
        <Badge status={card.status} />
        <button className="button secondary small" onClick={onEdit}>
          <Pencil size={16} />
          카드 수정
        </button>
      </div>
      <div className="detail-fields">
        {(
          [
            ["작업 설명", card.description],
            ["요구사항", card.requirements],
            ["완료 조건", card.acceptance],
          ] as const
        ).map(([label, value]) => (
          <section key={label}>
            <h3>{label}</h3>
            <p className={value ? "preserve-lines" : "muted"}>
              {value || "아직 작성하지 않았어요."}
            </p>
          </section>
        ))}
      </div>
      <p className="timestamps">
        생성 {formatDate(card.createdAt)} · 수정 {formatDate(card.updatedAt)}
      </p>
      <div className="note-header">
        <FileText size={18} />
        <h3>진행 메모</h3>
        <span>직접 작성하는 최신 기록</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onNoteSave(note);
        }}
      >
        <Field
          label="한 일"
          name="note-done"
          value={note.done}
          onChange={(v) => setNote({ ...note, done: v })}
          multiline
        />
        <Field
          label="막힌 점"
          name="note-blocked"
          value={note.blocked}
          onChange={(v) => setNote({ ...note, blocked: v })}
          multiline
        />
        <Field
          label="다음 할 일"
          name="note-next"
          value={note.next}
          onChange={(v) => setNote({ ...note, next: v })}
          multiline
        />
        <div className="note-save">
          <p className="muted">
            {dirty
              ? "저장하지 않은 변경 내용이 있어요."
              : card.note.updatedAt
                ? `메모 수정 ${formatDate(card.note.updatedAt)}`
                : "아직 저장한 메모가 없어요."}
          </p>
          <button className="button secondary" type="submit">
            메모 저장
          </button>
        </div>
      </form>
      <div className="ai-callout">
        <Sparkles size={22} />
        <div>
          <h3>이 작업을 AI에게 맡겨 보세요</h3>
          <p>저장된 카드와 진행 메모로 요청문을 만들어요.</p>
        </div>
        <button className="button primary" onClick={onPrompt} disabled={dirty}>
          AI 작업 요청문
        </button>
        {dirty && (
          <p className="field-hint">메모를 먼저 저장하면 요청문에 반영돼요.</p>
        )}
      </div>
      <button className="button danger text-button" onClick={onDelete}>
        <Trash2 size={16} />
        카드 삭제
      </button>
    </>
  );
}
export function PromptEditor({
  project,
  card,
}: {
  project: Project;
  card: Card;
}) {
  const [prompt, setPrompt] = useState(() => generatePrompt(project, card));
  const [result, setResult] = useState<"success" | "failed" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setResult("success");
    } catch {
      setResult("failed");
      const field = document.getElementById("ai-prompt") as HTMLTextAreaElement;
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
    }
  }
  return (
    <div className="prompt-editor">
      <div className="info-box">
        <Sparkles size={18} />
        <p>
          AI API를 사용하지 않아요. 작성한 내용을 텍스트 양식으로 정리하며, 복사
          전에 자유롭게 수정할 수 있어요.
        </p>
      </div>
      <label htmlFor="ai-prompt">AI에게 전달할 요청문</label>
      <textarea
        id="ai-prompt"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setResult(null);
        }}
        rows={16}
      />
      <p
        role="status"
        aria-live="polite"
        className={result === "failed" ? "field-error" : "copy-status"}
      >
        {result === "success"
          ? "요청문을 복사했어요. 코드 제작 AI에 붙여 넣어 주세요."
          : result === "failed"
            ? "복사하지 못했어요. 요청문을 선택해 두었으니 길게 누르거나 Ctrl+C / ⌘C로 직접 복사해 주세요."
            : "빈 항목은 요청문에서 자동으로 생략해요."}
      </p>
      <div className="form-actions">
        <button
          className="button secondary"
          onClick={() => {
            const f = document.getElementById(
              "ai-prompt",
            ) as HTMLTextAreaElement;
            f.focus();
            f.select();
          }}
        >
          전체 선택
        </button>
        <button
          className="button primary"
          disabled={!prompt.trim()}
          onClick={copy}
        >
          <Copy size={18} />
          요청문 복사
        </button>
      </div>
    </div>
  );
}
