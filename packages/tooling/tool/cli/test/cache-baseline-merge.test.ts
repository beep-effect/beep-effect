import { decodeCachePolicyBaselineFiles, encodeCachePolicyBaselineFiles } from "@beep/repo-cli/commands/Cache";
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
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Rec from "effect/Record";
import * as R from "effect/Result";
import * as Str from "effect/String";

const digest = (seed: number) => Sha256Hex.make(Str.padStart(64, "0")(seed.toString(16)));
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
      Str.startsWith(`${subject}#`)(row.computation) ? node(row.computation, seed + row.commandDigest.length) : row
    )
  );
type BaselineFiles = ReadonlyArray<{ readonly path: string; readonly text: string }>;

const changedPaths = (base: BaselineFiles, side: BaselineFiles) =>
  A.dedupe(
    A.appendAll(
      A.map(
        A.filter(side, (file) => !A.some(base, (prior) => prior.path === file.path && prior.text === file.text)),
        (file) => file.path
      ),
      A.map(
        A.filter(base, (prior) => !A.some(side, (file) => file.path === prior.path)),
        (file) => file.path
      )
    )
  );

/**
 * Apply both sides' file changes to the base, as git does for disjoint paths:
 * a side's version of a path it changed wins, and a path a side deleted goes.
 */
const mergeDisjoint = (base: BaselineFiles, ours: BaselineFiles, theirs: BaselineFiles): BaselineFiles => {
  const oursChanged = changedPaths(base, ours);
  const theirsChanged = changedPaths(base, theirs);
  const paths = A.sort(
    A.dedupe(A.map(A.appendAll(A.appendAll(base, ours), theirs), (file) => file.path)),
    Order.String
  );
  return A.flatMap(paths, (path) => {
    const side = A.contains(oursChanged, path) ? ours : A.contains(theirsChanged, path) ? theirs : base;
    return O.toArray(A.findFirst(side, (file) => file.path === path));
  });
};

describe("Cache baseline per-subject re-records", () => {
  it.effect(
    "two re-records of adjacent packages change disjoint files and merge without conflict",
    Effect.fnUntraced(function* () {
      const committed = record(O.none(), base, main);
      expect(committed.stamped).toStrictEqual(["//", "@beep/alpha", "@beep/beta", "@beep/gamma"]);
      const prior = O.some(committed.baseline);
      const ours = record(prior, retarget(base, "@beep/alpha", 200), alphaReview);
      const theirs = record(prior, retarget(base, "@beep/beta", 300), betaReview);
      expect(ours.stamped).toStrictEqual(["@beep/alpha"]);
      expect(ours.carried).toStrictEqual(["//", "@beep/beta", "@beep/gamma"]);
      expect(theirs.stamped).toStrictEqual(["@beep/beta"]);

      const baseFiles = yield* encodeCachePolicyBaselineFiles(committed.baseline);
      const oursFiles = yield* encodeCachePolicyBaselineFiles(ours.baseline);
      const theirsFiles = yield* encodeCachePolicyBaselineFiles(theirs.baseline);
      expect(changedPaths(baseFiles, oursFiles)).toStrictEqual(["standards/cache-baseline/@beep/alpha.json"]);
      expect(changedPaths(baseFiles, theirsFiles)).toStrictEqual(["standards/cache-baseline/@beep/beta.json"]);
      const merged = yield* decodeCachePolicyBaselineFiles(mergeDisjoint(baseFiles, oursFiles, theirsFiles));
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
      const baseFiles = yield* encodeCachePolicyBaselineFiles(committed.baseline);
      const oursFiles = yield* encodeCachePolicyBaselineFiles(ours.baseline);
      const theirsFiles = yield* encodeCachePolicyBaselineFiles(theirs.baseline);
      expect(changedPaths(baseFiles, oursFiles)).toStrictEqual(["standards/cache-baseline/@beep/beta.json"]);
      expect(changedPaths(baseFiles, theirsFiles)).toStrictEqual(["standards/cache-baseline/@beep/delta.json"]);
      const merged = yield* decodeCachePolicyBaselineFiles(mergeDisjoint(baseFiles, oursFiles, theirsFiles));
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
        nodes: A.filter(base.nodes, (row) => !Str.startsWith("@beep/gamma#")(row.computation)),
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
