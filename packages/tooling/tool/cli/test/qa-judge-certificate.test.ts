import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { MarkerEvent, RoundLayout, RoundNumber } from "@beep/qa-capture";
import {
  applyQaJudgeCertificatePlan,
  certifyQaJudgeSettlement,
  DeclaredRoundCoherentInput,
  evaluateDeclaredRoundCoherent,
  evaluateJudgeOutputInventoryDecodes,
  GATE_CERTIFICATE_FILE,
  JudgeOutputInventoryDecodesInput,
  JudgeOutputInventoryDecodesVerdict,
  QaEventLog,
  QaJudgeContract,
  QaJudgeContractSubject,
  QaJudgeSettlement,
  settleAgainstRound,
  writeQaJudgeCertificate,
} from "@beep/repo-cli/commands/Qa";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import {
  EvidenceDigest,
  EvidenceSubject,
  GateCertificate,
  GateCertificateApplyPlan,
  GateCertificatePredicateType,
  GateCertificateReceipt,
  GateId,
} from "@beep/skill-contract";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { CheckOutcome } from "@beep/skill-contract";

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeReceipt = S.encodeUnknownEffect(S.fromJsonString(GateCertificateReceipt));
const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(GateCertificateReceipt));
const sha256 = S.decodeEffect(Sha256HexFromBytes);

const TestLayer = Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer, BunCrypto.layer);

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
    return { leaves, receipt, round, subject };
  });

  it.effect("certifies the five declared gates in contract order against the contract subject", () =>
    Effect.gen(function* () {
      const layout = yield* roundFixture;
      const { receipt, subject } = yield* settleFixture(layout, "frames/a.png", [2]);

      expect(A.map(receipt.predicate.checks, (check) => check.checkId)).toEqual(
        A.map(QaJudgeContract.gates.declarations, (declaration) => declaration.id)
      );
      expect(receipt.predicate.reach).toBe("complete");
      expect(receipt.predicate.contractSubject).toEqual(QaJudgeContractSubject);
      expect(receipt.predicateType).toBe(GateCertificatePredicateType);
      expect(receipt.subject).toEqual([subject]);
      expect(
        S.toEquivalence(GateCertificateReceipt)(yield* decodeReceipt(yield* encodeReceipt(receipt)), receipt)
      ).toBe(true);
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
      }),
    { arbitrary: fcRuns(10) }
  );

  it.effect("binds plans to the producer's written bytes and refuses a changed receipt", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const layout = yield* roundFixture;
      const { leaves, round, subject } = yield* settleFixture(layout, "frames/ghost.png", [2]);
      const decode = yield* evaluateJudgeOutputInventoryDecodes(
        JudgeOutputInventoryDecodesInput.make({ candidate: yield* inventoryText("frames/ghost.png", [2]) })
      );
      const written = yield* writeQaJudgeCertificate(
        layout,
        QaJudgeSettlement.make({
          artifact: O.some(leaves.artifact),
          crossCheck: O.some(leaves.crossCheck),
          decode: O.some(decode),
          eventId: O.some(leaves.eventId),
          inventory: subject,
          round: O.some(round),
        })
      );
      const bytes = yield* fs.readFile(path.join(layout.root, GATE_CERTIFICATE_FILE));
      const plan = (ids: A.NonEmptyReadonlyArray<string>) =>
        GateCertificateApplyPlan.make({ certificate: written.subject, checkIds: A.map(ids, (id) => GateId.make(id)) });

      // The producer's subject is the digest of exactly what it wrote.
      expect(written.subject).toEqual(yield* subjectFor(GATE_CERTIFICATE_FILE, new TextDecoder().decode(bytes)));

      const applied = yield* applyQaJudgeCertificatePlan(plan(["cited-artifact-exists"]), bytes);
      const unknown = yield* applyQaJudgeCertificatePlan(plan(["not-a-qa-gate"]), bytes);

      // A changed receipt that still decodes: its verification time rewritten.
      const changed = yield* encodeReceipt(
        GateCertificateReceipt.make({
          ...written.receipt,
          predicate: GateCertificate.make({ ...written.receipt.predicate, timeVerified: "2000-01-01T00:00:00.000Z" }),
        })
      );
      const stale = yield* applyQaJudgeCertificatePlan(
        plan(["cited-artifact-exists"]),
        new TextEncoder().encode(changed)
      );

      expect(applied).toMatchObject({
        checks: [{ checkId: "cited-artifact-exists", outcome: "failed" }],
        verdict: "applied",
      });
      expect(unknown).toMatchObject({ reason: "unknown-id", unknownIds: ["not-a-qa-gate"], verdict: "refused" });
      expect(stale).toMatchObject({ reason: "stale-digest", unknownIds: [], verdict: "refused" });

      // Changed bytes that no longer decode are stale too: the digest is checked first.
      const corrupt = yield* applyQaJudgeCertificatePlan(
        plan(["cited-artifact-exists"]),
        new TextEncoder().encode("{")
      );
      const incoherent = yield* applyQaJudgeCertificatePlan(
        plan(["cited-artifact-exists"]),
        new TextEncoder().encode(
          yield* encodeJson({
            predicate: "not a certificate",
            predicateType: written.receipt.predicateType,
            subject: written.receipt.subject,
          })
        )
      );
      expect(corrupt).toMatchObject({ reason: "stale-digest", unknownIds: [], verdict: "refused" });
      expect(incoherent).toMatchObject({ reason: "stale-digest", unknownIds: [], verdict: "refused" });
    })
  );
});
