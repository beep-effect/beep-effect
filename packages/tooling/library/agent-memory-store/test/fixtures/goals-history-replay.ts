/**
 * Schema and loader for `goals-history-replay.json.gz`, the frozen AC-3
 * replay of this repository's own `goals/**` history: sequential agent
 * sessions replayed as concurrent writers of one file, every writer of a
 * cluster starting from the cluster's one base. `build-goals-history-replay.ts`
 * regenerates it from public git history; the tests read only this file.
 *
 * The construction rule is fixed in decision
 * `p2-ac3-history-replay-construction`. The file holds repository file texts
 * and commit shas only: each cluster's base text, and per writer the commits
 * of its session that produced its edit and that edit as line hunks against
 * the base.
 *
 * Labeller: the agent-memory-store-p2 lane built this replay; no other
 * labeller contributed and no spike trace is used.
 */
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/** One line hunk of a writer's edit: at base line `at`, `removed` lines leave and `text` goes in. */
export class ReplayHunk extends S.Class<ReplayHunk, { readonly brand: unique symbol }>("ReplayHunk")({
  at: S.Int,
  removed: S.Int,
  text: S.String,
}) {}

/** One writer of a cluster: the commits of its session's edit and the edit as hunks against the base. */
export class ReplayWriter extends S.Class<ReplayWriter, { readonly brand: unique symbol }>("ReplayWriter")({
  commits: S.Array(S.String),
  hunks: S.Array(ReplayHunk),
}) {}

const ReplayBaseKind = LiteralKit(["text", "delta"]);

/**
 * A cluster's base: its whole text, or line hunks against the base of an
 * earlier cluster (`from`, an index into the clusters) on the same path.
 */
export const ReplayBase = ReplayBaseKind.toTaggedUnion("kind")({
  text: { text: S.String },
  delta: { from: S.Int, hunks: S.Array(ReplayHunk) },
});

/** Runtime type for {@link ReplayBase}. */
export type ReplayBase = typeof ReplayBase.Type;

/** One cluster: one file's base and the writers that all edit it. */
export class ReplayCluster extends S.Class<ReplayCluster, { readonly brand: unique symbol }>("ReplayCluster")({
  path: S.String,
  base: ReplayBase,
  writers: S.Array(ReplayWriter),
}) {}

/** The frozen replay: the pinned commit, the trace's session count and its clusters in history order. */
export class GoalsHistoryReplay extends S.Class<GoalsHistoryReplay, { readonly brand: unique symbol }>(
  "GoalsHistoryReplay"
)({
  commit: S.String,
  sessions: S.Int,
  clusters: S.Array(ReplayCluster),
}) {}

const decodeReplay = S.decodeUnknownEffect(S.fromJsonString(GoalsHistoryReplay));

const fixtureUrl = new URL("./goals-history-replay.json.gz", import.meta.url);

/** Reads and decodes the packed replay. */
export const loadGoalsHistoryReplay = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fixture = yield* path.fromFileUrl(fixtureUrl);
  const packed = yield* fs.readFile(fixture);
  const json = yield* Effect.promise(() =>
    new Response(new Blob([new Uint8Array(packed)]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
  );
  return yield* decodeReplay(json);
});

/** Splits a text into lines, each keeping its newline; a last line without one stays. */
export const linesOf = (text: string): ReadonlyArray<string> =>
  O.match(Str.match(/[^\n]*\n|[^\n]+$/g)(text), { onNone: () => [], onSome: A.fromIterable });

/** A writer's whole edited text: the base with the writer's hunks applied. */
export const writerText: {
  (hunks: ReadonlyArray<ReplayHunk>): (base: string) => string;
  (base: string, hunks: ReadonlyArray<ReplayHunk>): string;
} = dual(2, (base: string, hunks: ReadonlyArray<ReplayHunk>): string => {
  const lines = linesOf(base);
  const out: Array<string> = [];
  let at = 0;
  for (const hunk of hunks) {
    out.push(...A.take(A.drop(lines, at), hunk.at - at), hunk.text);
    at = hunk.at + hunk.removed;
  }
  out.push(...A.drop(lines, at));
  return A.join(out, "");
});

/** Every cluster's base text, in cluster order. */
export const baseTexts = (clusters: ReadonlyArray<ReplayCluster>): ReadonlyArray<string> => {
  const texts: Array<string> = [];
  for (const cluster of clusters) {
    texts.push(
      cluster.base.kind === "text" ? cluster.base.text : writerText(texts[cluster.base.from] ?? "", cluster.base.hunks)
    );
  }
  return texts;
};
