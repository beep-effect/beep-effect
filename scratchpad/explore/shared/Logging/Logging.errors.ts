/**
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {TaggedErrorClass} from "@beep/schema";
import { P, Eq } from "@beep/utils";


const $I = $ScratchpadId.create("explore/shared/Logging/Logging.errors");

/**
 * {description}
 *
 * @example
 * ```ts
 * import { RotatingFileSinkConfigurationErrorMetaBase } from "@beep/explore";
 *
 * ```
 * @category Models
 * @since 0.0.0
 */
export class RotatingFileSinkConfigurationErrorMetaBase extends S.Class<RotatingFileSinkConfigurationErrorMetaBase>($I`RotatingFileSinkConfigurationErrorMetaBase`)({
		received: S.Finite,
		minimum: S.Finite,
	},
	$I.annote("RotatingFileSinkConfigurationErrorMetaBase", {
		description: "",
	}),
) {
}

/**
 * {description}
 *
 * @example
 * ```ts
 * import { RotatingFileSinkConfigurationErrorMetaMaxBytes } from "@beep/explore";
 *
 * ```
 * @category Models
 * @since 0.0.0
 */
export class RotatingFileSinkConfigurationErrorMetaMaxBytes extends RotatingFileSinkConfigurationErrorMetaBase.extend<RotatingFileSinkConfigurationErrorMetaMaxBytes>(
	$I`RotatingFileSinkConfigurationErrorMetaMaxBytes`)(
	{
		option: S.tag("maxBytes"),
	},
	$I.annote("RotatingFileSinkConfigurationErrorMetaMaxBytes", {
		description: "",
	}),
) {
}

/**
 * {description}
 *
 * @example
 * ```ts
 * import { RotatingFileSinkConfigurationErrorMetaMaxFiles } from "@beep/explore";
 *
 * ```
 * @category Models
 * @since 0.0.0
 */
export class RotatingFileSinkConfigurationErrorMetaMaxFiles extends RotatingFileSinkConfigurationErrorMetaBase.extend<RotatingFileSinkConfigurationErrorMetaMaxFiles>(
	$I`RotatingFileSinkConfigurationErrorMetaMaxFiles`)(
	{
		option: S.tag("maxFiles"),
	},
	$I.annote("RotatingFileSinkConfigurationErrorMetaMaxFiles", {
		description: "",
	}),
) {
}

/**
 * {description}
 *
 * @example
 * ```ts
 * import { RotatingFileSinkConfigurationErrorMeta } from "@beep/explore";
 *
 * ```
 * @category Models
 * @since 0.0.0
 */
export const RotatingFileSinkConfigurationErrorMeta = S.Union([
	RotatingFileSinkConfigurationErrorMetaMaxFiles,
	RotatingFileSinkConfigurationErrorMetaMaxBytes,
]).pipe(S.toTaggedUnion("option"), $I.annoteSchema("RotatingFileSinkConfigurationErrorMeta", {
	description: "",
}))

/**
 * Companion type for {@link RotatingFileSinkConfigurationErrorMeta}
 *
 * @category Models
 * @since 0.0.0
 */
export type RotatingFileSinkConfigurationErrorMeta = typeof RotatingFileSinkConfigurationErrorMeta.Type

/**
 * {description}
 *
 * @example
 * ```ts
 * import { RotatingFileSinkOptions } from "@beep/explore";
 *
 * RotatingFileSinkConfigurationError.make({
 *   option: "maxBytes" as const,
 *   received: 1000000,
 *   minimum: 1000000
 * })
 * ```
 * @category Models
 * @since 0.0.0
 */
export class RotatingFileSinkConfigurationError extends TaggedErrorClass<RotatingFileSinkConfigurationError>($I`RotatingFileSinkConfigurationError`)("RotatingFileSinkConfigurationError",
	{
		cause: S.OptionFromOptionalKey(S.Defect({
			includeStack: true,
		})),
		meta: RotatingFileSinkConfigurationErrorMeta,
	},
	$I.annote("RotatingFileSinkOptions", {
		description: "",
	}),
) {
	override get message(): string {
		return `${this.meta.option} must be >= ${this.meta.minimum} (received ${this.meta.received})`
	}
}

export class RotatingFileSinkErrorBase extends S.Class<RotatingFileSinkErrorBase>($I`RotatingFileSinkErrorBase`)({
	filePath: S.String,
}, $I.annote("RotatingFileSinkErrorBase", {
	description: "",
})) {
}

export class InitializeRotatingFileSinkErrorMeta extends RotatingFileSinkErrorBase.extend<InitializeRotatingFileSinkErrorMeta>(
	$I`InitializeRotatingFileSinkErrorMeta`)(
	{
		operation: S.tag("initialize"),
	},
	$I.annote("InitializeRotatingFileSinkErrorMeta", {
		description: "",
	}),
) {
}

export class ReadRotatingFileSinkErrorMeta extends RotatingFileSinkErrorBase.extend<ReadRotatingFileSinkErrorMeta>($I`ReadRotatingFileSinkErrorMeta`)({
		operation: S.tag("read"),
	},
	$I.annote("ReadRotatingFileSinkErrorMeta", {
		description: "",
	}),
) {
}

export class WriteRotatingFileSinkErrorMeta extends RotatingFileSinkErrorBase.extend<WriteRotatingFileSinkErrorMeta>($I`WriteRotatingFileSinkErrorMeta`)({
		operation: S.tag("write"),
	},
	$I.annote("WriteRotatingFileSinkErrorMeta", {
		description: "",
	}),
) {
}

export class RotateRotatingFileSinkErrorMeta extends RotatingFileSinkErrorBase.extend<RotateRotatingFileSinkErrorMeta>(
	$I`RotateRotatingFileSinkErrorMeta`)(
	{
		operation: S.tag("rotate"),
	},
	$I.annote("RotateRotatingFileSinkErrorMeta", {
		description: "",
	}),
) {
}

export class PruneRotatingFileSinkErrorMeta extends RotatingFileSinkErrorBase.extend<PruneRotatingFileSinkErrorMeta>($I`PruneRotatingFileSinkErrorMeta`)({
		operation: S.tag("prune"),
	},
	$I.annote("PruneRotatingFileSinkErrorMeta", {
		description: "",
	}),
) {
}

export const RotatingFileSinkErrorMeta = S.Union([
	PruneRotatingFileSinkErrorMeta,
	RotateRotatingFileSinkErrorMeta,
	WriteRotatingFileSinkErrorMeta,
	ReadRotatingFileSinkErrorMeta,
	InitializeRotatingFileSinkErrorMeta,
]).pipe(S.toTaggedUnion("operation"), $I.annoteSchema("RotatingFileSinkErrorMeta", {
	description: "",
}))

/**
 * Companion error meta for {@link RotatingFileSinkErrorMeta}
 *
 * @example
 * ```ts
 * import type { RotatingFileSinkErrorMeta } from "./Logging.errors";
 * ```
 *
 * @category Models
 * @since 0.0.0
 */
export type RotatingFileSinkErrorMeta = typeof RotatingFileSinkErrorMeta.Type;

export class RotatingFileSinkError extends TaggedErrorClass<RotatingFileSinkError>($I`RotatingFileSinkError`)("RotatingFileSinkError",
	{
		meta: RotatingFileSinkErrorMeta,
		cause: S.Defect({includeStack: true}),
	},
	$I.annote("RotatingFileSinkError", {
		description: "",
	}),
) {
	override get message(): string {
		return `Failed to ${this.meta.operation} rotating log file ${this.meta.filePath}`;
	}

	static readonly is = S.is(RotatingFileSinkError);


}

export const isFileNotFoundError = (cause: unknown): cause is NodeJS.ErrnoException =>
	P.chainRefinements(
		[
			S.is(S.Error()), P.hasProperty("code"), P.Struct({code: P.chainRefinements([P.isString, (str: string): str is "ENOENT" => Eq.equals("ENOENT", str)])})
		]
	)(cause)
