import { Yaml } from "../yaml/index.ts";
import { Effect } from "effect";
import type { FrontmatterCodec } from "./Frontmatter.ts";
import { FrontmatterDecodeError, FrontmatterEncodeError, FrontmatterFormatMismatchError } from "./Frontmatter.ts";

/**
 * The yaml frontmatter codec, over `@effected/yaml`.
 *
 * @remarks
 * Decodes a `---`-fenced capture's raw value with `Yaml.parse`, so the yaml
 * engine's input hardening — the alias-expansion budget and the nesting depth
 * cap — fails through the typed channel: a hostile frontmatter block surfaces
 * as a {@link FrontmatterDecodeError} carrying the `YamlParseError`
 * structurally, never a defect. An empty capture decodes to `null`, yaml's
 * empty-document value.
 *
 * Encodes with `Yaml.stringify`; an unserializable value fails as a
 * {@link FrontmatterEncodeError} carrying the `YamlStringifyError`
 * structurally. An empty object encodes to the flow mapping `{}` —
 * deliberately not an empty body, which would round-trip as `null` — so
 * `set`-then-decode recovers `{}` exactly.
 *
 * `@effected/yaml` is an optional peer — importing this module is what
 * requires it; a consumer who never touches yaml frontmatter never loads the
 * yaml engine.
 *
 * @public
 */
export const YamlFrontmatter: FrontmatterCodec = {
	format: "yaml",
	decode: (node) =>
		node.format !== "yaml"
			? Effect.fail(FrontmatterFormatMismatchError.make({ expected: "yaml", actual: node.format }))
			: Yaml.parse(node.value).pipe(Effect.mapError((cause) => FrontmatterDecodeError.make({ format: "yaml", cause }))),
	encode: (data) =>
		Yaml.stringify(data).pipe(Effect.mapError((cause) => FrontmatterEncodeError.make({ format: "yaml", cause }))),
};
