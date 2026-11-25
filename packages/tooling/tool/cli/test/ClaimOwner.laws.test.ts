import { ValidTime } from "@beep/epistemics/Claim";
import { ActivityStart } from "@beep/jsonc/ActivityStart";
import {
  HoldAgentRef,
  HoldId,
  HoldPrincipalId,
  HoldProposition,
  holdLogicalKey,
  holdProposition,
} from "@beep/repo-cli/commands/Holds";
import { decodeHoldClaimLine, joinHoldClaims, makeHoldRenewal } from "@beep/repo-cli/commands/Holds/internal/HoldStore";
import { KbProposition, kbLogicalKey } from "@beep/repo-cli/commands/Kb";
import { WellFormedText } from "@beep/schema/WellFormedText";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const kbEquivalent = (left: KbProposition, right: KbProposition): boolean =>
  left._tag === right._tag &&
  left.subject === right.subject &&
  left.object === right.object &&
  left.text === right.text;

const baseHold = Result.getOrThrow(
  S.decodeResult(HoldProposition)({
    _tag: "Hold",
    holdId: "synthetic-hold",
    kind: "syncpack-held",
    subject: { packages: ["synthetic"], anchors: [{ _tag: "SyncpackHeld", dependency: "synthetic" }] },
    assertion: "Synthetic dependency remains pinned.",
    falsifier: {
      _tag: "Scripted",
      runtime: "vitest-bun",
      command: ["bun", "test"],
      controlVersion: "1.0.0",
      candidate: "latest",
      failureSignature: "synthetic failure",
    },
    watch: [{ _tag: "NpmVersion", packageName: "synthetic", distTag: "latest" }],
    exitAction: { _tag: "Unpin" },
  })
);

it.prop(
  "L4-5 kb proposition equivalence is tag, subject, object and text equality and agrees with the logical key",
  [S.Tuple([KbProposition, KbProposition, S.Boolean])],
  ([[left, right, same]]) => {
    const other = same ? { ...left } : right;
    expect(kbEquivalent(left, other)).toBe(kbLogicalKey(left) === kbLogicalKey(other));
    expect(kbEquivalent(left, { ...left })).toBe(true);
  },
  { arbitrary: { runs: 300, seed: "kb-l4-5" } }
);

it.prop(
  "L4-5 hold proposition equivalence is the same holdId and agrees with the logical key",
  [S.Tuple([HoldId, HoldId, S.NonEmptyString, S.Boolean])],
  ([[holdId, otherId, assertion, same]]) => {
    const left = HoldProposition.make({ ...baseHold, holdId });
    const right = HoldProposition.make({ ...baseHold, holdId: same ? holdId : otherId, assertion });
    expect(left.holdId === right.holdId).toBe(holdLogicalKey(left) === holdLogicalKey(right));
  },
  { arbitrary: { runs: 300, seed: "hold-l4-5" } }
);

const decodeActivity = S.decodeUnknownEffect(ActivityStart);
const decodeValid = S.decodeUnknownEffect(ValidTime);

it.layer(Layer.mergeAll(NodeFileSystem.layer, Digest.layerWebCrypto), { timeout: "30 seconds" })(
  "hold renewal identity",
  (it) => {
    it.effect.prop(
      "L4-5 a hold renewal with changed assertion text or lease keeps the logical key and changes the ClaimId",
      [S.Tuple([WellFormedText, S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 }))])],
      ([[assertion, extra]]) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const fixture = yield* fs.realPath("test/fixtures/hold-claims-v1.jsonl");
          const text = yield* fs.readFileString(fixture);
          const lines = A.filter(Str.split(text, "\n"), Str.isNonEmpty);
          const decoded = yield* Effect.forEach(lines, decodeHoldClaimLine, { concurrency: 1 });
          const claims = yield* joinHoldClaims(decoded);
          const predecessor = claims[1];
          if (predecessor === undefined) return yield* Effect.die("short hold fixture");
          const activity = yield* decodeActivity({
            operation: "https://example.org/ops/hold-renew",
            pin: { _tag: "Engine", engine: "beep", edition: "0.0.0" },
            used: [],
            started: 6,
          });
          const lease = yield* decodeValid({ _tag: "Interval", validFrom: 7, validTo: 30 });
          const longer = yield* decodeValid({ _tag: "Interval", validFrom: 7, validTo: 30 + extra });
          const original = holdProposition(predecessor);
          const renew = (proposition: HoldProposition, valid: ValidTime) =>
            makeHoldRenewal({
              predecessor,
              proposition,
              lease: valid,
              activity,
              assertedBy: HoldAgentRef.cases.Person.make({ principal: HoldPrincipalId.make("maintainer") }),
              scope: "repo",
              generatedAt: DateTime.makeUnsafe(7),
              knowledgeStart: DateTime.makeUnsafe(7),
              supportedBy: [],
            });
          const base = yield* renew(original, lease);
          const reworded = HoldProposition.make({ ...original, assertion });
          const changedText = yield* renew(reworded, lease);
          const changedLease = yield* renew(original, longer);
          expect(holdLogicalKey(reworded)).toBe(holdLogicalKey(original));
          expect(changedText.claim === base.claim).toBe(assertion === original.assertion);
          expect(changedLease.claim).not.toBe(base.claim);
        }),
      { arbitrary: fcRuns(20) }
    );
  }
);
