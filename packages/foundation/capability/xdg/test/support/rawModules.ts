import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

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
