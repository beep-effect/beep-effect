/**
 * One themed status line per call (`success`, `info`, `warning`, `failure`, `status`), written through `Console` on
 * the stream its rank selects, sanitised and neutralized under GitHub Actions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CommandNeutralizer } from "@beep/github-commands";
import { $CliKitId } from "@beep/identity/packages";
import { Audience } from "@beep/runtime-env";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { CliTheme } from "./CliTheme.ts";
import { sanitize } from "./Fmt.ts";
import { underGithubActions } from "./internal/autoFormat.ts";
import { Status } from "./Status.ts";

const $I = $CliKitId.create("CliMessage");

/**
 * **Example** (Send a status line to stderr)
 *
 * ```ts
 * import { CliMessageOptions } from "@beep/cli-kit/CliMessage";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CliMessageOptions)({ stream: "stderr" })) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CliMessageOptions extends S.Opaque<CliMessageOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Where the line goes. Defaults to stderr for a status whose rank is at or above `warning`'s in its
     * vocabulary, stdout otherwise.
     */
    stream: S.optionalKey(S.Literals(["stdout", "stderr"])).pipe(
      $I.annoteKey("CliMessageOptions.stream", { description: "The output stream override for a status line." })
    ),
  }).pipe($I.annoteSchema("CliMessageOptions", { description: "Plain output routing options for a status message." }))
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CliMessageOptions } from "@beep/cli-kit/CliMessage"
 * import * as S from "effect/Schema"
 *
 * const plain: CliMessageOptions.Encoded = { stream: "stderr" }
 * console.log(S.is(CliMessageOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliMessageOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliMessageOptions.Encoded;
}

const isVocabularyFirst = (args: IArguments): boolean => args[0] instanceof Status;

/**
 * One-line status messages: a glyph and some text, themed for a person and plain for an agent.
 *
 * **Details**
 *
 * Each line goes through `Console`, `log` for stdout and `error` for stderr, never through the logger, so no
 * log level can silence it. Only the glyph is painted; the text stays plain. An `agent` audience gets the glyph
 * and the text and never colour, even when the theme has colour. `success` and `info` go to stdout, `warning`
 * and `failure` to stderr.
 *
 * The text is whatever the caller supplies, so it is sanitised: escape sequences and control characters are removed
 * (a line break is kept as one, a tab becomes a space), as in a document. Under GitHub Actions, where
 * `CurrentRuntimeEnv` says so, a line the runner would read as a workflow command is neutralized as well. The glyph
 * comes from the vocabulary, sanitised too (`Status.glyph`), so a glyph built from data cannot inject an escape either.
 *
 * **Example** (Construct a success message)
 *
 * ```ts
 * import { CliMessage } from "@beep/cli-kit/CliMessage"
 * import * as Effect from "effect/Effect"
 *
 * const program = CliMessage.success("saved")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export abstract class CliMessage {
  /**
   * Print a status line from a vocabulary.
   *
   * **Details**
   *
   * The stream defaults to stderr when the status ranks at or above `warning` in `vocab`, and stdout
   * otherwise, so a custom status follows its own rank: a `timeout` ranked 85 goes to stderr. The line is painted
   * with the chosen stream's own colour, so a redirected stderr is not coloured because stdout is a terminal.
   *
   * It is dual, and a vocabulary in first position marks the data-first call: `options` is optional, so the
   * arity cannot tell `status(vocab, name, text)` from the data-last `status(name, text, options)`.
   *
   * **Example** (Construct a vocabulary status message)
   *
   * ```ts
   * import { CliMessage } from "@beep/cli-kit/CliMessage"
   * import * as Effect from "effect/Effect"
   * import { Status } from "@beep/cli-kit/Status"
   * const program = CliMessage.status(Status.core, "warning", "retrying")
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param vocab - the vocabulary the status belongs to
   * @param name - the status
   * @param text - the text after the glyph
   * @param options - the stream override
   * @category utilities
   * @since 0.0.0
   */
  static readonly status: {
    <N extends string>(
      vocab: Status<N>,
      name: N,
      text: string,
      options?: CliMessageOptions.Encoded
    ): Effect.Effect<void, never, CliTheme | Audience>;
    <N extends string>(
      name: N,
      text: string,
      options?: CliMessageOptions.Encoded
    ): (vocab: Status<N>) => Effect.fn.Return<void, never, CliTheme | Audience>;
  } = dual(
    isVocabularyFirst,
    Effect.fn("CliMessage.status")(function* <N extends string>(
      vocab: Status<N>,
      name: N,
      text: string,
      options?: CliMessageOptions.Encoded
    ): Effect.fn.Return<void, never, CliTheme | Audience> {
      const theme = yield* CliTheme;
      const audience = yield* Audience;
      const def = vocab.def(name);
      const message = sanitize(text);

      const warning = vocab.def("warning").rank;
      const stream = options?.stream ?? (def.rank >= warning ? "stderr" : "stdout");
      const streamTheme = theme.forStream(stream);

      let line: string;
      line = CliTheme.forAudience(streamTheme, audience.kind).status(vocab, name, message);
      if (yield* underGithubActions) line = CommandNeutralizer.text(line);

      yield* stream === "stderr" ? Console.error(line) : Console.log(line);
    })
  );

  /**
   * A success line, on stdout.
   *
   * **Example** (Construct a success line)
   *
   * ```ts
   * import { CliMessage } from "@beep/cli-kit/CliMessage"
   * import * as Effect from "effect/Effect"
   *
   * const program = CliMessage.success("configuration checked")
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param text - the text after the glyph
   * @category utilities
   * @since 0.0.0
   */
  static readonly success = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
    CliMessage.status(Status.core, "success", text);

  /**
   * An informational line, on stdout.
   *
   * **Example** (Construct a info line)
   *
   * ```ts
   * import { CliMessage } from "@beep/cli-kit/CliMessage"
   * import * as Effect from "effect/Effect"
   *
   * const program = CliMessage.info("configuration checked")
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param text - the text after the glyph
   * @category utilities
   * @since 0.0.0
   */
  static readonly info = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
    CliMessage.status(Status.core, "info", text);

  /**
   * A warning line, on stderr.
   *
   * **Example** (Construct a warning line)
   *
   * ```ts
   * import { CliMessage } from "@beep/cli-kit/CliMessage"
   * import * as Effect from "effect/Effect"
   *
   * const program = CliMessage.warning("configuration checked")
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param text - the text after the glyph
   * @category utilities
   * @since 0.0.0
   */
  static readonly warning = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
    CliMessage.status(Status.core, "warning", text);

  /**
   * A failure line, on stderr.
   *
   * **Example** (Construct a failure line)
   *
   * ```ts
   * import { CliMessage } from "@beep/cli-kit/CliMessage"
   * import * as Effect from "effect/Effect"
   *
   * const program = CliMessage.failure("configuration checked")
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param text - the text after the glyph
   * @category utilities
   * @since 0.0.0
   */
  static readonly failure = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
    CliMessage.status(Status.core, "failure", text);
}
