"use client";

import { useState } from "react";
import type { ProgressNote } from "@/lib/model";

const PAGE_SIZE = 10;
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function NoteHistory({
  notes,
  onReuse,
}: {
  notes: ProgressNote[];
  onReuse: (note: ProgressNote) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const searchTerm = query.trim().toLocaleLowerCase("ko-KR");
  const matchingNotes = notes
    .map((note, index) => ({ note, index }))
    .filter(
      ({ note }) =>
        !searchTerm ||
        [note.done, note.blocked, note.next].some((value) =>
          value.toLocaleLowerCase("ko-KR").includes(searchTerm),
        ),
    );
  return (
    <details className="note-history">
      <summary>이전 메모 {notes.length}개</summary>
      <p className="note-history-help">
        {notes.length
          ? "최근에 교체된 순서예요. 기록을 찾거나 펼쳐 봐도 현재 입력은 바뀌지 않아요. 불러온 기록도 메모 저장 전까지는 초안이며, AI 요청문에는 최신 저장 메모만 사용해요."
          : "메모 내용을 바꿔 저장하면 이전 기록이 여기에 남아요. 이 기능을 사용하기 전에 덮어쓴 메모는 복구할 수 없어요."}
      </p>
      {notes.length > 0 && (
        <div className="note-history-search">
          <label htmlFor="note-history-search">이전 메모 검색</label>
          <div>
            <input
              id="note-history-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="한 일, 막힌 점, 다음 할 일"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                지우기
              </button>
            )}
          </div>
          <p role="status" aria-live="polite">
            {searchTerm
              ? `${matchingNotes.length}개의 이전 메모를 찾았어요.`
              : `전체 ${notes.length}개의 이전 메모가 있어요.`}
          </p>
        </div>
      )}
      {matchingNotes.length > 0 && (
        <ol className="note-history-list" aria-label="이전 진행 메모">
          {matchingNotes
            .slice(0, visibleCount)
            .map(({ note, index: noteIndex }) => (
              <li key={`${notes.length - noteIndex}-${note.updatedAt}`}>
                <details>
                  <summary>
                    {noteIndex + 1}.{" "}
                    {note.updatedAt ? (
                      <time dateTime={note.updatedAt}>
                        {dateFormatter.format(new Date(note.updatedAt))}
                      </time>
                    ) : (
                      "저장 시각 없음"
                    )}
                  </summary>
                  <dl>
                    {(
                      [
                        ["한 일", note.done],
                        ["막힌 점", note.blocked],
                        ["다음 할 일", note.next],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd className="preserve-lines">
                          {value || "작성하지 않았어요."}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    className="button secondary note-history-reuse"
                    type="button"
                    onClick={() => onReuse(note)}
                  >
                    이 기록을 현재 메모로 불러오기
                  </button>
                </details>
              </li>
            ))}
        </ol>
      )}
      {notes.length > 0 && matchingNotes.length === 0 && (
        <p className="note-history-empty">
          검색어와 일치하는 이전 메모가 없어요.
        </p>
      )}
      {matchingNotes.length > visibleCount && (
        <button
          className="button secondary"
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          이전 메모 더 보기 ({matchingNotes.length - visibleCount}개 남음)
        </button>
      )}
    </details>
  );
}
