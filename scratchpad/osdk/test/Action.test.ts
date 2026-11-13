import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import {
  assertFalse,
  assertInclude,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  ActionArguments,
  ActionEdits,
  ActionEditsKind,
  ActionLogicRule,
  ActionLogicRuleKind,
  ActionOperation,
  ActionOperationKind,
  ActionParameter,
  ActionParameterType,
  ActionType,
  ActionTypeDefinition,
  ActionValidation,
  AddedLink,
  AddedObject,
  AllowedValueOption,
  AllowedValues,
  AllowedValuesKind,
  ApplyActionMode,
  ApplyActionOptions,
  ApplyActionRequest,
  ApplyActionResponse,
  ApplyScenarioOperation,
  ApplyScenarioRule,
  ArgumentValue,
  ArrayConstraint,
  ArrayEntryConstraint,
  ArrayParameterType,
  ArraySizeBounds,
  ArraySizeConstraint,
  AttachmentAllowedValues,
  BatchActionEdits,
  BatchApplyActionItem,
  BatchApplyActionOptions,
  BatchApplyActionRequest,
  BatchApplyActionResponse,
  BatchedFunctionRule,
  BatchObjectEdit,
  BatchObjectEditKind,
  BatchObjectEdits,
  BatchReturnEditsMode,
  ConstraintBound,
  ConstraintBoundKind,
  CreateInterfaceLinkRule,
  CreateInterfaceObjectOperation,
  CreateInterfaceRule,
  CreateLinkOperation,
  CreateLinkRule,
  CreateObjectOperation,
  CreateObjectRule,
  CreateOrModifyObjectParameterRule,
  CreateOrModifyObjectRule,
  CurrentTimeArgument,
  CurrentUserArgument,
  DatetimeAllowedValues,
  DatetimeBound,
  DatetimeBoundKind,
  DeletedLink,
  DeletedObject,
  DeleteInterfaceLinkRule,
  DeleteInterfaceObjectOperation,
  DeleteLinkOperation,
  DeleteLinkRule,
  DeleteObjectOperation,
  DeleteObjectRule,
  EditedObject,
  EvaluatedConstraint,
  EvaluatedConstraintKind,
  editedObjectTypes,
  FixedDatetimeBound,
  FunctionCall,
  FunctionRule,
  GroupMemberConstraint,
  InterfaceObjectParameterType,
  InterfacePropertyArgument,
  LargeScaleEdits,
  LogicRuleArgument,
  LogicRuleArgumentKind,
  MarkdownAllowedValues,
  ModifiedObject,
  ModifyInterfaceObjectOperation,
  ModifyInterfaceRule,
  ModifyObjectOperation,
  ModifyObjectRule,
  MustBeEmptyAllowedValues,
  NowBound,
  ObjectEdit,
  ObjectEditKind,
  ObjectEdits,
  ObjectParameterType,
  ObjectPropertyArgument,
  ObjectPropertyValueConstraint,
  ObjectQueryResultConstraint,
  ObjectSetParameterType,
  OneOfAllowedValues,
  OneOfConstraint,
  OntologyArrayType,
  OntologyDataType,
  OntologyDataTypeKind,
  OntologyMapType,
  OntologySetType,
  ParameterArgument,
  ParameterConstraints,
  ParameterEvaluation,
  ParameterLengthBound,
  ParameterOption,
  ParameterValidation,
  ParameterValueBound,
  RangeAllowedValues,
  RangeConstraint,
  RelativeDatetimeBound,
  RelativeDatetimeTense,
  RelativeDatetimeUnit,
  ReturnEditsMode,
  ScenarioLinkScope,
  StaticArgument,
  StaticBound,
  StringLengthConstraint,
  StringRegexMatchConstraint,
  StructConstraint,
  StructFieldArgument,
  StructFieldArgumentKind,
  StructFieldConstraint,
  StructFieldConstraintKind,
  StructFieldEvaluation,
  StructFieldValueArgument,
  StructListFieldValueArgument,
  StructParameterField,
  StructParameterType,
  SubmissionCriterion,
  TextAllowedValues,
  UnevaluableConstraint,
  UniqueIdentifierArgument,
  ValidationResult,
  ValueTypeAllowedValues,
  WebhookOutputArgument,
} from "../src/Action/index.ts";
import { SizeBytes } from "../src/Attachment/Attachment.model.ts";
import {
  AnyType,
  DoubleType,
  IntegerType,
  ObjectTypeReferenceType,
  ScenarioReferenceType,
  StringType,
} from "../src/DataType/DataType.model.ts";
import { ActionParameterTypeKind } from "../src/DataType/DataType.values.ts";
import {
  ActionTypeApiName,
  ActionTypeRid,
  FunctionRid,
  FunctionVersion,
  InterfaceLinkTypeApiName,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  PropertyApiName,
  SharedPropertyTypeApiName,
  SharedPropertyTypeRid,
  StructFieldApiName,
  ValueTypeApiName,
  ValueTypeRid,
} from "../src/Identifier/Identifier.model.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** Laws every named schema obeys: generated values are valid, and the wire form loses nothing. */
const lawsOf = <A, I>(name: string, schema: S.Codec<A, I>) => {
  const arbitrary = Arbitrary.schema(schema);
  const isValid = S.is(schema);
  const isEquivalent = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  describe(`${name} laws`, () => {
    it.prop("generated values satisfy the guard", [arbitrary], ([value]) => isValid(value), {
      arbitrary: fcRuns(40),
    });
    it.effect.prop(
      "encoding then decoding gives an equivalent value",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assertTrue(isEquivalent(decoded, value));
      }),
      { arbitrary: fcRuns(40) }
    );
  });
};

/** Decodes an exact wire value to the expected domain value and encodes it back to the same wire value. */
const wireFixture = <A, I>(name: string, schema: S.Codec<A, I>, wire: NoInfer<I>, expected: NoInfer<A>) =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      deepStrictEqual(decoded, expected);
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

/** Pins both sides of a mapped literal domain and checks the codec follows the table in both directions. */
const literalDomain = <A extends string, I extends string>(
  name: string,
  kit: S.Codec<A, I> & { readonly Pairs: ReadonlyArray<readonly [I, A]> },
  pairs: ReadonlyArray<readonly [NoInfer<I>, NoInfer<A>]>
) =>
  it.effect(
    `${name} maps every wire literal to its domain literal and back`,
    Effect.fnUntraced(function* () {
      const decode = S.decodeEffect(kit);
      const encode = S.encodeEffect(kit);
      const wireLiterals = A.map(pairs, ([wire]) => wire);
      const domainLiterals = A.map(pairs, ([, domain]) => domain);
      deepStrictEqual(A.fromIterable(kit.Pairs), A.fromIterable(pairs));
      const decoded = yield* Effect.forEach(wireLiterals, (wire) => decode(wire));
      deepStrictEqual(decoded, domainLiterals);
      const encoded = yield* Effect.forEach(domainLiterals, (domain) => encode(domain));
      deepStrictEqual(encoded, wireLiterals);
    })
  );

/** Asserts that decoding fails and that the failure names the violated rule. */
const assertRejects = <A, I>(schema: S.Codec<A, I>, input: unknown, fragment: string) =>
  assertInclude(
    pipe(
      S.decodeUnknownResult(schema)(input),
      Result.getFailure,
      O.map((error) => error.message),
      O.getOrUndefined
    ),
    fragment
  );

/** Keys a record of fixtures by parameter identifier. */
const byParameter = <Value>(entries: Readonly<Record<string, Value>>) =>
  R.mapKeys(entries, (key) => ParameterId.make(key));

/** Keys a record of fixtures by struct field name. */
const byField = <Value>(entries: Readonly<Record<string, Value>>) =>
  R.mapKeys(entries, (key) => StructFieldApiName.make(key));

const tagOf = <Tagged extends { readonly type: string }>(value: Tagged): Tagged["type"] => value.type;

// -----------------------------------------------------------------------------
// Shared domain values
// -----------------------------------------------------------------------------

const employee = ObjectTypeApiName.make("Employee");
const office = ObjectTypeApiName.make("Office");
const occupants = LinkTypeApiName.make("occupants");
const occupiedOffice = LinkTypeApiName.make("office");
const worker = InterfaceTypeApiName.make("Worker");
const officeId = ParameterId.make("officeId");
const capacity = ParameterId.make("capacity");
const address = ParameterId.make("address");

const cityField = StructParameterField.make({
  name: StructFieldApiName.make("city"),
  fieldType: StringType.make({}),
  required: true,
});
const stateField = StructParameterField.make({
  name: StructFieldApiName.make("state"),
  fieldType: StringType.make({}),
  required: true,
});
const zipcodeField = StructParameterField.make({
  name: StructFieldApiName.make("zipcode"),
  fieldType: IntegerType.make({}),
  required: false,
});

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

lawsOf("OntologyDataTypeKind", OntologyDataTypeKind);
lawsOf("ActionOperationKind", ActionOperationKind);
lawsOf("ObjectEditKind", ObjectEditKind);
lawsOf("BatchObjectEditKind", BatchObjectEditKind);
lawsOf("ActionEditsKind", ActionEditsKind);
lawsOf("EvaluatedConstraintKind", EvaluatedConstraintKind);
lawsOf("StructFieldConstraintKind", StructFieldConstraintKind);
lawsOf("AllowedValuesKind", AllowedValuesKind);
lawsOf("ConstraintBoundKind", ConstraintBoundKind);
lawsOf("DatetimeBoundKind", DatetimeBoundKind);
lawsOf("RelativeDatetimeUnit", RelativeDatetimeUnit);
lawsOf("RelativeDatetimeTense", RelativeDatetimeTense);
lawsOf("ApplyActionMode", ApplyActionMode);
lawsOf("ReturnEditsMode", ReturnEditsMode);
lawsOf("BatchReturnEditsMode", BatchReturnEditsMode);
lawsOf("ValidationResult", ValidationResult);

lawsOf("ObjectParameterType", ObjectParameterType);
lawsOf("ObjectSetParameterType", ObjectSetParameterType);
lawsOf("StructParameterField", StructParameterField);
lawsOf("StructParameterType", StructParameterType);
lawsOf("AnyType", AnyType);
lawsOf("OntologyArrayType", OntologyArrayType);
lawsOf("OntologySetType", OntologySetType);
lawsOf("OntologyMapType", OntologyMapType);
lawsOf("OntologyDataType", OntologyDataType);
lawsOf("ArrayParameterType", ArrayParameterType);
lawsOf("InterfaceObjectParameterType", InterfaceObjectParameterType);
lawsOf("ObjectTypeReferenceType", ObjectTypeReferenceType);
lawsOf("ScenarioReferenceType", ScenarioReferenceType);
lawsOf("ActionParameterType", ActionParameterType);

lawsOf("StaticBound", StaticBound);
lawsOf("ParameterLengthBound", ParameterLengthBound);
lawsOf("ParameterValueBound", ParameterValueBound);
lawsOf("ConstraintBound", ConstraintBound);
lawsOf("NowBound", NowBound);
lawsOf("FixedDatetimeBound", FixedDatetimeBound);
lawsOf("RelativeDatetimeBound", RelativeDatetimeBound);
lawsOf("DatetimeBound", DatetimeBound);
lawsOf("AllowedValueOption", AllowedValueOption);
lawsOf("OneOfAllowedValues", OneOfAllowedValues);
lawsOf("RangeAllowedValues", RangeAllowedValues);
lawsOf("DatetimeAllowedValues", DatetimeAllowedValues);
lawsOf("TextAllowedValues", TextAllowedValues);
lawsOf("MarkdownAllowedValues", MarkdownAllowedValues);
lawsOf("AttachmentAllowedValues", AttachmentAllowedValues);
lawsOf("ValueTypeAllowedValues", ValueTypeAllowedValues);
lawsOf("MustBeEmptyAllowedValues", MustBeEmptyAllowedValues);
lawsOf("AllowedValues", AllowedValues);
lawsOf("ArraySizeBounds", ArraySizeBounds);
lawsOf("ParameterConstraints", ParameterConstraints);
lawsOf("ParameterValidation", ParameterValidation);

lawsOf("ActionParameter", ActionParameter);
lawsOf("CreateObjectOperation", CreateObjectOperation);
lawsOf("ModifyObjectOperation", ModifyObjectOperation);
lawsOf("DeleteObjectOperation", DeleteObjectOperation);
lawsOf("CreateLinkOperation", CreateLinkOperation);
lawsOf("DeleteLinkOperation", DeleteLinkOperation);
lawsOf("CreateInterfaceObjectOperation", CreateInterfaceObjectOperation);
lawsOf("ModifyInterfaceObjectOperation", ModifyInterfaceObjectOperation);
lawsOf("DeleteInterfaceObjectOperation", DeleteInterfaceObjectOperation);
lawsOf("ScenarioLinkScope", ScenarioLinkScope);
lawsOf("ApplyScenarioOperation", ApplyScenarioOperation);
lawsOf("ActionOperation", ActionOperation);
lawsOf("ActionType", ActionType);

lawsOf("ArgumentValue", ArgumentValue);
lawsOf("ActionArguments", ActionArguments);
lawsOf("ApplyActionOptions", ApplyActionOptions);
lawsOf("ApplyActionRequest", ApplyActionRequest);
lawsOf("BatchApplyActionOptions", BatchApplyActionOptions);
lawsOf("BatchApplyActionItem", BatchApplyActionItem);
lawsOf("BatchApplyActionRequest", BatchApplyActionRequest);

lawsOf("EditedObject", EditedObject);
lawsOf("AddedObject", AddedObject);
lawsOf("ModifiedObject", ModifiedObject);
lawsOf("DeletedObject", DeletedObject);
lawsOf("AddedLink", AddedLink);
lawsOf("DeletedLink", DeletedLink);
lawsOf("ObjectEdit", ObjectEdit);
lawsOf("BatchObjectEdit", BatchObjectEdit);
lawsOf("ObjectEdits", ObjectEdits);
lawsOf("BatchObjectEdits", BatchObjectEdits);
lawsOf("LargeScaleEdits", LargeScaleEdits);
lawsOf("ActionEdits", ActionEdits);
lawsOf("BatchActionEdits", BatchActionEdits);

lawsOf("ArraySizeConstraint", ArraySizeConstraint);
lawsOf("GroupMemberConstraint", GroupMemberConstraint);
lawsOf("ObjectPropertyValueConstraint", ObjectPropertyValueConstraint);
lawsOf("ObjectQueryResultConstraint", ObjectQueryResultConstraint);
lawsOf("ParameterOption", ParameterOption);
lawsOf("OneOfConstraint", OneOfConstraint);
lawsOf("RangeConstraint", RangeConstraint);
lawsOf("StringLengthConstraint", StringLengthConstraint);
lawsOf("StringRegexMatchConstraint", StringRegexMatchConstraint);
lawsOf("UnevaluableConstraint", UnevaluableConstraint);
lawsOf("StructFieldConstraint", StructFieldConstraint);
lawsOf("StructFieldEvaluation", StructFieldEvaluation);
lawsOf("StructConstraint", StructConstraint);
lawsOf("ArrayEntryConstraint", ArrayEntryConstraint);
lawsOf("ArrayConstraint", ArrayConstraint);
lawsOf("EvaluatedConstraint", EvaluatedConstraint);
lawsOf("SubmissionCriterion", SubmissionCriterion);
lawsOf("ParameterEvaluation", ParameterEvaluation);
lawsOf("ActionValidation", ActionValidation);
lawsOf("ApplyActionResponse", ApplyActionResponse);
lawsOf("BatchApplyActionResponse", BatchApplyActionResponse);

lawsOf("ActionLogicRuleKind", ActionLogicRuleKind);
lawsOf("LogicRuleArgumentKind", LogicRuleArgumentKind);
lawsOf("StructFieldArgumentKind", StructFieldArgumentKind);
lawsOf("ParameterArgument", ParameterArgument);
lawsOf("StaticArgument", StaticArgument);
lawsOf("ObjectPropertyArgument", ObjectPropertyArgument);
lawsOf("InterfacePropertyArgument", InterfacePropertyArgument);
lawsOf("CurrentUserArgument", CurrentUserArgument);
lawsOf("CurrentTimeArgument", CurrentTimeArgument);
lawsOf("UniqueIdentifierArgument", UniqueIdentifierArgument);
lawsOf("WebhookOutputArgument", WebhookOutputArgument);
lawsOf("LogicRuleArgument", LogicRuleArgument);
lawsOf("StructFieldValueArgument", StructFieldValueArgument);
lawsOf("StructListFieldValueArgument", StructListFieldValueArgument);
lawsOf("StructFieldArgument", StructFieldArgument);
lawsOf("CreateObjectRule", CreateObjectRule);
lawsOf("ModifyObjectRule", ModifyObjectRule);
lawsOf("CreateOrModifyObjectRule", CreateOrModifyObjectRule);
lawsOf("CreateOrModifyObjectParameterRule", CreateOrModifyObjectParameterRule);
lawsOf("DeleteObjectRule", DeleteObjectRule);
lawsOf("CreateLinkRule", CreateLinkRule);
lawsOf("DeleteLinkRule", DeleteLinkRule);
lawsOf("CreateInterfaceRule", CreateInterfaceRule);
lawsOf("ModifyInterfaceRule", ModifyInterfaceRule);
lawsOf("CreateInterfaceLinkRule", CreateInterfaceLinkRule);
lawsOf("DeleteInterfaceLinkRule", DeleteInterfaceLinkRule);
lawsOf("FunctionRule", FunctionRule);
lawsOf("FunctionCall", FunctionCall);
lawsOf("BatchedFunctionRule", BatchedFunctionRule);
lawsOf("ApplyScenarioRule", ApplyScenarioRule);
lawsOf("ActionLogicRule", ActionLogicRule);
lawsOf("ActionTypeDefinition", ActionTypeDefinition);

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

describe("Action literal domains", () => {
  literalDomain("ApplyActionMode", ApplyActionMode, [
    ["VALIDATE_ONLY", "validateOnly"],
    ["VALIDATE_AND_EXECUTE", "validateAndExecute"],
  ]);
  literalDomain("ReturnEditsMode", ReturnEditsMode, [
    ["ALL", "all"],
    ["ALL_V2_WITH_DELETIONS", "allV2WithDeletions"],
    ["NONE", "none"],
  ]);
  literalDomain("BatchReturnEditsMode", BatchReturnEditsMode, [
    ["ALL", "all"],
    ["NONE", "none"],
  ]);
  literalDomain("ValidationResult", ValidationResult, [
    ["VALID", "valid"],
    ["INVALID", "invalid"],
  ]);
  literalDomain("RelativeDatetimeUnit", RelativeDatetimeUnit, [
    ["SECOND", "second"],
    ["MINUTE", "minute"],
    ["HOUR", "hour"],
    ["DAY", "day"],
    ["WEEK", "week"],
  ]);
  literalDomain("RelativeDatetimeTense", RelativeDatetimeTense, [
    ["FUTURE", "future"],
    ["PAST", "past"],
  ]);

  it("pins the tag vocabulary of every action union", () => {
    deepStrictEqual(A.fromIterable(OntologyDataTypeKind.literals), [
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
    ]);
    deepStrictEqual(A.fromIterable(ActionOperationKind.literals), [
      "createObject",
      "modifyObject",
      "deleteObject",
      "createLink",
      "deleteLink",
      "createInterfaceObject",
      "modifyInterfaceObject",
      "deleteInterfaceObject",
      "applyScenario",
    ]);
    deepStrictEqual(A.fromIterable(ObjectEditKind.literals), [
      "addObject",
      "modifyObject",
      "deleteObject",
      "addLink",
      "deleteLink",
    ]);
    deepStrictEqual(A.fromIterable(BatchObjectEditKind.literals), ["addObject", "modifyObject", "addLink"]);
    deepStrictEqual(A.fromIterable(ActionEditsKind.literals), ["edits", "largeScaleEdits"]);
    deepStrictEqual(A.fromIterable(EvaluatedConstraintKind.literals), [
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
    ]);
    deepStrictEqual(A.fromIterable(StructFieldConstraintKind.literals), [
      "objectQueryResult",
      "oneOf",
      "range",
      "stringLength",
      "stringRegexMatch",
    ]);
    deepStrictEqual(A.fromIterable(AllowedValuesKind.literals), [
      "oneOf",
      "range",
      "datetime",
      "text",
      "markdown",
      "attachment",
      "valueType",
      "mustBeEmpty",
    ]);
    deepStrictEqual(A.fromIterable(ConstraintBoundKind.literals), ["static", "parameterLength", "parameterValue"]);
    deepStrictEqual(A.fromIterable(DatetimeBoundKind.literals), ["now", "fixed", "relative"]);
    deepStrictEqual(A.fromIterable(ActionLogicRuleKind.literals), [
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
    ]);
    deepStrictEqual(A.fromIterable(LogicRuleArgumentKind.literals), [
      "parameterId",
      "staticValue",
      "objectParameterPropertyValue",
      "interfaceParameterPropertyValue",
      "currentUser",
      "currentTime",
      "uniqueIdentifier",
      "synchronousWebhookOutput",
    ]);
    deepStrictEqual(A.fromIterable(StructFieldArgumentKind.literals), [
      "structParameterFieldValue",
      "structListParameterFieldValue",
    ]);
  });

  it("matches a domain literal of each mapped enum exhaustively", () => {
    const executes = ApplyActionMode.To.match({ validateOnly: () => false, validateAndExecute: () => true });
    deepStrictEqual(
      A.map(ApplyActionMode.Pairs, ([, mode]) => executes(mode)),
      [false, true]
    );
    const asksForEdits = ReturnEditsMode.To.match({
      all: () => true,
      allV2WithDeletions: () => true,
      none: () => false,
    });
    deepStrictEqual(
      A.map(ReturnEditsMode.Pairs, ([, mode]) => asksForEdits(mode)),
      [true, true, false]
    );
    const batchAsksForEdits = BatchReturnEditsMode.To.match({ all: () => true, none: () => false });
    deepStrictEqual(
      A.map(BatchReturnEditsMode.Pairs, ([, mode]) => batchAsksForEdits(mode)),
      [true, false]
    );
    const isValid = ValidationResult.To.match({ valid: () => true, invalid: () => false });
    deepStrictEqual(
      A.map(ValidationResult.Pairs, ([, result]) => isValid(result)),
      [true, false]
    );
  });

  it("rejects wire literals outside each enum", () => {
    assertRejects(ApplyActionMode, "EXECUTE", "ApplyActionMode");
    assertRejects(ReturnEditsMode, "all", "ReturnEditsMode");
    assertRejects(BatchReturnEditsMode, "ALL_V2_WITH_DELETIONS", "BatchReturnEditsMode");
    assertRejects(ValidationResult, "valid", "ValidationResult");
    assertRejects(RelativeDatetimeUnit, "MONTH", "RelativeDatetimeUnit");
    assertRejects(RelativeDatetimeTense, "PRESENT", "RelativeDatetimeTense");
  });
});

// -----------------------------------------------------------------------------
// Parameter types
// -----------------------------------------------------------------------------

describe("ActionParameterType", () => {
  const cases: ReadonlyArray<ActionParameterType> = [
    ActionParameterType.cases.boolean.make({}),
    ActionParameterType.cases.integer.make({}),
    ActionParameterType.cases.long.make({}),
    ActionParameterType.cases.double.make({}),
    ActionParameterType.cases.decimal.make({}),
    ActionParameterType.cases.string.make({}),
    ActionParameterType.cases.date.make({}),
    ActionParameterType.cases.timestamp.make({}),
    ActionParameterType.cases.marking.make({}),
    ActionParameterType.cases.attachment.make({}),
    ActionParameterType.cases.mediaReference.make({}),
    ActionParameterType.cases.geoshape.make({}),
    ActionParameterType.cases.geohash.make({}),
    ActionParameterType.cases.timeSeriesReference.make({}),
    ActionParameterType.cases.vector.make({ dimension: 3 }),
    ActionParameterType.cases.array.make({ elementType: StringType.make({}) }),
    ActionParameterType.cases.struct.make({ fields: [cityField] }),
    ActionParameterType.cases.object.make({ objectApiName: employee, objectTypeApiName: employee }),
    ActionParameterType.cases.objectSet.make({}),
    ActionParameterType.cases.interfaceObject.make({}),
    ActionParameterType.cases.objectType.make({}),
    ActionParameterType.cases.scenarioReference.make({}),
  ];

  it("constructs every case and matches it exhaustively, in the order of the tag vocabulary", () => {
    const tag = ActionParameterType.match({
      boolean: tagOf,
      integer: tagOf,
      long: tagOf,
      double: tagOf,
      decimal: tagOf,
      string: tagOf,
      date: tagOf,
      timestamp: tagOf,
      marking: tagOf,
      attachment: tagOf,
      mediaReference: tagOf,
      geoshape: tagOf,
      geohash: tagOf,
      timeSeriesReference: tagOf,
      vector: tagOf,
      array: tagOf,
      struct: tagOf,
      object: tagOf,
      objectSet: tagOf,
      interfaceObject: tagOf,
      objectType: tagOf,
      scenarioReference: tagOf,
    });
    deepStrictEqual(A.map(cases, tag), A.fromIterable(ActionParameterTypeKind.literals));
    assertTrue(A.every(cases, S.is(ActionParameterType)));
    assertTrue(ActionParameterType.guards.array(ArrayParameterType.make({ elementType: StringType.make({}) })));
    assertFalse(ActionParameterType.isAnyOf(["object", "objectSet"])(StringType.make({})));
  });

  wireFixture(
    "a list of lists keeps both levels, with subType renamed to elementType",
    ActionParameterType,
    { type: "array", subType: { type: "array", subType: { type: "string" } } },
    ArrayParameterType.make({ elementType: ArrayParameterType.make({ elementType: StringType.make({}) }) })
  );

  wireFixture(
    "an object parameter keeps both spellings of its object type",
    ActionParameterType,
    { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
    ObjectParameterType.make({ objectApiName: employee, objectTypeApiName: employee })
  );

  wireFixture(
    "an object set parameter may name no object type at all",
    ActionParameterType,
    { type: "objectSet" },
    ObjectSetParameterType.make({})
  );

  wireFixture(
    "an object set parameter may name its object type",
    ActionParameterType,
    { type: "objectSet", objectApiName: "Employee", objectTypeApiName: "Employee" },
    ObjectSetParameterType.make({ objectApiName: O.some(employee), objectTypeApiName: O.some(employee) })
  );

  wireFixture(
    "an interface object parameter names the interface",
    ActionParameterType,
    { type: "interfaceObject", interfaceTypeApiName: "Worker" },
    InterfaceObjectParameterType.make({ interfaceTypeApiName: O.some(worker) })
  );

  wireFixture(
    "a decimal parameter keeps its precision and scale",
    ActionParameterType,
    { type: "decimal", precision: 10, scale: 2 },
    ActionParameterType.cases.decimal.make({ precision: O.some(10), scale: O.some(2) })
  );

  wireFixture(
    "a marking parameter keeps its marking subtype",
    ActionParameterType,
    { type: "marking", markingType: "MANDATORY" },
    ActionParameterType.cases.marking.make({ markingType: O.some("mandatory") })
  );

  wireFixture(
    "a vector parameter keeps its dimension and similarity functions",
    ActionParameterType,
    { type: "vector", dimension: 3, supportsSearchWith: [{ value: "COSINE_SIMILARITY" }] },
    ActionParameterType.cases.vector.make({ dimension: 3, supportsSearchWith: ["cosine"] })
  );

  wireFixture(
    "a struct parameter keeps nested and collection field types",
    ActionParameterType,
    {
      type: "struct",
      fields: [
        { name: "city", fieldType: { type: "string" }, required: true },
        { name: "aliases", fieldType: { type: "array", itemType: { type: "string" } }, required: false },
        { name: "tags", fieldType: { type: "set", itemType: { type: "string" } }, required: false },
        {
          name: "scores",
          fieldType: { type: "map", keyType: { type: "string" }, valueType: { type: "double" } },
          required: false,
        },
        {
          name: "geo",
          fieldType: { type: "struct", fields: [{ name: "zipcode", fieldType: { type: "integer" }, required: false }] },
          required: false,
        },
        {
          name: "owner",
          fieldType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
          required: false,
        },
        { name: "extra", fieldType: { type: "any" }, required: false },
      ],
    },
    StructParameterType.make({
      fields: [
        cityField,
        StructParameterField.make({
          name: StructFieldApiName.make("aliases"),
          fieldType: OntologyArrayType.make({ elementType: StringType.make({}) }),
          required: false,
        }),
        StructParameterField.make({
          name: StructFieldApiName.make("tags"),
          fieldType: OntologySetType.make({ elementType: StringType.make({}) }),
          required: false,
        }),
        StructParameterField.make({
          name: StructFieldApiName.make("scores"),
          fieldType: OntologyMapType.make({ keyType: StringType.make({}), valueType: DoubleType.make({}) }),
          required: false,
        }),
        StructParameterField.make({
          name: StructFieldApiName.make("geo"),
          fieldType: StructParameterType.make({ fields: [zipcodeField] }),
          required: false,
        }),
        StructParameterField.make({
          name: StructFieldApiName.make("owner"),
          fieldType: ObjectParameterType.make({ objectApiName: employee, objectTypeApiName: employee }),
          required: false,
        }),
        StructParameterField.make({
          name: StructFieldApiName.make("extra"),
          fieldType: AnyType.make({}),
          required: false,
        }),
      ],
    })
  );

  it("rejects what the wire does not allow", () => {
    assertRejects(ActionParameterType, { type: "unsupportedType" }, "ActionParameterType");
    assertRejects(ActionParameterType, { type: "geopoint" }, "ActionParameterType");
    assertRejects(ActionParameterType, { type: "array" }, "subType");
    assertRejects(ActionParameterType, { type: "array", elementType: { type: "string" } }, "subType");
    assertRejects(ActionParameterType, { type: "object", objectApiName: "Employee" }, "objectTypeApiName");
    assertRejects(ActionParameterType, { type: "interfaceObject", interfaceTypeApiName: "" }, "interfaceTypeApiName");
    assertRejects(
      ActionParameterType,
      { type: "struct", fields: [{ name: "city", fieldType: { type: "geohash" }, required: true }] },
      "fieldType"
    );
    assertRejects(
      ActionParameterType,
      { type: "struct", fields: [{ name: "city", fieldType: { type: "string" } }] },
      "required"
    );
  });
});

describe("OntologyDataType", () => {
  const cases: ReadonlyArray<OntologyDataType> = [
    OntologyDataType.cases.boolean.make({}),
    OntologyDataType.cases.byte.make({}),
    OntologyDataType.cases.short.make({}),
    OntologyDataType.cases.integer.make({}),
    OntologyDataType.cases.long.make({}),
    OntologyDataType.cases.float.make({}),
    OntologyDataType.cases.double.make({}),
    OntologyDataType.cases.decimal.make({}),
    OntologyDataType.cases.string.make({}),
    OntologyDataType.cases.date.make({}),
    OntologyDataType.cases.timestamp.make({}),
    OntologyDataType.cases.binary.make({}),
    OntologyDataType.cases.marking.make({}),
    OntologyDataType.cases.cipherText.make({}),
    OntologyDataType.cases.mediaReference.make({}),
    OntologyDataType.cases.array.make({ elementType: StringType.make({}) }),
    OntologyDataType.cases.set.make({ elementType: StringType.make({}) }),
    OntologyDataType.cases.map.make({ keyType: StringType.make({}), valueType: DoubleType.make({}) }),
    OntologyDataType.cases.struct.make({ fields: [cityField, stateField, zipcodeField] }),
    OntologyDataType.cases.object.make({ objectApiName: employee, objectTypeApiName: employee }),
    OntologyDataType.cases.objectSet.make({}),
    OntologyDataType.cases.any.make({}),
    OntologyDataType.cases.unsupported.make({ unsupportedType: "tensor" }),
  ];

  it("constructs every case and matches it exhaustively, in the order of the tag vocabulary", () => {
    const tag = OntologyDataType.match({
      boolean: tagOf,
      byte: tagOf,
      short: tagOf,
      integer: tagOf,
      long: tagOf,
      float: tagOf,
      double: tagOf,
      decimal: tagOf,
      string: tagOf,
      date: tagOf,
      timestamp: tagOf,
      binary: tagOf,
      marking: tagOf,
      cipherText: tagOf,
      mediaReference: tagOf,
      array: tagOf,
      set: tagOf,
      map: tagOf,
      struct: tagOf,
      object: tagOf,
      objectSet: tagOf,
      any: tagOf,
      unsupported: tagOf,
    });
    deepStrictEqual(A.map(cases, tag), A.fromIterable(OntologyDataTypeKind.literals));
    assertTrue(A.every(cases, S.is(OntologyDataType)));
    assertTrue(
      OntologyDataType.guards.map(
        OntologyDataType.cases.map.make({ keyType: StringType.make({}), valueType: StringType.make({}) })
      )
    );
  });

  wireFixture(
    "a list field type renames itemType to elementType",
    OntologyDataType,
    { type: "array", itemType: { type: "set", itemType: { type: "long" } } },
    OntologyArrayType.make({ elementType: OntologySetType.make({ elementType: OntologyDataType.cases.long.make({}) }) })
  );

  it("rejects tags that belong to parameters only, and collections without an element type", () => {
    assertRejects(OntologyDataType, { type: "attachment" }, "OntologyDataType");
    assertRejects(OntologyDataType, { type: "scenarioReference" }, "OntologyDataType");
    assertRejects(OntologyDataType, { type: "array", subType: { type: "string" } }, "itemType");
    assertRejects(OntologyDataType, { type: "map", keyType: { type: "string" } }, "valueType");
  });
});

// -----------------------------------------------------------------------------
// Configured validation
// -----------------------------------------------------------------------------

describe("Configured parameter validation", () => {
  const budget = ParameterId.make("budget");
  const invitees = ParameterId.make("invitees");

  it("constructs every bound and allowed-values case and matches them exhaustively", () => {
    const bounds = [
      ConstraintBound.cases.static.make({ value: 10 }),
      ConstraintBound.cases.parameterLength.make({ parameterId: invitees }),
      ConstraintBound.cases.parameterValue.make({ parameterId: budget }),
    ];
    const boundTag = ConstraintBound.match({ static: tagOf, parameterLength: tagOf, parameterValue: tagOf });
    deepStrictEqual(A.map(bounds, boundTag), A.fromIterable(ConstraintBoundKind.literals));

    const datetimeBounds = [
      DatetimeBound.cases.now.make({}),
      DatetimeBound.cases.fixed.make({ value: StaticBound.make({ value: "2026-01-01" }) }),
      DatetimeBound.cases.relative.make({ duration: "2", unit: "week", tense: "future" }),
    ];
    const datetimeTag = DatetimeBound.match({ now: tagOf, fixed: tagOf, relative: tagOf });
    deepStrictEqual(A.map(datetimeBounds, datetimeTag), A.fromIterable(DatetimeBoundKind.literals));

    const rules = [
      AllowedValues.cases.oneOf.make({
        options: [AllowedValueOption.make({ displayName: "New York", value: "NYC" })],
        otherValuesAllowed: false,
      }),
      AllowedValues.cases.range.make({ gte: O.some(StaticBound.make({ value: 0 })) }),
      AllowedValues.cases.datetime.make({ lt: O.some(NowBound.make({})) }),
      AllowedValues.cases.text.make({ regex: O.some("^[A-Z]") }),
      AllowedValues.cases.markdown.make({ lte: O.some(4000) }),
      AllowedValues.cases.attachment.make({}),
      AllowedValues.cases.valueType.make({
        apiName: ValueTypeApiName.make("emailAddress"),
        rid: ValueTypeRid.make("ri.ontology.main.value-type.email"),
        versionId: "3",
      }),
      AllowedValues.cases.mustBeEmpty.make({}),
    ];
    const ruleTag = AllowedValues.match({
      oneOf: tagOf,
      range: tagOf,
      datetime: tagOf,
      text: tagOf,
      markdown: tagOf,
      attachment: tagOf,
      valueType: tagOf,
      mustBeEmpty: tagOf,
    });
    deepStrictEqual(A.map(rules, ruleTag), A.fromIterable(AllowedValuesKind.literals));
    assertTrue(AllowedValues.guards.mustBeEmpty(MustBeEmptyAllowedValues.make({})));
    assertTrue(DatetimeBound.isAnyOf(["now", "relative"])(NowBound.make({})));
  });

  wireFixture(
    "a one-of rule keeps its labelled options",
    ParameterValidation,
    {
      defaultValidation: {
        allowedValues: {
          type: "oneOf",
          options: [
            { displayName: "New York", value: "NYC" },
            { displayName: "Unassigned", value: null },
          ],
          otherValuesAllowed: true,
        },
      },
    },
    ParameterValidation.make({
      defaultValidation: ParameterConstraints.make({
        allowedValues: O.some(
          OneOfAllowedValues.make({
            options: [
              AllowedValueOption.make({ displayName: "New York", value: "NYC" }),
              AllowedValueOption.make({ displayName: "Unassigned", value: null }),
            ],
            otherValuesAllowed: true,
          })
        ),
      }),
    })
  );

  wireFixture(
    "a range rule may take its bounds from a literal, another parameter or a list's length",
    ParameterValidation,
    {
      defaultValidation: {
        allowedValues: {
          type: "range",
          gt: { type: "static", value: 0 },
          lte: { type: "parameterValue", parameterId: "budget" },
          lt: { type: "parameterLength", parameterId: "invitees" },
        },
        arraySize: { gte: 1, lte: 20 },
      },
    },
    ParameterValidation.make({
      defaultValidation: ParameterConstraints.make({
        allowedValues: O.some(
          RangeAllowedValues.make({
            gt: O.some(StaticBound.make({ value: 0 })),
            lte: O.some(ParameterValueBound.make({ parameterId: budget })),
            lt: O.some(ParameterLengthBound.make({ parameterId: invitees })),
          })
        ),
        arraySize: O.some(ArraySizeBounds.make({ gte: O.some(1), lte: O.some(20) })),
      }),
    })
  );

  wireFixture(
    "a datetime rule mixes now, fixed and relative bounds",
    ParameterValidation,
    {
      defaultValidation: {
        allowedValues: {
          type: "datetime",
          gte: { type: "relative", duration: "30", unit: "DAY", tense: "PAST" },
          lt: { type: "now" },
          lte: { type: "fixed", value: { type: "static", value: "2030-01-01T00:00:00Z" } },
        },
      },
    },
    ParameterValidation.make({
      defaultValidation: ParameterConstraints.make({
        allowedValues: O.some(
          DatetimeAllowedValues.make({
            gte: O.some(RelativeDatetimeBound.make({ duration: "30", unit: "day", tense: "past" })),
            lt: O.some(NowBound.make({})),
            lte: O.some(FixedDatetimeBound.make({ value: StaticBound.make({ value: "2030-01-01T00:00:00Z" }) })),
          })
        ),
      }),
    })
  );

  wireFixture(
    "a text rule keeps length bounds, regex and failure message",
    AllowedValues,
    { type: "text", gte: 1, lte: 64, regex: "^[A-Z]", configuredFailureMessage: "Start with a capital" },
    TextAllowedValues.make({
      gte: O.some(1),
      lte: O.some(64),
      regex: O.some("^[A-Z]"),
      configuredFailureMessage: O.some("Start with a capital"),
    })
  );

  wireFixture(
    "a markdown rule keeps its length bounds",
    AllowedValues,
    { type: "markdown", lte: 4000 },
    MarkdownAllowedValues.make({ lte: O.some(4000) })
  );

  wireFixture(
    "an attachment rule reads its size limit from the wire string",
    AllowedValues,
    { type: "attachment", maxSizeBytes: "1048576" },
    AttachmentAllowedValues.make({ maxSizeBytes: O.some(SizeBytes.make(BigInt(1048576))) })
  );

  wireFixture(
    "a value type rule names one version of a value type",
    AllowedValues,
    { type: "valueType", apiName: "emailAddress", rid: "ri.ontology.main.value-type.email", versionId: "3" },
    ValueTypeAllowedValues.make({
      apiName: ValueTypeApiName.make("emailAddress"),
      rid: ValueTypeRid.make("ri.ontology.main.value-type.email"),
      versionId: "3",
    })
  );

  wireFixture(
    "a must-be-empty rule carries nothing",
    AllowedValues,
    { type: "mustBeEmpty" },
    MustBeEmptyAllowedValues.make({})
  );

  it("rejects malformed rules", () => {
    assertRejects(AllowedValues, { type: "oneOf", options: [] }, "otherValuesAllowed");
    assertRejects(AllowedValues, { type: "range", gt: 0 }, "gt");
    assertRejects(AllowedValues, { type: "attachment", maxSizeBytes: "-1" }, "maxSizeBytes");
    assertRejects(
      AllowedValues,
      { type: "valueType", apiName: "email", rid: "ri.a.b.c.d", versionId: "" },
      "versionId"
    );
    assertRejects(DatetimeBound, { type: "relative", duration: "1", unit: "MONTH", tense: "PAST" }, "unit");
    assertRejects(DatetimeBound, { type: "yesterday" }, "DatetimeBound");
    assertRejects(ConstraintBound, { type: "static" }, "value");
    assertRejects(ConstraintBound, { type: "parameterValue", parameterId: "" }, "parameterId");
  });
});

// -----------------------------------------------------------------------------
// Action types: parity fixtures from osdk-ts shared.test stubs/actionTypes.ts
// -----------------------------------------------------------------------------

describe("ActionType", () => {
  wireFixture(
    "PromoteEmployeeObject: an action with an object parameter",
    ActionType,
    {
      apiName: "promoteEmployeeObject",
      description: "Update an employee's title and compensation",
      parameters: {
        employee: {
          displayName: "Employee",
          dataType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
          required: true,
          typeClasses: [],
        },
        newTitle: { displayName: "New Title", dataType: { type: "string" }, required: true, typeClasses: [] },
        newCompensation: {
          displayName: "New Compensation",
          dataType: { type: "double" },
          required: true,
          typeClasses: [],
        },
      },
      rid: "ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168",
      operations: [{ type: "modifyObject", objectTypeApiName: "Employee" }],
      status: "ACTIVE",
    },
    ActionType.make({
      apiName: ActionTypeApiName.make("promoteEmployeeObject"),
      description: O.some("Update an employee's title and compensation"),
      parameters: byParameter({
        employee: ActionParameter.make({
          displayName: "Employee",
          dataType: ObjectParameterType.make({ objectApiName: employee, objectTypeApiName: employee }),
          required: true,
        }),
        newTitle: ActionParameter.make({ displayName: "New Title", dataType: StringType.make({}), required: true }),
        newCompensation: ActionParameter.make({
          displayName: "New Compensation",
          dataType: DoubleType.make({}),
          required: true,
        }),
      }),
      rid: ActionTypeRid.make("ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168"),
      operations: [ModifyObjectOperation.make({ objectTypeApiName: employee })],
      status: "active",
    })
  );

  wireFixture(
    "ActionTakesStruct: an action with a struct parameter",
    ActionType,
    {
      apiName: "createStructPerson",
      description: "Create a struct",
      parameters: {
        name: { displayName: "Name", dataType: { type: "string" }, required: true, typeClasses: [] },
        address: {
          displayName: "Address",
          dataType: {
            type: "struct",
            fields: [
              { name: "city", fieldType: { type: "string" }, required: true },
              { name: "state", fieldType: { type: "string" }, required: true },
              { name: "zipcode", fieldType: { type: "integer" }, required: false },
            ],
          },
          required: false,
          typeClasses: [],
        },
      },
      rid: "ri.ontology.main.action-type.9f24017d-cf17-4fa8-84c3-8e01e5d594f2",
      operations: [],
      status: "ACTIVE",
    },
    ActionType.make({
      apiName: ActionTypeApiName.make("createStructPerson"),
      description: O.some("Create a struct"),
      parameters: byParameter({
        name: ActionParameter.make({ displayName: "Name", dataType: StringType.make({}), required: true }),
        address: ActionParameter.make({
          displayName: "Address",
          dataType: StructParameterType.make({ fields: [cityField, stateField, zipcodeField] }),
          required: false,
        }),
      }),
      rid: ActionTypeRid.make("ri.ontology.main.action-type.9f24017d-cf17-4fa8-84c3-8e01e5d594f2"),
      operations: [],
      status: "active",
    })
  );

  wireFixture(
    "ActionTakesAttachment: an action with an attachment parameter",
    ActionType,
    {
      apiName: "actionTakesAttachment",
      description: "An action which takes an attachment",
      parameters: {
        attachment: { displayName: "Attachment", dataType: { type: "attachment" }, required: true, typeClasses: [] },
      },
      rid: "ri.ontology.main.action-type.9f84017d-cf17-4fa8-84c3-8e01e5d594f3",
      operations: [],
      status: "ACTIVE",
    },
    ActionType.make({
      apiName: ActionTypeApiName.make("actionTakesAttachment"),
      description: O.some("An action which takes an attachment"),
      parameters: byParameter({
        attachment: ActionParameter.make({
          displayName: "Attachment",
          dataType: ActionParameterType.cases.attachment.make({}),
          required: true,
        }),
      }),
      rid: ActionTypeRid.make("ri.ontology.main.action-type.9f84017d-cf17-4fa8-84c3-8e01e5d594f3"),
      operations: [],
      status: "active",
    })
  );

  it.effect(
    "keeps display name, tool description, type classes and configured validation",
    Effect.fnUntraced(function* () {
      const wire: (typeof ActionType)["Encoded"] = {
        apiName: "scheduleMeeting",
        displayName: "Schedule meeting",
        toolDescription: "Books a meeting room for a list of invitees.",
        parameters: {
          invitees: {
            displayName: "Invitees",
            description: "Who to invite",
            dataType: { type: "array", subType: { type: "string" } },
            required: true,
            typeClasses: [{ kind: "render_hint", name: "USER_PICKER" }],
            validation: { defaultValidation: { arraySize: { gte: 1, lte: 20 } } },
          },
        },
        rid: "ri.ontology.main.action-type.schedule-meeting",
        operations: [],
        status: "EXPERIMENTAL",
      };
      const decoded = yield* S.decodeEffect(ActionType)(wire);
      assertSome(decoded.displayName, "Schedule meeting");
      assertSome(decoded.toolDescription, "Books a meeting room for a list of invitees.");
      strictEqual(decoded.status, "experimental");
      const invitees = yield* Effect.fromOption(R.get(decoded.parameters, ParameterId.make("invitees")));
      assertSome(invitees.description, "Who to invite");
      deepStrictEqual(
        A.map(invitees.typeClasses, (hint) => hint.name),
        ["USER_PICKER"]
      );
      assertSome(
        O.flatMap(invitees.validation, (validation) => validation.defaultValidation.arraySize),
        ArraySizeBounds.make({ gte: O.some(1), lte: O.some(20) })
      );
      const encoded = yield* S.encodeEffect(ActionType)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "defaults absent type classes on decode and constructs a parameter from what matters",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(ActionParameter)({
        displayName: "New Title",
        dataType: { type: "string" },
        required: false,
      });
      const made = ActionParameter.make({ displayName: "New Title", dataType: StringType.make({}), required: false });
      deepStrictEqual(decoded, made);
      assertNone(made.description);
      assertNone(made.validation);
      strictEqual(made.typeClasses.length, 0);
      const encoded = yield* S.encodeEffect(ActionParameter)(made);
      deepStrictEqual(encoded, {
        displayName: "New Title",
        dataType: { type: "string" },
        required: false,
        typeClasses: [],
      });
    })
  );

  it("constructs every operation and matches it exhaustively", () => {
    const createOffice = ActionOperation.cases.createObject.make({ objectTypeApiName: office });
    const applyScenario = ActionOperation.cases.applyScenario.make({
      scenarioParameter: ParameterId.make("scenario"),
      objectTypeApiNames: [office],
      linkTypes: [ScenarioLinkScope.make({ objectTypeApiName: office, linkTypes: [occupants] })],
    });
    const operations = [
      createOffice,
      ActionOperation.cases.modifyObject.make({ objectTypeApiName: employee }),
      ActionOperation.cases.deleteObject.make({ objectTypeApiName: office }),
      ActionOperation.cases.createLink.make({
        linkTypeApiNameAtoB: occupants,
        linkTypeApiNameBtoA: occupiedOffice,
        aSideObjectTypeApiName: office,
        bSideObjectTypeApiName: employee,
      }),
      ActionOperation.cases.deleteLink.make({
        linkTypeApiNameAtoB: occupants,
        linkTypeApiNameBtoA: occupiedOffice,
        aSideObjectTypeApiName: office,
        bSideObjectTypeApiName: employee,
      }),
      ActionOperation.cases.createInterfaceObject.make({ interfaceTypeApiName: worker }),
      ActionOperation.cases.modifyInterfaceObject.make({ interfaceTypeApiName: worker }),
      ActionOperation.cases.deleteInterfaceObject.make({ interfaceTypeApiName: worker }),
      applyScenario,
    ];
    const tag = ActionOperation.match({
      createObject: tagOf,
      modifyObject: tagOf,
      deleteObject: tagOf,
      createLink: tagOf,
      deleteLink: tagOf,
      createInterfaceObject: tagOf,
      modifyInterfaceObject: tagOf,
      deleteInterfaceObject: tagOf,
      applyScenario: tagOf,
    });
    deepStrictEqual(A.map(operations, tag), A.fromIterable(ActionOperationKind.literals));
    assertTrue(ActionOperation.guards.applyScenario(applyScenario));
    assertFalse(ActionOperation.isAnyOf(["createLink", "deleteLink"])(createOffice));
  });

  wireFixture(
    "every operation kind travels in its wire shape",
    S.Array(ActionOperation),
    [
      { type: "createObject", objectTypeApiName: "Office" },
      { type: "modifyObject", objectTypeApiName: "Employee" },
      { type: "deleteObject", objectTypeApiName: "Office" },
      {
        type: "createLink",
        linkTypeApiNameAtoB: "occupants",
        linkTypeApiNameBtoA: "office",
        aSideObjectTypeApiName: "Office",
        bSideObjectTypeApiName: "Employee",
      },
      {
        type: "deleteLink",
        linkTypeApiNameAtoB: "occupants",
        linkTypeApiNameBtoA: "office",
        aSideObjectTypeApiName: "Office",
        bSideObjectTypeApiName: "Employee",
      },
      { type: "createInterfaceObject", interfaceTypeApiName: "Worker" },
      { type: "modifyInterfaceObject", interfaceTypeApiName: "Worker" },
      { type: "deleteInterfaceObject", interfaceTypeApiName: "Worker" },
      {
        type: "applyScenario",
        scenarioParameter: "scenario",
        objectTypeApiNames: ["Office"],
        linkTypes: [{ objectTypeApiName: "Office", linkTypes: ["occupants"] }],
      },
    ],
    [
      CreateObjectOperation.make({ objectTypeApiName: office }),
      ModifyObjectOperation.make({ objectTypeApiName: employee }),
      DeleteObjectOperation.make({ objectTypeApiName: office }),
      CreateLinkOperation.make({
        linkTypeApiNameAtoB: occupants,
        linkTypeApiNameBtoA: occupiedOffice,
        aSideObjectTypeApiName: office,
        bSideObjectTypeApiName: employee,
      }),
      DeleteLinkOperation.make({
        linkTypeApiNameAtoB: occupants,
        linkTypeApiNameBtoA: occupiedOffice,
        aSideObjectTypeApiName: office,
        bSideObjectTypeApiName: employee,
      }),
      CreateInterfaceObjectOperation.make({ interfaceTypeApiName: worker }),
      ModifyInterfaceObjectOperation.make({ interfaceTypeApiName: worker }),
      DeleteInterfaceObjectOperation.make({ interfaceTypeApiName: worker }),
      ApplyScenarioOperation.make({
        scenarioParameter: ParameterId.make("scenario"),
        objectTypeApiNames: [office],
        linkTypes: [ScenarioLinkScope.make({ objectTypeApiName: office, linkTypes: [occupants] })],
      }),
    ]
  );

  it("rejects an action type whose parameter has a type tag the contract does not know", () => {
    // ActionTypeWithUnsupportedTypes from the same stubs: OSDK erases the parameter, this codec refuses to guess.
    assertRejects(
      ActionType,
      {
        apiName: "unsupportedAction",
        description: "An unsupported action type",
        parameters: {
          unsupportedProperty: {
            displayName: "Unsupported Property",
            dataType: { type: "unsupportedType" },
            required: false,
            typeClasses: [],
          },
        },
        rid: "ri.ontology.main.action-type.9f84017d-cf17-4fa8-84c3-8e01e5d594f2",
        operations: [],
        status: "ACTIVE",
      },
      "unsupportedProperty"
    );
  });

  it("rejects malformed action types", () => {
    const valid = {
      apiName: "promoteEmployee",
      parameters: {},
      rid: "ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168",
      operations: [],
      status: "ACTIVE",
    };
    assertTrue(S.is(S.toEncoded(ActionType))(valid));
    assertRejects(ActionType, { ...valid, apiName: "" }, "apiName");
    assertRejects(ActionType, { ...valid, status: "active" }, "status");
    assertRejects(ActionType, { ...valid, operations: [{ type: "createOrModifyObject" }] }, "operations");
    assertRejects(
      ActionType,
      { ...valid, parameters: { title: { displayName: "Title", dataType: { type: "string" }, typeClasses: [] } } },
      "required"
    );
    assertRejects(
      ActionType,
      { ...valid, parameters: { title: { displayName: "Title", dataType: { type: "string" }, required: "yes" } } },
      "required"
    );
  });
});

// -----------------------------------------------------------------------------
// Requests: parity fixtures from osdk-ts shared.test stubs/actions.ts
// -----------------------------------------------------------------------------

describe("Requests", () => {
  wireFixture(
    "actionRequestCreateOffice: every argument is set and edits are requested",
    ApplyActionRequest,
    {
      parameters: { officeId: "NYC", address: "123 Main Street", capacity: 100 },
      options: { mode: "VALIDATE_AND_EXECUTE", returnEdits: "ALL_V2_WITH_DELETIONS" },
    },
    ApplyActionRequest.make({
      parameters: {
        [officeId]: O.some("NYC"),
        [address]: O.some("123 Main Street"),
        [capacity]: O.some(100),
      },
      options: ApplyActionOptions.make({ returnEdits: "allV2WithDeletions" }),
    })
  );

  wireFixture(
    "actionRequestWithStructAcceptNull: a null nested inside a struct value is data, not an intent",
    ApplyActionRequest,
    {
      options: { mode: "VALIDATE_AND_EXECUTE", returnEdits: "NONE" },
      parameters: { name: "testMan", address: { city: "NYC", state: "NY", zipcode: null } },
    },
    ApplyActionRequest.make({
      parameters: {
        [ParameterId.make("name")]: O.some("testMan"),
        [address]: O.some({ city: "NYC", state: "NY", zipcode: null }),
      },
    })
  );

  wireFixture(
    "a null argument clears the parameter and an absent one leaves it untouched",
    ApplyActionRequest,
    {
      parameters: { officeId: "NYC", capacity: null },
      options: { mode: "VALIDATE_ONLY", returnEdits: "NONE" },
    },
    ApplyActionRequest.make({
      parameters: { [officeId]: O.some("NYC"), [capacity]: O.none() },
      options: ApplyActionOptions.make({ mode: "validateOnly" }),
    })
  );

  it.effect(
    "decoding separates the three intents of an argument",
    Effect.fnUntraced(function* () {
      const wire = { officeId: "NYC", capacity: null };
      const decoded = yield* S.decodeEffect(ActionArguments)(wire);
      assertSome(R.get(decoded, officeId), O.some("NYC"));
      assertSome(R.get(decoded, capacity), O.none());
      assertNone(R.get(decoded, address));
      const encoded = yield* S.encodeEffect(ActionArguments)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "encoding writes null for none, the value for some, and no key for an absent argument",
    Effect.fnUntraced(function* () {
      const domain: ActionArguments = {
        [officeId]: O.some("NYC"),
        [capacity]: O.none(),
      };
      const encoded = yield* S.encodeEffect(ActionArguments)(domain);
      deepStrictEqual(encoded, { officeId: "NYC", capacity: null });
      assertTrue(R.has(encoded, "capacity"));
      assertFalse(R.has(encoded, "address"));
      const decoded = yield* S.decodeEffect(ActionArguments)(encoded);
      assertTrue(S.toEquivalence(ActionArguments)(decoded, domain));
    })
  );

  it("an argument value is any JSON except a top-level null", () => {
    const isValue = S.is(ArgumentValue);
    assertTrue(A.every(["Call me Ishmael", 238940, true, ["alpha", null], { name: "John Doe", age: null }], isValue));
    assertFalse(isValue(null));
    assertRejects(ArgumentValue, null, "ArgumentValue");
    assertRejects(ActionArguments, { officeId: Number.NaN }, "officeId");
    assertRejects(ActionArguments, { officeId: { nested: Number.POSITIVE_INFINITY } }, "officeId");
  });

  it.effect(
    "a key that is not a parameter identifier is dropped like any unknown key",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(ActionArguments)({ "": "NYC", capacity: 100 });
      deepStrictEqual(decoded, { [capacity]: O.some(100) });
    })
  );

  it.effect(
    "options default to the documented values when constructed, when decoded, and encode explicitly",
    Effect.fnUntraced(function* () {
      const constructed = ApplyActionOptions.make({});
      strictEqual(constructed.mode, "validateAndExecute");
      strictEqual(constructed.returnEdits, "none");

      const decodedOptions = yield* S.decodeEffect(ApplyActionOptions)({});
      deepStrictEqual(decodedOptions, constructed);
      const partial = yield* S.decodeEffect(ApplyActionOptions)({ mode: "VALIDATE_ONLY" });
      deepStrictEqual(partial, ApplyActionOptions.make({ mode: "validateOnly" }));

      const request = yield* S.decodeEffect(ApplyActionRequest)({ parameters: {} });
      deepStrictEqual(request, ApplyActionRequest.make({ parameters: {} }));
      const encoded = yield* S.encodeEffect(ApplyActionRequest)(request);
      deepStrictEqual(encoded, {
        parameters: {},
        options: { mode: "VALIDATE_AND_EXECUTE", returnEdits: "NONE" },
      });
    })
  );

  wireFixture(
    "a batch request carries one argument record per application",
    BatchApplyActionRequest,
    {
      requests: [
        { parameters: { officeId: "NYC", capacity: 100 } },
        { parameters: { officeId: "SEA", capacity: null } },
      ],
      options: { returnEdits: "ALL" },
    },
    BatchApplyActionRequest.make({
      requests: [
        BatchApplyActionItem.make({ parameters: { [officeId]: O.some("NYC"), [capacity]: O.some(100) } }),
        BatchApplyActionItem.make({ parameters: { [officeId]: O.some("SEA"), [capacity]: O.none() } }),
      ],
      options: BatchApplyActionOptions.make({ returnEdits: "all" }),
    })
  );

  it.effect(
    "batch options default to returning no edits and cannot ask for deletions",
    Effect.fnUntraced(function* () {
      strictEqual(BatchApplyActionOptions.make({}).returnEdits, "none");
      const request = yield* S.decodeEffect(BatchApplyActionRequest)({ requests: [] });
      deepStrictEqual(request, BatchApplyActionRequest.make({ requests: [] }));
      const encoded = yield* S.encodeEffect(BatchApplyActionRequest)(request);
      deepStrictEqual(encoded, {
        requests: [],
        options: { returnEdits: "NONE" },
      });
      assertRejects(
        BatchApplyActionRequest,
        { requests: [], options: { returnEdits: "ALL_V2_WITH_DELETIONS" } },
        "returnEdits"
      );
      // A batch has no apply mode: the key is unknown to the batch options and is dropped on decode.
      const withMode = yield* S.decodeUnknownEffect(BatchApplyActionRequest)({
        requests: [],
        options: { mode: "VALIDATE_ONLY" },
      });
      deepStrictEqual(withMode, request);
    })
  );

  it("rejects malformed requests", () => {
    assertRejects(ApplyActionRequest, { options: {} }, "parameters");
    assertRejects(ApplyActionRequest, { parameters: {}, options: { mode: "DRY_RUN" } }, "mode");
    assertRejects(ApplyActionRequest, { parameters: {}, options: null }, "options");
  });
});

// -----------------------------------------------------------------------------
// Edits and responses: parity fixtures from osdk-ts shared.test stubs/actions.ts
// -----------------------------------------------------------------------------

describe("Edits", () => {
  const nyc = EditedObject.make({ objectType: office, primaryKey: "NYC" });
  const hire = EditedObject.make({ objectType: employee, primaryKey: 50032 });

  wireFixture(
    "actionResponseCreateOfficeAndEmployee: a valid action that added two objects",
    ApplyActionResponse,
    {
      validation: { submissionCriteria: [], parameters: {}, result: "VALID" },
      edits: {
        type: "edits",
        edits: [
          { type: "addObject", primaryKey: "NYC", objectType: "Office" },
          { type: "addObject", primaryKey: "50032", objectType: "Employee" },
        ],
        addedObjectCount: 2,
        addedLinksCount: 0,
        modifiedObjectsCount: 0,
        deletedLinksCount: 0,
        deletedObjectsCount: 0,
      },
    },
    ApplyActionResponse.make({
      validation: O.some(ActionValidation.make({ result: "valid", submissionCriteria: [], parameters: {} })),
      edits: O.some(
        ObjectEdits.make({
          edits: [
            AddedObject.make({ objectType: office, primaryKey: "NYC" }),
            AddedObject.make({ objectType: employee, primaryKey: "50032" }),
          ],
          addedObjectCount: 2,
          addedLinksCount: 0,
          modifiedObjectsCount: 0,
          deletedLinksCount: 0,
          deletedObjectsCount: 0,
        })
      ),
    })
  );

  wireFixture(
    "actionResponse: a valid action that returned no edits",
    ApplyActionResponse,
    { validation: { result: "VALID", submissionCriteria: [], parameters: {} } },
    ApplyActionResponse.make({
      validation: O.some(ActionValidation.make({ result: "valid", submissionCriteria: [], parameters: {} })),
    })
  );

  wireFixture(
    "an operation id and large-scale edits travel untouched",
    ApplyActionResponse,
    {
      operationId: "ri.actions.main.action.d0c7e1b2",
      edits: { type: "largeScaleEdits", editedObjectTypes: ["Employee", "Office"] },
    },
    ApplyActionResponse.make({
      operationId: O.some("ri.actions.main.action.d0c7e1b2"),
      edits: O.some(LargeScaleEdits.make({ editedObjectTypes: [employee, office] })),
    })
  );

  wireFixture(
    "every edit kind travels in its wire shape, with numeric and string primary keys",
    ActionEdits,
    {
      type: "edits",
      edits: [
        { type: "addObject", primaryKey: "NYC", objectType: "Office" },
        { type: "modifyObject", primaryKey: 50032, objectType: "Employee" },
        { type: "deleteObject", primaryKey: "SEA", objectType: "Office" },
        {
          type: "addLink",
          linkTypeApiNameAtoB: "occupants",
          linkTypeApiNameBtoA: "office",
          aSideObject: { primaryKey: "NYC", objectType: "Office" },
          bSideObject: { primaryKey: 50032, objectType: "Employee" },
        },
        {
          type: "deleteLink",
          linkTypeApiNameAtoB: "occupants",
          linkTypeApiNameBtoA: "office",
          aSideObject: { primaryKey: "NYC", objectType: "Office" },
          bSideObject: { primaryKey: 50032, objectType: "Employee" },
        },
      ],
      addedObjectCount: 1,
      modifiedObjectsCount: 1,
      deletedObjectsCount: 1,
      addedLinksCount: 1,
      deletedLinksCount: 1,
    },
    ObjectEdits.make({
      edits: [
        AddedObject.make({ objectType: office, primaryKey: "NYC" }),
        ModifiedObject.make({ objectType: employee, primaryKey: 50032 }),
        DeletedObject.make({ objectType: office, primaryKey: "SEA" }),
        AddedLink.make({
          linkTypeApiNameAtoB: occupants,
          linkTypeApiNameBtoA: occupiedOffice,
          aSideObject: nyc,
          bSideObject: hire,
        }),
        DeletedLink.make({
          linkTypeApiNameAtoB: occupants,
          linkTypeApiNameBtoA: occupiedOffice,
          aSideObject: nyc,
          bSideObject: hire,
        }),
      ],
      addedObjectCount: 1,
      modifiedObjectsCount: 1,
      deletedObjectsCount: 1,
      addedLinksCount: 1,
      deletedLinksCount: 1,
    })
  );

  wireFixture(
    "a batch response lists additions and modifications and still counts deletions",
    BatchApplyActionResponse,
    {
      edits: {
        type: "edits",
        edits: [
          { type: "addObject", primaryKey: "NYC", objectType: "Office" },
          { type: "modifyObject", primaryKey: 50032, objectType: "Employee" },
          {
            type: "addLink",
            linkTypeApiNameAtoB: "occupants",
            linkTypeApiNameBtoA: "office",
            aSideObject: { primaryKey: "NYC", objectType: "Office" },
            bSideObject: { primaryKey: 50032, objectType: "Employee" },
          },
        ],
        addedObjectCount: 1,
        modifiedObjectsCount: 1,
        deletedObjectsCount: 4,
        addedLinksCount: 1,
        deletedLinksCount: 0,
      },
    },
    BatchApplyActionResponse.make({
      edits: O.some(
        BatchObjectEdits.make({
          edits: [
            AddedObject.make({ objectType: office, primaryKey: "NYC" }),
            ModifiedObject.make({ objectType: employee, primaryKey: 50032 }),
            AddedLink.make({
              linkTypeApiNameAtoB: occupants,
              linkTypeApiNameBtoA: occupiedOffice,
              aSideObject: nyc,
              bSideObject: hire,
            }),
          ],
          addedObjectCount: 1,
          modifiedObjectsCount: 1,
          deletedObjectsCount: 4,
          addedLinksCount: 1,
          deletedLinksCount: 0,
        })
      ),
    })
  );

  it("constructs every edit case and matches it exhaustively", () => {
    const addedLink = ObjectEdit.cases.addLink.make({
      linkTypeApiNameAtoB: occupants,
      linkTypeApiNameBtoA: occupiedOffice,
      aSideObject: nyc,
      bSideObject: hire,
    });
    const deletedLink = ObjectEdit.cases.deleteLink.make({
      linkTypeApiNameAtoB: occupants,
      linkTypeApiNameBtoA: occupiedOffice,
      aSideObject: nyc,
      bSideObject: hire,
    });
    const edits = [
      ObjectEdit.cases.addObject.make({ objectType: office, primaryKey: "NYC" }),
      ObjectEdit.cases.modifyObject.make({ objectType: employee, primaryKey: 50032 }),
      ObjectEdit.cases.deleteObject.make({ objectType: office, primaryKey: "SEA" }),
      addedLink,
      deletedLink,
    ];
    const tag = ObjectEdit.match({
      addObject: tagOf,
      modifyObject: tagOf,
      deleteObject: tagOf,
      addLink: tagOf,
      deleteLink: tagOf,
    });
    deepStrictEqual(A.map(edits, tag), A.fromIterable(ObjectEditKind.literals));

    const batchEdits = [
      BatchObjectEdit.cases.addObject.make({ objectType: office, primaryKey: "NYC" }),
      BatchObjectEdit.cases.modifyObject.make({ objectType: employee, primaryKey: 50032 }),
      BatchObjectEdit.cases.addLink.make({
        linkTypeApiNameAtoB: occupants,
        linkTypeApiNameBtoA: occupiedOffice,
        aSideObject: nyc,
        bSideObject: hire,
      }),
    ];
    const batchTag = BatchObjectEdit.match({ addObject: tagOf, modifyObject: tagOf, addLink: tagOf });
    deepStrictEqual(A.map(batchEdits, batchTag), A.fromIterable(BatchObjectEditKind.literals));

    const listed = ActionEdits.cases.edits.make({
      edits,
      addedObjectCount: 1,
      modifiedObjectsCount: 1,
      deletedObjectsCount: 1,
      addedLinksCount: 1,
      deletedLinksCount: 1,
    });
    const largeScale = ActionEdits.cases.largeScaleEdits.make({ editedObjectTypes: [office] });
    const results = [listed, largeScale];
    const resultTag = ActionEdits.match({ edits: tagOf, largeScaleEdits: tagOf });
    deepStrictEqual(A.map(results, resultTag), A.fromIterable(ActionEditsKind.literals));

    const batchListed = BatchActionEdits.cases.edits.make({
      edits: batchEdits,
      addedObjectCount: 1,
      modifiedObjectsCount: 1,
      deletedObjectsCount: 0,
      addedLinksCount: 1,
      deletedLinksCount: 0,
    });
    const batchLargeScale = BatchActionEdits.cases.largeScaleEdits.make({ editedObjectTypes: [office] });
    const batchResults = [batchListed, batchLargeScale];
    const batchResultTag = BatchActionEdits.match({ edits: tagOf, largeScaleEdits: tagOf });
    deepStrictEqual(A.map(batchResults, batchResultTag), A.fromIterable(ActionEditsKind.literals));

    assertTrue(ObjectEdit.guards.deleteLink(deletedLink));
    assertTrue(ObjectEdit.isAnyOf(["addLink", "deleteLink"])(addedLink));
    assertTrue(ActionEdits.guards.largeScaleEdits(largeScale));

    deepStrictEqual(editedObjectTypes(listed), [office, employee]);
    deepStrictEqual(editedObjectTypes(largeScale), [office]);
    deepStrictEqual(editedObjectTypes(batchListed), [office, employee]);
    deepStrictEqual(editedObjectTypes(batchLargeScale), [office]);
  });

  it("lists edited object types once each, in first-seen order, including both sides of a link", () => {
    const linkOnly = ObjectEdits.make({
      edits: [
        AddedLink.make({
          linkTypeApiNameAtoB: occupiedOffice,
          linkTypeApiNameBtoA: occupants,
          aSideObject: hire,
          bSideObject: nyc,
        }),
        AddedObject.make({ objectType: office, primaryKey: "SEA" }),
        DeletedObject.make({ objectType: employee, primaryKey: 7 }),
      ],
      addedObjectCount: 1,
      modifiedObjectsCount: 0,
      deletedObjectsCount: 1,
      addedLinksCount: 1,
      deletedLinksCount: 0,
    });
    deepStrictEqual(editedObjectTypes(linkOnly), [employee, office]);
    deepStrictEqual(
      editedObjectTypes(
        ObjectEdits.make({
          edits: [],
          addedObjectCount: 0,
          modifiedObjectsCount: 0,
          deletedObjectsCount: 0,
          addedLinksCount: 0,
          deletedLinksCount: 0,
        })
      ),
      []
    );
  });

  it("rejects malformed edits", () => {
    const counts = {
      addedObjectCount: 0,
      modifiedObjectsCount: 0,
      deletedObjectsCount: 0,
      addedLinksCount: 0,
      deletedLinksCount: 0,
    };
    assertTrue(S.is(S.toEncoded(ActionEdits))({ type: "edits", edits: [], ...counts }));
    assertRejects(ActionEdits, { type: "edits", edits: [], ...counts, addedObjectCount: -1 }, "addedObjectCount");
    assertRejects(ActionEdits, { type: "edits", edits: [], ...counts, deletedLinksCount: 1.5 }, "deletedLinksCount");
    assertRejects(ActionEdits, { type: "edits", edits: [{ type: "removeLink" }], ...counts }, "edits");
    assertRejects(ActionEdits, { type: "largeScaleEdits", editedObjectTypes: [""] }, "editedObjectTypes");
    assertRejects(ObjectEdit, { type: "addObject", objectType: "Office" }, "primaryKey");
    assertRejects(
      BatchActionEdits,
      {
        type: "edits",
        edits: [{ type: "deleteObject", primaryKey: "SEA", objectType: "Office" }],
        ...counts,
      },
      "edits"
    );
  });
});

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

describe("Validation", () => {
  it.effect(
    "a validation response with every constraint kind decodes and encodes back unchanged",
    Effect.fnUntraced(function* () {
      const wire: (typeof ActionValidation)["Encoded"] = {
        result: "INVALID",
        submissionCriteria: [
          { result: "VALID" },
          { configuredFailureMessage: "Only managers may promote", result: "INVALID" },
        ],
        parameters: {
          tags: {
            result: "INVALID",
            evaluatedConstraints: [{ type: "arraySize", gte: 1, lte: 3 }],
            required: true,
          },
          approver: { result: "VALID", evaluatedConstraints: [{ type: "groupMember" }], required: true },
          title: {
            result: "VALID",
            evaluatedConstraints: [
              { type: "objectPropertyValue" },
              { type: "stringLength", gte: 1, lte: 64 },
              { type: "stringRegexMatch", regex: "^[A-Z]", configuredFailureMessage: "Start with a capital" },
            ],
            required: false,
            defaultValue: "Engineer",
          },
          employee: { result: "VALID", evaluatedConstraints: [{ type: "objectQueryResult" }], required: true },
          office: {
            result: "VALID",
            evaluatedConstraints: [
              {
                type: "oneOf",
                options: [{ displayName: "New York", value: "NYC" }, { value: "SEA" }, {}],
                otherValuesAllowed: false,
              },
            ],
            required: true,
          },
          salary: {
            result: "INVALID",
            evaluatedConstraints: [{ type: "range", gt: 0, lt: 1000000 }],
            required: true,
          },
          startDate: {
            result: "VALID",
            evaluatedConstraints: [{ type: "range", gte: "2021-05-01" }],
            required: false,
            defaultValue: null,
          },
          manager: { result: "INVALID", evaluatedConstraints: [{ type: "unevaluable" }], required: false },
          address: {
            result: "VALID",
            evaluatedConstraints: [
              {
                type: "struct",
                structFields: {
                  city: {
                    result: "VALID",
                    evaluatedConstraints: [{ type: "oneOf", options: [{ value: "NYC" }], otherValuesAllowed: true }],
                    required: true,
                  },
                  zipcode: {
                    result: "VALID",
                    evaluatedConstraints: [{ type: "stringRegexMatch", regex: "^[0-9]{5}$" }],
                    required: false,
                  },
                },
              },
            ],
            required: false,
          },
          previousAddresses: {
            result: "VALID",
            evaluatedConstraints: [
              {
                type: "array",
                entries: [
                  {
                    type: "struct",
                    structFields: {
                      city: {
                        result: "VALID",
                        evaluatedConstraints: [
                          { type: "objectQueryResult" },
                          { type: "range", gte: "2020-01-01" },
                          { type: "stringLength", lte: 10 },
                        ],
                        required: true,
                      },
                    },
                  },
                ],
              },
            ],
            required: false,
          },
        },
      };
      const decoded = yield* S.decodeEffect(ActionValidation)(wire);
      strictEqual(decoded.result, "invalid");
      deepStrictEqual(
        A.map(decoded.submissionCriteria, (criterion) => criterion.result),
        ["valid", "invalid"]
      );
      assertSome(
        O.flatMap(A.get(decoded.submissionCriteria, 1), (criterion) => criterion.configuredFailureMessage),
        "Only managers may promote"
      );
      const kindsOf = (id: string) =>
        pipe(
          R.get(decoded.parameters, ParameterId.make(id)),
          O.map((evaluation) => A.map(evaluation.evaluatedConstraints, tagOf)),
          O.getOrElse(() => A.empty<EvaluatedConstraintKind>())
        );
      deepStrictEqual(kindsOf("tags"), ["arraySize"]);
      deepStrictEqual(kindsOf("title"), ["objectPropertyValue", "stringLength", "stringRegexMatch"]);
      deepStrictEqual(kindsOf("address"), ["struct"]);
      deepStrictEqual(kindsOf("previousAddresses"), ["array"]);
      const title = yield* Effect.fromOption(R.get(decoded.parameters, ParameterId.make("title")));
      assertSome(title.defaultValue, "Engineer");
      assertFalse(title.required);
      const startDate = yield* Effect.fromOption(R.get(decoded.parameters, ParameterId.make("startDate")));
      assertSome(startDate.defaultValue, null);
      const tags = yield* Effect.fromOption(R.get(decoded.parameters, ParameterId.make("tags")));
      deepStrictEqual(
        tags,
        ParameterEvaluation.make({
          result: "invalid",
          evaluatedConstraints: [ArraySizeConstraint.make({ gte: O.some(1), lte: O.some(3) })],
          required: true,
        })
      );
      const encoded = yield* S.encodeEffect(ActionValidation)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  wireFixture(
    "a struct evaluation is keyed by field name",
    EvaluatedConstraint,
    {
      type: "struct",
      structFields: {
        city: {
          result: "INVALID",
          evaluatedConstraints: [{ type: "stringLength", gte: 1, lte: 10 }],
          required: true,
        },
      },
    },
    StructConstraint.make({
      structFields: byField({
        city: StructFieldEvaluation.make({
          result: "invalid",
          evaluatedConstraints: [StringLengthConstraint.make({ gte: O.some(1), lte: O.some(10) })],
          required: true,
        }),
      }),
    })
  );

  it("constructs every constraint case and matches it exhaustively", () => {
    const structConstraint = EvaluatedConstraint.cases.struct.make({ structFields: {} });
    const oneOf = EvaluatedConstraint.cases.oneOf.make({
      options: [ParameterOption.make({ value: O.some("NYC") })],
      otherValuesAllowed: false,
    });
    const regexMatch = EvaluatedConstraint.cases.stringRegexMatch.make({ regex: "^[A-Z]" });
    const constraints = [
      EvaluatedConstraint.cases.arraySize.make({ lte: O.some(3) }),
      EvaluatedConstraint.cases.groupMember.make({}),
      EvaluatedConstraint.cases.objectPropertyValue.make({}),
      EvaluatedConstraint.cases.objectQueryResult.make({}),
      oneOf,
      EvaluatedConstraint.cases.range.make({ gt: O.some(0) }),
      EvaluatedConstraint.cases.stringLength.make({ lte: O.some(64) }),
      regexMatch,
      EvaluatedConstraint.cases.unevaluable.make({}),
      structConstraint,
      EvaluatedConstraint.cases.array.make({ entries: [structConstraint] }),
    ];
    const tag = EvaluatedConstraint.match({
      arraySize: tagOf,
      groupMember: tagOf,
      objectPropertyValue: tagOf,
      objectQueryResult: tagOf,
      oneOf: tagOf,
      range: tagOf,
      stringLength: tagOf,
      stringRegexMatch: tagOf,
      unevaluable: tagOf,
      struct: tagOf,
      array: tagOf,
    });
    deepStrictEqual(A.map(constraints, tag), A.fromIterable(EvaluatedConstraintKind.literals));

    const fieldConstraints = [
      StructFieldConstraint.cases.objectQueryResult.make({}),
      StructFieldConstraint.cases.oneOf.make({ options: [], otherValuesAllowed: true }),
      StructFieldConstraint.cases.range.make({}),
      StructFieldConstraint.cases.stringLength.make({}),
      StructFieldConstraint.cases.stringRegexMatch.make({ regex: "^[0-9]{5}$" }),
    ];
    const fieldTag = StructFieldConstraint.match({
      objectQueryResult: tagOf,
      oneOf: tagOf,
      range: tagOf,
      stringLength: tagOf,
      stringRegexMatch: tagOf,
    });
    deepStrictEqual(A.map(fieldConstraints, fieldTag), A.fromIterable(StructFieldConstraintKind.literals));

    const entry = ArrayEntryConstraint.cases.struct.make({ structFields: {} });
    strictEqual(ArrayEntryConstraint.match(entry, { struct: tagOf }), "struct");

    assertTrue(EvaluatedConstraint.guards.unevaluable(UnevaluableConstraint.make({})));
    assertTrue(EvaluatedConstraint.isAnyOf(["struct", "array"])(ArrayConstraint.make({ entries: [] })));
    assertFalse(EvaluatedConstraint.isAnyOf(["struct", "array"])(GroupMemberConstraint.make({})));
    assertTrue(
      A.every(
        [ObjectPropertyValueConstraint.make({}), ObjectQueryResultConstraint.make({}), RangeConstraint.make({})],
        S.is(EvaluatedConstraint)
      )
    );
    assertTrue(S.is(SubmissionCriterion)(SubmissionCriterion.make({ result: "valid" })));
    assertTrue(S.is(OneOfConstraint)(oneOf));
    assertTrue(S.is(StringRegexMatchConstraint)(regexMatch));
  });

  it("rejects malformed validation", () => {
    assertRejects(ActionValidation, { result: "VALID", submissionCriteria: [] }, "parameters");
    assertRejects(ActionValidation, { result: "OK", submissionCriteria: [], parameters: {} }, "result");
    assertRejects(
      ActionValidation,
      {
        result: "VALID",
        submissionCriteria: [],
        parameters: { title: { result: "VALID", evaluatedConstraints: [{ type: "text" }], required: true } },
      },
      "evaluatedConstraints"
    );
    assertRejects(EvaluatedConstraint, { type: "stringRegexMatch" }, "regex");
    assertRejects(EvaluatedConstraint, { type: "oneOf", options: [] }, "otherValuesAllowed");
    assertRejects(
      EvaluatedConstraint,
      {
        type: "struct",
        structFields: {
          city: { result: "VALID", evaluatedConstraints: [{ type: "groupMember" }], required: true },
        },
      },
      "evaluatedConstraints"
    );
    assertRejects(EvaluatedConstraint, { type: "array", entries: [{ type: "oneOf" }] }, "entries");
    assertRejects(StructFieldConstraint, { type: "unevaluable" }, "StructFieldConstraint");
  });
});

// -----------------------------------------------------------------------------
// Logic rules
// -----------------------------------------------------------------------------

describe("Logic rules", () => {
  const officeParameter = ParameterId.make("office");
  const employeeParameter = ParameterId.make("employee");
  const functionRid = FunctionRid.make("ri.function-registry.main.function.9b55870a");
  const reportsTo = InterfaceLinkTypeApiName.make("reportsTo");
  const byProperty = <Value>(entries: Readonly<Record<string, Value>>) =>
    R.mapKeys(entries, (key) => PropertyApiName.make(key));
  const bySharedProperty = <Value>(entries: Readonly<Record<string, Value>>) =>
    R.mapKeys(entries, (key) => SharedPropertyTypeApiName.make(key));

  it("constructs every argument source and matches it exhaustively", () => {
    const sources = [
      LogicRuleArgument.cases.parameterId.make({ parameterId: officeParameter }),
      LogicRuleArgument.cases.staticValue.make({ value: 100 }),
      LogicRuleArgument.cases.objectParameterPropertyValue.make({
        parameterId: officeParameter,
        propertyTypeApiName: PropertyApiName.make("region"),
      }),
      LogicRuleArgument.cases.interfaceParameterPropertyValue.make({
        parameterId: employeeParameter,
        sharedPropertyTypeRid: SharedPropertyTypeRid.make("ri.ontology.main.shared-property.owner"),
      }),
      LogicRuleArgument.cases.currentUser.make({}),
      LogicRuleArgument.cases.currentTime.make({}),
      LogicRuleArgument.cases.uniqueIdentifier.make({}),
      LogicRuleArgument.cases.synchronousWebhookOutput.make({ webhookOutputParamName: "badgeNumber" }),
    ];
    const tag = LogicRuleArgument.match({
      parameterId: tagOf,
      staticValue: tagOf,
      objectParameterPropertyValue: tagOf,
      interfaceParameterPropertyValue: tagOf,
      currentUser: tagOf,
      currentTime: tagOf,
      uniqueIdentifier: tagOf,
      synchronousWebhookOutput: tagOf,
    });
    deepStrictEqual(A.map(sources, tag), A.fromIterable(LogicRuleArgumentKind.literals));

    const fieldSources = [
      StructFieldArgument.cases.structParameterFieldValue.make({
        parameterId: address,
        structParameterFieldApiName: StructFieldApiName.make("city"),
      }),
      StructFieldArgument.cases.structListParameterFieldValue.make({
        parameterId: address,
        structParameterFieldApiName: StructFieldApiName.make("city"),
      }),
    ];
    const fieldTag = StructFieldArgument.match({
      structParameterFieldValue: tagOf,
      structListParameterFieldValue: tagOf,
    });
    deepStrictEqual(A.map(fieldSources, fieldTag), A.fromIterable(StructFieldArgumentKind.literals));
    assertTrue(LogicRuleArgument.guards.currentUser(CurrentUserArgument.make({})));
    assertTrue(LogicRuleArgument.isAnyOf(["currentUser", "currentTime"])(CurrentTimeArgument.make({})));
    assertNone(UniqueIdentifierArgument.make({}).linkId);
  });

  it("constructs every rule and matches it exhaustively", () => {
    const deleteOffice = ActionLogicRule.cases.deleteObject.make({ objectToDelete: officeParameter });
    const rules = [
      ActionLogicRule.cases.createObject.make({
        objectTypeApiName: office,
        propertyArguments: {},
        structPropertyArguments: {},
      }),
      ActionLogicRule.cases.modifyObject.make({
        objectToModify: officeParameter,
        propertyArguments: {},
        structPropertyArguments: {},
      }),
      ActionLogicRule.cases.createOrModifyObject.make({
        objectTypeApiName: office,
        propertyArguments: {},
        structPropertyArguments: {},
      }),
      ActionLogicRule.cases.createOrModifyObjectV2.make({
        objectToModify: officeParameter,
        propertyArguments: {},
        structPropertyArguments: {},
      }),
      deleteOffice,
      ActionLogicRule.cases.createLink.make({
        linkTypeApiName: occupants,
        sourceObject: officeParameter,
        targetObject: employeeParameter,
      }),
      ActionLogicRule.cases.deleteLink.make({
        linkTypeApiName: occupants,
        sourceObject: officeParameter,
        targetObject: employeeParameter,
      }),
      ActionLogicRule.cases.createInterface.make({
        interfaceTypeApiName: worker,
        objectType: ParameterId.make("workerType"),
        sharedPropertyArguments: {},
        structPropertyArguments: {},
      }),
      ActionLogicRule.cases.modifyInterface.make({
        interfaceObjectToModify: employeeParameter,
        sharedPropertyArguments: {},
        structPropertyArguments: {},
      }),
      ActionLogicRule.cases.createInterfaceLink.make({
        interfaceTypeApiName: worker,
        interfaceLinkTypeApiName: reportsTo,
        sourceObject: employeeParameter,
        targetObject: officeParameter,
      }),
      ActionLogicRule.cases.deleteInterfaceLink.make({
        interfaceTypeApiName: worker,
        interfaceLinkTypeApiName: reportsTo,
        sourceObject: employeeParameter,
        targetObject: officeParameter,
      }),
      ActionLogicRule.cases.function.make({
        functionRid,
        functionVersion: FunctionVersion.make("1.2.3"),
        functionInputValues: {},
      }),
      ActionLogicRule.cases.batchedFunction.make({
        objectSetRidInputName: "offices",
        functionRule: FunctionCall.make({
          functionRid,
          functionVersion: FunctionVersion.make("0.1.0-rc1"),
          functionInputValues: {},
        }),
      }),
      ActionLogicRule.cases.applyScenario.make({
        scenarioParameter: ParameterId.make("scenario"),
        objectTypeApiNames: [office],
        linkTypes: [],
      }),
    ];
    const tag = ActionLogicRule.match({
      createObject: tagOf,
      modifyObject: tagOf,
      createOrModifyObject: tagOf,
      createOrModifyObjectV2: tagOf,
      deleteObject: tagOf,
      createLink: tagOf,
      deleteLink: tagOf,
      createInterface: tagOf,
      modifyInterface: tagOf,
      createInterfaceLink: tagOf,
      deleteInterfaceLink: tagOf,
      function: tagOf,
      batchedFunction: tagOf,
      applyScenario: tagOf,
    });
    deepStrictEqual(A.map(rules, tag), A.fromIterable(ActionLogicRuleKind.literals));
    assertTrue(ActionLogicRule.guards.deleteObject(deleteOffice));
    assertFalse(ActionLogicRule.isAnyOf(["function", "batchedFunction"])(deleteOffice));
  });

  wireFixture(
    "a create rule names the source of every property and struct field",
    ActionLogicRule,
    {
      type: "createObject",
      objectTypeApiName: "Office",
      propertyArguments: {
        officeId: { type: "uniqueIdentifier", linkId: "newOffice" },
        name: { type: "parameterId", parameterId: "name" },
        capacity: { type: "staticValue", value: 100 },
        createdBy: { type: "currentUser" },
        createdAt: { type: "currentTime" },
        region: { type: "objectParameterPropertyValue", parameterId: "manager", propertyTypeApiName: "region" },
        owner: {
          type: "interfaceParameterPropertyValue",
          parameterId: "worker",
          sharedPropertyTypeRid: "ri.ontology.main.shared-property.owner",
        },
        badge: { type: "synchronousWebhookOutput", webhookOutputParamName: "badgeNumber" },
        ticket: { type: "uniqueIdentifier" },
      },
      structPropertyArguments: {
        address: {
          city: { type: "structParameterFieldValue", parameterId: "address", structParameterFieldApiName: "city" },
          previous: {
            type: "structListParameterFieldValue",
            parameterId: "previousAddresses",
            structParameterFieldApiName: "city",
          },
        },
      },
    },
    CreateObjectRule.make({
      objectTypeApiName: office,
      propertyArguments: byProperty({
        officeId: UniqueIdentifierArgument.make({ linkId: O.some("newOffice") }),
        name: ParameterArgument.make({ parameterId: ParameterId.make("name") }),
        capacity: StaticArgument.make({ value: 100 }),
        createdBy: CurrentUserArgument.make({}),
        createdAt: CurrentTimeArgument.make({}),
        region: ObjectPropertyArgument.make({
          parameterId: ParameterId.make("manager"),
          propertyTypeApiName: PropertyApiName.make("region"),
        }),
        owner: InterfacePropertyArgument.make({
          parameterId: ParameterId.make("worker"),
          sharedPropertyTypeRid: SharedPropertyTypeRid.make("ri.ontology.main.shared-property.owner"),
        }),
        badge: WebhookOutputArgument.make({ webhookOutputParamName: "badgeNumber" }),
        ticket: UniqueIdentifierArgument.make({}),
      }),
      structPropertyArguments: byProperty({
        address: byField({
          city: StructFieldValueArgument.make({
            parameterId: address,
            structParameterFieldApiName: StructFieldApiName.make("city"),
          }),
          previous: StructListFieldValueArgument.make({
            parameterId: ParameterId.make("previousAddresses"),
            structParameterFieldApiName: StructFieldApiName.make("city"),
          }),
        }),
      }),
    })
  );

  wireFixture(
    "an interface rule keys its arguments by shared property",
    ActionLogicRule,
    {
      type: "modifyInterface",
      interfaceObjectToModify: "worker",
      sharedPropertyArguments: { name: { type: "parameterId", parameterId: "name" } },
      structPropertyArguments: {
        contact: {
          email: { type: "structParameterFieldValue", parameterId: "contact", structParameterFieldApiName: "email" },
        },
      },
    },
    ModifyInterfaceRule.make({
      interfaceObjectToModify: ParameterId.make("worker"),
      sharedPropertyArguments: bySharedProperty({
        name: ParameterArgument.make({ parameterId: ParameterId.make("name") }),
      }),
      structPropertyArguments: bySharedProperty({
        contact: byField({
          email: StructFieldValueArgument.make({
            parameterId: ParameterId.make("contact"),
            structParameterFieldApiName: StructFieldApiName.make("email"),
          }),
        }),
      }),
    })
  );

  wireFixture(
    "a batched function rule nests the function call without a tag",
    ActionLogicRule,
    {
      type: "batchedFunction",
      objectSetRidInputName: "offices",
      functionRule: {
        functionRid: "ri.function-registry.main.function.9b55870a",
        functionVersion: "0.1.0-rc1",
        functionInputValues: { reason: { type: "parameterId", parameterId: "reason" } },
      },
    },
    BatchedFunctionRule.make({
      objectSetRidInputName: "offices",
      functionRule: FunctionCall.make({
        functionRid,
        functionVersion: FunctionVersion.make("0.1.0-rc1"),
        functionInputValues: { reason: ParameterArgument.make({ parameterId: ParameterId.make("reason") }) },
      }),
    })
  );

  it.effect(
    "an action type with every rule kind decodes and encodes back unchanged",
    Effect.fnUntraced(function* () {
      const wire: (typeof ActionTypeDefinition)["Encoded"] = {
        actionType: {
          apiName: "manageOffice",
          rid: "ri.ontology.main.action-type.manage-office",
          status: "ACTIVE",
          parameters: {
            office: {
              displayName: "Office",
              dataType: { type: "object", objectApiName: "Office", objectTypeApiName: "Office" },
              required: true,
              typeClasses: [],
            },
          },
          operations: [{ type: "modifyObject", objectTypeApiName: "Office" }],
        },
        fullLogicRules: [
          {
            type: "createObject",
            objectTypeApiName: "Office",
            propertyArguments: { officeId: { type: "uniqueIdentifier" } },
            structPropertyArguments: {},
          },
          {
            type: "modifyObject",
            objectToModify: "office",
            propertyArguments: { capacity: { type: "parameterId", parameterId: "capacity" } },
            structPropertyArguments: {},
          },
          {
            type: "createOrModifyObject",
            objectTypeApiName: "Office",
            propertyArguments: {},
            structPropertyArguments: {},
          },
          {
            type: "createOrModifyObjectV2",
            objectToModify: "office",
            propertyArguments: {},
            structPropertyArguments: {},
          },
          { type: "deleteObject", objectToDelete: "office" },
          { type: "createLink", linkTypeApiName: "occupants", sourceObject: "office", targetObject: "employee" },
          { type: "deleteLink", linkTypeApiName: "occupants", sourceObject: "office", targetObject: "employee" },
          {
            type: "createInterface",
            interfaceTypeApiName: "Worker",
            objectType: "workerType",
            sharedPropertyArguments: { name: { type: "parameterId", parameterId: "name" } },
            structPropertyArguments: {},
          },
          {
            type: "modifyInterface",
            interfaceObjectToModify: "worker",
            sharedPropertyArguments: {},
            structPropertyArguments: {},
          },
          {
            type: "createInterfaceLink",
            interfaceTypeApiName: "Worker",
            interfaceLinkTypeApiName: "reportsTo",
            sourceObject: "worker",
            targetObject: "manager",
          },
          {
            type: "deleteInterfaceLink",
            interfaceTypeApiName: "Worker",
            interfaceLinkTypeApiName: "reportsTo",
            sourceObject: "worker",
            targetObject: "manager",
          },
          {
            type: "function",
            functionRid: "ri.function-registry.main.function.9b55870a",
            functionVersion: "1.2.3",
            functionInputValues: { office: { type: "parameterId", parameterId: "office" } },
          },
          {
            type: "batchedFunction",
            objectSetRidInputName: "offices",
            functionRule: {
              functionRid: "ri.function-registry.main.function.9b55870a",
              functionVersion: "0.1.0-rc1",
              functionInputValues: {},
            },
          },
          {
            type: "applyScenario",
            scenarioParameter: "scenario",
            objectTypeApiNames: ["Office"],
            linkTypes: [{ objectTypeApiName: "Office", linkTypes: ["occupants"] }],
          },
        ],
      };
      const decoded = yield* S.decodeEffect(ActionTypeDefinition)(wire);
      strictEqual(decoded.actionType.apiName, ActionTypeApiName.make("manageOffice"));
      deepStrictEqual(A.map(decoded.fullLogicRules, tagOf), A.fromIterable(ActionLogicRuleKind.literals));
      assertSome(
        A.findFirst(decoded.fullLogicRules, ActionLogicRule.guards.deleteObject),
        DeleteObjectRule.make({ objectToDelete: officeParameter })
      );
      assertSome(
        A.findFirst(decoded.fullLogicRules, ActionLogicRule.guards.createLink),
        CreateLinkRule.make({
          linkTypeApiName: occupants,
          sourceObject: officeParameter,
          targetObject: employeeParameter,
        })
      );
      const encoded = yield* S.encodeEffect(ActionTypeDefinition)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it("rejects malformed rules", () => {
    assertRejects(
      ActionLogicRule,
      { type: "createInterfaceObject", interfaceTypeApiName: "Worker" },
      "ActionLogicRule"
    );
    assertRejects(ActionLogicRule, { type: "deleteObject" }, "objectToDelete");
    assertRejects(
      ActionLogicRule,
      { type: "createObject", objectTypeApiName: "Office", propertyArguments: {} },
      "structPropertyArguments"
    );
    assertRejects(
      ActionLogicRule,
      {
        type: "modifyObject",
        objectToModify: "office",
        propertyArguments: { capacity: { type: "structParameterFieldValue" } },
        structPropertyArguments: {},
      },
      "capacity"
    );
    assertRejects(
      ActionLogicRule,
      {
        type: "function",
        functionRid: "ri.function-registry.main.function.9b55870a",
        functionVersion: "latest",
        functionInputValues: {},
      },
      "functionVersion"
    );
    assertRejects(LogicRuleArgument, { type: "staticValue" }, "value");
    assertRejects(LogicRuleArgument, { type: "currentDate" }, "LogicRuleArgument");
    assertRejects(
      StructFieldArgument,
      { type: "structParameterFieldValue", parameterId: "address" },
      "structParameterFieldApiName"
    );
    assertRejects(ActionTypeDefinition, { fullLogicRules: [] }, "actionType");
  });
});

// ---------------------------------------------------------------------------
// Fields that hold another class
// ---------------------------------------------------------------------------

type SameType<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

describe("fields that hold another class", () => {
  // Law: a field whose schema is a class is typed as that class, so its value can be handed to anything that asks
  // for the class. Annotating the key of a class would silently type the field as the class's un-branded record.
  it("are typed as the class and never as its un-branded record", () => {
    const facts: readonly [
      SameType<BatchedFunctionRule["functionRule"], FunctionCall>,
      SameType<ActionTypeDefinition["actionType"], ActionType>,
      SameType<ParameterValidation["defaultValidation"], ParameterConstraints>,
      SameType<AddedLink["aSideObject"], EditedObject>,
      SameType<AddedLink["bSideObject"], EditedObject>,
      SameType<DeletedLink["aSideObject"], EditedObject>,
      SameType<DeletedLink["bSideObject"], EditedObject>,
      SameType<ApplyActionRequest["options"], ApplyActionOptions>,
      SameType<BatchApplyActionRequest["options"], BatchApplyActionOptions>,
    ] = [true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, (fact) => fact));
  });
});
