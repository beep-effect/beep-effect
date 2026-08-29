import { Sha256Hex } from "@beep/schema/Sha256";
import {
  decodeSkillFrontmatter,
  EvidenceDigest,
  EvidenceLadderReceiptTypes,
  EvidencePredicateType,
  EvidenceSubject,
  FailurePredicateType,
  GateRegistry,
  GateSummaryPredicateType,
  NoRecoveryPolicy,
  ReceiptTypeBindings,
  renderSkillMarkdown,
  SchemaReference,
  SchemaReferenceId,
  SkillArtifactVerdict,
  SkillContract,
  SkillContractId,
  SkillMarkdownProjection,
  verifySkillArtifact,
} from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const rungType = (name: string) => EvidencePredicateType.make(`https://beep.dev/evidence/${name}/v1`);
const contract = SkillContract.make({
  evidenceSubject: EvidenceSubject.make({
    digest: EvidenceDigest.make({
      sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
    }),
    name: "contracts/qa-inventory-judge/1.0.0.json",
  }),
  gates: GateRegistry.make({ declarations: [] }),
  id: SkillContractId.make("qa-inventory-judge"),
  input: SchemaReference.make({ schemaId: SchemaReferenceId.make("qa.inventory/v1") }),
  output: SchemaReference.make({ schemaId: SchemaReferenceId.make("qa.inventory/verdict/v1") }),
  promise: "Validate one QA inventory against recorded round evidence.",
  receiptTypes: ReceiptTypeBindings.make({
    failure: FailurePredicateType,
    gateSummary: GateSummaryPredicateType,
    ladder: EvidenceLadderReceiptTypes.make({
      accepted: rungType("accepted"),
      delivered: rungType("delivered"),
      persisted: rungType("persisted"),
      semanticallyApplied: rungType("semantically-applied"),
    }),
    recoveryAttempt: rungType("recovery-attempt"),
  }),
  recovery: NoRecoveryPolicy.make({}),
  version: "1.0.0",
});

const renderFixture = () => Result.getOrThrow(renderSkillMarkdown(contract));

describe("@beep/skill-contract SkillProjection", () => {
  it.effect("renders and decodes the exact projection frontmatter", () =>
    Effect.gen(function* () {
      const rendered = renderFixture();
      const decoded = Result.getOrThrow(decodeSkillFrontmatter(rendered));
      const verdict = yield* verifySkillArtifact({ committed: rendered, contract });

      expect(Str.startsWith("---json\n")(rendered)).toBe(true);
      expect(Str.includes("\n# `qa-inventory-judge@1.0.0`\n")(rendered)).toBe(true);
      expect(Str.includes("| `accepted` | `https://beep.dev/evidence/accepted/v1` |")(rendered)).toBe(true);
      expect(decoded.projection).toBe("skill-contract/skill-md/v1");
      expect(
        S.toEquivalence(SkillMarkdownProjection)(
          decoded,
          SkillMarkdownProjection.make({
            contract,
            projection: "skill-contract/skill-md/v1",
          })
        )
      ).toBe(true);
      expect(verdict.verdict).toBe("allowed");
      expect(
        SkillArtifactVerdict.match(verdict, {
          allowed: ({ checks }) => checks,
          denied: ({ checks }) => checks,
        })
      ).toMatchObject([
        { check: "rerender-byte-equality", outcome: "passed" },
        { check: "frontmatter-contract-equality", outcome: "passed" },
      ]);
    })
  );

  it.effect("denies a tampered body while still passing frontmatter equality", () =>
    Effect.gen(function* () {
      const verdict = yield* verifySkillArtifact({ committed: `${renderFixture()}\n\nTampered body.`, contract });

      expect(verdict.verdict).toBe("denied");
      expect(
        SkillArtifactVerdict.match(verdict, {
          allowed: () => [],
          denied: ({ reasons }) => reasons,
        })
      ).toEqual(["rerender-mismatch"]);
      expect(
        SkillArtifactVerdict.match(verdict, {
          allowed: ({ checks }) => checks,
          denied: ({ checks }) => checks,
        })
      ).toMatchObject([
        { check: "rerender-byte-equality", outcome: "failed" },
        { check: "frontmatter-contract-equality", outcome: "passed" },
      ]);
    })
  );

  it.effect("denies valid but contract-mismatched frontmatter and reports both checks", () =>
    Effect.gen(function* () {
      const committed = Str.replace(
        "Validate one QA inventory against recorded round evidence.",
        "Validate a different promise."
      )(renderFixture());
      const verdict = yield* verifySkillArtifact({ committed, contract });

      expect(verdict.verdict).toBe("denied");
      expect(
        SkillArtifactVerdict.match(verdict, {
          allowed: () => [],
          denied: ({ reasons }) => reasons,
        })
      ).toEqual(["rerender-mismatch", "contract-mismatch"]);
    })
  );

  it.effect("denies frontmatter that no longer decodes as the projection schema", () =>
    Effect.gen(function* () {
      const committed = Str.replace(
        '"projection":"skill-contract/skill-md/v1"',
        '"projection":"tampered"'
      )(renderFixture());
      const verdict = yield* verifySkillArtifact({ committed, contract });

      expect(verdict.verdict).toBe("denied");
      expect(
        SkillArtifactVerdict.match(verdict, {
          allowed: () => [],
          denied: ({ reasons }) => reasons,
        })
      ).toEqual(["rerender-mismatch", "frontmatter-decode-failed"]);
    })
  );

  it.effect("denies missing and unterminated leading frontmatter", () =>
    Effect.gen(function* () {
      const missing = yield* verifySkillArtifact({ committed: "# no frontmatter", contract });
      const unterminated = decodeSkillFrontmatter('---json\n{"projection":"skill-contract/skill-md/v1"}');

      expect(
        SkillArtifactVerdict.match(missing, {
          allowed: () => [],
          denied: ({ reasons }) => reasons,
        })
      ).toEqual(["rerender-mismatch", "frontmatter-missing"]);
      expect(Result.isFailure(unterminated)).toBe(true);
      expect(Result.isFailure(unterminated) ? unterminated.failure.reasons : []).toEqual(["frontmatter-missing"]);
    })
  );

  it("allows every schema-derived contract after render and verification", () =>
    fc.assert(
      fc.property(S.toArbitrary(SkillContract)(fc), (candidate) => {
        const committed = Result.getOrThrow(renderSkillMarkdown(candidate));
        const verdict = Effect.runSync(verifySkillArtifact({ committed, contract: candidate }));

        expect(verdict.verdict).toBe("allowed");
      }),
      fcRuns(25)
    ));
});
