import type { Effect } from "effect";
import { Schema } from "effect";

/**
 * Indicates that a codec failed to parse or stringify configuration content.
 *
 * @remarks
 * The underlying failure is preserved structurally in `cause` — it is never
 * stringified. Route on the `"ConfigCodecError"` tag with `Effect.catchTag`.
 *
 * `path` names the offending file when the error came through `ConfigFile`,
 * which is what makes a failure during multi-candidate discovery reportable.
 *
 * `message` deliberately does NOT name the path — read `path` when you need it.
 * A wrapper that renders its own message almost always names the file too, so
 * a message carrying the path would compose into a rendering that prints the
 * same file twice. The doubling is the default outcome, not an unlucky one:
 * the field is the API, and the message is a bare summary.
 *
 * @public
 */
export class ConfigCodecError extends Schema.TaggedError<ConfigCodecError>()("ConfigCodecError", {
	/** The codec that failed, e.g. `"json"`. */
	codec: Schema.String,
	/** Which direction failed. */
	operation: Schema.Literals(["parse", "stringify"]),
	/** The underlying failure, preserved structurally. */
	cause: Schema.Defect(),
	/**
	 * The file the content came from, when a caller knew it.
	 *
	 * @remarks
	 * A codec sees a string, never a path, so it cannot fill this in itself.
	 * `ConfigFile`'s read/write pipeline does: every site that feeds a codec a
	 * path it resolved re-raises the error with `path` attached, so a discovery
	 * pass over several candidates still names the file that failed. Absent
	 * only when a codec was driven directly, outside that pipeline.
	 */
	path: Schema.optionalKey(Schema.String),
}) {
	override get message(): string {
		return `${this.codec} ${this.operation} failed`;
	}
}

/**
 * A pluggable configuration file codec: how to turn file content into a value
 * and back.
 *
 * @remarks
 * `E` is the codec's error channel. It defaults to {@link ConfigCodecError};
 * decorator codecs such as `EncryptedCodec` and `ConfigMigration.make` widen it
 * rather than flattening their own failures into a string.
 *
 * The four built-in codecs — `JsonCodec`, `JsoncCodec`, `YamlCodec` and
 * `TomlCodec` — are free-standing named exports, one per module, and are
 * deliberately never collected into a namespace object. Collecting them would
 * make this module a dispatch table: referencing it at all would reach every
 * codec, and every codec would reach its parsing engine, so importing the JSON
 * codec alone would drag the JSONC, YAML and TOML engines into the bundle.
 * Name the one codec you use and a bundler drops the rest.
 *
 * @public
 */
export interface ConfigCodec<E = ConfigCodecError> {
	/** The codec's name, e.g. `"json"`; recorded on {@link ConfigCodecError} and in events. */
	readonly name: string;
	/** Turn file content into an unknown document. */
	readonly parse: (raw: string) => Effect.Effect<unknown, E>;
	/** Turn a document back into file content. */
	readonly stringify: (value: unknown) => Effect.Effect<string, E>;
}
