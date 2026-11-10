// The subset of Vite's `import.meta.glob` signature the law-practice-server suites use. Vite inlines
// each matched file's raw UTF-8 text at transform time, so a suite that guards checked-in test
// sources or package config reads them without a filesystem service (the repo-cli and
// repo-workspaces `test/support/vite-env.d.ts` precedent).

/** Options for an eager, raw-text glob import. */
interface RawGlobOptions {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

interface ImportMeta {
  glob<T>(pattern: string | ReadonlyArray<string>, options: RawGlobOptions): Record<string, T>;
}
