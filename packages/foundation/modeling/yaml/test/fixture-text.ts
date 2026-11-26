// Checked-in fixtures and package sources as module data. Vite's glob import
// inlines every file's raw UTF-8 text at transform time (no newline
// normalization), so the suites receive strings without touching a
// filesystem at test time.

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

const fixtures = {
  ...import.meta.glob<string>("./fixtures/explicit-key/*.yaml", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob<string>("./fixtures/multi-doc/*.yaml", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob<string>("./fixtures/comment-fidelity/*.yaml", { query: "?raw", import: "default", eager: true }),
};

const sources = {
  ...import.meta.glob<string>("../src/YamlLint.ts", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob<string>("../src/YamlLintRule.ts", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob<string>("../src/internal/rules/*.ts", { query: "?raw", import: "default", eager: true }),
};

/**
 * The raw text of a checked-in fixture, addressed relative to `test/fixtures/`
 * (for example `"multi-doc/pnpm-lock-shape.yaml"`).
 */
export const fixtureText = (relative: string): string => O.getOrThrow(R.get(fixtures, `./fixtures/${relative}`));

/**
 * The raw text of a package source module, addressed relative to `src/`
 * (for example `"YamlLint.ts"` or `"internal/rules/truthy.ts"`).
 */
export const sourceText = (relative: string): string => O.getOrThrow(R.get(sources, `../src/${relative}`));

/** Every `.ts` module under `src/internal/rules/`, as `internal/rules/<file>` paths. */
export const ruleSourcePaths: ReadonlyArray<string> = A.map(
  A.filter(R.keys(sources), Str.startsWith("../src/internal/rules/")),
  Str.slice("../src/".length)
);
