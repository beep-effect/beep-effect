import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { ChildProcess } from "effect/process";

import type { GitInvocation } from "../../effected/git/GitCommand.ts";
import { GitCommand } from "../../effected/git/GitCommand.ts";

/**
 * Asserts the argv/env/extendEnv/no-cwd shape shared by every `GitCommand`
 * constructor. `expectedRedacted` defaults to the raw argv — a constructor
 * with no sensitive positional must produce an element-wise identical
 * `redactedArgs`.
 *
 * A constructor carries NO environment and NO cwd: both are run-time context
 * the `Git` service applies at its single spawn choke point (#670). The
 * `env` assertion here is therefore a purity guard — a pin that leaks back
 * onto a pure constructor fails every one of these cases at once.
 */
const assertGitCommand = (
	invocation: GitInvocation,
	expectedArgs: ReadonlyArray<string>,
	expectedRedacted: ReadonlyArray<string> = expectedArgs,
): void => {
	const command = invocation.command;
	assert.isTrue(ChildProcess.isStandardCommand(command));
	if (!ChildProcess.isStandardCommand(command)) return;
	assert.strictEqual(command.command, "git");
	assert.deepStrictEqual(command.args, expectedArgs);
	assert.deepStrictEqual(invocation.redactedArgs, expectedRedacted);
	assert.isUndefined(command.options.env);
	assert.strictEqual(command.options.extendEnv, true);
	assert.isUndefined(command.options.cwd);
};

describe("GitCommand", () => {
	it("show builds `git show <ref>:<path>`", () => {
		assertGitCommand(GitCommand.show("HEAD", "package.json"), ["show", "HEAD:package.json"]);
	});

	it("lsTree builds `git ls-tree -r -z <ref>`", () => {
		assertGitCommand(GitCommand.lsTree("HEAD"), ["ls-tree", "-r", "-z", "HEAD"]);
	});

	it("refExists builds `git cat-file -e <ref>`", () => {
		assertGitCommand(GitCommand.refExists("HEAD"), ["cat-file", "-e", "HEAD"]);
	});

	it("mergeBase builds `git merge-base <a> <b>`", () => {
		assertGitCommand(GitCommand.mergeBase("main", "feat/git"), ["merge-base", "main", "feat/git"]);
	});

	it("changedFiles builds `git diff --name-only -z --no-relative <base>...<head>`", () => {
		// --no-relative is explicit on the default branch so an inherited
		// diff.relative=true config cannot silently make the output cwd-relative.
		assertGitCommand(GitCommand.changedFiles("main", "feat/git"), [
			"diff",
			"--name-only",
			"-z",
			"--no-relative",
			"main...feat/git",
		]);
	});

	it("changedFiles with relative passes --relative before the range", () => {
		assertGitCommand(GitCommand.changedFiles("main", "feat/git", true), [
			"diff",
			"--name-only",
			"-z",
			"--relative",
			"main...feat/git",
		]);
	});

	it("unstagedChanges builds `git diff --name-only -z`, with an explicit --no-relative/--relative", () => {
		assertGitCommand(GitCommand.unstagedChanges(), ["diff", "--name-only", "-z", "--no-relative"]);
		assertGitCommand(GitCommand.unstagedChanges(true), ["diff", "--name-only", "-z", "--relative"]);
	});

	it("stagedChanges builds `git diff --name-only -z --cached`, with an explicit --no-relative/--relative", () => {
		assertGitCommand(GitCommand.stagedChanges(), ["diff", "--name-only", "-z", "--no-relative", "--cached"]);
		assertGitCommand(GitCommand.stagedChanges(true), ["diff", "--name-only", "-z", "--relative", "--cached"]);
	});

	it("untrackedFiles builds `git ls-files --others --exclude-standard -z`, adding --full-name when NOT relative", () => {
		// Default (repo-root-relative, matching the un-`--relative` diffs) carries
		// --full-name; the cwd-relative form (matching the --relative diffs) omits it.
		assertGitCommand(GitCommand.untrackedFiles(), ["ls-files", "--others", "--exclude-standard", "-z", "--full-name"]);
		assertGitCommand(GitCommand.untrackedFiles(true), ["ls-files", "--others", "--exclude-standard", "-z"]);
	});

	it("revParse builds `git rev-parse --verify <ref>`", () => {
		assertGitCommand(GitCommand.revParse("HEAD"), ["rev-parse", "--verify", "HEAD"]);
	});

	it("checkout without options is unchanged", () => {
		assertGitCommand(GitCommand.checkout("main"), ["checkout", "main"]);
	});

	it("checkout --detach places the flag before the ref", () => {
		assertGitCommand(GitCommand.checkout("FETCH_HEAD", true), ["checkout", "--detach", "FETCH_HEAD"]);
	});

	it("fetch builds remote-then-ref, with optional depth and tag keyword", () => {
		assertGitCommand(GitCommand.fetch("origin", "main"), ["fetch", "origin", "main"]);
		assertGitCommand(GitCommand.fetch("origin", "v1.0.0", 1, true), [
			"fetch",
			"--depth",
			"1",
			"origin",
			"tag",
			"v1.0.0",
		]);
	});

	it("fetch passes a full refspec through verbatim and places --unshallow before the remote", () => {
		// The refspec is never transformed: under a single-branch clone it is the
		// only spelling that creates the remote-tracking ref.
		assertGitCommand(GitCommand.fetch("origin", "+refs/heads/b:refs/remotes/origin/b"), [
			"fetch",
			"origin",
			"+refs/heads/b:refs/remotes/origin/b",
		]);
		assertGitCommand(GitCommand.fetch("origin", "main", undefined, false, true), [
			"fetch",
			"--unshallow",
			"origin",
			"main",
		]);
	});

	it("submoduleUpdate composes --init, --depth and a -- pathspec", () => {
		assertGitCommand(GitCommand.submoduleUpdate(), ["submodule", "update"]);
		assertGitCommand(GitCommand.submoduleUpdate(true, 1, [".repos/effect"]), [
			"submodule",
			"update",
			"--init",
			"--depth",
			"1",
			"--",
			".repos/effect",
		]);
	});

	it("submoduleUpdate emits the full flag family in a pinned order, --no-fetch only on fetch: false", () => {
		// --checkout is the documented override for submodule.<name>.update=none;
		// each flag is independent and the emission order is stable.
		assertGitCommand(GitCommand.submoduleUpdate(false, undefined, [], { checkout: true }), [
			"submodule",
			"update",
			"--checkout",
		]);
		assertGitCommand(GitCommand.submoduleUpdate(false, undefined, [], { fetch: false }), [
			"submodule",
			"update",
			"--no-fetch",
		]);
		assertGitCommand(
			GitCommand.submoduleUpdate(true, 1, [".repos/effect"], {
				checkout: true,
				remote: true,
				fetch: false,
				recursive: true,
				force: true,
			}),
			[
				"submodule",
				"update",
				"--init",
				"--checkout",
				"--remote",
				"--no-fetch",
				"--recursive",
				"--force",
				"--depth",
				"1",
				"--",
				".repos/effect",
			],
		);
	});

	it("submoduleAdd puts url and path behind a literal --", () => {
		assertGitCommand(GitCommand.submoduleAdd("https://example.com/r.git", ".repos/r", 1), [
			"submodule",
			"add",
			"--depth",
			"1",
			"--",
			"https://example.com/r.git",
			".repos/r",
		]);
	});

	it("sparseCheckoutSet passes the cone flag explicitly in both branches", () => {
		assertGitCommand(GitCommand.sparseCheckoutSet(["src", "docs"], false), [
			"sparse-checkout",
			"set",
			"--no-cone",
			"src",
			"docs",
		]);
		assertGitCommand(GitCommand.sparseCheckoutSet(["src"], true), ["sparse-checkout", "set", "--cone", "src"]);
	});

	it("configSet writes a key, optionally into an explicit file — and masks the value in redactedArgs", () => {
		// The raw argv carries the real value (git needs it); the redacted argv
		// masks it wholesale — a config value can be a secret (#86).
		assertGitCommand(
			GitCommand.configSet("user.name", "Test"),
			["config", "user.name", "Test"],
			["config", "user.name", "<redacted>"],
		);
		assertGitCommand(
			GitCommand.configSet("submodule.a.shallow", "true", ".gitmodules"),
			["config", "-f", ".gitmodules", "submodule.a.shallow", "true"],
			["config", "-f", ".gitmodules", "submodule.a.shallow", "<redacted>"],
		);
	});

	it("add stages paths behind a literal --", () => {
		assertGitCommand(GitCommand.add([".gitmodules", ".repos/r"]), ["add", "--", ".gitmodules", ".repos/r"]);
	});

	it("setCwd returns a NEW command and leaves the original untouched", () => {
		const original = GitCommand.show("HEAD", "package.json").command;
		const withCwd = ChildProcess.setCwd(original, "/repo");

		assert.notStrictEqual(withCwd, original);
		if (ChildProcess.isStandardCommand(original)) {
			assert.isUndefined(original.options.cwd);
		}
		if (ChildProcess.isStandardCommand(withCwd)) {
			assert.strictEqual(withCwd.options.cwd, "/repo");
		}
	});

	it("nameStatus builds the working-tree-vs-ref form when head is omitted", () => {
		assertGitCommand(GitCommand.nameStatus("abc123", undefined), [
			"diff",
			"--name-status",
			"-z",
			"--no-relative",
			"abc123",
		]);
	});

	it("nameStatus builds the base...head form when head is present, honoring relative", () => {
		assertGitCommand(GitCommand.nameStatus("main", "feat/x", true), [
			"diff",
			"--name-status",
			"-z",
			"--relative",
			"main...feat/x",
		]);
	});

	it("lsTree without a pathspec is unchanged", () => {
		assertGitCommand(GitCommand.lsTree("HEAD"), ["ls-tree", "-r", "-z", "HEAD"]);
	});

	it("lsTree appends the pathspec behind a literal --", () => {
		assertGitCommand(GitCommand.lsTree("HEAD", [".changeset", "docs"]), [
			"ls-tree",
			"-r",
			"-z",
			"HEAD",
			"--",
			".changeset",
			"docs",
		]);
	});

	it("defaultBranch probes the remote's symbolic HEAD quietly", () => {
		assertGitCommand(GitCommand.defaultBranch(), ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
		assertGitCommand(GitCommand.defaultBranch("upstream"), [
			"symbolic-ref",
			"--quiet",
			"--short",
			"refs/remotes/upstream/HEAD",
		]);
	});

	it("currentBranch builds `git rev-parse --abbrev-ref HEAD`", () => {
		assertGitCommand(GitCommand.currentBranch(), ["rev-parse", "--abbrev-ref", "HEAD"]);
	});

	it("repoRoot builds `git rev-parse --show-toplevel`", () => {
		assertGitCommand(GitCommand.repoRoot(), ["rev-parse", "--show-toplevel"]);
	});

	it("commonDir builds `git rev-parse --path-format=absolute --git-common-dir`", () => {
		assertGitCommand(GitCommand.commonDir(), ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
	});

	it("commitInfo builds a NUL-separated single-commit log format", () => {
		assertGitCommand(GitCommand.commitInfo(), ["log", "-1", "--format=%H%x00%G?%x00%B", "HEAD"]);
		assertGitCommand(GitCommand.commitInfo("v1.0.0"), ["log", "-1", "--format=%H%x00%G?%x00%B", "v1.0.0"]);
	});

	it("log builds the -z record format with --name-only and no pathspec by default", () => {
		assertGitCommand(GitCommand.log(), ["log", "-z", "--format=%x1e%H%x00%aI%x00%cI%x00%an%x00%ae", "--name-only"]);
	});

	it("log puts every flag before the `--` pathspec separator", () => {
		// Order is load-bearing: git reads everything after `--` as a path, so a
		// flag emitted late would be spawned as a filename.
		assertGitCommand(GitCommand.log(["src/Git.ts"], true, 5, true), [
			"log",
			"-z",
			"--format=%x1e%H%x00%aI%x00%cI%x00%an%x00%ae",
			"--name-only",
			"--follow",
			"--diff-merges=first-parent",
			"--max-count=5",
			"--",
			"src/Git.ts",
		]);
	});

	it("log emits --max-count=0 for limit 0 rather than dropping it", () => {
		// `0` is falsy: a truthiness test here would silently ask for the WHOLE
		// history when the caller asked for none of it.
		assertGitCommand(GitCommand.log([], false, 0), [
			"log",
			"-z",
			"--format=%x1e%H%x00%aI%x00%cI%x00%an%x00%ae",
			"--name-only",
			"--max-count=0",
		]);
	});

	it("configGet builds `git config --get <key>`", () => {
		assertGitCommand(GitCommand.configGet("user.signingkey"), ["config", "--get", "user.signingkey"]);
	});

	it("remoteUrl builds `git remote get-url <remote>`", () => {
		assertGitCommand(GitCommand.remoteUrl(), ["remote", "get-url", "origin"]);
	});

	it("status builds `git status --porcelain -z`", () => {
		assertGitCommand(GitCommand.status(), ["status", "--porcelain", "-z"]);
	});

	describe("working-tree restore tier", () => {
		it("reset emits the mode flag explicitly, even for git's own default", () => {
			assertGitCommand(GitCommand.reset(), ["reset", "--mixed"]);
			assertGitCommand(GitCommand.reset("hard", "HEAD~1"), ["reset", "--hard", "HEAD~1"]);
			assertGitCommand(GitCommand.reset("soft", "abc123"), ["reset", "--soft", "abc123"]);
		});

		it("clean always passes --force, composing -d, -x and a -- pathspec", () => {
			assertGitCommand(GitCommand.clean(), ["clean", "--force"]);
			assertGitCommand(GitCommand.clean(true), ["clean", "--force", "-d"]);
			assertGitCommand(GitCommand.clean(true, true, ["dist"]), ["clean", "--force", "-d", "-x", "--", "dist"]);
		});

		it("restore puts paths behind a literal --, composing --source/--staged/--worktree", () => {
			assertGitCommand(GitCommand.restore(["."]), ["restore", "--", "."]);
			assertGitCommand(GitCommand.restore(["a.txt", "b.txt"], "HEAD", true, true), [
				"restore",
				"--source",
				"HEAD",
				"--staged",
				"--worktree",
				"--",
				"a.txt",
				"b.txt",
			]);
		});
	});

	describe("branch tier", () => {
		it("branchCreate builds `git branch <name> [<start>]` by default", () => {
			assertGitCommand(GitCommand.branchCreate("feat/x"), ["branch", "feat/x"]);
			assertGitCommand(GitCommand.branchCreate("feat/x", "origin/main"), ["branch", "feat/x", "origin/main"]);
		});

		it("branchCreate with checkout builds `git checkout -b <name> [<start>]`", () => {
			assertGitCommand(GitCommand.branchCreate("feat/x", undefined, true), ["checkout", "-b", "feat/x"]);
			assertGitCommand(GitCommand.branchCreate("feat/x", "origin/main", true), [
				"checkout",
				"-b",
				"feat/x",
				"origin/main",
			]);
		});

		it("branchCreate with force builds `git branch -f`, and with checkout `git checkout -B`", () => {
			// The four checkout x force combinations, exhaustively: force alone
			// adds -f to the branch form; force + checkout swaps -b for -B (the
			// one-invocation replacement for the delete-then-create longhand).
			assertGitCommand(GitCommand.branchCreate("feat/x", "origin/main", false, false), [
				"branch",
				"feat/x",
				"origin/main",
			]);
			assertGitCommand(GitCommand.branchCreate("feat/x", "origin/main", false, true), [
				"branch",
				"-f",
				"feat/x",
				"origin/main",
			]);
			assertGitCommand(GitCommand.branchCreate("feat/x", "origin/main", true, false), [
				"checkout",
				"-b",
				"feat/x",
				"origin/main",
			]);
			assertGitCommand(GitCommand.branchCreate("feat/x", "origin/main", true, true), [
				"checkout",
				"-B",
				"feat/x",
				"origin/main",
			]);
		});

		it("branchDelete builds -d by default and -D when forced", () => {
			assertGitCommand(GitCommand.branchDelete("feat/x"), ["branch", "-d", "feat/x"]);
			assertGitCommand(GitCommand.branchDelete("feat/x", true), ["branch", "-D", "feat/x"]);
		});
	});

	describe("shallow tier", () => {
		it("isShallow builds `git rev-parse --is-shallow-repository`", () => {
			assertGitCommand(GitCommand.isShallow(), ["rev-parse", "--is-shallow-repository"]);
		});

		it("fetchUnshallow builds `git fetch --unshallow <remote>`", () => {
			assertGitCommand(GitCommand.fetchUnshallow(), ["fetch", "--unshallow", "origin"]);
			assertGitCommand(GitCommand.fetchUnshallow("upstream"), ["fetch", "--unshallow", "upstream"]);
		});
	});

	describe("submodule tier", () => {
		it("submoduleStatus composes --recursive and a -- pathspec", () => {
			assertGitCommand(GitCommand.submoduleStatus(), ["submodule", "status"]);
			assertGitCommand(GitCommand.submoduleStatus([".repos/effect"], true), [
				"submodule",
				"status",
				"--recursive",
				"--",
				".repos/effect",
			]);
		});

		it("submoduleInit scopes to a -- pathspec when given", () => {
			assertGitCommand(GitCommand.submoduleInit(), ["submodule", "init"]);
			assertGitCommand(GitCommand.submoduleInit([".repos/effect"]), ["submodule", "init", "--", ".repos/effect"]);
		});

		it("submoduleDeinit passes --force and either --all or a -- pathspec", () => {
			assertGitCommand(GitCommand.submoduleDeinit([".repos/effect"]), ["submodule", "deinit", "--", ".repos/effect"]);
			assertGitCommand(GitCommand.submoduleDeinit([], true, true), ["submodule", "deinit", "--force", "--all"]);
		});

		it("submoduleSync composes --recursive and a -- pathspec", () => {
			assertGitCommand(GitCommand.submoduleSync(), ["submodule", "sync"]);
			assertGitCommand(GitCommand.submoduleSync([".repos/effect"], true), [
				"submodule",
				"sync",
				"--recursive",
				"--",
				".repos/effect",
			]);
		});

		it("submoduleSetUrl puts path and url behind a literal --, masking url userinfo", () => {
			assertGitCommand(GitCommand.submoduleSetUrl(".repos/r", "https://example.com/r.git"), [
				"submodule",
				"set-url",
				"--",
				".repos/r",
				"https://example.com/r.git",
			]);
			assertGitCommand(
				GitCommand.submoduleSetUrl(".repos/r", "https://user:pass@example.com/r.git"),
				["submodule", "set-url", "--", ".repos/r", "https://user:pass@example.com/r.git"],
				["submodule", "set-url", "--", ".repos/r", "https://<redacted>@example.com/r.git"],
			);
		});

		it("submoduleSetBranch passes --branch, or --default when the branch is omitted", () => {
			assertGitCommand(GitCommand.submoduleSetBranch(".repos/r", "main"), [
				"submodule",
				"set-branch",
				"--branch",
				"main",
				"--",
				".repos/r",
			]);
			assertGitCommand(GitCommand.submoduleSetBranch(".repos/r"), [
				"submodule",
				"set-branch",
				"--default",
				"--",
				".repos/r",
			]);
		});

		it("submoduleAbsorbgitdirs scopes to a -- pathspec when given", () => {
			assertGitCommand(GitCommand.submoduleAbsorbgitdirs(), ["submodule", "absorbgitdirs"]);
			assertGitCommand(GitCommand.submoduleAbsorbgitdirs([".repos/r"]), [
				"submodule",
				"absorbgitdirs",
				"--",
				".repos/r",
			]);
		});

		it("submoduleForeach passes one shell command string, optionally --recursive", () => {
			assertGitCommand(GitCommand.submoduleForeach("git rev-parse HEAD"), [
				"submodule",
				"foreach",
				"git rev-parse HEAD",
			]);
			assertGitCommand(GitCommand.submoduleForeach("pwd", true), ["submodule", "foreach", "--recursive", "pwd"]);
		});
	});

	describe("remote tier", () => {
		it("lsRemote composes --heads/--tags before the remote and patterns after it", () => {
			assertGitCommand(GitCommand.lsRemote("origin"), ["ls-remote", "origin"]);
			assertGitCommand(GitCommand.lsRemote("origin", true, true, ["v*", "effect@*"]), [
				"ls-remote",
				"--heads",
				"--tags",
				"origin",
				"v*",
				"effect@*",
			]);
		});

		it("remoteAdd / remoteRemove / remoteSetUrl build the remote subcommands", () => {
			assertGitCommand(GitCommand.remoteAdd("up", "https://example.com/r.git"), [
				"remote",
				"add",
				"up",
				"https://example.com/r.git",
			]);
			assertGitCommand(GitCommand.remoteRemove("up"), ["remote", "remove", "up"]);
			assertGitCommand(GitCommand.remoteSetUrl("up", "https://example.com/r.git"), [
				"remote",
				"set-url",
				"up",
				"https://example.com/r.git",
			]);
		});
	});

	describe("stash tier", () => {
		it("stashPush composes --include-untracked, -m and a -- pathspec", () => {
			assertGitCommand(GitCommand.stashPush(), ["stash", "push"]);
			assertGitCommand(GitCommand.stashPush("wip", true, ["a.txt"]), [
				"stash",
				"push",
				"--include-untracked",
				"-m",
				"wip",
				"--",
				"a.txt",
			]);
		});

		it("stashPop / stashApply / stashDrop render an integer index as stash@{n}, or omit it", () => {
			assertGitCommand(GitCommand.stashPop(), ["stash", "pop"]);
			assertGitCommand(GitCommand.stashPop(1), ["stash", "pop", "stash@{1}"]);
			assertGitCommand(GitCommand.stashApply(0), ["stash", "apply", "stash@{0}"]);
			assertGitCommand(GitCommand.stashDrop(2), ["stash", "drop", "stash@{2}"]);
		});

		it("stashList pins the -z unit-separated format", () => {
			assertGitCommand(GitCommand.stashList(), ["stash", "list", "-z", "--format=%gd%x1f%H%x1f%gs"]);
		});
	});

	describe("refs tier", () => {
		it("branchList pins the NUL-separated format; --all wins over --remotes", () => {
			const format = "--format=%(HEAD)%00%(refname:short)%00%(objectname)";
			assertGitCommand(GitCommand.branchList(), ["branch", "--list", format]);
			assertGitCommand(GitCommand.branchList(true), ["branch", "--list", "--remotes", format]);
			assertGitCommand(GitCommand.branchList(true, true), ["branch", "--list", "--all", format]);
		});

		it("tagCreate composes --force and -m before the name, the start ref after it", () => {
			assertGitCommand(GitCommand.tagCreate("v1"), ["tag", "v1"]);
			assertGitCommand(GitCommand.tagCreate("v1", "abc123", "release v1", true), [
				"tag",
				"--force",
				"-m",
				"release v1",
				"v1",
				"abc123",
			]);
		});

		it("tagDelete / tagList build the tag subcommands", () => {
			assertGitCommand(GitCommand.tagDelete("v1"), ["tag", "--delete", "v1"]);
			assertGitCommand(GitCommand.tagList(), ["tag", "--list"]);
			assertGitCommand(GitCommand.tagList("v*"), ["tag", "--list", "v*"]);
		});

		it("forEachRef pins the refname/objectname/objecttype format, patterns after it", () => {
			assertGitCommand(GitCommand.forEachRef(), [
				"for-each-ref",
				"--format=%(refname)%00%(objectname)%00%(objecttype)",
			]);
			assertGitCommand(GitCommand.forEachRef(["refs/tags"]), [
				"for-each-ref",
				"--format=%(refname)%00%(objectname)%00%(objecttype)",
				"refs/tags",
			]);
		});

		it("revList composes --max-count and --first-parent before the ref", () => {
			assertGitCommand(GitCommand.revList("HEAD"), ["rev-list", "HEAD"]);
			assertGitCommand(GitCommand.revList("main..feat", 5, true), [
				"rev-list",
				"--max-count=5",
				"--first-parent",
				"main..feat",
			]);
		});
	});

	describe("history tier", () => {
		it("commit rides the message behind -m, flags and --author= before it", () => {
			assertGitCommand(GitCommand.commit("one line"), ["commit", "-m", "one line"]);
			assertGitCommand(GitCommand.commit("msg", true, true, true, "A <a@b.c>"), [
				"commit",
				"--all",
				"--allow-empty",
				"--amend",
				"--author=A <a@b.c>",
				"-m",
				"msg",
			]);
		});

		it("push composes force/lease/tags/upstream flags before remote and refspec", () => {
			assertGitCommand(GitCommand.push("origin"), ["push", "origin"]);
			assertGitCommand(GitCommand.push("origin", "main:main", false, true, true, true), [
				"push",
				"--force-with-lease",
				"--tags",
				"--set-upstream",
				"origin",
				"main:main",
			]);
			assertGitCommand(GitCommand.push("origin", "main", true), ["push", "--force", "origin", "main"]);
		});

		it("pull composes --rebase and --ff-only before remote and ref", () => {
			assertGitCommand(GitCommand.pull("origin"), ["pull", "origin"]);
			assertGitCommand(GitCommand.pull("origin", "main", true, true), [
				"pull",
				"--rebase",
				"--ff-only",
				"origin",
				"main",
			]);
		});
	});

	describe("config tier", () => {
		it("configList / configGetAll pin -z and scope to -f when a file is given", () => {
			assertGitCommand(GitCommand.configList(), ["config", "--list", "-z"]);
			assertGitCommand(GitCommand.configList(".gitmodules"), ["config", "-f", ".gitmodules", "--list", "-z"]);
		});

		it("emits a scope flag only when one is asked for, so the default stays the merged read", () => {
			// No scope must NOT become --local: the merged read is the documented
			// default and silently narrowing it would change every existing
			// caller's answer.
			assertGitCommand(GitCommand.configList(undefined, "local"), ["config", "--local", "--list", "-z"]);
			assertGitCommand(GitCommand.configList(undefined, "global"), ["config", "--global", "--list", "-z"]);
			assertGitCommand(GitCommand.configList(undefined, "system"), ["config", "--system", "--list", "-z"]);
			assertGitCommand(GitCommand.configList(undefined, "worktree"), ["config", "--worktree", "--list", "-z"]);
			assertGitCommand(GitCommand.configGet("user.name", "local"), ["config", "--local", "--get", "user.name"]);
			assertGitCommand(GitCommand.configGet("user.name"), ["config", "--get", "user.name"]);
			assertGitCommand(GitCommand.configGetAll("remote.origin.fetch"), [
				"config",
				"--get-all",
				"-z",
				"remote.origin.fetch",
			]);
			assertGitCommand(GitCommand.configGetAll("submodule.a.url", ".gitmodules"), [
				"config",
				"-f",
				".gitmodules",
				"--get-all",
				"-z",
				"submodule.a.url",
			]);
		});

		it("configUnset picks --unset or --unset-all", () => {
			assertGitCommand(GitCommand.configUnset("a.b"), ["config", "--unset", "a.b"]);
			assertGitCommand(GitCommand.configUnset("a.b", ".gitmodules", true), [
				"config",
				"-f",
				".gitmodules",
				"--unset-all",
				"a.b",
			]);
		});

		it("configRemoveSection places --remove-section ahead of the section, after an optional -f", () => {
			assertGitCommand(GitCommand.configRemoveSection("submodule.vendored"), [
				"config",
				"--remove-section",
				"submodule.vendored",
			]);
			assertGitCommand(GitCommand.configRemoveSection("submodule.vendored", ".gitmodules"), [
				"config",
				"-f",
				".gitmodules",
				"--remove-section",
				"submodule.vendored",
			]);
		});

		it("configRenameSection places --rename-section ahead of old-then-new, after an optional -f", () => {
			assertGitCommand(GitCommand.configRenameSection("submodule.old", "submodule.new"), [
				"config",
				"--rename-section",
				"submodule.old",
				"submodule.new",
			]);
			assertGitCommand(GitCommand.configRenameSection("submodule.old", "submodule.new", ".gitmodules"), [
				"config",
				"-f",
				".gitmodules",
				"--rename-section",
				"submodule.old",
				"submodule.new",
			]);
		});
	});

	describe("misc tier", () => {
		it("rm composes --cached/-r/--force ahead of a literal -- pathspec", () => {
			assertGitCommand(GitCommand.rm(["a.txt"]), ["rm", "--", "a.txt"]);
			assertGitCommand(GitCommand.rm([".repos/r"], true, true, true), [
				"rm",
				"--cached",
				"-r",
				"--force",
				"--",
				".repos/r",
			]);
		});

		it("mv places source and destination behind a literal --", () => {
			assertGitCommand(GitCommand.mv("a.txt", "b.txt"), ["mv", "--", "a.txt", "b.txt"]);
			assertGitCommand(GitCommand.mv("a.txt", "b.txt", true), ["mv", "--force", "--", "a.txt", "b.txt"]);
		});

		it.effect("checkIgnore uses the --stdin -z form: no caller path ever enters the argv", () =>
			Effect.gen(function* () {
				const invocation = GitCommand.checkIgnore(["ig.txt", "path with space.txt"]);
				assertGitCommand(invocation, ["check-ignore", "-z", "--stdin"]);
				// The paths ride stdin as NUL-TERMINATED records (every path,
				// including the last, is followed by a NUL) — baked into the pure
				// command value, never entering the argv.
				const stdin = invocation.command.options.stdin;
				assert.isDefined(stdin);
				assert.isFalse(typeof stdin === "string");
				if (stdin === undefined || typeof stdin === "string") return;
				const chunks = yield* Stream.runCollect(stdin as Stream.Stream<Uint8Array>);
				const decoded = new TextDecoder().decode(
					chunks.reduce((acc, chunk) => {
						const merged = new Uint8Array(acc.length + chunk.length);
						merged.set(acc);
						merged.set(chunk, acc.length);
						return merged;
					}, new Uint8Array(0)),
				);
				assert.strictEqual(decoded, "ig.txt\0path with space.txt\0");
			}),
		);

		it("worktreeAdd / worktreeList / worktreeRemove build the worktree subcommands", () => {
			assertGitCommand(GitCommand.worktreeAdd("../wt"), ["worktree", "add", "../wt"]);
			assertGitCommand(GitCommand.worktreeAdd("../wt", "HEAD", true, true), [
				"worktree",
				"add",
				"--force",
				"--detach",
				"../wt",
				"HEAD",
			]);
			assertGitCommand(GitCommand.worktreeList(), ["worktree", "list", "--porcelain", "-z"]);
			assertGitCommand(GitCommand.worktreeRemove("../wt"), ["worktree", "remove", "../wt"]);
			assertGitCommand(GitCommand.worktreeRemove("../wt", true), ["worktree", "remove", "--force", "../wt"]);
		});

		it("lsFiles pins --stage -z and scopes to a -- pathspec when given", () => {
			assertGitCommand(GitCommand.lsFiles(), ["ls-files", "--stage", "-z"]);
			assertGitCommand(GitCommand.lsFiles([".repos/effect"]), ["ls-files", "--stage", "-z", "--", ".repos/effect"]);
		});
	});

	describe("redaction masks (#86)", () => {
		it("lsRemote masks an embedded userinfo credential in a URL remote", () => {
			assertGitCommand(
				GitCommand.lsRemote("https://user:tok@example.com/r.git", false, true),
				["ls-remote", "--tags", "https://user:tok@example.com/r.git"],
				["ls-remote", "--tags", "https://<redacted>@example.com/r.git"],
			);
		});

		it("remoteAdd and remoteSetUrl mask an embedded userinfo credential in the url", () => {
			assertGitCommand(
				GitCommand.remoteAdd("up", "https://user:tok@example.com/r.git"),
				["remote", "add", "up", "https://user:tok@example.com/r.git"],
				["remote", "add", "up", "https://<redacted>@example.com/r.git"],
			);
			assertGitCommand(
				GitCommand.remoteSetUrl("up", "https://user:tok@example.com/r.git"),
				["remote", "set-url", "up", "https://user:tok@example.com/r.git"],
				["remote", "set-url", "up", "https://<redacted>@example.com/r.git"],
			);
		});

		it("push and pull mask an embedded userinfo credential in a URL remote", () => {
			assertGitCommand(
				GitCommand.push("https://x-access-token:ghp_secret@github.com/a/r.git", "main"),
				["push", "https://x-access-token:ghp_secret@github.com/a/r.git", "main"],
				["push", "https://<redacted>@github.com/a/r.git", "main"],
			);
			assertGitCommand(
				GitCommand.pull("https://x-access-token:ghp_secret@github.com/a/r.git", "main"),
				["pull", "https://x-access-token:ghp_secret@github.com/a/r.git", "main"],
				["pull", "https://<redacted>@github.com/a/r.git", "main"],
			);
		});
		it("fetch masks an embedded userinfo credential in the remote, and only then", () => {
			// A plain remote name (the common case) is untouched — full debuggability.
			assertGitCommand(GitCommand.fetch("origin", "main"), ["fetch", "origin", "main"]);
			// A URL remote with embedded credentials keeps everything BUT the userinfo.
			assertGitCommand(
				GitCommand.fetch("https://x-access-token:ghp_secret@github.com/a/r.git", "main"),
				["fetch", "https://x-access-token:ghp_secret@github.com/a/r.git", "main"],
				["fetch", "https://<redacted>@github.com/a/r.git", "main"],
			);
		});

		it("submoduleAdd masks an embedded userinfo credential in the url", () => {
			assertGitCommand(
				GitCommand.submoduleAdd("https://user:pass@example.com/r.git", ".repos/r"),
				["submodule", "add", "--", "https://user:pass@example.com/r.git", ".repos/r"],
				["submodule", "add", "--", "https://<redacted>@example.com/r.git", ".repos/r"],
			);
		});

		it("fetchUnshallow masks an embedded userinfo credential in a URL remote", () => {
			assertGitCommand(
				GitCommand.fetchUnshallow("https://x-access-token:ghp_secret@github.com/a/r.git"),
				["fetch", "--unshallow", "https://x-access-token:ghp_secret@github.com/a/r.git"],
				["fetch", "--unshallow", "https://<redacted>@github.com/a/r.git"],
			);
		});

		it("a password containing a literal @ is masked whole — no credential tail survives", () => {
			// URL authorities split at the LAST @ before the first path slash; a
			// first-@ mask would leave `ss@github.com...` (the password tail) in
			// redactedArgs, which classify persists into GitCommandError.
			assertGitCommand(
				GitCommand.push("https://user:p@ss@github.com/a/r.git", "main"),
				["push", "https://user:p@ss@github.com/a/r.git", "main"],
				["push", "https://<redacted>@github.com/a/r.git", "main"],
			);
		});

		it("a path-embedded @ without userinfo is untouched", () => {
			assertGitCommand(GitCommand.fetch("https://host:8080/a@b", "main"), ["fetch", "https://host:8080/a@b", "main"]);
		});

		it("a credential-free url passes through redactedArgs untouched", () => {
			assertGitCommand(GitCommand.submoduleAdd("https://example.com/r.git", ".repos/r"), [
				"submodule",
				"add",
				"--",
				"https://example.com/r.git",
				".repos/r",
			]);
		});
	});
});
