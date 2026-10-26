export const APP_SHELL_CACHE_PREFIX = "with-ai-app-shell-";
export const APP_SHELL_CACHE_NAME = `${APP_SHELL_CACHE_PREFIX}v1`;

export const SERVICE_WORKER_SOURCE = String.raw`
const CACHE_PREFIX = ${JSON.stringify(APP_SHELL_CACHE_PREFIX)};
const CACHE_NAME = ${JSON.stringify(APP_SHELL_CACHE_NAME)};
const FIXED_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

function absoluteUrl(path) {
  return new URL(path, self.location.origin).href;
}

function appShellAssets(html) {
  const assets = new Set(FIXED_ASSETS);
  const attributePattern = /\b(?:src|href)=["']([^"']+)["']/gi;
  let match;

  while ((match = attributePattern.exec(html)) !== null) {
    const url = new URL(match[1], self.location.origin);
    if (
      url.origin === self.location.origin &&
      url.pathname.startsWith("/_next/static/")
    ) {
      assets.add(url.pathname + url.search);
    }
  }

  return [...assets];
}

async function fetchForCache(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("앱 셸 파일을 가져오지 못했습니다: " + path);
  }
  return response;
}

async function updateAppShell(pageResponse) {
  if (!pageResponse.ok) {
    throw new Error("앱 화면을 가져오지 못했습니다.");
  }

  const html = await pageResponse.clone().text();
  const assets = appShellAssets(html);
  const cache = await caches.open(CACHE_NAME);

  // 새 화면이 참조하는 파일을 모두 확보한 뒤에만 오프라인 시작 화면을
  // 교체한다. 연결이 중간에 끊기면 마지막 정상 셸을 계속 사용한다.
  await Promise.all(
    assets.map(async (path) => {
      const response = await fetchForCache(path);
      await cache.put(path, response);
    }),
  );
  await cache.put("/", pageResponse);

  const keep = new Set(["/", ...assets].map(absoluteUrl));
  const requests = await cache.keys();
  await Promise.all(
    requests.map((request) => {
      const url = new URL(request.url);
      if (
        url.origin === self.location.origin &&
        url.pathname.startsWith("/_next/static/") &&
        !keep.has(request.url)
      ) {
        return cache.delete(request);
      }
      return Promise.resolve(false);
    }),
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function cachedNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const exact = await cache.match(request, { ignoreSearch: true });
  return exact || cache.match("/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetchForCache("/")
      .then(updateAppShell)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const network = fetch(request).then((response) => ({
      response,
      cacheResponse:
        response.ok && response.type === "basic" ? response.clone() : null,
    }));
    event.waitUntil(
      network
        .then(({ cacheResponse }) =>
          cacheResponse ? updateAppShell(cacheResponse) : undefined,
        )
        .catch(() => undefined),
    );
    event.respondWith(
      network
        .then(({ response }) => response)
        .catch(() => cachedNavigation(request)),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    FIXED_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
`;
