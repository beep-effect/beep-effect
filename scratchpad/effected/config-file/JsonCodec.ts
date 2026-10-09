import * as Effect from "effect/Effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

/**
 * A `ConfigCodec` backed by the host `JSON` global: plain JSON as
 * configuration file content.
 *
 * @remarks
 * The only codec that reaches no parsing engine at all — it is why this
 * package can be depended on for JSON config alone without pulling a parser
 * into the bundle. Both directions preserve the underlying failure
 * structurally in `cause` — never stringified.
 *
 * @public
 */
export const JsonCodec: ConfigCodec = {
	name: "json",
	parse: (raw) =>
		Effect.try({
			// The codec preserves the original SyntaxError in cause; Schema JSON decoding discards that throwable.
			// @effect-diagnostics-next-line preferSchemaOverJson:off
			try: () => JSON.parse(raw) as unknown,
			catch: (cause) => ConfigCodecError.make({ codec: "json", operation: "parse", cause }),
		}),
	stringify: (value) =>
		Effect.try({
			// The codec preserves native TypeError causes and JSON.stringify returning undefined; Schema encoding changes both.
			// @effect-diagnostics-next-line preferSchemaOverJson:off
			try: () => JSON.stringify(value, null, 2),
			catch: (cause) => ConfigCodecError.make({ codec: "json", operation: "stringify", cause }),
		}),
};
