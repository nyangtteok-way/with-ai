"use client";
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check, Copy, FileText, Pencil, Sparkles, Trash2 } from "lucide-react";
import {
  loadCardFormDraft,
  loadPromptDraft,
  loadProjectFormDraft,
  loadProgressNoteDraft,
  removeCardFormDraft,
  removePromptDraft,
  removeProjectFormDraft,
  removeProgressNoteDraft,
  saveCardFormDraft,
  savePromptDraft,
  saveProjectFormDraft,
  saveProgressNoteDraft,
  type CardDraftFields,
  type ProjectDraftFields,
} from "@/lib/drafts";
import {
  useUnsavedChanges,
  type UnsavedChangeHandler,
} from "./use-unsaved-changes";
import {
  Card,
  Project,
  STATUSES,
  Status,
  formatDate,
  generatePrompt,
  statusLabel,
} from "@/lib/model";
import { reconcileFields, sameFields } from "@/lib/conflicts";
import { NoteHistory } from "./note-history";

export type EntitySaveResult<T> =
  | { ok: true }
  | { ok: false; conflict?: T };
export type NoteFields = Pick<Card["note"], "done" | "blocked" | "next">;
export type NoteSaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; conflict?: Card["note"] };

function describeConflict<T extends object>(
  changedKeys: (keyof T)[],
  conflictingKeys: (keyof T)[],
  labels: Record<keyof T, string>,
  fallback: string,
) {
  const changed = changedKeys.map((key) => labels[key]).join("·");
  const conflicting = conflictingKeys.map((key) => labels[key]).join("·");
  if (conflicting) {
    return `다른 탭에서도 ${conflicting} 항목을 수정했어요. 현재 탭 입력을 유지했고 아직 덮어쓰지 않았어요. 내용을 확인한 뒤 다시 저장해 주세요.`;
  }
  return `다른 탭에서 ${changed || fallback}을 저장해 최신 내용을 함께 반영했어요. 현재 입력은 유지했으며, 내용을 확인한 뒤 다시 저장해 주세요.`;
}
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
  onDirtyChange,
  onDraftChange,
}: {
  project?: Project;
  onSave: (
    name: string,
    description: string,
    base: ProjectDraftFields | null,
  ) => EntitySaveResult<ProjectDraftFields>;
  onClose: () => void;
  onDirtyChange: UnsavedChangeHandler;
  onDraftChange: () => void;
}) {
  const [draftTarget] = useState(() => {
    const base: ProjectDraftFields | null = project
      ? { name: project.name, description: project.description }
      : null;
    return { projectId: project?.id ?? null, base };
  });
  const [initial] = useState<ProjectDraftFields>(() =>
    draftTarget.base ?? { name: "", description: "" },
  );
  const [base, setBase] = useState(draftTarget.base);
  const [restoredDraft] = useState(() =>
    loadProjectFormDraft(draftTarget.projectId, draftTarget.base),
  );
  const [fields, setFields] = useState(restoredDraft?.fields ?? initial);
  const [error, setError] = useState("");
  const [conflictMessage, setConflictMessage] = useState("");
  const [draftStatus, setDraftStatus] = useState<
    | { kind: "restored" | "saved"; savedAt: string }
    | { kind: "error"; message: string }
    | null
  >(
    restoredDraft
      ? { kind: "restored", savedAt: restoredDraft.savedAt }
      : null,
  );
  const savedFields = base ?? initial;
  const dirty = !sameFields(fields, savedFields);
  const discardDraft = useCallback(() => {
    if (removeProjectFormDraft(draftTarget.projectId)) {
      onDraftChange();
      return true;
    }
    setDraftStatus({
      kind: "error",
      message:
        "프로젝트 초안을 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
    });
    return false;
  }, [draftTarget.projectId, onDraftChange]);
  useUnsavedChanges(dirty, onDirtyChange, discardDraft);

  function update(key: keyof ProjectDraftFields, value: string) {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (key === "name") setError("");
    const matchesSaved = sameFields(next, savedFields);
    if (matchesSaved) {
      setConflictMessage("");
      if (removeProjectFormDraft(draftTarget.projectId)) {
        onDraftChange();
        setDraftStatus(null);
      } else {
        setDraftStatus({
          kind: "error",
          message:
            "프로젝트 초안을 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
        });
      }
      return;
    }
    const result = saveProjectFormDraft(
      draftTarget.projectId,
      base,
      next,
    );
    if (result.ok && (!draftStatus || draftStatus.kind === "error"))
      onDraftChange();
    setDraftStatus(
      result.ok
        ? { kind: "saved", savedAt: result.savedAt }
        : { kind: "error", message: result.message },
    );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!fields.name.trim()) {
      setError("프로젝트 이름을 입력해 주세요.");
      document.getElementById("field-project-name")?.focus();
      return;
    }
    const submitted = {
      name: fields.name.trim(),
      description: fields.description.trim(),
    };
    const result = onSave(submitted.name, submitted.description, base);
    if (result.ok) {
      removeProjectFormDraft(draftTarget.projectId);
      onDraftChange();
      setDraftStatus(null);
      setConflictMessage("");
      return;
    }
    if (result.conflict && base) {
      const reconciled = reconcileFields(base, submitted, result.conflict);
      setBase(result.conflict);
      setFields(reconciled.fields);
      setConflictMessage(
        describeConflict(
          reconciled.remoteChangedKeys,
          reconciled.conflictingKeys,
          { name: "프로젝트 이름", description: "프로젝트 설명" },
          "프로젝트",
        ),
      );
      if (sameFields(reconciled.fields, result.conflict)) {
        if (removeProjectFormDraft(draftTarget.projectId)) {
          onDraftChange();
          setDraftStatus(null);
        }
      } else {
        const draft = saveProjectFormDraft(
          draftTarget.projectId,
          result.conflict,
          reconciled.fields,
        );
        if (draft.ok) onDraftChange();
        setDraftStatus(
          draft.ok
            ? { kind: "saved", savedAt: draft.savedAt }
            : { kind: "error", message: draft.message },
        );
      }
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <Field
        label="프로젝트 이름"
        name="project-name"
        value={fields.name}
        onChange={(v) => update("name", v)}
        max={100}
        required
        error={error}
        hint="어떤 아이디어를 만들어 볼까요? 최대 100자"
      />
      <Field
        label="프로젝트 설명"
        name="project-description"
        value={fields.description}
        onChange={(v) => update("description", v)}
        multiline
        hint="목적과 만들고 싶은 모습을 자유롭게 적어 주세요."
      />
      {conflictMessage && (
        <p className="form-conflict" role="alert" aria-live="assertive">
          {conflictMessage}
        </p>
      )}
      {draftStatus && (
        <p
          className={`form-draft-status ${draftStatus.kind === "error" ? "field-error" : "muted"}`}
          role={draftStatus.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {draftStatus.kind === "error"
            ? draftStatus.message
            : draftStatus.kind === "restored"
              ? `임시 저장한 프로젝트 내용을 복구했어요 · ${formatDate(draftStatus.savedAt)} 임시 저장`
              : `${formatDate(draftStatus.savedAt)} 이 기기에 프로젝트 초안 저장됨`}
        </p>
      )}
      <FormActions onClose={onClose}>
        {conflictMessage
          ? "확인 후 다시 저장"
          : draftTarget.projectId
            ? "변경 저장"
            : "프로젝트 만들기"}
      </FormActions>
    </form>
  );
}
export type CardFields = CardDraftFields;
export function CardForm({
  projectId,
  card,
  onSave,
  onClose,
  onDirtyChange,
  onDraftChange,
}: {
  projectId: string;
  card?: Card;
  onSave: (
    fields: CardFields,
    base: CardFields | null,
  ) => EntitySaveResult<CardFields>;
  onClose: () => void;
  onDirtyChange: UnsavedChangeHandler;
  onDraftChange: () => void;
}) {
  const [draftTarget] = useState(() => {
    const base: CardFields | null = card
      ? {
          title: card.title,
          description: card.description,
          requirements: card.requirements,
          acceptance: card.acceptance,
          status: card.status,
        }
      : null;
    return { cardId: card?.id ?? null, base };
  });
  const [initial] = useState<CardFields>(() =>
    draftTarget.base ?? {
      title: "",
      description: "",
      requirements: "",
      acceptance: "",
      status: "todo",
    },
  );
  const [base, setBase] = useState(draftTarget.base);
  const [restoredDraft] = useState(() =>
    loadCardFormDraft(
      projectId,
      draftTarget.cardId,
      draftTarget.base,
    ),
  );
  const [fields, setFields] = useState(restoredDraft?.fields ?? initial);
  const [error, setError] = useState("");
  const [conflictMessage, setConflictMessage] = useState("");
  const [draftStatus, setDraftStatus] = useState<
    | { kind: "restored" | "saved"; savedAt: string }
    | { kind: "error"; message: string }
    | null
  >(
    restoredDraft
      ? { kind: "restored", savedAt: restoredDraft.savedAt }
      : null,
  );
  const savedFields = base ?? initial;
  const dirty = !sameFields(fields, savedFields);
  const discardDraft = useCallback(() => {
    if (removeCardFormDraft(projectId, draftTarget.cardId)) {
      onDraftChange();
      return true;
    }
    setDraftStatus({
      kind: "error",
      message:
        "작업 카드 초안을 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
    });
    return false;
  }, [draftTarget.cardId, onDraftChange, projectId]);
  useUnsavedChanges(dirty, onDirtyChange, discardDraft);

  function update(key: keyof CardFields, value: string) {
    const next = { ...fields, [key]: value } as CardFields;
    setFields(next);
    if (key === "title") setError("");
    const matchesSaved = sameFields(next, savedFields);
    if (matchesSaved) {
      setConflictMessage("");
      if (removeCardFormDraft(projectId, draftTarget.cardId)) {
        onDraftChange();
        setDraftStatus(null);
      } else {
        setDraftStatus({
          kind: "error",
          message:
            "작업 카드 초안을 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
        });
      }
      return;
    }
    const result = saveCardFormDraft(
      projectId,
      draftTarget.cardId,
      base,
      next,
    );
    if (result.ok && (!draftStatus || draftStatus.kind === "error"))
      onDraftChange();
    setDraftStatus(
      result.ok
        ? { kind: "saved", savedAt: result.savedAt }
        : { kind: "error", message: result.message },
    );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!fields.title.trim()) {
      setError("작업 제목을 입력해 주세요.");
      document.getElementById("field-card-title")?.focus();
      return;
    }
    const submitted = {
      ...fields,
      title: fields.title.trim(),
      description: fields.description.trim(),
      requirements: fields.requirements.trim(),
      acceptance: fields.acceptance.trim(),
    };
    const result = onSave(submitted, base);
    if (result.ok) {
      removeCardFormDraft(projectId, draftTarget.cardId);
      onDraftChange();
      setDraftStatus(null);
      setConflictMessage("");
      return;
    }
    if (result.conflict && base) {
      const reconciled = reconcileFields(base, submitted, result.conflict);
      setBase(result.conflict);
      setFields(reconciled.fields);
      setConflictMessage(
        describeConflict(
          reconciled.remoteChangedKeys,
          reconciled.conflictingKeys,
          {
            title: "작업 제목",
            description: "작업 설명",
            requirements: "요구사항",
            acceptance: "완료 조건",
            status: "작업 상태",
          },
          "작업 카드",
        ),
      );
      if (sameFields(reconciled.fields, result.conflict)) {
        if (removeCardFormDraft(projectId, draftTarget.cardId)) {
          onDraftChange();
          setDraftStatus(null);
        }
      } else {
        const draft = saveCardFormDraft(
          projectId,
          draftTarget.cardId,
          result.conflict,
          reconciled.fields,
        );
        if (draft.ok) onDraftChange();
        setDraftStatus(
          draft.ok
            ? { kind: "saved", savedAt: draft.savedAt }
            : { kind: "error", message: draft.message },
        );
      }
    }
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
      {conflictMessage && (
        <p className="form-conflict" role="alert" aria-live="assertive">
          {conflictMessage}
        </p>
      )}
      {draftStatus && (
        <p
          className={`form-draft-status ${draftStatus.kind === "error" ? "field-error" : "muted"}`}
          role={draftStatus.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {draftStatus.kind === "error"
            ? draftStatus.message
            : draftStatus.kind === "restored"
              ? `임시 저장한 카드 내용을 복구했어요 · ${formatDate(draftStatus.savedAt)} 임시 저장`
              : `${formatDate(draftStatus.savedAt)} 이 기기에 카드 초안 저장됨`}
        </p>
      )}
      <FormActions onClose={onClose}>
        {conflictMessage
          ? "확인 후 다시 저장"
          : draftTarget.cardId
            ? "변경 저장"
            : "카드 만들기"}
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
  hasPromptDraft,
  onDirtyChange,
  onDraftChange,
}: {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
  onNoteSave: (note: NoteFields, base: Card["note"]) => NoteSaveResult;
  onPrompt: () => void;
  hasPromptDraft: boolean;
  onDirtyChange: UnsavedChangeHandler;
  onDraftChange: () => void;
}) {
  const noteFormRef = useRef<HTMLFormElement>(null);
  const [baseNote, setBaseNote] = useState(card.note);
  const [restoredDraft] = useState(() =>
    loadProgressNoteDraft(card.id, card.note.updatedAt),
  );
  const [note, setNote] = useState(() =>
    restoredDraft?.note ?? {
      done: card.note.done,
      blocked: card.note.blocked,
      next: card.note.next,
    },
  );
  const [conflictMessage, setConflictMessage] = useState("");
  const [draftStatus, setDraftStatus] = useState<
    | { kind: "restored" | "saved"; savedAt: string }
    | { kind: "history"; matchesSaved: true }
    | { kind: "history"; savedAt: string; matchesSaved: false }
    | { kind: "error"; message: string }
    | null
  >(
    restoredDraft
      ? { kind: "restored", savedAt: restoredDraft.savedAt }
      : null,
  );
  const dirty =
    note.done !== baseNote.done ||
    note.blocked !== baseNote.blocked ||
    note.next !== baseNote.next;
  const discardDraft = useCallback(() => {
    if (removeProgressNoteDraft(card.id)) {
      onDraftChange();
      return true;
    }
    setDraftStatus({
      kind: "error",
      message:
        "임시 메모를 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
    });
    return false;
  }, [card.id, onDraftChange]);
  useUnsavedChanges(dirty, onDirtyChange, discardDraft);

  function updateNote(key: keyof typeof note, value: string) {
    const next = { ...note, [key]: value };
    setNote(next);
    const matchesSaved =
      next.done === baseNote.done &&
      next.blocked === baseNote.blocked &&
      next.next === baseNote.next;
    if (matchesSaved) {
      setConflictMessage("");
      if (removeProgressNoteDraft(card.id)) {
        onDraftChange();
        setDraftStatus(null);
      } else {
        setDraftStatus({
          kind: "error",
          message:
            "임시 메모를 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
        });
      }
      return;
    }
    const result = saveProgressNoteDraft(card.id, baseNote.updatedAt, next);
    if (result.ok && (!draftStatus || draftStatus.kind === "error"))
      onDraftChange();
    setDraftStatus(
      result.ok
        ? { kind: "saved", savedAt: result.savedAt }
        : { kind: "error", message: result.message },
    );
  }
  function reuseNote(historyNote: Card["note"]) {
    const next: NoteFields = {
      done: historyNote.done,
      blocked: historyNote.blocked,
      next: historyNote.next,
    };
    if (sameFields(note, next)) {
      noteFormRef.current
        ?.querySelector<HTMLTextAreaElement>("#field-note-done")
        ?.focus();
      return;
    }
    if (
      dirty &&
      !window.confirm(
        "저장하지 않은 현재 메모를 선택한 이전 기록으로 바꿀까요? 지금 작성 중인 내용은 사라집니다.",
      )
    )
      return;

    setNote(next);
    setConflictMessage("");
    const matchesSaved =
      next.done === baseNote.done &&
      next.blocked === baseNote.blocked &&
      next.next === baseNote.next;
    if (matchesSaved) {
      if (removeProgressNoteDraft(card.id)) {
        if (dirty) onDraftChange();
        setDraftStatus({
          kind: "history",
          matchesSaved: true,
        });
      } else {
        setDraftStatus({
          kind: "error",
          message:
            "임시 메모를 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
        });
      }
    } else {
      const result = saveProgressNoteDraft(card.id, baseNote.updatedAt, next);
      if (result.ok && (!draftStatus || draftStatus.kind === "error"))
        onDraftChange();
      setDraftStatus(
        result.ok
          ? {
              kind: "history",
              savedAt: result.savedAt,
              matchesSaved: false,
            }
          : { kind: "error", message: result.message },
      );
    }
    requestAnimationFrame(() =>
      noteFormRef.current
        ?.querySelector<HTMLTextAreaElement>("#field-note-done")
        ?.focus(),
    );
  }
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
        ref={noteFormRef}
        onSubmit={(e) => {
          e.preventDefault();
          const result = onNoteSave(note, baseNote);
          if (result.ok) {
            setBaseNote({ ...note, updatedAt: result.savedAt });
            removeProgressNoteDraft(card.id);
            onDraftChange();
            setDraftStatus(null);
            setConflictMessage("");
            return;
          }
          if (result.conflict) {
            const remote = {
              done: result.conflict.done,
              blocked: result.conflict.blocked,
              next: result.conflict.next,
            };
            const previous = {
              done: baseNote.done,
              blocked: baseNote.blocked,
              next: baseNote.next,
            };
            const reconciled = reconcileFields(previous, note, remote);
            setBaseNote(result.conflict);
            setNote(reconciled.fields);
            setConflictMessage(
              describeConflict(
                reconciled.remoteChangedKeys,
                reconciled.conflictingKeys,
                {
                  done: "한 일",
                  blocked: "막힌 점",
                  next: "다음 할 일",
                },
                "진행 메모",
              ),
            );
            if (sameFields(reconciled.fields, remote)) {
              if (removeProgressNoteDraft(card.id)) {
                onDraftChange();
                setDraftStatus(null);
              }
            } else {
              const draft = saveProgressNoteDraft(
                card.id,
                result.conflict.updatedAt,
                reconciled.fields,
              );
              if (draft.ok) onDraftChange();
              setDraftStatus(
                draft.ok
                  ? { kind: "saved", savedAt: draft.savedAt }
                  : { kind: "error", message: draft.message },
              );
            }
          }
        }}
      >
        <Field
          label="한 일"
          name="note-done"
          value={note.done}
          onChange={(v) => updateNote("done", v)}
          multiline
        />
        <Field
          label="막힌 점"
          name="note-blocked"
          value={note.blocked}
          onChange={(v) => updateNote("blocked", v)}
          multiline
        />
        <Field
          label="다음 할 일"
          name="note-next"
          value={note.next}
          onChange={(v) => updateNote("next", v)}
          multiline
        />
        {conflictMessage && (
          <p className="form-conflict" role="alert" aria-live="assertive">
            {conflictMessage}
          </p>
        )}
        <div className="note-save">
          <p
            className={draftStatus?.kind === "error" ? "field-error" : "muted"}
            role={draftStatus?.kind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {draftStatus?.kind === "error"
              ? draftStatus.message
              : draftStatus?.kind === "restored"
                ? `임시 메모를 복구했어요 · ${formatDate(draftStatus.savedAt)} 임시 저장`
                : draftStatus?.kind === "history"
                  ? draftStatus.matchesSaved
                    ? "선택한 이전 기록이 현재 저장 메모와 같은 내용이에요."
                    : `${formatDate(draftStatus.savedAt)} 이전 기록을 현재 입력으로 불러와 이 기기에 임시 저장했어요. 내용을 확인한 뒤 메모 저장을 눌러 주세요.`
                : draftStatus?.kind === "saved"
                  ? `${formatDate(draftStatus.savedAt)} 이 기기에 임시 저장됨`
                  : dirty
                    ? "저장하지 않은 변경 내용이 있어요."
                    : card.note.updatedAt
                      ? `메모 수정 ${formatDate(card.note.updatedAt)}`
                      : "아직 저장한 메모가 없어요."}
          </p>
          <button className="button secondary" type="submit">
            {conflictMessage ? "확인 후 다시 저장" : "메모 저장"}
          </button>
        </div>
      </form>
      <NoteHistory notes={card.noteHistory ?? []} onReuse={reuseNote} />
      <div className="ai-callout">
        <Sparkles size={22} />
        <div>
          <h3>이 작업을 AI에게 맡겨 보세요</h3>
          <p>저장된 카드와 진행 메모로 요청문을 만들어요.</p>
        </div>
        <button className="button primary" onClick={onPrompt} disabled={dirty}>
          {hasPromptDraft ? "작성 중 요청문 계속" : "AI 작업 요청문"}
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
  onDirtyChange,
  onDraftChange,
}: {
  project: Project;
  card: Card;
  onDirtyChange: UnsavedChangeHandler;
  onDraftChange: () => void;
}) {
  const [initial] = useState(() => generatePrompt(project, card));
  const [restoredDraft] = useState(() =>
    loadPromptDraft(project.id, card.id, initial),
  );
  const [prompt, setPrompt] = useState(restoredDraft?.prompt ?? initial);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [result, setResult] = useState<"success" | "failed" | null>(null);
  const [draftStatus, setDraftStatus] = useState<
    | { kind: "restored" | "saved"; savedAt: string }
    | { kind: "error"; message: string }
    | null
  >(
    restoredDraft
      ? { kind: "restored", savedAt: restoredDraft.savedAt }
      : null,
  );
  const dirty = prompt !== initial && prompt !== copiedPrompt;
  const discardDraft = useCallback(() => {
    if (removePromptDraft(project.id, card.id)) {
      onDraftChange();
      return true;
    }
    setDraftStatus({
      kind: "error",
      message:
        "요청문 초안을 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
    });
    return false;
  }, [card.id, onDraftChange, project.id]);
  useUnsavedChanges(dirty, onDirtyChange, discardDraft);

  function updatePrompt(next: string) {
    setPrompt(next);
    setResult(null);
    if (next === initial || next === copiedPrompt) {
      if (removePromptDraft(project.id, card.id)) {
        onDraftChange();
        setDraftStatus(null);
      } else {
        setDraftStatus({
          kind: "error",
          message:
            "요청문 초안을 지우지 못했어요. 브라우저 저장 권한을 확인한 뒤 다시 시도해 주세요.",
        });
      }
      return;
    }
    const saved = savePromptDraft(project.id, card.id, initial, next);
    if (saved.ok && (!draftStatus || draftStatus.kind === "error"))
      onDraftChange();
    setDraftStatus(
      saved.ok
        ? { kind: "saved", savedAt: saved.savedAt }
        : { kind: "error", message: saved.message },
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
      if (removePromptDraft(project.id, card.id)) {
        onDraftChange();
        setDraftStatus(null);
      } else {
        setDraftStatus({
          kind: "error",
          message:
            "복사는 완료했지만 요청문 초안을 지우지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
        });
      }
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
        onChange={(e) => updatePrompt(e.target.value)}
        rows={16}
      />
      {draftStatus && (
        <p
          className={`form-draft-status ${draftStatus.kind === "error" ? "field-error" : "muted"}`}
          role={draftStatus.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {draftStatus.kind === "error"
            ? draftStatus.message
            : draftStatus.kind === "restored"
              ? `임시 저장한 요청문을 복구했어요 · ${formatDate(draftStatus.savedAt)} 임시 저장`
              : `${formatDate(draftStatus.savedAt)} 이 기기에 요청문 초안 저장됨`}
        </p>
      )}
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
