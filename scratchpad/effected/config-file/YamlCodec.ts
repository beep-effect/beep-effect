import { Yaml } from "../yaml/index.ts";
import * as Effect from "effect/Effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";

/**
 * A `ConfigCodec` backed by `@effected/yaml`.
 *
 * **Details**
 *
 * `@effected/yaml`'s input hardening — an alias-expansion budget guarding
 * against "billion laughs" alias bombs, and a collection-nesting depth cap —
 * fails through the typed error channel, so a hostile config file surfaces
 * as a `ConfigCodecError` rather than crashing the process. Both directions
 * preserve the underlying failure structurally in `cause` — never
 * stringified.
 *
 * **Example** (Parse and stringify a port setting)
 *
 * ```ts
 * import { YamlCodec } from "@beep/scratchpad/effected/config-file/YamlCodec";
 * import * as Effect from "effect/Effect";
 *
 * const parsed = Effect.runSync(YamlCodec.parse("port: 8080"));
 * console.log(JSON.stringify(parsed)); // {"port":8080}
 * const encoded = Effect.runSync(YamlCodec.stringify({ port: 8080 }));
 * console.log(encoded.trim()); // port: 8080
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const YamlCodec: ConfigCodec = {
	name: "yaml",
	parse: (raw) =>
		Yaml.parse(raw).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "yaml", operation: "parse", cause })),
		),
	stringify: (value) =>
		Yaml.stringify(value).pipe(
			Effect.mapError((cause) => ConfigCodecError.make({ codec: "yaml", operation: "stringify", cause })),
		),
};
