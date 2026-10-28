export type ServiceWorkerStatus =
  | "checking"
  | "preparing"
  | "ready"
  | "updated"
  | "unsupported"
  | "development"
  | "error";

let currentStatus: ServiceWorkerStatus = "checking";
const listeners = new Set<() => void>();

export function getServiceWorkerStatus() {
  return currentStatus;
}

export function getServerServiceWorkerStatus(): ServiceWorkerStatus {
  return "checking";
}

export function setServiceWorkerStatus(status: ServiceWorkerStatus) {
  if (currentStatus === status) return;

  currentStatus = status;
  listeners.forEach((listener) => listener());
}

export function subscribeToServiceWorkerStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
