// The subset of Vite's `import.meta.glob` signature the repo-cli suites use. Vite inlines each
// matched file's raw UTF-8 text at transform time, so a suite reads checked-in repository files
// without a filesystem service (the repo-workspaces `test/support/vite-env.d.ts` precedent).

/** Options for an eager, raw-text glob import. */
interface RawGlobOptions {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

interface ImportMeta {
  glob<T>(pattern: string, options: RawGlobOptions): Record<string, T>;
}
