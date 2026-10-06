import {
  CacheBaselineSubject,
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
  cacheBaselineRootSubject,
  cacheBaselineSubject,
  cacheBaselineSubjects,
  cachePolicyBaselineFailures,
  recordCachePolicyBaseline,
} from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Rec from "effect/Record";
import * as R from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const digest = (n: number) => Sha256Hex.make(Str.padStart(64, "0")(`${n}`));
const decision = (reviewer: string, seed: number) =>
  CacheReviewDecision.make({
    reviewer,
    reason: `${reviewer} reviewed its own subject`,
    basis: CacheEvidenceReference.make({ path: `${reviewer}.md`, sha256: digest(seed) }),
  });
const configuration = CacheTaskConfiguration.make({
  cache: true,
  inputs: ["src/**"],
  env: [],
  passThroughEnv: [],
  outputs: [],
  dependsOn: [],
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
const projectionOf = (nodes: ReadonlyArray<CachePolicyNode>, source = 1) =>
  CachePolicyProjection.make({
    globalConfiguration: { ui: "tui" },
    nodes,
    sources: [CachePolicySource.make({ path: "turbo.json", sha256: digest(source) })],
  });
const nodes = [node("@beep/beta#lint", 13), node("//#lint:policy", 10), node("@beep/alpha#lint", 11)];
const base = projectionOf(nodes);
const main = decision("main", 100);
const alpha = decision("alpha", 101);

type Overrides = {
  readonly subjects?: O.Option<ReadonlyArray<string>>;
  readonly scope?: readonly [string, ...Array<string>];
  readonly profile?: string;
  readonly epoch?: string;
};
const attempt = (
  prior: O.Option<CachePolicyBaseline>,
  projection: CachePolicyProjection,
  review: CacheReviewDecision,
  overrides: Overrides = {}
) =>
  recordCachePolicyBaseline(
    CachePolicyBaselineRecordRequest.make({
      prior,
      projection,
      review: CachePolicyBaselineReview.make({
        review,
        scope: overrides.scope ?? ["@beep/alpha#lint"],
        profile: overrides.profile ?? "fixture-profile",
        epoch: overrides.epoch ?? "v1",
        subjects: overrides.subjects ?? O.none(),
      }),
    })
  );
const record = (...args: Parameters<typeof attempt>) => R.getOrThrow(attempt(...args));
const committed = record(O.none(), base, main);
const prior = O.some(committed.baseline);

describe("cache baseline per-subject review records", () => {
  it("resolves computations to their review subject", () => {
    expect(cacheBaselineSubject("@beep/alpha#lint")).toBe("@beep/alpha");
    expect(cacheBaselineSubject("//#lint:policy")).toBe(cacheBaselineRootSubject);
    expect(cacheBaselineSubjects(base)).toStrictEqual(["//", "@beep/alpha", "@beep/beta"]);
    expect(cacheBaselineSubjects(projectionOf([]))).toStrictEqual(["//"]);
    expect(S.is(CacheBaselineSubject)("@beep/alpha")).toBe(true);
    expect(S.is(CacheBaselineSubject)("@beep/alpha#lint")).toBe(false);
    expect(S.is(CacheBaselineSubject)("")).toBe(false);
  });

  it("stamps every subject on a first record and sorts nodes by computation", () => {
    expect(committed.stamped).toStrictEqual(["//", "@beep/alpha", "@beep/beta"]);
    expect(committed.carried).toStrictEqual([]);
    expect(committed.dropped).toStrictEqual([]);
    expect(A.map(committed.baseline.projection.nodes, (row) => row.computation)).toStrictEqual([
      "//#lint:policy",
      "@beep/alpha#lint",
      "@beep/beta#lint",
    ]);
    expect(cachePolicyBaselineFailures(committed.baseline)).toStrictEqual([]);
  });

  it("stamps only the changed subject and carries the other reviews forward", () => {
    const next = record(prior, projectionOf([nodes[0], nodes[1], node("@beep/alpha#lint", 99)]), alpha);
    expect(next.stamped).toStrictEqual(["@beep/alpha"]);
    expect(next.carried).toStrictEqual(["//", "@beep/beta"]);
    assertSome(Rec.get(next.baseline.reviews, "@beep/alpha"), alpha);
    assertSome(Rec.get(next.baseline.reviews, "@beep/beta"), main);
    assertSome(Rec.get(next.baseline.reviews, "//"), main);
    expect(record(prior, base, alpha).stamped).toStrictEqual([]);
  });

  it("stamps the root subject when any root posture changes", () => {
    expect(record(prior, projectionOf(nodes, 2), alpha).stamped).toStrictEqual(["//"]);
    expect(
      record(prior, CachePolicyProjection.make({ ...base, globalConfiguration: { ui: "stream" } }), alpha).stamped
    ).toStrictEqual(["//"]);
    expect(record(prior, base, alpha, { scope: ["@beep/beta#lint"] }).stamped).toStrictEqual(["//"]);
    expect(record(prior, base, alpha, { profile: "other-profile" }).stamped).toStrictEqual(["//"]);
    expect(record(prior, base, alpha, { epoch: "v2" }).stamped).toStrictEqual(["//"]);
  });

  it("stamps new subjects and drops subjects that left the projection", () => {
    const next = record(prior, projectionOf([nodes[1], nodes[2], node("@beep/delta#lint", 16)]), alpha);
    expect(next.stamped).toStrictEqual(["@beep/delta"]);
    expect(next.dropped).toStrictEqual(["@beep/beta"]);
    expect(Rec.keys(next.baseline.reviews)).toStrictEqual(["//", "@beep/alpha", "@beep/delta"]);
  });

  it("honours named subjects and rejects drift outside them", () => {
    const forced = record(prior, base, alpha, { subjects: O.some(["@beep/beta"]) });
    expect(forced.stamped).toStrictEqual(["@beep/beta"]);
    const drifted = projectionOf([node("@beep/beta#lint", 98), nodes[1], node("@beep/alpha#lint", 99)]);
    assertFailure(
      attempt(prior, drifted, alpha, { subjects: O.some(["@beep/alpha"]) }),
      CachePolicyBaselineRejection.make({ unreviewed: ["@beep/beta"], unknown: [] })
    );
    assertFailure(
      attempt(prior, base, alpha, { subjects: O.some(["@beep/nowhere"]) }),
      CachePolicyBaselineRejection.make({ unreviewed: [], unknown: ["@beep/nowhere"] })
    );
  });

  it("reports unreviewed subjects, orphan reviews and unsorted nodes", () => {
    const { baseline } = committed;
    const without = (subject: string) =>
      Rec.fromEntries(A.filter(Rec.toEntries(baseline.reviews), ([name]) => name !== subject));
    expect(
      cachePolicyBaselineFailures(CachePolicyBaseline.make({ ...baseline, reviews: without("@beep/beta") }))
    ).toStrictEqual(["unreviewed-subject:@beep/beta"]);
    expect(
      cachePolicyBaselineFailures(
        CachePolicyBaseline.make({ ...baseline, reviews: { ...baseline.reviews, "@beep/ghost": main } })
      )
    ).toStrictEqual(["orphan-review:@beep/ghost"]);
    expect(cachePolicyBaselineFailures(CachePolicyBaseline.make({ ...baseline, projection: base }))).toStrictEqual([
      "unsorted-nodes",
    ]);
  });
});
