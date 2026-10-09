import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Git, LsTreeEntry, NotStubbedError } from "../../effected/git/Git.ts";

const cwd = "/repo";

// ── Git.makeTest: the shape value directly — no layer needed ────────────────

describe("Git.makeTest", () => {
	it.effect("an overridden method runs the stub", () =>
		Effect.gen(function* () {
			const double = Git.makeTest({
				revParse: () => Effect.succeed("a".repeat(40)),
			});
			assert.strictEqual(yield* double.revParse(cwd, "HEAD"), "a".repeat(40));
		}),
	);

	it.effect("an unstubbed method DIES with a defect naming the method", () =>
		Effect.gen(function* () {
			// No honest default exists for any of the twenty-six methods — a
			// fabricated answer would leak into consumer logic as fact — so the
			// default is a defect, not a typed failure a test could swallow.
			const double = Git.makeTest({ revParse: () => Effect.succeed("sha") });
			const exit = yield* Effect.exit(double.status(cwd));
			assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
			if (Exit.isFailure(exit)) {
				assert.isFalse(exit.cause.reasons.some(Cause.isFailReason));
				assert.isTrue(Cause.hasDies(exit.cause));
				const die = exit.cause.reasons.find(Cause.isDieReason);
				assert.isDefined(die);
				const defect = die?.defect;
				assert.instanceOf(defect, NotStubbedError);
				assert.strictEqual(
					defect.message,
					"Git.makeTest: status() was called but not stubbed — no honest default exists for a test double; pass a `status` override.",
				);
			}
		}),
	);

	it.effect("every method of an unstubbed double is present and dies — none is undefined", () =>
		Effect.gen(function* () {
			// The motivating boilerplate (issue #170): a hand-rolled double had to
			// stub all twenty-six methods to satisfy tsc. `makeTest()` with no
			// overrides must fill every slot with a callable that dies.
			const double = Git.makeTest();
			const calls: Record<
				keyof typeof double,
				() => Effect.Effect<unknown, Effect.Error<ReturnType<(typeof double)[keyof typeof double]>>>
			> = {
				show: () => double.show(cwd, "HEAD", "file.txt"),
				lsTree: () => double.lsTree(cwd, "HEAD"),
				refExists: () => double.refExists(cwd, "HEAD"),
				mergeBase: () => double.mergeBase(cwd, "HEAD", "main"),
				mergeBaseOption: () => double.mergeBaseOption(cwd, "HEAD", "main"),
				changedFiles: () => double.changedFiles(cwd, { base: "main", head: "HEAD" }),
				workingChanges: () => double.workingChanges(cwd),
				revParse: () => double.revParse(cwd, "HEAD"),
				checkout: () => double.checkout(cwd, "main"),
				fetch: () => double.fetch(cwd, { ref: "main" }),
				fetchAny: () => double.fetchAny(cwd, { ref: "main" }),
				fetchUnshallow: () => double.fetchUnshallow(cwd),
				isShallow: () => double.isShallow(cwd),
				reset: () => double.reset(cwd),
				clean: () => double.clean(cwd),
				restore: () => double.restore(cwd, ["file.txt"]),
				branchCreate: () => double.branchCreate(cwd, "topic"),
				branchDelete: () => double.branchDelete(cwd, "topic"),
				submoduleUpdate: () => double.submoduleUpdate(cwd),
				submoduleAdd: () => double.submoduleAdd(cwd, { url: "../other", path: "vendor" }),
				submoduleStatus: () => double.submoduleStatus(cwd),
				submoduleInit: () => double.submoduleInit(cwd),
				submoduleDeinit: () => double.submoduleDeinit(cwd, { all: true }),
				submoduleSync: () => double.submoduleSync(cwd),
				submoduleSetUrl: () => double.submoduleSetUrl(cwd, "vendor", "../other"),
				submoduleSetBranch: () => double.submoduleSetBranch(cwd, "vendor"),
				submoduleAbsorbgitdirs: () => double.submoduleAbsorbgitdirs(cwd),
				submoduleForeach: () => double.submoduleForeach(cwd, "git status"),
				sparseCheckoutSet: () => double.sparseCheckoutSet(cwd, ["src"], { cone: true }),
				configSet: () => double.configSet(cwd, "core.bare", "false"),
				add: () => double.add(cwd, ["file.txt"]),
				nameStatus: () => double.nameStatus(cwd, { base: "main" }),
				unstagedChanges: () => double.unstagedChanges(cwd),
				stagedChanges: () => double.stagedChanges(cwd),
				untrackedFiles: () => double.untrackedFiles(cwd),
				defaultBranch: () => double.defaultBranch(cwd),
				currentBranch: () => double.currentBranch(cwd),
				repoRoot: () => double.repoRoot(cwd),
				commonDir: () => double.commonDir(cwd),
				configGet: () => double.configGet(cwd, "core.bare"),
				remoteUrl: () => double.remoteUrl(cwd),
				commitInfo: () => double.commitInfo(cwd),
				log: () => double.log(cwd),
				status: () => double.status(cwd),
				lsRemote: () => double.lsRemote(cwd, "origin"),
				remoteAdd: () => double.remoteAdd(cwd, "origin", "../other"),
				remoteRemove: () => double.remoteRemove(cwd, "origin"),
				remoteSetUrl: () => double.remoteSetUrl(cwd, "origin", "../other"),
				stashPush: () => double.stashPush(cwd),
				stashPop: () => double.stashPop(cwd),
				stashApply: () => double.stashApply(cwd),
				stashDrop: () => double.stashDrop(cwd),
				stashList: () => double.stashList(cwd),
				branchList: () => double.branchList(cwd),
				tagCreate: () => double.tagCreate(cwd, "v1"),
				tagDelete: () => double.tagDelete(cwd, "v1"),
				tagList: () => double.tagList(cwd),
				forEachRef: () => double.forEachRef(cwd),
				revList: () => double.revList(cwd, "HEAD"),
				commit: () => double.commit(cwd, "test"),
				push: () => double.push(cwd),
				pull: () => double.pull(cwd),
				configList: () => double.configList(cwd),
				configGetAll: () => double.configGetAll(cwd, "core.bare"),
				configUnset: () => double.configUnset(cwd, "core.bare"),
				configRemoveSection: () => double.configRemoveSection(cwd, "core"),
				configRenameSection: () => double.configRenameSection(cwd, "core", "other"),
				rm: () => double.rm(cwd, ["file.txt"]),
				mv: () => double.mv(cwd, "old.txt", "new.txt"),
				checkIgnore: () => double.checkIgnore(cwd, ["file.txt"]),
				worktreeAdd: () => double.worktreeAdd(cwd, "../worktree"),
				worktreeList: () => double.worktreeList(cwd),
				worktreeRemove: () => double.worktreeRemove(cwd, "../worktree"),
				lsFiles: () => double.lsFiles(cwd),
			};
			for (const method of R.keys(double)) {
				const fn = double[method];
				assert.isFunction(fn);
				const effect = calls[method]();
				const exit = yield* Effect.exit(effect);
				assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
				assert.isTrue(Cause.hasDies(exit.cause), `${method} should die unstubbed`);
			}
		}),
	);
});

// ── Git.layerTest: the double behind Layer.succeed ──────────────────────────

// Bound to a const: layerTest is a parameterized layer factory and layers
// memoize by reference.
const TestGit = Git.layerTest({
	show: (_cwd: string, _ref: string, path: string) =>
		Effect.succeed(path === "package.json" ? O.some("{}") : O.none()),
	lsTree: () =>
		Effect.succeed([LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path: "package.json" })]),
});

describe("Git.layerTest", () => {
	it.layer(TestGit, { timeout: "30 seconds" })((it) => {
		it.effect("provides the Git service with the stubbed methods answering", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const shown = yield* git.show(cwd, "HEAD", "package.json");
				assertSome(shown, "{}");
				const entries = yield* git.lsTree(cwd, "HEAD");
				assert.deepStrictEqual(
					entries.map((entry) => entry.path),
					["package.json"],
				);
			}),
		);

		it.effect("an unstubbed method still dies through the layer", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const exit = yield* Effect.exit(git.checkout(cwd, "main"));
				assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
				assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
				assert.isTrue(Cause.hasDies(exit.cause));
			}),
		);
	});
});
