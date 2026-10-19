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

export function NoteHistory({ notes }: { notes: ProgressNote[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  return (
    <details className="note-history">
      <summary>이전 메모 {notes.length}개</summary>
      <p className="note-history-help">
        {notes.length
          ? "최근에 교체된 순서예요. 펼쳐 봐도 현재 메모나 초안은 바뀌지 않아요. AI 요청문에는 최신 메모만 사용해요."
          : "메모 내용을 바꿔 저장하면 이전 기록이 여기에 남아요. 이 기능을 사용하기 전에 덮어쓴 메모는 복구할 수 없어요."}
      </p>
      {notes.length > 0 && (
        <ol className="note-history-list" aria-label="이전 진행 메모">
          {notes.slice(0, visibleCount).map((note, index) => (
            <li key={`${notes.length - index}-${note.updatedAt}`}>
              <details>
                <summary>
                  {index + 1}.{" "}
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
              </details>
            </li>
          ))}
        </ol>
      )}
      {notes.length > visibleCount && (
        <button
          className="button secondary"
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          이전 메모 더 보기 ({notes.length - visibleCount}개 남음)
        </button>
      )}
    </details>
  );
}
