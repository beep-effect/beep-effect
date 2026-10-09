// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import { assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schema from "effect/Schema";
import { TestClock } from "effect/testing";
import { Attestation } from "../../effected/github/Attestation.ts";
import { Annotation, CheckRun, CheckRunOutput } from "../../effected/github/CheckRun.ts";
import type { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { GitHubIssue } from "../../effected/github/GitHubIssue.ts";
import { GitHubRelease, ReleaseInfo } from "../../effected/github/GitHubRelease.ts";
import { PullRequest, PullRequestInfo, UpsertedPullRequest } from "../../effected/github/PullRequest.ts";
import { CommentMarker, PullRequestComment } from "../../effected/github/PullRequestComment.ts";
import type { Repo } from "../../effected/github/Repo.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import { WorkflowDispatch } from "../../effected/github/WorkflowDispatch.ts";
import type { Reply } from "./fixtures.ts";
import { linkNext } from "./fixtures.ts";
import { harness } from "./harness.ts";

const JsonCheckOutput = Schema.fromJsonString(Schema.Struct({ conclusion: Schema.optionalKey(Schema.String), output: Schema.Struct({ title: Schema.String, summary: Schema.String }) }));
const JsonObject = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const JsonComment = Schema.fromJsonString(Schema.Struct({ body: Schema.String }));
const JsonGraphQL = Schema.fromJsonString(Schema.Struct({ query: Schema.String, variables: Schema.Unknown }));

const drive = Effect.fn("drive")(function*<I, S, A, E>(
	replies: ReadonlyArray<Reply>,
	service: { readonly layer: Layer.Layer<I, never, GitHubClient> },
	tag: Effect.Effect<S, never, I>,
	use: (resource: S) => Effect.Effect<A, E, Repo>,
) {
		const { script, base } = harness(replies);
		const value = yield* Effect.provide(Effect.flatMap(tag, use), service.layer.pipe(Layer.provideMerge(base)));
		return { value, script };
	});

describe("CheckRunOutput byte budgeting", () => {
	it("leaves an output that fits alone", () => {
		const output = CheckRunOutput.make({ title: "t", summary: "short" });
		assert.strictEqual(output.truncated().summary, "short");
	});

	it("cuts a summary that exceeds the byte budget", () => {
		const output = CheckRunOutput.make({ title: "t", summary: "a".repeat(70_000) });
		const cut = output.truncated().summary;
		assert.isAtMost(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
		assert.isTrue(cut.endsWith(CheckRunOutput.NOTICE));
	});

	it("counts BYTES, not characters", () => {
		// 30k emoji is 30k characters and 120k bytes. A character-count check
		// passes this and the request comes back 422.
		const summary = "🦋".repeat(30_000);
		assert.isBelow(summary.length, CheckRunOutput.LIMIT_BYTES, "under the limit by characters");
		assert.isAbove(Buffer.byteLength(summary, "utf8"), CheckRunOutput.LIMIT_BYTES, "over it by bytes");
		const cut = CheckRunOutput.make({ title: "t", summary }).truncated().summary;
		assert.isAtMost(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
	});

	it("leaves no broken code point behind", () => {
		const cut = CheckRunOutput.make({ title: "t", summary: "🦋".repeat(30_000) }).truncated().summary;
		assert.notInclude(cut.slice(0, -CheckRunOutput.NOTICE.length), "�");
	});

	it("preserves complete replacement characters at the byte boundary", () => {
		const budget = CheckRunOutput.LIMIT_BYTES - Buffer.byteLength(CheckRunOutput.NOTICE, "utf8");
		const prefix = "a".repeat(budget - 6) + "��";
		const cut = CheckRunOutput.make({ title: "t", summary: prefix + "b".repeat(100) }).truncated().summary;
		assert.strictEqual(cut, prefix + CheckRunOutput.NOTICE);
		assert.strictEqual(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
	});

	it("removes only an incomplete trailing UTF-8 sequence", () => {
		const budget = CheckRunOutput.LIMIT_BYTES - Buffer.byteLength(CheckRunOutput.NOTICE, "utf8");
		for (const character of ["é", "€", "🦋", "�"]) {
			for (let included = 1; included < Buffer.byteLength(character, "utf8"); included += 1) {
				const prefix = "a".repeat(budget - included - 3) + "�";
				const cut = CheckRunOutput.make({ title: "t", summary: prefix + character + "b".repeat(100) }).truncated().summary;
				assert.strictEqual(cut, prefix + CheckRunOutput.NOTICE);
				assert.isAtMost(Buffer.byteLength(cut, "utf8"), CheckRunOutput.LIMIT_BYTES);
			}
		}
	});

	it("caps text as well as summary", () => {
		const output = CheckRunOutput.make({ title: "t", summary: "s", text: "b".repeat(70_000) });
		assert.isAtMost(Buffer.byteLength(output.truncated().text ?? "", "utf8"), CheckRunOutput.LIMIT_BYTES);
	});

	it("drops annotations past GitHub's per-request cap", () => {
		const annotations = Array.from({ length: 80 }, (_, index) =>
			Annotation.make({ path: `f${index}`, startLine: 1, endLine: 1, level: "warning", message: "m" }),
		);
		const output = CheckRunOutput.make({ title: "t", summary: "s", annotations });
		assert.lengthOf(output.truncated().annotations ?? [], CheckRunOutput.MAX_ANNOTATIONS);
	});

	// Every scalar value — the whole plane minus the surrogate block, so the
	// cut can land inside any multi-byte sequence or pair without the input
	// itself carrying broken halves. Generated as code points rather than a
	// string because the native string generator stays in printable ASCII;
	// `size` lifts the length scale to the 40 000 cap so the input actually
	// crosses the 65 535-byte budget.
	const ScalarValue = Schema.Union([
		Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xd7ff })),
		Schema.Int.check(Schema.isBetween({ minimum: 0xe000, maximum: 0x10ffff })),
	]);
	const binaryText = Arbitrary.schema(Schema.Array(ScalarValue).check(Schema.isMaxLength(40_000))).pipe(
		Arbitrary.map((codePoints) => codePoints.map((codePoint) => String.fromCodePoint(codePoint)).join("")),
	);

	it.prop(
		"stays valid UTF-8 within budget for any input",
		[binaryText],
		([summary]) => {
			const cut = CheckRunOutput.make({ title: "t", summary }).truncated().summary;
			const withinBudget = Buffer.byteLength(cut, "utf8") <= CheckRunOutput.LIMIT_BYTES;
			// Round-tripping through UTF-8 is lossless exactly when nothing is broken
			// beyond what the input already contained.
			const noNewDamage = (cut.match(/�/g) ?? []).length <= (summary.match(/�/g) ?? []).length + 1;
			return withinBudget && noNewDamage;
		},
		// `size: 40_000` is load-bearing: at 20_000 no run ever crosses the
		// 65 535-byte budget (0/100 probed), at 40_000 about one in five does.
		// That makes each run expensive — ~0.7s for 100 locally, past the 5s
		// default under coverage on a CI runner — so the run count is halved and
		// the timeout raised rather than the domain shrunk.
		{ arbitrary: { size: 40_000, runs: 50 }, timeout: 30_000 },
	);
});

describe("CheckRun", () => {
	it.effect("sends a truncated output on the wire, not the raw one", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[{ status: 200, body: { id: 1, name: "n", status: "completed", html_url: "u" } }],
				CheckRun,
				CheckRun,
				(check) => check.update(1, CheckRunOutput.make({ title: "t", summary: "x".repeat(70_000) })),
			);
			const body = (yield* Schema.decodeEffect(JsonCheckOutput)(script.calls[0]?.body ?? "{}"));
			assert.isAtMost(Buffer.byteLength(body.output.summary, "utf8"), CheckRunOutput.LIMIT_BYTES);
		}),
	);

	it.effect("withCheckRun completes the run on success", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
					{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
				],
				CheckRun,
				CheckRun,
				(check) => check.withCheckRun("build", "sha", (id) => Effect.succeed(id * 2)),
			);
			assert.strictEqual(value, 14);
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion, "success");
		}),
	);

	it.effect("withCheckRun completes it as a failure and re-fails", () =>
		Effect.gen(function* () {
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(CheckRun, (check) => check.withCheckRun("build", "sha", () => Effect.fail("boom" as const))),
					CheckRun.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error, "boom");
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion, "failure");
		}),
	);

	it.effect("withCheckRun concludes as cancelled when `use` is interrupted", () =>
		Effect.gen(function* () {
			// A check run left `in_progress` is never reaped by GitHub: it blocks
			// branch protection until someone deletes it by hand. So the finalizer
			// has to be exit-aware, not a `tap`/`tapError` pair — those fire on
			// success and typed failure only, and an interrupted job (a cancelled
			// workflow, a timeout, a failing sibling in a race) hits neither.
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			const started = yield* Latch.make();
			const fiber = yield* Effect.forkChild(
				Effect.provide(
					Effect.flatMap(CheckRun, (check) =>
						// Open the latch from INSIDE `use`, so the interrupt below cannot
						// land before the run has been created — otherwise the test could
						// pass by never having started one.
						check.withCheckRun("build", "sha", () => Effect.flatMap(started.open, () => Effect.never)),
					),
					CheckRun.layer.pipe(Layer.provideMerge(base)),
				),
			);
			yield* started.await;
			yield* Fiber.interrupt(fiber);

			assert.lengthOf(script.calls, 2, "the run was concluded rather than left in_progress");
			const body = (yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}"));
			assert.strictEqual(body.conclusion, "cancelled");
			assert.strictEqual(body.status, "completed");
		}),
	);

	it.effect("an explicit conclusion replaces the success default", () =>
		Effect.gen(function* () {
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			const value = yield* Effect.provide(
				Effect.flatMap(CheckRun, (check) =>
					check.withCheckRun("build", "sha", (id, conclude) =>
						Effect.gen(function* () {
							// The shape a findings-derived conclusion takes: the work computes
							// the verdict, then hands it to the bracket.
							yield* conclude("neutral");
							return id * 2;
						}),
					),
				),
				CheckRun.layer.pipe(Layer.provideMerge(base)),
			);
			assert.strictEqual(value, 14, "`use`'s own value is untouched by concluding");
			assert.lengthOf(script.calls, 2, "concluded exactly once — recorded, then written by the finalizer");
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion, "neutral");
		}),
	);

	it.effect("an explicit conclusion carries its own output", () =>
		Effect.gen(function* () {
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			yield* Effect.provide(
				Effect.flatMap(CheckRun, (check) =>
					check.withCheckRun("build", "sha", (_id, conclude) =>
						conclude(
							"action_required",
							CheckRunOutput.make({ title: "Needs a maintainer", summary: "Two advisory warnings." }),
						),
					),
				),
				CheckRun.layer.pipe(Layer.provideMerge(base)),
			);
			const body = (yield* Schema.decodeEffect(JsonCheckOutput)(script.calls[1]?.body ?? "{}"));
			assert.strictEqual(body.conclusion, "action_required");
			assert.strictEqual(body.output.title, "Needs a maintainer");
			assert.strictEqual(body.output.summary, "Two advisory warnings.");
		}),
	);

	it.effect("an explicit conclusion wins over the FAILURE default", () =>
		Effect.gen(function* () {
			// Precedence on the failure path: the work decided the run was skipped,
			// then failed for an unrelated reason. "skipped" is the verdict about the
			// check; the failure is the verdict about the program.
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(CheckRun, (check) =>
						check.withCheckRun("build", "sha", (_id, conclude) =>
							Effect.flatMap(conclude("skipped"), () => Effect.fail("boom" as const)),
						),
					),
					CheckRun.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error, "boom", "the failure still propagates");
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion, "skipped");
		}),
	);

	it.effect("an explicit conclusion wins over the CANCELLED default", () =>
		Effect.gen(function* () {
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			const started = yield* Latch.make();
			const fiber = yield* Effect.forkChild(
				Effect.provide(
					Effect.flatMap(CheckRun, (check) =>
						check.withCheckRun("build", "sha", (_id, conclude) =>
							Effect.gen(function* () {
								// A watchdog that has already decided the run timed out, then
								// waits to be torn down. The interrupt must not overwrite it.
								yield* conclude("timed_out");
								yield* started.open;
								return yield* Effect.never;
							}),
						),
					),
					CheckRun.layer.pipe(Layer.provideMerge(base)),
				),
			);
			yield* started.await;
			yield* Fiber.interrupt(fiber);
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion, "timed_out");
		}),
	);

	it.effect("the last conclusion recorded is the one written", () =>
		Effect.gen(function* () {
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			yield* Effect.provide(
				Effect.flatMap(CheckRun, (check) =>
					check.withCheckRun("build", "sha", (_id, conclude) =>
						Effect.flatMap(conclude("neutral"), () => conclude("failure")),
					),
				),
				CheckRun.layer.pipe(Layer.provideMerge(base)),
			);
			assert.lengthOf(script.calls, 2, "two conclude calls still produce ONE completion");
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion, "failure");
		}),
	);

	for (const completionStatus of [200, 422]) {
		it.effect(`a synchronous callback defect concludes the run and survives PATCH status ${completionStatus}`, () =>
			Effect.gen(function* () {
				const defect = GitHubError.decode("callback", "construction defect");
				const { script, base } = harness([
					{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
					{ status: completionStatus, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
				]);
				const exit = yield* Effect.exit(
					Effect.provide(
						Effect.flatMap(CheckRun, (check) => check.withCheckRun("build", "sha", (): Effect.Effect<never> => { throw defect; })),
						CheckRun.layer.pipe(Layer.provideMerge(base)),
					),
				);
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					assert.lengthOf(exit.cause.reasons, 1);
					const found = Cause.findDefect(exit.cause);
					assertSuccess(found, defect);
					assert.strictEqual(found.success, defect);
				}
				assert.lengthOf(script.calls, 2);
				assert.strictEqual(script.calls[1]?.method, "PATCH");
				assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/check-runs/7");
				const body = yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}");
				assert.strictEqual(body.status, "completed");
				assert.strictEqual(body.conclusion, "failure");
			}),
		);
	}

	it.effect("a defect in `use` still concludes the run", () =>
		Effect.gen(function* () {
			// `tapError` fires on the typed error channel only, so a defect used to
			// leave the run open exactly as an interrupt did.
			const { script, base } = harness([
				{ status: 201, body: { id: 7, name: "n", status: "in_progress", html_url: "u" } },
				{ status: 200, body: { id: 7, name: "n", status: "completed", html_url: "u" } },
			]);
			const exit = yield* Effect.exit(
				Effect.provide(
					Effect.flatMap(CheckRun, (check) =>
						check.withCheckRun("build", "sha", () => Effect.die(new Error("kaboom"))),
					),
					CheckRun.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.isTrue(Exit.isFailure(exit));
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")).conclusion, "failure");
		}),
	);
});

describe("CommentMarker", () => {
	it("renders an HTML comment nobody sees", () => {
		assert.strictEqual(CommentMarker.make({ namespace: "acme", key: "release" }).html, "<!-- acme:release -->");
	});

	it("matches only its own marker", () => {
		const marker = CommentMarker.make({ namespace: "acme", key: "release" });
		assert.isTrue(marker.matches("hello\n\n<!-- acme:release -->"));
		assert.isFalse(marker.matches("hello\n\n<!-- acme:other -->"));
	});

	it("needs no client, no layer and no vendor name baked into the library", () => {
		assert.strictEqual(CommentMarker.make({ namespace: "anyone", key: "k" }).html, "<!-- anyone:k -->");
	});
});

describe("PullRequestComment", () => {
	const comment = (id: number, body: string) => ({ id, body, html_url: `https://x/${id}` });
	const marker = CommentMarker.make({ namespace: "acme", key: "release" });

	it.effect("find PAGINATES, so a busy pull request does not lose the marker", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{
						status: 200,
						body: [comment(1, "chatter"), comment(2, "more")],
						headers: linkNext("https://api.github.com/repositories/1/issues/5/comments?page=2"),
					},
					{ status: 200, body: [comment(3, `sticky\n\n${marker.html}`)] },
				],
				PullRequestComment,
				PullRequestComment,
				(comments) => comments.find(5, marker),
			);
			// The version this replaces read one page of 100 and stopped.
			assert.strictEqual(O.getOrThrow(value).id, 3);
			assert.strictEqual(script.count(), 2);
		}),
	);

	it.effect("upsert posts when there is nothing marked yet", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[
					{ status: 200, body: [] },
					{ status: 201, body: comment(9, "x") },
				],
				PullRequestComment,
				PullRequestComment,
				(comments) => comments.upsert(5, marker, "the body"),
			);
			assert.strictEqual(script.calls[1]?.method, "POST");
			assert.include((yield* Schema.decodeEffect(JsonComment)(script.calls[1]?.body ?? "{}")).body, marker.html);
		}),
	);

	it.effect("upsert edits the marked comment when there is one", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[
					{ status: 200, body: [comment(9, `old\n\n${marker.html}`)] },
					{ status: 200, body: comment(9, "new") },
				],
				PullRequestComment,
				PullRequestComment,
				(comments) => comments.upsert(5, marker, "the body"),
			);
			assert.strictEqual(script.calls[1]?.method, "PATCH");
			assert.include(script.calls[1]?.path ?? "", "/issues/comments/9");
		}),
	);
});

describe("PullRequest", () => {
	const pull = (number: number, extra: Record<string, unknown> = {}) => ({
		number,
		node_id: `PR_${number}`,
		html_url: `https://x/${number}`,
		title: `pr ${number}`,
		state: "open",
		head: { ref: "feature", sha: "feature-sha" },
		base: { ref: "main", sha: "base-sha" },
		draft: false,
		merged: false,
		merged_at: null,
		...extra,
	});

	it.effect("listAssociatedWithCommit answers the question it is named for", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[{ status: 200, body: [pull(12, { merged_at: "2026-01-01T00:00:00Z", state: "closed" })] }],
				PullRequest,
				PullRequest,
				(pulls) => pulls.listAssociatedWithCommit("abc123"),
			);
			assert.strictEqual(value[0]?.number, 12);
			assert.isTrue(O.isSome(value[0]?.mergedAt ?? O.none()));
			assert.include(script.calls[0]?.path ?? "", "/commits/abc123/pulls");
		}),
	);

	it.effect("carries the prior description — the carry-through read (effected#373)", () =>
		Effect.gen(function* () {
			// Marker-based PR-body management takes the PRIOR body as input; this
			// is the read path that makes `upsert(existing, managed)` possible.
			const { value } = yield* drive(
				[{ status: 200, body: pull(4, { body: "prior description" }) }],
				PullRequest,
				PullRequest,
				(pulls) => pulls.get(4),
			);
			assert.strictEqual(value.body, "prior description");

			// And through `list`, which shares the projection.
			const { value: listed } = yield* drive(
				[{ status: 200, body: [pull(4, { body: "prior description" })] }],
				PullRequest,
				PullRequest,
				(pulls) => pulls.list(),
			);
			assert.strictEqual(listed[0]?.body, "prior description");
		}),
	);

	it.effect("a null description projects as absent, not as a value", () =>
		Effect.gen(function* () {
			// GitHub sends `body: null` for an empty description; the projection
			// omits the optionalKey rather than inventing "".
			const { value } = yield* drive(
				[{ status: 200, body: pull(5, { body: null }) }],
				PullRequest,
				PullRequest,
				(pulls) => pulls.get(5),
			);
			assert.isUndefined(value.body);
		}),
	);

	it.effect("mergedAt is none for an open pull request", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([{ status: 200, body: pull(1) }], PullRequest, PullRequest, (pulls) =>
				pulls.get(1),
			);
			assert.isTrue(O.isNone(value.mergedAt));
			assert.isFalse(value.merged);
		}),
	);

	it.effect("carries the head and base shas alongside the branch names", () =>
		Effect.gen(function* () {
			// "Which commit did this branch from" is base.sha — routine, and it used
			// to need a raw route.
			const { value } = yield* drive([{ status: 200, body: pull(9) }], PullRequest, PullRequest, (pulls) =>
				pulls.get(9),
			);
			assert.strictEqual(value.head, "feature");
			assert.strictEqual(value.headSha, "feature-sha");
			assert.strictEqual(value.base, "main");
			assert.strictEqual(value.baseSha, "base-sha");
		}),
	);

	it.effect("listFiles carries the status, not the path alone", () =>
		Effect.gen(function* () {
			// The endpoint answers with the same `diff-entry` shape as the
			// single-commit read; projecting to the filename dropped the status and
			// pushed consumers to a raw route.
			const { value, script } = yield* drive(
				[
					{
						status: 200,
						body: [
							{ filename: "a.txt", status: "modified", additions: 1, deletions: 2 },
							{ filename: "new.txt", status: "renamed", additions: 0, deletions: 0, previous_filename: "old.txt" },
						],
					},
				],
				PullRequest,
				PullRequest,
				(pulls) => pulls.listFiles(7),
			);
			assert.deepStrictEqual(
				value.map((file) => file.path),
				["a.txt", "new.txt"],
			);
			assert.strictEqual(value[0]?.status, "modified");
			assert.strictEqual(value[1]?.status, "renamed");
			assert.strictEqual(value[1]?.previousPath, "old.txt");
			assert.include(script.calls[0]?.path ?? "", "/pulls/7/files");
		}),
	);

	it.effect("listFiles rejects an unknown file status through GitHubError", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[{ status: 200, body: [{ filename: "a.txt", status: "future_status", additions: 1, deletions: 0 }] }],
				PullRequest, PullRequest,
				(pulls) => Effect.flip(pulls.listFiles(7)),
			);
			assert.instanceOf(value, GitHubError);
			assert.strictEqual(value.kind, "decode");
			assert.strictEqual(value.operation, "PullRequest.listFiles");
			assert.isDefined(value.cause);
		}),
	);

	it.effect("upsert opens one when none is open", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{ status: 200, body: [] },
					{ status: 201, body: pull(3) },
				],
				PullRequest,
				PullRequest,
				(pulls) => pulls.upsert({ title: "t", head: "feature", base: "main" }),
			);
			assert.isTrue(value.created);
			assert.strictEqual(script.calls[1]?.method, "POST");
		}),
	);

	it.effect("upsert updates the open one when there is one", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{ status: 200, body: [pull(3)] },
					{ status: 200, body: pull(3, { title: "t2" }) },
				],
				PullRequest,
				PullRequest,
				(pulls) => pulls.upsert({ title: "t2", head: "feature", base: "main" }),
			);
			assert.isFalse(value.created);
			assert.strictEqual(script.calls[1]?.method, "PATCH");
		}),
	);

	it.effect("upsert returns schema-valid plain objects for create and update", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[
					{ status: 200, body: [] },
					{ status: 201, body: pull(3) },
					{ status: 200, body: [pull(3)] },
					{ status: 200, body: pull(3, { title: "t2" }) },
				],
				PullRequest, PullRequest,
				(pulls) => Effect.gen(function* () {
					const created = yield* pulls.upsert({ title: "t", head: "feature", base: "main" });
					const updated = yield* pulls.upsert({ title: "t2", head: "feature", base: "main" });
					return { created, updated };
				}),
			);
			assert.isTrue(Schema.is(UpsertedPullRequest)(value.created));
			assert.isTrue(Schema.is(UpsertedPullRequest)(value.updated));
			assert.deepStrictEqual(value.created, { pullRequest: value.created.pullRequest, created: true });
			assert.deepStrictEqual(value.updated, { pullRequest: value.updated.pullRequest, created: false });
			assert.strictEqual(value.created.pullRequest.number, 3);
			assert.strictEqual(value.updated.pullRequest.title, "t2");
		}),
	);

	it.effect("upsert qualifies the head branch with the owner", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[
					{ status: 200, body: [] },
					{ status: 201, body: pull(3) },
				],
				PullRequest,
				PullRequest,
				(pulls) => pulls.upsert({ title: "t", head: "feature", base: "main" }),
			);
			assert.strictEqual(script.queryOf(0).get("head"), "acme:feature");
		}),
	);

	const info = PullRequestInfo.make({
		number: 3,
		nodeId: "PR_3",
		url: "https://x/3",
		title: "t",
		state: "open",
		head: "feature",
		headSha: "feature-sha",
		base: "main",
		baseSha: "base-sha",
		draft: false,
		merged: false,
		mergedAt: O.none(),
	});

	it.effect("setAutoMerge is its own call, carrying the GraphQL merge method", () =>
		Effect.gen(function* () {
			const { script } = yield* drive([{ status: 200, body: { data: {} } }], PullRequest, PullRequest, (pulls) =>
				pulls.setAutoMerge(info, "squash"),
			);
			const body = (yield* Schema.decodeEffect(JsonGraphQL)(script.calls[0]?.body ?? "{}"));
			assert.include(body.query, "enablePullRequestAutoMerge");
			// GraphQL spells the methods in capitals; REST does not.
			assert.deepStrictEqual(body.variables, { pullRequestId: "PR_3", mergeMethod: "SQUASH" });
		}),
	);

	it.effect("setAutoMerge off sends the disable mutation", () =>
		Effect.gen(function* () {
			const { script } = yield* drive([{ status: 200, body: { data: {} } }], PullRequest, PullRequest, (pulls) =>
				pulls.setAutoMerge(info, "off"),
			);
			const body = (yield* Schema.decodeEffect(JsonGraphQL)(script.calls[0]?.body ?? "{}"));
			assert.include(body.query, "disablePullRequestAutoMerge");
			assert.deepStrictEqual(body.variables, { pullRequestId: "PR_3" });
		}),
	);

	it.effect("a create that succeeds is not failed by auto-merge", () =>
		Effect.gen(function* () {
			// The previous surface fired auto-merge from an Effect.tap AFTER create,
			// so an auto-merge failure surfaced as if the create had failed.
			const { value } = yield* drive([{ status: 201, body: pull(4) }], PullRequest, PullRequest, (pulls) =>
				pulls.create({ title: "t", head: "feature", base: "main" }),
			);
			assert.strictEqual(value.number, 4);
		}),
	);
});

describe("GitHubIssue REST", () => {
	const issue = {
		number: 169,
		title: "close me",
		state: "open",
		labels: ["release", { name: "bug" }],
		html_url: "https://x/169",
		node_id: "I_169",
	};

	/**
	 * The default api-version (2022-11-28) is deprecated — sunset 2028-03-10 —
	 * and GitHub flags old-version calls to changed endpoints with a
	 * `Deprecation` header octokit prints to the consumer's console. The module
	 * pins the current version instead (effected#189); these assertions are on
	 * the wire, through the real octokit path, so dropping the header fails.
	 */
	const PINNED = "2026-03-10";

	it.effect("close sends state, state_reason and the pinned api-version", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[{ status: 200, body: { ...issue, state: "closed" } }],
				GitHubIssue,
				GitHubIssue,
				(issues) => issues.close(169, "not_planned"),
			);
			const call = script.calls[0];
			assert.isDefined(call);
			assert.strictEqual(call?.method, "PATCH");
			assert.strictEqual(call.path, "/repos/acme/widget/issues/169");
			assert.strictEqual(call.headers["x-github-api-version"], PINNED);
			const body = (yield* Schema.decodeEffect(JsonObject)(call.body ?? "{}"));
			assert.strictEqual(body.state, "closed");
			assert.strictEqual(body.state_reason, "not_planned");
		}),
	);

	it.effect("close without a reason leaves state_reason out of the body", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[{ status: 200, body: { ...issue, state: "closed" } }],
				GitHubIssue,
				GitHubIssue,
				(issues) => issues.close(169),
			);
			const body = (yield* Schema.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}"));
			assert.strictEqual(body.state, "closed");
			assert.notProperty(body, "state_reason");
			// The version header does not leak into the body as a parameter.
			assert.notProperty(body, "headers");
		}),
	);

	it.effect("get pins the api-version and normalizes the label union", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive([{ status: 200, body: issue }], GitHubIssue, GitHubIssue, (issues) =>
				issues.get(169),
			);
			assert.strictEqual(script.calls[0]?.headers["x-github-api-version"], PINNED);
			assert.deepStrictEqual([...value.labels], ["release", "bug"]);
			assert.strictEqual(value.nodeId, "I_169");
		}),
	);

	it.effect("comment pins the api-version and returns the new comment id", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive([{ status: 201, body: { id: 77 } }], GitHubIssue, GitHubIssue, (issues) =>
				issues.comment(169, "done"),
			);
			assert.strictEqual(value, 77);
			const call = script.calls[0];
			assert.isDefined(call);
			assert.strictEqual(call?.method, "POST");
			assert.strictEqual(call.path, "/repos/acme/widget/issues/169/comments");
			assert.strictEqual(call.headers["x-github-api-version"], PINNED);
			assert.strictEqual(((yield* Schema.decodeEffect(JsonObject)(call.body ?? "{}"))).body, "done");
		}),
	);

	it.effect("list pins the api-version and forwards its page options", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive([{ status: 200, body: [issue] }], GitHubIssue, GitHubIssue, (issues) =>
				issues.list({ state: "open", labels: ["release", "bug"], page: PageOptions.make({ perPage: 5 }) }),
			);
			assert.strictEqual(value.length, 1);
			assert.strictEqual(script.calls[0]?.headers["x-github-api-version"], PINNED);
			assert.strictEqual(script.queryOf(0).get("per_page"), "5");
			assert.strictEqual(script.queryOf(0).get("state"), "open");
			assert.strictEqual(script.queryOf(0).get("labels"), "release,bug");
			// The header rode as a header, not as a query parameter.
			assert.isNull(script.queryOf(0).get("headers"));
		}),
	);
});

describe("GitHubIssue.commentOnce", () => {
	const marker = CommentMarker.make({ namespace: "acme", key: "once" });
	const comment = (id: number, body: string) => ({ id, body, html_url: `https://x/${id}` });

	it.effect("skips when the marker is already there — even on a later page", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{
						status: 200,
						body: [comment(1, "chatter"), comment(2, "more chatter")],
						headers: linkNext("https://api.github.com/repositories/1/issues/5/comments?page=2"),
					},
					{ status: 200, body: [comment(3, `already said\n\n${marker.html}`)] },
				],
				GitHubIssue,
				GitHubIssue,
				(issues) => issues.commentOnce(5, marker, "the body"),
			);
			// Found on page TWO: a single-page read would have posted a duplicate.
			assert.isFalse(value.wrote);
			assert.strictEqual(value.comment.id, 3);
			assert.strictEqual(script.count(), 2);
			// Create-or-skip, never edit: nothing was posted or patched.
			assert.isTrue(script.calls.every((call) => call.method === "GET"));
		}),
	);

	it.effect("creates with the marker appended exactly as upsert formats it", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{ status: 200, body: [comment(1, "unrelated chatter")] },
					{ status: 201, body: comment(9, `the body\n\n${marker.html}`) },
				],
				GitHubIssue,
				GitHubIssue,
				(issues) => issues.commentOnce(5, marker, "the body"),
			);
			assert.isTrue(value.wrote);
			assert.strictEqual(value.comment.id, 9);
			const post = script.calls[1];
			assert.isDefined(post);
			assert.strictEqual(post?.method, "POST");
			assert.strictEqual(post.path, "/repos/acme/widget/issues/5/comments");
			// The exact `upsert` spelling, so either member's comment is findable
			// by the other's marker check.
			const sent = ((yield* Schema.decodeEffect(JsonObject)(post.body ?? "{}"))).body;
			assert.strictEqual(sent, `the body\n\n${marker.html}`);
			// The pinned api-version rides on the read AND the write.
			for (const call of script.calls) {
				assert.strictEqual(call.headers["x-github-api-version"], "2026-03-10");
			}
		}),
	);

	it.effect("passes the client's GitHubError through untouched", () =>
		Effect.gen(function* () {
			const { base } = harness([{ status: 404, body: { message: "Not Found" } }]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitHubIssue, (issues) => issues.commentOnce(5, marker, "the body")),
					GitHubIssue.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "notFound");
		}),
	);

	it("makeTest dies loudly on the unstubbed member, naming it", () => {
		assert.throws(
			() => GitHubIssue.makeTest({}).commentOnce(1, marker, "x"),
			/commentOnce\(\) was called but not stubbed/,
		);
	});
});

describe("GitHubIssue GraphQL documents", () => {
	it.effect("linkedIssues distinguishes human links from inferred ones", () =>
		Effect.gen(function* () {
			const node = (number: number) => ({
				id: `I_${number}`,
				number,
				title: `issue ${number}`,
				state: "OPEN",
				url: `https://x/${number}`,
			});
			const { value } = yield* drive(
				[
					{
						status: 200,
						body: {
							data: {
								repository: {
									pullRequest: {
										allLinked: { nodes: [node(1), node(2)] },
										manuallyLinked: { nodes: [node(2)] },
									},
								},
							},
						},
					},
				],
				GitHubIssue,
				GitHubIssue,
				(issues) => issues.linkedIssues(7),
			);
			// The field the whole owned document exists for.
			assert.isFalse(value.find((issue) => issue.number === 1)?.userLinked);
			assert.isTrue(value.find((issue) => issue.number === 2)?.userLinked);
		}),
	);

	it.effect("isCrossReferencedBy is the idempotence guard", () =>
		Effect.gen(function* () {
			const body = (number: number) => ({
				data: {
					repository: {
						issue: { timelineItems: { nodes: [{ source: { __typename: "PullRequest", number } }] } },
					},
				},
			});
			const { value } = yield* drive([{ status: 200, body: body(42) }], GitHubIssue, GitHubIssue, (issues) =>
				issues.isCrossReferencedBy(1, 42),
			);
			assert.isTrue(value);

			const { value: other } = yield* drive([{ status: 200, body: body(41) }], GitHubIssue, GitHubIssue, (issues) =>
				issues.isCrossReferencedBy(1, 42),
			);
			assert.isFalse(other);
		}),
	);
});

describe("GitHubRelease", () => {
	const release = {
		id: 5,
		tag_name: "v1.0.0",
		name: null,
		body: null,
		draft: false,
		prerelease: false,
		html_url: "https://x/5",
		upload_url: "https://uploads.github.com/x{?name,label}",
	};

	it.effect("coalesces GitHub's nulls for name and body", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([{ status: 200, body: release }], GitHubRelease, GitHubRelease, (releases) =>
				releases.getByTag("v1.0.0"),
			);
			assert.strictEqual(value.name, "");
			assert.strictEqual(value.body, "");
		}),
	);

	it.effect("getByTagOption reads absence as none", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[{ status: 404, body: { message: "Not Found" } }],
				GitHubRelease,
				GitHubRelease,
				(releases) => releases.getByTagOption("v9.9.9"),
			);
			assert.isTrue(O.isNone(value));
		}),
	);

	it.effect("uploadAsset goes to the uploads host with a content type", () =>
		Effect.gen(function* () {
			const info = ReleaseInfo.make({
				id: 5,
				tag: "v1.0.0",
				name: "",
				body: "",
				draft: false,
				prerelease: false,
				url: "https://x/5",
				uploadUrl: "https://uploads.github.com/x",
			});
			const { value, script } = yield* drive(
				[{ status: 201, body: { id: 9, name: "app.zip", browser_download_url: "https://d/9", size: 12 } }],
				GitHubRelease,
				GitHubRelease,
				(releases) => releases.uploadAsset(info, { name: "app.zip", data: "bytes", contentType: "application/zip" }),
			);
			assert.strictEqual(value.id, 9);
			assert.include(script.calls[0]?.url ?? "", "uploads.github.com");
			assert.strictEqual(script.calls[0]?.headers["content-type"], "application/zip");
			// The discriminating assertion is on the BUILT url, not the arguments:
			// this route is outside the generated map, so a `name` passed only as
			// a parameter is silently dropped by octokit — every upload then 400s
			// with "Invalid name for request" (live incident, 2026-07-26).
			assert.strictEqual(script.queryOf(0).get("name"), "app.zip");
			assert.isFalse(script.queryOf(0).has("label"));
			assert.notInclude(script.calls[0]?.url ?? "", "&");
		}),
	);

	it.effect("uploadAsset carries an optional display label as a second query parameter", () =>
		Effect.gen(function* () {
			const info = ReleaseInfo.make({
				id: 5,
				tag: "v1.0.0",
				name: "",
				body: "",
				draft: false,
				prerelease: false,
				url: "https://x/5",
				uploadUrl: "https://uploads.github.com/x",
			});
			const { script } = yield* drive(
				[{ status: 201, body: { id: 9, name: "app.zip", browser_download_url: "https://d/9", size: 12 } }],
				GitHubRelease,
				GitHubRelease,
				(releases) =>
					releases.uploadAsset(info, {
						name: "app.zip",
						data: "bytes",
						contentType: "application/zip",
						label: "Tarball (npm)",
					}),
			);
			assert.strictEqual(script.queryOf(0).get("name"), "app.zip");
			assert.strictEqual(script.queryOf(0).get("label"), "Tarball (npm)");
		}),
	);

	it.effect("listAssets forwards the caller's page budget", () =>
		Effect.gen(function* () {
			const { script } = yield* drive([{ status: 200, body: [] }], GitHubRelease, GitHubRelease, (releases) =>
				releases.listAssets(5, { page: PageOptions.make({ perPage: 7 }) }),
			);
			assert.strictEqual(script.queryOf(0).get("per_page"), "7");
		}),
	);
});

describe("WorkflowDispatch", () => {
	const run = (status: string, conclusion?: string) => ({
		status: 200,
		body: {
			id: 1,
			status,
			html_url: "https://x/1",
			path: ".github/workflows/ci.yml",
			...(conclusion !== undefined ? { conclusion } : {}),
		},
	});
	const runs = (status: string) => ({
		status: 200,
		body: { workflow_runs: [run(status).body], total_count: 1 },
	});

	it.effect("polls until the run finishes, with no sentinel error", () =>
		Effect.gen(function* () {
			const { script, base } = harness([
				{ status: 204 },
				runs("queued"),
				run("in_progress"),
				run("completed", "success"),
			]);
			const fiber = yield* Effect.forkChild(
				Effect.provide(
					Effect.flatMap(WorkflowDispatch, (workflows) =>
						workflows.dispatchAndWait("ci.yml", "main", {
							poll: { interval: Duration.seconds(1), timeout: Duration.seconds(30) },
						}),
					),
					WorkflowDispatch.layer.pipe(Layer.provideMerge(base)),
				),
			);
			yield* TestClock.adjust(Duration.seconds(10));
			const status = yield* Fiber.join(fiber);
			assert.strictEqual(status.conclusion, "success");
			assert.isTrue(status.isDone);
			assert.isAtLeast(script.count(), 4);
			assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/actions/workflows/ci.yml/runs");
			assert.strictEqual(script.calls[2]?.path, "/repos/acme/widget/actions/runs/1");
			assert.strictEqual(script.calls[3]?.path, "/repos/acme/widget/actions/runs/1");
		}),
	);

	it.effect("fails typed when the run never finishes", () =>
		Effect.gen(function* () {
			const { script, base } = harness([{ status: 204 }, runs("in_progress"), run("in_progress")]);
			const fiber = yield* WorkflowDispatch.pipe(
				Effect.flatMap((workflows) =>
					workflows.dispatchAndWait("ci.yml", "main", {
						poll: { interval: Duration.seconds(1), timeout: Duration.seconds(3) },
					}),
				),
				Effect.provide(WorkflowDispatch.layer.pipe(Layer.provideMerge(base))),
				Effect.flip,
				Effect.forkChild,
			);
			yield* TestClock.adjust(Duration.seconds(30));
			const error = yield* Fiber.join(fiber);
			assert.strictEqual(error.kind, "rejected");
			assert.include(error.reason, "did not finish");
			assert.strictEqual(error.status, 408);
			assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/actions/workflows/ci.yml/runs");
			assert.strictEqual(script.calls[2]?.path, "/repos/acme/widget/actions/runs/1");
		}),
	);
});

describe("WorkflowDispatch.list", () => {
	const workflowsBody = (workflows: ReadonlyArray<Record<string, unknown>>) => ({
		status: 200,
		body: { total_count: workflows.length, workflows },
	});

	it.effect("reports every workflow, including disabled ones, without interpreting state", () =>
		Effect.gen(function* () {
			// State is reported, never filtered here. Whether a *disabled* workflow
			// counts for a given GitHub feature is that feature's server-side rule,
			// which this package cannot test — so it does not encode a guess about
			// it. A caller that cares filters on `state` itself.
			const { script, base } = harness([
				workflowsBody([
					{ id: 1, name: "CI", path: ".github/workflows/ci.yml", state: "active" },
					{ id: 2, name: "Old", path: ".github/workflows/old.yml", state: "disabled_manually" },
				]),
			]);
			const workflows = yield* Effect.provide(
				Effect.flatMap(WorkflowDispatch, (w) => w.list),
				WorkflowDispatch.layer.pipe(Layer.provideMerge(base)),
			);
			assert.deepStrictEqual(
				[...workflows],
				[
					{ id: 1, name: "CI", path: ".github/workflows/ci.yml", state: "active" },
					{ id: 2, name: "Old", path: ".github/workflows/old.yml", state: "disabled_manually" },
				],
			);
			assert.include(script.calls[0]?.url ?? "", "/actions/workflows");
		}),
	);

	it.effect("a repository with no workflows is an empty array, not a failure", () =>
		Effect.gen(function* () {
			// The case the reporting consumer actually hit: every repository they
			// ran against had zero workflows. Failing here would make "no
			// workflows" indistinguishable from "could not ask".
			const { base } = harness([workflowsBody([])]);
			const workflows = yield* Effect.provide(
				Effect.flatMap(WorkflowDispatch, (w) => w.list),
				WorkflowDispatch.layer.pipe(Layer.provideMerge(base)),
			);
			assert.lengthOf(workflows, 0);
		}),
	);
});

describe("Attestation", () => {
	it.effect("pins the api version on every call", () =>
		Effect.gen(function* () {
			const { script } = yield* drive([{ status: 201, body: { id: 3 } }], Attestation, Attestation, (attestations) =>
				attestations.upload({ dsseEnvelope: {} }),
			);
			assert.strictEqual(script.calls[0]?.headers["x-github-api-version"], "2026-03-10");
		}),
	);

	it.effect("reads a 404 as no attestations", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[{ status: 404, body: { message: "Not Found" } }],
				Attestation,
				Attestation,
				(attestations) => attestations.listForSubject("abc"),
			);
			assert.deepStrictEqual(value, []);
		}),
	);

	it.effect("reads a 422 as no attestations too", () =>
		Effect.gen(function* () {
			// GitHub answers a digest it has never seen either way depending on path.
			const { value } = yield* drive(
				[{ status: 422, body: { message: "Validation Failed" } }],
				Attestation,
				Attestation,
				(attestations) => attestations.listForSubject("abc"),
			);
			assert.deepStrictEqual(value, []);
		}),
	);

	it.effect("prefixes a bare hex digest", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[{ status: 200, body: { attestations: [] } }],
				Attestation,
				Attestation,
				(attestations) => attestations.listForSubject("deadbeef"),
			);
			assert.include(script.calls[0]?.path ?? "", "sha256:deadbeef");
		}),
	);

	it.effect("projects entries to url and predicate type", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[
					{
						status: 200,
						body: {
							attestations: [{ id: 1, bundle_url: "https://b/1", predicate_type: "https://slsa.dev/provenance/v1" }],
						},
					},
				],
				Attestation,
				Attestation,
				(attestations) => attestations.listForSubject("sha256:abc"),
			);
			assert.strictEqual(value[0]?.url, "https://b/1");
			assert.strictEqual(value[0]?.predicateType, "https://slsa.dev/provenance/v1");
		}),
	);
});
