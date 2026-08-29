/**
 * Deterministic SKILL.md projection and narrow frontmatter re-extraction gate.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { Md } from "@beep/md";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Unknown } from "@beep/schema/Unknown";
import { Duration, Effect, Result, Tuple } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GateApplicability } from "./Gate.ts";
import { RecoveryPolicy } from "./Recovery.ts";
import { SkillContract } from "./SkillContract.ts";
import type { Document, RenderError } from "@beep/md";
import type { Markdown } from "@beep/schema";

const $I = $SkillContractId.create("SkillProjection");
const projectionKind = LiteralKit(["skill-contract/skill-md/v1"]).pipe(
  $I.annoteSchema("SkillMarkdownProjectionKind", {
    description: "Versioned identity of the deterministic SKILL.md projection format.",
  })
);
const artifactCheckName = LiteralKit(["rerender-byte-equality", "frontmatter-contract-equality"]).pipe(
  $I.annoteSchema("SkillArtifactCheckName", {
    description: "Closed identities of the two checks performed by skill artifact verification.",
  })
);
const artifactCheckOutcome = LiteralKit(["passed", "failed"]).pipe(
  $I.annoteSchema("SkillArtifactCheckOutcome", {
    description: "Pass or failure outcome of one skill artifact verification check.",
  })
);
const frontmatterOpen = "---json\n";
const frontmatterClose = "\n---";
const contractEquivalence = S.toEquivalence(SkillContract);

/**
 * Machine-readable model embedded as the deterministic document frontmatter.
 *
 * **Details**
 *
 * Its encoded form is JSON-compatible and is the only portion of SKILL.md
 * decoded by this package. The Markdown body remains intentionally one-way.
 *
 * **Example** (Construct a projection model)
 *
 * ```ts
 * import { SkillMarkdownProjection } from "@beep/skill-contract"
 *
 * console.log(SkillMarkdownProjection.fields.contract !== undefined) // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class SkillMarkdownProjection extends S.Class<SkillMarkdownProjection>($I`SkillMarkdownProjection`)(
  {
    contract: SkillContract,
    projection: projectionKind,
  },
  $I.annote("SkillMarkdownProjection", {
    description: "Versioned SKILL.md projection metadata containing the complete typed skill contract.",
  })
) {}

/**
 * Closed reasons for denying a committed SKILL.md artifact.
 *
 * **Example** (Inspect denial reasons)
 *
 * ```ts
 * import { SkillArtifactDenialReason } from "@beep/skill-contract"
 *
 * console.log(SkillArtifactDenialReason.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkillArtifactDenialReason = LiteralKit([
  "rerender-mismatch",
  "frontmatter-missing",
  "frontmatter-decode-failed",
  "contract-mismatch",
]).pipe(
  $I.annoteSchema("SkillArtifactDenialReason", {
    description: "Fail-closed reasons produced by deterministic rendering and frontmatter contract verification.",
  })
);

/**
 * Runtime type decoded by {@link SkillArtifactDenialReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type SkillArtifactDenialReason = typeof SkillArtifactDenialReason.Type;

/**
 * Auditable outcome of one named artifact verification check.
 *
 * **Example** (Record a successful check)
 *
 * ```ts
 * import { SkillArtifactCheck } from "@beep/skill-contract"
 *
 * const check = SkillArtifactCheck.make({
 *   check: "rerender-byte-equality",
 *   detail: "Rendered bytes equal the committed artifact.",
 *   outcome: "passed"
 * })
 * console.log(check.outcome) // "passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillArtifactCheck extends S.Class<SkillArtifactCheck>($I`SkillArtifactCheck`)(
  {
    check: artifactCheckName,
    detail: S.NonEmptyString,
    outcome: artifactCheckOutcome,
  },
  $I.annote("SkillArtifactCheck", {
    description: "Named pass or failure observation recorded by skill artifact verification.",
  })
) {}

/**
 * Allowed artifact verdict carrying successful audit observations.
 *
 * **Example** (Inspect allowed verdict fields)
 *
 * ```ts
 * import { SkillArtifactAllowed } from "@beep/skill-contract"
 *
 * console.log(SkillArtifactAllowed.fields.checks !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillArtifactAllowed extends S.Class<SkillArtifactAllowed>($I`SkillArtifactAllowed`)(
  {
    checks: S.NonEmptyArray(SkillArtifactCheck),
    verdict: S.tag("allowed"),
  },
  $I.annote("SkillArtifactAllowed", {
    description: "Allowed artifact verdict proving byte equality and frontmatter contract equality.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Denied artifact verdict carrying every failed check and audit observation.
 *
 * **Example** (Inspect denied verdict fields)
 *
 * ```ts
 * import { SkillArtifactDenied } from "@beep/skill-contract"
 *
 * console.log(SkillArtifactDenied.fields.reasons !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillArtifactDenied extends S.Class<SkillArtifactDenied>($I`SkillArtifactDenied`)(
  {
    checks: S.NonEmptyArray(SkillArtifactCheck),
    reasons: S.NonEmptyArray(SkillArtifactDenialReason),
    verdict: S.tag("denied"),
  },
  $I.annote("SkillArtifactDenied", {
    description: "Denied artifact verdict retaining all failed reasons and ordered audit observations as values.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Fail-closed value result of committed SKILL.md verification.
 *
 * **Example** (Inspect verdict cases)
 *
 * ```ts
 * import { SkillArtifactVerdict } from "@beep/skill-contract"
 *
 * console.log(SkillArtifactVerdict.discriminants) // ["allowed", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkillArtifactVerdict = LiteralKit(["allowed", "denied"])
  .mapMembers(Tuple.evolve([SkillArtifactAllowed.thunkThis, SkillArtifactDenied.thunkThis]))
  .pipe(
    S.toTaggedUnion("verdict"),
    $I.annoteSchema("SkillArtifactVerdict", {
      description: "Allowed or denied committed SKILL.md verification with ordered audit observations.",
    })
  );

/**
 * Runtime type decoded by {@link SkillArtifactVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type SkillArtifactVerdict = typeof SkillArtifactVerdict.Type;

/**
 * Contract and committed Markdown evaluated by {@link verifySkillArtifact}.
 *
 * **Example** (Inspect verification input fields)
 *
 * ```ts
 * import { VerifySkillArtifactInput } from "@beep/skill-contract"
 *
 * console.log(VerifySkillArtifactInput.fields.committed !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifySkillArtifactInput extends S.Class<VerifySkillArtifactInput>($I`VerifySkillArtifactInput`)(
  {
    committed: S.String,
    contract: SkillContract,
  },
  $I.annote("VerifySkillArtifactInput", {
    description: "Typed skill contract and committed SKILL.md bytes evaluated for deterministic parity.",
  })
) {}

const gatesTable = (contract: SkillContract) =>
  Md.table(
    A.prepend(
      A.map(contract.gates.declarations, (gate) =>
        A.make(
          Md.code(gate.id),
          gate.severity,
          GateApplicability.match(gate.applicability, {
            always: () => "always",
            conditional: () => "conditional",
          }),
          Md.code(gate.evidence.predicateType),
          Md.code(gate.remediationOwner)
        )
      ),
      A.make("id", "severity", "applicability", "evidence predicateType", "remediation owner")
    ),
    { headerRow: true }
  );

const receiptTypesTable = (contract: SkillContract) =>
  Md.table(
    A.make(
      A.make("receipt", "predicateType"),
      A.make(Md.code("accepted"), Md.code(contract.receiptTypes.ladder.accepted)),
      A.make(Md.code("persisted"), Md.code(contract.receiptTypes.ladder.persisted)),
      A.make(Md.code("delivered"), Md.code(contract.receiptTypes.ladder.delivered)),
      A.make(Md.code("semanticallyApplied"), Md.code(contract.receiptTypes.ladder.semanticallyApplied)),
      A.make(Md.code("failure"), Md.code(contract.receiptTypes.failure)),
      A.make(Md.code("gateSummary"), Md.code(contract.receiptTypes.gateSummary)),
      A.make(Md.code("recoveryAttempt"), Md.code(contract.receiptTypes.recoveryAttempt))
    ),
    { headerRow: true }
  );

const recoveryBlocks = (contract: SkillContract) =>
  RecoveryPolicy.match(contract.recovery, {
    none: () => A.make(Md.p("Mode: none")),
    bounded: ({ budget }) =>
      A.make(
        Md.p("Mode: bounded"),
        Md.table(
          A.make(
            A.make("limit", "value"),
            A.make("maxAttempts", `${budget.maxAttempts}`),
            A.make("maxOperations", `${budget.maxOperations}`),
            A.make("perAttemptTimeoutMs", `${Duration.toMillis(budget.perAttemptTimeout)}`),
            A.make("totalTimeoutMs", `${Duration.toMillis(budget.totalTimeout)}`)
          ),
          { headerRow: true }
        )
      ),
  });

const projectionBlocks = (contract: SkillContract) =>
  A.appendAll(
    A.make(
      Md.h1(Md.code(`${contract.id}@${contract.version}`)),
      Md.p(contract.promise),
      Md.h2("Evidence subject"),
      Md.p([Md.strong("Name:"), " ", Md.code(contract.evidenceSubject.name)]),
      Md.p([Md.strong("SHA-256:"), " ", Md.code(contract.evidenceSubject.digest.sha256)]),
      Md.h2("Input schema reference"),
      Md.p(Md.code(contract.input.schemaId)),
      Md.h2("Output schema reference"),
      Md.p(Md.code(contract.output.schemaId)),
      Md.h2("Gates"),
      gatesTable(contract),
      Md.h2("Receipt types"),
      receiptTypesTable(contract),
      Md.h2("Recovery policy")
    ),
    recoveryBlocks(contract)
  );

/**
 * Projects a typed skill contract into a deterministic Markdown document AST.
 *
 * **Details**
 *
 * Schema encoding produces the frontmatter object inside the returned Result;
 * no synchronous throwing codec or manual encoded-shape projection is used.
 *
 * **Example** (Project a contract)
 *
 * ```ts
 * import { projectSkillDocument } from "@beep/skill-contract"
 *
 * console.log(typeof projectSkillDocument) // "function"
 * ```
 *
 * @param contract - Typed skill contract to project.
 * @returns A document AST or its schema encoding failure.
 * @category projections
 * @since 0.0.0
 */
export const projectSkillDocument = (contract: SkillContract): Result.Result<Document, S.SchemaError> => {
  const projection = SkillMarkdownProjection.make({
    contract,
    projection: "skill-contract/skill-md/v1",
  });

  return S.encodeUnknownResult(SkillMarkdownProjection)(projection).pipe(
    Result.map((frontmatter) => Md.make(projectionBlocks(contract), { frontmatter }))
  );
};

/**
 * Renders a typed skill contract through the current `@beep/md` renderer.
 *
 * **Details**
 *
 * Schema encoding failures and the renderer's {@link RenderError} remain in
 * the Result error channel without being unwrapped or translated.
 *
 * **Example** (Render a contract Result)
 *
 * ```ts
 * import { renderSkillMarkdown } from "@beep/skill-contract"
 *
 * console.log(typeof renderSkillMarkdown) // "function"
 * ```
 *
 * @param contract - Typed skill contract to render.
 * @returns Deterministic Markdown or an encoding/render failure.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillMarkdown = (contract: SkillContract): Result.Result<Markdown, S.SchemaError | RenderError> =>
  projectSkillDocument(contract).pipe(Result.flatMap(Md.render));

const frontmatterDenied = (
  reason: Extract<SkillArtifactDenialReason, "frontmatter-missing" | "frontmatter-decode-failed">,
  detail: string
): SkillArtifactDenied =>
  SkillArtifactDenied.make({
    checks: [
      SkillArtifactCheck.make({
        check: "frontmatter-contract-equality",
        detail,
        outcome: "failed",
      }),
    ],
    reasons: [reason],
  });

/**
 * Decodes only the leading JSON frontmatter block emitted by `@beep/md`.
 *
 * **Details**
 *
 * The decoder requires the exact `---json` leading delimiter and closing
 * delimiter emitted by the renderer. It JSON-decodes through
 * `@beep/schema` Unknown and then schema-decodes the projection. It does not
 * parse or reconstruct the Markdown body.
 *
 * **Example** (Reject missing frontmatter)
 *
 * ```ts
 * import { decodeSkillFrontmatter } from "@beep/skill-contract"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(decodeSkillFrontmatter("# no frontmatter"))) // true
 * ```
 *
 * @param markdown - Committed Markdown expected to begin with JSON frontmatter.
 * @returns The decoded projection or a denied verdict value.
 * @category decoding
 * @since 0.0.0
 */
export const decodeSkillFrontmatter = (
  markdown: string
): Result.Result<SkillMarkdownProjection, SkillArtifactDenied> => {
  if (!Str.startsWith(frontmatterOpen)(markdown)) {
    return Result.fail(
      frontmatterDenied("frontmatter-missing", "The committed artifact has no leading ---json block.")
    );
  }

  const afterOpen = Str.slice(Str.length(frontmatterOpen))(markdown);
  const closeIndex = Str.indexOf(frontmatterClose)(afterOpen);
  if (O.isNone(closeIndex)) {
    return Result.fail(
      frontmatterDenied("frontmatter-missing", "The committed artifact has no closing frontmatter delimiter.")
    );
  }

  const frontmatter = Str.slice(0, closeIndex.value)(afterOpen);
  return Unknown.decodeUnknownResultFromJsonString(frontmatter).pipe(
    Result.flatMap(S.decodeUnknownResult(SkillMarkdownProjection)),
    Result.mapError((error) =>
      frontmatterDenied("frontmatter-decode-failed", `The leading frontmatter failed schema decode: ${error.message}`)
    )
  );
};

const checkForRender = (
  rendered: Result.Result<Markdown, S.SchemaError | RenderError>,
  committed: string
): readonly [SkillArtifactCheck, O.Option<SkillArtifactDenialReason>] =>
  Result.match(rendered, {
    onFailure:
      /* istanbul ignore next -- schema-derived contracts project to valid nodes; retain fail-closed handling for adapter defects */
      (error) => [
        SkillArtifactCheck.make({
          check: "rerender-byte-equality",
          detail: `The contract projection could not be rendered: ${error.message}`,
          outcome: "failed",
        }),
        O.some("rerender-mismatch"),
      ],
    onSuccess: (markdown) =>
      Str.Equivalence(markdown, committed)
        ? [
            SkillArtifactCheck.make({
              check: "rerender-byte-equality",
              detail: "Rendered bytes equal the committed artifact.",
              outcome: "passed",
            }),
            O.none(),
          ]
        : [
            SkillArtifactCheck.make({
              check: "rerender-byte-equality",
              detail: "Rendered bytes differ from the committed artifact.",
              outcome: "failed",
            }),
            O.some("rerender-mismatch"),
          ],
  });

const checkForFrontmatter = (
  decoded: Result.Result<SkillMarkdownProjection, SkillArtifactDenied>,
  contract: SkillContract
): readonly [SkillArtifactCheck, O.Option<SkillArtifactDenialReason>] =>
  Result.match(decoded, {
    onFailure: (denied) => [A.headNonEmpty(denied.checks), O.some(A.headNonEmpty(denied.reasons))],
    onSuccess: (projection) =>
      contractEquivalence(projection.contract, contract)
        ? [
            SkillArtifactCheck.make({
              check: "frontmatter-contract-equality",
              detail: "Decoded frontmatter contract equals the projected contract.",
              outcome: "passed",
            }),
            O.none(),
          ]
        : [
            SkillArtifactCheck.make({
              check: "frontmatter-contract-equality",
              detail: "Decoded frontmatter contract differs from the projected contract.",
              outcome: "failed",
            }),
            O.some("contract-mismatch"),
          ],
  });

/**
 * Verifies deterministic bytes and decoded frontmatter contract equality.
 *
 * **Details**
 *
 * Both checks are evaluated before the verdict is assembled. Denials are
 * successful Effect values and retain an ordered audit row for each check plus
 * every applicable denial reason.
 *
 * **Example** (Build an artifact verification Effect)
 *
 * ```ts
 * import { verifySkillArtifact } from "@beep/skill-contract"
 *
 * console.log(typeof verifySkillArtifact) // "function"
 * ```
 *
 * @param input - Contract and committed artifact bytes to verify.
 * @returns An allowed or denied audit verdict value.
 * @category validation
 * @since 0.0.0
 */
export const verifySkillArtifact = Effect.fn("SkillProjection.verifySkillArtifact")(
  (input: VerifySkillArtifactInput): Effect.Effect<SkillArtifactVerdict> =>
    Effect.sync(() => {
      const renderCheck = checkForRender(renderSkillMarkdown(input.contract), input.committed);
      const frontmatterCheck = checkForFrontmatter(decodeSkillFrontmatter(input.committed), input.contract);
      const checks = A.make(renderCheck[0], frontmatterCheck[0]);
      const reasons = A.getSomes(A.make(renderCheck[1], frontmatterCheck[1]));

      return A.match(reasons, {
        onEmpty: () => SkillArtifactAllowed.make({ checks }),
        onNonEmpty: (nonEmptyReasons) => SkillArtifactDenied.make({ checks, reasons: nonEmptyReasons }),
      });
    })
);
