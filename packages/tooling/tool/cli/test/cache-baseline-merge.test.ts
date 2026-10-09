import { encodeCachePolicyBaselineText } from "@beep/repo-cli/commands/Cache";
import {
  CacheEvidenceReference,
  CachePolicyBaseline,
  CachePolicyBaselineRecordRequest,
  CachePolicyBaselineRejection,
  CachePolicyBaselineReview,
  CachePolicyNode,
  CachePolicyProjection,
  CachePolicySource,
  CacheReviewDecision,
  CacheTaskConfiguration,
  cachePolicyBaselineFailures,
  recordCachePolicyBaseline,
} from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcess } from "effect/process";
import * as Rec from "effect/Record";
import * as R from "effect/Result";
import * as S from "effect/Schema";

const digest = (seed: number) => Sha256Hex.make(seed.toString(16).padStart(64, "0"));
const review = (reviewer: string, seed: number) =>
  CacheReviewDecision.make({
    reviewer,
    reason: `${reviewer} re-recorded its own package`,
    basis: CacheEvidenceReference.make({ path: `${reviewer}.md`, sha256: digest(seed) }),
  });
const configuration = CacheTaskConfiguration.make({
  cache: true,
  inputs: ["src/**", "package.json"],
  env: [],
  passThroughEnv: [],
  outputs: [],
  dependsOn: ["^build"],
  persistent: false,
  interactive: false,
  interruptible: false,
  outputLogs: "full",
});
const node = (computation: string, seed: number) =>
  CachePolicyNode.make({
    computation,
    command: `bun run ${computation}`,
    commandDigest: digest(seed),
    dependencies: [],
    configuration,
  });
const projection = (nodes: ReadonlyArray<CachePolicyNode>) =>
  CachePolicyProjection.make({
    globalConfiguration: { ui: "tui" },
    nodes,
    sources: [CachePolicySource.make({ path: "turbo.json", sha256: digest(1) })],
  });
const base = projection([
  node("//#lint:policy", 10),
  node("@beep/alpha#lint", 11),
  node("@beep/alpha#test", 12),
  node("@beep/beta#lint", 13),
  node("@beep/beta#test", 14),
  node("@beep/gamma#lint", 15),
]);
const request = (decision: CacheReviewDecision, subjects: O.Option<ReadonlyArray<string>>) =>
  CachePolicyBaselineReview.make({
    review: decision,
    scope: ["@beep/alpha#lint"],
    profile: "fixture-profile",
    epoch: "v1",
    subjects,
  });
const main = review("main", 100);
const alphaReview = review("alpha", 101);
const betaReview = review("beta", 102);
const attempt = (
  prior: O.Option<CachePolicyBaseline>,
  current: CachePolicyProjection,
  decision: CacheReviewDecision,
  subjects: O.Option<ReadonlyArray<string>> = O.none()
) =>
  recordCachePolicyBaseline(
    CachePolicyBaselineRecordRequest.make({ prior, projection: current, review: request(decision, subjects) })
  );
const record = (prior: O.Option<CachePolicyBaseline>, current: CachePolicyProjection, decision: CacheReviewDecision) =>
  R.getOrThrow(attempt(prior, current, decision));
const retarget = (current: CachePolicyProjection, subject: string, seed: number) =>
  projection(
    A.map(current.nodes, (row) =>
      row.computation.startsWith(`${subject}#`) ? node(row.computation, seed + row.commandDigest.length) : row
    )
  );
const decodeBaseline = S.decodeUnknownEffect(S.fromJsonString(CachePolicyBaseline));

const writeAll = Effect.fn("CacheBaselineMergeTest.writeAll")(function* (
  files: ReadonlyArray<readonly [name: string, baseline: CachePolicyBaseline]>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-baseline-merge-" });
  yield* Effect.forEach(
    files,
    ([name, baseline]) =>
      encodeCachePolicyBaselineText(baseline).pipe(
        Effect.flatMap((text) => fs.writeFileString(path.join(root, name), text))
      ),
    { discard: true }
  );
  return { root, fs, path };
});

/** `git merge-file` rewrites `ours` in place and exits with the conflict count. */
const gitMergeFile = Effect.fn("CacheBaselineMergeTest.gitMergeFile")(function* (root: string) {
  const handle = yield* ChildProcess.make("git", ["merge-file", "ours.json", "base.json", "theirs.json"], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  return yield* handle.exitCode;
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("Cache baseline per-subject re-records", (it) => {
  it.effect(
    "two re-records of adjacent packages merge through git merge-file without conflict",
    Effect.fnUntraced(function* () {
      const committed = record(O.none(), base, main);
      expect(committed.stamped).toStrictEqual(["//", "@beep/alpha", "@beep/beta", "@beep/gamma"]);
      const prior = O.some(committed.baseline);
      const ours = record(prior, retarget(base, "@beep/alpha", 200), alphaReview);
      const theirs = record(prior, retarget(base, "@beep/beta", 300), betaReview);
      expect(ours.stamped).toStrictEqual(["@beep/alpha"]);
      expect(ours.carried).toStrictEqual(["//", "@beep/beta", "@beep/gamma"]);
      expect(theirs.stamped).toStrictEqual(["@beep/beta"]);

      const { root, fs, path } = yield* writeAll([
        ["base.json", committed.baseline],
        ["ours.json", ours.baseline],
        ["theirs.json", theirs.baseline],
      ]);
      expect(yield* gitMergeFile(root)).toBe(0);
      const merged = yield* fs.readFileString(path.join(root, "ours.json")).pipe(Effect.flatMap(decodeBaseline));
      expect(cachePolicyBaselineFailures(merged)).toStrictEqual([]);
      assertSome(Rec.get(merged.reviews, "@beep/alpha"), alphaReview);
      assertSome(Rec.get(merged.reviews, "@beep/beta"), betaReview);
      assertSome(Rec.get(merged.reviews, "@beep/gamma"), main);
      assertSome(Rec.get(merged.reviews, "//"), main);
      const digestOf = (computation: string) =>
        O.map(
          A.findFirst(merged.projection.nodes, (row) => row.computation === computation),
          (row) => row.commandDigest
        );
      assertSome(digestOf("@beep/alpha#lint"), digest(264));
      assertSome(digestOf("@beep/beta#test"), digest(364));
      assertSome(digestOf("@beep/gamma#lint"), digest(15));
    })
  );

  it.effect(
    "a new package on one side merges with a changed neighbour on the other",
    Effect.fnUntraced(function* () {
      const committed = record(O.none(), base, main);
      const prior = O.some(committed.baseline);
      const ours = record(prior, retarget(base, "@beep/beta", 200), alphaReview);
      const theirs = record(prior, projection(A.append(base.nodes, node("@beep/delta#lint", 16))), betaReview);
      expect(theirs.stamped).toStrictEqual(["@beep/delta"]);
      const { root, fs, path } = yield* writeAll([
        ["base.json", committed.baseline],
        ["ours.json", ours.baseline],
        ["theirs.json", theirs.baseline],
      ]);
      expect(yield* gitMergeFile(root)).toBe(0);
      const merged = yield* fs.readFileString(path.join(root, "ours.json")).pipe(Effect.flatMap(decodeBaseline));
      expect(cachePolicyBaselineFailures(merged)).toStrictEqual([]);
      expect(Rec.keys(merged.reviews)).toStrictEqual(["//", "@beep/alpha", "@beep/beta", "@beep/delta", "@beep/gamma"]);
      assertSome(Rec.get(merged.reviews, "@beep/delta"), betaReview);
      assertSome(Rec.get(merged.reviews, "@beep/beta"), alphaReview);
    })
  );

  it.effect(
    "a review that names subjects rejects drift outside them and unknown subjects",
    Effect.fnUntraced(function* () {
      const committed = record(O.none(), base, main);
      const prior = O.some(committed.baseline);
      const drifted = retarget(retarget(base, "@beep/alpha", 200), "@beep/beta", 300);
      assertFailure(
        attempt(prior, drifted, alphaReview, O.some(["@beep/alpha"])),
        CachePolicyBaselineRejection.make({ unreviewed: ["@beep/beta"], unknown: [] })
      );
      assertFailure(
        attempt(prior, base, alphaReview, O.some(["@beep/nowhere"])),
        CachePolicyBaselineRejection.make({ unreviewed: [], unknown: ["@beep/nowhere"] })
      );
      const forced = R.getOrThrow(attempt(prior, base, alphaReview, O.some(["@beep/gamma"])));
      expect(forced.stamped).toStrictEqual(["@beep/gamma"]);
      expect(forced.dropped).toStrictEqual([]);
    })
  );

  it.effect(
    "root posture changes stamp the root subject and vanished packages are dropped",
    Effect.fnUntraced(function* () {
      const committed = record(O.none(), base, main);
      const prior = O.some(committed.baseline);
      const withoutGamma = CachePolicyProjection.make({
        ...base,
        globalConfiguration: { ui: "stream" },
        nodes: A.filter(base.nodes, (row) => !row.computation.startsWith("@beep/gamma#")),
      });
      const next = record(prior, withoutGamma, alphaReview);
      expect(next.stamped).toStrictEqual(["//"]);
      expect(next.dropped).toStrictEqual(["@beep/gamma"]);
      expect(Rec.keys(next.baseline.reviews)).toStrictEqual(["//", "@beep/alpha", "@beep/beta"]);
      const incomplete = CachePolicyBaseline.make({
        ...committed.baseline,
        reviews: Rec.fromEntries(
          A.filter(Rec.toEntries(committed.baseline.reviews), ([subject]) => subject !== "@beep/beta")
        ),
      });
      expect(cachePolicyBaselineFailures(incomplete)).toStrictEqual(["unreviewed-subject:@beep/beta"]);
    })
  );
});
