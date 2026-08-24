/**
 * Typed QA gate for cited-artifact filesystem evidence.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import {
  EvidencePredicateType,
  GateDeclaration,
  GateEvidenceRequirement,
  GateVerdict,
  makeGateId,
} from "@beep/skill-contract";
import { A, O } from "@beep/utils";
import { DateTime, Effect, FileSystem, HashSet, Path } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import type { GateEvaluator } from "@beep/skill-contract";

const $I = $RepoCliId.create("commands/Qa/CitedArtifactExistsGate");
const QaJudgeGateId = makeGateId(LiteralKit(["cited-artifact-exists"]));
const citedArtifactExistsGateId = QaJudgeGateId.make("cited-artifact-exists");
const citedArtifactExistsPredicateType = EvidencePredicateType.make(
  "https://beep-effect.dev/qa/evidence/cited-artifact-exists/v1"
);
const evaluatorId = "@beep/repo-cli/qa/cited-artifact-exists";

/**
 * Filesystem input consumed by the cited-artifact gate evaluator.
 *
 * **Example** (Create gate input)
 *
 * ```ts
 * import { CitedArtifactExistsInput } from "@beep/repo-cli/commands/Qa/CitedArtifactExistsGate"
 *
 * const input = CitedArtifactExistsInput.make({
 *   citedPaths: ["frames/drag.png"],
 *   roundRoot: "/tmp/round-1"
 * })
 * console.log(input.citedPaths.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitedArtifactExistsInput extends S.Class<CitedArtifactExistsInput>($I`CitedArtifactExistsInput`)(
  {
    citedPaths: S.Array(S.String).pipe(
      $I.annoteKey("CitedArtifactExistsInput.citedPaths", {
        description: "Deduplicated artifact citations in their original inventory order.",
      })
    ),
    roundRoot: S.String.pipe(
      $I.annoteKey("CitedArtifactExistsInput.roundRoot", {
        description: "Lexical root of the QA round that owns the cited artifacts.",
      })
    ),
  },
  $I.annote("CitedArtifactExistsInput", {
    description: "Round root and ordered artifact citations consumed by the cited-artifact gate.",
  })
) {}

/**
 * Files inspected by a successful cited-artifact evaluation.
 *
 * **Example** (Record checked paths)
 *
 * ```ts
 * import { CitedArtifactExistsAllowed } from "@beep/repo-cli/commands/Qa/CitedArtifactExistsGate"
 *
 * const detail = CitedArtifactExistsAllowed.make({ checkedPaths: ["frames/drag.png"] })
 * console.log(detail.checkedPaths.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitedArtifactExistsAllowed extends S.Class<CitedArtifactExistsAllowed>($I`CitedArtifactExistsAllowed`)(
  {
    checkedPaths: S.Array(S.String).pipe(
      $I.annoteKey("CitedArtifactExistsAllowed.checkedPaths", {
        description: "Artifact citations inspected by the evaluator in inventory order.",
      })
    ),
  },
  $I.annote("CitedArtifactExistsAllowed", {
    description: "Observation detail for an allowed cited-artifact verdict.",
  })
) {}

/**
 * Files inspected by a denied evaluation and the citations that failed closed.
 *
 * **Example** (Record a missing citation)
 *
 * ```ts
 * import { CitedArtifactExistsDenied } from "@beep/repo-cli/commands/Qa/CitedArtifactExistsGate"
 *
 * const detail = CitedArtifactExistsDenied.make({
 *   checkedPaths: ["frames/ghost.png"],
 *   missingPaths: ["frames/ghost.png"]
 * })
 * console.log(detail.missingPaths[0]) // "frames/ghost.png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitedArtifactExistsDenied extends S.Class<CitedArtifactExistsDenied>($I`CitedArtifactExistsDenied`)(
  {
    checkedPaths: S.Array(S.String).pipe(
      $I.annoteKey("CitedArtifactExistsDenied.checkedPaths", {
        description: "Artifact citations inspected by the evaluator in inventory order.",
      })
    ),
    missingPaths: S.NonEmptyArray(S.String).pipe(
      $I.annoteKey("CitedArtifactExistsDenied.missingPaths", {
        description: "Original citations denied as missing, unsafe, aliased, unreadable, or non-file paths.",
      })
    ),
  },
  $I.annote("CitedArtifactExistsDenied", {
    description: "Observation detail for a fail-closed cited-artifact denial.",
  })
) {}

/**
 * Audited allowed or denied result of the cited-artifact gate.
 *
 * **Example** (Construct a denied verdict)
 *
 * ```ts
 * import {
 *   CitedArtifactExistsDenied,
 *   CitedArtifactExistsGate,
 *   CitedArtifactExistsVerdict
 * } from "@beep/repo-cli/commands/Qa/CitedArtifactExistsGate"
 *
 * const verdict = CitedArtifactExistsVerdict.cases.denied.make({
 *   audit: {
 *     detail: CitedArtifactExistsDenied.make({
 *       checkedPaths: ["frames/ghost.png"],
 *       missingPaths: ["frames/ghost.png"]
 *     }),
 *     evaluator: "qa",
 *     gateId: CitedArtifactExistsGate.id,
 *     occurredAt: "2026-08-24T00:00:00.000Z",
 *     outcome: "denied",
 *     reason: "The citation is missing."
 *   }
 * })
 * console.log(verdict.verdict) // "denied"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CitedArtifactExistsVerdict = GateVerdict(CitedArtifactExistsAllowed, CitedArtifactExistsDenied);

/**
 * Runtime type decoded by {@link CitedArtifactExistsVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type CitedArtifactExistsVerdict = typeof CitedArtifactExistsVerdict.Type;

/**
 * Blocking, unconditional declaration for the QA judge's cited-artifact rule.
 *
 * **Example** (Inspect the gate declaration)
 *
 * ```ts
 * import { CitedArtifactExistsGate } from "@beep/repo-cli/commands/Qa/CitedArtifactExistsGate"
 *
 * console.log(CitedArtifactExistsGate.id) // "cited-artifact-exists"
 * console.log(CitedArtifactExistsGate.severity) // "blocking"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitedArtifactExistsGate = GateDeclaration.make({
  applicability: "always",
  evidence: GateEvidenceRequirement.make({
    predicateType: citedArtifactExistsPredicateType,
  }),
  id: citedArtifactExistsGateId,
  remediationOwner: "@beep/repo-cli/Qa",
  severity: "blocking",
});

const allowedReason = "Every cited artifact resolves to a regular file under the canonical round root.";
const deniedReason =
  "One or more cited artifacts are missing, unreadable, non-files, aliases, or outside the canonical round root.";

/**
 * Evaluates cited artifacts with the existing QA path-safety semantics.
 *
 * **Details**
 *
 * Each per-path resolution or stat failure becomes a denied verdict value. The
 * evaluator rejects linked aliases even when their targets remain inside the
 * round root, accepts absolute existing files under that root, and falls back
 * to the lexical root when canonicalizing the round root fails.
 *
 * **Example** (Build an evaluation effect)
 *
 * ```ts
 * import {
 *   CitedArtifactExistsInput,
 *   evaluateCitedArtifactExists
 * } from "@beep/repo-cli/commands/Qa/CitedArtifactExistsGate"
 * import { Effect } from "effect"
 *
 * const program = evaluateCitedArtifactExists(
 *   CitedArtifactExistsInput.make({ citedPaths: [], roundRoot: "/tmp/round-1" })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateCitedArtifactExists: GateEvaluator<
  CitedArtifactExistsInput,
  CitedArtifactExistsVerdict,
  never,
  FileSystem.FileSystem | Path.Path
> = Effect.fn("QaJudgeCheck.evaluateCitedArtifactExists")(function* (
  input: CitedArtifactExistsInput
): Effect.fn.Return<CitedArtifactExistsVerdict, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalRoot = yield* fs
    .realPath(input.roundRoot)
    .pipe(Effect.orElseSucceed(() => path.resolve(input.roundRoot)));
  const present = yield* Effect.forEach(input.citedPaths, (citedPath) => {
    const lexicalCandidate = path.resolve(canonicalRoot, citedPath);
    return resolvePathWithinCanonicalRoot({ canonicalRoot, candidate: citedPath }).pipe(
      Effect.flatMap((canonicalCandidate) =>
        Eq.equals(lexicalCandidate, canonicalCandidate)
          ? fs
              .stat(canonicalCandidate)
              .pipe(Effect.map((info) => (Eq.equals(info.type, "File") ? O.some(citedPath) : O.none<string>())))
          : Effect.succeed(O.none<string>())
      ),
      Effect.orElseSucceed(O.none<string>)
    );
  });
  const presentPaths = HashSet.fromIterable(A.getSomes(present));
  const missingPaths = A.filter(input.citedPaths, (citedPath) => !HashSet.has(presentPaths, citedPath));
  const occurredAt = DateTime.formatIso(yield* DateTime.now);

  return A.match(missingPaths, {
    onEmpty: () =>
      CitedArtifactExistsVerdict.cases.allowed.make({
        audit: {
          detail: CitedArtifactExistsAllowed.make({ checkedPaths: input.citedPaths }),
          evaluator: evaluatorId,
          gateId: citedArtifactExistsGateId,
          occurredAt,
          outcome: "allowed",
          reason: allowedReason,
        },
      }),
    onNonEmpty: (missing) =>
      CitedArtifactExistsVerdict.cases.denied.make({
        audit: {
          detail: CitedArtifactExistsDenied.make({ checkedPaths: input.citedPaths, missingPaths: missing }),
          evaluator: evaluatorId,
          gateId: citedArtifactExistsGateId,
          occurredAt,
          outcome: "denied",
          reason: deniedReason,
        },
      }),
  });
});
