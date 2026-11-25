interface RawGlobOptions {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

interface ImportMeta {
  glob<T>(pattern: string | ReadonlyArray<string>, options: RawGlobOptions): Record<string, T>;
}
