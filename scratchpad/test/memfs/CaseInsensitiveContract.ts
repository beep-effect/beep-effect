// The case-insensitive volume contract. It runs against the host filesystem
// first (integration/case-insensitive.int.test.ts, on a case-folding volume
// such as default APFS) so every expectation below is observed behaviour, not
// assumed behaviour; the memory engine (CaseInsensitive.test.ts) must then
// match it. Every case works under a scoped temp directory.

import { assert, describe, it } from "@effect/vitest";
import type { Layer } from "effect";
import { Effect, FileSystem } from "effect";

export const caseInsensitiveSuite = (
	name: string,
	layer: Layer.Layer<FileSystem.FileSystem, unknown>,
	options?: { readonly skip?: boolean },
) =>
	describe.skipIf(options?.skip === true)(`case-insensitive volume (${name})`, () => {
		const run = <A>(body: (fs: FileSystem.FileSystem, d: string) => Effect.Effect<A, unknown>) =>
			Effect.scoped(
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const d = yield* fs.makeTempDirectoryScoped();
					return yield* body(fs, d);
				}),
			).pipe(Effect.provide(layer));

		it.effect("a differently-cased lookup resolves the stored entry", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/docs.json`, "{}");
					assert.strictEqual(yield* fs.readFileString(`${d}/Docs.json`), "{}");
					assert.strictEqual((yield* fs.stat(`${d}/DOCS.JSON`)).type, "File");
				}),
			),
		);

		it.effect("listings keep the stored spelling", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/Docs.json`, "{}");
					assert.deepStrictEqual(yield* fs.readDirectory(d), ["Docs.json"]);
				}),
			),
		);

		it.effect("a write under a folded name overwrites and keeps the stored spelling", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/Docs.json`, "1");
					yield* fs.writeFileString(`${d}/docs.json`, "2");
					assert.deepStrictEqual(yield* fs.readDirectory(d), ["Docs.json"]);
					assert.strictEqual(yield* fs.readFileString(`${d}/DOCS.json`), "2");
				}),
			),
		);

		it.effect("an exclusive create under a folded name is AlreadyExists", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/a.txt`, "");
					const error = yield* Effect.flip(fs.writeFileString(`${d}/A.txt`, "", { flag: "wx" }));
					assert.strictEqual(error.reason._tag, "AlreadyExists");
				}),
			),
		);

		it.effect("makeDirectory under a folded name is AlreadyExists", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/Dir`);
					const error = yield* Effect.flip(fs.makeDirectory(`${d}/dir`));
					assert.strictEqual(error.reason._tag, "AlreadyExists");
				}),
			),
		);

		it.effect("a case-only rename rewrites the spelling and keeps children", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/Dir`);
					yield* fs.writeFileString(`${d}/Dir/child.txt`, "c");
					yield* fs.rename(`${d}/Dir`, `${d}/dir`);
					assert.deepStrictEqual(yield* fs.readDirectory(d), ["dir"]);
					assert.deepStrictEqual(yield* fs.readDirectory(`${d}/DIR`), ["child.txt"]);
					assert.strictEqual(yield* fs.readFileString(`${d}/dir/child.txt`), "c");
				}),
			),
		);

		it.effect("rename onto its own spelling keeps the stored case", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/Dir`);
					yield* fs.writeFileString(`${d}/Dir/c.txt`, "c");
					yield* fs.rename(`${d}/dir`, `${d}/dir`);
					assert.deepStrictEqual(yield* fs.readDirectory(d), ["Dir"]);
					yield* fs.rename(`${d}/DIR`, `${d}/dir`);
					assert.deepStrictEqual(yield* fs.readDirectory(d), ["dir"]);
					assert.strictEqual(yield* fs.readFileString(`${d}/DIR/c.txt`), "c");
				}),
			),
		);

		it.effect(
			"a rename onto a different, folded-equal entry replaces it and keeps the destination's stored spelling",
			() =>
				run((fs, d) =>
					Effect.gen(function* () {
						yield* fs.writeFileString(`${d}/x.txt`, "src");
						yield* fs.writeFileString(`${d}/b.txt`, "dst");
						yield* fs.rename(`${d}/x.txt`, `${d}/B.txt`);
						const names = yield* fs.readDirectory(d);
						assert.strictEqual(yield* fs.readFileString(`${d}/b.TXT`), "src");
						assert.deepStrictEqual(names, ["b.txt"]);
					}),
				),
		);

		it.effect("glob matches a folded pattern and returns the stored spelling", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/docs.json`, "{}");
					assert.deepStrictEqual(yield* fs.glob("*.JSON", { root: d }), ["docs.json"]);
				}),
			),
		);

		// The oracle is Effect's node adapter, which wraps the JS `fs.realpath`:
		// it resolves links but never canonicalizes case, so components keep the
		// queried spelling and only a link's target text contributes its own.
		it.effect("realPath keeps the queried spelling and resolves links to their target text", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					const realD = yield* fs.realPath(d);
					yield* fs.makeDirectory(`${d}/Pkg`);
					yield* fs.writeFileString(`${d}/Pkg/Main.ts`, "");
					yield* fs.symlink(`${d}/Pkg`, `${d}/alias`);
					assert.strictEqual(yield* fs.realPath(`${d}/pkg/main.TS`), `${realD}/pkg/main.TS`);
					assert.strictEqual(yield* fs.realPath(`${d}/ALIAS/main.TS`), `${realD}/Pkg/main.TS`);
				}),
			),
		);

		it.effect("a folded path through a symlinked directory resolves", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/pkg`);
					yield* fs.writeFileString(`${d}/pkg/a.json`, "1");
					yield* fs.symlink(`${d}/pkg`, `${d}/links`);
					assert.strictEqual(yield* fs.readFileString(`${d}/Links/A.JSON`), "1");
				}),
			),
		);

		it.effect("a link whose target text differs in case from the stored name resolves", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					const realD = yield* fs.realPath(d);
					yield* fs.makeDirectory(`${d}/pkg`);
					yield* fs.writeFileString(`${d}/pkg/a.json`, "1");
					yield* fs.symlink(`${d}/PKG`, `${d}/links`);
					assert.strictEqual(yield* fs.readFileString(`${d}/links/A.JSON`), "1");
					// The link's target text supplies its spelling; the rest stays as queried.
					assert.strictEqual(yield* fs.realPath(`${d}/links/A.JSON`), `${realD}/PKG/A.JSON`);
				}),
			),
		);

		it.effect("a link to a parent followed by folded children resolves", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					const realD = yield* fs.realPath(d);
					yield* fs.makeDirectory(`${d}/pkg`);
					yield* fs.writeFileString(`${d}/pkg/a.json`, "1");
					yield* fs.symlink(d, `${d}/links`);
					assert.strictEqual(yield* fs.readFileString(`${d}/Links/PKG/a.json`), "1");
					assert.strictEqual(yield* fs.realPath(`${d}/Links/PKG/a.json`), `${realD}/PKG/a.json`);
				}),
			),
		);

		it.effect("a symlink onto a folded existing name is AlreadyExists", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/pkg`);
					yield* fs.symlink(`${d}/pkg`, `${d}/links`);
					const error = yield* Effect.flip(fs.symlink(`${d}/pkg`, `${d}/LINKS`));
					assert.strictEqual(error.reason._tag, "AlreadyExists");
				}),
			),
		);

		it.effect("a create under a folded parent lands in the stored directory", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/Dir`);
					yield* fs.writeFileString(`${d}/dir/a.txt`, "a");
					assert.deepStrictEqual(yield* fs.readDirectory(`${d}/Dir`), ["a.txt"]);
					assert.deepStrictEqual(yield* fs.readDirectory(d), ["Dir"]);
				}),
			),
		);

		it.effect("folding is not fuzzy: a different name is still NotFound", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/Docs.json`, "{}");
					const error = yield* Effect.flip(fs.readFileString(`${d}/Doc.json`));
					assert.strictEqual(error.reason._tag, "NotFound");
				}),
			),
		);

		it.effect("copyFile onto a folded-equal entry overwrites it in place under the stored spelling", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/a.txt`, "A");
					yield* fs.writeFileString(`${d}/b.txt`, "B");
					yield* fs.copyFile(`${d}/a.txt`, `${d}/B.TXT`);
					assert.deepStrictEqual([...(yield* fs.readDirectory(d))].sort(), ["a.txt", "b.txt"]);
					assert.strictEqual(yield* fs.readFileString(`${d}/b.txt`), "A");
				}),
			),
		);

		// node's `fs.cp` unlinks a replaced destination and recreates it, so the
		// requested (or source-child) spelling wins — unlike rename and copyFile.
		it.effect("copy with overwrite onto a folded-equal file takes the requested spelling", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/a.txt`, "A");
					yield* fs.writeFileString(`${d}/b.txt`, "B");
					yield* fs.copy(`${d}/a.txt`, `${d}/B.TXT`, { overwrite: true });
					assert.deepStrictEqual([...(yield* fs.readDirectory(d))].sort(), ["B.TXT", "a.txt"]);
					assert.strictEqual(yield* fs.readFileString(`${d}/b.txt`), "A");
				}),
			),
		);

		it.effect("copy with overwrite merges into a folded directory and takes source child spellings", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/src`);
					yield* fs.writeFileString(`${d}/src/X.txt`, "new");
					yield* fs.makeDirectory(`${d}/dst`);
					yield* fs.writeFileString(`${d}/dst/x.txt`, "old");
					yield* fs.copy(`${d}/src`, `${d}/DST`, { overwrite: true });
					assert.deepStrictEqual([...(yield* fs.readDirectory(d))].sort(), ["dst", "src"]);
					assert.deepStrictEqual(yield* fs.readDirectory(`${d}/dst`), ["X.txt"]);
					assert.strictEqual(yield* fs.readFileString(`${d}/dst/x.txt`), "new");
				}),
			),
		);

		it.effect("copy merges a folded nested directory under its stored spelling", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.makeDirectory(`${d}/src/SUB`, { recursive: true });
					yield* fs.writeFileString(`${d}/src/SUB/A.txt`, "new");
					yield* fs.makeDirectory(`${d}/dst/sub`, { recursive: true });
					yield* fs.writeFileString(`${d}/dst/sub/a.txt`, "old");
					yield* fs.writeFileString(`${d}/dst/sub/keep.txt`, "k");
					yield* fs.copy(`${d}/src`, `${d}/dst`, { overwrite: true });
					assert.deepStrictEqual(yield* fs.readDirectory(`${d}/dst`), ["sub"]);
					assert.deepStrictEqual([...(yield* fs.readDirectory(`${d}/dst/sub`))].sort(), ["A.txt", "keep.txt"]);
					assert.strictEqual(yield* fs.readFileString(`${d}/dst/sub/a.txt`), "new");
				}),
			),
		);

		it.effect("remove under a folded name removes the stored entry", () =>
			run((fs, d) =>
				Effect.gen(function* () {
					yield* fs.writeFileString(`${d}/Gone.txt`, "");
					yield* fs.remove(`${d}/gone.TXT`);
					assert.deepStrictEqual(yield* fs.readDirectory(d), []);
				}),
			),
		);
	});
