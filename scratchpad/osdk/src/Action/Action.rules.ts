/**
 * Logic rules: the detailed account of what an action does and where each value it writes comes from.
 *
 * **Details**
 *
 * An action type describes its effects twice. Its operations
 * (`ActionOperation`) only say which types are touched. Its logic rules, read
 * from the full metadata endpoints, say which parameter names the object to
 * edit and which argument source feeds each property. The OSDK client derives
 * what it knows from the operations alone; the rules are what a form, a
 * simulator or a lineage view needs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
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
} from "../Identifier/Identifier.model.ts";
import { ActionType, ScenarioLinkScope } from "./Action.model.ts";
import { ActionLogicRuleKind, LogicRuleArgumentKind, StructFieldArgumentKind } from "./Action.values.ts";

const $I = $ScratchpadId.create("osdk/Action/Action.rules");

// -----------------------------------------------------------------------------
// Argument sources
// -----------------------------------------------------------------------------

/**
 * Takes the value from one of the action's parameters.
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterArgument extends S.Opaque<ParameterArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("parameterId"),
    parameterId: ParameterId.annotateKey({ description: "Parameter whose argument is used." }),
  }).pipe(
    $I.annoteSchema("ParameterArgument", { description: "Takes the value from one of the action's parameters." })
  )
) {}

/**
 * Takes a value fixed when the action type was configured.
 *
 * @category models
 * @since 0.0.0
 */
export class StaticArgument extends S.Opaque<StaticArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("staticValue"),
    value: S.Json.annotateKey({ description: "The fixed value, in the wire encoding of the target's type." }),
  }).pipe(
    $I.annoteSchema("StaticArgument", { description: "Takes a value fixed when the action type was configured." })
  )
) {}

/**
 * Takes the value of a property of the object passed in an object parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectPropertyArgument extends S.Opaque<ObjectPropertyArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("objectParameterPropertyValue"),
    parameterId: ParameterId.annotateKey({ description: "Object parameter to read from." }),
    propertyTypeApiName: PropertyApiName.annotateKey({ description: "Property of that object to read." }),
  }).pipe(
    $I.annoteSchema("ObjectPropertyArgument", {
      description: "Takes the value of a property of the object passed in an object parameter.",
    })
  )
) {}

/**
 * Takes the value of a shared property of the object passed in an interface object parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfacePropertyArgument extends S.Opaque<InterfacePropertyArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interfaceParameterPropertyValue"),
    parameterId: ParameterId.annotateKey({ description: "Interface object parameter to read from." }),
    sharedPropertyTypeRid: SharedPropertyTypeRid.annotateKey({
      description: "Shared property of that object to read.",
    }),
  }).pipe(
    $I.annoteSchema("InterfacePropertyArgument", {
      description: "Takes the value of a shared property of the object passed in an interface object parameter.",
    })
  )
) {}

/**
 * Takes the identifier of the user applying the action.
 *
 * @category models
 * @since 0.0.0
 */
export class CurrentUserArgument extends S.Opaque<CurrentUserArgument, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("currentUser") }).pipe(
    $I.annoteSchema("CurrentUserArgument", { description: "Takes the identifier of the user applying the action." })
  )
) {}

/**
 * Takes the moment the action is applied.
 *
 * @category models
 * @since 0.0.0
 */
export class CurrentTimeArgument extends S.Opaque<CurrentTimeArgument, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("currentTime") }).pipe(
    $I.annoteSchema("CurrentTimeArgument", { description: "Takes the moment the action is applied." })
  )
) {}

/**
 * Takes a fresh unique identifier generated when the action is applied.
 *
 * **Details**
 *
 * By its name, `linkId` ties together the arguments that must receive the same
 * generated identifier. The platform does not document it further.
 *
 * @category models
 * @since 0.0.0
 */
export class UniqueIdentifierArgument extends S.Opaque<UniqueIdentifierArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("uniqueIdentifier"),
    linkId: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Name shared by the arguments that must receive the same identifier." })
    ),
  }).pipe(
    $I.annoteSchema("UniqueIdentifierArgument", {
      description: "Takes a fresh unique identifier generated when the action is applied.",
    })
  )
) {}

/**
 * Takes one output of the webhook the action calls before it writes.
 *
 * @category models
 * @since 0.0.0
 */
export class WebhookOutputArgument extends S.Opaque<WebhookOutputArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("synchronousWebhookOutput"),
    webhookOutputParamName: S.String.annotateKey({ description: "Name of the webhook output to use." }),
  }).pipe(
    $I.annoteSchema("WebhookOutputArgument", {
      description: "Takes one output of the webhook the action calls before it writes.",
    })
  )
) {}

/**
 * Where a logic rule takes one value from: a parameter, a constant, a passed object or the context of the application.
 *
 * **Example** (Find the parameter an argument reads)
 *
 * ```ts import.meta.vitest name="Find the parameter an argument reads"
 * import * as O from "effect/Option"
 * import { ParameterId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { CurrentTimeArgument, LogicRuleArgument, ParameterArgument } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const source = LogicRuleArgument.matchOrElse(
 *   {
 *     parameterId: ({ parameterId }) => O.some<string>(parameterId),
 *     objectParameterPropertyValue: ({ parameterId }) => O.some<string>(parameterId),
 *     interfaceParameterPropertyValue: ({ parameterId }) => O.some<string>(parameterId),
 *   },
 *   () => O.none<string>()
 * )
 * const sources = [
 *   source(ParameterArgument.make({ parameterId: ParameterId.make("newTitle") })),
 *   source(CurrentTimeArgument.make({})),
 * ]
 * sources // => [O.some("newTitle"), O.none()]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LogicRuleArgument = LogicRuleArgumentKind.mapMembers(() =>
  Tuple.make(
    ParameterArgument,
    StaticArgument,
    ObjectPropertyArgument,
    InterfacePropertyArgument,
    CurrentUserArgument,
    CurrentTimeArgument,
    UniqueIdentifierArgument,
    WebhookOutputArgument
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("LogicRuleArgument", {
    description: "Where a logic rule takes one value from: a parameter, a constant, a passed object or the context.",
  })
);

/**
 * Runtime type of {@link LogicRuleArgument}.
 *
 * @category models
 * @since 0.0.0
 */
export type LogicRuleArgument = typeof LogicRuleArgument.Type;

/**
 * Takes the value of one field of a struct parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class StructFieldValueArgument extends S.Opaque<StructFieldValueArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("structParameterFieldValue"),
    parameterId: ParameterId.annotateKey({ description: "Struct parameter to read from." }),
    structParameterFieldApiName: StructFieldApiName.annotateKey({ description: "Field of that struct to read." }),
  }).pipe(
    $I.annoteSchema("StructFieldValueArgument", {
      description: "Takes the value of one field of a struct parameter.",
    })
  )
) {}

/**
 * Takes the values of one field across every entry of a list-of-structs parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class StructListFieldValueArgument extends S.Opaque<
  StructListFieldValueArgument,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("structListParameterFieldValue"),
    parameterId: ParameterId.annotateKey({ description: "List-of-structs parameter to read from." }),
    structParameterFieldApiName: StructFieldApiName.annotateKey({ description: "Field of each struct to read." }),
  }).pipe(
    $I.annoteSchema("StructListFieldValueArgument", {
      description: "Takes the values of one field across every entry of a list-of-structs parameter.",
    })
  )
) {}

/**
 * Where a logic rule takes the value of one field of a struct property from.
 *
 * **Example** (Decode a struct field argument)
 *
 * ```ts import.meta.vitest name="Decode a struct field argument"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StructFieldArgument } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const argument = await Effect.runPromise(
 *   S.decodeUnknownEffect(StructFieldArgument)({
 *     type: "structParameterFieldValue",
 *     parameterId: "address",
 *     structParameterFieldApiName: "city",
 *   })
 * )
 * const path = `${argument.parameterId}.${argument.structParameterFieldApiName}`
 * path // => "address.city"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StructFieldArgument = StructFieldArgumentKind.mapMembers(() =>
  Tuple.make(StructFieldValueArgument, StructListFieldValueArgument)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("StructFieldArgument", {
    description: "Where a logic rule takes the value of one field of a struct property from.",
  })
);

/**
 * Runtime type of {@link StructFieldArgument}.
 *
 * @category models
 * @since 0.0.0
 */
export type StructFieldArgument = typeof StructFieldArgument.Type;

const PropertyArguments = S.Record(PropertyApiName, LogicRuleArgument);
const StructPropertyArguments = S.Record(PropertyApiName, S.Record(StructFieldApiName, StructFieldArgument));
const SharedPropertyArguments = S.Record(SharedPropertyTypeApiName, LogicRuleArgument);
const SharedStructPropertyArguments = S.Record(
  SharedPropertyTypeApiName,
  S.Record(StructFieldApiName, StructFieldArgument)
);

// -----------------------------------------------------------------------------
// Logic rules
// -----------------------------------------------------------------------------

/**
 * Creates an object of a fixed object type from the given arguments.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateObjectRule extends S.Opaque<CreateObjectRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("createObject"),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the created object." }),
    propertyArguments: PropertyArguments.annotateKey({ description: "Source of each property's value." }),
    structPropertyArguments: StructPropertyArguments.annotateKey({
      description: "Source of each struct property's value, field by field.",
    }),
  }).pipe(
    $I.annoteSchema("CreateObjectRule", {
      description: "Creates an object of a fixed object type from the given arguments.",
    })
  )
) {}

/**
 * Modifies the object passed in a parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class ModifyObjectRule extends S.Opaque<ModifyObjectRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("modifyObject"),
    objectToModify: ParameterId.annotateKey({ description: "Parameter that carries the object to modify." }),
    propertyArguments: PropertyArguments.annotateKey({ description: "Source of each property's new value." }),
    structPropertyArguments: StructPropertyArguments.annotateKey({
      description: "Source of each struct property's new value, field by field.",
    }),
  }).pipe($I.annoteSchema("ModifyObjectRule", { description: "Modifies the object passed in a parameter." }))
) {}

/**
 * Creates an object of a fixed object type, or modifies it when it already exists.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateOrModifyObjectRule extends S.Opaque<CreateOrModifyObjectRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("createOrModifyObject"),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the target object." }),
    propertyArguments: PropertyArguments.annotateKey({ description: "Source of each property's value." }),
    structPropertyArguments: StructPropertyArguments.annotateKey({
      description: "Source of each struct property's value, field by field.",
    }),
  }).pipe(
    $I.annoteSchema("CreateOrModifyObjectRule", {
      description: "Creates an object of a fixed object type, or modifies it when it already exists.",
    })
  )
) {}

/**
 * Creates the object a parameter refers to, or modifies it when it already exists.
 *
 * **Details**
 *
 * This is the wire's `createOrModifyObjectV2`. It differs from
 * {@link CreateOrModifyObjectRule} only in how the target is named: by the
 * parameter that carries it rather than by its object type.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateOrModifyObjectParameterRule extends S.Opaque<
  CreateOrModifyObjectParameterRule,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("createOrModifyObjectV2"),
    objectToModify: ParameterId.annotateKey({ description: "Parameter that carries the target object." }),
    propertyArguments: PropertyArguments.annotateKey({ description: "Source of each property's value." }),
    structPropertyArguments: StructPropertyArguments.annotateKey({
      description: "Source of each struct property's value, field by field.",
    }),
  }).pipe(
    $I.annoteSchema("CreateOrModifyObjectParameterRule", {
      description: "Creates the object a parameter refers to, or modifies it when it already exists.",
    })
  )
) {}

/**
 * Deletes the object passed in a parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteObjectRule extends S.Opaque<DeleteObjectRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deleteObject"),
    objectToDelete: ParameterId.annotateKey({ description: "Parameter that carries the object to delete." }),
  }).pipe($I.annoteSchema("DeleteObjectRule", { description: "Deletes the object passed in a parameter." }))
) {}

/**
 * Creates a link of one link type between the objects passed in two parameters.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateLinkRule extends S.Opaque<CreateLinkRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("createLink"),
    linkTypeApiName: LinkTypeApiName.annotateKey({ description: "Link type, named from the source object's side." }),
    sourceObject: ParameterId.annotateKey({ description: "Parameter that carries the source object." }),
    targetObject: ParameterId.annotateKey({ description: "Parameter that carries the target object." }),
  }).pipe(
    $I.annoteSchema("CreateLinkRule", {
      description: "Creates a link of one link type between the objects passed in two parameters.",
    })
  )
) {}

/**
 * Deletes the link of one link type between the objects passed in two parameters.
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteLinkRule extends S.Opaque<DeleteLinkRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deleteLink"),
    linkTypeApiName: LinkTypeApiName.annotateKey({ description: "Link type, named from the source object's side." }),
    sourceObject: ParameterId.annotateKey({ description: "Parameter that carries the source object." }),
    targetObject: ParameterId.annotateKey({ description: "Parameter that carries the target object." }),
  }).pipe(
    $I.annoteSchema("DeleteLinkRule", {
      description: "Deletes the link of one link type between the objects passed in two parameters.",
    })
  )
) {}

/**
 * Creates an object through an interface, with the concrete object type chosen by a parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateInterfaceRule extends S.Opaque<CreateInterfaceRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("createInterface"),
    interfaceTypeApiName: InterfaceTypeApiName.annotateKey({ description: "Interface the created object implements." }),
    objectType: ParameterId.annotateKey({ description: "Parameter that names the concrete object type to create." }),
    sharedPropertyArguments: SharedPropertyArguments.annotateKey({
      description: "Source of each shared property's value.",
    }),
    structPropertyArguments: SharedStructPropertyArguments.annotateKey({
      description: "Source of each shared struct property's value, field by field.",
    }),
  }).pipe(
    $I.annoteSchema("CreateInterfaceRule", {
      description: "Creates an object through an interface, with the concrete object type chosen by a parameter.",
    })
  )
) {}

/**
 * Modifies, through an interface, the object passed in a parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class ModifyInterfaceRule extends S.Opaque<ModifyInterfaceRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("modifyInterface"),
    interfaceObjectToModify: ParameterId.annotateKey({
      description: "Parameter that carries the interface object to modify.",
    }),
    sharedPropertyArguments: SharedPropertyArguments.annotateKey({
      description: "Source of each shared property's new value.",
    }),
    structPropertyArguments: SharedStructPropertyArguments.annotateKey({
      description: "Source of each shared struct property's new value, field by field.",
    }),
  }).pipe(
    $I.annoteSchema("ModifyInterfaceRule", {
      description: "Modifies, through an interface, the object passed in a parameter.",
    })
  )
) {}

/**
 * Creates a link declared on an interface between the objects passed in two parameters.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateInterfaceLinkRule extends S.Opaque<CreateInterfaceLinkRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("createInterfaceLink"),
    interfaceTypeApiName: InterfaceTypeApiName.annotateKey({ description: "Interface that declares the link." }),
    interfaceLinkTypeApiName: InterfaceLinkTypeApiName.annotateKey({ description: "Link declared on the interface." }),
    sourceObject: ParameterId.annotateKey({ description: "Parameter that carries the source object." }),
    targetObject: ParameterId.annotateKey({ description: "Parameter that carries the target object." }),
  }).pipe(
    $I.annoteSchema("CreateInterfaceLinkRule", {
      description: "Creates a link declared on an interface between the objects passed in two parameters.",
    })
  )
) {}

/**
 * Deletes a link declared on an interface between the objects passed in two parameters.
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteInterfaceLinkRule extends S.Opaque<DeleteInterfaceLinkRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deleteInterfaceLink"),
    interfaceTypeApiName: InterfaceTypeApiName.annotateKey({ description: "Interface that declares the link." }),
    interfaceLinkTypeApiName: InterfaceLinkTypeApiName.annotateKey({ description: "Link declared on the interface." }),
    sourceObject: ParameterId.annotateKey({ description: "Parameter that carries the source object." }),
    targetObject: ParameterId.annotateKey({ description: "Parameter that carries the target object." }),
  }).pipe(
    $I.annoteSchema("DeleteInterfaceLinkRule", {
      description: "Deletes a link declared on an interface between the objects passed in two parameters.",
    })
  )
) {}

// A function rule and the payload a batched function rule nests (the same record without its tag).
const functionCallFields = {
  functionRid: FunctionRid.annotateKey({ description: "Function to run." }),
  functionVersion: FunctionVersion.annotateKey({ description: "Version of the function to run." }),
  functionInputValues: S.Record(S.NonEmptyString, LogicRuleArgument).annotateKey({
    description: "Source of each function input, by input name.",
  }),
};

/**
 * Runs one version of a function and applies the edits it returns.
 *
 * @category models
 * @since 0.0.0
 */
export class FunctionRule extends S.Opaque<FunctionRule, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("function"), ...functionCallFields }).pipe(
    $I.annoteSchema("FunctionRule", {
      description: "Runs one version of a function and applies the edits it returns.",
    })
  )
) {}

/**
 * Which function a batched rule runs and where its inputs come from.
 *
 * @category models
 * @since 0.0.0
 */
export class FunctionCall extends S.Opaque<FunctionCall, { readonly brand: unique symbol }>()(
  S.Struct(functionCallFields).pipe(
    $I.annoteSchema("FunctionCall", {
      description: "Which function a batched rule runs and where its inputs come from.",
    })
  )
) {}

/**
 * Runs a function once for a whole batch of applications, with one input receiving the batch as an object set.
 *
 * **Details**
 *
 * The reading comes from the field names (`objectSetRidInputName`); the
 * platform documents no more. The nested function call is the payload of a
 * {@link FunctionRule} without its tag.
 *
 * @category models
 * @since 0.0.0
 */
export class BatchedFunctionRule extends S.Opaque<BatchedFunctionRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("batchedFunction"),
    objectSetRidInputName: S.NonEmptyString.annotateKey({
      description: "Function input that receives the object set of the batch.",
    }),
    // The function to run and its other inputs.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    functionRule: FunctionCall,
  }).pipe(
    $I.annoteSchema("BatchedFunctionRule", {
      description: "Runs a function once for a whole batch of applications, with one input receiving the batch.",
    })
  )
) {}

/**
 * Merges the edits staged on the scenario passed in a parameter into the ontology.
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyScenarioRule extends S.Opaque<ApplyScenarioRule, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("applyScenario"),
    scenarioParameter: ParameterId.annotateKey({ description: "Parameter that carries the scenario reference." }),
    objectTypeApiNames: S.Array(ObjectTypeApiName).annotateKey({
      description: "Object types the scenario's edits may touch.",
    }),
    linkTypes: S.Array(ScenarioLinkScope).annotateKey({ description: "Link types the scenario's edits may touch." }),
  }).pipe(
    $I.annoteSchema("ApplyScenarioRule", {
      description: "Merges the edits staged on the scenario passed in a parameter into the ontology.",
    })
  )
) {}

/**
 * One step of what an action does, with the source of every value it writes.
 *
 * **Details**
 *
 * The 14 kinds do not map one to one onto the nine operation kinds: the two
 * create-or-modify rules, the two function rules and the two interface link
 * rules have no operation of their own, and deleting through an interface is
 * an operation with no rule.
 *
 * **Example** (List the parameters a rule takes its target from)
 *
 * ```ts import.meta.vitest name="List the parameters a rule takes its target from"
 * import { LinkTypeApiName, ParameterId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ActionLogicRule, CreateLinkRule } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const targets = ActionLogicRule.matchOrElse(
 *   {
 *     modifyObject: ({ objectToModify }) => [objectToModify],
 *     deleteObject: ({ objectToDelete }) => [objectToDelete],
 *     createLink: ({ sourceObject, targetObject }) => [sourceObject, targetObject],
 *     deleteLink: ({ sourceObject, targetObject }) => [sourceObject, targetObject],
 *   },
 *   () => []
 * )
 * const assign = CreateLinkRule.make({
 *   linkTypeApiName: LinkTypeApiName.make("occupants"),
 *   sourceObject: ParameterId.make("office"),
 *   targetObject: ParameterId.make("employee"),
 * })
 * targets(assign) // => ["office", "employee"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionLogicRule = ActionLogicRuleKind.mapMembers(() =>
  Tuple.make(
    CreateObjectRule,
    ModifyObjectRule,
    CreateOrModifyObjectRule,
    CreateOrModifyObjectParameterRule,
    DeleteObjectRule,
    CreateLinkRule,
    DeleteLinkRule,
    CreateInterfaceRule,
    ModifyInterfaceRule,
    CreateInterfaceLinkRule,
    DeleteInterfaceLinkRule,
    FunctionRule,
    BatchedFunctionRule,
    ApplyScenarioRule
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ActionLogicRule", {
    description: "One step of what an action does, with the source of every value it writes.",
  })
);

/**
 * Runtime type of {@link ActionLogicRule}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionLogicRule = typeof ActionLogicRule.Type;

/**
 * An action type together with its logic rules: everything the platform publishes about one action.
 *
 * **Example** (Decode an action type with its rules)
 *
 * ```ts import.meta.vitest name="Decode an action type with its rules"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ActionTypeDefinition } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const definition = await Effect.runPromise(
 *   S.decodeUnknownEffect(ActionTypeDefinition)({
 *     actionType: {
 *       apiName: "closeOffice",
 *       rid: "ri.ontology.main.action-type.close-office",
 *       status: "ACTIVE",
 *       parameters: {
 *         office: {
 *           displayName: "Office",
 *           dataType: { type: "object", objectApiName: "Office", objectTypeApiName: "Office" },
 *           required: true,
 *           typeClasses: [],
 *         },
 *       },
 *       operations: [{ type: "deleteObject", objectTypeApiName: "Office" }],
 *     },
 *     fullLogicRules: [{ type: "deleteObject", objectToDelete: "office" }],
 *   })
 * )
 * const kinds = A.map(definition.fullLogicRules, (rule) => rule.type)
 * kinds // => ["deleteObject"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionTypeDefinition extends S.Opaque<ActionTypeDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    // The action type and the summary of its operations.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    actionType: ActionType,
    fullLogicRules: S.Array(ActionLogicRule).annotateKey({
      description: "The steps of the action, with the source of every value they write.",
    }),
  }).pipe(
    $I.annoteSchema("ActionTypeDefinition", {
      description: "An action type together with its logic rules: everything the platform publishes about one action.",
    })
  )
) {}
