import { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import { appendProjection, checkClaimLog, claimsAt, knowledgeInterval } from "@beep/epistemics/ClaimLog";
import {
  AppendResult,
  ClaimKnowledgeInterval,
  ClaimLogEntry,
  ClaimLogViolation,
} from "@beep/epistemics/ClaimLog.schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { coreAt } from "./support/Claims.ts";

const id = (index: number) => ClaimId.make(`sha256:${Str.repeat(64)(`${index}`)}`);
const at = DateTime.makeUnsafe;
const Small = (maximum: number) => S.Int.check(S.isBetween({ minimum: 0, maximum }));
const Row = S.Tuple([Small(5), Small(6), S.Boolean, Small(1), Small(50), S.Boolean, Small(40), Small(2)]);
const entryOf = ([claim, supersedes, otherScope, subject, start, interval, from, parent]: typeof Row.Type) =>
  ClaimLogEntry.make({
    ...coreAt({ at: start, subject: subject + 1, scope: otherScope ? "other" : "fixture" }),
    claim: id(claim),
    supersedes: supersedes > 5 ? O.none() : O.some(id(supersedes)),
    derivedFrom: parent > 1 ? HashSet.empty() : HashSet.make(id(parent)),
    generatedAt: at(0),
    valid: interval ? { _tag: "Interval", validFrom: at(from), validTo: O.some(at(from + 15)) } : { _tag: "Unknown" },
  });
const scannedFold = (log: ReadonlyArray<ClaimLogEntry>): ReadonlyArray<ClaimLogViolation> => {
  const first = (claim: ClaimId) => A.findFirstIndex(log, (row) => row.claim === claim);
  const found: Array<ClaimLogViolation> = [];
  A.reduce(log, A.empty<ClaimLogEntry>(), (accepted: ReadonlyArray<ClaimLogEntry>, row, at) =>
    AppendResult.match(appendProjection(accepted, row), {
      Appended: (result) => result.log,
      Refused: (result) => {
        found.push(
          ...A.map(result.violations, (violation) =>
            ClaimLogViolation.guards.SupersededMissing(violation) &&
            O.exists(first(violation.superseded), (position) => position >= at)
              ? ClaimLogViolation.cases.PredecessorNotEarlier.make({
                  claim: violation.claim,
                  superseded: violation.superseded,
                })
              : violation
          )
        );
        return accepted;
      },
    })
  );
  return found;
};

it.prop(
  "L4-1 indexed prefix validation equals the scanned append fold on generated logs",
  [S.Array(Row).check(S.isMaxLength(14))],
  ([rows]) => {
    const log = A.map(rows, entryOf);
    expect(checkClaimLog(log)).toEqual(scannedFold(log));
  }
);
it("L4-1 knowledge intervals refuse an end before their start and keep equal bounds", () => {
  const decode = S.decodeUnknownResult(ClaimKnowledgeInterval);
  assertTrue(decode({ start: 2000, end: 1000 }).pipe(Result.isFailure));
  assertTrue(decode({ start: 1000, end: 1000 }).pipe(Result.isSuccess));
  expect(() => ClaimKnowledgeInterval.make({ start: at(2000), end: O.some(at(1000)) })).toThrow();
});
it("L4-1 an inverted successor yields no interval and is never selected", () => {
  const prior = entryOf([1, 6, false, 0, 20, false, 0, 2]);
  const inverted = entryOf([2, 1, false, 0, 10, false, 0, 2]);
  const log = [prior, inverted];
  assertNone(knowledgeInterval(log, prior.claim));
  expect(A.map(claimsAt(log, at(25)), (row) => row.claim)).toEqual([inverted.claim]);
  expect(A.map(claimsAt(log, at(15)), (row) => row.claim)).toEqual([inverted.claim]);
  const duplicate = ClaimLogEntry.make({ ...prior, knowledgeStart: at(40) });
  expect(A.map(claimsAt([prior, duplicate], at(25)), (row) => row.knowledgeStart)).toEqual([at(20), at(40)]);
});
