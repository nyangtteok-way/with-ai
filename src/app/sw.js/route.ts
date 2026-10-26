import { SERVICE_WORKER_SOURCE } from "../../lib/service-worker-source";

export const dynamic = "force-static";

export function GET() {
  return new Response(SERVICE_WORKER_SOURCE, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
