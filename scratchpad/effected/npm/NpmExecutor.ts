import { $ScratchpadId } from "@beep/identity/packages";
import { LocalExec } from "../commands/index.ts";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/process";
import { PublishError } from "./PublishError.ts";

const $I = $ScratchpadId.create("effected/npm/NpmExecutor");

/**
 * Which `npm` runs a publish command.
 *
 * @remarks
 * An executor expresses one choice: use the runner's bundled `npm`
 * ({@link NpmExecutor.ambient}) or fetch a pinned one ({@link NpmExecutor.dlx}).
 * The distinction is real — OIDC trusted publishing needs npm ≥ 11.5.1 and
 * GitHub-hosted runners ship 10.x — but fetching is not package-manager
 * knowledge this package owns. `@effected/commands`' `LocalExec` already models
 * "fetch and run a package binary" as `applyDlx`, so a pinned executor
 * delegates to it, and {@link NpmExecutor.command} then requires `LocalExec`.
 *
 * @public
 */
export class NpmExecutor extends S.Class<NpmExecutor>($I`NpmExecutor`)({
	/**
	 * The npm package spec to fetch and run (`"npm@11"`). Absent means the
	 * ambient `npm` on `PATH`.
	 */
	spec: S.optionalKey(S.String).annotateKey({ description: "The npm package spec to fetch and run (`\"npm@11\"`). Absent means the ambient `npm` on `PATH`." }),
	/**
	 * The npm cache directory, emitted as `--cache <dir>` on every invocation.
	 * Absent uses npm's own default (`~/.npm`).
	 */
	cacheDir: S.optionalKey(S.String).annotateKey({ description: "The npm cache directory, emitted as `--cache <dir>` on every invocation. Absent uses npm's own default (`~/.npm`)." }),
	/**
	 * Extra flags appended to every generated invocation, after `--cache`.
	 */
	extraArgs: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Extra flags appended to every generated invocation, after `--cache`." }),
}, $I.annote("NpmExecutor", { description: "Which `npm` runs a publish command." })) {
	/** The runner's own `npm`. */
	static readonly ambient: NpmExecutor = NpmExecutor.make({});

	/** A pinned npm, fetched through the project's launcher (`pnpm dlx npm@11`). */
	static readonly dlx = (spec: string): NpmExecutor => NpmExecutor.make({ spec });

	/**
	 * A copy of this executor that redirects npm's cache.
	 *
	 * @remarks
	 * Names a recurring runner-hygiene problem so it shows up in the `.d.ts`
	 * instead of living as tribal knowledge: **GitHub's macOS runner images ship
	 * a partially root-owned `~/.npm/_cacache`**, and current npm hard-fails with
	 * `EACCES` before doing any work when it sees root-owned files in its cache.
	 * Every `npm view` / `pack` / `publish` on such a runner dies until the cache
	 * is redirected somewhere the job owns, typically `RUNNER_TEMP`.
	 *
	 * Setting `npm_config_cache` in the environment also works and npm honours it
	 * in every dispatch form — but it is invisible at the call site, which is how
	 * the fix gets lost in a port and rediscovered the hard way.
	 *
	 * **This OVERRIDES a deliberately configured cache, and that is worth a
	 * decision rather than a default.** A `--cache` flag in argv outranks both
	 * `npm_config_cache` and any npmrc setting, so calling this unconditionally
	 * also overrides a self-hosted runner pointed at a warmed cache on purpose.
	 * The combinator stays deliberately dumb — it reads no environment, because a
	 * value transformation that consulted ambient state could not be reasoned
	 * about from the call site. **A caller that wants "redirect only if nothing
	 * else is configured" makes that check itself**, e.g. applying this only when
	 * `npm_config_cache` is unset. The safe-looking unconditional call is the one
	 * that silently wins, so choose on purpose.
	 *
	 * @example
	 * ```ts
	 * import { NpmExecutor } from "./index.ts";
	 *
	 * const runnerTemp = process.env.RUNNER_TEMP ?? "/tmp";
	 * const executor = NpmExecutor.dlx("npm@11").withCacheDir(`${runnerTemp}/npm-cache`);
	 * ```
	 *
	 * @param cacheDir - The directory to use as npm's cache.
	 */
	withCacheDir(cacheDir: string): NpmExecutor {
		return NpmExecutor.make({
			...(this.spec !== undefined ? { spec: this.spec } : {}),
			cacheDir,
			...(this.extraArgs !== undefined ? { extraArgs: this.extraArgs } : {}),
		});
	}

	/**
	 * A copy of this executor that appends `args` to every invocation.
	 *
	 * @remarks
	 * The generic vent, for the flag this package has not named — `--loglevel`,
	 * `--ignore-scripts`, a registry-specific option. It exists so a consumer
	 * needing one flag does not have to wait for new API, and so the next
	 * recurring need is a splice rather than a fork.
	 *
	 * Prefer {@link NpmExecutor.withCacheDir} for the cache: it is typed,
	 * discoverable, and carries the reason.
	 *
	 * Replaces any previously set extra args rather than accumulating, so a copy
	 * is a complete statement of its own flags.
	 *
	 * @param args - Flags to append, after `--cache` when one is set.
	 */
	withExtraArgs(args: ReadonlyArray<string>): NpmExecutor {
		return NpmExecutor.make({
			...(this.spec !== undefined ? { spec: this.spec } : {}),
			...(this.cacheDir !== undefined ? { cacheDir: this.cacheDir } : {}),
			extraArgs: args,
		});
	}

	/** `args` plus this executor's cache redirect and extra flags. */
	#allArgs(args: ReadonlyArray<string>): ReadonlyArray<string> {
		return [...args, ...(this.cacheDir === undefined ? [] : ["--cache", this.cacheDir]), ...(this.extraArgs ?? [])];
	}

	/**
	 * The core `Command` that runs `npm` with `args`.
	 *
	 * @remarks
	 * A `dlx` executor with no project-local launcher **fails typed** rather
	 * than degrading to the ambient `npm`: silently running the runner's bundled
	 * npm when the caller explicitly asked for a pinned one would reintroduce
	 * exactly the OIDC failure the pinned spec exists to avoid, and would do it
	 * invisibly.
	 */
	command(args: ReadonlyArray<string>): Effect.Effect<ChildProcess.StandardCommand, PublishError, LocalExec> {
		const spec = this.spec;
		const all = this.#allArgs(args);
		if (spec === undefined) return Effect.succeed(ChildProcess.make("npm", all));
		return Effect.gen(function* () {
			const local = yield* LocalExec;
			const context = yield* local.context.pipe(
				Effect.mapError((cause) => PublishError.make({ kind: "executor", cause })),
			);
			if (O.isNone(context)) {
				return yield* PublishError.make({ kind: "executor" });
			}
			const dlx = context.value.applyDlx(ChildProcess.make(spec, all));
			if (!ChildProcess.isStandardCommand(dlx)) {
				return yield* PublishError.make({ kind: "executor" });
			}
			return dlx;
		});
	}
}
