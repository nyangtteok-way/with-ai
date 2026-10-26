"use client";

import { useSyncExternalStore } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Code2,
  LoaderCircle,
  WifiOff,
} from "lucide-react";
import {
  getServerServiceWorkerStatus,
  getServiceWorkerStatus,
  subscribeToServiceWorkerStatus,
  type ServiceWorkerStatus,
} from "@/lib/service-worker-status";

const STATUS_COPY: Record<
  ServiceWorkerStatus,
  { title: string; description: string }
> = {
  checking: {
    title: "오프라인 준비 확인 중",
    description: "이 브라우저의 앱 준비 상태를 확인하고 있어요.",
  },
  preparing: {
    title: "오프라인 사용 준비 중",
    description:
      "연결이 끊기기 전에 잠시 기다려 주세요. 설정을 닫아도 준비는 계속돼요.",
  },
  ready: {
    title: "오프라인 사용 준비됨",
    description:
      "이제 네트워크 없이 앱을 다시 열거나 새로고침해도 저장한 내용을 볼 수 있어요.",
  },
  unsupported: {
    title: "오프라인 재실행 미지원",
    description:
      "이 브라우저에서는 먼저 네트워크에 연결해 앱을 열어야 해요.",
  },
  development: {
    title: "개발 모드에서는 준비 안 함",
    description:
      "배포된 프로덕션 앱에서 실제 오프라인 준비 상태를 확인할 수 있어요.",
  },
  error: {
    title: "오프라인 준비 실패",
    description:
      "연결을 확인하고 앱을 다시 열어 주세요. 저장한 데이터와 JSON 백업에는 영향이 없어요.",
  },
};

function StatusIcon({ status }: { status: ServiceWorkerStatus }) {
  if (status === "ready") return <CheckCircle2 aria-hidden="true" />;
  if (status === "error") return <CircleAlert aria-hidden="true" />;
  if (status === "unsupported") return <WifiOff aria-hidden="true" />;
  if (status === "development") return <Code2 aria-hidden="true" />;
  return <LoaderCircle aria-hidden="true" />;
}

export function OfflinePreparationStatus() {
  const status = useSyncExternalStore(
    subscribeToServiceWorkerStatus,
    getServiceWorkerStatus,
    getServerServiceWorkerStatus,
  );
  const copy = STATUS_COPY[status];

  return (
    <div
      className={`offline-preparation offline-preparation-${status}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <StatusIcon status={status} />
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
      </div>
    </div>
  );
}
