"use client";
import { useEffect } from "react";

export type UnsavedChangeHandler = (
  dirty: boolean,
  onDiscard?: () => boolean,
) => void;

export function useUnsavedChanges(
  dirty: boolean,
  onDirtyChange: UnsavedChangeHandler,
  onDiscard?: () => boolean,
) {
  useEffect(() => {
    onDirtyChange(dirty, dirty ? onDiscard : undefined);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange, onDiscard]);

  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
}
