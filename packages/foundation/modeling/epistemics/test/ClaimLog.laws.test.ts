import { ValidTime } from "@beep/epistemics/Claim";
import { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import { appendProjection, checkClaimLog, claimsAt, knowledgeInterval } from "@beep/epistemics/ClaimLog";
import { AppendResult, ClaimLogEntry } from "@beep/epistemics/ClaimLog.schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { activity, arrows, Claims, coreAt } from "./support/Claims.ts";

const id = (hex: string) => ClaimId.make(`sha256:${Str.repeat(64)(hex)}`);
const at = DateTime.makeUnsafe;
const entry = (hex: string, start = 10, subject = 1) =>
  ClaimLogEntry.make({
    ...coreAt({ at: start, subject: subject }),
    claim: id(hex),
    generatedAt: at(0),
  });
const tags = (result: AppendResult) =>
  AppendResult.match(result, {
    Appended: () => [],
    Refused: (r) => A.map(r.violations, (v) => v._tag),
  });
const intervals = ValidTime.cases.Interval.make({ validFrom: at(0), validTo: O.none() });

it.layer(Digest.layerWebCrypto, { timeout: "20 seconds" })("claim append prefixes", (it) => {
  it("L4-1 detects missing, self, cross-partition and duplicate predecessors before overwriting", () => {
    const first = entry("1");
    const missing = ClaimLogEntry.make({ ...first, supersedes: O.some(id("f")) });
    expect(A.map(checkClaimLog([missing]), (v) => v._tag)).toContain("SupersededMissing");
    const future = ClaimLogEntry.make({ ...first, supersedes: O.some(id("2")) });
    expect(A.map(checkClaimLog([future, entry("2", 20)]), (v) => v._tag)).toContain("PredecessorNotEarlier");
    const invalid = ClaimLogEntry.make({ ...first, generatedAt: at(30) });
    const child = ClaimLogEntry.make({ ...entry("2", 20), supersedes: O.some(first.claim) });
    expect(A.map(checkClaimLog([invalid, child]), (v) => v._tag)).toContain("SupersededMissing");
    const unchanged = [first];
    const replay = appendProjection(unchanged, first);
    expect(replay.log).toBe(unchanged);
    expect(checkClaimLog([first, first])).toHaveLength(1);
    expect(tags(appendProjection([first], first))).toEqual(["DuplicateId"]);
    expect(tags(appendProjection([], ClaimLogEntry.make({ ...first, supersedes: O.some(id("2")) })))).toContain(
      "SupersededMissing"
    );
    expect(tags(appendProjection([], ClaimLogEntry.make({ ...first, supersedes: O.some(first.claim) })))).toContain(
      "PredecessorNotEarlier"
    );
    expect(
      tags(appendProjection([first], ClaimLogEntry.make({ ...entry("2", 20, 2), supersedes: O.some(first.claim) })))
    ).toContain("SupersededAcrossPartitions");
    expect(
      tags(
        appendProjection(
          [first],
          ClaimLogEntry.make({ ...entry("3", 20), scope: "other", supersedes: O.some(first.claim) })
        )
      )
    ).toContain("SupersededAcrossPartitions");
  });
  it("L4-1 refuses regression, generation-after-start, a fork and a late or missing derivation parent", () => {
    const first = entry("1", 20);
    expect(
      tags(appendProjection([first], ClaimLogEntry.make({ ...entry("2", 10), supersedes: O.some(first.claim) })))
    ).toEqual(["KnowledgeStartRegression", "StartsBeforeSuperseded"]);
    expect(tags(appendProjection([], ClaimLogEntry.make({ ...entry("2"), generatedAt: at(11) })))).toEqual([
      "StartsBeforeGeneration",
    ]);
    expect(
      tags(appendProjection([first], ClaimLogEntry.make({ ...entry("4", 30), derivedFrom: HashSet.make(first.claim) })))
    ).toEqual([]);
    const second = ClaimLogEntry.make({ ...entry("2", 30), supersedes: O.some(first.claim) });
    expect(
      tags(
        appendProjection([first, second], ClaimLogEntry.make({ ...entry("3", 40), supersedes: O.some(first.claim) }))
      )
    ).toEqual(["SupersessionFork"]);
    expect(
      tags(
        appendProjection(
          [first],
          ClaimLogEntry.make({ ...entry("3", 10), derivedFrom: HashSet.make(first.claim, id("f")) })
        )
      )
    ).toContain("ParentStartsLater");
    expect(
      tags(appendProjection([], ClaimLogEntry.make({ ...entry("3"), derivedFrom: HashSet.make(id("f")) })))
    ).toEqual(["ParentMissing"]);
  });
  it("L4-1 a future superseder cannot hide historical valid-time overlap", () => {
    const first = ClaimLogEntry.make({ ...entry("1"), valid: intervals });
    const overlap = ClaimLogEntry.make({ ...entry("2", 20), valid: intervals });
    const future = ClaimLogEntry.make({ ...entry("3", 30), supersedes: O.some(first.claim) });
    expect(A.map(checkClaimLog([first, overlap, future]), (v) => v._tag)).toContain("ValidTimeOverlap");
    expect(checkClaimLog([first, ClaimLogEntry.make({ ...overlap, scope: "other" })])).toEqual([]);
    expect(
      checkClaimLog([
        first,
        ClaimLogEntry.make({ ...overlap, valid: { _tag: "Interval", validFrom: at(-10), validTo: O.some(at(0)) } }),
      ])
    ).toEqual([]);
    expect(checkClaimLog([first, entry("2", 20)])).toEqual([]);
    expect(checkClaimLog([entry("1"), overlap])).toEqual([]);
  });
  it("L4-1 explicit supersession determines half-open bounds, including equal starts", () => {
    const first = entry("1");
    const unrelated = entry("2", 20, 2);
    const successor = ClaimLogEntry.make({ ...entry("3", 30), supersedes: O.some(first.claim) });
    const log = [first, unrelated, successor];
    assertNone(knowledgeInterval([], first.claim));
    assertSome(O.getOrThrow(knowledgeInterval(first.claim)(log)).end, at(30));
    expect(A.map(claimsAt(log, at(10)), (r) => r.claim)).toEqual([first.claim]);
    expect(A.map(claimsAt(at(30))(log), (r) => r.claim)).toEqual([unrelated.claim, successor.claim]);
    const equal = ClaimLogEntry.make({ ...entry("4", 10), supersedes: O.some(first.claim) });
    expect(A.map(claimsAt([first, equal], at(10)), (r) => r.claim)).toEqual([equal.claim]);
    expect(tags(appendProjection(equal)([first]))).toEqual([]);
  });
  it.effect.prop(
    "L4-1 minted append prefixes are ordered and stable after knowledge time strictly passes t",
    [S.Int.check(S.isBetween({ minimum: 2, maximum: 15 }))],
    ([size]) =>
      Effect.gen(function* () {
        let log: ReadonlyArray<ClaimLogEntry> = [];
        for (const index of A.range(1, size)) {
          const core = coreAt({ at: index * 10, subject: index });
          const claim = yield* arrows.mint(core);
          const result = yield* arrows.appendClaim(log, Claims.ClaimRecord.make({ claim, core }), {
            activity,
            at: at(0),
          });
          expect(result._tag).toBe("Appended");
          if (AppendResult.guards.Appended(result)) log = result.log;
          expect(checkClaimLog(log)).toEqual([]);
        }
        const before = claimsAt(log, at(15));
        const core = coreAt({ at: size * 10 + 10, subject: size + 1 });
        const claim = yield* arrows.mint(core);
        const appended = yield* arrows.appendClaim(log, Claims.ClaimRecord.make({ claim, core }), {
          activity,
          at: at(0),
        });
        if (AppendResult.guards.Appended(appended)) expect(claimsAt(appended.log, at(15))).toEqual(before);
      })
  );
});
