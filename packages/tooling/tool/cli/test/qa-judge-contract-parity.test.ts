import { MarkerEvent, RoundLayout } from "@beep/qa-capture";
import {
  CitedArtifactExistsGate,
  CitedArtifactExistsInput,
  CitedArtifactExistsVerdict,
  CitedEventIdExistsInput,
  CitedEventIdExistsVerdict,
  citedArtifactVerdictToCrossCheck,
  crossCheckAgainstRound,
  crossCheckEvidence,
  DeclaredRoundCoherentInput,
  DeclaredRoundCoherentVerdict,
  EvidenceCrossCheckCleanInput,
  EvidenceCrossCheckCleanVerdict,
  evaluateCitedArtifactExists,
  evaluateCitedEventIdExists,
  evaluateDeclaredRoundCoherent,
  evaluateEvidenceCrossCheckClean,
  evaluateJudgeOutputInventoryDecodes,
  evidenceCrossCheckVerdictToCrossCheck,
  JudgeOutputInventoryDecodesGate,
  JudgeOutputInventoryDecodesInput,
  JudgeOutputInventoryDecodesVerdict,
  QaEventLog,
  QaFindingId,
  QaInventory,
  QaJudgeContract,
  QaJudgeContractSubject,
  QaJudgeRef,
  raiseCrossCheckFailure,
  renderCrossCheckFailure,
} from "@beep/repo-cli/commands/Qa";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema/Sha256";
import { ISOStr } from "@beep/schema/Timestamp";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { URLStr } from "@beep/schema/URL";
import {
  AttestationResource,
  EvaluateSkillCompletionInput,
  EvidenceDigest,
  EvidenceReceiptReference,
  EvidenceSubject,
  evaluateSkillCompletion,
  GateRegistry,
  GateResultSummary,
  GateSummary,
  GateSummaryPredicateType,
  GateSummaryReceipt,
  GateSummaryVerifier,
  SemanticallyApplied,
  SkillArtifactVerdict,
  SkillContract,
  verifySkillArtifact,
} from "@beep/skill-contract";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Exit, FileSystem, HashSet, Layer, Path, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import type { EvidencePredicateType, GateDeclaration } from "@beep/skill-contract";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const withTempDir = <A, E, R>(use: (dir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix: "beep-qa-gate-parity-" })),
    use,
    (dir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

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

const missingPathsOf = (verdict: CitedArtifactExistsVerdict): ReadonlyArray<string> =>
  CitedArtifactExistsVerdict.match(verdict, {
    allowed: () => [],
    denied: ({ audit }) => audit.detail.missingPaths,
  });

describe("commands/Qa cited-artifact typed gate parity", () => {
  it.effect("accepts absolute in-root files and rejects aliases, escapes, non-files, and missing leaves", () =>
    withTempDir(
      Effect.fnUntraced(function* (parent) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const roundRoot = path.join(parent, "round-1");
        const framesDir = path.join(roundRoot, "frames");
        const realFile = path.join(framesDir, "real.png");
        const inRootAlias = path.join(framesDir, "alias.png");
        const outsideFile = path.join(parent, "outside.png");
        const escapingAlias = path.join(framesDir, "escape.png");
        yield* fs.makeDirectory(framesDir, { recursive: true });
        yield* fs.makeDirectory(path.join(framesDir, "directory.png"));
        yield* fs.writeFileString(realFile, "frame");
        yield* fs.writeFileString(outsideFile, "outside");
        yield* fs.symlink(realFile, inRootAlias);
        yield* fs.symlink(outsideFile, escapingAlias);

        const input = CitedArtifactExistsInput.make({
          citedPaths: ["frames/alias.png", realFile, "frames/directory.png", "frames/escape.png", "frames/missing.png"],
          roundRoot,
        });
        const exit = yield* Effect.exit(evaluateCitedArtifactExists(input));
        const verdict = yield* evaluateCitedArtifactExists(input);

        expect(Exit.isSuccess(exit)).toBe(true);
        expect(verdict.verdict).toBe("denied");
        expect(verdict.audit.detail.checkedPaths).toEqual(input.citedPaths);
        expect(missingPathsOf(verdict)).toEqual([
          "frames/alias.png",
          "frames/directory.png",
          "frames/escape.png",
          "frames/missing.png",
        ]);
      })
    )
  );

  it.effect("falls back to the lexical root and returns denial when the canonical root cannot resolve", () =>
    withTempDir(
      Effect.fnUntraced(function* (parent) {
        const path = yield* Path.Path;
        const root = path.join(parent, "missing-round");
        const input = CitedArtifactExistsInput.make({
          citedPaths: ["frames/ghost.png"],
          roundRoot: root,
        });
        const exit = yield* Effect.exit(evaluateCitedArtifactExists(input));
        const verdict = yield* evaluateCitedArtifactExists(input);

        expect(Exit.isSuccess(exit)).toBe(true);
        expect(verdict.verdict).toBe("denied");
        expect(missingPathsOf(verdict)).toEqual(["frames/ghost.png"]);
      })
    )
  );

  it.effect("matches the legacy aggregate, citation ordering, renderer, and error channel", () =>
    withTempDir(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.makeDirectory(path.join(root, "frames"), { recursive: true });
        yield* fs.writeFileString(path.join(root, "frames", "real.png"), "frame");
        const inventory = QaInventory.make({
          findings: [
            {
              evidence: [
                { eventIds: [9, 2], frameRange: O.none(), kind: "strip", path: "frames/z-missing.png" },
                { eventIds: [2], frameRange: O.none(), kind: "frame", path: "frames/real.png" },
              ],
              fix: "Capture the missing artifact.",
              id: QaFindingId.make("R1-01"),
              lens: "selection-smear",
              repro: "Drag the sash.",
              resolvedInRound: O.none(),
              severity: "P0",
              title: "Missing evidence",
            },
            {
              evidence: [
                { eventIds: [7, 9], frameRange: O.none(), kind: "sheet", path: "frames/a-missing.png" },
                { eventIds: [9], frameRange: O.none(), kind: "strip", path: "frames/z-missing.png" },
              ],
              fix: "Capture the other artifact.",
              id: QaFindingId.make("R1-02"),
              lens: "drag-ghost",
              repro: "Drag again.",
              resolvedInRound: O.none(),
              severity: "P2",
              title: "Other missing evidence",
            },
          ],
          judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
          requiredCount: 1,
          round: 1,
          schemaVersion: "qa-inventory/v1",
          sessionRef: "session.json",
        });
        const eventLog = QaEventLog.make({
          events: [
            MarkerEvent.make({
              kind: "marker",
              label: "scenario:parity",
              seq: 2,
              tEpochMs: 1_754_000_000_000,
            }),
          ],
          rejectedCount: 0,
        });
        const legacy = crossCheckEvidence(inventory, HashSet.make("frames/real.png"), HashSet.make(2));
        const projected = yield* crossCheckAgainstRound(layoutFor(root), inventory, eventLog);
        const rendered = renderCrossCheckFailure(1, projected);
        const error = yield* raiseCrossCheckFailure(1, projected).pipe(Effect.flip);

        expect(projected).toEqual(legacy);
        expect(projected.missingPaths).toEqual(["frames/z-missing.png", "frames/a-missing.png"]);
        expect(projected.missingEventIds).toEqual([9, 7]);
        expect(rendered).toBe(
          "qa judge inventory for round 1 cites evidence the round cannot back up.\n" +
            "  missing artifact: frames/z-missing.png\n" +
            "  missing artifact: frames/a-missing.png\n" +
            "  missing event id: 9\n" +
            "  missing event id: 7"
        );
        expect(error.message).toBe(rendered);
      })
    )
  );

  it("projects allowed and denied verdicts without audit-field loss affecting the legacy shape", () => {
    const gateId = CitedArtifactExistsGate.id;
    const allowed = CitedArtifactExistsVerdict.cases.allowed.make({
      audit: {
        detail: { checkedPaths: ["frames/real.png"] },
        evaluator: "qa",
        gateId,
        occurredAt: ISOStr.make("2026-08-24T00:00:00.000Z"),
        outcome: "allowed",
        reason: "The artifact exists.",
      },
    });
    const denied = CitedArtifactExistsVerdict.cases.denied.make({
      audit: {
        detail: { checkedPaths: ["frames/ghost.png"], missingPaths: ["frames/ghost.png"] },
        evaluator: "qa",
        gateId,
        occurredAt: ISOStr.make("2026-08-24T00:00:00.000Z"),
        outcome: "denied",
        reason: "The artifact is missing.",
      },
    });

    expect(citedArtifactVerdictToCrossCheck(allowed, [5])).toEqual({ missingEventIds: [5], missingPaths: [] });
    expect(citedArtifactVerdictToCrossCheck([5])(denied)).toEqual({
      missingEventIds: [5],
      missingPaths: ["frames/ghost.png"],
    });
  });

  it.effect("treats regular-file existence as sufficient without claiming content integrity", () =>
    withTempDir(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const artifact = path.join(root, "frame.png");
        const input = CitedArtifactExistsInput.make({ citedPaths: ["frame.png"], roundRoot: root });
        yield* fs.writeFileString(artifact, "first contents");
        const before = yield* evaluateCitedArtifactExists(input);
        yield* fs.writeFileString(artifact, "different contents");
        const after = yield* evaluateCitedArtifactExists(input);

        expect(before.verdict).toBe("allowed");
        expect(after.verdict).toBe("allowed");
      })
    )
  );
});

describe("commands/Qa complete judge contract parity", () => {
  it("composes the five declarations from the single ordered gate-id registry", () => {
    expect(QaJudgeContract.id).toBe("https://beep-effect.dev/contracts/qa-inventory/v1");
    expect(A.map(QaJudgeContract.gates.declarations, (gate) => gate.id)).toEqual([
      "judge-output-inventory-decodes",
      "declared-round-coherent",
      "cited-artifact-exists",
      "cited-event-id-exists",
      "evidence-cross-check-clean",
    ]);
    expect(A.map(QaJudgeContract.gates.declarations, (gate) => gate.severity)).toEqual([
      "blocking",
      "blocking",
      "blocking",
      "blocking",
      "blocking",
    ]);
    expect(A.map(QaJudgeContract.gates.declarations, (gate) => gate.applicability.kind)).toEqual([
      "always",
      "always",
      "always",
      "always",
      "always",
    ]);
  });

  it.effect("binds the contract evidence subject to the SHA-256 of its own identity", () =>
    Effect.gen(function* () {
      const digest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(QaJudgeContractSubject.name));

      expect(QaJudgeContractSubject.name).toBe(`${QaJudgeContract.id}@${QaJudgeContract.version}`);
      expect(QaJudgeContract.evidenceSubject).toBe(QaJudgeContractSubject);
      expect(QaJudgeContractSubject.digest.sha256).toBe(digest);
    }).pipe(provideScopedLayer(BunCrypto.layer))
  );

  it.effect("detects missing event ids in first-citation order and deduplicates repeats", () =>
    Effect.gen(function* () {
      const verdict = yield* evaluateCitedEventIdExists(
        CitedEventIdExistsInput.make({ citedEventIds: [9, 2, 9, 7], knownEventIds: [2, 3] })
      );

      expect(verdict.verdict).toBe("denied");
      expect(
        CitedEventIdExistsVerdict.match(verdict, {
          allowed: () => [],
          denied: ({ audit }) => audit.detail.checkedEventIds,
        })
      ).toEqual([9, 2, 7]);
      expect(
        CitedEventIdExistsVerdict.match(verdict, {
          allowed: () => [],
          denied: ({ audit }) => audit.detail.missingEventIds,
        })
      ).toEqual([9, 7]);
    })
  );

  it.effect("allows a coherent declared round and denies a copied inventory round", () =>
    Effect.gen(function* () {
      const allowed = yield* evaluateDeclaredRoundCoherent(
        DeclaredRoundCoherentInput.make({ declaredRound: 4, requestedRound: 4 })
      );
      const denied = yield* evaluateDeclaredRoundCoherent(
        DeclaredRoundCoherentInput.make({ declaredRound: 5, requestedRound: 4 })
      );

      expect(allowed.verdict).toBe("allowed");
      expect(denied.verdict).toBe("denied");
      expect(
        DeclaredRoundCoherentVerdict.match(denied, {
          allowed: () => ({ declaredRound: 0, requestedRound: 0 }),
          denied: ({ audit }) => audit.detail,
        })
      ).toMatchObject({ declaredRound: 5, requestedRound: 4 });
    })
  );

  it.effect("keeps aggregate settlement distinct from the artifact and event leaf verdicts", () =>
    withTempDir(
      Effect.fnUntraced(function* (root) {
        const artifactVerdict = yield* evaluateCitedArtifactExists(
          CitedArtifactExistsInput.make({ citedPaths: ["frames/ghost.png"], roundRoot: root })
        );
        const eventIdVerdict = yield* evaluateCitedEventIdExists(
          CitedEventIdExistsInput.make({ citedEventIds: [8], knownEventIds: [] })
        );
        const aggregate = yield* evaluateEvidenceCrossCheckClean(
          EvidenceCrossCheckCleanInput.make({ artifactVerdict, eventIdVerdict })
        );

        expect(artifactVerdict.audit.gateId).toBe("cited-artifact-exists");
        expect(eventIdVerdict.audit.gateId).toBe("cited-event-id-exists");
        expect(aggregate.audit.gateId).toBe("evidence-cross-check-clean");
        expect(aggregate.verdict).toBe("denied");
        expect(
          EvidenceCrossCheckCleanVerdict.match(aggregate, {
            allowed: () => ({ missingEventIds: [], missingPaths: [] }),
            denied: ({ audit }) => audit.detail,
          })
        ).toMatchObject({ missingEventIds: [8], missingPaths: ["frames/ghost.png"] });
      })
    )
  );

  it.effect("decodes valid output and denies malformed JSON, empty evidence, and incoherent P0/P1 counts", () =>
    Effect.gen(function* () {
      const finding = {
        evidence: [{ eventIds: [2], kind: "strip", path: "frames/a.png" }],
        fix: "Fix the drag behavior.",
        id: "R4-01",
        lens: "selection-smear",
        repro: "Drag the sash.",
        severity: "P0",
        title: "Selection smear",
      };
      const inventory = {
        findings: [finding],
        judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
        requiredCount: 1,
        round: 4,
        schemaVersion: "qa-inventory/v1",
        sessionRef: "session.json",
      };
      const validCandidate = yield* UnknownFromJsonString.encodeEffect(inventory);
      const emptyEvidenceCandidate = yield* UnknownFromJsonString.encodeEffect({
        ...inventory,
        findings: [{ ...finding, evidence: [] }],
      });
      const wrongCountCandidate = yield* UnknownFromJsonString.encodeEffect({ ...inventory, requiredCount: 0 });
      const allowed = yield* evaluateJudgeOutputInventoryDecodes(
        JudgeOutputInventoryDecodesInput.make({ candidate: validCandidate })
      );
      const malformed = yield* evaluateJudgeOutputInventoryDecodes(
        JudgeOutputInventoryDecodesInput.make({ candidate: "{" })
      );
      const emptyEvidence = yield* evaluateJudgeOutputInventoryDecodes(
        JudgeOutputInventoryDecodesInput.make({ candidate: emptyEvidenceCandidate })
      );
      const wrongCount = yield* evaluateJudgeOutputInventoryDecodes(
        JudgeOutputInventoryDecodesInput.make({ candidate: wrongCountCandidate })
      );

      expect(allowed.verdict).toBe("allowed");
      expect(malformed.verdict).toBe("denied");
      expect(malformed.audit.reason).toBe("The judge output candidate does not parse as JSON.");
      expect(emptyEvidence.verdict).toBe("denied");
      expect(wrongCount.verdict).toBe("denied");
      expect(emptyEvidence.audit.reason).toBe("The judge output candidate does not decode as qa-inventory/v1.");
      expect(wrongCount.audit.reason).toBe("The judge output candidate does not decode as qa-inventory/v1.");

      const deniedDetail = (verdict: JudgeOutputInventoryDecodesVerdict) =>
        JudgeOutputInventoryDecodesVerdict.match(verdict, {
          allowed: () => O.none(),
          denied: ({ audit }) => O.some(audit.detail),
        });
      expect(O.map(deniedDetail(malformed), (detail) => detail.failure)).toEqual(O.some("malformed-json"));
      expect(O.map(deniedDetail(wrongCount), (detail) => detail.failure)).toEqual(O.some("inventory-schema-rejected"));
      expect(O.exists(deniedDetail(malformed), (detail) => S.is(S.NonEmptyString)(detail.issue))).toBe(true);
      expect(O.exists(deniedDetail(wrongCount), (detail) => S.is(S.NonEmptyString)(detail.issue))).toBe(true);
    })
  );

  it.effect("accepts coherent P0 and P1 required counts while excluding P2", () =>
    Effect.gen(function* () {
      const finding = (id: string, severity: "P0" | "P1" | "P2") => ({
        evidence: [{ eventIds: [], kind: "frame", path: `frames/${id}.png` }],
        fix: "Fix it.",
        id,
        lens: "drag-ghost",
        repro: "Drag it.",
        severity,
        title: id,
      });
      const candidate = yield* UnknownFromJsonString.encodeEffect({
        findings: [finding("R4-01", "P0"), finding("R4-02", "P1"), finding("R4-03", "P2")],
        judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
        requiredCount: 2,
        round: 4,
        schemaVersion: "qa-inventory/v1",
        sessionRef: "session.json",
      });
      const verdict = yield* evaluateJudgeOutputInventoryDecodes(JudgeOutputInventoryDecodesInput.make({ candidate }));

      expect(verdict.verdict).toBe("allowed");
      expect(
        JudgeOutputInventoryDecodesVerdict.match(verdict, {
          allowed: ({ audit }) => audit.detail.inventory.requiredCount,
          denied: () => -1,
        })
      ).toBe(2);
    })
  );

  it.effect("round-trips the contract and rejects duplicate QA gate ids at external decode", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeUnknownEffect(SkillContract)(QaJudgeContract);
      const decoded = yield* S.decodeEffect(SkillContract)(encoded);
      const duplicate = yield* S.decodeEffect(GateRegistry)({
        declarations: [CitedArtifactExistsGate, CitedArtifactExistsGate],
      }).pipe(Effect.flip);

      expect(S.toEquivalence(SkillContract)(decoded, QaJudgeContract)).toBe(true);
      expect(duplicate.message).toContain("unique gate ids");
    })
  );

  it("round-trips schema-derived event gate inputs", () =>
    fc.assert(
      fc.property(S.toArbitrary(CitedEventIdExistsInput)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(CitedEventIdExistsInput)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(CitedEventIdExistsInput)(encoded));

        expect(S.toEquivalence(CitedEventIdExistsInput)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));
});

describe("commands/Qa judge contract completion through the kernel evaluator", () => {
  const digest = EvidenceDigest.make({
    sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  });
  const outputSubject = EvidenceSubject.make({ digest, name: "qa/rounds/1/inventory.json" });
  const summarySubject = EvidenceSubject.make({ digest, name: "qa/rounds/1/gate-summary.json" });
  const reference = (
    predicateType: EvidencePredicateType,
    subjects: A.NonEmptyReadonlyArray<EvidenceSubject> = [summarySubject]
  ) => EvidenceReceiptReference.make({ predicateType, receipt: summarySubject, subjects });
  const ladderTypes = QaJudgeContract.receiptTypes.ladder;
  const ladder = SemanticallyApplied.make({
    accepted: reference(ladderTypes.accepted),
    delivered: reference(ladderTypes.delivered),
    persisted: reference(ladderTypes.persisted),
    semanticallyApplied: reference(ladderTypes.semanticallyApplied, [outputSubject]),
  });
  const gateResult = (declaration: GateDeclaration, outcome: "allowed" | "denied") =>
    GateResultSummary.make({
      applicable: true,
      evidenceSubjects: [summarySubject],
      evidenceType: declaration.evidence.predicateType,
      gateId: declaration.id,
      outcome,
      severity: declaration.severity,
    });
  const summaryFor = (gateResults: ReadonlyArray<GateResultSummary>) => {
    const passed = A.every(gateResults, (result) => result.outcome === "allowed");
    return GateSummaryReceipt.make({
      predicate: GateSummary.make({
        contractSubject: QaJudgeContractSubject,
        gateResults,
        inputAttestations: [
          AttestationResource.make({ digest, uri: URLStr.make("https://beep-effect.dev/qa/attestations/input/v1") }),
        ],
        policy: AttestationResource.make({ digest, uri: URLStr.make("https://beep-effect.dev/qa/policy/judge/v1") }),
        resourceUri: URLStr.make("https://beep-effect.dev/qa/rounds/1/inventory.json"),
        timeVerified: ISOStr.make("2026-08-25T00:00:00.000Z"),
        verificationResult: passed ? "PASSED" : "FAILED",
        verifiedLevels: passed ? ["BEEP_SKILL_CONTRACT_BLOCKING_GATES"] : ["FAILED"],
        verifier: GateSummaryVerifier.make({
          id: URLStr.make("https://beep-effect.dev/qa/verifier/judge/v1"),
          version: { kernel: "1.0.0" },
        }),
      }),
      predicateType: GateSummaryPredicateType,
      subject: [summarySubject],
    });
  };
  const evaluate = (gateResults: ReadonlyArray<GateResultSummary>) =>
    evaluateSkillCompletion(
      EvaluateSkillCompletionInput.make({
        contract: QaJudgeContract,
        gateSummary: summaryFor(gateResults),
        ladder,
        outputSubjects: [outputSubject],
      })
    );

  it.effect("reaches live completion once every declared gate is allowed", () =>
    Effect.gen(function* () {
      const evaluation = yield* evaluate(
        A.map(QaJudgeContract.gates.declarations, (declaration) => gateResult(declaration, "allowed"))
      );

      expect(evaluation.verdict).toBe("allowed");
    })
  );

  it.effect("denies completion as a verdict value when the decode gate is denied", () =>
    Effect.gen(function* () {
      const evaluation = yield* evaluate(
        A.map(QaJudgeContract.gates.declarations, (declaration) =>
          gateResult(
            declaration,
            Equal.equals(declaration.id, JudgeOutputInventoryDecodesGate.id) ? "denied" : "allowed"
          )
        )
      );

      expect(evaluation.verdict).toBe("denied");
    })
  );
});

describe("commands/Qa aggregate cross-check settlement", () => {
  it.effect("denies on missing event ids alone and refuses a denied detail with nothing missing", () =>
    withTempDir(
      Effect.fnUntraced(function* (root) {
        const artifactVerdict = yield* evaluateCitedArtifactExists(
          CitedArtifactExistsInput.make({ citedPaths: [], roundRoot: root })
        );
        const eventIdVerdict = yield* evaluateCitedEventIdExists(
          CitedEventIdExistsInput.make({ citedEventIds: [3], knownEventIds: [] })
        );
        const aggregate = yield* evaluateEvidenceCrossCheckClean(
          EvidenceCrossCheckCleanInput.make({ artifactVerdict, eventIdVerdict })
        );
        const nothingMissing = yield* S.decodeUnknownEffect(EvidenceCrossCheckCleanVerdict)({
          audit: { ...aggregate.audit, detail: { missingEventIds: [], missingPaths: [] } },
          verdict: "denied",
        }).pipe(Effect.flip);

        expect(artifactVerdict.verdict).toBe("allowed");
        expect(aggregate.verdict).toBe("denied");
        expect(evidenceCrossCheckVerdictToCrossCheck(aggregate)).toEqual({ missingEventIds: [3], missingPaths: [] });
        expect(nothingMissing.message).toContain("Expected at least one missing artifact path or event id");
      })
    )
  );
});

describe("commands/Qa judge contract SKILL.md projection", () => {
  const committedArtifact = Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* fs.readFileString(path.join(process.cwd(), "skills", "qa-inventory-judge", "SKILL.md"));
  });

  it.effect("verifies the committed qa-inventory judge SKILL.md artifact", () =>
    Effect.gen(function* () {
      const committed = yield* committedArtifact();
      const verdict = yield* verifySkillArtifact({ committed, contract: QaJudgeContract });

      expect(verdict.verdict).toBe("allowed");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("denies a mutated copy of the committed SKILL.md artifact", () =>
    Effect.gen(function* () {
      const committed = yield* committedArtifact();
      const verdict = yield* verifySkillArtifact({
        committed: Str.replace("Mode: none", "Mode: tampered")(committed),
        contract: QaJudgeContract,
      });

      expect(verdict.verdict).toBe("denied");
      expect(
        SkillArtifactVerdict.match(verdict, {
          allowed: () => [],
          denied: ({ reasons }) => reasons,
        })
      ).toEqual(["rerender-mismatch"]);
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});
