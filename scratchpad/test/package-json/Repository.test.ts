// `repository`, `bugs` and `homepage` — the manifest fields a consumer reaches
// for when it needs to say where a package LIVES.
//
// The motivating evidence is silk-release-action's `infer-sbom-metadata.ts`,
// which hand-rolls `parseRepository` / `parseBugs` because this package offered
// `repository` as an untyped `Union([String, Record])` and no `bugs` at all.
// The hand-roll handles four git-URL rewrites and misses every npm shorthand
// (`github:user/repo`, bare `user/repo`), which is the "improve on it where it
// is sloppy" half of this gap-fill.
//
// Wire fidelity is the same hard requirement the rest of this package holds: a
// formatter must not rewrite one legal encoding into another, so a shorthand
// string round-trips as that exact string.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { Bugs, Person, Repository } from "../../effected/package-json/index.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

const decode = <A, I>(schema: Schema.Codec<A, I>, input: I) => Schema.decodeUnknownEffect(schema)(input);
const encode = <A, I>(schema: Schema.Codec<A, I>, value: A) => Schema.encodeUnknownEffect(schema)(value);

describe("Repository — the npm shorthands", () => {
	it.effect("a bare `user/repo` browses to GitHub", () =>
		Effect.gen(function* () {
			// The default host. `parseRepository` missed this entirely and returned
			// the string unchanged, so a consumer got `"user/repo"` where it wanted
			// a URL.
			const repo = yield* decode(Repository.FromValue, "effected/kit");
			assert.deepStrictEqual(repo.browseUrl, Option.some("https://github.com/effected/kit"));
		}),
	);

	it.effect("the host-prefixed shorthands resolve to their hosts", () =>
		Effect.gen(function* () {
			const cases = [
				["github:effected/kit", "https://github.com/effected/kit"],
				["gitlab:effected/kit", "https://gitlab.com/effected/kit"],
				["bitbucket:effected/kit", "https://bitbucket.org/effected/kit"],
				["gist:abc123def", "https://gist.github.com/abc123def"],
			] as const;
			for (const [input, expected] of cases) {
				const repo = yield* decode(Repository.FromValue, input);
				assert.deepStrictEqual(repo.browseUrl, Option.some(expected), input);
			}
		}),
	);
});

describe("Repository — git URL normalization", () => {
	it.effect("normalizes every form the hand-roll handled", () =>
		Effect.gen(function* () {
			const cases = [
				"git+https://github.com/effected/kit.git",
				"git://github.com/effected/kit.git",
				"git@github.com:effected/kit.git",
				"https://github.com/effected/kit.git",
				"https://github.com/effected/kit",
			] as const;
			for (const input of cases) {
				const repo = yield* decode(Repository.FromValue, input);
				assert.deepStrictEqual(repo.browseUrl, Option.some("https://github.com/effected/kit"), input);
			}
		}),
	);

	it.effect("handles the `git+ssh://` form the hand-roll missed", () =>
		Effect.gen(function* () {
			// `git+ssh://git@github.com/u/r.git` survived `parseRepository` with its
			// scheme intact, because the `git@host:` rewrite only matched the scp
			// form.
			const repo = yield* decode(Repository.FromValue, "git+ssh://git@github.com/effected/kit.git");
			assert.deepStrictEqual(repo.browseUrl, Option.some("https://github.com/effected/kit"));
		}),
	);

	it.effect("a non-GitHub host keeps its host", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, "git@git.example.com:team/thing.git");
			assert.deepStrictEqual(repo.browseUrl, Option.some("https://git.example.com/team/thing"));
		}),
	);

	it.effect("`gitUrl` is the canonical clone URL", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, "git@github.com:effected/kit.git");
			assert.deepStrictEqual(repo.gitUrl, Option.some("https://github.com/effected/kit.git"));
		}),
	);

	it.effect("an underivable url yields None rather than a guess", () =>
		Effect.gen(function* () {
			// Total by construction: `repository` is caller data, and a value we
			// cannot interpret is a missing answer, not a failure — the same
			// posture the rest of the kit takes on absence.
			const repo = yield* decode(Repository.FromValue, "not a url at all");
			assert.isTrue(Option.isNone(repo.browseUrl));
			assert.isTrue(Option.isNone(repo.gitUrl));
			// The raw value is still there for a caller that knows better.
			assert.strictEqual(repo.url, "not a url at all");
		}),
	);
});

describe("Repository — the object form", () => {
	it.effect("reads type, url and directory", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, {
				type: "git",
				url: "git+https://github.com/effected/kit.git",
				directory: "packages/package-json",
			});
			assert.strictEqual(repo.type, "git");
			assert.strictEqual(repo.directory, "packages/package-json");
			assert.deepStrictEqual(repo.browseUrl, Option.some("https://github.com/effected/kit"));
		}),
	);

	it.effect("keeps unknown keys instead of dropping them", () =>
		Effect.gen(function* () {
			const wire = { type: "git", url: "https://github.com/effected/kit", custom: "keep me" };
			const repo = yield* decode(Repository.FromValue, wire);
			const encoded = yield* encode(Repository.FromValue, repo);
			assert.deepStrictEqual<unknown>(encoded, wire);
		}),
	);
});

describe("Repository — wire fidelity", () => {
	it.effect("a shorthand string re-encodes as that exact string", () =>
		Effect.gen(function* () {
			// The load-bearing property: formatting a manifest must not rewrite
			// `"effected/kit"` into `{ "url": "effected/kit" }`.
			for (const input of ["effected/kit", "github:effected/kit", "git@github.com:effected/kit.git"]) {
				const repo = yield* decode(Repository.FromValue, input);
				const encoded = yield* encode(Repository.FromValue, repo);
				assert.strictEqual(encoded, input, input);
			}
		}),
	);

	it.effect("an object re-encodes as an object", () =>
		Effect.gen(function* () {
			const wire = { type: "git", url: "https://github.com/effected/kit" };
			const encoded = yield* encode(Repository.FromValue, yield* decode(Repository.FromValue, wire));
			assert.deepStrictEqual<unknown>(encoded, wire);
		}),
	);

	it.effect("a STALE wire is not replayed once the url no longer matches", () =>
		Effect.gen(function* () {
			// `Schema.Class` instances are not frozen at runtime (probed), so a
			// mutated instance keeps its provenance entry while no longer being
			// described by it. Without the url check on the replay, this re-encodes
			// as the ORIGINAL shorthand and silently writes the wrong repository
			// back to the manifest. Found by a surviving mutant — the guard was
			// there, the test was not.
			const repo = yield* decode(Repository.FromValue, "effected/kit");
			(repo as { url: string }).url = "effected/other";
			const encoded = yield* encode(Repository.FromValue, repo);
			assert.notStrictEqual(encoded, "effected/kit");
			assert.deepStrictEqual<unknown>(encoded, { url: "effected/other" });
		}),
	);

	it.effect("a hand-built repository encodes canonically as an object", () =>
		Effect.gen(function* () {
			// No provenance to replay, so the canonical form is the honest answer —
			// the `Person` precedent exactly.
			const repo = Repository.make({ url: "https://github.com/effected/kit" });
			const encoded = yield* encode(Repository.FromValue, repo);
			assert.deepStrictEqual<unknown>(encoded, { url: "https://github.com/effected/kit" });
		}),
	);
});

describe("Bugs", () => {
	it.effect("a string is the issue-tracker url", () =>
		Effect.gen(function* () {
			const bugs = yield* decode(Bugs.FromValue, "https://github.com/effected/kit/issues");
			assert.strictEqual(bugs.url, "https://github.com/effected/kit/issues");
			assert.isUndefined(bugs.email);
		}),
	);

	it.effect("the object form carries url and email", () =>
		Effect.gen(function* () {
			const bugs = yield* decode(Bugs.FromValue, {
				url: "https://github.com/effected/kit/issues",
				email: "bugs@example.com",
			});
			assert.strictEqual(bugs.url, "https://github.com/effected/kit/issues");
			assert.strictEqual(bugs.email, "bugs@example.com");
		}),
	);

	it.effect("an email-only object is legal — npm permits it", () =>
		Effect.gen(function* () {
			const bugs = yield* decode(Bugs.FromValue, { email: "bugs@example.com" });
			assert.isUndefined(bugs.url);
			assert.strictEqual(bugs.email, "bugs@example.com");
		}),
	);

	it.effect("a string round-trips as a string", () =>
		Effect.gen(function* () {
			const input = "https://github.com/effected/kit/issues";
			const encoded = yield* encode(Bugs.FromValue, yield* decode(Bugs.FromValue, input));
			assert.strictEqual(encoded, input);
		}),
	);
});

describe("Repository — directoryUrl", () => {
	it.effect("descends into `directory` on each host it knows", () =>
		Effect.gen(function* () {
			// The motivating case: every member of a monorepo has the same
			// `url` and differs only by `directory`, so `browseUrl` reports one
			// location for all of them.
			const cases = [
				["effected/kit", "https://github.com/effected/kit/tree/HEAD/packages/spdx"],
				["gitlab:effected/kit", "https://gitlab.com/effected/kit/-/tree/HEAD/packages/spdx"],
				["bitbucket:effected/kit", "https://bitbucket.org/effected/kit/src/HEAD/packages/spdx"],
			] as const;
			for (const [url, expected] of cases) {
				const repo = yield* decode(Repository.FromValue, { url, directory: "packages/spdx" });
				assert.deepStrictEqual(repo.directoryUrl, Option.some(expected), url);
			}
		}),
	);

	it.effect("two members of one repository get two different URLs", () =>
		Effect.gen(function* () {
			// The property the consumer actually depends on: this is the field a
			// crawler uses to tell two packages apart.
			const spdx = yield* decode(Repository.FromValue, { url: "effected/kit", directory: "packages/spdx" });
			const glob = yield* decode(Repository.FromValue, { url: "effected/kit", directory: "packages/glob" });
			assert.notDeepEqual(spdx.directoryUrl, glob.directoryUrl);
			assert.deepStrictEqual(spdx.browseUrl, glob.browseUrl);
		}),
	);

	it.effect("without `directory` the package is the root, and that is an answer", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, "effected/kit");
			assert.deepStrictEqual(repo.directoryUrl, Option.some("https://github.com/effected/kit"));
			assert.deepStrictEqual(repo.directoryUrl, repo.browseUrl);
		}),
	);

	it.effect("a `directory` naming the root itself is the root", () =>
		Effect.gen(function* () {
			for (const directory of [".", "/", "", "./"]) {
				const repo = yield* decode(Repository.FromValue, { url: "effected/kit", directory });
				assert.deepStrictEqual(repo.directoryUrl, Option.some("https://github.com/effected/kit"), directory);
			}
		}),
	);

	it.effect("an unknown host yields none rather than the repository root", () =>
		Effect.gen(function* () {
			// The whole point: falling back to `browseUrl` here would hand back
			// the repository root for a package that does not live there, and it
			// would look like a real answer.
			const repo = yield* decode(Repository.FromValue, {
				url: "https://git.example.com/team/thing",
				directory: "packages/spdx",
			});
			assert.deepStrictEqual(repo.browseUrl, Option.some("https://git.example.com/team/thing"));
			assert.isTrue(Option.isNone(repo.directoryUrl));
		}),
	);

	it.effect("a gist has no subdirectories to descend into", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, { url: "gist:abc123def", directory: "packages/spdx" });
			assert.isTrue(Option.isNone(repo.directoryUrl));
		}),
	);

	it.effect("a `directory` that climbs out of the repository is refused", () =>
		Effect.gen(function* () {
			for (const directory of ["../elsewhere", "packages/../../elsewhere", ".."]) {
				const repo = yield* decode(Repository.FromValue, { url: "effected/kit", directory });
				assert.isTrue(Option.isNone(repo.directoryUrl), directory);
			}
		}),
	);

	it.effect("segments are percent-encoded, and separators survive", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, {
				url: "effected/kit",
				directory: "packages/my package",
			});
			assert.deepStrictEqual(
				repo.directoryUrl,
				Option.some("https://github.com/effected/kit/tree/HEAD/packages/my%20package"),
			);
		}),
	);

	it.effect("an uninterpretable url stays uninterpretable", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, { url: "", directory: "packages/spdx" });
			assert.isTrue(Option.isNone(repo.directoryUrl));
		}),
	);

	it.effect("reading directoryUrl does not rewrite the field", () =>
		Effect.gen(function* () {
			// Wire fidelity holds for the derived getters, same as browseUrl.
			const input = { url: "effected/kit", directory: "packages/spdx" };
			const repo = yield* decode(Repository.FromValue, input);
			assert.isTrue(Option.isSome(repo.directoryUrl));
			assert.deepStrictEqual(yield* encode(Repository.FromValue, repo), input);
		}),
	);
});

describe("Repository and Bugs — the object wire is replayed only while it is faithful", () => {
	// `Person` has always guarded this; `Repository` and `Bugs` replayed the
	// remembered object unconditionally, so an instance edited after decoding
	// re-encoded as the stale original and the edit vanished with no error.
	// Wire fidelity means "do not rewrite one legal encoding into another", not
	// "write back whatever was read".

	it.effect("an edited url does not re-encode as the original", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, { type: "git", url: "effected/kit" });
			(repo as { url: string }).url = "effected/other";
			assert.deepStrictEqual(yield* encode(Repository.FromValue, repo), {
				type: "git",
				url: "effected/other",
			});
		}),
	);

	it.effect("an edited directory does not re-encode as the original", () =>
		Effect.gen(function* () {
			// The field item 6 exists to read — a stale replay here would hand
			// back a directoryUrl for the wrong package.
			const repo = yield* decode(Repository.FromValue, { url: "effected/kit", directory: "packages/spdx" });
			(repo as { directory: string }).directory = "packages/glob";
			assert.deepStrictEqual(yield* encode(Repository.FromValue, repo), {
				url: "effected/kit",
				directory: "packages/glob",
			});
		}),
	);

	it.effect("an unedited object still replays verbatim, key order and all", () =>
		Effect.gen(function* () {
			// The guard must not cost the fidelity it protects: an untouched
			// value re-encodes as the exact bytes it was read from.
			const input = { type: "git", url: "git+https://github.com/effected/kit.git", directory: "packages/spdx" };
			const repo = yield* decode(Repository.FromValue, input);
			const encoded = yield* encode(Repository.FromValue, repo);
			assert.deepStrictEqual(encoded, input);
			assert.strictEqual((yield* Schema.encodeEffect(Json)(encoded)), (yield* Schema.encodeEffect(Json)(input)));
		}),
	);

	it.effect("an unknown key survives an unrelated edit", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, { url: "effected/kit", homepage: "https://example.com" });
			(repo as { url: string }).url = "effected/other";
			assert.deepStrictEqual(yield* encode(Repository.FromValue, repo), {
				url: "effected/other",
				homepage: "https://example.com",
			});
		}),
	);

	it.effect("Bugs: an edited url does not re-encode as the original", () =>
		Effect.gen(function* () {
			const bugs = yield* decode(Bugs.FromValue, { url: "https://example.com/a" });
			(bugs as { url?: string }).url = "https://example.com/b";
			assert.deepStrictEqual(yield* encode(Bugs.FromValue, bugs), { url: "https://example.com/b" });
		}),
	);

	it.effect("Bugs: an edited email does not re-encode as the original", () =>
		Effect.gen(function* () {
			const bugs = yield* decode(Bugs.FromValue, { email: "old@example.com" });
			(bugs as { email?: string }).email = "new@example.com";
			assert.deepStrictEqual(yield* encode(Bugs.FromValue, bugs), { email: "new@example.com" });
		}),
	);

	it.effect("Bugs: an unedited object still replays verbatim", () =>
		Effect.gen(function* () {
			const input = { url: "https://github.com/effected/kit/issues", email: "bugs@example.com" };
			const bugs = yield* decode(Bugs.FromValue, input);
			assert.deepStrictEqual(yield* encode(Bugs.FromValue, bugs), input);
		}),
	);

	it.effect("CONTROL — Person, which has always guarded this, behaves identically", () =>
		Effect.gen(function* () {
			// If this control ever fails, the bug is in the shared understanding
			// of provenance, not in the two classes being fixed here.
			const person = yield* decode(Person.FromValue, { name: "Ada", email: "ada@example.com" });
			(person as { name: string }).name = "Grace";
			assert.deepStrictEqual(yield* encode(Person.FromValue, person), {
				name: "Grace",
				email: "ada@example.com",
			});
		}),
	);
});

describe("Repository and Bugs — the shorthand is replayed only while it can carry the value", () => {
	// The object branch's stale-replay guard has a twin on the string branch, and
	// it fails differently: the shorthand has no SYNTAX for `type`, `directory`
	// or an unknown key, so a value that gains one is no longer describable by
	// the wire it remembers. Replaying it drops the addition with no error.
	// `Person` and `Funding` already gate their string branches this way.

	it.effect("a directory added to a string-decoded repository is not dropped", () =>
		Effect.gen(function* () {
			// The live case: this package ships `directoryUrl`, so making a
			// bare-string repository into a monorepo member is the natural edit.
			const repo = yield* decode(Repository.FromValue, "effected/kit");
			(repo as { directory?: string }).directory = "packages/spdx";
			assert.deepStrictEqual(yield* encode(Repository.FromValue, repo), {
				url: "effected/kit",
				directory: "packages/spdx",
			});
		}),
	);

	it.effect("a type added to a string-decoded repository is not dropped", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, "effected/kit");
			(repo as { type?: string }).type = "git";
			assert.deepStrictEqual(yield* encode(Repository.FromValue, repo), { type: "git", url: "effected/kit" });
		}),
	);

	it.effect("an unknown key added to a string-decoded repository is not dropped", () =>
		Effect.gen(function* () {
			const repo = yield* decode(Repository.FromValue, "effected/kit");
			(repo as { rest?: Record<string, unknown> }).rest = { homepage: "https://example.com" };
			assert.deepStrictEqual(yield* encode(Repository.FromValue, repo), {
				url: "effected/kit",
				homepage: "https://example.com",
			});
		}),
	);

	it.effect("an untouched shorthand still replays verbatim", () =>
		Effect.gen(function* () {
			// The guard must not cost the fidelity it protects: a value the
			// shorthand CAN still carry re-encodes as that exact string.
			for (const input of ["effected/kit", "github:effected/kit", "git@github.com:effected/kit.git"]) {
				const repo = yield* decode(Repository.FromValue, input);
				assert.strictEqual(yield* encode(Repository.FromValue, repo), input, input);
			}
		}),
	);

	it.effect("Bugs: an unknown key added to a string-decoded entry is not dropped", () =>
		Effect.gen(function* () {
			const bugs = yield* decode(Bugs.FromValue, "https://example.com/issues");
			(bugs as { rest?: Record<string, unknown> }).rest = { tracker: "linear" };
			assert.deepStrictEqual(yield* encode(Bugs.FromValue, bugs), {
				url: "https://example.com/issues",
				tracker: "linear",
			});
		}),
	);

	it.effect("Bugs: an email added to a string-decoded entry is still not dropped", () =>
		Effect.gen(function* () {
			// This half was already guarded; it is kept so a future rewrite of the
			// predicate cannot quietly drop the clause that was already correct.
			const bugs = yield* decode(Bugs.FromValue, "https://example.com/issues");
			(bugs as { email?: string }).email = "bugs@example.com";
			assert.deepStrictEqual(yield* encode(Bugs.FromValue, bugs), {
				url: "https://example.com/issues",
				email: "bugs@example.com",
			});
		}),
	);

	it.effect("Bugs: an untouched string still replays verbatim", () =>
		Effect.gen(function* () {
			const input = "https://example.com/issues";
			const bugs = yield* decode(Bugs.FromValue, input);
			assert.strictEqual(yield* encode(Bugs.FromValue, bugs), input);
		}),
	);
});
