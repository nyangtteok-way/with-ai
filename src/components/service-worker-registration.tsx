"use client";

import { useEffect } from "react";
import { setServiceWorkerStatus } from "@/lib/service-worker-status";

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

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(waitForReadyWorker)
      .then(() => {
        if (!disposed) setServiceWorkerStatus("ready");
      })
      .catch(() => {
        if (!disposed && !alreadyReady) setServiceWorkerStatus("error");
      });

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
