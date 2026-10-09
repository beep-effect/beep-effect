import { Jsonc } from "../jsonc/index.ts";
import * as Effect from "effect/Effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

/**
 * A `ConfigCodec` backed by `@effected/jsonc`: JSON with comments and
 * trailing commas.
 *
 * **Details**
 *
 * Both directions use the module's own parse and stringify operations;
 * comments never survive a round-trip encode. Stringify uses two-space
 * indentation, matching `JsonCodec`.
 * Both directions preserve the underlying failure structurally in `cause` —
 * never stringified.
 *
 * @public
 */
export const JsoncCodec: ConfigCodec = {
	name: "jsonc",
	parse: (raw) =>
		Jsonc.parse(raw).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "jsonc", operation: "parse", cause })),
		),
	stringify: (value) =>
		Jsonc.stringify(value).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "jsonc", operation: "stringify", cause })),
		),
};
