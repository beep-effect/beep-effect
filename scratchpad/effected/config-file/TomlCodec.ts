import { Toml } from "../toml/index.ts";
import * as Effect from "effect/Effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

/**
 * A `ConfigCodec` backed by `@effected/toml`.
 *
 * **Details**
 *
 * `@effected/toml`'s input hardening — a nesting-depth cap on arrays and
 * inline tables, enforced independently on both the parse and stringify
 * sides — fails through the typed error channel, so a hostile config file
 * surfaces as a `ConfigCodecError` rather than crashing the process. Both
 * directions preserve the underlying failure structurally in `cause` —
 * never stringified.
 *
 * Stringify is genuinely fallible beyond hostile input: TOML has no null,
 * so a document carrying `null` (or another unrepresentable value, an
 * out-of-int64-range `bigint`, a circular reference) fails with a
 * `ConfigCodecError` whose `cause` is the structured `TomlStringifyError`.
 *
 * **Example** (Parse and stringify a port setting)
 *
 * ```ts
 * import { TomlCodec } from "@beep/scratchpad/effected/config-file/TomlCodec";
 * import * as Effect from "effect/Effect";
 *
 * const parsed = Effect.runSync(TomlCodec.parse("port = 8080"));
 * console.log(JSON.stringify(parsed)); // {"port":8080}
 * const encoded = Effect.runSync(TomlCodec.stringify({ port: 8080 }));
 * console.log(encoded.trim()); // port = 8080
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
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
