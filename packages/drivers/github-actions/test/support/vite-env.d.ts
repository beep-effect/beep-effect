// The subset of Vite's `import.meta.glob` signature the source scans use: Vite
// inlines each matched module's raw text at transform time, so the confinement,
// ambient-read and declassification suites read `src` without a filesystem and
// run the same under Node and Bun.

/** Options for an eager, raw-text glob import. */
interface RawGlobOptions {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

interface ImportMeta {
  glob<T>(pattern: string, options: RawGlobOptions): Record<string, T>;
}
