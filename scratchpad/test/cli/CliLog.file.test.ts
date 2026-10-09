import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "../../effected/env/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Scope from "effect/Scope";
import { TestClock } from "effect/testing";
import { CliLog } from "../../effected/cli/index.ts";

const Json = S.fromJsonString(S.Unknown);

const LEVEL_ENV = "TOOL_LOG_LEVEL";
const FILE_ENV = "TOOL_LOG_FILE";
const PATH = "/logs/diagnostics.ndjson";

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const deny = PlatformError.systemError({
	_tag: "PermissionDenied",
	module: "FileSystem",
	method: "writeFileString",
	pathOrDescriptor: PATH,
	description: "disk said no",
});

/** Run `body` with the file sink built over a memfs volume, in a scope the test closes itself. */
const harness = Effect.fn("harness")(function* (options: {
	readonly file: { readonly envVar: string } | { readonly path: string };
	readonly env?: Record<string, string>;
	readonly failFirstAppend?: boolean;
	/** Provide `CurrentRuntimeEnv` with this CI; omitted, the service is not in the environment at all. */
	readonly ci?: "github-actions" | "generic";
	readonly faults?: Parameters<typeof MemoryFileSystem.makeSync>[1] extends infer O
		? NonNullable<O> extends { faults?: infer F }
			? F
			: never
		: never;
}) {
		const faults =
			options.faults ??
			(options.failFirstAppend === true ? { writeFileString: MemoryFileSystem.failTimes(1, deny) } : undefined);
		const handle = MemoryFileSystem.makeSync({}, faults === undefined ? undefined : { faults });
		const { double, out, err } = capturing();
		const layer = CliLog.layer({ envVar: LEVEL_ENV, file: options.file }).pipe(
			Layer.provide(
				Layer.mergeAll(
					Audience.layerTest("agent"),
					TerminalEnv.layerTest(),
					options.ci === undefined ? Layer.empty : CurrentRuntimeEnv.layerTest({ ci: Option.some(options.ci) }),
				),
			),
			Layer.provide(handle.layer),
		);
		const scope = yield* Scope.make();
		const context = yield* Layer.buildWithScope(layer, scope).pipe(
			Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(options.env ?? {})),
			Effect.provideService(Console.Console, double),
		);
		return {
			handle,
			out,
			err,
			/** Run `program` with the built loggers. */
			log: (program: Effect.Effect<void>) =>
				program.pipe(Effect.provideContext(context), Effect.provideService(Console.Console, double)),
			close: Scope.close(scope, Exit.void),
			file: () => handle.volume.text(PATH),
		};
	});

const ndjson = (lines: ReadonlyArray<string>) => lines.filter((line) => line.startsWith("{"));
/** The sink's one error line. CliLogger's plain lines share stderr, so it is picked out by its prefix. */
const plain = (lines: ReadonlyArray<string>) => lines.filter((line) => line.startsWith("diagnostics log file"));
const settle = Effect.forEach(Array.from({ length: 50 }), () => Effect.yieldNow);

const program = Effect.gen(function* () {
	yield* Effect.logDebug("dbg");
	yield* Effect.logError("boom");
});

describe("CliLog.layer file option", () => {
	it("requires FileSystem and Path only when a file is given", () => {
		const without: Layer.Layer<never, never, Audience | TerminalEnv> = CliLog.layer({ envVar: LEVEL_ENV });
		assert.isDefined(without);
		const narrowed = CliLog.layer({ file: { path: PATH } });
		const assignable: typeof narrowed extends Layer.Layer<never, never, Audience | TerminalEnv> ? true : false = false;
		assert.isFalse(assignable);
		assert.isDefined(narrowed);
	});

	it.effect("writes the same NDJSON lines as the stderr sink, one per record, and flushes when the scope closes", () =>
		Effect.gen(function* () {
			const h = yield* harness({ file: { path: PATH }, env: { [LEVEL_ENV]: "debug" } });
			yield* h.log(program);
			yield* h.close;
			const lines = (h.file() ?? "").split("\n").filter((l) => l !== "");
			assert.strictEqual(lines.length, 2);
			// Identical to the stderr line for the same log call, byte for byte.
			assert.deepStrictEqual(lines, ndjson(h.err));
			assert.deepStrictEqual(
				lines.map((l) => JSON.parse(l).level),
				["DEBUG", "ERROR"],
			);
			assert.isTrue((h.file() ?? "").endsWith("\n"));
		}),
	);

	it.effect("filters by the same level: nothing is written while the diagnostics level is None", () =>
		Effect.gen(function* () {
			const h = yield* harness({ file: { path: PATH } });
			yield* h.log(program);
			yield* h.close;
			assert.isUndefined(h.file());
			// CliLogger still prints the error plainly; nothing is written as NDJSON.
			assert.deepStrictEqual(ndjson(h.err), []);
		}),
	);

	it.effect("takes the path from an env var, and does nothing when it is unset", () =>
		Effect.gen(function* () {
			const set = yield* harness({
				file: { envVar: FILE_ENV },
				env: { [LEVEL_ENV]: "error", [FILE_ENV]: PATH },
			});
			yield* set.log(program);
			yield* set.close;
			assert.strictEqual((set.file() ?? "").split("\n").filter((l) => l !== "").length, 1);

			const unset = yield* harness({ file: { envVar: FILE_ENV }, env: { [LEVEL_ENV]: "error" } });
			yield* unset.log(program);
			yield* unset.close;
			assert.isFalse(unset.handle.volume.has(PATH));
			assert.deepStrictEqual(plain(unset.err), []);
		}),
	);

	it.effect("creates the parent directory", () =>
		Effect.gen(function* () {
			const h = yield* harness({ file: { path: "/deep/er/log.ndjson" }, env: { [LEVEL_ENV]: "error" } });
			yield* h.log(program);
			yield* h.close;
			assert.isTrue(h.handle.volume.has("/deep/er/log.ndjson"));
		}),
	);

	describe("the failure line is safe to print", () => {
		const ESC = String.fromCharCode(0x1b);
		// A path a workflow controls through the env var, and an error that echoes it: both carry an escape, a line break
		// into a V2 command, and a legacy command anywhere in a line.
		const HOSTILE = `/logs/a${ESC}[31m\n::add-mask::secret\nb ##[error]c.ndjson`;
		const hostileFault = PlatformError.systemError({
			_tag: "PermissionDenied",
			module: "FileSystem",
			method: "writeFileString",
			pathOrDescriptor: HOSTILE,
			description: `denied${ESC}]8;;x${ESC}\\\n::error::injected`,
		});
		const lines = (entries: ReadonlyArray<string>) => entries.flatMap((entry) => entry.split(/\r\n|\r|\n/));
		const failureLines = (err: ReadonlyArray<string>) => {
			const at = err.findIndex((entry) => entry.startsWith("diagnostics log file"));
			assert.isAtLeast(at, 0, `control: the failure line was printed\n${err.join("\n")}`);
			return lines([A.getUnsafe(err, at)]);
		};

		for (const ci of ["github-actions", undefined] as const) {
			it.effect(
				`${ci ?? "outside Actions"}: no escape, ${ci === undefined ? "the text kept" : "and no workflow command"}`,
				() =>
					Effect.gen(function* () {
						const h = yield* harness({
							file: { envVar: FILE_ENV },
							env: { [LEVEL_ENV]: "debug", [FILE_ENV]: HOSTILE },
							faults: { writeFileString: MemoryFileSystem.failTimes(1, hostileFault) },
							...(ci === undefined ? {} : { ci }),
						});
						yield* h.log(Effect.logError("first"));
						let spins = 0;
						while (plain(h.err).length === 0 && spins++ < 1000) yield* Effect.yieldNow;
						yield* h.close;
						const printed = failureLines(h.err);
						for (const line of printed) assert.notInclude(line, ESC, Result.getOrThrow(S.encodeUnknownResult(Json)(line)));
						const commands = printed.filter((line) => /^[\s\u0085]*::/.test(line) || line.includes("##["));
						if (ci === "github-actions") assert.deepStrictEqual(commands, []);
						else assert.isAbove(commands.length, 0, "control: outside Actions the text is not neutralized");
						assert.include(printed.join("\n"), "add-mask", "the text is kept, only made inert");
					}),
			);
		}
	});

	describe("the first write error", () => {
		it.effect("prints exactly one stderr line, keeps the program running, and drops later writes", () =>
			Effect.gen(function* () {
				const h = yield* harness({
					file: { path: PATH },
					env: { [LEVEL_ENV]: "debug" },
					failFirstAppend: true,
				});
				// The first batch fails.
				yield* h.log(Effect.logError("first"));
				let spins = 0;
				while (plain(h.err).length === 0 && spins++ < 1000) yield* Effect.yieldNow;
				assert.strictEqual(plain(h.err).length, 1, h.err.join("\n"));

				// The program is unaffected: it keeps logging and finishes with its own value. The fault has used up its
				// one failure, so a healthy sink WOULD write these: they are dropped because the sink disabled itself.
				const exit = yield* Effect.exit(
					h.log(
						Effect.gen(function* () {
							yield* Effect.logError("second");
							yield* settle;
							yield* Effect.logError("third");
						}),
					),
				);
				assert.isTrue(Exit.isSuccess(exit));
				yield* settle;
				yield* h.close;

				const errors = plain(h.err);
				assert.strictEqual(errors.length, 1, errors.join("\n"));
				assert.match(
					errors[0] ?? "",
					new RegExp(`^diagnostics log file ${PATH} failed: .*disk said no.*; further file logging disabled$`),
				);
				assert.isFalse(h.handle.volume.has(PATH), "later lines are dropped, not written");
				// The stderr sink still recorded every record: only the file went away.
				assert.strictEqual(ndjson(h.err).length, 3);
			}),
		);

		it.effect("lines still queued when the scope closes after the sink disabled itself are discarded silently", () =>
			Effect.gen(function* () {
				const h = yield* harness({
					file: { path: PATH },
					env: { [LEVEL_ENV]: "debug" },
					failFirstAppend: true,
				});
				yield* h.log(Effect.logError("first"));
				let spins = 0;
				while (plain(h.err).length === 0 && spins++ < 1000) yield* Effect.yieldNow;
				// Queued after the failure and never given a chance to drain before the scope closes.
				yield* h.log(Effect.logError("queued one"));
				yield* h.log(Effect.logError("queued two"));
				yield* h.close;
				assert.strictEqual(plain(h.err).length, 1, h.err.join("\n"));
				assert.isFalse(h.handle.volume.has(PATH));
			}),
		);
	});

	describe("a failing filesystem", () => {
		it.effect("a write that never completes cannot hang scope close: it returns within the bound", () =>
			Effect.gen(function* () {
				const h = yield* harness({
					file: { path: PATH },
					env: { [LEVEL_ENV]: "debug" },
					faults: { writeFileString: () => Effect.never },
				});
				yield* h.log(Effect.logError("first"));
				// Let the drain start its (never finishing) append, then close the scope on a fiber.
				yield* settle;
				const closing = yield* Effect.forkChild(h.close);
				yield* TestClock.adjust("10 seconds");
				yield* Fiber.join(closing);
				// The interrupt is silent: giving up on a hung filesystem prints no error line.
				assert.deepStrictEqual(plain(h.err), []);
			}),
		);

		it.effect("a DEFECT in the drain is treated like a write error: one line, then disabled", () =>
			Effect.gen(function* () {
				const h = yield* harness({
					file: { path: PATH },
					env: { [LEVEL_ENV]: "debug" },
					faults: { writeFileString: MemoryFileSystem.die(new Error("disk exploded")) },
				});
				yield* h.log(Effect.logError("first"));
				let spins = 0;
				while (plain(h.err).length === 0 && spins++ < 1000) yield* Effect.yieldNow;
				yield* h.log(Effect.logError("second"));
				yield* settle;
				yield* h.close;
				assert.strictEqual(plain(h.err).length, 1, h.err.join("\n"));
				assert.match(plain(h.err)[0] ?? "", /failed: .*disk exploded.*; further file logging disabled$/);
				assert.isFalse(h.handle.volume.has(PATH));
			}),
		);

		it.effect("a makeDirectory failure is one line, then disabled", () =>
			Effect.gen(function* () {
				const h = yield* harness({
					file: { path: "/locked/dir/log.ndjson" },
					env: { [LEVEL_ENV]: "debug" },
					faults: { makeDirectory: MemoryFileSystem.failTimes(1, deny) },
				});
				yield* h.log(Effect.logError("first"));
				let spins = 0;
				while (plain(h.err).length === 0 && spins++ < 1000) yield* Effect.yieldNow;
				yield* h.log(Effect.logError("second"));
				yield* settle;
				yield* h.close;
				assert.strictEqual(plain(h.err).length, 1, h.err.join("\n"));
				assert.isFalse(h.handle.volume.has("/locked/dir/log.ndjson"));
			}),
		);
	});

	it.effect("creates the parent directory once, on the first batch, not on every batch", () =>
		Effect.gen(function* () {
			let made = 0;
			const h = yield* harness({
				file: { path: "/deep/er/log.ndjson" },
				env: { [LEVEL_ENV]: "debug" },
				faults: {
					makeDirectory: () => {
						made++;
						return undefined;
					},
				},
			});
			yield* h.log(Effect.logError("first"));
			let spins = 0;
			while (!h.handle.volume.has("/deep/er/log.ndjson") && spins++ < 1000) yield* Effect.yieldNow;
			yield* h.log(Effect.logError("second"));
			yield* settle;
			yield* h.log(Effect.logError("third"));
			yield* h.close;
			assert.strictEqual(made, 1);
			assert.strictEqual(
				(h.handle.volume.text("/deep/er/log.ndjson") ?? "").split("\n").filter((l) => l !== "").length,
				3,
			);
		}),
	);
});
