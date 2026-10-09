import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown));
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown, { space: 2 }));

/**
 * A `ConfigCodec` backed by the Schema JSON codec: plain JSON as
 * configuration file content.
 *
 * **Details**
 *
 * The only codec that reaches no parsing engine at all — it is why this
 * package can be depended on for JSON config alone without pulling a parser
 * into the bundle. Both directions preserve the underlying failure
 * structurally as a `SchemaError` in `cause` — never stringified.
 *
 * **Example** (Parse a plain JSON configuration)
 *
 * ```ts
 * import { JsonCodec } from "@beep/scratchpad/effected/config-file/JsonCodec";
 * import * as Effect from "effect/Effect";
 *
 * const value = Effect.runSync(JsonCodec.parse('{ "port": 3000 }'));
 * console.log(JSON.stringify(value)) // {"port":3000}
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const JsonCodec: ConfigCodec = {
	name: "json",
	parse: (raw) =>
		decodeJson(raw).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "json", operation: "parse", cause })),
		),
	stringify: (value) =>
		encodeJson(value).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "json", operation: "stringify", cause })),
		),
};
