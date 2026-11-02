"use client";

import { useSyncExternalStore } from "react";
import type { CardSort } from "./model";

export const CARD_SORT_KEY = "with-ai:card-sort:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function getStorage(storage?: StorageLike): StorageLike {
  return storage ?? globalThis.localStorage;
}

export function parseCardSort(value: string | null): CardSort {
  return value === "important" || value === "recent" ? value : "default";
}

// Read once per loaded document. A preference changed in another tab must not
// reorder this tab while the user is choosing or editing a card.
let initialCardSort: CardSort | undefined;

function subscribe() {
  return () => undefined;
}

function getSnapshot() {
  if (initialCardSort === undefined) {
    try {
      initialCardSort = parseCardSort(localStorage.getItem(CARD_SORT_KEY));
    } catch {
      initialCardSort = "default";
    }
  }
  return initialCardSort;
}

function getServerSnapshot(): CardSort {
  return "default";
}

export function useInitialCardSort() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function saveCardSort(sort: CardSort, storage?: StorageLike) {
  try {
    getStorage(storage).setItem(CARD_SORT_KEY, sort);
    return true;
  } catch {
    return false;
  }
}
