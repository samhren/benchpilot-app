import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry } from "serwist";
import { Serwist } from "serwist";
import { APP_VERSION } from "../lib/version";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Bumping APP_VERSION changes this file's bytes, so the browser fetches and
// installs a fresh service worker on the next visit; skipWaiting + clientsClaim
// (above) then activate it immediately, pulling new code to every client —
// including iOS home-screen PWAs. The log also records which build is live.
self.addEventListener("install", () => {
  console.info(`[sw] BenchPilot ${APP_VERSION} installing`);
});
