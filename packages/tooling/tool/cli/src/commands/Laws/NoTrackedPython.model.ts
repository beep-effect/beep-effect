/**
 * Schemas and data for the no-tracked-python law.
 *
 * **Details**
 *
 * Python is banned from tracked source (`goals/python-free-repo`). The law has
 * no allowlist: a future need for Python is a new decision, not an exception
 * row. The banned file kinds are one exact literal domain of extensions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/NoTrackedPython.model");

/**
 * File extensions the no-tracked-python law bans from the git index.
 *
 * **Details**
 *
 * `.py` is Python source, `.pyi` a type stub and `.pyw` a windowed script. A
 * Jupyter notebook (`.ipynb`) is banned as well: running one needs the Python
 * Jupyter stack whatever its kernel, so it carries the same dependency
 * surface the ban removes.
 *
 * **Example** (Check a banned extension)
 *
 * ```ts
 * import { TrackedPythonExtension } from "@beep/repo-cli/commands/Laws/NoTrackedPython.model"
 *
 * console.log(TrackedPythonExtension.is[".ipynb"](".ipynb")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TrackedPythonExtension = LiteralKit([".py", ".pyi", ".pyw", ".ipynb"]).pipe(
  $I.annoteSchema("TrackedPythonExtension", {
    description: "File extension of a Python source, stub, windowed script or notebook banned from the git index.",
  })
);

/**
 * Type-level member of {@link TrackedPythonExtension}.
 *
 * @category models
 * @since 0.0.0
 */
export type TrackedPythonExtension = typeof TrackedPythonExtension.Type;

/**
 * One tracked Python file.
 *
 * **Example** (Describe a finding)
 *
 * ```ts
 * import { NoTrackedPythonFinding } from "@beep/repo-cli/commands/Laws/NoTrackedPython.model"
 *
 * const finding = NoTrackedPythonFinding.make({ file: "scripts/probe.py" })
 *
 * console.log(finding.file) // "scripts/probe.py"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoTrackedPythonFinding extends S.Opaque<NoTrackedPythonFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
  }).pipe(
    $I.annoteSchema("NoTrackedPythonFinding", {
      description: "One git-tracked Python file, which the no-tracked-python law bans.",
    })
  )
) {}

/**
 * Runtime options for the no-tracked-python law.
 *
 * **Example** (Configure a strict scan)
 *
 * ```ts
 * import { NoTrackedPythonOptions } from "@beep/repo-cli/commands/Laws/NoTrackedPython.model"
 *
 * const options = NoTrackedPythonOptions.make({ cwd: process.cwd(), strictCheck: true })
 *
 * console.log(options.strictCheck) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoTrackedPythonOptions extends S.Opaque<NoTrackedPythonOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("NoTrackedPythonOptions", {
      description: "Runtime options for the no-tracked-python law.",
    })
  )
) {}

/**
 * Result of one no-tracked-python law run.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { NoTrackedPythonSummary } from "@beep/repo-cli/commands/Laws/NoTrackedPython.model"
 *
 * const summary = NoTrackedPythonSummary.make({ trackedPythonFiles: 0, strictFailure: false })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoTrackedPythonSummary extends S.Opaque<NoTrackedPythonSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    trackedPythonFiles: S.Int,
    strictFailure: S.Boolean,
    findings: ArrayKeyDefaultEmpty(NoTrackedPythonFinding),
  }).pipe(
    $I.annoteSchema("NoTrackedPythonSummary", {
      description: "Result of one no-tracked-python law run over the git index.",
    })
  )
) {}
