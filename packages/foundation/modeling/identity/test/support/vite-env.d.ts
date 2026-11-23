// The subset of Vite's `import.meta.glob` signature the term-stability suite uses. Vite inlines
// each matched source shard's raw UTF-8 text at transform time, so the suite reads the committed
// shards without touching a filesystem at test time.

/** Options for an eager, raw-text glob import. */
interface RawGlobOptions {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

interface ImportMeta {
  glob<T>(pattern: string, options: RawGlobOptions): Record<string, T>;
}
