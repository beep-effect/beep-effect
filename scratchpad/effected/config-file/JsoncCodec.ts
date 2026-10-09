import { Jsonc } from "../jsonc/index.ts";
import { Effect } from "effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

/**
 * A `ConfigCodec` backed by `@effected/jsonc`: JSON with comments and
 * trailing commas.
 *
 * @remarks
 * `@effected/jsonc` does not expose a `stringify` — its schema layer's encode
 * direction is `JSON.stringify` (comments never survive a round-trip encode;
 * see `Jsonc.fromString`'s remarks), so `stringify` here calls `JSON.stringify`
 * directly and wraps a thrown defect the same way `JsonCodec` does.
 * Both directions preserve the underlying failure structurally in `cause` —
 * never stringified.
 *
 * @public
 */
export const JsoncCodec: ConfigCodec = {
	name: "jsonc",
	parse: (raw) =>
		Jsonc.parse(raw).pipe(
			Effect.mapError((cause) => new ConfigCodecError({ codec: "jsonc", operation: "parse", cause })),
		),
	stringify: (value) =>
		Effect.try({
			try: () => JSON.stringify(value, null, 2),
			catch: (cause) => new ConfigCodecError({ codec: "jsonc", operation: "stringify", cause }),
		}),
};
