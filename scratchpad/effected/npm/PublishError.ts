import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Result from "effect/Result";
import { pipe } from "effect/Function";

const $I = $ScratchpadId.create("effected/npm/PublishError");

const PublishFailureKind = LiteralKit(["auth", "pack", "publish", "output", "digest", "executor"]).annotate(
	$I.annote("PublishFailureKind", { description: "The supported PublishError cases." }),
);

const PublishErrorPayload = S.Struct({
	/** Which step failed. */
	kind: PublishFailureKind.annotateKey({ description: "Which step failed." }),
	/** The package directory or tarball the step was working on. */
	subject: S.optionalKey(S.String).annotateKey({ description: "The package directory or tarball the step was working on." }),
	/** The registry involved, for `"auth"` and `"publish"`. */
	registry: S.optionalKey(S.String).annotateKey({ description: "The registry involved, for `\"auth\"` and `\"publish\"`." }),
	/** npm's exit code, when npm ran and failed. */
	exitCode: S.optionalKey(S.Finite).annotateKey({ description: "npm's exit code, when npm ran and failed." }),
	/** npm's output, already redacted by the runner. */
	output: S.optionalKey(S.String).annotateKey({ description: "npm's output, already redacted by the runner." }),
	/** The underlying failure. */
	cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({ description: "The underlying failure." }),
}).annotate(
	$I.annote("PublishErrorPayload", { description: "The compatible public PublishError payload." }),
);

const PublishFailure = PublishFailureKind.mapMembers(([auth, pack, publish, output, digest, executor]) => [
	S.Struct({
		kind: auth.annotateKey({ description: "Registry auth could not be written." }),
		subject: PublishErrorPayload.fields.subject,
		registry: PublishErrorPayload.fields.registry,
		output: PublishErrorPayload.fields.output,
		cause: PublishErrorPayload.fields.cause,
	}).annotate($I.annote("AuthFailure", { description: "Registry auth could not be written." })),
	S.Struct({
		kind: pack.annotateKey({ description: "An npm pack invocation failed." }),
		subject: PublishErrorPayload.fields.subject,
		exitCode: PublishErrorPayload.fields.exitCode,
		output: PublishErrorPayload.fields.output,
		cause: PublishErrorPayload.fields.cause,
	}).annotate($I.annote("PackFailure", { description: "An npm pack invocation failed." })),
	S.Struct({
		kind: publish.annotateKey({ description: "An npm publish invocation failed." }),
		subject: PublishErrorPayload.fields.subject,
		registry: PublishErrorPayload.fields.registry,
		exitCode: PublishErrorPayload.fields.exitCode,
		output: PublishErrorPayload.fields.output,
		cause: PublishErrorPayload.fields.cause,
	}).annotate($I.annote("PublishFailure", { description: "An npm publish invocation failed." })),
	S.Struct({
		kind: output.annotateKey({ description: "npm output could not be decoded." }),
		subject: PublishErrorPayload.fields.subject,
		output: PublishErrorPayload.fields.output,
		cause: PublishErrorPayload.fields.cause,
	}).annotate($I.annote("OutputFailure", { description: "npm output could not be decoded." })),
	S.Struct({
		kind: digest.annotateKey({ description: "Packed bytes could not be read or hashed." }),
		subject: PublishErrorPayload.fields.subject,
		output: PublishErrorPayload.fields.output,
		cause: PublishErrorPayload.fields.cause,
	}).annotate($I.annote("DigestFailure", { description: "Packed bytes could not be read or hashed." })),
	S.Struct({
		kind: executor.annotateKey({ description: "The pinned npm executor could not be launched." }),
		cause: PublishErrorPayload.fields.cause,
	}).annotate($I.annote("ExecutorFailure", { description: "The pinned npm executor could not be launched." })),
] as const).pipe(
	S.annotate($I.annote("PublishFailure", { description: "Validated case-specific PublishError payloads." })),
	S.toTaggedUnion("kind"),
);

const PublishFailureFromPayload = PublishErrorPayload.pipe(
	S.toType,
	S.decodeTo(PublishFailure.pipe(S.toType)),
	S.annotate($I.annote("PublishFailureFromPayload", { description: "Project the compatible payload into a validated case without encoding its cause." })),
);

/**
 * A publish-workflow step failed.
 *
 * **Details**
 *
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
 *
 * **Example** (Route an npm pack failure by kind)
 *
 * ```ts
 * import { PublishError } from "@beep/scratchpad/effected/npm/PublishError";
 *
 * const error = PublishError.make({ kind: "pack", subject: "packages/widget", exitCode: 1 });
 * console.log(error.kind) // pack
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PublishError extends S.TaggedError<PublishError>($I`PublishError`)("PublishError", PublishErrorPayload, $I.annote("PublishError", { description: "A publish-workflow step failed." })) {
	private get variant(): typeof PublishFailure.Type {
		return pipe(this, S.decodeUnknownResult(PublishFailureFromPayload), Result.getOrThrow);
	}

	/**
	 * Formats the failed workflow step with its subject, exit code and non-empty trimmed output when applicable.
	 *
	 * **Example** (Render an npm pack failure)
	 *
	 * ```ts
	 * import { PublishError } from "@beep/scratchpad/effected/npm/PublishError";
	 *
	 * const error = PublishError.make({ kind: "pack", subject: "packages/widget", exitCode: 1 });
	 * console.log(error.message) // npm pack failed for packages/widget (exit 1)
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		const where = (subject: string | undefined): string => subject === undefined ? "" : ` for ${subject}`;
		const code = (exitCode: number | undefined): string => exitCode === undefined ? "" : ` (exit ${exitCode})`;
		const tail = (output: string | undefined): string => {
			const trimmed = output === undefined ? "" : Str.trim(output);
			return trimmed === "" ? "" : `:\n${trimmed}`;
		};
		return PublishFailure.match(this.variant, {
			auth: (failure) => `Could not write npm auth for ${failure.registry ?? "the registry"}${tail(failure.output)}`,
			pack: (failure) => `npm pack failed${where(failure.subject)}${code(failure.exitCode)}${tail(failure.output)}`,
			publish: (failure) => `npm publish failed${where(failure.subject)}${code(failure.exitCode)}${tail(failure.output)}`,
			output: (failure) => `npm produced unreadable output${where(failure.subject)}${tail(failure.output)}`,
			digest: (failure) => `Packed tarball could not be read for hashing${where(failure.subject)}${tail(failure.output)}`,
			executor: () => "A pinned npm was requested, but this project has no launcher to fetch it",
		});
	}
}
