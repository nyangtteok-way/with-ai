"use client";

import { useSyncExternalStore } from "react";
import type { Project } from "./model";

export const ACTIVE_PROJECT_KEY = "with-ai:active-project:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(storage?: StorageLike): StorageLike {
  return storage ?? globalThis.localStorage;
}

// Read once per loaded document. A selection made in another tab must not
// switch this tab while the user is editing a card, note, or prompt.
let initialProjectId: string | null | undefined;

function subscribe() {
  return () => undefined;
}

function getSnapshot() {
  if (initialProjectId === undefined) {
    try {
      initialProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    } catch {
      initialProjectId = null;
    }
  }
  return initialProjectId;
}

function getServerSnapshot() {
  return null;
}

export function useInitialActiveProjectId() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function resetInitialActiveProjectId() {
  initialProjectId = null;
}

export function resolveActiveProjectId(
  projects: readonly Pick<Project, "id">[],
  projectId: string | null,
) {
  return projectId !== null && projects.some((project) => project.id === projectId)
    ? projectId
    : null;
}

export function saveActiveProjectId(
  projectId: string | null,
  storage?: StorageLike,
) {
  try {
    const target = getStorage(storage);
    if (projectId === null) target.removeItem(ACTIVE_PROJECT_KEY);
    else target.setItem(ACTIVE_PROJECT_KEY, projectId);
    return true;
  } catch {
    return false;
  }
}
