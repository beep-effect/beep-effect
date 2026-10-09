import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/npm/PublishError");

/**
 * A publish-workflow step failed.
 *
 * @remarks
 * `kind` is the routing surface, sized to the steps that actually exist:
 * `"auth"` (the npmrc could not be written), `"pack"` (`npm pack` failed),
 * `"publish"` (`npm publish` failed), `"output"` (npm ran but its `--json`
 * output was unreadable), `"digest"` (npm packed, but the tarball could not be
 * read back to hash it), `"executor"` (a pinned npm was requested with no
 * launcher to fetch it). There is deliberately no free-form `reason` string:
 * branch on `kind`, never on substrings of the message.
 *
 * A resident of its own module because both {@link NpmExecutor} and
 * `PackagePublish` raise it and `NpmExecutor` is imported *by* `PackagePublish`
 * — the same one-way-edge reasoning that puts `DependencyResolutionError` in
 * `WorkspaceResolver.ts` and `CatalogAssemblyError` in a leaf module.
 *
 * @public
 */
export class PublishError extends S.TaggedError<PublishError>($I`PublishError`)("PublishError", {
	/** Which step failed. */
	kind: S.Literals(["auth", "pack", "publish", "output", "digest", "executor"]).annotateKey({ description: "Which step failed." }),
	/** The package directory or tarball the step was working on. */
	subject: S.optionalKey(S.String).annotateKey({ description: "The package directory or tarball the step was working on." }),
	/** The registry involved, for `"auth"` and `"publish"`. */
	registry: S.optionalKey(S.String).annotateKey({ description: "The registry involved, for `\"auth\"` and `\"publish\"`." }),
	/** npm's exit code, when npm ran and failed. */
	exitCode: S.optionalKey(S.Finite).annotateKey({ description: "npm's exit code, when npm ran and failed." }),
	/** npm's output, already redacted by the runner. */
	output: S.optionalKey(S.String).annotateKey({ description: "npm's output, already redacted by the runner." }),
	/** The underlying failure. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure." }),
}, $I.annote("PublishError", { description: "A publish-workflow step failed." })) {
	override get message(): string {
		const where = this.subject === undefined ? "" : ` for ${this.subject}`;
		const code = this.exitCode === undefined ? "" : ` (exit ${this.exitCode})`;
		const tail = this.output === undefined || this.output.trim() === "" ? "" : `:\n${this.output.trim()}`;
		switch (this.kind) {
			case "auth":
				return `Could not write npm auth for ${this.registry ?? "the registry"}${tail}`;
			case "pack":
				return `npm pack failed${where}${code}${tail}`;
			case "publish":
				return `npm publish failed${where}${code}${tail}`;
			case "output":
				return `npm produced unreadable output${where}${tail}`;
			case "digest":
				return `Packed tarball could not be read for hashing${where}${tail}`;
			default:
				return "A pinned npm was requested, but this project has no launcher to fetch it";
		}
	}
}
