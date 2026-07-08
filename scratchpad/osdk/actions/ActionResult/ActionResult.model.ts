/**
 * TODO:MODULE_DESCRIPTION
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as S from "effect/Schema";
import {$ScratchpadId} from "@beep/identity";
import {SchemaUtils} from "@beep/schema";

const $I = $ScratchpadId.create("actions/ActionResults/ActionResults.model");

// These are migrated from @osdk/foundry.internal to avoid coupling the apis

class ObjectReference extends S.Class<ObjectReference>($I`ObjectReference`)({
	primaryKey: S.Union([
		S.String,
		S.Number,
	]),
	objectType: S.String,
}, $I.annote("ObjectReference", {
	description: "",
})) {
}

class LinkReference extends S.Class<LinkReference>($I`LinkReference`)({
	linkTypeApiNameAtoB: S.String,
	linkTypeApiNameBtoA: S.String,
	aSideObject: ObjectReference,
	bSideObject: ObjectReference,
}, $I.annote("LinkReference", {
	description: "",
})) {
}

class ObjectEdits extends S.Class<ObjectEdits>($I`ObjectEdits`)({
	type: S.tag("edits"),
	addedObjects: S.Array(ObjectReference),
	modifiedObjects: S.Array(ObjectReference),
	deletedObjects: ObjectReference.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	addedLinks: S.Array(LinkReference),
	deletedLinks: LinkReference.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	deletedObjectsCount: S.Int,
	deletedLinksCount: S.Int,
}, $I.annote("ObjectEdits", {
	description: "",
})) {
}

class LargeScaleObjectEdits extends S.Class<LargeScaleObjectEdits>($I`LargeScaleObjectEdits`)({
	type: S.tag("largeScaleEdits"),
	addedObjects: S.optionalKey(S.Never),
	modifiedObjects: S.optionalKey(S.Never),
	deletedObjects: S.optionalKey(S.Never),
	addedLinks: S.optionalKey(S.Never),
	deletedLinks: S.optionalKey(S.Never),
	deletedObjectsCount: S.optionalKey(S.Never),
	deletedLinksCount: S.optionalKey(S.Never),
}, $I.annote("LargeScaleObjectEdits", {
	description: "",
})) {
}

class SubmissionCriteriaBase extends S.Class<SubmissionCriteriaBase>($I`SubmissionCriteriaBase`)({
	configuredFailureMessage: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}, $I.annote("SubmissionCriteriaBase", {
	description: "",
})) {
}

class SubmissionCriteriaValid extends SubmissionCriteriaBase.extend<SubmissionCriteriaValid>($I`SubmissionCriteriaValid`)({
		result: S.tag("VALID"),
	},
	$I.annote("SubmissionCriteriaValid", {
		description: "",
	}),
) {
}

class SubmissionCriteriaInvalid extends SubmissionCriteriaBase.extend<SubmissionCriteriaInvalid>($I`SubmissionCriteriaInvalid`)({
		result: S.tag("INVALID"),
	},
	$I.annote("SubmissionCriteriaInvalid", {
		description: "",
	}),
) {
}

const SubmissionCriteria = S.Union([
	SubmissionCriteriaValid,
	SubmissionCriteriaInvalid,
]).pipe(S.toTaggedUnion("result"), $I.annoteSchema("SubmissionCriteria", {
	description: "",
}))

export type SubmissionCriteria = typeof SubmissionCriteria.Type;


class OneOfOptionValue extends S.Class<OneOfOptionValue>($I`OneOfOptionValue`)({
	displayName: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	value: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}, $I.annote("OneOfOptionValue", {
	description: "",
})) {
}

export const ParameterEvaluatedConstraint = S.TaggedUnion({
	arraySize: {
		lt: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		lte: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		gt: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		gte: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	},
	groupMember: {},
	objectPropertyValue: {},
	objectQueryResult: {},
	oneOf: {
		options: S.Array(OneOfOptionValue),
		otherValuesAllowed: S.Boolean,
	},
	range: {
		lt: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		lte: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		gt: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		gte: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	},
	stringLength: {
		lt: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		lte: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		gt: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
		gte: S.Any.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	},
	stringRegexMatch: {
		regex: S.String,
		configuredFailureMessage: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	},
	unevaluable: {},
}).pipe($I.annoteSchema("ParameterEvaluatedConstraint", {
	description: "",
}))

export type ParameterEvaluatedConstraint = typeof ParameterEvaluatedConstraint.Type;

export class ValidateActionParamValueBase extends S.Class<ValidateActionParamValueBase>($I`ValidateActionParamValueBase`)({
		evaluatedConstraints: S.Array(ParameterEvaluatedConstraint),
		required: S.Boolean,
	},
	$I.annote("ValidateActionParamValueBase", {
		description: "",
	}),
) {
}

export class ValidateActionParamValueValid extends ValidateActionParamValueBase.extend<ValidateActionParamValueValid>($I`ValidateActionParamValueValid`)({
		result: S.tag("VALID"),
	},
	$I.annote("ValidateActionParamValueValid", {
		description: "",
	}),
) {
}

export class ValidateActionParamValueInvalid extends ValidateActionParamValueBase.extend<ValidateActionParamValueInvalid>(
	$I`ValidateActionParamValueInvalid`)(
	{
		result: S.tag("INVALID"),
	},
	$I.annote("ValidateActionParamValueInvalid", {
		description: "",
	}),
) {
}

export const ValidateActionParamValue = S.Union([
	ValidateActionParamValueValid,
	ValidateActionParamValueInvalid,
]).pipe(S.toTaggedUnion("result"), $I.annoteSchema("ValidateActionParamValue", {
	description: "",
}))

export type ValidateActionParamValue = typeof ValidateActionParamValue.Type


export class ValidateActionResponseV2Base extends S.Class<ValidateActionResponseV2Base>($I`ValidateActionResponseV2Base`)({
		submissionCriteria: S.Array(SubmissionCriteria),
		parameters: S.Record(S.String, ValidateActionParamValue),
	},
	$I.annote("ValidateActionResponseV2Base", {
		description: "",
	}),
) {
}

export class ValidateActionResponseV2Valid extends ValidateActionResponseV2Base.extend<ValidateActionResponseV2Valid>($I`ValidateActionResponseV2Valid`)({
		result: S.tag("VALID"),
	},
	$I.annote("ValidateActionResponseV2Valid", {
		description: "",
	}),
) {
}

export class ValidateActionResponseV2Invalid extends ValidateActionResponseV2Base.extend<ValidateActionResponseV2Invalid>(
	$I`ValidateActionResponseV2Invalid`)(
	{
		result: S.tag("INVALID"),
	},
	$I.annote("ValidateActionResponseV2Invalid", {
		description: "",
	}),
) {
}

export const ValidateActionResponseV2 = S.Union([
	ValidateActionResponseV2Valid,
	ValidateActionResponseV2Invalid,
]).pipe(S.toTaggedUnion("result"), $I.annoteSchema("ValidateActionResponseV2", {
	description: "",
}))

export type ValidateActionResponseV2 = typeof ValidateActionResponseV2.Type


export class ActionResultObjectEdits extends ObjectEdits.extend<ActionResultObjectEdits>($I`ActionResultObjectEdits`)({
	_tag: S.tag("ObjectEdits"),
	editedObjectTypes: S.Array(S.String),
}) {
}

export class ActionResultLargeScaleObjectEdits extends LargeScaleObjectEdits.extend<ActionResultLargeScaleObjectEdits>(
	$I`ActionResultLargeScaleObjectEdits`)(
	{
		_tag: S.tag("LargeScaleObjectEdits"),
		editedObjectTypes: S.Array(S.String),
	}) {
}

export const ActionResult = S.Union([
	ActionResultObjectEdits,
	ActionResultLargeScaleObjectEdits,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("ActionResults", {
	description: "",
}))

export type ActionResult = typeof ActionResult.Type;