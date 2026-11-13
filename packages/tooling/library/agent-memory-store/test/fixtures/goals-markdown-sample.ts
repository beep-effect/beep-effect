/**
 * Schema, loader and folder writer for `goals-markdown-sample.json.gz`, the
 * frozen stratified sample of tracked `goals/**` Markdown that the AC-1 and
 * AC-8 tests import. `build-goals-markdown-sample.ts` regenerates it.
 *
 * Labeller: the agent-memory-store-p1 lane built this fixture and assigned
 * its strata; no other labeller contributed.
 */
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

export const SampleStratum = LiteralKit([
  "table",
  "nestedList",
  "fencedCode",
  "frontmatter",
  "html",
  "blockQuote",
  "nonAscii",
  "noTrailingNewline",
  "plain",
  "long",
  "synthetic",
]);

export type SampleStratum = typeof SampleStratum.Type;

export class SampleFile extends S.Class<SampleFile, { readonly brand: unique symbol }>("SampleFile")({
  path: S.String,
  text: S.String,
  stratum: SampleStratum,
}) {
  static readonly byPath: Order.Order<SampleFile> = Order.mapInput(Order.String, (file: SampleFile) => file.path);
}

export class GoalsMarkdownSample extends S.Class<GoalsMarkdownSample, { readonly brand: unique symbol }>(
  "GoalsMarkdownSample"
)({
  commit: S.String,
  files: S.Array(SampleFile),
}) {}

const decodeSample = S.decodeUnknownEffect(S.fromJsonString(GoalsMarkdownSample));

const fixtureUrl = new URL("./goals-markdown-sample.json.gz", import.meta.url);

/** Reads and decodes the packed fixture. */
export const loadGoalsMarkdownSample = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fixture = yield* path.fromFileUrl(fixtureUrl);
  const packed = yield* fs.readFile(fixture);
  const json = yield* Effect.promise(() =>
    new Response(new Blob([new Uint8Array(packed)]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
  );
  return yield* decodeSample(json);
});

/** Writes every sample file under `root`, creating parent folders. */
export const writeSampleFolder = Effect.fnUntraced(function* (
  root: string,
  files: ReadonlyArray<Pick<SampleFile, "path" | "text">>
) {
  const fs = yield* FileSystem.FileSystem;
  for (const file of files) {
    const target = `${root}/${file.path}`;
    const directory = O.match(Str.lastIndexOf("/")(target), {
      onNone: () => root,
      onSome: (cut) => Str.slice(0, cut)(target),
    });
    yield* fs.makeDirectory(directory, { recursive: true });
    yield* fs.writeFile(target, new TextEncoder().encode(file.text));
  }
});

/** Total UTF-8 size of the sample's Markdown. */
export const sampleBytes = (files: ReadonlyArray<SampleFile>): number =>
  A.reduce(files, 0, (total, file) => total + new TextEncoder().encode(file.text).length);
