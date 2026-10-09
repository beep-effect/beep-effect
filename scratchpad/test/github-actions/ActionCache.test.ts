// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file asyncFunction:skip-file
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import type { FileBlobTransfer } from "../../effected/github-actions/index.ts";
import { ActionCache, ActionCacheError, BlobTransferError, CacheKey } from "../../effected/github-actions/index.ts";
import { json, resultsEnv, twirpFetch } from "./results.ts";

/**
 * A transport that keeps whole files in memory.
 *
 * @remarks
 * Real bytes, not a recorded call: the round-trip test saves through `tar`,
 * deletes the originals and restores them, so what this map holds has to be an
 * archive a real `tar` will accept.
 */
const fileTransfer = () => {
	const blobs = new Map<string, Uint8Array>();
	const transfer: FileBlobTransfer = {
		uploadFile: (url, file) =>
			Effect.tryPromise({
				try: async () => {
					blobs.set(url, new Uint8Array(await readFile(file)));
				},
				catch: (cause) => BlobTransferError.make({ reason: "uploadFailed", cause }),
			}),
		downloadToFile: (url, file) =>
			Effect.tryPromise({
				try: async () => {
					const found = blobs.get(url);
					if (found === undefined) {
						throw new Error(`nothing was uploaded to ${url}`);
					}
					await writeFile(file, found);
				},
				catch: (cause) => BlobTransferError.make({ reason: "downloadFailed", cause }),
			}),
	};
	return { blobs, transfer };
};

/** The real filesystem and the real `tar`, over a stubbed backend and transport. */
const live = (fetch: typeof globalThis.fetch, transfer: FileBlobTransfer, env: Readonly<Record<string, string>> = {}) =>
	ActionCache.layerWith(transfer).pipe(
		Layer.provide(
			Layer.mergeAll(
				resultsEnv(env),
				NodeServices.layer,
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))),
			),
		),
	);

const scratch = () => mkdtempSync(join(tmpdir(), "effected-cache-test-"));

const withScratch = <A, E>(use: (root: string) => Effect.Effect<A, E>) => {
	const root = scratch();
	return use(root).pipe(Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))));
};

/** The digest `actions/cache` computes for the same path set. */
const versionOf = (paths: ReadonlyArray<string>): string =>
	createHash("sha256")
		.update([...paths, "gzip", "1.0"].join("|"))
		.digest("hex");

describe("ActionCache", () => {
	it.effect("round-trips real files through a real archive", () =>
		withScratch((root) =>
			Effect.gen(function* () {
				const file = join(root, "payload.txt");
				writeFileSync(file, "cached contents");
				const url = "https://blob.example/archive?sig=abc";
				const { blobs, transfer } = fileTransfer();
				const { fetch } = twirpFetch({
					CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
					FinalizeCacheEntryUpload: () => json({ ok: true }),
					GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url, matched_key: "the-key" }),
				});

				const matched = yield* Effect.gen(function* () {
					const cache = yield* ActionCache;
					yield* cache.save([file], "the-key");
					return yield* cache.restore([file], "the-key");
				}).pipe(Effect.provide(live(fetch, transfer)));

				assert.isTrue(Option.isSome(matched));
				assert.strictEqual(Option.getOrNull(matched), "the-key");
				assert.strictEqual(blobs.size, 1);
				// gzip's magic: what was uploaded is an archive, not a description of one.
				assert.deepStrictEqual([...(blobs.get(url) ?? []).slice(0, 2)], [0x1f, 0x8b]);
				assert.strictEqual(readFileSync(file, "utf8"), "cached contents");
			}),
		),
	);

	it.effect("restores a file the save archived and the caller then deleted", () =>
		withScratch((root) =>
			Effect.gen(function* () {
				const file = join(root, "gone.txt");
				writeFileSync(file, "recovered");
				const url = "https://blob.example/a";
				const { transfer } = fileTransfer();
				const { fetch } = twirpFetch({
					CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
					FinalizeCacheEntryUpload: () => json({ ok: true }),
					GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url }),
				});
				yield* Effect.flatMap(ActionCache, (cache) => cache.save([file], "k")).pipe(
					Effect.provide(live(fetch, transfer)),
				);
				rmSync(file);
				yield* Effect.flatMap(ActionCache, (cache) => cache.restore([file], "k")).pipe(
					Effect.provide(live(fetch, transfer)),
				);
				// The whole claim of a cache, and the one an in-memory double cannot make.
				assert.strictEqual(readFileSync(file, "utf8"), "recovered");
			}),
		),
	);

	it.effect("derives the entry version from the paths, in the order given", () =>
		Effect.gen(function* () {
			const { transfer } = fileTransfer();
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["b", "a"], "k")).pipe(
				Effect.provide(live(fetch, transfer)),
			);
			// Sorting the paths would be the obvious tidy-up and would compute a
			// version no other cache step in the workflow agrees with — the entry a
			// sibling `actions/cache` step wrote would simply never be found.
			assert.strictEqual(calls[0]?.body.version, versionOf(["b", "a"]));
			assert.notStrictEqual(versionOf(["b", "a"]), versionOf(["a", "b"]));
		}),
	);

	it.effect("sends a CacheKey's own restore-key ladder", () =>
		Effect.gen(function* () {
			const key = CacheKey.of("Linux", "pnpm-store", "abc123");
			const { transfer } = fileTransfer();
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], key)).pipe(
				Effect.provide(live(fetch, transfer)),
			);
			assert.strictEqual(calls[0]?.body.key, "Linux-pnpm-store-abc123");
			// Deriving the ladder at the call site is what every consumer re-invents
			// and gets subtly wrong; passing the key passes the ladder with it.
			assert.deepStrictEqual(calls[0]?.body.restore_keys, [...key.restoreKeys]);
		}),
	);

	it.effect("hands a policy-carrying key's EXACT ladder through, not the derived prefixes", () =>
		Effect.gen(function* () {
			// The whole point of the ladder policy: the typed-key path must carry
			// it, or every consumer with a policy is back to hand-building the
			// restore-key list and bypassing CacheKey. The expected rungs are
			// LITERAL: an implementation that ignores the policy sends four
			// derived prefixes here, and asserting against `key.restoreKeys`
			// would agree with that mutant on both sides.
			const key = CacheKey.of("Linux", "X64", "v1hash", "main", "lockhash").withRestoreDepths([4, 3]);
			const { transfer } = fileTransfer();
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], key)).pipe(
				Effect.provide(live(fetch, transfer)),
			);
			assert.strictEqual(calls[0]?.body.key, "Linux-X64-v1hash-main-lockhash");
			assert.deepStrictEqual(calls[0]?.body.restore_keys, ["Linux-X64-v1hash-main-", "Linux-X64-v1hash-"]);
		}),
	);

	it.effect("sends ZERO restore keys for an exact-match-only key", () =>
		Effect.gen(function* () {
			// The cache-bust mode: a stale partial hit is worse than a cold start,
			// so the body must carry an EMPTY restore_keys — an implementation
			// that reads the empty policy as "no policy" sends the two derived
			// prefixes here instead.
			const key = CacheKey.of("Linux", "pnpm-store", "abc123").withoutRestoreKeys();
			const { transfer } = fileTransfer();
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], key)).pipe(
				Effect.provide(live(fetch, transfer)),
			);
			assert.strictEqual(calls[0]?.body.key, "Linux-pnpm-store-abc123");
			assert.deepStrictEqual(calls[0]?.body.restore_keys, []);
		}),
	);

	it.effect("reports a miss as nothing", () =>
		Effect.gen(function* () {
			const { transfer } = fileTransfer();
			const { fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			const found = yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k")).pipe(
				Effect.provide(live(fetch, transfer)),
			);
			assert.isTrue(Option.isNone(found));
		}),
	);

	it.effect("answers with the key that actually matched, not the one asked for", () =>
		withScratch((root) =>
			Effect.gen(function* () {
				const file = join(root, "f.txt");
				writeFileSync(file, "x");
				const url = "https://blob.example/b";
				const { transfer } = fileTransfer();
				const { fetch } = twirpFetch({
					CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
					FinalizeCacheEntryUpload: () => json({ ok: true }),
					GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url, matchedKey: "Linux-pnpm-store-" }),
				});
				yield* Effect.flatMap(ActionCache, (cache) => cache.save([file], "primary")).pipe(
					Effect.provide(live(fetch, transfer)),
				);
				const matched = yield* Effect.flatMap(ActionCache, (cache) =>
					cache.restore([file], "primary", ["Linux-"]),
				).pipe(Effect.provide(live(fetch, transfer)));
				// A hit on a restore key is a PARTIAL hit; a caller that cannot tell it
				// from an exact hit never re-saves and the cache never warms.
				assert.strictEqual(Option.getOrNull(matched), "Linux-pnpm-store-");
			}),
		),
	);

	it.effect("refuses to save nothing, without asking the backend", () =>
		Effect.gen(function* () {
			const { transfer } = fileTransfer();
			const { calls, fetch } = twirpFetch({});
			const error = yield* Effect.flip(
				Effect.flatMap(ActionCache, (cache) => cache.save([], "k")).pipe(Effect.provide(live(fetch, transfer))),
			);
			assert.instanceOf(error, ActionCacheError);
			assert.strictEqual(error.reason, "archiveFailed");
			// Reserving an entry for an archive that will never exist leaves a key
			// that answers "present" and serves nothing.
			assert.lengthOf(calls, 0);
		}),
	);

	it.effect("fails with tar's own complaint when the archive cannot be extracted", () =>
		Effect.gen(function* () {
			// A missing path no longer reaches tar (resolution existence-filters
			// it), so the stderr channel is proved on the extract side: bytes that
			// are not a gzip archive.
			const corrupt: FileBlobTransfer = {
				uploadFile: () => Effect.void,
				downloadToFile: (_url, file) =>
					Effect.tryPromise({
						try: () => writeFile(file, "this is not an archive"),
						catch: (cause) => BlobTransferError.make({ reason: "downloadFailed", cause }),
					}),
			};
			const { fetch } = twirpFetch({
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: "https://blob.example/junk" }),
			});
			const error = yield* Effect.flip(
				Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k")).pipe(Effect.provide(live(fetch, corrupt))),
			);
			assert.strictEqual(error.reason, "archiveFailed");
			// The exit code says it failed; only stderr says why, and the difference
			// between "not in gzip format" and "tar is not installed" is the whole message.
			assert.isDefined(error.stderr);
		}),
	);

	it.effect("treats a create conflict as a save that already happened", () =>
		withScratch((root) =>
			Effect.gen(function* () {
				const file = join(root, "f.txt");
				writeFileSync(file, "x");
				const { blobs, transfer } = fileTransfer();
				const { calls, fetch } = twirpFetch({ CreateCacheEntry: () => new Response(null, { status: 409 }) });
				yield* Effect.flatMap(ActionCache, (cache) => cache.save([file], "k")).pipe(
					Effect.provide(live(fetch, transfer)),
				);
				assert.strictEqual(blobs.size, 0);
				assert.lengthOf(calls, 1);
			}),
		),
	);

	it.effect("fails when the upload is never finalized, even though every byte arrived", () =>
		withScratch((root) =>
			Effect.gen(function* () {
				const file = join(root, "f.txt");
				writeFileSync(file, "x");
				const { blobs, transfer } = fileTransfer();
				const { fetch } = twirpFetch({
					CreateCacheEntry: () => json({ ok: true, signedUploadUrl: "https://blob.example/c" }),
					FinalizeCacheEntryUpload: () => json({ ok: false }),
				});
				const error = yield* Effect.flip(
					Effect.flatMap(ActionCache, (cache) => cache.save([file], "k")).pipe(Effect.provide(live(fetch, transfer))),
				);
				assert.strictEqual(blobs.size, 1, "the archive did arrive");
				assert.strictEqual(error.reason, "refused");
				assert.include(error.message, "FinalizeCacheEntryUpload");
			}),
		),
	);

	it.effect("distinguishes a transfer failure from a protocol failure", () =>
		withScratch((root) =>
			Effect.gen(function* () {
				const file = join(root, "f.txt");
				writeFileSync(file, "x");
				const failing: FileBlobTransfer = {
					uploadFile: () => Effect.fail(BlobTransferError.make({ reason: "uploadFailed" })),
					downloadToFile: () => Effect.fail(BlobTransferError.make({ reason: "downloadFailed" })),
				};
				const { fetch } = twirpFetch({
					CreateCacheEntry: () => json({ ok: true, signedUploadUrl: "https://blob.example/d" }),
				});
				const error = yield* Effect.flip(
					Effect.flatMap(ActionCache, (cache) => cache.save([file], "k")).pipe(Effect.provide(live(fetch, failing))),
				);
				assert.strictEqual(error.reason, "transferFailed");
			}),
		),
	);

	it.effect("names the variable that is missing outside a `uses:` step", () =>
		Effect.gen(function* () {
			const { transfer } = fileTransfer();
			const { fetch } = twirpFetch({});
			const error = yield* Effect.flip(
				Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k")).pipe(
					Effect.provide(live(fetch, transfer, { ACTIONS_RESULTS_URL: "" })),
				),
			);
			assert.strictEqual(error.reason, "misconfigured");
			assert.include(error.message, "ACTIONS_RESULTS_URL");
		}),
	);

	describe("glob resolution on save", () => {
		/** A tree with two node_modules at different depths and a bystander file. */
		const tree = (root: string) => {
			const aDep = join(root, "a", "node_modules", "pkg", "dep.txt");
			const bDep = join(root, "b", "node_modules", "dep.txt");
			const bystander = join(root, "src", "keep.ts");
			for (const file of [aDep, bDep, bystander]) {
				mkdirSync(join(file, ".."), { recursive: true });
				writeFileSync(file, `contents of ${file}`);
			}
			return { aDep, bDep, bystander };
		};

		const backend = (url = "https://blob.example/resolved") =>
			twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
				FinalizeCacheEntryUpload: () => json({ ok: true }),
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url }),
			});

		it.effect("resolves `**/` patterns to real directories and archives them recursively", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					// The real-runner repro: `tar: **/node_modules: Cannot stat` — the
					// pattern must be resolved BEFORE tar, and a matched directory is
					// archived recursively (implicitDescendants stays off, as in
					// actions/toolkit cacheUtils.ts:48-70; tar's own recursion does the
					// descending). Handing the pattern to tar verbatim fails this test
					// with tar's exact production complaint.
					const { aDep, bDep, bystander } = tree(root);
					const { transfer } = fileTransfer();
					const { fetch } = backend();
					const scope = live(fetch, transfer);
					yield* Effect.flatMap(ActionCache, (cache) => cache.save([`${root}/**/node_modules`], "k")).pipe(
						Effect.provide(scope),
					);
					rmSync(join(root, "a"), { recursive: true });
					rmSync(join(root, "b"), { recursive: true });
					rmSync(bystander);
					yield* Effect.flatMap(ActionCache, (cache) => cache.restore([`${root}/**/node_modules`], "k")).pipe(
						Effect.provide(scope),
					);
					assert.strictEqual(readFileSync(aDep, "utf8"), `contents of ${aDep}`);
					assert.strictEqual(readFileSync(bDep, "utf8"), `contents of ${bDep}`);
					// The bystander never matched, so the archive must not resurrect it.
					assert.isFalse(existsSync(bystander));
				}),
			),
		);

		it.effect("hashes the LITERAL pattern list into the version, on save AND restore", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					// actions/toolkit hashes the caller's un-resolved list on both
					// sides (getCacheVersion, cacheUtils.ts:136-159; cache.ts:689 and
					// :361) — restore resolves nothing, so hashing the RESOLVED list on
					// save would compute a version restore can never reproduce, and
					// every save would be an entry no restore finds.
					tree(root);
					const literals = [`${root}/**/node_modules`, `${root}/src`];
					const { transfer } = fileTransfer();
					const { calls, fetch } = backend();
					const scope = live(fetch, transfer);
					yield* Effect.flatMap(ActionCache, (cache) => cache.save(literals, "k")).pipe(Effect.provide(scope));
					yield* Effect.flatMap(ActionCache, (cache) => cache.restore(literals, "k")).pipe(Effect.provide(scope));
					const create = calls.find((call) => call.method === "CreateCacheEntry");
					const lookup = calls.find((call) => call.method === "GetCacheEntryDownloadURL");
					assert.strictEqual(create?.body.version, versionOf(literals));
					assert.strictEqual(lookup?.body.version, versionOf(literals));
				}),
			),
		);

		it.effect("drops a pattern that matches nothing and saves the rest", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					// Toolkit parity: the globber simply yields nothing for a pattern
					// with no matches — and for a LITERAL path that is not on disk,
					// which goes through the same existence filter
					// (internal-globber.ts:90-100). Neither is an error while anything
					// else matched.
					const file = join(root, "payload.txt");
					writeFileSync(file, "kept");
					const { blobs, transfer } = fileTransfer();
					const { fetch } = backend();
					yield* Effect.flatMap(ActionCache, (cache) =>
						cache.save([file, `${root}/nothing-*`, join(root, "absent-literal")], "k"),
					).pipe(Effect.provide(live(fetch, transfer)));
					assert.strictEqual(blobs.size, 1, "the archive with the surviving path was uploaded");
				}),
			),
		);

		it.effect("fails typed, before the backend, when nothing at all matches", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					const { transfer } = fileTransfer();
					const { calls, fetch } = twirpFetch({});
					const error = yield* Effect.flip(
						Effect.flatMap(ActionCache, (cache) => cache.save([`${root}/nothing-*`], "k")).pipe(
							Effect.provide(live(fetch, transfer)),
						),
					);
					assert.strictEqual(error.reason, "archiveFailed");
					assert.include(error.detail, "matched");
					// Reserving an entry for an archive that will never exist leaves a
					// key that answers "present" and serves nothing — same rule as the
					// empty input list, which is the toolkit's hard Path Validation
					// Error (cache.ts:662-666).
					assert.lengthOf(calls, 0);
				}),
			),
		);

		it.effect("roots a relative pattern at GITHUB_WORKSPACE", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					// The canonical actions/cache idiom, exactly as a workflow writes it.
					const { aDep } = tree(root);
					const { transfer } = fileTransfer();
					const { fetch } = backend();
					const scope = live(fetch, transfer, { GITHUB_WORKSPACE: root });
					yield* Effect.flatMap(ActionCache, (cache) => cache.save(["**/node_modules"], "k")).pipe(
						Effect.provide(scope),
					);
					rmSync(join(root, "a"), { recursive: true });
					yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["**/node_modules"], "k")).pipe(
						Effect.provide(scope),
					);
					assert.strictEqual(readFileSync(aDep, "utf8"), `contents of ${aDep}`);
				}),
			),
		);

		it.effect("expands a leading ~ against HOME", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					const file = join(root, "payload.txt");
					writeFileSync(file, "from home");
					const { blobs, transfer } = fileTransfer();
					const { fetch } = backend();
					yield* Effect.flatMap(ActionCache, (cache) => cache.save(["~/payload.txt"], "k")).pipe(
						Effect.provide(live(fetch, transfer, { HOME: root })),
					);
					assert.strictEqual(blobs.size, 1);
				}),
			),
		);

		it.effect("a `!` exclusion filters what the includes matched", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					const { aDep, bDep } = tree(root);
					const { transfer } = fileTransfer();
					const { fetch } = backend();
					const patterns = [`${root}/**/node_modules`, `!${root}/b/**`];
					const scope = live(fetch, transfer);
					yield* Effect.flatMap(ActionCache, (cache) => cache.save(patterns, "k")).pipe(Effect.provide(scope));
					rmSync(join(root, "a"), { recursive: true });
					rmSync(join(root, "b"), { recursive: true });
					yield* Effect.flatMap(ActionCache, (cache) => cache.restore(patterns, "k")).pipe(Effect.provide(scope));
					assert.strictEqual(readFileSync(aDep, "utf8"), `contents of ${aDep}`);
					assert.isFalse(existsSync(bDep));
				}),
			),
		);

		/** The real spawner, recording each spawn's argv — and, when a `-T` flag is present, the named manifest's content AT SPAWN TIME, before the scratch directory is removed. */
		const spyingSpawner = () => {
			const spawns: Array<{ readonly args: ReadonlyArray<string>; readonly manifest?: string }> = [];
			const layer = Layer.effect(
				ChildProcessSpawner.ChildProcessSpawner,
				Effect.gen(function* () {
					const real = yield* ChildProcessSpawner.ChildProcessSpawner;
					return {
						...real,
						spawn: Effect.fn("ChildProcessSpawner.ChildProcessSpawner.spawn")((...spawnArgs: Parameters<typeof real.spawn>) => {
							const [command] = spawnArgs;
							if ("args" in command) {
								const args = [...command.args];
								const flag = args.indexOf("-T");
								const manifestPath = flag === -1 ? undefined : args[flag + 1];
								spawns.push({
									args,
									...(manifestPath === undefined ? {} : { manifest: readFileSync(manifestPath, "utf8") }),
								});
							}
							return real.spawn(...spawnArgs);
						}),
					};
				}),
			).pipe(Layer.provide(NodeServices.layer));
			return { spawns, layer };
		};

		/** The real FileSystem with a live `readDirectory` call counter. */
		const countingFileSystem = () => {
			let reads = 0;
			const layer = Layer.effect(
				FileSystem.FileSystem,
				Effect.gen(function* () {
					const real = yield* FileSystem.FileSystem;
					return {
						...real,
						readDirectory: Effect.fn("FileSystem.FileSystem.readDirectory")((...readArgs: Parameters<typeof real.readDirectory>) => {
							reads += 1;
							return real.readDirectory(...readArgs);
						}),
					};
				}),
			).pipe(Layer.provide(NodeServices.layer));
			return { layer, reads: () => reads };
		};

		it.effect(
			"a resolution too large for argv reaches tar through a manifest file",
			() =>
				withScratch((root) =>
					Effect.gen(function* () {
						// ~2.7MB of resolved absolute paths: past Linux's ~2MB and
						// macOS's 1MB execve budgets, so handing the list to tar as
						// argv would die as E2BIG before tar even started — the
						// `${workspace}/**` shape at production scale.
						const segment = (label: string) => `${label}-${"x".repeat(180)}`;
						const deep = join(root, segment("d1"), segment("d2"), segment("d3"), segment("d4"));
						mkdirSync(deep, { recursive: true });
						const files: Array<string> = [];
						for (let index = 0; index < 2800; index += 1) {
							const file = join(deep, `file-${String(index).padStart(4, "0")}-${"y".repeat(180)}.txt`);
							writeFileSync(file, `payload ${index}`);
							files.push(file);
						}
						assert.isAbove(
							files.reduce((total, file) => total + file.length + 1, 0),
							2_500_000,
							"the fixture must be big enough that argv would actually overflow",
						);

						const { transfer } = fileTransfer();
						const { fetch } = backend();
						const spy = spyingSpawner();
						const scope = ActionCache.layerWith(transfer).pipe(
							Layer.provide(spy.layer),
							Layer.provide(
								Layer.mergeAll(
									resultsEnv({}),
									NodeServices.layer,
									FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))),
								),
							),
						);
						const pattern = `${deep}/*`;
						yield* Effect.flatMap(ActionCache, (cache) => cache.save([pattern], "k")).pipe(Effect.provide(scope));
						rmSync(deep, { recursive: true });
						yield* Effect.flatMap(ActionCache, (cache) => cache.restore([pattern], "k")).pipe(Effect.provide(scope));
						// The real-IO round trip held at manifest scale.
						assert.strictEqual(readFileSync(files[0] ?? "", "utf8"), "payload 0");
						assert.strictEqual(readFileSync(files[2799] ?? "", "utf8"), "payload 2799");

						// The create invocation carried `-T <manifest>` and not one
						// resolved path; the manifest listed every match.
						const create = spy.spawns.find((spawn) => spawn.args.includes("-T"));
						assert.isDefined(create, "tar was never invoked with a manifest");
						const resolvedSet = new Set(files);
						assert.isFalse(
							create?.args.some((arg) => resolvedSet.has(arg)),
							"resolved paths must not travel as argv",
						);
						const listed = (create?.manifest ?? "").split("\n").filter((line) => line !== "");
						assert.deepStrictEqual([...listed].sort(), [...files].sort());
					}),
				),
			120_000,
		);

		it.effect("stat-and-admits a literal directory without enumerating it", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					// A pnpm-store-shaped literal: a directory with real contents
					// that only tar's own recursion should ever descend into.
					const store = join(root, "store");
					mkdirSync(join(store, "v3"), { recursive: true });
					writeFileSync(join(store, "v3", "entry.txt"), "stored");
					const { transfer } = fileTransfer();
					const { fetch } = backend();
					const counting = countingFileSystem();
					const scope = ActionCache.layerWith(transfer).pipe(
						Layer.provide(counting.layer),
						Layer.provide(
							Layer.mergeAll(
								resultsEnv({}),
								NodeServices.layer,
								FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))),
							),
						),
					);
					yield* Effect.flatMap(ActionCache, (cache) => cache.save([store], "k")).pipe(Effect.provide(scope));
					rmSync(store, { recursive: true });
					yield* Effect.flatMap(ActionCache, (cache) => cache.restore([store], "k")).pipe(Effect.provide(scope));
					// The literal contributed the only search root, and no pattern can
					// match below it: admission comes from the stat alone, on save AND
					// restore — a store-sized literal must not cost a full enumeration
					// that can admit nothing. tar's recursion still archived the
					// contents, which is what the round trip above proves.
					assert.strictEqual(readFileSync(join(store, "v3", "entry.txt"), "utf8"), "stored");
					assert.strictEqual(counting.reads(), 0, "a literal-only resolution must not enumerate the directory");
					// The control: a wildcard below the same root MUST enumerate —
					// proof the counter is live rather than the wrapper being blind.
					yield* Effect.flatMap(ActionCache, (cache) => cache.save([`${store}/**`], "k2")).pipe(Effect.provide(scope));
					assert.isAbove(counting.reads(), 0, "the toolkit-parity walk must survive for actual patterns");
				}),
			),
		);

		it.effect("an uncompilable pattern fails typed, naming it", () =>
			withScratch((root) =>
				Effect.gen(function* () {
					// The engine refuses a pattern past its 64KB guard — the one way a
					// pattern fails to COMPILE rather than merely failing to match.
					const { transfer } = fileTransfer();
					const { calls, fetch } = twirpFetch({});
					const error = yield* Effect.flip(
						Effect.flatMap(ActionCache, (cache) => cache.save([`${root}/${"a".repeat(70_000)}`], "k")).pipe(
							Effect.provide(live(fetch, transfer)),
						),
					);
					assert.strictEqual(error.reason, "archiveFailed");
					assert.include(error.detail, "not a usable glob pattern");
					assert.lengthOf(calls, 0);
				}),
			),
		);
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies rather than reporting a miss", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k")));
				assert.strictEqual(exit._tag, "Failure");
			}).pipe(Effect.provide(ActionCache.layerTest())),
		);
	});
});
