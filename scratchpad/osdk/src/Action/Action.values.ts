/**
 * Literal domains of actions: the tags of every action union and the enums of requests and validation.
 *
 * **Details**
 *
 * An action speaks four vocabularies about the same edits: the operations its
 * type declares (`createObject`), the edits a result reports (`addObject`), the
 * constraints its parameters were evaluated against and the modes a request
 * asks for. Each vocabulary is named once here, so the unions in the model are
 * anchored to a kit and a table keyed by one of them is checked for totality by
 * the compiler. Upper-case wire enums become lowerCamel domain literals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import { DataTypeKind } from "../DataType/DataType.values.ts";

const $I = $ScratchpadId.create("osdk/Action/Action.values");

// -----------------------------------------------------------------------------
// Type tags
// -----------------------------------------------------------------------------

/**
 * Tags a field of a struct parameter may have: the ontology data type universe.
 *
 * **Details**
 *
 * Struct parameter fields are not typed with the action parameter universe.
 * They use the older, wider universe that also describes legacy parameters,
 * which adds `byte`, `short`, `float`, `binary`, `cipherText`, `set`, `map`,
 * `any` and `unsupported` and has none of the reference tags other than
 * `object` and `objectSet`.
 *
 * **Example** (Compare the two universes of an action)
 *
 * ```ts import.meta.vitest name="Compare the two universes of an action"
 * import * as A from "effect/Array"
 * import { ActionParameterTypeKind } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { OntologyDataTypeKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const onlyInFields = A.difference(OntologyDataTypeKind.literals, ActionParameterTypeKind.literals)
 * onlyInFields // => ["byte", "short", "float", "binary", "cipherText", "set", "map", "any", "unsupported"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyDataTypeKind = DataTypeKind.pick([
  "boolean",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "binary",
  "marking",
  "cipherText",
  "mediaReference",
  "array",
  "set",
  "map",
  "struct",
  "object",
  "objectSet",
  "any",
  "unsupported",
]).pipe(
  $I.annoteSchema("OntologyDataTypeKind", {
    description: "Type tags a field of a struct action parameter may have.",
  })
);

/**
 * Runtime type of {@link OntologyDataTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyDataTypeKind = typeof OntologyDataTypeKind.Type;

// -----------------------------------------------------------------------------
// Operations and edits
// -----------------------------------------------------------------------------

/**
 * Kinds of effect an action type declares it may have on the ontology.
 *
 * **Example** (Tell object operations from link operations)
 *
 * ```ts import.meta.vitest name="Tell object operations from link operations"
 * import * as A from "effect/Array"
 * import { ActionOperationKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const touchesLinks = ActionOperationKind.matchOrElse(
 *   { createLink: () => true, deleteLink: () => true },
 *   () => false
 * )
 * const linkKinds = A.filter(ActionOperationKind.literals, touchesLinks)
 * linkKinds // => ["createLink", "deleteLink"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionOperationKind = LiteralKit([
  "createObject",
  "modifyObject",
  "deleteObject",
  "createLink",
  "deleteLink",
  "createInterfaceObject",
  "modifyInterfaceObject",
  "deleteInterfaceObject",
  "applyScenario",
]).pipe(
  $I.annoteSchema("ActionOperationKind", {
    description: "Kinds of effect an action type declares it may have on the ontology.",
  })
);

/**
 * Runtime type of {@link ActionOperationKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionOperationKind = typeof ActionOperationKind.Type;

/**
 * Kinds of edit an applied action reports.
 *
 * **Details**
 *
 * The result vocabulary differs from the declaration vocabulary on purpose:
 * a type declares `createObject`, a result reports `addObject`. Interface
 * operations and scenarios have no result kind of their own.
 *
 * **Example** (Derive the edits a batch can report)
 *
 * ```ts import.meta.vitest name="Derive the edits a batch can report"
 * import { BatchObjectEditKind, ObjectEditKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const sizes = [ObjectEditKind.literals.length, BatchObjectEditKind.literals.length]
 * sizes // => [5, 3]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectEditKind = LiteralKit(["addObject", "modifyObject", "deleteObject", "addLink", "deleteLink"]).pipe(
  $I.annoteSchema("ObjectEditKind", {
    description: "Kinds of edit an applied action reports.",
  })
);

/**
 * Runtime type of {@link ObjectEditKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectEditKind = typeof ObjectEditKind.Type;

/**
 * Kinds of edit a batch of applied actions reports: a batch never reports deletions.
 *
 * **Example** (Check that a batch cannot report a deletion)
 *
 * ```ts import.meta.vitest name="Check that a batch cannot report a deletion"
 * import * as S from "effect/Schema"
 * import { BatchObjectEditKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const isBatchKind = S.is(BatchObjectEditKind)
 * const verdicts = [isBatchKind("addLink"), isBatchKind("deleteLink")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BatchObjectEditKind = ObjectEditKind.pick(["addObject", "modifyObject", "addLink"]).pipe(
  $I.annoteSchema("BatchObjectEditKind", {
    description: "Kinds of edit a batch of applied actions reports: a batch never reports deletions.",
  })
);

/**
 * Runtime type of {@link BatchObjectEditKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type BatchObjectEditKind = typeof BatchObjectEditKind.Type;

/**
 * The two forms in which an applied action reports what it changed.
 *
 * **Details**
 *
 * `edits` lists every touched object and link. `largeScaleEdits` is what the
 * platform returns when there are too many to list: only the object types.
 *
 * **Example** (Tell whether individual edits are listed)
 *
 * ```ts import.meta.vitest name="Tell whether individual edits are listed"
 * import * as A from "effect/Array"
 * import { ActionEditsKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const listsEveryEdit = ActionEditsKind.match({ edits: () => true, largeScaleEdits: () => false })
 * const verdicts = A.map(ActionEditsKind.literals, listsEveryEdit)
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionEditsKind = LiteralKit(["edits", "largeScaleEdits"]).pipe(
  $I.annoteSchema("ActionEditsKind", {
    description: "The two forms in which an applied action reports what it changed.",
  })
);

/**
 * Runtime type of {@link ActionEditsKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionEditsKind = typeof ActionEditsKind.Type;

// -----------------------------------------------------------------------------
// Logic rules
// -----------------------------------------------------------------------------

/**
 * Kinds of step in the detailed logic of an action type.
 *
 * **Details**
 *
 * This is a different vocabulary from {@link ActionOperationKind}, the
 * summary an action type carries: interface rules are named `createInterface`
 * here and `createInterfaceObject` there, and only the detailed logic knows
 * create-or-modify, functions and interface links.
 *
 * **Example** (Find the rule kinds with no operation of the same name)
 *
 * ```ts import.meta.vitest name="Find the rule kinds with no operation of the same name"
 * import * as A from "effect/Array"
 * import { ActionLogicRuleKind, ActionOperationKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const detailOnly = A.difference(ActionLogicRuleKind.literals, ActionOperationKind.literals)
 * detailOnly.length // => 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionLogicRuleKind = LiteralKit([
  "createObject",
  "modifyObject",
  "createOrModifyObject",
  "createOrModifyObjectV2",
  "deleteObject",
  "createLink",
  "deleteLink",
  "createInterface",
  "modifyInterface",
  "createInterfaceLink",
  "deleteInterfaceLink",
  "function",
  "batchedFunction",
  "applyScenario",
]).pipe(
  $I.annoteSchema("ActionLogicRuleKind", {
    description: "Kinds of step in the detailed logic of an action type.",
  })
);

/**
 * Runtime type of {@link ActionLogicRuleKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionLogicRuleKind = typeof ActionLogicRuleKind.Type;

/**
 * Kinds of source a logic rule can take a value from.
 *
 * **Example** (Tell which sources read a parameter)
 *
 * ```ts import.meta.vitest name="Tell which sources read a parameter"
 * import * as A from "effect/Array"
 * import { LogicRuleArgumentKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const readsParameter = LogicRuleArgumentKind.matchOrElse(
 *   {
 *     parameterId: () => true,
 *     objectParameterPropertyValue: () => true,
 *     interfaceParameterPropertyValue: () => true,
 *   },
 *   () => false
 * )
 * const verdicts = A.map(LogicRuleArgumentKind.literals, readsParameter)
 * verdicts // => [true, false, true, true, false, false, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LogicRuleArgumentKind = LiteralKit([
  "parameterId",
  "staticValue",
  "objectParameterPropertyValue",
  "interfaceParameterPropertyValue",
  "currentUser",
  "currentTime",
  "uniqueIdentifier",
  "synchronousWebhookOutput",
]).pipe(
  $I.annoteSchema("LogicRuleArgumentKind", {
    description: "Kinds of source a logic rule can take a value from.",
  })
);

/**
 * Runtime type of {@link LogicRuleArgumentKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type LogicRuleArgumentKind = typeof LogicRuleArgumentKind.Type;

/**
 * Kinds of source a logic rule can take one field of a struct property from.
 *
 * **Example** (Tell which source reads a list of structs)
 *
 * ```ts import.meta.vitest name="Tell which source reads a list of structs"
 * import * as A from "effect/Array"
 * import { StructFieldArgumentKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const readsList = StructFieldArgumentKind.match({
 *   structParameterFieldValue: () => false,
 *   structListParameterFieldValue: () => true,
 * })
 * const verdicts = A.map(StructFieldArgumentKind.literals, readsList)
 * verdicts // => [false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StructFieldArgumentKind = LiteralKit(["structParameterFieldValue", "structListParameterFieldValue"]).pipe(
  $I.annoteSchema("StructFieldArgumentKind", {
    description: "Kinds of source a logic rule can take one field of a struct property from.",
  })
);

/**
 * Runtime type of {@link StructFieldArgumentKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type StructFieldArgumentKind = typeof StructFieldArgumentKind.Type;

// -----------------------------------------------------------------------------
// Constraints
// -----------------------------------------------------------------------------

/**
 * Kinds of constraint a parameter value was evaluated against when an action was validated.
 *
 * **Details**
 *
 * The platform documents nine kinds. The wire carries two more, `struct` and
 * `array`, which nest the evaluation of a struct parameter's fields and of
 * each entry of a list of structs.
 *
 * **Example** (Derive the constraints a struct field can carry)
 *
 * ```ts import.meta.vitest name="Derive the constraints a struct field can carry"
 * import { EvaluatedConstraintKind, StructFieldConstraintKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const sizes = [EvaluatedConstraintKind.literals.length, StructFieldConstraintKind.literals.length]
 * sizes // => [11, 5]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvaluatedConstraintKind = LiteralKit([
  "arraySize",
  "groupMember",
  "objectPropertyValue",
  "objectQueryResult",
  "oneOf",
  "range",
  "stringLength",
  "stringRegexMatch",
  "unevaluable",
  "struct",
  "array",
]).pipe(
  $I.annoteSchema("EvaluatedConstraintKind", {
    description: "Kinds of constraint a parameter value was evaluated against when an action was validated.",
  })
);

/**
 * Runtime type of {@link EvaluatedConstraintKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type EvaluatedConstraintKind = typeof EvaluatedConstraintKind.Type;

/**
 * Kinds of constraint one field of a struct parameter can be evaluated against.
 *
 * **Example** (Check which constraints reach a struct field)
 *
 * ```ts import.meta.vitest name="Check which constraints reach a struct field"
 * import * as S from "effect/Schema"
 * import { StructFieldConstraintKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const reachesFields = S.is(StructFieldConstraintKind)
 * const verdicts = [reachesFields("stringRegexMatch"), reachesFields("groupMember")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StructFieldConstraintKind = EvaluatedConstraintKind.pick([
  "objectQueryResult",
  "oneOf",
  "range",
  "stringLength",
  "stringRegexMatch",
]).pipe(
  $I.annoteSchema("StructFieldConstraintKind", {
    description: "Kinds of constraint one field of a struct parameter can be evaluated against.",
  })
);

/**
 * Runtime type of {@link StructFieldConstraintKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type StructFieldConstraintKind = typeof StructFieldConstraintKind.Type;

/**
 * Kinds of allowed-values rule an action type can configure on a parameter.
 *
 * **Details**
 *
 * This is the configured vocabulary, published with the action type. It is
 * not the evaluated one ({@link EvaluatedConstraintKind}): `datetime`, `text`,
 * `markdown`, `attachment`, `valueType` and `mustBeEmpty` exist only here, and
 * group or object-set membership exists only there.
 *
 * **Example** (Find the rules with no evaluated counterpart of the same name)
 *
 * ```ts import.meta.vitest name="Find the rules with no evaluated counterpart of the same name"
 * import * as A from "effect/Array"
 * import { AllowedValuesKind, EvaluatedConstraintKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const configuredOnly = A.difference(AllowedValuesKind.literals, EvaluatedConstraintKind.literals)
 * configuredOnly // => ["datetime", "text", "markdown", "attachment", "valueType", "mustBeEmpty"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AllowedValuesKind = LiteralKit([
  "oneOf",
  "range",
  "datetime",
  "text",
  "markdown",
  "attachment",
  "valueType",
  "mustBeEmpty",
]).pipe(
  $I.annoteSchema("AllowedValuesKind", {
    description: "Kinds of allowed-values rule an action type can configure on a parameter.",
  })
);

/**
 * Runtime type of {@link AllowedValuesKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type AllowedValuesKind = typeof AllowedValuesKind.Type;

/**
 * Where a configured bound takes its value from: a literal, another parameter's value or its length.
 *
 * **Example** (Tell which bounds depend on another parameter)
 *
 * ```ts import.meta.vitest name="Tell which bounds depend on another parameter"
 * import * as A from "effect/Array"
 * import { ConstraintBoundKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const dependsOnParameter = ConstraintBoundKind.match({
 *   static: () => false,
 *   parameterLength: () => true,
 *   parameterValue: () => true,
 * })
 * const verdicts = A.map(ConstraintBoundKind.literals, dependsOnParameter)
 * verdicts // => [false, true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ConstraintBoundKind = LiteralKit(["static", "parameterLength", "parameterValue"]).pipe(
  $I.annoteSchema("ConstraintBoundKind", {
    description: "Where a configured bound takes its value from: a literal, another parameter's value or its length.",
  })
);

/**
 * Runtime type of {@link ConstraintBoundKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ConstraintBoundKind = typeof ConstraintBoundKind.Type;

/**
 * How a configured date or timestamp bound is expressed: the evaluation time, a fixed instant or an offset from now.
 *
 * **Example** (Tell which datetime bounds move with the clock)
 *
 * ```ts import.meta.vitest name="Tell which datetime bounds move with the clock"
 * import * as A from "effect/Array"
 * import { DatetimeBoundKind } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const movesWithClock = DatetimeBoundKind.match({ now: () => true, fixed: () => false, relative: () => true })
 * const verdicts = A.map(DatetimeBoundKind.literals, movesWithClock)
 * verdicts // => [true, false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatetimeBoundKind = LiteralKit(["now", "fixed", "relative"]).pipe(
  $I.annoteSchema("DatetimeBoundKind", {
    description: "How a configured date or timestamp bound is expressed: now, a fixed instant or an offset from now.",
  })
);

/**
 * Runtime type of {@link DatetimeBoundKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatetimeBoundKind = typeof DatetimeBoundKind.Type;

/**
 * Unit of an offset from the evaluation time.
 *
 * **Example** (Convert a unit to seconds)
 *
 * ```ts import.meta.vitest name="Convert a unit to seconds"
 * import * as A from "effect/Array"
 * import { RelativeDatetimeUnit } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const seconds = RelativeDatetimeUnit.To.match({
 *   second: () => 1,
 *   minute: () => 60,
 *   hour: () => 3600,
 *   day: () => 86400,
 *   week: () => 604800,
 * })
 * const table = A.map(RelativeDatetimeUnit.Pairs, ([, unit]) => seconds(unit))
 * table // => [1, 60, 3600, 86400, 604800]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RelativeDatetimeUnit = MappedLiteralKit([
  ["SECOND", "second"],
  ["MINUTE", "minute"],
  ["HOUR", "hour"],
  ["DAY", "day"],
  ["WEEK", "week"],
]).pipe(
  $I.annoteSchema("RelativeDatetimeUnit", {
    description: "Unit of an offset from the evaluation time.",
  })
);

/**
 * Runtime type of {@link RelativeDatetimeUnit}.
 *
 * @category models
 * @since 0.0.0
 */
export type RelativeDatetimeUnit = typeof RelativeDatetimeUnit.Type;

/**
 * Direction of an offset from the evaluation time.
 *
 * **Example** (Turn a tense into a sign)
 *
 * ```ts import.meta.vitest name="Turn a tense into a sign"
 * import * as A from "effect/Array"
 * import { RelativeDatetimeTense } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const sign = RelativeDatetimeTense.To.match({ future: () => 1, past: () => -1 })
 * const signs = A.map(RelativeDatetimeTense.Pairs, ([, tense]) => sign(tense))
 * signs // => [1, -1]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RelativeDatetimeTense = MappedLiteralKit([
  ["FUTURE", "future"],
  ["PAST", "past"],
]).pipe(
  $I.annoteSchema("RelativeDatetimeTense", {
    description: "Direction of an offset from the evaluation time.",
  })
);

/**
 * Runtime type of {@link RelativeDatetimeTense}.
 *
 * @category models
 * @since 0.0.0
 */
export type RelativeDatetimeTense = typeof RelativeDatetimeTense.Type;

// -----------------------------------------------------------------------------
// Request modes and verdicts
// -----------------------------------------------------------------------------

/**
 * Whether applying an action only validates it or also executes it.
 *
 * **Details**
 *
 * The platform executes when a request does not say. OSDK spells this as a
 * `$validateOnly` boolean and changes the static return type with it.
 *
 * **Example** (Decode the apply mode)
 *
 * ```ts import.meta.vitest name="Decode the apply mode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ApplyActionMode } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const mode = await Effect.runPromise(S.decodeUnknownEffect(ApplyActionMode)("VALIDATE_ONLY"))
 * const executes = ApplyActionMode.To.match(mode, { validateOnly: () => false, validateAndExecute: () => true })
 * executes // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ApplyActionMode = MappedLiteralKit([
  ["VALIDATE_ONLY", "validateOnly"],
  ["VALIDATE_AND_EXECUTE", "validateAndExecute"],
]).pipe(
  $I.annoteSchema("ApplyActionMode", {
    description: "Whether applying an action only validates it or also executes it.",
  })
);

/**
 * Runtime type of {@link ApplyActionMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type ApplyActionMode = typeof ApplyActionMode.Type;

/**
 * Which edits the response to an applied action should list.
 *
 * **Details**
 *
 * The platform returns no edits when a request does not say. It documents
 * nothing else about the modes: by its name `ALL_V2_WITH_DELETIONS` (here
 * `allV2WithDeletions`) is the one that also lists deleted objects and links,
 * and it is the only listing mode OSDK ever sends for a single action.
 *
 * **Example** (Decode the return-edits mode)
 *
 * ```ts import.meta.vitest name="Decode the return-edits mode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ReturnEditsMode } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const mode = await Effect.runPromise(S.decodeUnknownEffect(ReturnEditsMode)("ALL_V2_WITH_DELETIONS"))
 * mode // => "allV2WithDeletions"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReturnEditsMode = MappedLiteralKit([
  ["ALL", "all"],
  ["ALL_V2_WITH_DELETIONS", "allV2WithDeletions"],
  ["NONE", "none"],
]).pipe(
  $I.annoteSchema("ReturnEditsMode", {
    description: "Which edits the response to an applied action should list.",
  })
);

/**
 * Runtime type of {@link ReturnEditsMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReturnEditsMode = typeof ReturnEditsMode.Type;

/**
 * Which edits the response to a batch of applied actions should list.
 *
 * **Details**
 *
 * A batch has no mode that lists deletions, and the platform returns no edits
 * when a request does not say.
 *
 * **Example** (Decode the batch return-edits mode)
 *
 * ```ts import.meta.vitest name="Decode the batch return-edits mode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BatchReturnEditsMode } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const mode = await Effect.runPromise(S.decodeUnknownEffect(BatchReturnEditsMode)("ALL"))
 * mode // => "all"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BatchReturnEditsMode = ReturnEditsMode.pick(["ALL", "NONE"]).pipe(
  $I.annoteSchema("BatchReturnEditsMode", {
    description: "Which edits the response to a batch of applied actions should list.",
  })
);

/**
 * Runtime type of {@link BatchReturnEditsMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type BatchReturnEditsMode = typeof BatchReturnEditsMode.Type;

/**
 * Verdict of validating an action, one of its submission criteria or one of its parameters.
 *
 * **Example** (Fold a verdict to a boolean)
 *
 * ```ts import.meta.vitest name="Fold a verdict to a boolean"
 * import * as A from "effect/Array"
 * import { ValidationResult } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const isValid = ValidationResult.To.match({ valid: () => true, invalid: () => false })
 * const verdicts = A.map(ValidationResult.Pairs, ([, result]) => isValid(result))
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValidationResult = MappedLiteralKit([
  ["VALID", "valid"],
  ["INVALID", "invalid"],
]).pipe(
  $I.annoteSchema("ValidationResult", {
    description: "Verdict of validating an action, one of its submission criteria or one of its parameters.",
  })
);

/**
 * Runtime type of {@link ValidationResult}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValidationResult = typeof ValidationResult.Type;
