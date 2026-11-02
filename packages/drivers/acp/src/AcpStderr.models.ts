/**
 * Bounded, redacted standard-error tails for ACP peer processes.
 *
 * **Details**
 *
 * An ACP agent reports protocol traffic on stdout and diagnostics on stderr. The protocol never
 * reads stderr, but the tail of it is the most useful explanation of why a peer exited. This
 * module keeps only the last {@link ACP_STDERR_TAIL_MAX_CHARS} characters, redacts home
 * directories, sign-in and pairing URLs, and common credential shapes, and attaches the result to
 * an `AcpProcessExitedError` that has no excerpt yet. Provenance is recorded in the package
 * README.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as AcpError from "./Acp.errors.ts";
import type * as Scope from "effect/Scope";

const $I = $AcpId.create("stderr");

/**
 * Maximum number of characters an {@link AcpStderrTail} retains.
 *
 * **Example** (Read the tail bound)
 *
 * ```ts
 * import { ACP_STDERR_TAIL_MAX_CHARS } from "@beep/acp/stderr"
 *
 * console.log(ACP_STDERR_TAIL_MAX_CHARS) // 4096
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ACP_STDERR_TAIL_MAX_CHARS = 4_096;

/**
 * Last characters written to a peer's standard error.
 *
 * **Details**
 *
 * `truncated` is `true` once older output was dropped to stay within
 * {@link ACP_STDERR_TAIL_MAX_CHARS}. The text is raw: pass it through
 * {@link sanitizeStderrExcerpt} before it leaves the process.
 *
 * **Example** (Start from an empty tail)
 *
 * ```ts
 * import { AcpStderrTail } from "@beep/acp/stderr"
 *
 * console.log(AcpStderrTail.empty.truncated) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcpStderrTail extends S.Opaque<AcpStderrTail, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.annotateKey({ description: "Retained stderr characters, oldest first." }),
    truncated: S.Boolean.annotateKey({ description: "Whether older stderr output was dropped." }),
  }).pipe($I.annoteSchema("AcpStderrTail", { description: "Bounded tail of an ACP peer's standard error." }))
) {
  /**
   * Tail with no retained output.
   *
   * **Example** (Read the empty tail)
   *
   * ```ts
   * import { AcpStderrTail } from "@beep/acp/stderr"
   *
   * console.log(AcpStderrTail.empty.text) // ""
   * ```
   */
  static readonly empty = AcpStderrTail.make({ text: "", truncated: false });
}

/**
 * Appends a decoded stderr chunk, keeping the last {@link ACP_STDERR_TAIL_MAX_CHARS} characters.
 *
 * **Example** (Append two chunks)
 *
 * ```ts
 * import { AcpStderrTail, appendStderrTail } from "@beep/acp/stderr"
 *
 * const tail = appendStderrTail("world")(appendStderrTail("hello ")(AcpStderrTail.empty))
 * console.log(tail.text) // "hello world"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const appendStderrTail =
  (chunk: string) =>
  (tail: AcpStderrTail): AcpStderrTail => {
    const next = Str.concat(chunk)(tail.text);
    return Str.length(next) <= ACP_STDERR_TAIL_MAX_CHARS
      ? AcpStderrTail.make({ text: next, truncated: tail.truncated })
      : AcpStderrTail.make({ text: Str.takeRight(next, ACP_STDERR_TAIL_MAX_CHARS), truncated: true });
  };

const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/https?:\/\/[^\s]*\/pair#[^\s]*/gi, "[pairing-url]"],
  [/https?:\/\/accounts\.google\.com[^\s]*/gi, "[sign-in-url]"],
  [/\bBearer\s+[A-Za-z0-9._\-+=/]+/gi, "Bearer [redacted]"],
  [/\bAuthorization:\s*Basic\s+\S+/gi, "Authorization: Basic [redacted]"],
  [/\bx-api-key:\s*\S+/gi, "x-api-key: [redacted]"],
  [
    /\b(?:sk-[A-Za-z0-9][A-Za-z0-9_-]{7,}|gh[pousr]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|xox[a-zA-Z]-[A-Za-z0-9-]+|ops_[A-Za-z0-9+/=]{40,})\b/g,
    "[redacted]",
  ],
];

const byLengthDescending = Order.flip(Order.mapInput(Order.Number, Str.length));

/**
 * Redacts a stderr excerpt so it can be logged or attached to an error.
 *
 * **Details**
 *
 * Replaces every listed home directory with `~` (longest first, so nested homes keep their
 * suffix), removes NUL characters, and replaces pairing URLs, Google sign-in URLs, bearer and
 * basic credentials, `x-api-key` headers, and OpenAI, Anthropic, GitHub, Slack and 1Password
 * service-account token shapes. The result is trimmed. Home directories of one character or
 * fewer are ignored, so `/` never collapses every path.
 *
 * **Example** (Redact a home path and a bearer token)
 *
 * ```ts
 * import { sanitizeStderrExcerpt } from "@beep/acp/stderr"
 *
 * const text = "config /home/ada/.agent/cli.json\nAuthorization: Bearer abc.def"
 * console.log(sanitizeStderrExcerpt(text, ["/home/ada"]))
 * // config ~/.agent/cli.json
 * // Authorization: Bearer [redacted]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const sanitizeStderrExcerpt: {
  (homeDirectories: Iterable<string>): (text: string) => string;
  (text: string, homeDirectories: Iterable<string>): string;
} = dual(2, (text: string, homeDirectories: Iterable<string>): string => {
  const homes = pipe(
    HashSet.fromIterable(homeDirectories),
    A.fromIterable,
    A.filter((home) => Str.length(home) > 1),
    A.sort(byLengthDescending)
  );
  const withoutHomes = A.reduce(homes, Str.replaceAll("\0", "")(text), (current, home) =>
    Str.replaceAll(home, "~")(current)
  );
  return Str.trim(
    A.reduce(REDACTIONS, withoutHomes, (current, [pattern, replacement]) => Str.replace(pattern, replacement)(current))
  );
});

// A truncated tail can start inside a credential, past the prefix every redaction pattern anchors
// on, so the partial first line is dropped before the excerpt is sanitized.
const completeLines = (tail: AcpStderrTail): string =>
  tail.truncated
    ? O.match(Str.indexOf("\n")(tail.text), { onNone: () => "", onSome: (index) => Str.slice(index + 1)(tail.text) })
    : tail.text;

/**
 * Options for {@link collectStderrTail}.
 *
 * **Details**
 *
 * - `homeDirectories` are replaced with `~` in every excerpt.
 * - `drainGrace` bounds how long `excerpt` waits for the stream to end, so output written just
 *   before the peer exited is included; it defaults to 250 milliseconds.
 *
 * **Example** (Redact the owned profile root)
 *
 * ```ts
 * import { AcpStderrCollectorOptions } from "@beep/acp/stderr"
 *
 * const options = AcpStderrCollectorOptions.make({ homeDirectories: ["/owned/profile"] })
 * console.log(options.homeDirectories) // ["/owned/profile"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcpStderrCollectorOptions extends S.Opaque<AcpStderrCollectorOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    drainGrace: S.Duration.pipe(S.withConstructorDefault(Effect.succeed(Duration.millis(250)))).annotateKey({
      description: "How long an excerpt waits for the stderr stream to end; 250 milliseconds by default.",
    }),
    homeDirectories: S.String.pipe(S.Array, S.withConstructorDefault(Effect.succeed(A.empty<string>()))).annotateKey({
      description: "Home directories replaced with ~ in every excerpt.",
    }),
  }).pipe(
    $I.annoteSchema("AcpStderrCollectorOptions", {
      description: "Options of the scoped ACP stderr tail collector.",
    })
  )
) {}

/**
 * Background reader of a peer's standard error.
 *
 * **Details**
 *
 * - `tail` reads the raw retained tail at any time.
 * - `drained` completes once the stderr stream has ended or failed.
 * - `excerpt` waits up to the drain grace for the stream to end, then returns the sanitized tail,
 *   or `None` when nothing printable remains. A truncated tail loses its partial first line first,
 *   so a credential cut at the boundary is never emitted without the prefix that redacts it.
 *
 * **Example** (Read the excerpt of a collector)
 *
 * ```ts
 * import type { AcpStderrCollector } from "@beep/acp/stderr"
 *
 * const excerptOf = (collector: AcpStderrCollector) => collector.excerpt
 * console.log(excerptOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AcpStderrCollector {
  readonly drained: Effect.Effect<void>;
  readonly excerpt: Effect.Effect<O.Option<string>>;
  readonly tail: Effect.Effect<AcpStderrTail>;
}

/**
 * Forks a scoped reader that keeps the bounded tail of a stderr stream.
 *
 * **Details**
 *
 * The reader consumes the whole stream, so the peer never blocks on a full stderr pipe, and keeps
 * only the tail. A stream failure ends the reader without failing the caller. The reader stops
 * when the surrounding scope closes. A process handle's stderr can be read once: hand it to this
 * collector instead of draining it separately.
 *
 * **Example** (Collect stderr of a spawned peer)
 *
 * ```ts
 * import { collectStderrTail } from "@beep/acp/stderr"
 * import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
 *
 * const collect = (handle: ChildProcessSpawner.ChildProcessHandle) =>
 *   collectStderrTail(handle.stderr, { homeDirectories: ["/owned/profile"] })
 * console.log(collect)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const collectStderrTail = Effect.fn($I`collectStderrTail`)(function* <E>(
  stderr: Stream.Stream<Uint8Array, E>,
  input: (typeof AcpStderrCollectorOptions)["~type.make.in"] = {}
): Effect.fn.Return<AcpStderrCollector, never, Scope.Scope> {
  const tailRef = yield* Ref.make(AcpStderrTail.empty);
  const drainedSignal = yield* Deferred.make<void>();
  const { drainGrace, homeDirectories } = AcpStderrCollectorOptions.make(input);
  yield* stderr.pipe(
    Stream.decodeText(),
    Stream.runForEach(flow(appendStderrTail, (append) => Ref.update(tailRef, append))),
    Effect.ignore,
    Effect.ensuring(Deferred.succeed(drainedSignal, undefined)),
    Effect.forkScoped
  );
  const drained = Deferred.await(drainedSignal);
  return {
    drained,
    excerpt: drained.pipe(
      Effect.timeoutOption(drainGrace),
      Effect.andThen(Ref.get(tailRef)),
      Effect.map((tail) => O.liftPredicate(sanitizeStderrExcerpt(completeLines(tail), homeDirectories), Str.isNonEmpty))
    ),
    tail: Ref.get(tailRef),
  };
});

const isProcessExited = S.is(AcpError.AcpProcessExitedError);

/**
 * Attaches the collector's sanitized excerpt to a process-exit error that has none.
 *
 * **Details**
 *
 * Only an `AcpProcessExitedError` whose `stderr` is absent or blank changes; every other error,
 * and an exit error when the excerpt is empty, is returned unchanged.
 *
 * **Example** (Enrich a termination error)
 *
 * ```ts
 * import type * as AcpError from "@beep/acp/errors"
 * import { type AcpStderrCollector, withStderrExcerpt } from "@beep/acp/stderr"
 *
 * const enrich = (collector: AcpStderrCollector, error: AcpError.AcpError) =>
 *   withStderrExcerpt(collector)(error)
 * console.log(enrich)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withStderrExcerpt =
  (collector: AcpStderrCollector) =>
  (error: AcpError.AcpError): Effect.Effect<AcpError.AcpError> =>
    isProcessExited(error) && O.isNone(O.filter(O.map(error.stderr, Str.trim), Str.isNonEmpty))
      ? Effect.map(
          collector.excerpt,
          O.match({
            onNone: (): AcpError.AcpError => error,
            onSome: (stderr): AcpError.AcpError =>
              AcpError.AcpProcessExitedError.make({
                cause: error.cause,
                code: error.code,
                pid: error.pid,
                signal: error.signal,
                stderr: O.some(stderr),
              }),
          })
        )
      : Effect.succeed(error);
