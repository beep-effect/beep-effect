/**
 * Schema-first port of OntoSkills extraction and compiler models: requirements,
 * execution payloads, knowledge nodes, SKILL.md frontmatter, and Phase 1
 * content blocks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonEmptyTrimmedStr, NonNegativeInt } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Sha256 } from "@beep/shared-domain/entity/primitives";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as R from "@beep/utils/Record";
import * as Str from "@beep/utils/Str";
import { Duration, Effect, SchemaTransformation, Tuple } from "effect";
import { flow, identity } from "effect/Function";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("ontoskills/OntoSkills.models");
const zero = NonNegativeInt.make(0);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATE_URI_PATTERN = /^oc:[A-Z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+)?$/;
const FRONTMATTER_TAG_PATTERN = /<[a-zA-Z][^>]*>/;

const RequirementTypeBase = LiteralKit(["EnvVar", "Tool", "Hardware", "API", "Knowledge"]);

/**
 * Requirement categories accepted by an OntoSkills skill.
 *
 * **Example** (Guard a tool requirement)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RequirementType } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(RequirementType)(RequirementType.Enum.Tool)) // true
 * console.log(S.is(RequirementType)("Plugin")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RequirementType = RequirementTypeBase.pipe(
  $I.annoteSchema("RequirementType", { description: "Finite categories used to state a skill prerequisite." }),
  SchemaUtils.withLiteralKitStatics(RequirementTypeBase)
);

/**
 * Decoded value produced by {@link RequirementType}.
 *
 * @see {@link RequirementType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type RequirementType = typeof RequirementType.Type;

/**
 * One prerequisite declared by a skill.
 *
 * **Details**
 *
 * Missing `optional` values decode to `false`.
 *
 * **Example** (Optional environment variable)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Requirement } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const requirement = S.decodeSync(Requirement)({
 *   type: "EnvVar",
 *   value: "API_KEY",
 *   optional: true,
 * })
 * console.log(requirement.optional) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Requirement extends S.Class<Requirement>($I`Requirement`)(
  {
    type: RequirementType,
    value: NonEmptyTrimmedStr,
    optional: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("Requirement", {
    description: "A typed prerequisite and its optionality for skill execution.",
  })
) {}

const ExecutionPayloadExecutorBase = LiteralKit(["shell", "python", "node", "claude_tool"]);

/**
 * Supported execution engines for executable skills.
 *
 * **Example** (Guard a Python executor)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExecutionPayloadExecutor } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(ExecutionPayloadExecutor)(ExecutionPayloadExecutor.Enum.python)) // true
 * console.log(S.is(ExecutionPayloadExecutor)("ruby")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExecutionPayloadExecutor = ExecutionPayloadExecutorBase.pipe(
  $I.annoteSchema("ExecutionPayloadExecutor", {
    description: "Finite executor domain for an OntoSkills execution payload.",
  }),
  SchemaUtils.withLiteralKitStatics(ExecutionPayloadExecutorBase)
);

/**
 * Decoded value produced by {@link ExecutionPayloadExecutor}.
 *
 * @see {@link ExecutionPayloadExecutor} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionPayloadExecutor = typeof ExecutionPayloadExecutor.Type;

/**
 * Integer seconds transformed into an Effect Duration.
 *
 * **Details**
 *
 * OntoSkills serializes timeout numbers as seconds, not milliseconds.
 *
 * **Example** (Thirty-second timeout)
 *
 * ```ts
 * import * as Duration from "effect/Duration"
 * import * as S from "effect/Schema"
 * import { DurationFromSeconds } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const timeout = S.decodeSync(DurationFromSeconds)(30)
 * console.log(Duration.toSeconds(timeout)) // 30
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const DurationFromSeconds = NonNegativeInt.pipe(
  S.decodeTo(
    S.Duration,
    SchemaTransformation.transform<Duration.Duration, NonNegativeInt>({
      decode: Duration.seconds,
      encode: flow(Duration.toSeconds, NonNegativeInt.make),
    })
  ),
  $I.annoteSchema("DurationFromSeconds", {
    description: "A non-negative integral timeout encoded in seconds and decoded as an Effect Duration.",
  })
);

/**
 * Decoded value produced by {@link DurationFromSeconds}.
 *
 * @see {@link DurationFromSeconds} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type DurationFromSeconds = typeof DurationFromSeconds.Type;

/**
 * Executable source and its owning runtime.
 *
 * **Example** (Shell payload)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ExecutionPayload } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const payload = S.decodeSync(ExecutionPayload)({
 *   executor: "shell",
 *   code: "pwd",
 * })
 * console.log(payload.executor) // "shell"
 * console.log(O.isNone(payload.timeout)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionPayload extends S.Class<ExecutionPayload>($I`ExecutionPayload`)(
  {
    executor: ExecutionPayloadExecutor,
    code: NonEmptyTrimmedStr,
    timeout: S.OptionFromNullOr(DurationFromSeconds).pipe(SchemaUtils.withKeyDefaults(O.none())),
  },
  $I.annote("ExecutionPayload", {
    description: "Executable skill source, runtime selection, and optional timeout in seconds.",
  })
) {}

/**
 * Branded OntoSkills state URI.
 *
 * **Details**
 *
 * The grammar is `oc:StateName` with an optional alphanumeric, underscore, or hyphen suffix.
 *
 * **Example** (Parameterized state)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StateUri } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(StateUri)("oc:Authenticated:admin")) // true
 * console.log(S.is(StateUri)("ready")) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const StateUri = S.String.check(
  S.isPattern(STATE_URI_PATTERN, {
    identifier: $I`StateUriPatternCheck`,
    title: "OntoSkills state URI",
    description: "Checks the compact oc: state identifier grammar used by state transitions.",
    message: "Expected oc:StateName or oc:StateName:suffix",
  })
).pipe(
  S.brand("StateUri"),
  $I.annoteSchema("StateUri", {
    description: "A compact OntoSkills state identifier used by execution preconditions and outcomes.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded value produced by {@link StateUri}.
 *
 * @see {@link StateUri} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type StateUri = typeof StateUri.Type;

/**
 * State preconditions, outcomes, and handled failures for a skill.
 *
 * **Example** (Authentication transition)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StateTransition } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const transition = S.decodeSync(StateTransition)({
 *   requiresState: ["oc:SystemAuthenticated"],
 *   yieldsState: ["oc:DocumentCreated"],
 * })
 * console.log(transition.requiresState) // ["oc:SystemAuthenticated"]
 * console.log(transition.handlesFailure) // []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StateTransition extends S.Class<StateTransition>($I`StateTransition`)(
  {
    requiresState: S.Array(StateUri).pipe(SchemaUtils.withEmptyArrayDefaults<StateUri>()),
    yieldsState: S.Array(StateUri).pipe(SchemaUtils.withEmptyArrayDefaults<StateUri>()),
    handlesFailure: S.Array(StateUri).pipe(SchemaUtils.withEmptyArrayDefaults<StateUri>()),
  },
  $I.annote("StateTransition", {
    description: "Execution-state edges that a skill requires, yields, or explicitly handles.",
  })
) {}

const StateTransitionWire = StateTransition.pipe(
  S.encodeKeys({
    requiresState: "requires_state",
    yieldsState: "yields_state",
    handlesFailure: "handles_failure",
  }),
  $I.annoteSchema("StateTransitionWire", {
    description: "Python-compatible snake_case wire object for a state transition.",
  })
);

/**
 * Ingress codec accepting a state-transition object or its JSON string.
 *
 * **Example** (JSON ingress)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StateTransitionFromWire } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const transition = S.decodeSync(StateTransitionFromWire)(
 *   '{"requires_state":["oc:Ready"]}'
 * )
 * console.log(transition.requiresState) // ["oc:Ready"]
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const StateTransitionFromWire = S.Union([
  StateTransitionWire,
  S.fromJsonString(StateTransitionWire),
]).pipe(
  $I.annoteSchema("StateTransitionFromWire", {
    description: "Boundary codec for structured or JSON-string OntoSkills state transitions.",
  })
);

/**
 * Decoded value produced by {@link StateTransitionFromWire}.
 *
 * @see {@link StateTransitionFromWire} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type StateTransitionFromWire = typeof StateTransitionFromWire.Type;

const ExecutionPayloadWire = ExecutionPayload.pipe(
  $I.annoteSchema("ExecutionPayloadWire", {
    description: "Structured wire object for an OntoSkills execution payload.",
  })
);

/**
 * Ingress codec accepting an execution-payload object or its JSON string.
 *
 * **Example** (JSON ingress)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExecutionPayloadFromWire } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const payload = S.decodeSync(ExecutionPayloadFromWire)(
 *   '{"executor":"shell","code":"pwd","timeout":30}'
 * )
 * console.log(payload.executor) // "shell"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const ExecutionPayloadFromWire = S.Union([
  ExecutionPayloadWire,
  S.fromJsonString(ExecutionPayloadWire),
]).pipe(
  $I.annoteSchema("ExecutionPayloadFromWire", {
    description: "Boundary codec for structured or JSON-string OntoSkills execution payloads.",
  })
);

/**
 * Decoded value produced by {@link ExecutionPayloadFromWire}.
 *
 * @see {@link ExecutionPayloadFromWire} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionPayloadFromWire = typeof ExecutionPayloadFromWire.Type;

const SeverityLevelBase = LiteralKit(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

/**
 * Optional severity metadata attached to knowledge nodes.
 *
 * **Example** (Guard critical guidance)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SeverityLevel } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(SeverityLevel)(SeverityLevel.Enum.CRITICAL)) // true
 * console.log(S.is(SeverityLevel)("INFO")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SeverityLevel = SeverityLevelBase.pipe(
  $I.annoteSchema("SeverityLevel", {
    description: "Impact ranking for optional knowledge-node severity metadata.",
  }),
  SchemaUtils.withLiteralKitStatics(SeverityLevelBase)
);

/**
 * Decoded value produced by {@link SeverityLevel}.
 *
 * @see {@link SeverityLevel} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SeverityLevel = typeof SeverityLevel.Type;

const KnowledgeNodeTypeBase = LiteralKit([
  // Dimension 1: NormativeRule
  "Standard", "AntiPattern", "Constraint",
  // Dimension 2: StrategicInsight
  "Heuristic", "DesignPrinciple", "WorkflowStrategy",
  // Dimension 3: ResilienceTactic
  "KnownIssue", "RecoveryTactic",
  // Dimension 4: ExecutionPhysics
  "Idempotency", "SideEffect", "PerformanceProfile",
  // Dimension 5: Observability
  "SuccessIndicator", "TelemetryPattern",
  // Dimension 6: SecurityGuardrail
  "SecurityImplication", "DestructivePotential", "FallbackStrategy",
  // Dimension 7: CognitiveBoundary
  "RequiresHumanClarification", "AssumptionBoundary", "AmbiguityTolerance",
  // Dimension 8: ResourceProfile
  "TokenEconomy", "ComputeCost",
  // Dimension 9: TrustMetric
  "ExecutionDeterminism", "DataProvenance",
  // Dimension 10: LifecycleHook
  "PreFlightCheck", "PostFlightValidation", "RollbackProcedure",
  // Dimension 11: OperationalKnowledge
  "Procedure", "CodePattern", "OutputFormat", "Command", "Prerequisite",
]);

/**
 * Thirty-one epistemic and operational knowledge-node kinds.
 *
 * **Example** (Guard an operational procedure)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { KnowledgeNodeType } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(KnowledgeNodeType)(KnowledgeNodeType.Enum.Procedure)) // true
 * console.log(S.is(KnowledgeNodeType)("Note")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeNodeType = KnowledgeNodeTypeBase.pipe(
  $I.annoteSchema("KnowledgeNodeType", {
    description: "Taxonomy of epistemic and operational facts extracted from a skill.",
  }),
  SchemaUtils.withLiteralKitStatics(KnowledgeNodeTypeBase)
);

/**
 * Decoded value produced by {@link KnowledgeNodeType}.
 *
 * @see {@link KnowledgeNodeType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeNodeType = typeof KnowledgeNodeType.Type;

/**
 * One strict epistemic or operational fact extracted from a skill.
 *
 * **Details**
 *
 * `nodeType` and `directiveContent` are non-empty. Optional Python fields accept both null and omission.
 *
 * **Example** (Directive node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { KnowledgeNode } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const node = S.decodeSync(KnowledgeNode)({
 *   nodeType: "Standard",
 *   directiveContent: "Validate input.",
 * })
 * console.log(node.nodeType) // "Standard"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeNode extends S.Class<KnowledgeNode>($I`KnowledgeNode`)(
  {
    nodeType: KnowledgeNodeType,
    directiveContent: NonEmptyTrimmedStr,
    appliesToContext: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    hasRationale: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    severityLevel: S.OptionFromNullOr(SeverityLevel).pipe(SchemaUtils.withKeyDefaults(O.none())),
    codeLanguage: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    stepOrder: S.OptionFromNullOr(PosInt).pipe(SchemaUtils.withKeyDefaults(O.none())),
    templateVariables: S.String.pipe(S.Array, S.OptionFromNullOr, SchemaUtils.withKeyDefaults(O.none())),
  },
  $I.annote("KnowledgeNode", {
    description: "A validated unit of skill knowledge with optional context, rationale, severity, and operational metadata.",
  })
) {}

const KnowledgeNodeWire = KnowledgeNode.pipe(
  S.encodeKeys({
    nodeType: "node_type",
    directiveContent: "directive_content",
    appliesToContext: "applies_to_context",
    hasRationale: "has_rationale",
    severityLevel: "severity_level",
    codeLanguage: "code_language",
    stepOrder: "step_order",
    templateVariables: "template_variables",
  }),
  $I.annoteSchema("KnowledgeNodeWire", {
    description: "Python-compatible snake_case wire object for one strict knowledge node.",
  })
);

const KnowledgeNodeFromLLM = S.Union([
  KnowledgeNodeWire,
  KnowledgeNode,
  S.fromJsonString(KnowledgeNodeWire),
]).pipe(
  $I.annoteSchema("KnowledgeNodeFromLLMElement", {
    description: "Constructed, structured, or JSON-string boundary representation of one strict knowledge node.",
  })
);

const decodeKnowledgeNodeResult = S.decodeUnknownResult(KnowledgeNodeFromLLM);
const KnowledgeNodeList = S.Array(KnowledgeNode).pipe(
  S.toType,
  $I.annoteSchema("KnowledgeNodeList", {
    description: "Decoded strict knowledge nodes retained by the lenient LLM ingress policy.",
  })
);

/**
 * LLM ingress codec that drops invalid knowledge-node elements.
 *
 * **Gotchas**
 *
 * This codec has no logging side effect. The owning service boundary should compare inputs with retained nodes and emit
 * warnings with request context.
 *
 * **Example** (Partial extraction)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { KnowledgeNodesFromLLM } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const nodes = S.decodeSync(KnowledgeNodesFromLLM)([
 *   { node_type: "Standard", directive_content: "Validate input." },
 *   "{not-json",
 * ])
 * console.log(nodes.length) // 1
 * console.log(nodes[0]?.nodeType) // "Standard"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const KnowledgeNodesFromLLM = S.Array(S.Unknown).pipe(
  S.decodeTo(
    KnowledgeNodeList,
    SchemaTransformation.transform<ReadonlyArray<KnowledgeNode>, ReadonlyArray<unknown>>({
      decode: A.filterMap((input: unknown) => decodeKnowledgeNodeResult(input)),
      encode: identity,
    })
  ),
  $I.annoteSchema("KnowledgeNodesFromLLM", {
    description: "Element-wise tolerant ingress codec that retains only strict OntoSkills knowledge nodes.",
  })
);

/**
 * Decoded value produced by {@link KnowledgeNodesFromLLM}.
 *
 * @see {@link KnowledgeNodesFromLLM} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeNodesFromLLM = typeof KnowledgeNodesFromLLM.Type;

/**
 * LLM annotation for a pre-extracted code block.
 *
 * **Example** (First code block)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CodeAnnotation } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const annotation = S.decodeSync(CodeAnnotation)({
 *   index: 0,
 *   purpose: "Setup",
 *   context: "Before execution",
 * })
 * console.log(annotation.purpose) // "Setup"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeAnnotation extends S.Class<CodeAnnotation>($I`CodeAnnotation`)(
  { index: NonNegativeInt, purpose: NonEmptyTrimmedStr, context: NonEmptyTrimmedStr },
  $I.annote("CodeAnnotation", {
    description: "Semantic purpose and surrounding context assigned to an extracted code block.",
  })
) {}

/**
 * LLM annotation for a pre-extracted markdown table.
 *
 * **Example** (Table purpose)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TableAnnotation } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const annotation = S.decodeSync(TableAnnotation)({
 *   index: 0,
 *   purpose: "Compatibility matrix",
 * })
 * console.log(annotation.purpose) // "Compatibility matrix"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TableAnnotation extends S.Class<TableAnnotation>($I`TableAnnotation`)(
  { index: NonNegativeInt, purpose: NonEmptyTrimmedStr },
  $I.annote("TableAnnotation", {
    description: "Semantic purpose assigned to an extracted markdown table.",
  })
) {}

/**
 * LLM annotation for a pre-extracted flowchart.
 *
 * **Example** (Flow description)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlowchartAnnotation } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const annotation = S.decodeSync(FlowchartAnnotation)({
 *   index: 0,
 *   description: "Retry lifecycle",
 * })
 * console.log(annotation.description) // "Retry lifecycle"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlowchartAnnotation extends S.Class<FlowchartAnnotation>($I`FlowchartAnnotation`)(
  { index: NonNegativeInt, description: NonEmptyTrimmedStr },
  $I.annote("FlowchartAnnotation", {
    description: "Natural-language interpretation assigned to an extracted flowchart.",
  })
) {}

const TemplateAnnotationTypeBase = LiteralKit(["prompt", "output", "boilerplate"]);

/**
 * Roles an extracted template may serve.
 *
 * **Example** (Guard a prompt template)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TemplateAnnotationType } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(TemplateAnnotationType)(TemplateAnnotationType.Enum.prompt)) // true
 * console.log(S.is(TemplateAnnotationType)("system")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TemplateAnnotationType = TemplateAnnotationTypeBase.pipe(
  $I.annoteSchema("TemplateAnnotationType", {
    description: "Finite semantic roles assigned to extracted templates.",
  }),
  SchemaUtils.withLiteralKitStatics(TemplateAnnotationTypeBase)
);

/**
 * Decoded value produced by {@link TemplateAnnotationType}.
 *
 * @see {@link TemplateAnnotationType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TemplateAnnotationType = typeof TemplateAnnotationType.Type;

/**
 * LLM classification for a pre-extracted template.
 *
 * **Example** (Output template)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TemplateAnnotation } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const annotation = S.decodeSync(TemplateAnnotation)({
 *   index: 0,
 *   templateType: "output",
 * })
 * console.log(annotation.templateType) // "output"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TemplateAnnotation extends S.Class<TemplateAnnotation>($I`TemplateAnnotation`)(
  { index: NonNegativeInt, templateType: TemplateAnnotationType },
  $I.annote("TemplateAnnotation", {
    description: "Semantic role assigned to an indexed template extracted during Phase 1.",
  })
) {}

const ReferenceFilePurposeBase = LiteralKit(["api-reference", "examples", "guide", "domain-specific", "other"]);

/**
 * Progressive-disclosure roles for reference files.
 *
 * **Example** (Guard a guide purpose)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReferenceFilePurpose } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(ReferenceFilePurpose)(ReferenceFilePurpose.Enum.guide)) // true
 * console.log(S.is(ReferenceFilePurpose)("readme")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReferenceFilePurpose = ReferenceFilePurposeBase.pipe(
  $I.annoteSchema("ReferenceFilePurpose", {
    description: "Finite purpose domain used to route progressive-disclosure reference files.",
  }),
  SchemaUtils.withLiteralKitStatics(ReferenceFilePurposeBase)
);

/**
 * Decoded value produced by {@link ReferenceFilePurpose}.
 *
 * @see {@link ReferenceFilePurpose} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ReferenceFilePurpose = typeof ReferenceFilePurpose.Type;

/**
 * Reference file selected for progressive disclosure.
 *
 * **Example** (Guide reference)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReferenceFile } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const reference = S.decodeSync(ReferenceFile)({
 *   relativePath: "references/guide.md",
 *   purpose: "guide",
 * })
 * console.log(reference.purpose) // "guide"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReferenceFile extends S.Class<ReferenceFile>($I`ReferenceFile`)(
  { relativePath: NonEmptyTrimmedStr, purpose: ReferenceFilePurpose },
  $I.annote("ReferenceFile", {
    description: "A skill-relative reference selected for deferred, purpose-aware loading.",
  })
) {}

/**
 * Input/output example used for pattern matching.
 *
 * **Example** (Named example)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Example } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const sample = S.decodeSync(Example)({
 *   name: "CSV",
 *   inputDescription: "Rows",
 *   outputExample: "a,b",
 * })
 * console.log(sample.outputExample) // "a,b"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Example extends S.Class<Example>($I`Example`)(
  {
    name: NonEmptyTrimmedStr,
    inputDescription: NonEmptyTrimmedStr,
    outputExample: NonEmptyTrimmedStr,
    tags: S.Array(NonEmptyTrimmedStr).pipe(SchemaUtils.withEmptyArrayDefaults<NonEmptyTrimmedStr>()),
  },
  $I.annote("Example", {
    description: "A named input/output pair that demonstrates a reusable skill pattern.",
  })
) {}

/**
 * One dependency-aware step in a workflow.
 *
 * **Example** (First workflow step)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WorkflowStep } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const step = S.decodeSync(WorkflowStep)({
 *   stepId: "prepare",
 *   description: "Prepare input",
 * })
 * console.log(step.stepId) // "prepare"
 * console.log(step.dependsOn) // []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkflowStep extends S.Class<WorkflowStep>($I`WorkflowStep`)(
  {
    stepId: NonEmptyTrimmedStr,
    description: NonEmptyTrimmedStr,
    expectedOutcome: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    dependsOn: S.Array(NonEmptyTrimmedStr).pipe(SchemaUtils.withEmptyArrayDefaults<NonEmptyTrimmedStr>()),
  },
  $I.annote("WorkflowStep", {
    description: "A workflow action with an optional expected outcome and predecessor step identifiers.",
  })
) {}

/**
 * Ordered workflow extracted from a skill.
 *
 * **Example** (Single-step workflow)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Workflow } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const workflow = S.decodeSync(Workflow)({
 *   workflowId: "build",
 *   name: "Build",
 *   description: "Build output",
 *   steps: [{ stepId: "prepare", description: "Prepare input" }],
 * })
 * console.log(workflow.steps.length) // 1
 * console.log(workflow.steps[0]?.stepId) // "prepare"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Workflow extends S.Class<Workflow>($I`Workflow`)(
  {
    workflowId: NonEmptyTrimmedStr,
    name: NonEmptyTrimmedStr,
    description: NonEmptyTrimmedStr,
    steps: S.Array(WorkflowStep),
  },
  $I.annote("Workflow", {
    description: "A named sequence of dependency-aware steps extracted during Phase 2.",
  })
) {}

/**
 * Canonical slug used as a bare skill identifier.
 *
 * **Example** (Skill slug)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SkillId } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(SkillId)("docx-review")) // true
 * console.log(S.is(SkillId)("Docx Review")) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SkillId = NonEmptyTrimmedStr.check(
  S.isPattern(SLUG_PATTERN, {
    identifier: $I`SkillIdPatternCheck`,
    title: "OntoSkills skill identifier",
    description: "Checks the lowercase alphanumeric and hyphen grammar used by bare skill identifiers.",
    message: "Expected a lowercase kebab-case skill identifier",
  })
).pipe(
  S.brand("SkillId"),
  $I.annoteSchema("SkillId", {
    description: "Canonical bare identifier used to address one OntoSkills skill.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded value produced by {@link SkillId}.
 *
 * @see {@link SkillId} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SkillId = typeof SkillId.Type;

const isRelationUri = (value: string): boolean =>
  Str.startsWith("http://")(value) || Str.startsWith("https://")(value) || Str.startsWith("oc:")(value);

const RelationPart = S.String.check(
  S.isPattern(SLUG_PATTERN, {
    identifier: $I`RelationPartPatternCheck`,
    title: "Relation path segment",
    description: "Checks one canonical lowercase kebab-case segment in a qualified skill relation.",
    message: "Expected a lowercase kebab-case relation segment",
  })
).pipe(
  $I.annoteSchema("RelationPart", {
    description: "One validated segment in a slash-qualified skill relation.",
  }),
  SchemaUtils.withCodecStatics
);

const RelationInput = S.String.check(
  S.makeFilter(
    (raw: string) => {
      const value = Str.trim(raw);
      return isRelationUri(value) || A.every(RelationPart.is)(Str.split("/")(value));
    },
    {
      identifier: $I`RelationInputCheck`,
      title: "OntoSkills relation reference",
      description: "Accepts a URI or a slash-qualified sequence of canonical skill-id segments.",
      message: "Expected a URI or lowercase kebab-case relation path",
    }
  )
).pipe(
  $I.annoteSchema("RelationInput", {
    description: "Raw relation reference accepted from OntoSkills extraction output.",
  })
);

const RelationValue = S.String.check(
  S.makeFilter((value: string) => isRelationUri(value) || RelationPart.is(value), {
    identifier: $I`RelationValueCheck`,
    title: "Normalized relation identifier",
    description: "Accepts a pass-through URI or the final canonical segment of a qualified relation path.",
    message: "Expected a URI or canonical relation identifier",
  })
).pipe(
  S.brand("RelationId"),
  $I.annoteSchema("RelationValue", {
    description: "Normalized URI or bare skill identifier stored on a decoded relation.",
  })
);

/**
 * Relation reference normalized to a URI or final bare skill-id segment.
 *
 * **Details**
 *
 * HTTP, HTTPS, and `oc:` URIs pass through after trimming.
 *
 * **Example** (Qualified relation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RelationId } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const relation = S.decodeSync(RelationId)("author/package/office")
 * console.log(relation) // "office"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const RelationId = RelationInput.pipe(
  S.decodeTo(
    RelationValue,
    SchemaTransformation.transform({
      decode: (raw) => {
        const value = Str.trim(raw);
        return isRelationUri(value) ? value : A.lastNonEmpty(Str.split("/")(value));
      },
      encode: identity,
    })
  ),
  $I.annoteSchema("RelationId", {
    description: "Normalized OntoSkills relation target used by dependency and conflict edges.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded value produced by {@link RelationId}.
 *
 * @see {@link RelationId} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type RelationId = typeof RelationId.Type;

const BooleanFromOntoSkillsString = S.String.pipe(
  S.decodeTo(
    S.Boolean,
    SchemaTransformation.transform<boolean, string>({
      decode: flow(Str.toLowerCase, (value) => value === "true" || value === "yes" || value === "1"),
      encode: (value): string => (value ? "true" : "false"),
    })
  ),
  $I.annoteSchema("BooleanFromOntoSkillsString", {
    description: "Python-compatible string coercion used by is_user_invocable input.",
  })
);

/**
 * Boolean-or-string codec matching OntoSkills invocation coercion.
 *
 * **Example** (Truthy string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { IsUserInvocable } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.decodeSync(IsUserInvocable)("yes")) // true
 * console.log(S.decodeSync(IsUserInvocable)("no")) // false
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const IsUserInvocable = S.Union([S.Boolean, BooleanFromOntoSkillsString]).pipe(
  $I.annoteSchema("IsUserInvocable", {
    description: "Boolean invocation flag accepting the exact OntoSkills boolean-string coercion domain.",
  })
);

/**
 * Decoded value produced by {@link IsUserInvocable}.
 *
 * @see {@link IsUserInvocable} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type IsUserInvocable = typeof IsUserInvocable.Type;

const SkillTypeBase = LiteralKit(["executable", "declarative"]);

/**
 * Derived execution character of a skill.
 *
 * **Example** (Guard an executable skill type)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SkillType } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(SkillType)(SkillType.Enum.executable)) // true
 * console.log(S.is(SkillType)("script")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillType = SkillTypeBase.pipe(
  $I.annoteSchema("SkillType", {
    description: "Whether a skill carries executable source or only declarative guidance.",
  }),
  SchemaUtils.withLiteralKitStatics(SkillTypeBase)
);

/**
 * Decoded value produced by {@link SkillType}.
 *
 * @see {@link SkillType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SkillType = typeof SkillType.Type;

/**
 * Flat schema-first equivalent of the Python `ExtractedSkill` model.
 *
 * **Details**
 *
 * Relation identifiers normalize during decode. Hashes are SHA-256 and optional Python values become `Option`.
 * The computed `skillType` getter is decoded behavior and is not an encoded field.
 *
 * **Example** (Declarative skill)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExtractedSkill } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const skill = S.decodeSync(ExtractedSkill)({
 *   id: "docx-review",
 *   hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   nature: "review",
 *   genus: "document",
 *   differentia: "DOCX-specific comments",
 *   intents: ["review-docx"],
 * })
 * console.log(skill.skillType) // "declarative"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractedSkill extends S.Class<ExtractedSkill>($I`ExtractedSkill`)(
  {
    id: SkillId,
    hash: Sha256,
    nature: NonEmptyTrimmedStr,
    genus: NonEmptyTrimmedStr,
    differentia: NonEmptyTrimmedStr,
    intents: S.Array(NonEmptyTrimmedStr),
    requirements: S.Array(Requirement).pipe(SchemaUtils.withEmptyArrayDefaults<Requirement>()),
    dependsOn: S.Array(RelationId).pipe(SchemaUtils.withEmptyArrayDefaults<RelationId>()),
    extends: S.Array(RelationId).pipe(SchemaUtils.withEmptyArrayDefaults<RelationId>()),
    contradicts: S.Array(RelationId).pipe(SchemaUtils.withEmptyArrayDefaults<RelationId>()),
    stateTransitions: S.OptionFromNullOr(StateTransition).pipe(SchemaUtils.withKeyDefaults(O.none())),
    generatedBy: S.String.pipe(SchemaUtils.withKeyDefaults("unknown")),
    executionPayload: S.OptionFromNullOr(ExecutionPayload).pipe(SchemaUtils.withKeyDefaults(O.none())),
    provenance: S.OptionFromNullOr(NonEmptyTrimmedStr).pipe(SchemaUtils.withKeyDefaults(O.none())),
    knowledgeNodes: S.Array(KnowledgeNode).pipe(SchemaUtils.withEmptyArrayDefaults<KnowledgeNode>()),
    category: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    version: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    license: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    author: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    packageName: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    isUserInvocable: IsUserInvocable.pipe(SchemaUtils.withKeyDefaults(true)),
    argumentHint: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    allowedTools: S.Array(NonEmptyTrimmedStr).pipe(SchemaUtils.withEmptyArrayDefaults<NonEmptyTrimmedStr>()),
    aliases: S.Array(NonEmptyTrimmedStr).pipe(SchemaUtils.withEmptyArrayDefaults<NonEmptyTrimmedStr>()),
    codeAnnotations: S.Array(CodeAnnotation).pipe(SchemaUtils.withEmptyArrayDefaults<CodeAnnotation>()),
    tableAnnotations: S.Array(TableAnnotation).pipe(SchemaUtils.withEmptyArrayDefaults<TableAnnotation>()),
    flowchartAnnotations: S.Array(FlowchartAnnotation).pipe(SchemaUtils.withEmptyArrayDefaults<FlowchartAnnotation>()),
    templateAnnotations: S.Array(TemplateAnnotation).pipe(SchemaUtils.withEmptyArrayDefaults<TemplateAnnotation>()),
    workflows: S.Array(Workflow).pipe(SchemaUtils.withEmptyArrayDefaults<Workflow>()),
  },
  $I.annote("ExtractedSkill", {
    description: "Complete flat LLM extraction result with strict knowledge, relations, metadata, and workflow fields.",
  })
) {
  static readonly is = S.is(ExtractedSkill);

  static readonly skillType = (skill: ExtractedSkill): SkillType =>
    O.isSome(skill.executionPayload) ? "executable" : "declarative";

  /**
   * Whether this skill carries executable source (`executable`) or only
   * declarative guidance (`declarative`).
   *
   * **Example** (Missing payload is declarative)
   *
   * ```ts
   * import * as S from "effect/Schema"
   * import { ExtractedSkill } from "../../../ontoskills/OntoSkills.models.ts"
   *
   * const skill = S.decodeSync(ExtractedSkill)({
   *   id: "docx-review",
   *   hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
   *   nature: "review",
   *   genus: "document",
   *   differentia: "DOCX-specific comments",
   *   intents: ["review-docx"],
   * })
   * console.log(skill.skillType)
   * // => "declarative"
   * ```
   *
   * @since 0.0.0
   */
  get skillType(): SkillType {
    return ExtractedSkill.skillType(this);
  }
}

const normalizeSkillName = flow(
  Str.replace(":", "-"),
  Str.toLowerCase,
  Str.trim,
  Str.replace(/[\s_]+/g, "-"),
  Str.replace(/[^a-z0-9-]/g, "-"),
  Str.replace(/-+/g, "-"),
  Str.replace(/^-+|-+$/g, "")
);

const SkillNameValue = S.String.check(
  S.isNonEmpty({
    identifier: $I`SkillNameNonEmptyCheck`,
    title: "Non-empty skill name",
    description: "Rejects skill names that become empty after canonical normalization.",
    message: "Skill name is empty after normalization",
  }),
  S.isMaxLength(64, {
    identifier: $I`SkillNameMaxLengthCheck`,
    title: "Skill name maximum length",
    description: "Limits canonical skill names to the Anthropic authoring maximum of 64 characters.",
    message: "Skill name must be at most 64 characters",
  }),
  S.makeFilter((name: string) => name !== "ontoskills" && name !== "index", {
    identifier: $I`SkillNameNotReservedCheck`,
    title: "Non-reserved skill name",
    description: "Rejects the reserved full names ontoskills and index after normalization.",
    message: "Skill name is reserved",
  })
).pipe(
  S.brand("SkillName"),
  $I.annoteSchema("SkillNameValue", {
    description: "Validated canonical skill name after lossy normalization.",
  })
);

/**
 * Lossy canonical name codec for skill frontmatter.
 *
 * **Details**
 *
 * The normalization law is idempotence: normalizing an already normalized name returns the same name. Raw spelling is
 * intentionally not recoverable, so raw decode/encode equality is not a law for this codec.
 *
 * **Example** (Scoped name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SkillName } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const name = S.decodeSync(SkillName)("CKM:Banner Design")
 * console.log(name) // "ckm-banner-design"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SkillName = S.String.pipe(
  S.decodeTo(
    SkillNameValue,
    SchemaTransformation.transform({ decode: normalizeSkillName, encode: identity })
  ),
  $I.annoteSchema("SkillName", {
    description: "Canonical lowercase, hyphen-delimited frontmatter name with reserved-name protection.",
  })
);

/**
 * Decoded value produced by {@link SkillName}.
 *
 * @see {@link SkillName} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SkillName = typeof SkillName.Type;

/**
 * Frontmatter description constrained by Anthropic authoring limits.
 *
 * **Example** (Plain description)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FrontmatterDescription } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(FrontmatterDescription)("Reviews DOCX files")) // true
 * console.log(S.is(FrontmatterDescription)("<p>nope</p>")) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const FrontmatterDescription = S.String.check(
  S.isMaxLength(1024, {
    identifier: $I`FrontmatterDescriptionMaxLengthCheck`,
    title: "Frontmatter description maximum length",
    description: "Limits frontmatter descriptions to 1024 characters.",
    message: "Description must be at most 1024 characters",
  }),
  S.makeFilter(flow(Str.match(FRONTMATTER_TAG_PATTERN), O.isNone), {
    identifier: $I`FrontmatterDescriptionWithoutTagsCheck`,
    title: "Tag-free frontmatter description",
    description: "Rejects XML or HTML opening-tag syntax in frontmatter descriptions.",
    message: "Description must not contain XML or HTML tags",
  })
).pipe(
  $I.annoteSchema("FrontmatterDescription", {
    description: "Frontmatter summary text safe for Anthropic skill metadata.",
  })
);

/**
 * Decoded value produced by {@link FrontmatterDescription}.
 *
 * @see {@link FrontmatterDescription} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterDescription = typeof FrontmatterDescription.Type;

/**
 * Parsed and normalized skill frontmatter.
 *
 * **Example** (Minimal frontmatter)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const frontmatter = S.decodeSync(Frontmatter)({
 *   name: "CKM:Banner Design",
 *   description: "Reviews DOCX files",
 * })
 * console.log(frontmatter.name) // "ckm-banner-design"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Frontmatter extends S.Class<Frontmatter>($I`Frontmatter`)(
  {
    name: SkillName,
    description: FrontmatterDescription,
    version: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    metadata: S.Record(S.String, S.Unknown).pipe(SchemaUtils.withKeyDefaults(R.empty())),
  },
  $I.annote("Frontmatter", {
    description: "Validated SKILL.md frontmatter with canonical name and preserved extension metadata.",
  })
) {}

/**
 * File metadata produced by the Phase 1 loader.
 *
 * **Example** (Text file)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FileInfo } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const file = S.decodeSync(FileInfo)({
 *   relativePath: "SKILL.md",
 *   contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   fileSize: 128,
 *   mimeType: "text/markdown",
 * })
 * console.log(file.relativePath) // "SKILL.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileInfo extends S.Class<FileInfo>($I`FileInfo`)(
  {
    relativePath: NonEmptyTrimmedStr,
    contentHash: Sha256,
    fileSize: NonNegativeInt,
    mimeType: NonEmptyTrimmedStr,
  },
  $I.annote("FileInfo", {
    description: "Deterministic filesystem metadata used for progressive disclosure and change detection.",
  })
) {}

const FlowchartTypeBase = LiteralKit(["graphviz", "mermaid"]);

/**
 * Supported flowchart source languages.
 *
 * **Example** (Guard a Mermaid chart)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlowchartType } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(FlowchartType)(FlowchartType.Enum.mermaid)) // true
 * console.log(S.is(FlowchartType)("plantuml")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FlowchartType = FlowchartTypeBase.pipe(
  $I.annoteSchema("FlowchartType", {
    description: "Finite source-language domain for extracted flowcharts.",
  }),
  SchemaUtils.withLiteralKitStatics(FlowchartTypeBase)
);

/**
 * Decoded value produced by {@link FlowchartType}.
 *
 * @see {@link FlowchartType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type FlowchartType = typeof FlowchartType.Type;

const ContentBlockTypeBase = LiteralKit([
  "paragraph",
  "code_block",
  "table",
  "flowchart",
  "template",
  "bullet_list",
  "blockquote",
  "ordered_procedure",
  "html_block",
  "frontmatter",
  "heading",
]);

/**
 * Discriminator values for all Phase 1 content blocks.
 *
 * **Example** (Guard a code-block discriminator)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContentBlockType } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * console.log(S.is(ContentBlockType)(ContentBlockType.Enum.code_block)) // true
 * console.log(S.is(ContentBlockType)("image")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContentBlockType = ContentBlockTypeBase.pipe(
  $I.annoteSchema("ContentBlockType", {
    description: "Complete discriminator domain for structurally extracted markdown blocks.",
  }),
  SchemaUtils.withLiteralKitStatics(ContentBlockTypeBase)
);

/**
 * Decoded value produced by {@link ContentBlockType}.
 *
 * @see {@link ContentBlockType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ContentBlockType = typeof ContentBlockType.Type;

/**
 * Inline fenced code extracted from markdown.
 *
 * **Example** (Code block member)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CodeBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const block = S.decodeSync(CodeBlock)({
 *   language: "ts",
 *   content: "export const x = 1",
 *   sourceLineStart: 1,
 *   sourceLineEnd: 1,
 * })
 * console.log(block.blockType) // "code_block"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeBlock extends S.Class<CodeBlock>($I`CodeBlock`)(
  {
    blockType: S.tag("code_block").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("code_block"))),
    language: S.String,
    content: NonEmptyTrimmedStr,
    sourceLineStart: PosInt,
    sourceLineEnd: PosInt,
    contentOrder: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(zero)),
  },
  $I.annote("CodeBlock", {
    description: "Fenced code source with language, source span, and document order.",
  })
) {
  static readonly thunkThis = () => CodeBlock;
}

/**
 * Markdown table extracted during structural parsing.
 *
 * **Example** (Uncaptioned table)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MarkdownTable } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const table = S.decodeSync(MarkdownTable)({
 *   markdownSource: "| a | b |\n| --- | --- |\n| 1 | 2 |",
 *   caption: null,
 *   rowCount: 1,
 * })
 * console.log(O.isNone(table.caption)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkdownTable extends S.Class<MarkdownTable>($I`MarkdownTable`)(
  {
    blockType: S.tag("table").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("table"))),
    markdownSource: NonEmptyTrimmedStr,
    caption: S.OptionFromNullOr(S.String),
    rowCount: NonNegativeInt,
    contentOrder: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(zero)),
  },
  $I.annote("MarkdownTable", {
    description: "Markdown table source, nullable caption, row count, and document order.",
  })
) {
  static readonly thunkThis = () => MarkdownTable;
}

/**
 * Graphviz or Mermaid source extracted from markdown.
 *
 * **Example** (Flowchart member)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlowchartBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const chart = S.decodeSync(FlowchartBlock)({
 *   source: "digraph { A -> B }",
 *   chartType: "graphviz",
 * })
 * console.log(chart.chartType) // "graphviz"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlowchartBlock extends S.Class<FlowchartBlock>($I`FlowchartBlock`)(
  {
    blockType: S.tag("flowchart").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("flowchart"))),
    source: NonEmptyTrimmedStr,
    chartType: FlowchartType,
    contentOrder: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(zero)),
  },
  $I.annote("FlowchartBlock", {
    description: "Diagram source classified as Graphviz or Mermaid with stable document order.",
  })
) {
  static readonly thunkThis = () => FlowchartBlock;
}

/**
 * Recursive procedure-step decoded and encoded shapes.
 *
 * @see {@link ProcedureStep} for the runtime codec that validates those shapes.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProcedureStep {
  /**
   * Decoded recursive procedure-step: instruction text, one-based position, and nested content blocks.
   *
   * @see {@link ProcedureStep} for the runtime codec that validates this shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Type = {
    readonly text: NonEmptyTrimmedStr;
    readonly position: PosInt;
    readonly children: ReadonlyArray<ContentBlock.Type>;
  };

  /**
   * Encoded recursive procedure-step accepted by {@link ProcedureStep} before decoding.
   *
   * @see {@link ProcedureStep} for the runtime codec and decoded shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = {
    readonly text: string;
    readonly position: number;
    readonly children: ReadonlyArray<ContentBlock.Encoded> | undefined;
  };
}

const ProcedureStepChildren: S.Codec<
  ReadonlyArray<ContentBlock.Type>,
  ReadonlyArray<ContentBlock.Encoded> | undefined
> = S.Array(
  S.suspend((): S.Codec<ContentBlock.Type, ContentBlock.Encoded> => ContentBlock)
).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<ContentBlock.Type>())),
  S.withDecodingDefaultType(Effect.succeed(A.empty<ContentBlock.Type>())),
  $I.annoteSchema("ProcedureStepChildren", {
    description: "Recursive content blocks nested beneath a procedure step.",
  })
);

/**
 * One one-based step in an ordered procedure.
 *
 * **Details**
 *
 * This is an annotated recursive struct codec because a self-referential class base expression is not representable.
 *
 * **Example** (First step)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProcedureStep } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const step = S.decodeSync(ProcedureStep)({
 *   text: "Install dependencies",
 *   position: 1,
 *   children: [],
 * })
 * console.log(step.position) // 1
 * console.log(step.children.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProcedureStep: S.Codec<ProcedureStep.Type, ProcedureStep.Encoded> = S.Struct({
  text: NonEmptyTrimmedStr,
  position: PosInt,
  children: ProcedureStepChildren,
}).pipe(
  $I.annoteSchema("ProcedureStep", {
    description: "One one-based procedure instruction with recursively nested content blocks.",
  })
);

/**
 * Decoded value produced by {@link ProcedureStep}.
 *
 * @see {@link ProcedureStep} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ProcedureStep = typeof ProcedureStep.Type;

/**
 * Ordered checklist or numbered procedure extracted from markdown.
 *
 * **Example** (Procedure member)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OrderedProcedure } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const procedure = S.decodeSync(OrderedProcedure)({
 *   items: [{ text: "Install dependencies", position: 1, children: [] }],
 * })
 * console.log(procedure.blockType) // "ordered_procedure"
 * console.log(procedure.items[0]?.position) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OrderedProcedure extends S.Class<OrderedProcedure>($I`OrderedProcedure`)(
  {
    blockType: S.tag("ordered_procedure").pipe(
      S.withDecodingDefaultTypeKey(Effect.succeed("ordered_procedure"))
    ),
    items: S.Array(ProcedureStep),
    contentOrder: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(zero)),
  },
  $I.annote("OrderedProcedure", {
    description: "Ordered procedural content with nested child blocks and stable document order.",
  })
) {
  static readonly thunkThis = () => OrderedProcedure;
}

/**
 * Variable-bearing template extracted from markdown.
 *
 * **Example** (Template member)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TemplateBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const template = S.decodeSync(TemplateBlock)({
 *   content: "Hello {{name}}",
 *   detectedVariables: ["name"],
 * })
 * console.log(template.detectedVariables) // ["name"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TemplateBlock extends S.Class<TemplateBlock>($I`TemplateBlock`)(
  {
    blockType: S.tag("template").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("template"))),
    content: NonEmptyTrimmedStr,
    detectedVariables: S.Array(NonEmptyTrimmedStr),
    contentOrder: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(zero)),
  },
  $I.annote("TemplateBlock", {
    description: "Template content and its detected variable placeholders in document order.",
  })
) {
  static readonly thunkThis = () => TemplateBlock;
}

/**
 * Free-form paragraph extracted from markdown.
 *
 * **Example** (Paragraph member)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Paragraph } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const paragraph = S.decodeSync(Paragraph)({
 *   textContent: "Reviews DOCX files.",
 *   contentOrder: 0,
 * })
 * console.log(paragraph.blockType) // "paragraph"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Paragraph extends S.Class<Paragraph>($I`Paragraph`)(
  {
    blockType: S.tag("paragraph").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("paragraph"))),
    textContent: NonEmptyTrimmedStr,
    contentOrder: NonNegativeInt,
  },
  $I.annote("Paragraph", {
    description: "A free-form markdown paragraph with stable document order.",
  })
) {
  static readonly thunkThis = () => Paragraph;
}

/**
 * Recursive bullet-item decoded and encoded shapes.
 *
 * @see {@link BulletItem} for the runtime codec that validates those shapes.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BulletItem {
  /**
   * Decoded unordered-list item: display text, stable order, and nested content blocks.
   *
   * @see {@link BulletItem} for the runtime codec that validates this shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Type = {
    readonly text: NonEmptyTrimmedStr;
    readonly order: NonNegativeInt;
    readonly children: ReadonlyArray<ContentBlock.Type>;
  };

  /**
   * Encoded unordered-list item accepted by {@link BulletItem} before decoding.
   *
   * @see {@link BulletItem} for the runtime codec and decoded shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = {
    readonly text: string;
    readonly order: number;
    readonly children: ReadonlyArray<ContentBlock.Encoded> | undefined;
  };
}

const BulletItemChildren: S.Codec<
  ReadonlyArray<ContentBlock.Type>,
  ReadonlyArray<ContentBlock.Encoded> | undefined
> = S.Array(
  S.suspend((): S.Codec<ContentBlock.Type, ContentBlock.Encoded> => ContentBlock)
).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<ContentBlock.Type>())),
  S.withDecodingDefaultType(Effect.succeed(A.empty<ContentBlock.Type>())),
  $I.annoteSchema("BulletItemChildren", {
    description: "Recursive content blocks nested beneath a bullet item.",
  })
);

/**
 * One item in an unordered list.
 *
 * **Details**
 *
 * This is an annotated recursive struct codec because a self-referential class base expression is not representable.
 *
 * **Example** (Nested bullet)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BulletItem } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const item = S.decodeSync(BulletItem)({
 *   text: "Prefer schema-first models",
 *   order: 0,
 *   children: [],
 * })
 * console.log(item.order) // 0
 * console.log(item.children.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BulletItem: S.Codec<BulletItem.Type, BulletItem.Encoded> = S.Struct({
  text: NonEmptyTrimmedStr,
  order: NonNegativeInt,
  children: BulletItemChildren,
}).pipe(
  $I.annoteSchema("BulletItem", {
    description: "An unordered-list item with stable order and recursively nested blocks.",
  })
);

/**
 * Decoded value produced by {@link BulletItem}.
 *
 * @see {@link BulletItem} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type BulletItem = typeof BulletItem.Type;

/**
 * Unordered list extracted from markdown.
 *
 * **Example** (Bullet-list member)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BulletListBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const list = S.decodeSync(BulletListBlock)({
 *   items: [{ text: "Prefer schema-first models", order: 0, children: [] }],
 *   contentOrder: 2,
 * })
 * console.log(list.blockType) // "bullet_list"
 * console.log(list.items[0]?.text) // "Prefer schema-first models"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BulletListBlock extends S.Class<BulletListBlock>($I`BulletListBlock`)(
  {
    blockType: S.tag("bullet_list").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("bullet_list"))),
    items: S.Array(BulletItem),
    contentOrder: NonNegativeInt,
  },
  $I.annote("BulletListBlock", {
    description: "An unordered markdown list represented by stable ordered item records.",
  })
) {
  static readonly thunkThis = () => BulletListBlock;
}

/**
 * Quoted content with optional attribution.
 *
 * **Example** (Anonymous quote)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BlockQuoteBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const quote = S.decodeSync(BlockQuoteBlock)({
 *   content: "Ship the simplest codec that holds.",
 *   attribution: null,
 *   contentOrder: 3,
 * })
 * console.log(O.isNone(quote.attribution)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockQuoteBlock extends S.Class<BlockQuoteBlock>($I`BlockQuoteBlock`)(
  {
    blockType: S.tag("blockquote").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("blockquote"))),
    content: NonEmptyTrimmedStr,
    attribution: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withKeyDefaults(O.none())),
    contentOrder: NonNegativeInt,
  },
  $I.annote("BlockQuoteBlock", {
    description: "Quoted markdown content with nullable attribution and stable document order.",
  })
) {
  static readonly thunkThis = () => BlockQuoteBlock;
}

/**
 * Raw HTML block extracted from markdown.
 *
 * **Example** (HTML member)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HTMLBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const html = S.decodeSync(HTMLBlock)({
 *   content: "<div class=\"callout\">Note</div>",
 *   contentOrder: 4,
 * })
 * console.log(html.blockType) // "html_block"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HTMLBlock extends S.Class<HTMLBlock>($I`HTMLBlock`)(
  {
    blockType: S.tag("html_block").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("html_block"))),
    content: NonEmptyTrimmedStr,
    contentOrder: NonNegativeInt,
  },
  $I.annote("HTMLBlock", {
    description: "Raw HTML content retained from markdown structural extraction.",
  })
) {
  static readonly thunkThis = () => HTMLBlock;
}

/**
 * Raw YAML frontmatter represented as a content block.
 *
 * **Example** (Empty properties)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FrontmatterBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const yaml = S.decodeSync(FrontmatterBlock)({
 *   rawYaml: "name: docx-review",
 *   contentOrder: 0,
 * })
 * console.log(yaml.properties) // {}
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrontmatterBlock extends S.Class<FrontmatterBlock>($I`FrontmatterBlock`)(
  {
    blockType: S.tag("frontmatter").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("frontmatter"))),
    rawYaml: S.String,
    properties: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())),
    contentOrder: NonNegativeInt,
  },
  $I.annote("FrontmatterBlock", {
    description: "Raw YAML frontmatter and string-valued properties in flat extraction order.",
  })
) {
  static readonly thunkThis = () => FrontmatterBlock;
}

/**
 * Heading represented in flat extraction mode.
 *
 * **Example** (Second-level heading)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HeadingBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const heading = S.decodeSync(HeadingBlock)({
 *   text: "Usage",
 *   level: 2,
 *   contentOrder: 1,
 * })
 * console.log(heading.level) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeadingBlock extends S.Class<HeadingBlock>($I`HeadingBlock`)(
  {
    blockType: S.tag("heading").pipe(S.withDecodingDefaultTypeKey(Effect.succeed("heading"))),
    text: NonEmptyTrimmedStr,
    level: PosInt,
    contentOrder: NonNegativeInt,
  },
  $I.annote("HeadingBlock", {
    description: "A markdown heading retained as a flat content block with level and order.",
  })
) {
  static readonly thunkThis = () => HeadingBlock;
}

/**
 * Complete Phase 1 content-block discriminated union.
 *
 * **Example** (Paragraph branch)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContentBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const block = S.decodeSync(ContentBlock)({
 *   blockType: "paragraph",
 *   textContent: "Reviews DOCX files.",
 *   contentOrder: 0,
 * })
 * console.log(block.blockType) // "paragraph"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContentBlock: S.Codec<ContentBlock.Type, ContentBlock.Encoded> = ContentBlockType.mapMembers(
  Tuple.evolve([
    Paragraph.thunkThis,
    CodeBlock.thunkThis,
    MarkdownTable.thunkThis,
    FlowchartBlock.thunkThis,
    TemplateBlock.thunkThis,
    BulletListBlock.thunkThis,
    BlockQuoteBlock.thunkThis,
    OrderedProcedure.thunkThis,
    HTMLBlock.thunkThis,
    FrontmatterBlock.thunkThis,
    HeadingBlock.thunkThis,
  ])
).pipe(
  S.toTaggedUnion("blockType"),
  $I.annoteSchema("ContentBlock", {
    description: "All structurally distinct markdown blocks discriminated by block type.",
  })
);

/**
 * Decoded value produced by {@link ContentBlock}.
 *
 * @see {@link ContentBlock} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ContentBlock = typeof ContentBlock.Type;

/**
 * Recursive content-block type and encoded form used by suspended child references.
 *
 * @see {@link ContentBlock} for the runtime codec that validates those shapes.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ContentBlock {
  /**
   * Decoded Phase 1 content-block union discriminated by `blockType`.
   *
   * @see {@link ContentBlock} for the runtime codec that validates this union.
   * @category type-level
   * @since 0.0.0
   */
  export type Type =
    | Paragraph
    | CodeBlock
    | MarkdownTable
    | FlowchartBlock
    | TemplateBlock
    | BulletListBlock
    | BlockQuoteBlock
    | OrderedProcedure
    | HTMLBlock
    | FrontmatterBlock
    | HeadingBlock;

  /**
   * Encoded Phase 1 content-block union accepted by {@link ContentBlock} before decoding.
   *
   * @see {@link ContentBlock} for the runtime codec and decoded union.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | {
        readonly blockType?: "paragraph";
        readonly textContent: string;
        readonly contentOrder: number;
      }
    | {
        readonly blockType?: "code_block";
        readonly language: string;
        readonly content: string;
        readonly sourceLineStart: number;
        readonly sourceLineEnd: number;
        readonly contentOrder?: number;
      }
    | {
        readonly blockType?: "table";
        readonly markdownSource: string;
        readonly caption: string | null;
        readonly rowCount: number;
        readonly contentOrder?: number;
      }
    | {
        readonly blockType?: "flowchart";
        readonly source: string;
        readonly chartType: FlowchartType;
        readonly contentOrder?: number;
      }
    | {
        readonly blockType?: "template";
        readonly content: string;
        readonly detectedVariables: ReadonlyArray<string>;
        readonly contentOrder?: number;
      }
    | {
        readonly blockType?: "bullet_list";
        readonly items: ReadonlyArray<BulletItem.Encoded>;
        readonly contentOrder: number;
      }
    | {
        readonly blockType?: "blockquote";
        readonly content: string;
        readonly attribution?: string | null;
        readonly contentOrder: number;
      }
    | {
        readonly blockType?: "ordered_procedure";
        readonly items: ReadonlyArray<ProcedureStep.Encoded>;
        readonly contentOrder?: number;
      }
    | {
        readonly blockType?: "html_block";
        readonly content: string;
        readonly contentOrder: number;
      }
    | {
        readonly blockType?: "frontmatter";
        readonly rawYaml: string;
        readonly properties?: Readonly<Record<string, string>>;
        readonly contentOrder: number;
      }
    | {
        readonly blockType?: "heading";
        readonly text: string;
        readonly level: number;
        readonly contentOrder: number;
      };
}

/**
 * Recursive section decoded and encoded shapes.
 *
 * @see {@link Section} for the runtime codec that validates those shapes.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Section {
  /**
   * Decoded heading-led section: title, level, order, blocks, and nested subsections.
   *
   * @see {@link Section} for the runtime codec that validates this shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Type = {
    readonly title: NonEmptyTrimmedStr;
    readonly level: PosInt;
    readonly order: NonNegativeInt;
    readonly content: ReadonlyArray<ContentBlock.Type>;
    readonly subsections: ReadonlyArray<Type>;
  };

  /**
   * Encoded heading-led section accepted by {@link Section} before decoding.
   *
   * @see {@link Section} for the runtime codec and decoded shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = {
    readonly title: string;
    readonly level: number;
    readonly order: number;
    readonly content: ReadonlyArray<ContentBlock.Encoded> | undefined;
    readonly subsections: ReadonlyArray<Encoded> | undefined;
  };
}

const SectionContent: S.Codec<
  ReadonlyArray<ContentBlock.Type>,
  ReadonlyArray<ContentBlock.Encoded> | undefined
> = S.Array(
  S.suspend((): S.Codec<ContentBlock.Type, ContentBlock.Encoded> => ContentBlock)
).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<ContentBlock.Type>())),
  S.withDecodingDefaultType(Effect.succeed(A.empty<ContentBlock.Type>())),
  $I.annoteSchema("SectionContent", {
    description: "Recursive content-block collection owned by a document section.",
  })
);

const SectionSubsections: S.Codec<ReadonlyArray<Section.Type>, ReadonlyArray<Section.Encoded> | undefined> = S.Array(
  S.suspend((): S.Codec<Section.Type, Section.Encoded> => Section)
).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<Section.Type>())),
  S.withDecodingDefaultType(Effect.succeed(A.empty<Section.Type>())),
  $I.annoteSchema("SectionSubsections", {
    description: "Recursive child sections nested beneath a document section.",
  })
);

/**
 * Heading-led section in a markdown document.
 *
 * **Details**
 *
 * This is an annotated recursive struct codec so nested sections share one suspended schema source of truth.
 *
 * **Example** (Empty section)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Section } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const section = S.decodeSync(Section)({
 *   title: "Usage",
 *   level: 2,
 *   order: 0,
 *   content: [],
 *   subsections: [],
 * })
 * console.log(section.content.length) // 0
 * console.log(section.subsections.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Section: S.Codec<Section.Type, Section.Encoded> = S.Struct({
  title: NonEmptyTrimmedStr,
  level: PosInt,
  order: NonNegativeInt,
  content: SectionContent,
  subsections: SectionSubsections,
}).pipe(
  $I.annoteSchema("Section", {
    description: "Recursive heading-led markdown section containing blocks and nested subsections.",
  })
);

/**
 * Decoded value produced by {@link Section}.
 *
 * @see {@link Section} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Section = typeof Section.Type;

/**
 * Aggregate result of Phase 1 structural extraction.
 *
 * **Example** (Empty extraction)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContentExtraction } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const extraction = S.decodeSync(ContentExtraction)({})
 * console.log(extraction.sections.length) // 0
 * console.log(extraction.codeBlocks.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContentExtraction extends S.Class<ContentExtraction>($I`ContentExtraction`)(
  {
    sections: S.Array(Section).pipe(SchemaUtils.withEmptyArrayDefaults<Section>()),
    codeBlocks: S.Array(CodeBlock).pipe(SchemaUtils.withEmptyArrayDefaults<CodeBlock>()),
    tables: S.Array(MarkdownTable).pipe(SchemaUtils.withEmptyArrayDefaults<MarkdownTable>()),
    flowcharts: S.Array(FlowchartBlock).pipe(SchemaUtils.withEmptyArrayDefaults<FlowchartBlock>()),
    procedures: S.Array(OrderedProcedure).pipe(SchemaUtils.withEmptyArrayDefaults<OrderedProcedure>()),
    templates: S.Array(TemplateBlock).pipe(SchemaUtils.withEmptyArrayDefaults<TemplateBlock>()),
  },
  $I.annote("ContentExtraction", {
    description: "Phase 1 structural extraction grouped into sections and specialized block inventories.",
  })
) {}

/**
 * Unique-ID projection of one content block.
 *
 * **Example** (Root block)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FlatBlock } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const flat = S.decodeSync(FlatBlock)({
 *   blockId: "p-1",
 *   blockType: "paragraph",
 *   content: {
 *     blockType: "paragraph",
 *     textContent: "Reviews DOCX files.",
 *     contentOrder: 0,
 *   },
 *   lineStart: 1,
 *   lineEnd: 1,
 *   parentBlockId: null,
 * })
 * console.log(O.isNone(flat.parentBlockId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlatBlock extends S.Class<FlatBlock>($I`FlatBlock`)(
  {
    blockId: NonEmptyTrimmedStr,
    blockType: ContentBlockType,
    content: ContentBlock,
    lineStart: PosInt,
    lineEnd: PosInt,
    parentBlockId: S.OptionFromNullOr(NonEmptyTrimmedStr).pipe(SchemaUtils.withKeyDefaults(O.none())),
  },
  $I.annote("FlatBlock", {
    description: "Hydration-ready content block with stable identifier, source span, and optional parent.",
  })
) {}

/**
 * Recursive document-skeleton node decoded and encoded shapes.
 *
 * @see {@link SkeletonNode} for the runtime codec that validates those shapes.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SkeletonNode {
  /**
   * Decoded recursive skeleton node: a block identifier and nested child nodes.
   *
   * @see {@link SkeletonNode} for the runtime codec that validates this shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Type = {
    readonly blockId: NonEmptyTrimmedStr;
    readonly children: ReadonlyArray<Type>;
  };

  /**
   * Encoded recursive skeleton node accepted by {@link SkeletonNode} before decoding.
   *
   * @see {@link SkeletonNode} for the runtime codec and decoded shape.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = {
    readonly blockId: string;
    readonly children: ReadonlyArray<Encoded> | undefined;
  };
}

const SkeletonNodeChildren: S.Codec<
  ReadonlyArray<SkeletonNode.Type>,
  ReadonlyArray<SkeletonNode.Encoded> | undefined
> = S.Array(
  S.suspend((): S.Codec<SkeletonNode.Type, SkeletonNode.Encoded> => SkeletonNode)
).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<SkeletonNode.Type>())),
  S.withDecodingDefaultType(Effect.succeed(A.empty<SkeletonNode.Type>())),
  $I.annoteSchema("SkeletonNodeChildren", {
    description: "Recursive child nodes nested beneath one document-skeleton node.",
  })
);

/**
 * Recursive node in an LLM-produced document skeleton.
 *
 * **Details**
 *
 * This is an annotated recursive struct codec so every child is decoded through the same node schema.
 *
 * **Example** (Leaf node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SkeletonNode } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const node = S.decodeSync(SkeletonNode)({
 *   blockId: "heading-1",
 *   children: [],
 * })
 * console.log(node.blockId) // "heading-1"
 * console.log(node.children.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkeletonNode: S.Codec<SkeletonNode.Type, SkeletonNode.Encoded> = S.Struct({
  blockId: NonEmptyTrimmedStr,
  children: SkeletonNodeChildren,
}).pipe(
  $I.annoteSchema("SkeletonNode", {
    description: "Recursive block-id tree used to hydrate the final document hierarchy.",
  })
);

/**
 * Decoded value produced by {@link SkeletonNode}.
 *
 * @see {@link SkeletonNode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SkeletonNode = typeof SkeletonNode.Type;

/**
 * List item represented in a document skeleton.
 *
 * **Example** (Leaf list item)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SkeletonListItem } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const item = S.decodeSync(SkeletonListItem)({
 *   textBlockId: "li-1",
 * })
 * console.log(item.children) // []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkeletonListItem extends S.Class<SkeletonListItem>($I`SkeletonListItem`)(
  {
    textBlockId: NonEmptyTrimmedStr,
    children: S.Array(NonEmptyTrimmedStr).pipe(SchemaUtils.withEmptyArrayDefaults<NonEmptyTrimmedStr>()),
  },
  $I.annote("SkeletonListItem", {
    description: "Skeleton list item linking its text block to child block identifiers.",
  })
) {}

/**
 * LLM-produced hierarchy over deterministic block identifiers.
 *
 * **Example** (Section-only skeleton)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DocumentSkeleton } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const skeleton = S.decodeSync(DocumentSkeleton)({
 *   sections: [{ blockId: "heading-1", children: [] }],
 * })
 * console.log(skeleton.listItems) // {}
 * console.log(skeleton.sections[0]?.blockId) // "heading-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentSkeleton extends S.Class<DocumentSkeleton>($I`DocumentSkeleton`)(
  {
    sections: S.Array(SkeletonNode),
    listItems: S.Record(S.String, S.Array(SkeletonListItem)).pipe(SchemaUtils.withKeyDefaults(R.empty())),
  },
  $I.annote("DocumentSkeleton", {
    description: "Document section tree and keyed list-item structures produced from flat block identifiers.",
  })
) {}

/**
 * Complete Phase 1 filesystem and content inventory.
 *
 * **Example** (Deferred extraction)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DirectoryScan } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const scan = S.decodeSync(DirectoryScan)({
 *   frontmatter: {
 *     name: "docx-review",
 *     description: "Reviews DOCX files",
 *   },
 *   skillId: "docx-review",
 *   qualifiedId: "acme/office/docx-review",
 *   contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   provenancePath: "skills/office",
 *   files: [],
 *   skillMdContent: "# DOCX Review",
 *   fileTree: "SKILL.md",
 *   contentExtraction: null,
 * })
 * console.log(O.isNone(scan.contentExtraction)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DirectoryScan extends S.Class<DirectoryScan>($I`DirectoryScan`)(
  {
    frontmatter: Frontmatter,
    skillId: SkillId,
    qualifiedId: NonEmptyTrimmedStr,
    contentHash: Sha256,
    provenancePath: NonEmptyTrimmedStr,
    files: S.Array(FileInfo),
    skillMdContent: NonEmptyTrimmedStr,
    fileTree: S.String,
    contentExtraction: S.OptionFromNullOr(ContentExtraction).pipe(SchemaUtils.withKeyDefaults(O.none())),
  },
  $I.annote("DirectoryScan", {
    description: "Deterministic Phase 1 scan containing frontmatter, hashes, files, source text, and optional extraction.",
  })
) {}

/**
 * Final compiler output combining extracted semantics with Phase 1 and Phase 2 artifacts.
 *
 * **Example** (Compiled output)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CompiledSkill } from "../../../ontoskills/OntoSkills.models.ts"
 *
 * const compiled = S.decodeSync(CompiledSkill)({
 *   id: "docx-review",
 *   hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   nature: "review",
 *   genus: "document",
 *   differentia: "DOCX-specific comments",
 *   intents: ["review-docx"],
 * })
 * console.log(compiled.files.length) // 0
 * console.log(O.isNone(compiled.frontmatter)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CompiledSkill extends ExtractedSkill.extend<CompiledSkill>($I`CompiledSkill`)(
  {
    frontmatter: S.OptionFromNullOr(Frontmatter).pipe(SchemaUtils.withKeyDefaults(O.none())),
    files: S.Array(FileInfo).pipe(SchemaUtils.withEmptyArrayDefaults<FileInfo>()),
    referenceFiles: S.Array(ReferenceFile).pipe(SchemaUtils.withEmptyArrayDefaults<ReferenceFile>()),
    examples: S.Array(Example).pipe(SchemaUtils.withEmptyArrayDefaults<Example>()),
    contentExtraction: S.OptionFromNullOr(ContentExtraction).pipe(SchemaUtils.withKeyDefaults(O.none())),
  },
  $I.annote("CompiledSkill", {
    description: "Final OntoSkills compiler model spanning extraction, filesystem evidence, references, examples, and content.",
  })
) {}
