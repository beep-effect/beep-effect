import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

export { chromium } from "playwright";

export const chromiumPath = "/usr/bin/chromium";

export const launchOptions = { executablePath: chromiumPath, headless: true } as const;

export const chromiumInstalled = await FileSystem.FileSystem.pipe(
  Effect.flatMap((fs) => fs.exists(chromiumPath)),
  Effect.orElseSucceed(() => false),
  Effect.provide(NodeFileSystem.layer),
  Effect.runPromise
);
