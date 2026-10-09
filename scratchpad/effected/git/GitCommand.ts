import { Stream } from "effect";
import { ChildProcess } from "effect/process";

/**
 * A pure `git` invocation: the spawnable command plus the diagnostic argv the
 * error taxonomy is allowed to persist.
 *
 * @remarks
 * `command.args` holds the raw argv git actually receives; `redactedArgs` is
 * the same argv with every sensitive positional masked — a config value
 * replaced by `<redacted>` entirely, and a URL's embedded userinfo (an
 * `https://user:token@host/...` credential) replaced by `<redacted>@`. The
 * redaction mask lives here, on the pure constructor, because the
 * constructor is the one place that knows which positionals are sensitive;
 * the `Git` service's `classify` step persists ONLY `redactedArgs` into
 * `GitCommandError.args` and `GitCommandError.message`, so raw argv never
 * survives into an error value. For a constructor with no sensitive
 * positionals the two argvs are element-wise identical.
 *
 * @public
 */
export interface GitInvocation {
	/** The spawnable, cwd-less command carrying the raw argv. */
	readonly command: ChildProcess.StandardCommand;
	/** The argv with sensitive positionals masked — the only argv diagnostics may persist. */
	readonly redactedArgs: ReadonlyArray<string>;
}

/** The mask every whole-value sensitive positional is replaced with. */
const REDACTED = "<redacted>";

/**
 * One argv segment: a plain string, or a sensitive positional tagged with the
 * mask to apply in `redactedArgs` — `"value"` replaces the whole segment,
 * `"url"` masks only an embedded `scheme://userinfo@` credential.
 */
type GitArg = string | { readonly redact: "value" | "url"; readonly value: string };

// Tags a whole-value sensitive positional (a config value that may be a secret).
const secretValue = (value: string): GitArg => ({ redact: "value", value });

// Tags a URL positional whose embedded userinfo (if any) must be masked.
const secretUrl = (value: string): GitArg => ({ redact: "url", value });

/**
 * Masks the userinfo component of a URL (`scheme://user:token@host/...` →
 * `scheme://<redacted>@host/...`). A value carrying no embedded userinfo — a
 * remote name, a credential-free URL, an scp-style `host:path` — passes
 * through untouched, so the common case stays fully debuggable.
 *
 * The userinfo match is greedy (`[^/]*@` — everything through the LAST `@`
 * before the first path slash): URL authorities split at the last `@`, so a
 * password containing a literal `@` (`user:p\@ss\@host/...`) must be
 * consumed whole or its tail would survive into `redactedArgs`.
 */
const redactUrlUserinfo = (value: string): string =>
	value.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, `$1${REDACTED}@`);

/**
 * Builds a `git` {@link GitInvocation} with the argv this package classifies
 * against.
 *
 * @remarks
 * The returned command carries neither `cwd` NOR any environment pin — every
 * `GitCommand` constructor produces a pure, context-free value. The caller
 * (the `Git` service) applies both per invocation, via `ChildProcess.setCwd`
 * and `ChildProcess.setEnv`, each of which returns a new command and leaves
 * this one unchanged. The environment pins that make git's stderr
 * classifiable and keep it from blocking on a prompt live in `Git.ts`
 * alongside the classifier and the timeout they exist to serve; one of them
 * is conditional on the caller's own environment, which a pure constructor
 * must not read.
 *
 * `extendEnv: true` is the one spawn option set here, and it is deliberately
 * NOT one of those pins: it declares that a git invocation inherits the
 * parent environment at all (git needs `PATH`, `HOME`, `SSH_AUTH_SOCK` and
 * the rest to function), rather than forcing any particular value. It must
 * be set at construction because core exposes no run-time combinator for it
 * — only `setCwd` and `setEnv` — and its default is owned by whichever
 * platform backend implements `ChildProcessSpawner`, not by core, so a
 * command that needs the merge must request it explicitly rather than rely
 * on an implementation-specific default.
 *
 * A consumer running one of these values directly gets a plain inherited
 * environment and no pins. That is the honest shape: such a caller is
 * running a custom command, and `Git`'s classification guarantees do not
 * travel with the argv.
 */
const git = (args: ReadonlyArray<GitArg>, stdin?: string): GitInvocation => {
	const raw = args.map((arg) => (typeof arg === "string" ? arg : arg.value));
	const redactedArgs = args.map((arg) =>
		typeof arg === "string" ? arg : arg.redact === "value" ? REDACTED : redactUrlUserinfo(arg.value),
	);
	return {
		command: ChildProcess.make("git", raw, {
			extendEnv: true,
			// stdin is baked into the pure command value (check-ignore's --stdin
			// form): a single UTF-8 chunk, closed when done. Constructors without
			// stdin leave the option unset entirely.
			...(stdin !== undefined ? { stdin: Stream.make(new TextEncoder().encode(stdin)) } : {}),
		}),
		redactedArgs,
	};
};

// Implementation of GitCommand.show; the public contract lives on the static.
const show = (ref: string, path: string): GitInvocation => git(["show", `${ref}:${path}`]);

// Implementation of GitCommand.lsTree; the public contract lives on the static.
const lsTree = (ref: string, pathspec: ReadonlyArray<string> = []): GitInvocation =>
	git(["ls-tree", "-r", "-z", ref, ...(pathspec.length > 0 ? ["--", ...pathspec] : [])]);

// Implementation of GitCommand.refExists; the public contract lives on the static.
const refExists = (ref: string): GitInvocation => git(["cat-file", "-e", ref]);

// Implementation of GitCommand.mergeBase; the public contract lives on the static.
// One builder backs BOTH Git.mergeBase (loud on no ancestor) and
// Git.mergeBaseOption (silent exit 1 → Option.none) — the argv is identical;
// only the service's classify kind differs.
const mergeBase = (a: string, b: string): GitInvocation => git(["merge-base", a, b]);

// Implementation of GitCommand.changedFiles; the public contract lives on the static.
const changedFiles = (base: string, head: string, relative = false): GitInvocation =>
	git(["diff", "--name-only", "-z", relative ? "--relative" : "--no-relative", `${base}...${head}`]);

// Implementation of GitCommand.unstagedChanges; the public contract lives on the static.
const unstagedChanges = (relative = false): GitInvocation =>
	git(["diff", "--name-only", "-z", relative ? "--relative" : "--no-relative"]);

// Implementation of GitCommand.stagedChanges; the public contract lives on the static.
const stagedChanges = (relative = false): GitInvocation =>
	git(["diff", "--name-only", "-z", relative ? "--relative" : "--no-relative", "--cached"]);

// Implementation of GitCommand.untrackedFiles; the public contract lives on the static.
const untrackedFiles = (relative = false): GitInvocation =>
	git(["ls-files", "--others", "--exclude-standard", "-z", ...(relative ? [] : ["--full-name"])]);

// Implementation of GitCommand.revParse; the public contract lives on the static.
const revParse = (ref: string): GitInvocation => git(["rev-parse", "--verify", ref]);

// Implementation of GitCommand.checkout; the public contract lives on the static.
const checkout = (ref: string, detach = false): GitInvocation =>
	git(["checkout", ...(detach ? ["--detach"] : []), ref]);

// Implementation of GitCommand.fetch; the public contract lives on the static.
const fetch = (remote: string, ref: string, depth?: number, tag = false, unshallow = false): GitInvocation =>
	git([
		"fetch",
		...(depth !== undefined ? ["--depth", String(depth)] : []),
		...(unshallow ? ["--unshallow"] : []),
		secretUrl(remote),
		...(tag ? ["tag"] : []),
		ref,
	]);

// Implementation of GitCommand.submoduleUpdate; the public contract lives on the static.
const submoduleUpdate = (
	init = false,
	depth?: number,
	paths: ReadonlyArray<string> = [],
	options: {
		readonly checkout?: boolean;
		readonly remote?: boolean;
		readonly fetch?: false;
		readonly recursive?: boolean;
		readonly force?: boolean;
	} = {},
): GitInvocation =>
	git([
		"submodule",
		"update",
		...(init ? ["--init"] : []),
		...(options.checkout ? ["--checkout"] : []),
		...(options.remote ? ["--remote"] : []),
		...(options.fetch === false ? ["--no-fetch"] : []),
		...(options.recursive ? ["--recursive"] : []),
		...(options.force ? ["--force"] : []),
		...(depth !== undefined ? ["--depth", String(depth)] : []),
		...(paths.length > 0 ? ["--", ...paths] : []),
	]);

// Implementation of GitCommand.submoduleAdd; the public contract lives on the static.
const submoduleAdd = (url: string, path: string, depth?: number): GitInvocation =>
	git(["submodule", "add", ...(depth !== undefined ? ["--depth", String(depth)] : []), "--", secretUrl(url), path]);

// Implementation of GitCommand.sparseCheckoutSet; the public contract lives on the static.
const sparseCheckoutSet = (patterns: ReadonlyArray<string>, cone: boolean): GitInvocation =>
	git(["sparse-checkout", "set", cone ? "--cone" : "--no-cone", ...patterns]);

// Implementation of GitCommand.configSet; the public contract lives on the static.
const configSet = (key: string, value: string, file?: string): GitInvocation =>
	git(["config", ...(file !== undefined ? ["-f", file] : []), key, secretValue(value)]);

// Implementation of GitCommand.add; the public contract lives on the static.
const add = (paths: ReadonlyArray<string>): GitInvocation => git(["add", "--", ...paths]);

// Implementation of GitCommand.reset; the public contract lives on the static.
const reset = (mode: "soft" | "mixed" | "hard" = "mixed", ref?: string): GitInvocation =>
	git(["reset", `--${mode}`, ...(ref !== undefined ? [ref] : [])]);

// Implementation of GitCommand.clean; the public contract lives on the static.
const clean = (directories = false, ignored = false, paths: ReadonlyArray<string> = []): GitInvocation =>
	git([
		"clean",
		"--force",
		...(directories ? ["-d"] : []),
		...(ignored ? ["-x"] : []),
		...(paths.length > 0 ? ["--", ...paths] : []),
	]);

// Implementation of GitCommand.restore; the public contract lives on the static.
const restore = (paths: ReadonlyArray<string>, source?: string, staged = false, worktree = false): GitInvocation =>
	git([
		"restore",
		...(source !== undefined ? ["--source", source] : []),
		...(staged ? ["--staged"] : []),
		...(worktree ? ["--worktree"] : []),
		"--",
		...paths,
	]);

// Implementation of GitCommand.branchCreate; the public contract lives on the static.
const branchCreate = (name: string, startPoint?: string, checkout = false, force = false): GitInvocation =>
	checkout
		? git(["checkout", force ? "-B" : "-b", name, ...(startPoint !== undefined ? [startPoint] : [])])
		: git(["branch", ...(force ? ["-f"] : []), name, ...(startPoint !== undefined ? [startPoint] : [])]);

// Implementation of GitCommand.branchDelete; the public contract lives on the static.
const branchDelete = (name: string, force = false): GitInvocation => git(["branch", force ? "-D" : "-d", name]);

// Implementation of GitCommand.isShallow; the public contract lives on the static.
const isShallow = (): GitInvocation => git(["rev-parse", "--is-shallow-repository"]);

// Implementation of GitCommand.fetchUnshallow; the public contract lives on the static.
const fetchUnshallow = (remote = "origin"): GitInvocation => git(["fetch", "--unshallow", secretUrl(remote)]);

// Implementation of GitCommand.nameStatus; the public contract lives on the static.
const nameStatus = (base: string, head: string | undefined, relative = false): GitInvocation =>
	git([
		"diff",
		"--name-status",
		"-z",
		relative ? "--relative" : "--no-relative",
		head === undefined ? base : `${base}...${head}`,
	]);

// Implementation of GitCommand.defaultBranch; the public contract lives on the static.
const defaultBranch = (remote = "origin"): GitInvocation =>
	git(["symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`]);

// Implementation of GitCommand.currentBranch; the public contract lives on the static.
const currentBranch = (): GitInvocation => git(["rev-parse", "--abbrev-ref", "HEAD"]);

// Implementation of GitCommand.repoRoot; the public contract lives on the static.
const repoRoot = (): GitInvocation => git(["rev-parse", "--show-toplevel"]);

// Implementation of GitCommand.commonDir; the public contract lives on the static.
const commonDir = (): GitInvocation => git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);

// Implementation of GitCommand.commitInfo; the public contract lives on the static.
const commitInfo = (ref = "HEAD"): GitInvocation => git(["log", "-1", "--format=%H%x00%G?%x00%B", ref]);

/**
 * The `git log` record format: a `\x1e` record opener followed by the five
 * NUL-joined header fields the log listing decodes.
 *
 * `--name-only` output carries no other unambiguous record boundary — a
 * commit's path lines and the next commit's header are both just bytes — so
 * the separator is emitted by the format itself rather than inferred.
 */
const LOG_FORMAT = "--format=%x1e%H%x00%aI%x00%cI%x00%an%x00%ae";

// Implementation of GitCommand.log; the public contract lives on the static.
const log = (
	paths: ReadonlyArray<string> = [],
	follow = false,
	limit?: number,
	firstParentDiffMerges = false,
): GitInvocation =>
	git([
		"log",
		"-z",
		LOG_FORMAT,
		"--name-only",
		...(follow ? ["--follow"] : []),
		...(firstParentDiffMerges ? ["--diff-merges=first-parent"] : []),
		...(limit !== undefined ? [`--max-count=${limit}`] : []),
		...(paths.length > 0 ? ["--", ...paths] : []),
	]);

/**
 * Which configuration file a read is scoped to.
 *
 * @remarks
 * Omitted, git reads the MERGED configuration — repository-local plus global
 * plus system — which is what a consumer wants for "what is the effective
 * value" and precisely wrong for "what does THIS checkout declare". A globally
 * set key otherwise shadows a decision that is really about one repository, and
 * an enumerate-then-remove flow reads at a different scope than
 * `configRemoveSection` writes at.
 *
 * @public
 */
export type GitConfigScope = "local" | "global" | "system" | "worktree";

/** The scope flag, or nothing for the merged read. */
const scopeArgs = (scope: GitConfigScope | undefined): ReadonlyArray<string> =>
	scope === undefined ? [] : [`--${scope}`];

// Implementation of GitCommand.configGet; the public contract lives on the static.
const configGet = (key: string, scope?: GitConfigScope): GitInvocation =>
	git(["config", ...scopeArgs(scope), "--get", key]);

// Implementation of GitCommand.remoteUrl; the public contract lives on the static.
const remoteUrl = (remote = "origin"): GitInvocation => git(["remote", "get-url", remote]);

// Implementation of GitCommand.status; the public contract lives on the static.
const status = (): GitInvocation => git(["status", "--porcelain", "-z"]);

// Implementation of GitCommand.submoduleStatus; the public contract lives on the static.
const submoduleStatus = (paths: ReadonlyArray<string> = [], recursive = false): GitInvocation =>
	git(["submodule", "status", ...(recursive ? ["--recursive"] : []), ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleInit; the public contract lives on the static.
const submoduleInit = (paths: ReadonlyArray<string> = []): GitInvocation =>
	git(["submodule", "init", ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleDeinit; the public contract lives on the static.
const submoduleDeinit = (paths: ReadonlyArray<string>, all = false, force = false): GitInvocation =>
	git(["submodule", "deinit", ...(force ? ["--force"] : []), ...(all ? ["--all"] : ["--", ...paths])]);

// Implementation of GitCommand.submoduleSync; the public contract lives on the static.
const submoduleSync = (paths: ReadonlyArray<string> = [], recursive = false): GitInvocation =>
	git(["submodule", "sync", ...(recursive ? ["--recursive"] : []), ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleSetUrl; the public contract lives on the static.
const submoduleSetUrl = (path: string, url: string): GitInvocation =>
	git(["submodule", "set-url", "--", path, secretUrl(url)]);

// Implementation of GitCommand.submoduleSetBranch; the public contract lives on the static.
const submoduleSetBranch = (path: string, branch?: string): GitInvocation =>
	git(["submodule", "set-branch", ...(branch === undefined ? ["--default"] : ["--branch", branch]), "--", path]);

// Implementation of GitCommand.submoduleAbsorbgitdirs; the public contract lives on the static.
const submoduleAbsorbgitdirs = (paths: ReadonlyArray<string> = []): GitInvocation =>
	git(["submodule", "absorbgitdirs", ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleForeach; the public contract lives on the static.
const submoduleForeach = (command: string, recursive = false): GitInvocation =>
	git(["submodule", "foreach", ...(recursive ? ["--recursive"] : []), command]);

// Implementation of GitCommand.lsRemote; the public contract lives on the static.
const lsRemote = (remote: string, heads = false, tags = false, patterns: ReadonlyArray<string> = []): GitInvocation =>
	git(["ls-remote", ...(heads ? ["--heads"] : []), ...(tags ? ["--tags"] : []), secretUrl(remote), ...patterns]);

// Implementation of GitCommand.remoteAdd; the public contract lives on the static.
const remoteAdd = (name: string, url: string): GitInvocation => git(["remote", "add", name, secretUrl(url)]);

// Implementation of GitCommand.remoteRemove; the public contract lives on the static.
const remoteRemove = (name: string): GitInvocation => git(["remote", "remove", name]);

// Implementation of GitCommand.remoteSetUrl; the public contract lives on the static.
const remoteSetUrl = (name: string, url: string): GitInvocation => git(["remote", "set-url", name, secretUrl(url)]);

// Renders a stash index into git's reflog-style stash ref. The interpolation is
// injection-safe by construction: the service refuses a non-integer index
// before any spawn, and an integer cannot begin with `-`... a negative integer
// can, which is exactly why the service guard requires a NON-NEGATIVE integer.
const stashRef = (index: number): string => `stash@{${index}}`;

// Implementation of GitCommand.stashPush; the public contract lives on the static.
const stashPush = (message?: string, includeUntracked = false, paths: ReadonlyArray<string> = []): GitInvocation =>
	git([
		"stash",
		"push",
		...(includeUntracked ? ["--include-untracked"] : []),
		...(message !== undefined ? ["-m", message] : []),
		...(paths.length > 0 ? ["--", ...paths] : []),
	]);

// Implementation of GitCommand.stashPop; the public contract lives on the static.
const stashPop = (index?: number): GitInvocation =>
	git(["stash", "pop", ...(index !== undefined ? [stashRef(index)] : [])]);

// Implementation of GitCommand.stashApply; the public contract lives on the static.
const stashApply = (index?: number): GitInvocation =>
	git(["stash", "apply", ...(index !== undefined ? [stashRef(index)] : [])]);

// Implementation of GitCommand.stashDrop; the public contract lives on the static.
const stashDrop = (index?: number): GitInvocation =>
	git(["stash", "drop", ...(index !== undefined ? [stashRef(index)] : [])]);

// Implementation of GitCommand.stashList; the public contract lives on the static.
const stashList = (): GitInvocation => git(["stash", "list", "-z", "--format=%gd%x1f%H%x1f%gs"]);

// Implementation of GitCommand.branchList; the public contract lives on the static.
const branchList = (remotes = false, all = false): GitInvocation =>
	git([
		"branch",
		"--list",
		...(all ? ["--all"] : remotes ? ["--remotes"] : []),
		"--format=%(HEAD)%00%(refname:short)%00%(objectname)",
	]);

// Implementation of GitCommand.tagCreate; the public contract lives on the static.
const tagCreate = (name: string, ref?: string, message?: string, force = false): GitInvocation =>
	git([
		"tag",
		...(force ? ["--force"] : []),
		...(message !== undefined ? ["-m", message] : []),
		name,
		...(ref !== undefined ? [ref] : []),
	]);

// Implementation of GitCommand.tagDelete; the public contract lives on the static.
const tagDelete = (name: string): GitInvocation => git(["tag", "--delete", name]);

// Implementation of GitCommand.tagList; the public contract lives on the static.
const tagList = (pattern?: string): GitInvocation =>
	git(["tag", "--list", ...(pattern !== undefined ? [pattern] : [])]);

// Implementation of GitCommand.forEachRef; the public contract lives on the static.
const forEachRef = (patterns: ReadonlyArray<string> = []): GitInvocation =>
	git(["for-each-ref", "--format=%(refname)%00%(objectname)%00%(objecttype)", ...patterns]);

// Implementation of GitCommand.revList; the public contract lives on the static.
const revList = (ref: string, limit?: number, firstParent = false): GitInvocation =>
	git([
		"rev-list",
		...(limit !== undefined ? [`--max-count=${limit}`] : []),
		...(firstParent ? ["--first-parent"] : []),
		ref,
	]);

// Implementation of GitCommand.commit; the public contract lives on the static.
const commit = (message: string, all = false, allowEmpty = false, amend = false, author?: string): GitInvocation =>
	git([
		"commit",
		...(all ? ["--all"] : []),
		...(allowEmpty ? ["--allow-empty"] : []),
		...(amend ? ["--amend"] : []),
		...(author !== undefined ? [`--author=${author}`] : []),
		"-m",
		message,
	]);

// Implementation of GitCommand.push; the public contract lives on the static.
const push = (
	remote: string,
	refspec?: string,
	force = false,
	forceWithLease = false,
	tags = false,
	setUpstream = false,
): GitInvocation =>
	git([
		"push",
		...(force ? ["--force"] : []),
		...(forceWithLease ? ["--force-with-lease"] : []),
		...(tags ? ["--tags"] : []),
		...(setUpstream ? ["--set-upstream"] : []),
		secretUrl(remote),
		...(refspec !== undefined ? [refspec] : []),
	]);

// Implementation of GitCommand.pull; the public contract lives on the static.
const pull = (remote: string, ref?: string, rebase = false, ffOnly = false): GitInvocation =>
	git([
		"pull",
		...(rebase ? ["--rebase"] : []),
		...(ffOnly ? ["--ff-only"] : []),
		secretUrl(remote),
		...(ref !== undefined ? [ref] : []),
	]);

// Implementation of GitCommand.configList; the public contract lives on the static.
const configList = (file?: string, scope?: GitConfigScope): GitInvocation =>
	git(["config", ...(file !== undefined ? ["-f", file] : []), ...scopeArgs(scope), "--list", "-z"]);

// Implementation of GitCommand.configGetAll; the public contract lives on the static.
const configGetAll = (key: string, file?: string): GitInvocation =>
	git(["config", ...(file !== undefined ? ["-f", file] : []), "--get-all", "-z", key]);

// Implementation of GitCommand.configUnset; the public contract lives on the static.
const configUnset = (key: string, file?: string, all = false): GitInvocation =>
	git(["config", ...(file !== undefined ? ["-f", file] : []), all ? "--unset-all" : "--unset", key]);

// Implementation of GitCommand.configRemoveSection; the public contract lives on the static.
const configRemoveSection = (section: string, file?: string): GitInvocation =>
	git(["config", ...(file !== undefined ? ["-f", file] : []), "--remove-section", section]);

// Implementation of GitCommand.configRenameSection; the public contract lives on the static.
const configRenameSection = (oldName: string, newName: string, file?: string): GitInvocation =>
	git(["config", ...(file !== undefined ? ["-f", file] : []), "--rename-section", oldName, newName]);

// Implementation of GitCommand.rm; the public contract lives on the static.
const rm = (paths: ReadonlyArray<string>, cached = false, recursive = false, force = false): GitInvocation =>
	git([
		"rm",
		...(cached ? ["--cached"] : []),
		...(recursive ? ["-r"] : []),
		...(force ? ["--force"] : []),
		"--",
		...paths,
	]);

// Implementation of GitCommand.mv; the public contract lives on the static.
const mv = (source: string, destination: string, force = false): GitInvocation =>
	git(["mv", ...(force ? ["--force"] : []), "--", source, destination]);

// Implementation of GitCommand.checkIgnore; the public contract lives on the static.
const checkIgnore = (paths: ReadonlyArray<string>): GitInvocation =>
	git(["check-ignore", "-z", "--stdin"], paths.map((path) => `${path}\0`).join(""));

// Implementation of GitCommand.worktreeAdd; the public contract lives on the static.
const worktreeAdd = (path: string, ref?: string, detach = false, force = false): GitInvocation =>
	git([
		"worktree",
		"add",
		...(force ? ["--force"] : []),
		...(detach ? ["--detach"] : []),
		path,
		...(ref !== undefined ? [ref] : []),
	]);

// Implementation of GitCommand.worktreeList; the public contract lives on the static.
const worktreeList = (): GitInvocation => git(["worktree", "list", "--porcelain", "-z"]);

// Implementation of GitCommand.worktreeRemove; the public contract lives on the static.
const worktreeRemove = (path: string, force = false): GitInvocation =>
	git(["worktree", "remove", ...(force ? ["--force"] : []), path]);

// Implementation of GitCommand.lsFiles; the public contract lives on the static.
const lsFiles = (pathspec: ReadonlyArray<string> = []): GitInvocation =>
	git(["ls-files", "--stage", "-z", ...(pathspec.length > 0 ? ["--", ...pathspec] : [])]);

/**
 * Pure constructors for the `git` {@link GitInvocation} values this package
 * spawns.
 *
 * @remarks
 * Every constructor returns a cwd-less, argv-only {@link GitInvocation} — no
 * spawning, no working directory baked in. `Git` applies the working
 * directory per call with `ChildProcess.setCwd` on `invocation.command` and
 * owns the actual spawn, timeout, and error classification.
 *
 * **Redaction policy.** A constructor whose argv carries a sensitive
 * positional — a config value (`configSet`), or a URL that may embed
 * userinfo (the remote of `fetch`, `fetchUnshallow`, `lsRemote`, `push` and
 * `pull`, and the url of `submoduleAdd`, `submoduleSetUrl`, `remoteAdd` and
 * `remoteSetUrl`) —
 * masks it in {@link GitInvocation.redactedArgs}: a config value becomes
 * `<redacted>` wholesale, a URL keeps everything but its `userinfo@`
 * component. The `Git` service persists only the redacted argv in error
 * values, and its span annotations carry stable identifiers only (`cwd`,
 * keys, paths, remote/ref names) — never config values, never URLs.
 *
 * @public
 */
export class GitCommand {
	private constructor() {}

	/**
	 * `git show <ref>:<path>` — the contents of `path` as it existed at `ref`,
	 * without checking anything out.
	 */
	static readonly show = show;

	/**
	 * `git ls-tree -r -z <ref> [-- <pathspec>...]` — every path in the tree at
	 * `ref`, recursively, NUL-terminated, optionally scoped to `pathspec`.
	 *
	 * @remarks
	 * `-z` is load-bearing: git paths may themselves contain newlines, so the
	 * caller must split on `"\0"`, never on `"\n"`. When `pathspec` is provided,
	 * a literal `--` separator is inserted before the pathspec entries to prevent
	 * git from interpreting pathspec values as options.
	 */
	static readonly lsTree = lsTree;

	/**
	 * `git cat-file -e <ref>` — checks whether `ref` resolves to an existing
	 * object, without printing it. A non-zero exit means the ref does not exist.
	 */
	static readonly refExists = refExists;

	/**
	 * `git merge-base <a> <b>` — the best common ancestor commit of `a` and `b`.
	 *
	 * @remarks
	 * Two refs with NO common ancestor (disjoint histories) exit 1 with
	 * silent stderr. One builder backs both service members: `Git.mergeBase`
	 * surfaces that shape as a loud `GitCommandError` (absence is
	 * exceptional), while `Git.mergeBaseOption` degrades it to `Option.none`
	 * (a probe answer). The argv is identical either way.
	 */
	static readonly mergeBase = mergeBase;

	/**
	 * `git diff --name-only -z [--relative] <base>...<head>` — the paths that
	 * differ between the merge base of `base` and `head`, and `head` itself,
	 * NUL-terminated.
	 *
	 * @remarks
	 * `-z` is load-bearing here too, for the same reason as {@link GitCommand.lsTree}: split
	 * the output on `"\0"`, never on `"\n"`.
	 *
	 * The relative flag is **explicit in both branches** — `--relative` when
	 * `relative` is true, `--no-relative` when false — never omitted. git honors a
	 * configured `diff.relative=true` when no flag is passed, so an omitted flag
	 * would silently yield cwd-relative paths on such a machine even for
	 * `relative: false`, misaligning with {@link GitCommand.untrackedFiles}'s
	 * repo-root base and breaking `Git.workingChanges`' dedup in a nested workspace.
	 * `--relative` scopes the report to `cwd` (a workspace nested inside a larger
	 * repository); `--no-relative` overrides any `diff.relative` config and reports
	 * paths from the repository top-level.
	 */
	static readonly changedFiles = changedFiles;

	/**
	 * `git diff --name-only -z (--relative | --no-relative)` — the paths with
	 * unstaged working-tree changes (the working tree against the index),
	 * NUL-terminated.
	 *
	 * @remarks
	 * `relative` behaves as it does for {@link GitCommand.changedFiles}, including the
	 * explicit-flag-in-both-branches rule: `--no-relative` is passed for
	 * `relative: false` so a configured `diff.relative=true` cannot silently make the
	 * output cwd-relative.
	 */
	static readonly unstagedChanges = unstagedChanges;

	/**
	 * `git diff --name-only -z (--relative | --no-relative) --cached` — the paths
	 * staged for the next commit (the index against `HEAD`), NUL-terminated.
	 *
	 * @remarks
	 * `relative` behaves as it does for {@link GitCommand.changedFiles}, including the
	 * explicit `--no-relative` on the `relative: false` branch.
	 */
	static readonly stagedChanges = stagedChanges;

	/**
	 * `git ls-files --others --exclude-standard -z [--full-name]` — the untracked
	 * paths git is not ignoring, NUL-terminated.
	 *
	 * @remarks
	 * `ls-files` reports paths relative to `cwd` by default, matching the
	 * `--relative` diffs. When `relative` is `false`, `--full-name` makes it emit
	 * repo-root-relative paths instead, so the untracked half shares a base with the
	 * un-`--relative` diffs — otherwise `Git.workingChanges`'s union would dedup two
	 * spellings of one file from a nested `cwd`.
	 */
	static readonly untrackedFiles = untrackedFiles;

	/**
	 * `git rev-parse --verify <ref>` — resolves `ref` to its full object id, or
	 * fails if `ref` does not resolve.
	 */
	static readonly revParse = revParse;

	/**
	 * Mutating: `git checkout [--detach] <ref>` — moves the working tree (and, for
	 * a branch ref, `HEAD`) to `ref`. When `detach` is true, checks out the ref in
	 * detached-HEAD state.
	 */
	static readonly checkout = checkout;

	/**
	 * Mutating: `git fetch [--depth <n>] [--unshallow] <remote> [tag] <ref>` —
	 * fetches the given ref from a remote, optionally with a depth limit, the
	 * `--unshallow` mode, and the `tag` keyword.
	 *
	 * @remarks
	 * `ref` may also be a full refspec (`src:dst`, optionally `+`-prefixed) —
	 * it is passed through VERBATIM, never transformed. That matters under a
	 * single-branch clone (`actions/checkout`'s default): a bare-ref fetch
	 * there updates `FETCH_HEAD` only and never creates the remote-tracking
	 * ref, so `+refs/heads/<b>:refs/remotes/origin/<b>` is the only spelling
	 * that materializes `origin/<b>`.
	 *
	 * `unshallow` is a distinct MODE like {@link GitCommand.fetchUnshallow}'s:
	 * git rejects it in a non-shallow repository and rejects it alongside
	 * `--depth`. `remote` may be a URL as well as a remote name; an embedded
	 * `userinfo@` credential is masked in {@link GitInvocation.redactedArgs}.
	 */
	static readonly fetch = fetch;

	/**
	 * Mutating: `git fetch --unshallow <remote>` — converts a shallow clone
	 * into a complete one by fetching the missing history.
	 *
	 * @remarks
	 * `--unshallow` is a distinct MODE, not a depth value: git rejects it
	 * outright in a repository that is not shallow, with
	 * `--unshallow on a complete repository does not make sense`, so it
	 * cannot be expressed as `fetch`'s `depth` option. The caller decides
	 * whether to run it — probe with `Git.isShallow` first.
	 *
	 * `remote` may be a URL as well as a remote name; an embedded `userinfo@`
	 * credential is masked in {@link GitInvocation.redactedArgs}.
	 */
	static readonly fetchUnshallow = fetchUnshallow;

	/**
	 * `git rev-parse --is-shallow-repository` — prints `true` when the
	 * repository is a shallow clone, `false` otherwise.
	 *
	 * @remarks
	 * A dedicated probe constructor, deliberately separate from
	 * {@link GitCommand.revParse}: `revParse` takes a REF and resolves it,
	 * while this takes nothing and answers a repository-shape question.
	 * Folding the flag into `revParse` would make that constructor
	 * sometimes-takes-a-ref, sometimes-takes-a-flag.
	 */
	static readonly isShallow = isShallow;

	/**
	 * Mutating: `git reset --soft|--mixed|--hard [<ref>]` — moves `HEAD` (and,
	 * per mode, the index and working tree) to `ref`.
	 *
	 * @remarks
	 * The mode flag is always explicit — `--mixed` is emitted for the default
	 * rather than omitted — so the argv states what runs. `ref` may be any
	 * commit-ish, including a gitlink sha.
	 */
	static readonly reset = reset;

	/**
	 * Mutating: `git clean --force [-d] [-x] [-- <paths>...]` — deletes
	 * untracked files from the working tree.
	 *
	 * @remarks
	 * `--force` is unconditional: this constructor exists so a consumer can
	 * restore a tree to a known state (e.g. before retrying a non-idempotent
	 * operation), and without `--force` git refuses to clean at all under the
	 * default `clean.requireForce` config — a clean that silently did nothing
	 * would hand the retry the same dirty tree. `-d` removes untracked
	 * directories too; `-x` removes ignored files as well. The literal `--`
	 * separator makes the optional pathspec injection-safe by construction.
	 */
	static readonly clean = clean;

	/**
	 * Mutating: `git restore [--source <ref>] [--staged] [--worktree] -- <paths...>`
	 * — restores the given paths from the index (or from `source`), the
	 * `checkout -- <paths>`-shaped operation.
	 *
	 * @remarks
	 * This is a separate constructor precisely because {@link GitCommand.checkout}'s
	 * service guard refuses `--` and option-like refs by design — `restore` is
	 * git's own verb for pathspec restoration, and its paths always sit behind
	 * a literal `--`, so they are injection-safe by construction. With neither
	 * `staged` nor `worktree` set, git defaults to restoring the working tree.
	 */
	static readonly restore = restore;

	/**
	 * Mutating: `git branch [-f] <name> [<start-point>]`, or
	 * `git checkout (-b | -B) <name> [<start-point>]` when `checkout` is true —
	 * creates a branch, optionally from an explicit start point, optionally
	 * switching to it, optionally force-resetting an existing branch.
	 *
	 * @remarks
	 * Branch creation is a branch-member concern, NOT a widening of
	 * {@link GitCommand.checkout}: `checkout`'s contract stays "move to an
	 * existing ref" and its option-like-ref refusal stays intact. The `-b` /
	 * `-B` here is this constructor's own literal, never caller data.
	 *
	 * `force` with `checkout` exists because the delete-then-create longhand
	 * (`branch -D` swallowed, then `checkout -b`) papers over a real edge:
	 * `git branch -D` refuses to delete the currently checked-out branch,
	 * while `checkout -B` resets it fine — one invocation handles both
	 * states.
	 */
	static readonly branchCreate = branchCreate;

	/**
	 * Mutating: `git branch -d <name>` (or `-D` when `force` is true) —
	 * deletes a local branch.
	 *
	 * @remarks
	 * The default `-d` refuses to delete a branch not fully merged — a typed
	 * failure, which is usually the honest answer. `force: true` emits `-D`
	 * and deletes regardless.
	 */
	static readonly branchDelete = branchDelete;

	/**
	 * Mutating:
	 * `git submodule update [--init] [--checkout] [--remote] [--no-fetch] [--recursive] [--force] [--depth <n>] [-- <paths>...]`
	 * — updates registered submodules, optionally initializing them, with an
	 * optional depth limit, and scoped to specific paths. The literal `--`
	 * separator makes the pathspec injection-safe by construction.
	 *
	 * @remarks
	 * `options.checkout` is the documented override for a
	 * `submodule.<name>.update = none` configuration — without it, an update of
	 * such a submodule silently skips it (git reports success and checks out
	 * nothing). `options.fetch` accepts only the literal `false` (emitting
	 * `--no-fetch`): git's default already fetches and offers no positive
	 * `--fetch` spelling, so `true` would be an unrepresentable no-op.
	 * `options.remote` tracks the remote branch's tip instead of the
	 * superproject's recorded sha; `options.recursive` descends into nested
	 * submodules; `options.force` discards local changes in the submodule
	 * working tree (and re-checks-out even when the recorded sha is current).
	 */
	static readonly submoduleUpdate = submoduleUpdate;

	/**
	 * Mutating: `git submodule add [--depth <n>] -- <url> <path>` — registers and
	 * initializes a new submodule. The literal `--` separator makes the url and path
	 * injection-safe by construction.
	 *
	 * @remarks
	 * An embedded `userinfo@` credential in `url` is masked in
	 * {@link GitInvocation.redactedArgs}.
	 */
	static readonly submoduleAdd = submoduleAdd;

	/**
	 * Mutating: `git sparse-checkout set (--cone | --no-cone) <patterns...>` — configures
	 * which paths are checked out in a sparse repository. The cone flag is explicit in both
	 * branches — `--cone` when `cone` is true, `--no-cone` when false — to prevent git's
	 * default from silently changing the behavior.
	 */
	static readonly sparseCheckoutSet = sparseCheckoutSet;

	/**
	 * Mutating: `git config [-f <file>] <key> <value>` — writes a configuration value,
	 * optionally into an explicit configuration file (e.g., `.gitmodules`).
	 *
	 * @remarks
	 * `value` may be a secret (a token, a credential-bearing URL), so it is
	 * masked wholesale — as `<redacted>` — in
	 * {@link GitInvocation.redactedArgs}. The key and file stay visible: they
	 * are stable identifiers, and they are what a caller debugging a failed
	 * write actually needs.
	 */
	static readonly configSet = configSet;

	/**
	 * Mutating: `git add -- <paths...>` — stages the given paths for commit. The literal
	 * `--` separator makes the pathspec injection-safe by construction.
	 */
	static readonly add = add;

	/**
	 * `git diff --name-status -z (--relative | --no-relative) [<base> | <base>...<head>]`
	 * — the changed paths WITH their one-letter status codes, NUL-terminated.
	 *
	 * @remarks
	 * With `head` omitted this is the single-argument diff form: the working tree
	 * (staged + unstaged) against `base` — NOT a two-ref range. With `head`
	 * present it is the familiar `base...head` merge-base form, matching
	 * {@link GitCommand.changedFiles}. `-z` and the explicit relative flag follow
	 * the same rules as {@link GitCommand.changedFiles}. In `-z` mode a rename or
	 * copy entry is THREE NUL tokens: `R<score>`, the old path, the new path.
	 */
	static readonly nameStatus = nameStatus;

	/**
	 * `git symbolic-ref --quiet --short refs/remotes/<remote>/HEAD` — the name of
	 * the default branch on the given remote, or empty string / exit 1 if unset.
	 *
	 * @remarks
	 * `--quiet` suppresses error messages; the exit code alone signals success
	 * (0) or "symbolic-ref does not exist" (1). The contract is "does the remote
	 * have a HEAD?" — an unset symbolic ref exits 1 silently, which `Git.defaultBranch`
	 * degrades to `Option.none()` rather than a typed error. `symbolic-ref` is a
	 * purely local ref lookup; it never touches the network.
	 */
	static readonly defaultBranch = defaultBranch;

	/**
	 * `git rev-parse --abbrev-ref HEAD` — the name of the branch `HEAD` is
	 * pointing to.
	 *
	 * @remarks
	 * Returns `"HEAD"` (detached state), `"<branch>"` (an attached branch), or
	 * fails if the repository has no commits.
	 */
	static readonly currentBranch = currentBranch;

	/**
	 * `git rev-parse --show-toplevel` — the filesystem path to the root of the
	 * enclosing git repository.
	 */
	static readonly repoRoot = repoRoot;

	/**
	 * `git rev-parse --path-format=absolute --git-common-dir` — the absolute,
	 * symlink-resolved path of the directory a repository and all of its linked
	 * worktrees share.
	 *
	 * @remarks
	 * Without `--path-format=absolute` git prints this relative to the working
	 * directory in a plain checkout (`.git`) but absolute from inside a linked
	 * worktree, so two answers cannot be compared as strings. The flag needs
	 * git 2.31 or later.
	 */
	static readonly commonDir = commonDir;

	/**
	 * `git log -1 --format=%H%x00%G?%x00%B <ref>` — a NUL-separated triple: the
	 * full commit hash, the GPG trust level, and the full commit body (message),
	 * all untrimmed.
	 *
	 * @remarks
	 * `%H` is the full object id (40-char sha1, or sha256 if configured).
	 * `%x00` is a literal NUL byte (the separator). `%G?` is the GPG trust level
	 * (`G` = good signature, `B` = bad, `U` = untrusted, `X` = expired, `Y` =
	 * expired key, `R` = revoked key, `E` = error, or `N` = not signed).
	 * `%B` is the full body, **untrimmed** — it includes leading/trailing
	 * whitespace — so the caller must decide whether to trim it. Splits on the
	 * two `\x00` bytes to extract all three values.
	 */
	static readonly commitInfo = commitInfo;

	/**
	 * `git log -z --format=%x1e%H%x00%aI%x00%cI%x00%an%x00%ae --name-only` —
	 * a commit listing carrying each commit's sha, both ISO dates, its author
	 * identity and the paths it touched. Four optional flags follow, in this
	 * order: `--follow`, `--diff-merges=first-parent`, `--max-count=N`, then
	 * the `--` separator and the pathspec.
	 *
	 * @remarks
	 * `-z` is unconditional and does two things at once: it terminates the
	 * `--format` output with a NUL instead of a newline, and it makes
	 * `--name-only` emit paths RAW — no C-style quoting — so a path containing
	 * a space, a quote or a newline comes back verbatim and `core.quotePath`
	 * never enters the picture.
	 *
	 * `%x1e` opens every record because `--name-only` output has no other
	 * unambiguous record boundary. Each record is then
	 * `<sha>\0<authoredAt>\0<committedAt>\0<authorName>\0<authorEmail>\0`
	 * followed, when the commit touched anything, by `\n` and one
	 * NUL-terminated path per changed file.
	 *
	 * `--follow` requires exactly one path — git's own restriction, enforced
	 * pre-spawn by `Git.log`. Without `--diff-merges=first-parent` a merge
	 * commit contributes a record with NO path lines, which is git's default
	 * and not an anomaly.
	 */
	static readonly log = log;

	/**
	 * `git config --get <key>` — the value of the given git config key, or empty
	 * string / exit 1 if unset.
	 */
	static readonly configGet = configGet;

	/**
	 * `git remote get-url <remote>` — the fetch URL of the given remote. A
	 * missing remote exits non-zero with a "No such remote" stderr shape, which
	 * the `Git` service degrades to `Option.none`, never a typed error.
	 */
	static readonly remoteUrl = remoteUrl;

	/**
	 * `git status --porcelain -z` — the porcelain (stable, machine-readable) short
	 * status of every modified file in the working tree, NUL-terminated.
	 *
	 * @remarks
	 * `-z` is load-bearing here too, for the same reason as
	 * {@link GitCommand.lsTree}: split the output on `"\0"`, never on `"\n"`.
	 * Each entry is a pair of status codes followed by a space and the path.
	 */
	static readonly status = status;

	/**
	 * `git submodule status [--recursive] [-- <paths>...]` — one line per
	 * registered submodule: a state prefix, the checked-out (or gitlink) sha,
	 * the path, and — when the submodule is initialized — a `git describe`
	 * suffix in parentheses.
	 *
	 * @remarks
	 * `git submodule status` has no `-z` mode, so its output is line-based —
	 * the one path-emitting constructor in this package that cannot follow
	 * the `-z` rule. A submodule path containing a newline would corrupt the
	 * parse; accepted as a git-imposed limitation.
	 */
	static readonly submoduleStatus = submoduleStatus;

	/**
	 * Mutating: `git submodule init [-- <paths>...]` — registers the
	 * submodules from `.gitmodules` into `.git/config` (all of them, or only
	 * `paths`), without cloning or checking anything out.
	 */
	static readonly submoduleInit = submoduleInit;

	/**
	 * Mutating: `git submodule deinit [--force] (--all | -- <paths>...)` —
	 * unregisters submodules: clears their working trees and removes their
	 * `.git/config` registration. The literal `--` separator makes the
	 * pathspec injection-safe by construction.
	 */
	static readonly submoduleDeinit = submoduleDeinit;

	/**
	 * Mutating: `git submodule sync [--recursive] [-- <paths>...]` —
	 * re-copies each submodule's URL from `.gitmodules` into `.git/config`
	 * (and into the submodule's own `remote.origin.url`), so a `.gitmodules`
	 * URL change actually reaches git's live configuration.
	 */
	static readonly submoduleSync = submoduleSync;

	/**
	 * Mutating: `git submodule set-url -- <path> <url>` — rewrites the
	 * submodule's URL in `.gitmodules` and synchronizes it into
	 * `.git/config`. The literal `--` separator makes the path and url
	 * injection-safe by construction.
	 *
	 * @remarks
	 * An embedded `userinfo@` credential in `url` is masked in
	 * {@link GitInvocation.redactedArgs}.
	 */
	static readonly submoduleSetUrl = submoduleSetUrl;

	/**
	 * Mutating: `git submodule set-branch (--branch <branch> | --default) -- <path>`
	 * — records (or clears, when `branch` is omitted) the branch a submodule
	 * tracks in `.gitmodules`. The literal `--` separator makes the path
	 * injection-safe by construction.
	 */
	static readonly submoduleSetBranch = submoduleSetBranch;

	/**
	 * Mutating: `git submodule absorbgitdirs [-- <paths>...]` — moves each
	 * submodule's embedded `.git` directory into the superproject's
	 * `.git/modules/` and leaves a gitfile pointer behind.
	 */
	static readonly submoduleAbsorbgitdirs = submoduleAbsorbgitdirs;

	/**
	 * Mutating: `git submodule foreach [--recursive] <command>` — runs a shell
	 * command in every checked-out submodule. `command` is a single shell
	 * string, evaluated by git in each submodule's directory; it can mutate
	 * anything, which is why the constructor is marked mutating regardless of
	 * what the command does.
	 *
	 * @remarks
	 * This is the ONE constructor whose argument cannot be made injection-safe
	 * by construction: git evaluates `command` with `sh -c`, so every character
	 * of it is shell code — a `--` separator or quoting cannot help. Callers
	 * must treat `command` as a trusted literal and never interpolate untrusted
	 * data into it.
	 */
	static readonly submoduleForeach = submoduleForeach;

	/**
	 * `git ls-remote [--heads] [--tags] <remote> [<patterns>...]` — the refs a
	 * remote advertises (sha + refname), optionally filtered to branch heads,
	 * tags, and/or shell-glob patterns.
	 *
	 * @remarks
	 * A read that talks to the NETWORK, not to the local repository — the one
	 * non-mutating constructor in this package that does. An embedded
	 * `userinfo@` credential in `remote` is masked in
	 * {@link GitInvocation.redactedArgs}. An annotated tag advertises two
	 * entries: `refs/tags/<name>` (the tag object) and `refs/tags/<name>^{}`
	 * (the peeled commit).
	 */
	static readonly lsRemote = lsRemote;

	/**
	 * Mutating: `git remote add <name> <url>` — registers a new remote.
	 *
	 * @remarks
	 * An embedded `userinfo@` credential in `url` is masked in
	 * {@link GitInvocation.redactedArgs}.
	 */
	static readonly remoteAdd = remoteAdd;

	/**
	 * Mutating: `git remote remove <name>` — deletes a remote and its
	 * remote-tracking refs and configuration.
	 */
	static readonly remoteRemove = remoteRemove;

	/**
	 * Mutating: `git remote set-url <name> <url>` — rewrites a remote's fetch
	 * URL.
	 *
	 * @remarks
	 * An embedded `userinfo@` credential in `url` is masked in
	 * {@link GitInvocation.redactedArgs}.
	 */
	static readonly remoteSetUrl = remoteSetUrl;

	/**
	 * Mutating: `git stash push [--include-untracked] [-m <message>] [-- <paths>...]`
	 * — saves the working tree (and index) state onto the stash stack. The
	 * literal `--` separator makes the optional pathspec injection-safe by
	 * construction; the message rides behind `-m`, which git consumes as a
	 * value even when it begins with `-`.
	 */
	static readonly stashPush = stashPush;

	/**
	 * Mutating: `git stash pop [stash@{n}]` — applies a stash entry and drops
	 * it on success. The stash ref is rendered from an INTEGER index by this
	 * package, never caller text.
	 */
	static readonly stashPop = stashPop;

	/**
	 * Mutating: `git stash apply [stash@{n}]` — applies a stash entry and
	 * keeps it on the stack. The stash ref is rendered from an INTEGER index
	 * by this package, never caller text.
	 */
	static readonly stashApply = stashApply;

	/**
	 * Mutating: `git stash drop [stash@{n}]` — deletes a stash entry without
	 * applying it. The stash ref is rendered from an INTEGER index by this
	 * package, never caller text.
	 */
	static readonly stashDrop = stashDrop;

	/**
	 * `git stash list -z --format=%gd%x1f%H%x1f%gs` — every stash entry as a
	 * NUL-terminated record of unit-separated fields: the reflog selector
	 * (`stash@{0}`), the stash commit sha, and the reflog subject.
	 *
	 * @remarks
	 * The `%x1f` (ASCII unit separator) field separator plus `-z` record
	 * terminator keeps the parse split-safe: a stash message cannot contain
	 * either byte (reflog subjects are single-line).
	 */
	static readonly stashList = stashList;

	/**
	 * `git branch --list [--remotes | --all] --format=%(HEAD)%00%(refname:short)%00%(objectname)`
	 * — every branch as a NUL-separated triple: the current-branch marker, the
	 * short name, and the tip sha.
	 *
	 * @remarks
	 * Records are newline-separated, which is split-safe here: git refnames
	 * cannot contain a newline (or a space), so the only NUL bytes are the
	 * format's own field separators. `all` wins over `remotes` when both are
	 * set.
	 */
	static readonly branchList = branchList;

	/**
	 * Mutating: `git tag [--force] [-m <message>] <name> [<ref>]` — creates a
	 * lightweight tag, or an annotated one when `message` is given (`-m`
	 * implies `-a`).
	 */
	static readonly tagCreate = tagCreate;

	/** Mutating: `git tag --delete <name>` — deletes a local tag. */
	static readonly tagDelete = tagDelete;

	/**
	 * `git tag --list [<pattern>]` — tag names, optionally filtered by a
	 * shell-glob pattern, one per line (refnames cannot contain newlines).
	 */
	static readonly tagList = tagList;

	/**
	 * `git for-each-ref --format=%(refname)%00%(objectname)%00%(objecttype) [<patterns>...]`
	 * — every matching ref as a NUL-separated triple: full refname, sha, and
	 * object type.
	 *
	 * @remarks
	 * The format is this package's own fixed triple — the parse contract and
	 * the argv are decided together, so the format string is a constructor
	 * literal, never caller data. An annotated tag's `objecttype` is `tag`
	 * (the tag object), not `commit`.
	 */
	static readonly forEachRef = forEachRef;

	/**
	 * `git rev-list [--max-count=<n>] [--first-parent] <ref-or-range>` — commit
	 * shas reachable from the ref (or range, e.g. `main..feat`), newest first.
	 */
	static readonly revList = revList;

	/**
	 * Mutating: `git commit [--all] [--allow-empty] [--amend] [--author=<author>] -m <message>`
	 * — records a commit. The message always rides argv behind `-m` (git
	 * consumes it as a value even when it begins with `-`); committer identity
	 * comes from the caller's environment — this constructor sets no
	 * `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables, and the optional `author`
	 * override is the fused `--author=` form.
	 */
	static readonly commit = commit;

	/**
	 * Mutating: `git push [--force | --force-with-lease] [--tags] [--set-upstream] <remote> [<refspec>]`
	 * — updates remote refs.
	 *
	 * @remarks
	 * `remote` may be a URL as well as a remote name; an embedded `userinfo@`
	 * credential is masked in {@link GitInvocation.redactedArgs}.
	 */
	static readonly push = push;

	/**
	 * Mutating: `git pull [--rebase] [--ff-only] <remote> [<ref>]` — fetches
	 * and integrates.
	 *
	 * @remarks
	 * `remote` may be a URL as well as a remote name; an embedded `userinfo@`
	 * credential is masked in {@link GitInvocation.redactedArgs}.
	 */
	static readonly pull = pull;

	/**
	 * `git config [-f <file>] --list -z` — every configuration entry in scope
	 * (or in the given file only), NUL-terminated, the key separated from the
	 * value by a newline within each record.
	 *
	 * @remarks
	 * `-z` is load-bearing: a config VALUE may contain newlines; only the NUL
	 * record terminator plus first-newline field split parses it losslessly.
	 * A valueless key (git's boolean-true shorthand) emits no newline at all.
	 */
	static readonly configList = configList;

	/**
	 * `git config [-f <file>] --get-all -z <key>` — every value of a
	 * (possibly multi-valued) key, NUL-terminated. An unset key exits 1 with
	 * silent stderr.
	 */
	static readonly configGetAll = configGetAll;

	/**
	 * Mutating: `git config [-f <file>] (--unset | --unset-all) <key>` —
	 * removes a key (or, with `all`, every value of a multi-valued key).
	 *
	 * @remarks
	 * git exits 5, silently, when the key was not set — a loud failure by
	 * this package's classification, deliberately: an unset that silently did
	 * nothing is indistinguishable from one that worked.
	 */
	static readonly configUnset = configUnset;

	/**
	 * Mutating: `git config [-f <file>] --remove-section <section>` — removes
	 * a whole configuration section (every key under it, and the section
	 * header itself).
	 *
	 * @remarks
	 * git exits 128 (`fatal: no such section`) when the section does not
	 * exist — a loud failure by this package's classification, matching
	 * {@link GitCommand.configUnset}'s posture: a removal that silently did
	 * nothing is indistinguishable from one that worked.
	 */
	static readonly configRemoveSection = configRemoveSection;

	/**
	 * Mutating: `git config [-f <file>] --rename-section <old> <new>` —
	 * renames a configuration section, carrying every key under it across.
	 *
	 * @remarks
	 * git exits 128 (`fatal: no such section`) when the old section does not
	 * exist — the same loud posture as {@link GitCommand.configRemoveSection}.
	 */
	static readonly configRenameSection = configRenameSection;

	/**
	 * Mutating: `git rm [--cached] [-r] [--force] -- <paths...>` — removes
	 * paths from the index (and, without `cached`, the working tree). The
	 * literal `--` separator makes the pathspec injection-safe by
	 * construction.
	 */
	static readonly rm = rm;

	/**
	 * Mutating: `git mv [--force] -- <source> <destination>` — moves or
	 * renames a tracked path. The literal `--` separator makes both positionals
	 * injection-safe by construction.
	 */
	static readonly mv = mv;

	/**
	 * `git check-ignore -z --stdin` — which of the given paths git would
	 * ignore, paths fed NUL-separated via stdin and answers returned
	 * NUL-separated.
	 *
	 * @remarks
	 * The `--stdin -z` form is the only fully robust one: `-z` without
	 * `--stdin` is rejected by git outright, and the non-`-z` output C-quotes
	 * special-character paths. Feeding paths via stdin also makes them
	 * injection-safe by construction — nothing caller-controlled enters the
	 * argv. When NO path is ignored, git exits 1 with silent stderr.
	 */
	static readonly checkIgnore = checkIgnore;

	/**
	 * Mutating: `git worktree add [--force] [--detach] <path> [<ref>]` —
	 * creates a linked working tree at `path`, checked out at `ref` (or the
	 * branch named after `path`'s basename).
	 */
	static readonly worktreeAdd = worktreeAdd;

	/**
	 * `git worktree list --porcelain -z` — every working tree as a block of
	 * NUL-terminated attributes (`worktree <path>`, `HEAD <sha>`,
	 * `branch <ref>` / `detached`, `bare`, `locked [<reason>]`,
	 * `prunable [<reason>]`), blocks separated by an empty attribute.
	 */
	static readonly worktreeList = worktreeList;

	/** Mutating: `git worktree remove [--force] <path>` — removes a linked working tree. */
	static readonly worktreeRemove = worktreeRemove;

	/**
	 * `git ls-files --stage -z [-- <pathspec>...]` — every INDEX entry (mode,
	 * oid, stage number, path), NUL-terminated, optionally scoped to
	 * `pathspec`.
	 *
	 * @remarks
	 * The index-side sibling of {@link GitCommand.lsTree}: `lsTree` reads a
	 * COMMITTED tree at a ref, while this reads the staging area — the only
	 * place a staged-but-uncommitted gitlink (`160000 <oid> 0 <path>`) is
	 * visible. `-z` is load-bearing twice over: paths may contain newlines,
	 * and the non-`-z` output C-quotes special-character paths.
	 */
	static readonly lsFiles = lsFiles;
}
