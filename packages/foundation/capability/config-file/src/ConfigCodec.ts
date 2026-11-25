/**
 * The codec contract every config format implements: `parse` text into a document and `stringify` a
 * document back, failing with a typed `ConfigCodecError` that names the codec and the operation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ConfigFileId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";

const $I = $ConfigFileId.create("ConfigCodec");

/**
 * **Details**
 *
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
 * **Example** (Inspect a parse failure)
 *
 * ```ts
 * import { ConfigCodecError } from "@beep/config-file/ConfigCodec"
 *
 * const error = ConfigCodecError.make({ codec: "json", operation: "parse", cause: "invalid JSON", path: "/app/config.json" });
 * console.log(error.message) // json parse failed
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ConfigCodecError extends S.TaggedError<ConfigCodecError, { readonly brand: unique symbol }>(
  $I`ConfigCodecError`
)(
  "ConfigCodecError",
  {
    /**
     * The codec that failed, e.g. `"json"`.
     *
     * @since 0.0.0
     */
    codec: S.String.pipe(
      $I.annoteKey("ConfigCodecError.codec", { description: 'The codec that failed, e.g. `"json"`.' })
    ),
    /**
     * Which direction failed.
     *
     * @since 0.0.0
     */
    operation: S.Literals(["parse", "stringify"]).pipe(
      $I.annoteKey("ConfigCodecError.operation", { description: "Which direction failed." })
    ),
    /**
     * The underlying failure, preserved structurally.
     *
     * @since 0.0.0
     */
    cause: S.Defect().pipe(
      $I.annoteKey("ConfigCodecError.cause", { description: "The underlying failure, preserved structurally." })
    ),
    /**
     * The file the content came from, when a caller knew it.
     *
     * **Details**
     *
     * A codec sees a string, never a path, so it cannot fill this in itself.
     * `ConfigFile`'s read/write pipeline does: every site that feeds a codec a
     * path it resolved re-raises the error with `path` attached, so a discovery
     * pass over several candidates still names the file that failed. Absent
     * only when a codec was driven directly, outside that pipeline.
     *
     * @since 0.0.0
     */
    path: S.optionalKey(S.String).pipe(
      $I.annoteKey("ConfigCodecError.path", { description: "The file the content came from, when a caller knew it." })
    ),
  },
  $I.annoteError<ConfigCodecError>("ConfigCodecError", {
    description: "Indicates that a codec failed to parse or stringify configuration content.",
  })
) {
  /**
   * Summarizes the codec and failed operation without repeating the file path.
   *
   * **Details**
   *
   * Read `path` separately when rendering the offending file alongside this summary.
   *
   * **Example** (Render the codec summary)
   *
   * ```ts
   * import { ConfigCodecError } from "@beep/config-file/ConfigCodec"
   *
   * const error = ConfigCodecError.make({ codec: "toml", operation: "stringify", cause: "unsupported value" });
   * console.log(error.message) // toml stringify failed
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `${this.codec} ${this.operation} failed`;
  }
}

/**
 * A pluggable configuration file codec: how to turn file content into a value
 * and back.
 *
 * **Details**
 *
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
 * @category codecs
 * @since 0.0.0
 */
export interface ConfigCodec<E = ConfigCodecError> {
  /**
   * The codec's name, e.g. `"json"`; recorded on {@link ConfigCodecError} and in events.
   *
   * @since 0.0.0
   */
  readonly name: string;
  /**
   * Turn file content into an unknown document.
   *
   * @since 0.0.0
   */
  readonly parse: (raw: string) => Effect.Effect<unknown, E>;
  /**
   * Turn a document back into file content.
   *
   * @since 0.0.0
   */
  readonly stringify: (value: unknown) => Effect.Effect<string, E>;
}
