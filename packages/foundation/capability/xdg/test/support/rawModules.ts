// The package's own source and the frozen systemd-path fixture as module data.
// Vite's raw glob inlines each file's text at transform time, so the closure and
// golden suites read no filesystem at test time.

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

/** The subset of Vite's `import.meta.glob` signature these loaders use. */
interface RawGlobOptions {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: RawGlobOptions): Record<string, T>;
  }
}

const sources = import.meta.glob<string>("../../src/**/*.ts", { query: "?raw", import: "default", eager: true });

const fixtures = import.meta.glob<string>("../fixtures/*.json", { query: "?raw", import: "default", eager: true });

/** Every `src` module, keyed by its path below `src/` (`Xdg.ts`, `Absolute.ts`). */
export const sourceModules: Readonly<Record<string, string>> = R.fromEntries(
  A.map(R.toEntries(sources), ([key, text]) => [Str.replace("../../src/", "")(key), text] as const)
);

/** The text of one fixture file under `test/fixtures/`. */
export const fixtureText = (name: string): string => O.getOrThrow(R.get(fixtures, `../fixtures/${name}`));
