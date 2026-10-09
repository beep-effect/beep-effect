import { Toml } from "../toml/index.ts";
import * as Effect from "effect/Effect";
import type { FrontmatterCodec } from "./Frontmatter.ts";
import { FrontmatterDecodeError, FrontmatterEncodeError, FrontmatterFormatMismatchError } from "./Frontmatter.ts";

/**
 * The toml frontmatter codec, over `@effected/toml`.
 *
 * **Details**
 *
 * Decodes a `+++`-fenced capture's raw value with `Toml.parse`, so the toml
 * engine's nesting depth cap fails through the typed channel: a hostile
 * frontmatter block surfaces as a {@link FrontmatterDecodeError} carrying the
 * `TomlParseError` structurally, never a defect. An empty capture decodes to
 * an empty table (`{}`), toml's empty-document value.
 *
 * Encodes with `Toml.stringify`; a value toml cannot represent fails as a
 * {@link FrontmatterEncodeError} carrying the `TomlStringifyError`
 * structurally. An empty object encodes to the **empty body** — the mirror
 * of an empty capture decoding to `{}` — rendering as adjacent `+++` fences,
 * so `set`-then-decode recovers `{}` exactly.
 *
 * `@effected/toml` is an optional peer — importing this module is what
 * requires it; a consumer who never touches toml frontmatter never loads the
 * toml engine.
 *
 * @public
 */
export const TomlFrontmatter: FrontmatterCodec = {
	format: "toml",
	decode: (node) =>
		node.format !== "toml"
			? Effect.fail(FrontmatterFormatMismatchError.make({ expected: "toml", actual: node.format }))
			: Toml.parse(node.value).pipe(Effect.mapError((cause) => FrontmatterDecodeError.make({ format: "toml", cause }))),
	encode: (data) =>
		Toml.stringify(data).pipe(Effect.mapError((cause) => FrontmatterEncodeError.make({ format: "toml", cause }))),
};
