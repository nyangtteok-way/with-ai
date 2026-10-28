"use client";

import { useEffect } from "react";
import {
  APP_SHELL_CACHE_NAME,
  APP_SHELL_FINGERPRINT_PATH,
  APP_SHELL_FIXED_ASSETS,
  APP_SHELL_UPDATED_MESSAGE,
  createAppShellFingerprint,
} from "@/lib/service-worker-contract";
import {
  getServiceWorkerStatus,
  setServiceWorkerStatus,
} from "@/lib/service-worker-status";

type BrowserServiceWorkerRegistration = Awaited<
  ReturnType<ServiceWorkerContainer["register"]>
>;

function waitForWorkerActivation(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const handleStateChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", handleStateChange);
        resolve();
      } else if (worker.state === "redundant") {
        worker.removeEventListener("statechange", handleStateChange);
        reject(new Error("서비스 워커를 활성화하지 못했습니다."));
      }
    };

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });
}

async function waitForReadyWorker(
  registration: BrowserServiceWorkerRegistration,
) {
  if (!registration.active) {
    const pendingWorker = registration.installing ?? registration.waiting;
    if (pendingWorker) await waitForWorkerActivation(pendingWorker);
  }
  await navigator.serviceWorker.ready;
}

function currentAppShellFingerprint() {
  const assets = new Set<string>(APP_SHELL_FIXED_ASSETS);

  document.querySelectorAll<HTMLElement>("[src], [href]").forEach((element) => {
    const path = element.getAttribute("src") ?? element.getAttribute("href");
    if (!path) return;

    try {
      const url = new URL(path, window.location.origin);
      if (
        url.origin === window.location.origin &&
        url.pathname.startsWith("/_next/static/")
      ) {
        assets.add(url.pathname + url.search);
      }
    } catch {
      // 현재 문서의 잘못된 URL은 앱 셸 지문에서 제외한다.
    }
  });

  return createAppShellFingerprint(assets);
}

async function cachedAppShellFingerprint() {
  if (!("caches" in window) || !(await caches.has(APP_SHELL_CACHE_NAME))) {
    return null;
  }

  const cache = await caches.open(APP_SHELL_CACHE_NAME);
  const response = await cache.match(APP_SHELL_FINGERPRINT_PATH);
  return response ? response.text() : null;
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      setServiceWorkerStatus("development");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      setServiceWorkerStatus("unsupported");
      return;
    }

    let disposed = false;
    const alreadyReady = Boolean(navigator.serviceWorker.controller);
    setServiceWorkerStatus(alreadyReady ? "ready" : "preparing");

    const markLatestIfCurrent = async (fingerprint?: string) => {
      try {
        const prepared = fingerprint ?? (await cachedAppShellFingerprint());
        if (
          !disposed &&
          prepared !== null &&
          prepared === currentAppShellFingerprint()
        ) {
          setServiceWorkerStatus("updated");
        }
      } catch {
        // 지문 확인 실패는 기존의 오프라인 준비 상태를 유지한다.
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        typeof data === "object" &&
        data !== null &&
        data.type === APP_SHELL_UPDATED_MESSAGE &&
        typeof data.fingerprint === "string"
      ) {
        void markLatestIfCurrent(data.fingerprint);
      }
    };
    const handleControllerChange = () => {
      void markLatestIfCurrent();
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    if (alreadyReady) void markLatestIfCurrent();

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(waitForReadyWorker)
      .then(async () => {
        if (disposed) return;
        if (getServiceWorkerStatus() !== "updated") {
          setServiceWorkerStatus("ready");
        }
        await markLatestIfCurrent();
      })
      .catch(() => {
        if (!disposed && !alreadyReady) setServiceWorkerStatus("error");
      });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  return null;
}
