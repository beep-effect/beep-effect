import { Schema } from "effect";

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
export class PublishError extends Schema.TaggedError<PublishError>()("PublishError", {
	/** Which step failed. */
	kind: Schema.Literals(["auth", "pack", "publish", "output", "digest", "executor"]),
	/** The package directory or tarball the step was working on. */
	subject: Schema.optionalKey(Schema.String),
	/** The registry involved, for `"auth"` and `"publish"`. */
	registry: Schema.optionalKey(Schema.String),
	/** npm's exit code, when npm ran and failed. */
	exitCode: Schema.optionalKey(Schema.Number),
	/** npm's output, already redacted by the runner. */
	output: Schema.optionalKey(Schema.String),
	/** The underlying failure. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
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
