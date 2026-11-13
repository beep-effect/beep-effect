/**
 * Builds `goals-history-replay.json.gz`, the frozen AC-3 replay: this
 * repository's own `goals/**` Markdown history up to one pinned commit,
 * sequential agent sessions replayed as concurrent writers of one file.
 *
 * Run it from the repository root and commit the output; the optional
 * argument names the pinned commit (default the one decision
 * `p2-ac3-history-replay-construction` fixes):
 *
 *   bun packages/tooling/library/agent-memory-store/test/fixtures/build-goals-history-replay.ts [commit]
 *
 * The rule, fixed in that decision before any admission outcome was measured:
 *
 * - Commits: every non-merge commit reachable from the pin that touches
 *   `goals/**` Markdown (`git log --no-merges -M`), in committer-time order.
 * - Sessions: consecutive commits naming the same first `Co-Authored-By` agent
 *   (none counts as an agent) with at most 30 minutes between them; the trace
 *   is the most recent 200 sessions.
 * - Writes: a session's net edit of one file along a continuous blob chain
 *   (added files and chain breaks start a new write; an added file never
 *   clusters).
 * - Clusters: a write whose base blob is the serial head of an open cluster on
 *   the same path, starting within two hours of the cluster's first write,
 *   joins it while it has fewer than eight writers; otherwise it opens a
 *   cluster. Only clusters of two or more writers are kept.
 * - Writer text: the first writer's own result; every later writer's own line
 *   delta (previous serial head to its result) moved onto the cluster's base,
 *   so every writer starts from the one base. A base line the earlier writers
 *   changed and this writer changed again takes this writer's text; a line an
 *   earlier writer inserted cannot be removed from the base, so only this
 *   writer's new text is kept; a hunk of an earlier writer that this writer
 *   replaced whole removes its base lines too.
 * - Exclusions: the generated goals index (`goals/INDEX.md`), and every
 *   cluster whose base or any writer text is over 200,000 UTF-8 bytes or holds
 *   U+FFFD (a blob that is not valid UTF-8).
 *
 * Every byte comes from `git cat-file` of the recorded blobs, never the index
 * or the working tree. The output holds file texts and commit shas only.
 *
 * Labeller: the agent-memory-store-p2 lane wrote this rule and is the only
 * labeller of the replay.
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  GoalsHistoryReplay,
  linesOf,
  ReplayBase,
  ReplayCluster,
  ReplayHunk,
  ReplayWriter,
} from "./goals-history-replay.ts";

/** S14's corpus commit, an ancestor of `origin/main`. */
const PINNED = "3f0261b37a0e98a0bcef4e5f0ef2c922b68e9fb2";
const SESSIONS = 200;
const SESSION_GAP_SECONDS = 30 * 60;
const WINDOW_SECONDS = 2 * 60 * 60;
const MAX_WRITERS = 8;
const MAX_BYTES = 200_000;
const EXCLUDED_PATHS = ["goals/INDEX.md"];

interface FileChange {
  readonly from: string;
  readonly newBlob: string;
  readonly oldBlob: string;
  readonly status: string;
  readonly to: string;
}

interface Commit {
  readonly agent: string;
  readonly files: ReadonlyArray<FileChange>;
  readonly sha: string;
  readonly time: number;
}

interface Session {
  readonly agent: string;
  readonly commits: Array<Commit>;
  end: number;
}

interface Edit {
  readonly base: string;
  readonly commits: Array<string>;
  path: string;
  result: string;
  readonly session: number;
  readonly start: number;
}

interface Cluster {
  readonly base: string;
  readonly path: string;
  serial: string;
  readonly start: number;
  readonly writers: Array<{
    readonly previous: string;
    readonly result: string;
    readonly commits: ReadonlyArray<string>;
  }>;
}

// --- History ---------------------------------------------------------------------

const zeroBlob = (blob: string): string => (/^0+$/.test(blob) ? "" : blob);

const rawHeader = /^:\d+ \d+ ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/;

// The raw `--raw -z` entries of one commit.
const changesOf = (body: string): ReadonlyArray<FileChange> => {
  const fields = A.map(Str.split(body, "\u0000"), Str.replace(/^\n+/, ""));
  const changes: Array<FileChange> = [];
  let at = 0;
  while (at < fields.length) {
    const header = O.getOrNull(Str.match(rawHeader)(fields[at] ?? ""));
    at += 1;
    if (header !== null) {
      const status = header[3] ?? "";
      const from = fields[at] ?? "";
      const to = status === "R" || status === "C" ? (fields[at + 1] ?? "") : from;
      at += status === "R" || status === "C" ? 2 : 1;
      changes.push({ status, from, to, oldBlob: zeroBlob(header[1] ?? ""), newBlob: zeroBlob(header[2] ?? "") });
    }
  }
  return changes;
};

const agentOf = (message: string): string =>
  O.match(Str.match(/^co-authored-by:\s*([^<\n]*)</im)(message), {
    onNone: () => "none",
    onSome: (found) => Str.toLowerCase(Str.trim(found[1] ?? "")),
  });

const commitOf = (record: string): Commit => {
  const [head = "", body = ""] = Str.split(record, "\u001f");
  const [sha = "", time = "0", message = ""] = Str.split(head, "\u0000");
  return { sha, time: Number(time), agent: agentOf(message), files: changesOf(body) };
};

const sessionsOf = (commits: ReadonlyArray<Commit>): ReadonlyArray<Session> => {
  const sessions: Array<Session> = [];
  for (const commit of commits) {
    const last = A.last(sessions);
    if (O.isSome(last) && last.value.agent === commit.agent && commit.time - last.value.end <= SESSION_GAP_SECONDS) {
      last.value.end = commit.time;
      last.value.commits.push(commit);
    } else {
      sessions.push({ agent: commit.agent, end: commit.time, commits: [commit] });
    }
  }
  return sessions;
};

// --- Writes ----------------------------------------------------------------------

// One file change of a session, against the session's open edits (in first-touch order).
const stepEdit = (open: Array<Edit>, done: Array<Edit>, session: number, commit: Commit, change: FileChange) => {
  const at = A.findFirstIndex(open, (edit) => edit.path === change.from);
  const current = O.map(at, (index) => open[index] as Edit);
  if (O.isSome(at)) {
    open.splice(at.value, 1);
  }
  if (change.status === "D") {
    done.push(...O.toArray(current));
    return;
  }
  if (O.isSome(current) && current.value.result === change.oldBlob) {
    current.value.result = change.newBlob;
    current.value.path = change.to;
    current.value.commits.push(commit.sha);
    open.push(current.value);
    return;
  }
  done.push(...O.toArray(current));
  open.push({
    session,
    path: change.to,
    base: change.oldBlob,
    result: change.newBlob,
    start: commit.time,
    commits: [commit.sha],
  });
};

const byStartThenSession: Order.Order<Edit> = Order.combine(
  Order.mapInput(Order.Number, (edit: Edit) => edit.start),
  Order.mapInput(Order.Number, (edit: Edit) => edit.session)
);

const editsOf = (sessions: ReadonlyArray<Session>): ReadonlyArray<Edit> => {
  const done: Array<Edit> = [];
  for (const [session, { commits }] of sessions.entries()) {
    const open: Array<Edit> = [];
    for (const commit of commits) {
      for (const change of commit.files) {
        stepEdit(open, done, session, commit, change);
      }
    }
    done.push(...open);
  }
  // Stable: equal starts keep session order and first-touch order.
  return A.sort(done, byStartThenSession);
};

const joins = (cluster: Cluster, edit: Edit): boolean =>
  edit.start - cluster.start <= WINDOW_SECONDS && cluster.writers.length < MAX_WRITERS && cluster.path === edit.path;

const clustersOf = (edits: ReadonlyArray<Edit>): ReadonlyArray<Cluster> => {
  const clusters: Array<Cluster> = [];
  const open = MutableHashMap.empty<string, Cluster>();
  for (const edit of A.filter(edits, (candidate) => Str.isNonEmpty(candidate.base))) {
    const writer = { result: edit.result, commits: edit.commits };
    const head = O.filter(MutableHashMap.get(open, edit.base), (cluster) => joins(cluster, edit));
    if (O.isSome(head)) {
      head.value.writers.push({ ...writer, previous: head.value.serial });
      MutableHashMap.remove(open, edit.base);
      head.value.serial = edit.result;
      MutableHashMap.set(open, edit.result, head.value);
    } else {
      const cluster: Cluster = {
        path: edit.path,
        base: edit.base,
        start: edit.start,
        serial: edit.result,
        writers: [{ ...writer, previous: edit.base }],
      };
      clusters.push(cluster);
      MutableHashMap.set(open, edit.result, cluster);
    }
  }
  return A.filter(clusters, (cluster) => cluster.writers.length >= 2 && !A.contains(EXCLUDED_PATHS, cluster.path));
};

// --- Line alignment and the move onto the base -------------------------------------

/** The matched line pairs of a longest common subsequence of `left` and `right`. */
const lcsPairs = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): ReadonlyArray<readonly [number, number]> => {
  let head = 0;
  while (head < left.length && head < right.length && left[head] === right[head]) {
    head += 1;
  }
  let tail = 0;
  while (
    tail < left.length - head &&
    tail < right.length - head &&
    left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) {
    tail += 1;
  }
  const pairs: Array<readonly [number, number]> = [];
  for (let at = 0; at < head; at += 1) {
    pairs.push([at, at]);
  }
  pairs.push(...middlePairs(left.slice(head, left.length - tail), right.slice(head, right.length - tail), head));
  for (let at = 0; at < tail; at += 1) {
    pairs.push([left.length - tail + at, right.length - tail + at]);
  }
  return pairs;
};

// The dynamic-programming LCS of the middle, offset by the common head.
const middlePairs = (left: ReadonlyArray<string>, right: ReadonlyArray<string>, offset: number) => {
  const n = left.length;
  const m = right.length;
  const table = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * (m + 1) + j] =
        left[i] === right[j]
          ? (table[(i + 1) * (m + 1) + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * (m + 1) + j] ?? 0, table[i * (m + 1) + j + 1] ?? 0);
    }
  }
  const pairs: Array<readonly [number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      pairs.push([i + offset, j + offset]);
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * (m + 1) + j] ?? 0) >= (table[i * (m + 1) + j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
};

/** A gap between matched pairs: lines `[from, to)` of the left side against `[into, intoEnd)` of the right. */
interface Gap {
  readonly from: number;
  readonly into: number;
  readonly intoEnd: number;
  readonly to: number;
}

const gapsOf = (pairs: ReadonlyArray<readonly [number, number]>, leftLength: number, rightLength: number) => {
  const gaps: Array<Gap> = [];
  let left = 0;
  let right = 0;
  for (const [at, into] of [...pairs, [leftLength, rightLength] as const]) {
    if (at > left || into > right) {
      gaps.push({ from: left, to: at, into: right, intoEnd: into });
    }
    left = at + 1;
    right = into + 1;
  }
  return gaps;
};

/** How the previous serial head maps onto the base: each previous line's base line, or -1 when an earlier writer inserted it. */
const previousOnBase = (base: ReadonlyArray<string>, previous: ReadonlyArray<string>) => {
  const onBase = new Int32Array(previous.length).fill(-1);
  const pairs = lcsPairs(base, previous);
  for (const [at, into] of pairs) {
    onBase[into] = at;
  }
  const earlier = gapsOf(pairs, base.length, previous.length);
  for (const gap of earlier) {
    const paired = Math.min(gap.to - gap.from, gap.intoEnd - gap.into);
    for (let k = 0; k < paired; k += 1) {
      onBase[gap.into + k] = gap.from + k;
    }
  }
  return { onBase, earlier };
};

/** Moves a writer's own delta (previous serial head to its result) onto the cluster base. */
const moveOntoBase = (baseText: string, previousText: string, resultText: string): string => {
  const base = linesOf(baseText);
  const previous = linesOf(previousText);
  const result = linesOf(resultText);
  const { onBase, earlier } = previousOnBase(base, previous);
  // The base position a previous line's hunk lands at: after the last base line at or before it.
  const positionAt = new Int32Array(previous.length + 1);
  for (let v = 0; v < previous.length; v += 1) {
    positionAt[v + 1] = (onBase[v] ?? -1) >= 0 ? (onBase[v] ?? 0) + 1 : (positionAt[v] ?? 0);
  }
  const removed = new Uint8Array(base.length);
  const gone = new Uint8Array(previous.length);
  const inserted = MutableHashMap.empty<number, Array<string>>();
  for (const gap of gapsOf(lcsPairs(previous, result), previous.length, result.length)) {
    for (let v = gap.from; v < gap.to; v += 1) {
      gone[v] = 1;
      if ((onBase[v] ?? -1) >= 0) {
        removed[onBase[v] ?? 0] = 1;
      }
    }
    const at = positionAt[gap.from] ?? 0;
    const lines = O.getOrElse(MutableHashMap.get(inserted, at), (): Array<string> => []);
    lines.push(...A.take(A.drop(result, gap.into), gap.intoEnd - gap.into));
    MutableHashMap.set(inserted, at, lines);
  }
  // A hunk of an earlier writer that this writer replaced whole removes its base lines too.
  for (const gap of earlier) {
    if (
      gap.to > gap.from &&
      gap.intoEnd > gap.into &&
      A.every(A.range(gap.into, gap.intoEnd - 1), (v) => gone[v] === 1)
    ) {
      removed.fill(1, gap.from, gap.to);
    }
  }
  const out: Array<string> = [];
  for (let p = 0; p <= base.length; p += 1) {
    out.push(...O.getOrElse(MutableHashMap.get(inserted, p), (): Array<string> => []));
    if (p < base.length && removed[p] !== 1) {
      out.push(base[p] ?? "");
    }
  }
  return A.join(out, "");
};

/** A writer's text as line hunks against the base. */
const hunksOf = (baseText: string, text: string): ReadonlyArray<ReplayHunk> => {
  const base = linesOf(baseText);
  const lines = linesOf(text);
  return A.map(gapsOf(lcsPairs(base, lines), base.length, lines.length), (gap) =>
    ReplayHunk.make({
      at: gap.from,
      removed: gap.to - gap.from,
      text: A.join(A.take(A.drop(lines, gap.into), gap.intoEnd - gap.into), ""),
    })
  );
};

// --- Output ----------------------------------------------------------------------

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

const admissible = (text: string): boolean => utf8Bytes(text) <= MAX_BYTES && !Str.includes("�")(text);

const encodeReplayJson = S.encodeEffect(S.fromJsonString(GoalsHistoryReplay));

// The base as hunks against the latest earlier kept base of the same path, when that is smaller.
const baseOf = (kept: ReadonlyArray<ReplayCluster>, texts: ReadonlyArray<string>, path: string, base: string) =>
  O.match(
    O.filter(
      O.map(
        A.findLastIndex(kept, (cluster) => cluster.path === path),
        (from) => ({
          from,
          hunks: hunksOf(texts[from] ?? "", base),
        })
      ),
      ({ hunks }) => A.reduce(hunks, 0, (total, hunk) => total + hunk.text.length) < base.length
    ),
    {
      onNone: () => ReplayBase.cases.text.make({ text: base }),
      onSome: ({ from, hunks }) => ReplayBase.cases.delta.make({ from, hunks }),
    }
  );

const replayClusterOf = (
  cluster: Cluster,
  blob: (id: string) => string,
  kept: ReadonlyArray<ReplayCluster>,
  bases: ReadonlyArray<string>
): O.Option<ReplayCluster> => {
  const base = blob(cluster.base);
  const texts = A.map(cluster.writers, (writer, index) =>
    index === 0 ? blob(writer.result) : moveOntoBase(base, blob(writer.previous), blob(writer.result))
  );
  if (!admissible(base) || !A.every(texts, admissible)) {
    return O.none();
  }
  return O.some(
    ReplayCluster.make({
      path: cluster.path,
      base: baseOf(kept, bases, cluster.path, base),
      writers: A.map(A.zip(cluster.writers, texts), ([writer, text]) =>
        ReplayWriter.make({ commits: writer.commits, hunks: hunksOf(base, text) })
      ),
    })
  );
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const digest = yield* Digest.Digest;
  const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..", "..");
  const git = (args: ReadonlyArray<string>) => spawner.string(ChildProcess.make("git", [...args], { cwd: root }));

  const requested = O.getOrElse(A.get(process.argv, 2), () => PINNED);
  const resolved = yield* git(["rev-parse", "--verify", `${requested}^{commit}`]);
  const commit = Str.trim(resolved);
  const log = yield* git([
    "log",
    "--no-merges",
    "--reverse",
    "--format=%x1e%H%x00%ct%x00%B%x1f",
    "--raw",
    "-z",
    "-M",
    "--no-abbrev",
    commit,
    "--",
    ":(glob)goals/**/*.md",
  ]);
  const commits = A.sort(
    A.map(A.drop(Str.split(log, "\u001e"), 1), commitOf),
    Order.mapInput(Order.Number, (entry: Commit) => entry.time)
  );
  const sessions = A.takeRight(sessionsOf(commits), SESSIONS);
  const clusters = clustersOf(editsOf(sessions));
  const blobIds = A.dedupe(
    A.flatMap(clusters, (cluster) => [
      cluster.base,
      ...A.flatMap(cluster.writers, (writer) => [writer.previous, writer.result]),
    ])
  );
  const read = yield* Effect.forEach(
    blobIds,
    (id) => Effect.map(git(["cat-file", "blob", id]), (text) => [id, text] as const),
    { concurrency: 8 }
  );
  const blobs = MutableHashMap.fromIterable(read);
  const blob = (id: string): string => O.getOrElse(MutableHashMap.get(blobs, id), () => "");
  const kept: Array<ReplayCluster> = [];
  const texts: Array<string> = [];
  for (const cluster of clusters) {
    for (const replayCluster of O.toArray(replayClusterOf(cluster, blob, kept, texts))) {
      kept.push(replayCluster);
      texts.push(blob(cluster.base));
    }
  }

  const replay = GoalsHistoryReplay.make({ commit, sessions: sessions.length, clusters: kept });
  const json = yield* encodeReplayJson(replay);
  const packed = yield* Effect.promise(() =>
    new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()
  );
  const output = path.join(import.meta.dirname, "goals-history-replay.json.gz");
  yield* fs.writeFile(output, new Uint8Array(packed));
  const writes = A.reduce(kept, 0, (total, cluster) => total + cluster.writers.length);
  const baseBytes = A.reduce(texts, 0, (total, text) => total + utf8Bytes(text));
  const packedDigest = yield* digest.digest(Digest.sha256, new Uint8Array(packed));
  yield* Effect.log(
    `commit ${commit}: ${sessions.length} sessions, ${clusters.length} clusters before exclusions, ${kept.length} kept, ${writes} writes, ${baseBytes} base bytes, ${packed.byteLength} packed bytes, sha256 ${Hex.encode(packedDigest)}`
  );
});

program.pipe(Effect.provide([NodeServices.layer, Digest.layerWebCrypto]), NodeRuntime.runMain);
