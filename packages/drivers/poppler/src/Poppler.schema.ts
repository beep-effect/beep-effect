/**
 * Configuration and error models for the Poppler page rasterizer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PopplerId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { PosInt } from "./internal/PosInt.ts";

const $I = $PopplerId.create("Poppler.schema");

const defaultDpi = PosInt.make(300);
const defaultTimeoutMillis = PosInt.make(60_000);

/**
 * Configuration for the Poppler command-line tools used to count and render PDF pages.
 *
 * **Example** (Default rasterizer configuration)
 *
 * ```ts
 * import { PopplerConfig } from "@beep/poppler"
 *
 * const config = PopplerConfig.make({})
 * console.log(config.dpi) // 300
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PopplerConfig extends S.Class<PopplerConfig>($I`PopplerConfig`)(
  {
    dpi: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(defaultDpi)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultDpi))
    ).annotateKey({ description: "Render resolution in dots per inch." }),
    pdfinfoPath: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("pdfinfo")),
      S.withDecodingDefaultTypeKey(Effect.succeed("pdfinfo"))
    ).annotateKey({ description: "Executable path or command name of pdfinfo." }),
    pdftoppmPath: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("pdftoppm")),
      S.withDecodingDefaultTypeKey(Effect.succeed("pdftoppm"))
    ).annotateKey({ description: "Executable path or command name of pdftoppm." }),
    timeoutMillis: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(defaultTimeoutMillis)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultTimeoutMillis))
    ).annotateKey({ description: "Timeout in milliseconds for one pdfinfo or pdftoppm call." }),
  },
  $I.annote("PopplerConfig", {
    description: "Paths, render resolution and per-call timeout for the Poppler command-line tools.",
  })
) {}

/**
 * Failure reasons of the Poppler rasterizer, free of process detail.
 *
 * **Example** (List the failure reasons)
 *
 * ```ts
 * import { PopplerErrorReason } from "@beep/poppler"
 *
 * console.log(PopplerErrorReason.literals.includes("timed-out")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PopplerErrorReason = LiteralKit([
  "engine-unavailable",
  "process-failed",
  "timed-out",
  "output-invalid",
]).pipe(
  $I.annoteSchema("PopplerErrorReason", {
    description: "Failure reasons of the Poppler rasterizer, free of process detail.",
  })
);

/**
 * Type for {@link PopplerErrorReason}.
 *
 * **Example** (Annotate a failure reason)
 *
 * ```ts
 * import type { PopplerErrorReason } from "@beep/poppler"
 *
 * const reason: PopplerErrorReason = "process-failed"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PopplerErrorReason = typeof PopplerErrorReason.Type;

/**
 * Sanitized failure of one Poppler call.
 *
 * **Example** (Build a rasterizer failure)
 *
 * ```ts
 * import { PopplerError } from "@beep/poppler"
 *
 * const error = PopplerError.make({ message: "pdftoppm exited with status 1.", reason: "process-failed" })
 * console.log(error.reason) // "process-failed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PopplerError extends S.TaggedError<PopplerError>($I`PopplerError`)(
  "PopplerError",
  {
    message: S.String,
    reason: PopplerErrorReason,
  },
  $I.annoteError<PopplerError>("PopplerError", {
    description: "Sanitized failure of one Poppler call.",
  })
) {}
