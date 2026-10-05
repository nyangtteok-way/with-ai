"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Dialog({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  notice,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  notice?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
      {notice}
    </dialog>
  );
}
