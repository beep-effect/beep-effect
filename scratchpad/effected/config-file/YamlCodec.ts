import { Yaml } from "../yaml/index.ts";
import { Effect } from "effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

/**
 * A `ConfigCodec` backed by `@effected/yaml`.
 *
 * @remarks
 * `@effected/yaml`'s input hardening — an alias-expansion budget guarding
 * against "billion laughs" alias bombs, and a collection-nesting depth cap —
 * fails through the typed error channel, so a hostile config file surfaces
 * as a `ConfigCodecError` rather than crashing the process. Both directions
 * preserve the underlying failure structurally in `cause` — never
 * stringified.
 *
 * @public
 */
export const YamlCodec: ConfigCodec = {
	name: "yaml",
	parse: (raw) =>
		Yaml.parse(raw).pipe(
			Effect.mapError((cause) => new ConfigCodecError({ codec: "yaml", operation: "parse", cause })),
		),
	stringify: (value) =>
		Yaml.stringify(value).pipe(
			Effect.mapError((cause) => new ConfigCodecError({ codec: "yaml", operation: "stringify", cause })),
		),
};
