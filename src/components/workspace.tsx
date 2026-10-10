"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Folder,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  AppData,
  Card,
  MAX_BACKUP_BYTES,
  Project,
  STATUSES,
  Status,
  formatDate,
  newId,
  now,
  parseBackup,
  summarize,
} from "@/lib/model";
import { retryLoad, saveData, useAppStore } from "@/lib/store";
import {
  Badge,
  CardDetail,
  CardFields,
  CardForm,
  ProjectForm,
  PromptEditor,
} from "./forms";
import { Dialog } from "./dialog";
type Modal =
  | { kind: "project"; projectId?: string }
  | { kind: "card"; cardId?: string }
  | { kind: "detail"; cardId: string }
  | { kind: "prompt"; cardId: string }
  | { kind: "settings" }
  | { kind: "projects" }
  | { kind: "delete-project"; projectId: string }
  | { kind: "delete-card"; cardId: string }
  | { kind: "import"; data: AppData; filename: string }
  | null;
function download(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Workspace() {
  const { data, ready, error } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const project =
    data.projects.find((p) => p.id === activeId) ?? data.projects[0];
  const summary = summarize(project?.cards ?? []);
  const searchTerm = search.trim().toLowerCase();
  const cards =
    project?.cards.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        (!searchTerm ||
          [
            c.title,
            c.description,
            c.requirements,
            c.acceptance,
            c.note.done,
            c.note.blocked,
            c.note.next,
          ].some((value) => value.toLowerCase().includes(searchTerm))),
    ) ?? [];
  const selectedCard =
    modal && "cardId" in modal
      ? project?.cards.find((c) => c.id === modal.cardId)
      : undefined;
  function notify(text: string, error = false) {
    setToast({ text, error });
  }
  function persist(next: AppData, message: string, recovering = false) {
    const result = saveData(next, recovering);
    if (!result.ok) {
      notify(result.message, true);
      return false;
    }
    notify(message);
    return true;
  }
  function selectProject(id: string) {
    setActiveId(id);
    setFilter("all");
    setSearch("");
    setModal(null);
  }
  function saveProject(name: string, description: string) {
    const editingId = modal?.kind === "project" ? modal.projectId : undefined;
    const stamp = now();
    const next: Project = editingId
      ? {
          ...data.projects.find((p) => p.id === editingId)!,
          name,
          description,
          updatedAt: stamp,
        }
      : {
          id: newId(),
          name,
          description,
          cards: [],
          createdAt: stamp,
          updatedAt: stamp,
        };
    if (editingId && !data.projects.some((p) => p.id === editingId)) {
      notify("프로젝트가 삭제되었어요. 목록을 다시 확인해 주세요.", true);
      return false;
    }
    if (
      persist(
        {
          ...data,
          projects: editingId
            ? data.projects.map((p) => (p.id === editingId ? next : p))
            : [...data.projects, next],
        },
        editingId ? "프로젝트를 수정했어요." : "새 프로젝트를 만들었어요.",
      )
    ) {
      selectProject(next.id);
      return true;
    }
    return false;
  }
  function updateProject(next: Project, message: string) {
    return persist(
      {
        ...data,
        projects: data.projects.map((p) => (p.id === next.id ? next : p)),
      },
      message,
    );
  }
  function saveCard(fields: CardFields) {
    if (!project) return false;
    const id = modal?.kind === "card" ? modal.cardId : undefined;
    const existing = project.cards.find((c) => c.id === id);
    if (id && !existing) {
      notify("카드가 삭제되었어요. 목록을 다시 확인해 주세요.", true);
      return false;
    }
    const stamp = now();
    const card: Card = existing
      ? { ...existing, ...fields, updatedAt: stamp }
      : {
          id: newId(),
          ...fields,
          createdAt: stamp,
          updatedAt: stamp,
          note: { done: "", blocked: "", next: "", updatedAt: null },
        };
    if (
      updateProject(
        {
          ...project,
          updatedAt: stamp,
          cards: existing
            ? project.cards.map((c) => (c.id === id ? card : c))
            : [card, ...project.cards],
        },
        existing ? "카드를 수정했어요." : "새 작업 카드를 만들었어요.",
      )
    ) {
      setModal(existing ? { kind: "detail", cardId: card.id } : null);
      return true;
    }
    return false;
  }
  function saveNote(note: Pick<Card["note"], "done" | "blocked" | "next">) {
    if (!project || !selectedCard) return false;
    const stamp = now();
    return updateProject(
      {
        ...project,
        updatedAt: stamp,
        cards: project.cards.map((c) =>
          c.id === selectedCard.id
            ? { ...c, updatedAt: stamp, note: { ...note, updatedAt: stamp } }
            : c,
        ),
      },
      "진행 메모를 저장했어요.",
    );
  }
  function removeProject(id: string) {
    if (
      persist(
        { ...data, projects: data.projects.filter((p) => p.id !== id) },
        "프로젝트와 작업 카드를 삭제했어요.",
      )
    ) {
      setModal(null);
      setFilter("all");
      setSearch("");
    }
  }
  function removeCard(id: string) {
    if (
      project &&
      updateProject(
        {
          ...project,
          updatedAt: now(),
          cards: project.cards.filter((c) => c.id !== id),
        },
        "작업 카드를 삭제했어요.",
      )
    )
      setModal(null);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("5MB 이하의 JSON 백업 파일을 선택해 주세요.");
      const imported = parseBackup(await file.text());
      setModal({ kind: "import", data: imported, filename: file.name });
    } catch (e) {
      notify(e instanceof Error ? e.message : "파일을 읽지 못했어요.", true);
    }
  }
  function exportData() {
    download(
      JSON.stringify(data, null, 2),
      `with-ai-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
    notify("JSON 백업 파일을 내보냈어요.");
  }
  const notification = toast && (
    <div
      className={`toast ${toast.error ? "toast-error" : ""}`}
      role={toast.error ? "alert" : "status"}
      aria-live="polite"
      aria-label="작업 알림"
    >
      <span>
        {toast.error ? <CircleDashed size={18} /> : <Check size={18} />}
      </span>
      <p>{toast.text}</p>
      <button aria-label="알림 닫기" onClick={() => setToast(null)}>
        <X size={18} />
      </button>
    </div>
  );
  const projectList = (
    <div className="project-list">
      {data.projects.map((p) => (
        <button
          key={p.id}
          className={`project-nav ${project?.id === p.id ? "active" : ""}`}
          onClick={() => selectProject(p.id)}
        >
          <Folder size={18} />
          <span>{p.name}</span>
          <span className="nav-count">{p.cards.length}</span>
        </button>
      ))}
      <button
        className="project-nav add-project"
        onClick={() => setModal({ kind: "project" })}
      >
        <Plus size={18} />
        <span>새 프로젝트</span>
      </button>
    </div>
  );
  if (!ready)
    return (
      <main className="loading" aria-busy="true">
        <div className="brand">
          <Layers3 />
          with-ai
        </div>
        <p>작업 공간을 준비하고 있어요…</p>
      </main>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="with-ai 홈">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          with-ai<span className="brand-period">.</span>
        </Link>
        <p className="sidebar-caption">생각을 실행으로</p>
        <div className="nav-heading">
          <span>내 프로젝트</span>
          <span>{data.projects.length}</span>
        </div>
        {projectList}
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={18} />
            <div>
              <strong>나만의 작업 공간</strong>
              <p>현재 브라우저에 저장돼요</p>
            </div>
          </div>
          <button
            className="project-nav"
            onClick={() => setModal({ kind: "settings" })}
          >
            <Settings2 size={18} />
            <span>설정 및 데이터 백업</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand brand">
            <Layers3 size={22} />
            with-ai<span className="brand-period">.</span>
          </div>
          <div className="breadcrumb">
            <span>내 작업 공간</span>
            <ChevronRight size={14} />
            <span>{project?.name ?? "새로운 시작"}</span>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <span />
              브라우저에 저장
            </span>
            <button
              className="icon-button"
              aria-label="설정 및 데이터 백업"
              onClick={() => setModal({ kind: "settings" })}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          {error && (
            <div
              className="storage-error"
              role="alert"
              aria-label="저장 데이터 오류"
            >
              <strong>저장 데이터 확인이 필요해요</strong>
              <p>{error}</p>
              <button className="button secondary" onClick={retryLoad}>
                다시 읽기
              </button>
              <button
                className="button secondary"
                onClick={() => setModal({ kind: "settings" })}
              >
                백업으로 복구
              </button>
            </div>
          )}
          {project ? (
            <>
              <button
                className="mobile-project-picker"
                onClick={() => setModal({ kind: "projects" })}
              >
                <Folder size={17} />
                <span>{project.name}</span>
                <ChevronDown size={17} />
              </button>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    <span />
                    나의 프로젝트
                  </p>
                  <h1>{project.name}</h1>
                  <p className="project-description">
                    {project.description ||
                      "작은 할 일부터, 하나씩 완성해 보세요."}
                  </p>
                </div>
                <button
                  className="icon-button project-menu"
                  aria-label="프로젝트 수정 및 삭제"
                  onClick={() =>
                    setModal({ kind: "project", projectId: project.id })
                  }
                >
                  <MoreHorizontal size={23} />
                </button>
              </div>
              <section
                className="progress-panel"
                aria-label="프로젝트 진행 상황"
              >
                <div className="progress-copy">
                  <p className="eyebrow">아이디어에서 완료까지</p>
                  <div className="progress-value">
                    <strong>
                      {summary.percent}
                      <span>%</span>
                    </strong>
                    <div>
                      <b>
                        {summary.completed} / {summary.total}개 완료
                      </b>
                      <p>계획한 작업을 차근차근</p>
                    </div>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="프로젝트 진행률"
                    aria-valuenow={summary.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${summary.percent}%` }} />
                  </div>
                  <p className="progress-help">
                    안 할 거 · 폐기 아이디어는 진행률에서 제외돼요.
                  </p>
                </div>
                <div className="progress-stats">
                  <div>
                    <span className="stat-icon">
                      <Layers3 size={20} />
                    </span>
                    <strong>{project.cards.length}</strong>
                    <span>전체 작업</span>
                  </div>
                  <div>
                    <span className="stat-icon yellow">
                      <CircleDashed size={20} />
                    </span>
                    <strong>{summary.counts.doing}</strong>
                    <span>진행 중</span>
                  </div>
                  <div>
                    <span className="stat-icon green">
                      <Check size={20} />
                    </span>
                    <strong>{summary.counts.done}</strong>
                    <span>완료한 작업</span>
                  </div>
                </div>
              </section>
              <section className="tasks-section" aria-label="작업 카드 목록">
                <div className="section-heading">
                  <div>
                    <h2>
                      작업 카드 <span>{project.cards.length}</span>
                    </h2>
                    <p>기록하고, 진행하고, AI와 함께 완성하세요.</p>
                  </div>
                  <button
                    className="button primary desktop-add"
                    disabled={!!error}
                    onClick={() => setModal({ kind: "card" })}
                  >
                    <Plus size={18} />새 작업 카드
                  </button>
                </div>
                <div className="card-search">
                  <label htmlFor="card-search">작업 검색</label>
                  <div className="card-search-input">
                    <Search size={18} aria-hidden="true" />
                    <input
                      id="card-search"
                      ref={searchRef}
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="제목, 내용, 진행 메모 검색"
                      autoComplete="off"
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="검색어 지우기"
                        onClick={() => {
                          setSearch("");
                          searchRef.current?.focus();
                        }}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                  <p role="status" aria-live="polite" aria-atomic="true">
                    {searchTerm
                      ? `검색 결과 ${cards.length}개`
                      : "제목부터 진행 메모까지 한 번에 찾아보세요."}
                  </p>
                </div>
                <div
                  className="filters"
                  role="group"
                  aria-label="작업 상태 필터"
                >
                  <button
                    aria-pressed={filter === "all"}
                    className={filter === "all" ? "selected" : ""}
                    onClick={() => setFilter("all")}
                  >
                    전체 <span>{project.cards.length}</span>
                  </button>
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      aria-pressed={filter === s.value}
                      className={`filter-${s.value} ${filter === s.value ? "selected" : ""}`}
                      onClick={() => setFilter(s.value)}
                    >
                      <span className={`filter-dot dot-${s.value}`} />
                      {s.label}
                      <span>{summary.counts[s.value]}</span>
                    </button>
                  ))}
                </div>
                {cards.length ? (
                  <div className="card-list">
                    {cards.map((card) => (
                      <button
                        key={card.id}
                        className={`task-card card-${card.status}`}
                        onClick={() =>
                          setModal({ kind: "detail", cardId: card.id })
                        }
                      >
                        <div className="card-top">
                          <Badge status={card.status} />
                          <ArrowUpRight className="card-arrow" size={19} />
                        </div>
                        <h3>{card.title}</h3>
                        <p className="card-description">
                          {card.description || "작업 설명을 추가해 보세요."}
                        </p>
                        <div className="card-bottom">
                          <span>{formatDate(card.updatedAt)} 수정</span>
                          <span>
                            {card.note.updatedAt
                              ? "진행 메모 있음"
                              : "메모 작성 전"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state tasks-empty">
                    <span className="empty-icon">
                      <Layers3 size={28} />
                    </span>
                    <h3>
                      {searchTerm
                        ? "검색 결과가 없어요"
                        : project.cards.length
                          ? "이 상태의 작업은 아직 없어요"
                          : "첫 번째 할 일을 적어 볼까요?"}
                    </h3>
                    <p>
                      {searchTerm
                        ? "검색어를 바꾸거나 상태 필터를 확인해 주세요."
                        : project.cards.length
                          ? "다른 상태를 선택해 작업을 확인하세요."
                          : "아이디어를 작은 작업으로 나누면 시작하기 쉬워져요."}
                    </p>
                    <button
                      className="button secondary"
                      disabled={!!error}
                      onClick={() => {
                        if (searchTerm || project.cards.length) {
                          setSearch("");
                          setFilter("all");
                        } else {
                          setModal({ kind: "card" });
                        }
                      }}
                    >
                      {searchTerm
                        ? "검색·필터 초기화"
                        : project.cards.length
                          ? "전체 작업 보기"
                          : "첫 작업 카드 만들기"}
                      <Plus size={17} />
                    </button>
                  </div>
                )}
              </section>
              <footer className="content-footer">
                <Sparkles size={15} />
                <span>한 장의 카드가, 다음 한 걸음이 되도록.</span>
              </footer>
            </>
          ) : (
            <section className="empty-state first-use">
              <p className="eyebrow">생각을 실행으로</p>
              <div className="intro-art" aria-hidden="true">
                <div className="mini-card">
                  <span className="mini-dot" />
                  <span />
                  <span />
                  <Check size={24} />
                </div>
                <div className="sparkle-mark">
                  <Sparkles size={28} />
                </div>
              </div>
              <h1>만들고 싶은 아이디어가 있나요?</h1>
              <p>
                프로젝트를 만들고, 할 일을 카드에 담아 보세요.
                <br />
                진행 메모부터 AI 작업 요청문까지 한곳에서 관리해요.
              </p>
              <button
                className="button primary"
                disabled={!!error}
                onClick={() => setModal({ kind: "project" })}
              >
                <Plus size={20} />첫 프로젝트 만들기
              </button>
              <p className="first-use-note">
                <ShieldCheck size={16} />
                로그인 없이 현재 브라우저에 저장돼요.
              </p>
            </section>
          )}
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="주요 작업">
        <button onClick={() => setModal({ kind: "projects" })}>
          <Folder size={20} />
          <span>프로젝트</span>
        </button>
        <button
          className="mobile-primary"
          disabled={!!error}
          onClick={() =>
            setModal(project ? { kind: "card" } : { kind: "project" })
          }
        >
          <Plus size={21} />
          <span>{project ? "작업 카드 추가" : "프로젝트 만들기"}</span>
        </button>
        <button onClick={() => setModal({ kind: "settings" })}>
          <Settings2 size={20} />
          <span>설정</span>
        </button>
      </nav>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="JSON 백업 파일"
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {!modal && notification}
      {modal?.kind === "projects" && (
        <Dialog
          notice={notification}
          title="내 프로젝트"
          subtitle="진행할 프로젝트를 선택하세요."
          onClose={() => setModal(null)}
        >
          {projectList}
        </Dialog>
      )}
      {modal?.kind === "project" && (
        <Dialog
          notice={notification}
          title={modal.projectId ? "프로젝트 수정" : "새 프로젝트"}
          subtitle="아이디어를 시작할 작은 공간을 만들어요."
          onClose={() => setModal(null)}
        >
          <ProjectForm
            project={data.projects.find((p) => p.id === modal.projectId)}
            onSave={saveProject}
            onClose={() => setModal(null)}
          />
          {modal.projectId && (
            <button
              className="button danger text-button"
              onClick={() =>
                setModal({
                  kind: "delete-project",
                  projectId: modal.projectId!,
                })
              }
            >
              <Trash2 size={16} />
              프로젝트 삭제
            </button>
          )}
        </Dialog>
      )}
      {modal?.kind === "card" && project && (
        <Dialog
          notice={notification}
          title={modal.cardId ? "작업 카드 수정" : "새 작업 카드"}
          subtitle={project.name}
          onClose={() => setModal(null)}
          wide
        >
          <CardForm
            key={modal.cardId ?? "new"}
            card={selectedCard}
            onSave={saveCard}
            onClose={() => setModal(null)}
          />
        </Dialog>
      )}
      {modal?.kind === "detail" && selectedCard && (
        <Dialog
          notice={notification}
          title={selectedCard.title}
          onClose={() => setModal(null)}
          wide
        >
          <CardDetail
            key={selectedCard.id}
            card={selectedCard}
            onEdit={() => setModal({ kind: "card", cardId: selectedCard.id })}
            onDelete={() =>
              setModal({ kind: "delete-card", cardId: selectedCard.id })
            }
            onNoteSave={saveNote}
            onPrompt={() =>
              setModal({ kind: "prompt", cardId: selectedCard.id })
            }
          />
        </Dialog>
      )}
      {modal?.kind === "prompt" && selectedCard && project && (
        <Dialog
          notice={notification}
          title="AI 작업 요청문"
          subtitle="미리 확인하고 수정한 뒤 복사하세요."
          onClose={() => setModal({ kind: "detail", cardId: selectedCard.id })}
          wide
        >
          <button
            className="text-button button small"
            onClick={() =>
              setModal({ kind: "detail", cardId: selectedCard.id })
            }
          >
            <ArrowLeft size={16} />
            카드로 돌아가기
          </button>
          <PromptEditor project={project} card={selectedCard} />
        </Dialog>
      )}
      {modal?.kind === "delete-project" && (
        <Dialog
          notice={notification}
          title="프로젝트를 삭제할까요?"
          onClose={() => setModal(null)}
        >
          <p className="confirm-copy">
            <strong>
              {data.projects.find((p) => p.id === modal.projectId)?.name}
            </strong>
            의 모든 작업 카드와 진행 메모가 함께 삭제돼요. 삭제 후에는 되돌릴 수
            없어요.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              취소
            </button>
            <button
              className="button danger filled"
              onClick={() => removeProject(modal.projectId)}
            >
              프로젝트 삭제
            </button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "delete-card" && (
        <Dialog
          notice={notification}
          title="작업 카드를 삭제할까요?"
          onClose={() => setModal(null)}
        >
          <p className="confirm-copy">
            작업 카드와 진행 메모가 함께 삭제돼요. 삭제 후에는 되돌릴 수 없어요.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() =>
                setModal(
                  selectedCard
                    ? { kind: "detail", cardId: selectedCard.id }
                    : null,
                )
              }
            >
              취소
            </button>
            <button
              className="button danger filled"
              onClick={() => removeCard(modal.cardId)}
            >
              카드 삭제
            </button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "settings" && (
        <Dialog
          notice={notification}
          title="설정 및 데이터 백업"
          subtitle="소중한 아이디어를 안전하게 보관하세요."
          onClose={() => setModal(null)}
        >
          <div className="info-box">
            <ShieldCheck size={21} />
            <div>
              <strong>현재 브라우저에만 저장돼요</strong>
              <p>
                로그인과 서버 저장 없이 localStorage를 사용해요. 다른
                기기·브라우저와 자동 동기화되지 않으며, 브라우저 데이터를
                지우거나 시크릿 창을 닫으면 사라질 수 있어요. 중요한 기록은 JSON
                파일로 백업해 주세요.
              </p>
            </div>
          </div>
          <div className="backup-actions">
            <button disabled={!!error} onClick={exportData}>
              <span className="backup-icon">
                <ArrowDownToLine size={23} />
              </span>
              <span>
                <strong>JSON 내보내기</strong>
                <small>모든 프로젝트·카드·진행 메모를 백업해요.</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => fileRef.current?.click()}>
              <span className="backup-icon">
                <ArrowUpFromLine size={23} />
              </span>
              <span>
                <strong>JSON 가져오기</strong>
                <small>형식 확인 후 기존 데이터를 교체해요. 최대 5MB</small>
              </span>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="settings-footnote">
            <p>
              이 기기에 프로젝트 {data.projects.length}개 · 작업 카드{" "}
              {data.projects.reduce((n, p) => n + p.cards.length, 0)}개가
              있어요.
            </p>
            <p>
              GitHub 연동 · AI API · 자동 코드 실행 · PWA 설치는 후속 버전에서
              다룰 예정이에요.
            </p>
          </div>
        </Dialog>
      )}
      {modal?.kind === "import" && (
        <Dialog
          notice={notification}
          title="백업 데이터로 교체할까요?"
          onClose={() => setModal({ kind: "settings" })}
        >
          <p className="confirm-copy">
            <strong className="break-all">{modal.filename}</strong>
            <br />
            프로젝트 {modal.data.projects.length}개 · 작업 카드{" "}
            {modal.data.projects.reduce((n, p) => n + p.cards.length, 0)}개를
            확인했어요.
          </p>
          <div className="import-warning">
            기존 프로젝트 {data.projects.length}개와 모든 카드·메모를 교체해요.
            현재 데이터는 먼저 내보내 두는 것을 권장해요.
          </div>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setModal({ kind: "settings" })}
            >
              취소
            </button>
            <button
              className="button primary"
              onClick={() => {
                if (persist(modal.data, "백업 데이터를 가져왔어요.", true)) {
                  setActiveId(null);
                  setFilter("all");
                  setSearch("");
                  setModal(null);
                }
              }}
            >
              데이터 교체
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
