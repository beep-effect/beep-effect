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

const corpusInlinedAtTransform = import.meta.glob<string>("../fixtures/codec-corpus/*/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** One corpus file: the codec lane (its directory), its name and its text. */
export interface CorpusFixture {
  readonly lane: string;
  readonly name: string;
  readonly text: string;
}

/** Every corpus file, in glob order. */
export const corpusFixtures: ReadonlyArray<CorpusFixture> = A.map(
  R.toEntries(corpusInlinedAtTransform),
  ([key, text]) => {
    const [lane = "", name = ""] = A.takeRight(Str.split(key, "/"), 2);
    return { lane, name, text };
  }
);

/** The text of one corpus file, addressed as `<lane>/<name>`. */
export const corpusText = (relative: string): string =>
  O.getOrThrow(R.get(corpusInlinedAtTransform, `../fixtures/codec-corpus/${relative}`));
