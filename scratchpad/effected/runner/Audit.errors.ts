/**
 * Typed failures of the effected-port runner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { AuditTarget, ModuleName, Stage } from "./Ledger.schema.ts";

const $I = $ScratchpadId.create("effected/runner/Audit.errors");

/**
 * The gates the `audit` subcommand runs, in order.
 *
 * **Example** (Guard a gate name)
 *
 * ```ts
 * import { GateName } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(GateName.is.parity("parity")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateName = LiteralKit(["parity", "check", "lint", "test", "docgen"]).annotate(
  $I.annote("GateName", { description: "One of the five runner gates." })
);

/**
 * The union of gate name literals.
 *
 * @see {@link GateName} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type GateName = typeof GateName.Type;

/**
 * A gate command exited non-zero or reported problems.
 *
 * **Example** (Fail a gate)
 *
 * ```ts
 * import { GateFailed } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * const error = GateFailed.make({ target: "yaml", gate: "check", exitCode: 2, problems: [] })
 * console.log(error.message) // "yaml check: red (exit 2)"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateFailed extends S.TaggedError<GateFailed>($I`GateFailed`)(
  "GateFailed",
  {
    target: AuditTarget,
    gate: GateName,
    exitCode: S.Int,
    problems: S.Array(S.String),
  },
  $I.annoteError<GateFailed>("GateFailed", { description: "A runner gate went red for a target." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered GateFailed message)
   *
   * ```ts
   * import { GateFailed } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(GateFailed.make({ target: "yaml", gate: "check", exitCode: 2, problems: ["x.ts:1 bad"] }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    const detail = A.isReadonlyArrayNonEmpty(this.problems) ? `\n  ${A.join(this.problems, "\n  ")}` : "";
    return `${this.target} ${this.gate}: red (exit ${this.exitCode})${detail}`;
  }
}

/**
 * A subprocess the runner needed exited non-zero outside a gate.
 *
 * **Example** (Report a failed helper command)
 *
 * ```ts
 * import { CommandFailed } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * const error = CommandFailed.make({ command: "git rev-parse HEAD", exitCode: 128 })
 * console.log(error.message) // "command failed (exit 128): git rev-parse HEAD"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CommandFailed extends S.TaggedError<CommandFailed>($I`CommandFailed`)(
  "CommandFailed",
  {
    command: S.String,
    exitCode: S.Int,
  },
  $I.annoteError<CommandFailed>("CommandFailed", { description: "A helper subprocess exited non-zero." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered CommandFailed message)
   *
   * ```ts
   * import { CommandFailed } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(CommandFailed.make({ command: "git rev-parse HEAD", exitCode: 128 }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `command failed (exit ${this.exitCode}): ${this.command}`;
  }
}

/**
 * The ledger file does not exist yet; wave 0 has not started.
 *
 * **Example** (Report a missing ledger)
 *
 * ```ts
 * import { LedgerMissing } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(LedgerMissing.make({ path: "scratchpad/effected/PORT_LEDGER.json" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LedgerMissing extends S.TaggedError<LedgerMissing>($I`LedgerMissing`)(
  "LedgerMissing",
  { path: S.String },
  $I.annoteError<LedgerMissing>("LedgerMissing", { description: "No ledger file exists at the expected path." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered LedgerMissing message)
   *
   * ```ts
   * import { LedgerMissing } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(LedgerMissing.make({ path: "scratchpad/effected/PORT_LEDGER.json" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `ledger missing: ${this.path} (run \`ledger --init\`)`;
  }
}

/**
 * The ledger file exists but does not decode as a {@link Ledger}.
 *
 * **Example** (Report an invalid ledger)
 *
 * ```ts
 * import { LedgerInvalid } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(LedgerInvalid.make({ path: "x.json", detail: "rows: expected array" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LedgerInvalid extends S.TaggedError<LedgerInvalid>($I`LedgerInvalid`)(
  "LedgerInvalid",
  { path: S.String, detail: S.String },
  $I.annoteError<LedgerInvalid>("LedgerInvalid", { description: "The ledger file failed schema validation." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered LedgerInvalid message)
   *
   * ```ts
   * import { LedgerInvalid } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(LedgerInvalid.make({ path: "x.json", detail: "rows: expected array" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `ledger invalid: ${this.path}\n${this.detail}`;
  }
}

/**
 * A ledger operation named a module that has no row.
 *
 * **Example** (Report a missing row)
 *
 * ```ts
 * import { LedgerRowMissing } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(LedgerRowMissing.make({ module: "yaml" }).message) // "ledger has no row for yaml"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LedgerRowMissing extends S.TaggedError<LedgerRowMissing>($I`LedgerRowMissing`)(
  "LedgerRowMissing",
  { module: ModuleName },
  $I.annoteError<LedgerRowMissing>("LedgerRowMissing", { description: "No ledger row exists for the module." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered LedgerRowMissing message)
   *
   * ```ts
   * import { LedgerRowMissing } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(LedgerRowMissing.make({ module: "yaml" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `ledger has no row for ${this.module}`;
  }
}

/**
 * A `ledger --set` tried to jump past the next stage.
 *
 * **Example** (Refuse a skipped stage)
 *
 * ```ts
 * import { LedgerStageSkip } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(LedgerStageSkip.make({ module: "yaml", from: 1, to: 3 }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LedgerStageSkip extends S.TaggedError<LedgerStageSkip>($I`LedgerStageSkip`)(
  "LedgerStageSkip",
  { module: ModuleName, from: Stage, to: Stage },
  $I.annoteError<LedgerStageSkip>("LedgerStageSkip", { description: "A stage transition skipped a stage." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered LedgerStageSkip message)
   *
   * ```ts
   * import { LedgerStageSkip } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(LedgerStageSkip.make({ module: "yaml", from: 1, to: 3 }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `${this.module}: cannot move from stage ${this.from} to ${this.to}; stages are left one at a time`;
  }
}

/**
 * An upstream file or directory the runner needed is absent.
 *
 * **Example** (Report a missing upstream path)
 *
 * ```ts
 * import { UpstreamMissing } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(UpstreamMissing.make({ path: "packages/yaml/src" }).message) // "upstream path missing: packages/yaml/src"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UpstreamMissing extends S.TaggedError<UpstreamMissing>($I`UpstreamMissing`)(
  "UpstreamMissing",
  { path: S.String },
  $I.annoteError<UpstreamMissing>("UpstreamMissing", { description: "An expected upstream path does not exist." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered UpstreamMissing message)
   *
   * ```ts
   * import { UpstreamMissing } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(UpstreamMissing.make({ path: "packages/yaml/src" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `upstream path missing: ${this.path}`;
  }
}

/**
 * The lab already holds files for a module, so a verbatim copy would clobber
 * work.
 *
 * **Example** (Refuse to overwrite a copy)
 *
 * ```ts
 * import { AlreadyCopied } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(AlreadyCopied.make({ module: "jsonl", path: "scratchpad/effected/jsonl" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AlreadyCopied extends S.TaggedError<AlreadyCopied>($I`AlreadyCopied`)(
  "AlreadyCopied",
  { module: ModuleName, path: S.String },
  $I.annoteError<AlreadyCopied>("AlreadyCopied", { description: "The module's lab directory already exists." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered AlreadyCopied message)
   *
   * ```ts
   * import { AlreadyCopied } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(AlreadyCopied.make({ module: "jsonl", path: "scratchpad/effected/jsonl" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `${this.module} is already in the lab at ${this.path}; copy refuses to overwrite`;
  }
}

/**
 * Upstream declares a dependency the section-4 inventory does not expect.
 *
 * **Example** (Report an unexpected dependency)
 *
 * ```ts
 * import { UnexpectedDependency } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(UnexpectedDependency.make({ module: "yaml", name: "left-pad", field: "dependencies" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnexpectedDependency extends S.TaggedError<UnexpectedDependency>($I`UnexpectedDependency`)(
  "UnexpectedDependency",
  { module: ModuleName, name: S.String, field: S.String },
  $I.annoteError<UnexpectedDependency>("UnexpectedDependency", {
    description: "Upstream declares a dependency outside the inventory allowlist.",
  })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered UnexpectedDependency message)
   *
   * ```ts
   * import { UnexpectedDependency } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(UnexpectedDependency.make({ module: "yaml", name: "left-pad", field: "dependencies" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `${this.module}: upstream ${this.field} names ${this.name}, which the catalog does not list; extend Catalog.ts with a ledger note`;
  }
}

/**
 * A JSON document the runner edits (package.json, docgen template) did not
 * have the expected shape.
 *
 * **Example** (Report a malformed manifest)
 *
 * ```ts
 * import { ManifestInvalid } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(ManifestInvalid.make({ path: "scratchpad/package.json", detail: "not an object" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ManifestInvalid extends S.TaggedError<ManifestInvalid>($I`ManifestInvalid`)(
  "ManifestInvalid",
  { path: S.String, detail: S.String },
  $I.annoteError<ManifestInvalid>("ManifestInvalid", { description: "A JSON manifest failed to decode." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered ManifestInvalid message)
   *
   * ```ts
   * import { ManifestInvalid } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(ManifestInvalid.make({ path: "scratchpad/package.json", detail: "not an object" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `manifest invalid: ${this.path}: ${this.detail}`;
  }
}

/**
 * The command line named a missing or malformed argument.
 *
 * **Example** (Report a usage error)
 *
 * ```ts
 * import { CliUsageError } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(CliUsageError.make({ detail: "expected a module name" }).message) // "usage: expected a module name"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CliUsageError extends S.TaggedError<CliUsageError>($I`CliUsageError`)(
  "CliUsageError",
  { detail: S.String },
  $I.annoteError<CliUsageError>("CliUsageError", { description: "The command line was missing or malformed." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered CliUsageError message)
   *
   * ```ts
   * import { CliUsageError } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(CliUsageError.make({ detail: "expected a module name" }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `usage: ${this.detail}`;
  }
}

/**
 * `ledger --verify` found rows that are not done, blocked rows, or stale rows.
 *
 * **Example** (Report an incomplete ledger)
 *
 * ```ts
 * import { LedgerIncomplete } from "@beep/scratchpad/effected/runner/Audit.errors"
 *
 * console.log(LedgerIncomplete.make({ done: 3, total: 29 }).message) // "ledger incomplete: 3/29 done"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LedgerIncomplete extends S.TaggedError<LedgerIncomplete>($I`LedgerIncomplete`)(
  "LedgerIncomplete",
  { done: S.Int, total: S.Int },
  $I.annoteError<LedgerIncomplete>("LedgerIncomplete", { description: "The ledger is not fully done." })
) {
  /**
   * Renders the failure as one human-readable line for terminal output.
   *
   * **Example** (Read the rendered LedgerIncomplete message)
   *
   * ```ts
   * import { LedgerIncomplete } from "@beep/scratchpad/effected/runner/Audit.errors"
   *
   * console.log(LedgerIncomplete.make({ done: 3, total: 29 }).message.length > 0) // true
   * ```
   */
  override get message(): string {
    return `ledger incomplete: ${this.done}/${this.total} done`;
  }
}

/**
 * Every typed failure the runner can raise.
 *
 * **Example** (Match on a runner error)
 *
 * ```ts
 * import { AuditError, GateFailed } from "@beep/scratchpad/effected/runner/Audit.errors"
 * import * as S from "effect/Schema"
 *
 * const error: AuditError = GateFailed.make({ target: "yaml", gate: "lint", exitCode: 1, problems: [] })
 * console.log(S.is(AuditError)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AuditError = S.Union([
  GateFailed,
  CommandFailed,
  LedgerMissing,
  LedgerInvalid,
  LedgerRowMissing,
  LedgerStageSkip,
  UpstreamMissing,
  AlreadyCopied,
  UnexpectedDependency,
  ManifestInvalid,
  CliUsageError,
  LedgerIncomplete,
]).annotate($I.annote("AuditError", { description: "The union of effected-port runner failures." }));

/**
 * The decoded runner error union.
 *
 * @see {@link AuditError} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AuditError = typeof AuditError.Type;
