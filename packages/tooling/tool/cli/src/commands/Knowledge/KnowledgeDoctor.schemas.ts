/**
 * Versioned schemas for the Stage-2 knowledge doctor: classified spans, resolution witnesses,
 * evaluation outcomes, and the read-only report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { KnowledgeCommitSha, KnowledgeRefSurface } from "./Knowledge.refs.ts";
import { KnowledgeFinding, KnowledgeFindingCandidate, KnowledgeFindingLocation } from "./Knowledge.schemas.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.schemas");

/**
 * The class a reference-shaped span is assigned by the ordered classification rule table.
 *
 * **Details**
 *
 * `generated-example` marks the fence of a `beep:generated=<producer-id>` block, `historical-with-commit`
 * a span on an archival path under an ancestor historical citation, `verified` every span on a live
 * surface (always checked at the scanned tree), and `unclassified` everything else.
 *
 * **Example** (Recognize the live-surface class)
 *
 * ```ts
 * import { KnowledgeSpanClass } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeSpanClass.is.verified("verified")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeSpanClass = LiteralKit([
  "verified",
  "generated-example",
  "historical-with-commit",
  "unclassified",
]).pipe(
  $I.annoteSchema("KnowledgeSpanClass", {
    description: "Span class assigned by the total, ordered knowledge-doctor classification rule table.",
  })
);

/**
 * The class a reference-shaped span is assigned by the ordered classification rule table.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeSpanClass = typeof KnowledgeSpanClass.Type;

/**
 * The syntactic form a span was extracted from.
 *
 * **Details**
 *
 * `path` is an inline code span naming a governed repository path, `path-assertion` a
 * `<!-- beep:assert path-exists ... -->` marker, `command` an inline `bun run beep` span, and
 * `generated-fence` the opening delimiter of a fence whose info string carries `beep:generated=`.
 *
 * **Example** (Recognize a command span form)
 *
 * ```ts
 * import { KnowledgeSpanForm } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeSpanForm.is.command("command")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeSpanForm = LiteralKit(["path", "path-assertion", "command", "generated-fence"]).pipe(
  $I.annoteSchema("KnowledgeSpanForm", {
    description: "Syntactic form of one extracted knowledge reference span.",
  })
);

/**
 * The syntactic form a span was extracted from.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeSpanForm = typeof KnowledgeSpanForm.Type;

/**
 * Identifiers of the evaluators that check classified spans.
 *
 * **Example** (Recognize the paths evaluator)
 *
 * ```ts
 * import { KnowledgeEvaluatorId } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeEvaluatorId.is.paths("paths")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeEvaluatorId = LiteralKit(["paths", "commands"]).pipe(
  $I.annoteSchema("KnowledgeEvaluatorId", {
    description: "Identifier of one witness-bearing knowledge-doctor evaluator.",
  })
);

/**
 * Identifiers of the evaluators that check classified spans.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeEvaluatorId = typeof KnowledgeEvaluatorId.Type;

/**
 * Which gate owns a finding's blocking decision.
 *
 * **Details**
 *
 * `owned` findings belong to the knowledge doctor. `delegated` findings are already gated by a domain
 * command and appear in the report only as causal context; they are never baselined here.
 *
 * **Example** (Recognize an owned finding)
 *
 * ```ts
 * import { KnowledgeFindingOrigin } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeFindingOrigin.is.owned("owned")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeFindingOrigin = LiteralKit(["owned", "delegated"]).pipe(
  $I.annoteSchema("KnowledgeFindingOrigin", {
    description: "Whether the knowledge doctor or a domain command owns a finding's gate.",
  })
);

/**
 * Which gate owns a finding's blocking decision.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeFindingOrigin = typeof KnowledgeFindingOrigin.Type;

/**
 * The two spellings of a historical citation.
 *
 * **Details**
 *
 * `block` is `<!-- beep:historical commit=<40-hex> -->` on its own line, scoping the next Markdown
 * block. `document` is the frontmatter key `beep-historical: <40-hex>`, scoping the whole document.
 *
 * **Example** (Recognize a block citation)
 *
 * ```ts
 * import { KnowledgeHistoricalCitationForm } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeHistoricalCitationForm.is.block("block")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeHistoricalCitationForm = LiteralKit(["block", "document"]).pipe(
  $I.annoteSchema("KnowledgeHistoricalCitationForm", {
    description: "Block-comment or frontmatter spelling of a historical citation.",
  })
);

/**
 * The two spellings of a historical citation.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeHistoricalCitationForm = typeof KnowledgeHistoricalCitationForm.Type;

/**
 * One historical citation marker and the commit it cites.
 *
 * **Example** (Describe a block citation)
 *
 * ```ts
 * import { KnowledgeHistoricalCitation } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const citation = KnowledgeHistoricalCitation.make({
 *   form: "block",
 *   commit: "2162ebdc8a2162ebdc8a2162ebdc8a2162ebdc8a",
 *   line: 3,
 * })
 *
 * console.log(citation.form) // "block"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeHistoricalCitation extends S.Class<KnowledgeHistoricalCitation>($I`KnowledgeHistoricalCitation`)(
  {
    form: KnowledgeHistoricalCitationForm,
    commit: KnowledgeCommitSha,
    line: S.Natural,
  },
  $I.annote("KnowledgeHistoricalCitation", {
    description: "A historical citation marker, its cited commit, and the 1-based line it sits on.",
  })
) {}

/**
 * One reference-shaped span with the context the classification rule table reads.
 *
 * **Details**
 *
 * `raw` is the span exactly as written: the inline code content, the asserted path, or the producer
 * id of a generated fence. `generatedBy` is set only for a `generated-fence` span. `citation` is the
 * innermost historical citation covering the span (a block marker wins over the document marker),
 * whether or not it later proves valid.
 *
 * **Example** (Describe a live path span)
 *
 * ```ts
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeSpan } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const span = KnowledgeSpan.make({
 *   form: "path",
 *   documentPath: "docs/README.md",
 *   surface: "live",
 *   location: KnowledgeFindingLocation.make({ path: "docs/README.md", line: 1, column: 5 }),
 *   raw: "goals/INDEX.md",
 *   generatedBy: O.none(),
 *   citation: O.none(),
 * })
 *
 * console.log(span.surface) // "live"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSpan extends S.Class<KnowledgeSpan>($I`KnowledgeSpan`)(
  {
    form: KnowledgeSpanForm,
    documentPath: S.String,
    surface: KnowledgeRefSurface,
    location: KnowledgeFindingLocation,
    raw: S.String,
    generatedBy: S.OptionFromOptionalKey(S.String),
    citation: S.OptionFromOptionalKey(KnowledgeHistoricalCitation),
  },
  $I.annote("KnowledgeSpan", {
    description: "One extracted knowledge reference span plus its classification context.",
  })
) {}

/**
 * One registered producer and the derived repository path it writes.
 *
 * **Example** (Register the goals index projection)
 *
 * ```ts
 * import { KnowledgeProducerOutput } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const output = KnowledgeProducerOutput.make({ producerId: "producer://goals/index", targetPath: "goals/INDEX.md" })
 *
 * console.log(output.producerId) // "producer://goals/index"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeProducerOutput extends S.Class<KnowledgeProducerOutput>($I`KnowledgeProducerOutput`)(
  {
    producerId: S.String,
    targetPath: S.String,
  },
  $I.annote("KnowledgeProducerOutput", {
    description: "A registered producer id and the derived repository path it owns.",
  })
) {}

/**
 * Witness that a tracked tree entry, or a tracked directory, exists.
 *
 * **Details**
 *
 * `path` is the normalized repository path the span resolved to. When it names a directory, the
 * witness is the whole directory: hiding it hides every entry below it.
 *
 * **Example** (Witness a tracked file)
 *
 * ```ts
 * import { TreeEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(TreeEntryWitness.make({ path: "goals/INDEX.md" })._tag) // "TreeEntryWitness"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TreeEntryWitness extends S.TaggedClass<TreeEntryWitness>($I`TreeEntryWitness`)(
  "TreeEntryWitness",
  { path: S.String },
  $I.annote("TreeEntryWitness", {
    description: "A tracked tree entry or directory whose existence resolved a span.",
  })
) {}

/**
 * Witness that a command node, or one declared option on it, exists in the static command surface.
 *
 * **Details**
 *
 * `commandPath` is the canonical command path (aliases resolved); the empty path is the CLI root,
 * which is also where the Effect CLI built-in global flags live. `option` is the flag's canonical
 * name when the witness is an option rather than the command itself.
 *
 * **Example** (Witness a declared option)
 *
 * ```ts
 * import { CommandNodeWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const witness = CommandNodeWitness.make({ commandPath: ["knowledge", "refs"], option: "json" })
 *
 * console.log(witness.option) // "json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommandNodeWitness extends S.TaggedClass<CommandNodeWitness>($I`CommandNodeWitness`)(
  "CommandNodeWitness",
  { commandPath: S.Array(S.String), option: S.optionalKey(S.String) },
  $I.annote("CommandNodeWitness", {
    description: "A static command node, or one declared flag on it, that resolved a span.",
  })
) {}

/**
 * Witness that a registered producer owns an untracked derived path.
 *
 * **Example** (Witness the goals index projection)
 *
 * ```ts
 * import { ProducerWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const witness = ProducerWitness.make({ producerId: "producer://goals/index", targetPath: "goals/INDEX.md" })
 *
 * console.log(witness.targetPath) // "goals/INDEX.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProducerWitness extends S.TaggedClass<ProducerWitness>($I`ProducerWitness`)(
  "ProducerWitness",
  { producerId: S.String, targetPath: S.String },
  $I.annote("ProducerWitness", {
    description: "A registered producer whose derived output resolved a span naming an untracked path.",
  })
) {}

/**
 * Any resolution witness an evaluator may cite.
 *
 * **Example** (Discriminate a witness)
 *
 * ```ts
 * import { ResolutionWitness, TreeEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(ResolutionWitness.guards.TreeEntryWitness(TreeEntryWitness.make({ path: "docs" }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResolutionWitness = S.Union([TreeEntryWitness, CommandNodeWitness, ProducerWitness]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ResolutionWitness", {
    description: "A tree entry, command node, or producer output that proves one span resolved.",
  })
);

/**
 * Any resolution witness an evaluator may cite.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolutionWitness = typeof ResolutionWitness.Type;

/**
 * One failure an evaluator found in a span, with the identity of its cause.
 *
 * **Details**
 *
 * `causeKey` names the missing target (a path, command node, or option), so one deleted target cited
 * from many documents shares one cause.
 *
 * **Example** (Describe a missing-path failure)
 *
 * ```ts
 * import { KnowledgeFindingCandidate, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeEvaluationFailure } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const failure = KnowledgeEvaluationFailure.make({
 *   candidate: KnowledgeFindingCandidate.make({
 *     kind: "broken-tracked-path",
 *     documentId: "doc:docs/README.md",
 *     subject: "repo-path:docs/missing.md",
 *     location: KnowledgeFindingLocation.make({ path: "docs/README.md" }),
 *     message: "Tracked path does not exist: docs/missing.md.",
 *     remediation: "Update the inline path or add the tracked target.",
 *   }),
 *   causeKey: "path:docs/missing.md",
 * })
 *
 * console.log(failure.causeKey) // "path:docs/missing.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeEvaluationFailure extends S.Class<KnowledgeEvaluationFailure>($I`KnowledgeEvaluationFailure`)(
  {
    candidate: KnowledgeFindingCandidate,
    causeKey: S.String,
  },
  $I.annote("KnowledgeEvaluationFailure", {
    description: "A finding candidate plus the identity of the missing target that caused it.",
  })
) {}

/**
 * A span that resolved, carrying the non-empty witnesses that prove it.
 *
 * **Details**
 *
 * The witness array is schema-enforced non-empty, so witness-free success cannot be represented and
 * every pass is counterfactually testable. `unchecked` lists option tokens the evaluator could not
 * check because the resolved command's options are not statically derivable; they are reported,
 * never silently counted as passes.
 *
 * **Example** (Resolve a span through one tree entry)
 *
 * ```ts
 * import { EvaluationResolved, TreeEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const resolved = EvaluationResolved.make({
 *   witnesses: [TreeEntryWitness.make({ path: "goals/INDEX.md" })],
 *   unchecked: [],
 * })
 *
 * console.log(resolved.witnesses.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvaluationResolved extends S.TaggedClass<EvaluationResolved>($I`EvaluationResolved`)(
  "Resolved",
  {
    witnesses: S.NonEmptyArray(ResolutionWitness),
    unchecked: S.Array(S.String),
  },
  $I.annote("EvaluationResolved", {
    description: "A resolved span with its non-empty resolution witnesses and any unchecked option tokens.",
  })
) {}

/**
 * A span that failed, carrying one or more failures.
 *
 * **Example** (Check the failed tag)
 *
 * ```ts
 * import { KnowledgeFindingCandidate, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { EvaluationFailed, KnowledgeEvaluationFailure } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const failed = EvaluationFailed.make({
 *   failures: [
 *     KnowledgeEvaluationFailure.make({
 *       candidate: KnowledgeFindingCandidate.make({
 *         kind: "unknown-beep-command",
 *         documentId: "doc:AGENTS.md",
 *         subject: "beep-command:nope",
 *         location: KnowledgeFindingLocation.make({ path: "AGENTS.md" }),
 *         message: "Unknown beep command path: nope.",
 *         remediation: "Update the inline command.",
 *       }),
 *       causeKey: "command:nope",
 *     }),
 *   ],
 * })
 *
 * console.log(failed._tag) // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvaluationFailed extends S.TaggedClass<EvaluationFailed>($I`EvaluationFailed`)(
  "Failed",
  { failures: S.NonEmptyArray(KnowledgeEvaluationFailure) },
  $I.annote("EvaluationFailed", {
    description: "A span whose evaluation found one or more failures.",
  })
) {}

/**
 * The outcome of evaluating one span.
 *
 * **Example** (Discriminate an outcome)
 *
 * ```ts
 * import {
 *   EvaluationResolved,
 *   KnowledgeEvaluationOutcome,
 *   TreeEntryWitness,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const outcome = EvaluationResolved.make({ witnesses: [TreeEntryWitness.make({ path: "docs" })], unchecked: [] })
 *
 * console.log(KnowledgeEvaluationOutcome.guards.Resolved(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeEvaluationOutcome = S.Union([EvaluationResolved, EvaluationFailed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("KnowledgeEvaluationOutcome", {
    description: "Resolved-with-witnesses or failed outcome of one span evaluation.",
  })
);

/**
 * The outcome of evaluating one span.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeEvaluationOutcome = typeof KnowledgeEvaluationOutcome.Type;

/**
 * The spans and historical markers extracted from one document.
 *
 * **Example** (An empty extraction)
 *
 * ```ts
 * import { KnowledgeDocumentExtraction } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeDocumentExtraction.make({ markers: [], spans: [] }).spans.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDocumentExtraction extends S.Class<KnowledgeDocumentExtraction>($I`KnowledgeDocumentExtraction`)(
  {
    markers: S.Array(KnowledgeHistoricalCitation),
    spans: S.Array(KnowledgeSpan),
  },
  $I.annote("KnowledgeDocumentExtraction", {
    description: "Source-ordered spans plus every historical marker extracted from one document.",
  })
) {}

/**
 * How one witness behaved under its counterfactual overlay.
 *
 * **Details**
 *
 * `failed`: removing the witness made the span fail, the expected verdict. `rebound`: the span still
 * resolved through a different, independently held witness (for example an option alias shadowed by
 * a global flag). `vacuous`: the span still resolved citing the removed witness, or the witness did
 * not hold in the tree to begin with, so the evaluator's pass did not depend on the tree.
 *
 * **Example** (Recognize the expected verdict)
 *
 * ```ts
 * import { KnowledgeCounterfactualVerdictKind } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeCounterfactualVerdictKind.is.failed("failed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeCounterfactualVerdictKind = LiteralKit(["failed", "rebound", "vacuous"]).pipe(
  $I.annoteSchema("KnowledgeCounterfactualVerdictKind", {
    description: "Outcome of re-evaluating a resolved span with one of its witnesses removed.",
  })
);

/**
 * How one witness behaved under its counterfactual overlay.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeCounterfactualVerdictKind = typeof KnowledgeCounterfactualVerdictKind.Type;

/**
 * One counterfactual-harness row: the span, the removed witness, and the verdict.
 *
 * **Example** (Describe a load-bearing witness)
 *
 * ```ts
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import {
 *   KnowledgeCounterfactualVerdict,
 *   KnowledgeSpan,
 *   TreeEntryWitness,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const row = KnowledgeCounterfactualVerdict.make({
 *   evaluator: "paths",
 *   span: KnowledgeSpan.make({
 *     form: "path",
 *     documentPath: "AGENTS.md",
 *     surface: "live",
 *     location: KnowledgeFindingLocation.make({ path: "AGENTS.md" }),
 *     raw: "goals",
 *     generatedBy: O.none(),
 *     citation: O.none(),
 *   }),
 *   witness: TreeEntryWitness.make({ path: "goals" }),
 *   verdict: "failed",
 * })
 *
 * console.log(row.verdict) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCounterfactualVerdict extends S.Class<KnowledgeCounterfactualVerdict>(
  $I`KnowledgeCounterfactualVerdict`
)(
  {
    evaluator: KnowledgeEvaluatorId,
    span: KnowledgeSpan,
    witness: ResolutionWitness,
    verdict: KnowledgeCounterfactualVerdictKind,
  },
  $I.annote("KnowledgeCounterfactualVerdict", {
    description: "A resolved span, one of its witnesses, and how the span behaved with that witness removed.",
  })
) {}

/**
 * One knowledge-doctor finding: a v1 finding plus its span class, origin, evaluator, and cause.
 *
 * **Details**
 *
 * `evaluator` is absent for findings the classification stage emits itself, such as a historical
 * marker on a live surface.
 *
 * **Example** (Read the span class of a doctor finding)
 *
 * ```ts
 * import { KnowledgeFinding, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeDoctorFinding } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const finding = KnowledgeDoctorFinding.make({
 *   finding: KnowledgeFinding.make({
 *     findingId: "knowledge-finding/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     kind: "broken-tracked-path",
 *     severity: "blocking",
 *     documentId: "doc:docs/README.md",
 *     subject: "repo-path:docs/missing.md",
 *     occurrence: 0,
 *     location: KnowledgeFindingLocation.make({ path: "docs/README.md" }),
 *     message: "Tracked path does not exist: docs/missing.md.",
 *     remediation: "Update the inline path or add the tracked target.",
 *   }),
 *   spanClass: "verified",
 *   origin: "owned",
 *   evaluator: O.some("paths"),
 *   causeKey: "path:docs/missing.md",
 * })
 *
 * console.log(finding.spanClass) // "verified"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorFinding extends S.Class<KnowledgeDoctorFinding>($I`KnowledgeDoctorFinding`)(
  {
    finding: KnowledgeFinding,
    spanClass: KnowledgeSpanClass,
    origin: KnowledgeFindingOrigin,
    evaluator: S.OptionFromOptionalKey(KnowledgeEvaluatorId),
    causeKey: S.String,
  },
  $I.annote("KnowledgeDoctorFinding", {
    description: "A normalized finding with its span class, gate owner, evaluator, and cause identity.",
  })
) {}

/**
 * Per-class span totals for one scanned tree.
 *
 * **Example** (Count no spans)
 *
 * ```ts
 * import { KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const counts = KnowledgeSpanCounts.make({
 *   verified: 0,
 *   "generated-example": 0,
 *   "historical-with-commit": 0,
 *   unclassified: 0,
 * })
 *
 * console.log(counts.verified) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSpanCounts extends S.Class<KnowledgeSpanCounts>($I`KnowledgeSpanCounts`)(
  {
    verified: S.Natural,
    "generated-example": S.Natural,
    "historical-with-commit": S.Natural,
    unclassified: S.Natural,
  },
  $I.annote("KnowledgeSpanCounts", {
    description: "Number of extracted spans in each span class.",
  })
) {}

/**
 * The read-only `knowledge doctor --report` document.
 *
 * **Details**
 *
 * Findings are sorted by `findingId`, so two runs over one tree encode to identical bytes.
 * `uncheckedOptionCount` totals option tokens on resolved commands whose declared options are not
 * statically derivable; a non-zero count is lost coverage, never a pass.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import { KnowledgeDoctorReport, KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const report = KnowledgeDoctorReport.make({
 *   treeish: "HEAD",
 *   tree: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   mode: "report",
 *   spanCounts: KnowledgeSpanCounts.make({
 *     verified: 0,
 *     "generated-example": 0,
 *     "historical-with-commit": 0,
 *     unclassified: 0,
 *   }),
 *   uncheckedOptionCount: 0,
 *   findings: [],
 * })
 *
 * console.log(report.schemaVersion) // "knowledge-doctor/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorReport extends S.Class<KnowledgeDoctorReport>($I`KnowledgeDoctorReport`)(
  {
    schemaVersion: S.tag("knowledge-doctor/v1"),
    treeish: S.String,
    tree: KnowledgeCommitSha,
    mode: S.Literal("report"),
    spanCounts: KnowledgeSpanCounts,
    uncheckedOptionCount: S.Natural,
    findings: S.Array(KnowledgeDoctorFinding),
  },
  $I.annote("KnowledgeDoctorReport", {
    description: "Read-only knowledge-doctor report: span-class totals and every classified finding.",
  })
) {}

/**
 * Encodes a knowledge-doctor report as one canonical JSON line.
 *
 * **Example** (Encode an empty report)
 *
 * ```ts
 * import {
 *   encodeKnowledgeDoctorReportJson,
 *   KnowledgeDoctorReport,
 *   KnowledgeSpanCounts,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const report = KnowledgeDoctorReport.make({
 *   treeish: "HEAD",
 *   tree: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   mode: "report",
 *   spanCounts: KnowledgeSpanCounts.make({
 *     verified: 0,
 *     "generated-example": 0,
 *     "historical-with-commit": 0,
 *     unclassified: 0,
 *   }),
 *   uncheckedOptionCount: 0,
 *   findings: [],
 * })
 *
 * console.log(Effect.isEffect(encodeKnowledgeDoctorReportJson(report))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeKnowledgeDoctorReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<string, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(S.fromJsonString(KnowledgeDoctorReport)));

/**
 * Decodes a knowledge-doctor report from its JSON line.
 *
 * **Example** (Decode is effectful)
 *
 * ```ts
 * import { decodeKnowledgeDoctorReportJson } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeKnowledgeDoctorReportJson("{}"))) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeKnowledgeDoctorReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<KnowledgeDoctorReport, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<KnowledgeDoctorReport, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(KnowledgeDoctorReport)));
