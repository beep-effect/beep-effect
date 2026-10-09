/**
 * Acquisition boundary helpers.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OutputBound, runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { LibraryError } from "./Library.errors.ts";
import { LibraryArtifact } from "./Library.schemas.ts";
import { saveImmutable } from "./Library.store.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const $I = $RepoCliId.create("commands/Research/Library/Library.adapter");

/**
 * Adapter result.
 * **Example** (Inspect a blocked acquisition)
 * ```ts
 * import { LibraryAdapterResult } from "@beep/repo-cli/test/ResearchLibrary"
 * const result = LibraryAdapterResult.make({artifacts: [], revision: "", complete: false, reason: "Provider access is blocked", status: "blocked"})
 * console.log(result.complete) // false
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class LibraryAdapterResult extends S.Class<LibraryAdapterResult>($I`LibraryAdapterResult`)(
  {
    artifacts: S.Array(LibraryArtifact),
    revision: S.String,
    complete: S.Boolean,
    reason: S.String,
    status: S.Literals(["readable", "blocked", "failed", "unsupported"]),
  },
  $I.annote("LibraryAdapterResult", { description: "Acquisition evidence and explicit completeness disposition." })
) {}

/**
 * Run an argv-only command with bounded output and lifetime.
 * **Example** (Prepare a bounded version probe)
 * ```ts
 * import { runLibraryCommand } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runLibraryCommand("/library", "git", ["--version"])))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const runLibraryCommand = Effect.fn("Library.runCommand")(function* (
  root: string,
  command: string,
  args: ReadonlyArray<string>,
  maxChars = 8_000_000
) {
  const result = yield* runCapturedStreams({
    command,
    args,
    cwd: root,
    extendEnv: true,
    trim: false,
    env:
      command === "git"
        ? {
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_TERMINAL_PROMPT: "0",
            GIT_LFS_SKIP_SMUDGE: "1",
          }
        : {},
    forceKillAfter: "2 seconds",
    stdoutBound: OutputBound.make({ maxChars, truncatedNotice: "[library-output-truncated]" }),
    stderrBound: OutputBound.make({ maxChars: 16_000, truncatedNotice: "[library-stderr-truncated]" }),
  }).pipe(Effect.timeout("5 minutes"));
  if (result.exitCode !== 0 || result.truncated) {
    return yield* LibraryError.make({
      cause: "library-boundary",
      message: `${command} acquisition failed (exit ${result.exitCode}, truncated ${result.truncated}): ${sanitizeLibraryDiagnostic(result.stderr)}`,
    });
  }
  return result.stdout;
});

/**
 * Bounded credential-safe subprocess diagnostics.
 * **Example** (Remove credential-shaped diagnostics)
 * ```ts
 * import { sanitizeLibraryDiagnostic } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(sanitizeLibraryDiagnostic("Authorization: Bearer example-token"))
 * ```
 *
 * @internal
 * @param text - Subprocess diagnostic text that may contain credential-shaped values.
 * @returns Redacted diagnostic text bounded to 2,000 characters.
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeLibraryDiagnostic = (text: string) =>
  Str.slice(
    0,
    2000
  )(
    Str.replace(
      /(?:Bearer\s+|(?:token|api[_-]?key|password|secret|authorization)[=:]\s*)[^\s"'<>]+/gi,
      "[redacted]"
    )(Str.replace(/(?:gh[pousr]_|github_pat_|fc-|sk-)[A-Za-z0-9_-]{10,}/g, "[redacted]")(text))
  );

/**
 * Persist evidence without replacing originals.
 * **Example** (Prepare immutable text evidence)
 * ```ts
 * import { saveLibraryText } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(saveLibraryText("/library", "receipts/probe.txt", "probe completed", "text/plain", "qualification-probe")))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const saveLibraryText = Effect.fn("Library.saveText")(function* (
  root: string,
  relative: string,
  text: string,
  mediaType: string,
  role: string
) {
  const artifact = yield* saveImmutable(root, relative, new TextEncoder().encode(text));
  return LibraryArtifact.make({ ...artifact, mediaType, role });
});

/**
 * Decode external JSON with a typed error.
 * **Example** (Decode an external JSON boundary)
 * ```ts
 * import { decodeLibraryJson } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema"
 * console.log(Effect.isEffect(decodeLibraryJson(S.Struct({complete: S.Boolean}))('{"complete":true}')))
 * ```
 *
 * @internal
 * @param schema - Codec defining the decoded acquisition response and its encoded representation.
 * @returns A JSON text decoder that reports invalid responses as LibraryError.
 * @category utilities
 * @since 0.0.0
 */
export const decodeLibraryJson = <A, I>(schema: S.Codec<A, I>) => {
  const decode = S.decodeEffect(S.fromJsonString(schema));
  return (text: string) =>
    decode(text).pipe(
      Effect.mapError(() =>
        LibraryError.make({ cause: "library-boundary", message: "Acquisition response failed schema validation." })
      )
    );
};

/**
 * Encode evidence JSON.
 * **Example** (Encode a structured receipt)
 * ```ts
 * import { encodeLibraryJson } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.runSync(encodeLibraryJson({complete: false})))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const encodeLibraryJson = Effect.fn("Library.encodeJson")(function* (input: unknown) {
  return yield* S.encodeUnknownEffect(UnknownJson)(input);
});
