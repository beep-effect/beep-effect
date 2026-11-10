/**
 * Builds `goals-markdown-sample.json.gz`, the frozen AC-1 and AC-8 fixture:
 * a deterministic, structurally stratified sample of the tracked
 * `goals/**` Markdown files plus a few synthetic edge files.
 *
 * Run it from the repository root and commit the output; the optional
 * argument names the commit to sample (default `HEAD`):
 *
 *   bun packages/tooling/library/agent-memory-store/test/fixtures/build-goals-markdown-sample.ts [commit]
 *
 * The file list comes from `git ls-tree` of that commit and every file's bytes
 * from `git show <commit>:<path>`, so untracked notes and uncommitted edits
 * never reach the fixture and the recorded commit regenerates it exactly. Within each stratum files are taken in the order of the
 * SHA-256 of their path until the stratum's byte budget is spent, so the same
 * tree always yields the same sample. The fixture is one gzipped JSON file so
 * repository scanners and formatters do not walk its Markdown.
 *
 * Labeller: the agent-memory-store-p1 lane defined the strata and the
 * synthetic files, and is the only labeller of this fixture.
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GoalsMarkdownSample, SampleFile } from "./goals-markdown-sample.ts";
import type { SampleStratum } from "./goals-markdown-sample.ts";

// Per-stratum byte budget and the per-file cap outside the long-file stratum.
const STRATUM_BUDGET = 110_000;
const FILE_CAP = 40_000;
const LONG_FILE_MIN = 40_000;
const LONG_FILE_MAX = 130_000;

const strata: ReadonlyArray<{ readonly name: SampleStratum; readonly test: (text: string) => boolean }> = [
  { name: "table", test: (text) => /^\s*\|.*\|\s*$/m.test(text) && /^\s*\|?\s*:?-{3,}/m.test(text) },
  { name: "nestedList", test: (text) => /^( {2,}|\t)([-*+]|\d+[.)]) /m.test(text) },
  { name: "fencedCode", test: (text) => /^\s*(```|~~~)/m.test(text) },
  { name: "frontmatter", test: (text) => Str.startsWith("---\n")(text) },
  { name: "html", test: (text) => /^\s*<[a-zA-Z!/]/m.test(text) },
  { name: "blockQuote", test: (text) => /^\s*>/m.test(text) },
  { name: "nonAscii", test: (text) => /[\u0080-\uffff]/.test(text) },
  { name: "noTrailingNewline", test: (text) => Str.isNonEmpty(text) && !Str.endsWith("\n")(text) },
  { name: "plain", test: () => true },
];

// Synthetic edge files the tracked tree does not hold: `text=auto` keeps CRLF
// out of the repository, and no goals file opens with a byte order mark.
const synthetic: ReadonlyArray<SampleFile> = [
  SampleFile.make({ path: "synthetic/empty.md", text: "", stratum: "synthetic" }),
  SampleFile.make({ path: "synthetic/blank-lines.md", text: "\n\n\n", stratum: "synthetic" }),
  SampleFile.make({
    path: "synthetic/crlf.md",
    text: "# CRLF notes\r\n\r\n- one\r\n- two\r\n  - nested\r\n\r\n| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n",
    stratum: "synthetic",
  }),
  SampleFile.make({
    path: "synthetic/bom.md",
    text: "﻿# Byte order mark\n\nThe mark opens the file.\n",
    stratum: "synthetic",
  }),
  SampleFile.make({
    path: "synthetic/astral-and-tabs.md",
    text: "# Astral \u{1F9E0} plane\n\n-\tTab marker item \u{1F680}\n-\tSecond été\n\n```\n\tindented \u{1F600}\n```",
    stratum: "synthetic",
  }),
];

const encodeSampleJson = S.encodeEffect(S.fromJsonString(GoalsMarkdownSample));

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const digest = yield* Digest.Digest;
  const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..", "..");
  const git = (args: ReadonlyArray<string>) => spawner.string(ChildProcess.make("git", [...args], { cwd: root }));

  // The file list and every byte come from the commit's tree, never from the
  // index or the working tree, so the recorded commit regenerates the fixture.
  const requested = O.getOrElse(A.get(process.argv, 2), () => "HEAD");
  const resolved = yield* git(["rev-parse", "--verify", `${requested}^{commit}`]);
  const commit = Str.trim(resolved);
  const lsTree = yield* git(["ls-tree", "-r", "-z", "--name-only", commit, "--", "goals"]);
  const listed = Str.split(lsTree, "\u0000");
  const tracked = A.filter(listed, (file) => Str.endsWith(".md")(file));
  const ranked = yield* Effect.forEach(tracked, (file) =>
    Effect.map(digest.digestHex(Digest.sha256, new TextEncoder().encode(file)), (rank) => ({ file, rank }))
  );
  const ordered = A.map(
    A.sort(
      ranked,
      Order.mapInput(Order.String, (entry: { readonly rank: string }) => entry.rank)
    ),
    (entry) => entry.file
  );
  const texts = yield* Effect.forEach(
    ordered,
    (file) => Effect.map(git(["show", `${commit}:${file}`]), (text) => ({ file, text })),
    { concurrency: 16 }
  );

  const chosen = MutableHashSet.empty<string>();
  const files: Array<SampleFile> = [];
  for (const stratum of strata) {
    let spent = 0;
    for (const { file, text } of texts) {
      const size = new TextEncoder().encode(text).length;
      if (MutableHashSet.has(chosen, file) || size > FILE_CAP || !stratum.test(text) || spent + size > STRATUM_BUDGET) {
        continue;
      }
      MutableHashSet.add(chosen, file);
      files.push(SampleFile.make({ path: Str.slice("goals/".length)(file), text, stratum: stratum.name }));
      spent += size;
    }
  }
  // The long-file stratum takes the first two files in rank order within its band.
  for (const { file, text } of A.take(
    A.filter(texts, ({ file, text }) => {
      const size = new TextEncoder().encode(text).length;
      return !MutableHashSet.has(chosen, file) && size >= LONG_FILE_MIN && size <= LONG_FILE_MAX;
    }),
    2
  )) {
    MutableHashSet.add(chosen, file);
    files.push(SampleFile.make({ path: Str.slice("goals/".length)(file), text, stratum: "long" }));
  }
  files.push(...synthetic);

  const sample = GoalsMarkdownSample.make({ commit, files: A.sort(files, SampleFile.byPath) });
  const json = yield* encodeSampleJson(sample);
  const packed = yield* Effect.promise(() =>
    new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()
  );
  const output = path.join(import.meta.dirname, "goals-markdown-sample.json.gz");
  yield* fs.writeFile(output, new Uint8Array(packed));
  const rawBytes = A.reduce(files, 0, (total, file) => total + new TextEncoder().encode(file.text).length);
  const packedDigest = yield* digest.digest(Digest.sha256, new Uint8Array(packed));
  yield* Effect.log(
    `wrote ${files.length} files, ${rawBytes} Markdown bytes, ${packed.byteLength} packed bytes, commit ${commit}, sha256 ${Hex.encode(packedDigest)}`
  );
});

program.pipe(Effect.provide([NodeServices.layer, Digest.layerWebCrypto]), NodeRuntime.runMain);
