import { Toml } from "../toml/index.ts";
import * as Effect from "effect/Effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

/**
 * A `ConfigCodec` backed by `@effected/toml`.
 *
 * @remarks
 * `@effected/toml`'s input hardening — a nesting-depth cap on arrays and
 * inline tables, enforced independently on both the parse and stringify
 * sides — fails through the typed error channel, so a hostile config file
 * surfaces as a `ConfigCodecError` rather than crashing the process. Both
 * directions preserve the underlying failure structurally in `cause` —
 * never stringified.
 *
 * Stringify is genuinely fallible beyond hostile input: TOML has no null,
 * so a document carrying `null` (or any other unrepresentable value, an
 * out-of-int64-range `bigint`, a circular reference) fails with a
 * `ConfigCodecError` whose `cause` is the structured `TomlStringifyError`.
 *
 * @public
 */
export const TomlCodec: ConfigCodec = {
	name: "toml",
	parse: (raw) =>
		Toml.parse(raw).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "toml", operation: "parse", cause })),
		),
	stringify: (value) =>
		Toml.stringify(value).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "toml", operation: "stringify", cause })),
		),
};
