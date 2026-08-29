// fallow-ignore-file unused-file -- Serwist webpack compiles this service-worker entry outside the app tsgo graph
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// Service worker entry compiled by `@serwist/webpack-plugin` (via `withSerwistInit`
// in `@beep/repo-configs/next`) during `next build --webpack`. It is excluded from
// the app's tsgo project because a service worker needs the WebWorker lib globals
// (`self: ServiceWorkerGlobalScope`), which conflict with the app's DOM lib; the
// serwist webpack loader supplies the worker context and compiles this file.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
