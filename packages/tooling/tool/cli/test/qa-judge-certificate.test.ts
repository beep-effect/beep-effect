import { MarkerEvent, RoundLayout, RoundNumber } from "@beep/qa-capture";
import {
  certifyQaJudgeSettlement,
  crossCheckAgainstRound,
  DeclaredRoundCoherentInput,
  evaluateDeclaredRoundCoherent,
  evaluateJudgeOutputInventoryDecodes,
  isCrossCheckClean,
  JudgeOutputInventoryDecodesInput,
  JudgeOutputInventoryDecodesVerdict,
  QaEventLog,
  QaJudgeContract,
  QaJudgeContractSubject,
  QaJudgeSettlement,
  settleAgainstRound,
} from "@beep/repo-cli/commands/Qa";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import {
  applyGateCertificatePlan,
  EvidenceDigest,
  EvidenceSubject,
  GateCertificateApplyPlan,
  GateCertificatePredicateType,
  GateCertificateReceipt,
  GateId,
} from "@beep/skill-contract";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { CheckOutcome, GateCertificate } from "@beep/skill-contract";

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeReceipt = S.encodeUnknownEffect(S.fromJsonString(GateCertificateReceipt));
const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(GateCertificateReceipt));
const sha256 = S.decodeEffect(Sha256HexFromBytes);

const TestLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, BunCrypto.layer);

const subjectFor = Effect.fn(function* (name: string, text: string) {
  const digest = yield* sha256(new TextEncoder().encode(text));
  return EvidenceSubject.make({ digest: EvidenceDigest.make({ sha256: digest }), name });
});

const layoutFor = (root: string): RoundLayout =>
  RoundLayout.make({
    clipsDir: `${root}/clips`,
    eventsPath: `${root}/events.ndjson`,
    framesDir: `${root}/frames`,
    reportPath: `${root}/report.md`,
    root,
    round: 1,
    sessionPath: `${root}/session.json`,
    sheetsDir: `${root}/sheets`,
    videoDir: `${root}/video`,
  });

const eventLog = QaEventLog.make({
  events: [MarkerEvent.make({ kind: "marker", label: "scenario:cert", seq: 2, tEpochMs: 1_754_000_000_000 })],
  rejectedCount: 0,
});

const inventoryText = (path: string, eventIds: ReadonlyArray<number>) =>
  encodeJson({
    findings: [
      {
        evidence: [{ eventIds, kind: "strip", path }],
        fix: "Fix the drag behavior.",
        id: "R1-01",
        lens: "selection-smear",
        repro: "Drag the sash.",
        severity: "P1",
        title: "Selection smear",
      },
    ],
    judge: { effort: "high", model: "claude-opus-5-5" },
    requiredCount: 1,
    round: 1,
    schemaVersion: "qa-inventory/v1",
    sessionRef: "session.json",
  });

const outcomesById = (certificate: GateCertificate) =>
  A.map(certificate.checks, (check) => [check.checkId, check.outcome] as const);

const legacyOutcome = (allowed: boolean): CheckOutcome => (allowed ? "passed" : "failed");

const fixtures = [
  { cited: "frames/a.png", eventIds: [2], name: "clean" },
  { cited: "frames/ghost.png", eventIds: [2], name: "missing artifact" },
  { cited: "frames/a.png", eventIds: [9], name: "missing event id" },
  { cited: "frames/ghost.png", eventIds: [9, 2], name: "both missing" },
] as const;

it.layer(TestLayer, { timeout: "30 seconds" })("commands/Qa judge settlement gate certificate", (it) => {
  const roundFixture = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-qa-cert-" });
    yield* fs.makeDirectory(path.join(root, "frames"), { recursive: true });
    yield* fs.writeFileString(path.join(root, "frames", "a.png"), "frame");
    return layoutFor(root);
  });

  const settleFixture = Effect.fn(function* (layout: RoundLayout, cited: string, eventIds: ReadonlyArray<number>) {
    const text = yield* inventoryText(cited, eventIds);
    const decode = yield* evaluateJudgeOutputInventoryDecodes(
      JudgeOutputInventoryDecodesInput.make({ candidate: text })
    );
    const inventory = JudgeOutputInventoryDecodesVerdict.match(decode, {
      allowed: ({ audit }) => audit.detail.inventory,
      denied: () => expect.fail("fixture inventory must decode"),
    });
    const round = yield* evaluateDeclaredRoundCoherent(
      DeclaredRoundCoherentInput.make({ declaredRound: inventory.round, requestedRound: RoundNumber.make(1) })
    );
    const legacy = yield* crossCheckAgainstRound(layout, inventory, eventLog);
    const leaves = yield* settleAgainstRound(layout, inventory, eventLog);
    const subject = yield* subjectFor("qa/round-1/inventory.json", text);
    const receipt = yield* certifyQaJudgeSettlement(
      QaJudgeSettlement.make({
        artifact: O.some(leaves.artifact),
        crossCheck: O.some(leaves.crossCheck),
        decode: O.some(decode),
        eventId: O.some(leaves.eventId),
        inventory: subject,
        round: O.some(round),
      })
    );
    return { leaves, legacy, receipt, round, subject };
  });

  it.effect("matches the existing JudgeCheck outcomes on the same round fixtures", () =>
    Effect.gen(function* () {
      const layout = yield* roundFixture;
      for (const fixture of fixtures) {
        const { leaves, legacy, receipt, round, subject } = yield* settleFixture(
          layout,
          fixture.cited,
          fixture.eventIds
        );
        const certificate = receipt.predicate;

        expect(outcomesById(certificate), fixture.name).toEqual([
          ["judge-output-inventory-decodes", "passed"],
          ["declared-round-coherent", legacyOutcome(round.verdict === "allowed")],
          ["cited-artifact-exists", legacyOutcome(!A.isReadonlyArrayNonEmpty(legacy.missingPaths))],
          ["cited-event-id-exists", legacyOutcome(!A.isReadonlyArrayNonEmpty(legacy.missingEventIds))],
          ["evidence-cross-check-clean", legacyOutcome(isCrossCheckClean(legacy))],
        ]);
        expect(certificate.outcome, fixture.name).toBe(isCrossCheckClean(legacy) ? "passed" : "failed");
        expect(leaves.crossCheck.verdict).toBe(isCrossCheckClean(legacy) ? "allowed" : "denied");
        expect(certificate.reach).toBe("complete");
        expect(certificate.contractSubject).toEqual(QaJudgeContractSubject);
        expect(receipt.predicateType).toBe(GateCertificatePredicateType);
        expect(receipt.subject).toEqual([subject]);
        expect(A.map(certificate.checks, (check) => check.checkId)).toEqual(
          A.map(QaJudgeContract.gates.declarations, (declaration) => declaration.id)
        );

        const json = yield* encodeReceipt(receipt);
        const decoded = yield* decodeReceipt(json);
        expect(S.toEquivalence(GateCertificateReceipt)(decoded, receipt)).toBe(true);
      }
    })
  );

  it.effect.prop(
    "certifies gates that did not run as untested and never passes an incomplete settlement",
    [S.Tuple([S.Boolean, S.Boolean, S.Boolean, S.Boolean, S.Boolean])],
    ([present]) =>
      Effect.gen(function* () {
        const layout = yield* roundFixture;
        const { leaves, receipt: full, round, subject } = yield* settleFixture(layout, "frames/a.png", [2]);
        const decode = yield* evaluateJudgeOutputInventoryDecodes(
          JudgeOutputInventoryDecodesInput.make({ candidate: "{" })
        );
        const pick = <A>(index: number, value: A) => (present[index] === true ? O.some(value) : O.none());
        const receipt = yield* certifyQaJudgeSettlement(
          QaJudgeSettlement.make({
            artifact: pick(2, leaves.artifact),
            crossCheck: pick(4, leaves.crossCheck),
            decode: pick(0, decode),
            eventId: pick(3, leaves.eventId),
            inventory: subject,
            round: pick(1, round),
          })
        );
        const outcomes = A.map(receipt.predicate.checks, (check) => check.outcome);
        const expected = A.map(
          present,
          (isPresent, index): CheckOutcome => (isPresent ? (index === 0 ? "failed" : "passed") : "untested")
        );

        expect(full.predicate.outcome).toBe("passed");
        expect(outcomes).toEqual(expected);
        expect(receipt.predicate.outcome).not.toBe("passed");
        expect(receipt.predicate.outcome).toBe(present[0] ? "failed" : "untested");
        expect(
          A.every(receipt.predicate.checks, (check) =>
            check.outcome === "untested" ? A.isReadonlyArrayEmpty(check.evidenceSubjects) : true
          )
        ).toBe(true);
      }).pipe(Effect.scoped),
    { arbitrary: fcRuns(10) }
  );

  it.effect("applies a digest-bound plan to the produced certificate and refuses stale or unknown ids", () =>
    Effect.gen(function* () {
      const layout = yield* roundFixture;
      const { receipt } = yield* settleFixture(layout, "frames/ghost.png", [2]);
      const json = yield* encodeReceipt(receipt);
      const certificate = yield* subjectFor("qa/round-1/certificate.json", json);
      const stale = yield* subjectFor("qa/round-1/certificate.json", `${json}\n`);
      const plan = (subject: EvidenceSubject, ids: A.NonEmptyReadonlyArray<string>) =>
        GateCertificateApplyPlan.make({ certificate: subject, checkIds: A.map(ids, (id) => GateId.make(id)) });

      const applied = applyGateCertificatePlan(plan(certificate, ["cited-artifact-exists"]), certificate, receipt);
      const refusedStale = applyGateCertificatePlan(plan(stale, ["cited-artifact-exists"]), certificate, receipt);
      const refusedUnknown = applyGateCertificatePlan(plan(certificate, ["not-a-qa-gate"]), certificate, receipt);

      expect(applied).toMatchObject({ checks: [{ checkId: "cited-artifact-exists", outcome: "failed" }] });
      expect(refusedStale).toMatchObject({ reason: "stale-digest", verdict: "refused" });
      expect(refusedUnknown).toMatchObject({ reason: "unknown-id", unknownIds: ["not-a-qa-gate"], verdict: "refused" });
    })
  );
});
