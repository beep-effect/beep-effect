import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Bugs, Person, Repository } from "@beep/package-json";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const Json = S.fromJsonString(S.Unknown);

const decode = <A, I>(schema: S.Codec<A, I>, input: I) => S.decodeUnknownEffect(schema)(input);
const encode = <A, I>(schema: S.Codec<A, I>, value: A) => S.encodeUnknownEffect(schema)(value);

describe("Repository and Bugs — own __proto__ extension fidelity", () => {
  for (const codec of [Repository.FromValue, Bugs.FromValue]) {
    it.effect(`${codec === Repository.FromValue ? "Repository" : "Bugs"}: an own data key survives a URL edit`, () =>
      Effect.gen(function* () {
        const json = S.fromJsonString(S.Record(S.String, S.Unknown));
        const text = '{"url":"https://old.example","__proto__":{"keep":1},"tracker":"linear"}';
        const input = yield* S.decodeEffect(json)(text);
        assert.isTrue(R.has(input, "__proto__"));
        const value = yield* S.decodeEffect(codec)(input);
        const rest = value.rest;
        assertDefined(rest);
        assert.isTrue(R.has(rest, "__proto__"));
        assert.deepStrictEqual(R.get(rest, "__proto__"), O.some({ keep: 1 }));
        assert.strictEqual(Object.getPrototypeOf(rest), Object.prototype);
        assert.deepStrictEqual(R.keys(rest), ["__proto__", "tracker"]);
        const argument = S.encodeUnknownEffect(json);
        const value2 = yield* S.encodeUnknownEffect(codec)(value);
        const value1 = yield* argument(value2);
        assert.strictEqual(value1, text);
        Object.assign(value, { url: "https://new.example" });
        const encoded = yield* S.encodeUnknownEffect(codec)(value);
        assertTrue(P.isObject(encoded));
        assert.isTrue(R.has(encoded, "__proto__"));
        assert.deepStrictEqual(R.get(encoded, "__proto__"), O.some({ keep: 1 }));
        assert.strictEqual(Object.getPrototypeOf(encoded), Object.prototype);
        assert.deepStrictEqual(encoded, { ...input, url: "https://new.example" });
      })
    );
  }
});

describe("Repository — the npm shorthands", () => {
  it.effect("a bare `user/repo` browses to GitHub", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "effected/kit");
      assert.deepStrictEqual(
        repo.browseUrl,
        O.some("https://github.com/effected/kit"),
        "GitHub is the default host: a bare user/repo must become a URL, not stay the raw string"
      );
    })
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
        assert.deepStrictEqual(repo.browseUrl, O.some(expected), input);
      }
    })
  );
});

describe("Repository — git URL normalization", () => {
  it.effect("normalizes every form the hand-roll handled", () =>
    Effect.gen(function* () {
      const cases = [
        "git+https://github.com/effected/kit.git",
        "git://github.com/effected/kit.git",
        "git@github.com:effected/kit.git",
        "github.com:effected/kit.git",
        "https://github.com/effected/kit.git",
        "https://github.com/effected/kit",
      ] as const;
      for (const input of cases) {
        const repo = yield* decode(Repository.FromValue, input);
        assert.deepStrictEqual(repo.browseUrl, O.some("https://github.com/effected/kit"), input);
      }
    })
  );

  it.effect("handles the `git+ssh://` form the hand-roll missed", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "git+ssh://git@github.com/effected/kit.git");
      assert.deepStrictEqual(
        repo.browseUrl,
        O.some("https://github.com/effected/kit"),
        "the scheme must be stripped too: a git@host: rewrite alone matches only the scp form"
      );
    })
  );

  it.effect("a non-GitHub host keeps its host", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "git@git.example.com:team/thing.git");
      assert.deepStrictEqual(repo.browseUrl, O.some("https://git.example.com/team/thing"));
    })
  );

  it.effect("`gitUrl` is the canonical clone URL", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "git@github.com:effected/kit.git");
      assert.deepStrictEqual(repo.gitUrl, O.some("https://github.com/effected/kit.git"));
    })
  );

  it.effect("an underivable url yields None rather than a guess: a missing answer, not a decode failure", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "not a url at all");
      assertNone(repo.browseUrl);
      assertNone(repo.gitUrl);
      assert.strictEqual(repo.url, "not a url at all", "the raw value stays for a caller that knows better");
    })
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
      assert.deepStrictEqual(repo.browseUrl, O.some("https://github.com/effected/kit"));
    })
  );

  it.effect("keeps unknown keys instead of dropping them", () =>
    Effect.gen(function* () {
      const wire = { type: "git", url: "https://github.com/effected/kit", custom: "keep me" };
      const repo = yield* decode(Repository.FromValue, wire);
      const encoded = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual<unknown>(encoded, wire);
    })
  );
});

describe("Repository — wire fidelity", () => {
  it.effect("a shorthand string re-encodes as that exact string", () =>
    Effect.gen(function* () {
      for (const input of ["effected/kit", "github:effected/kit", "git@github.com:effected/kit.git"]) {
        const repo = yield* decode(Repository.FromValue, input);
        const encoded = yield* encode(Repository.FromValue, repo);
        assert.strictEqual(encoded, input, `${input}: formatting must not rewrite a shorthand into { url }`);
      }
    })
  );

  it.effect("an object re-encodes as an object", () =>
    Effect.gen(function* () {
      const wire = { type: "git", url: "https://github.com/effected/kit" };
      const decoded2 = yield* decode(Repository.FromValue, wire);
      const encoded = yield* encode(Repository.FromValue, decoded2);
      assert.deepStrictEqual<unknown>(encoded, wire);
    })
  );

  it.effect("a STALE wire is not replayed once the url no longer matches", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "effected/kit");
      Object.assign(repo, { url: "effected/other" } satisfies Partial<Repository>);
      const encoded = yield* encode(Repository.FromValue, repo);
      assert.notStrictEqual(
        encoded,
        "effected/kit",
        "Schema.Class instances are not frozen, so the replay must check the url or write the wrong repository"
      );
      assert.deepStrictEqual<unknown>(encoded, { url: "effected/other" });
    })
  );

  it.effect("a hand-built repository encodes canonically as an object", () =>
    Effect.gen(function* () {
      const repo = Repository.make({ url: "https://github.com/effected/kit" });
      const encoded = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual<unknown>(
        encoded,
        { url: "https://github.com/effected/kit" },
        "no provenance to replay, so the canonical object form, as Person does"
      );
    })
  );
});

describe("Bugs", () => {
  it.effect("a string is the issue-tracker url", () =>
    Effect.gen(function* () {
      const bugs = yield* decode(Bugs.FromValue, "https://github.com/effected/kit/issues");
      assert.strictEqual(bugs.url, "https://github.com/effected/kit/issues");
      assert.isUndefined(bugs.email);
    })
  );

  it.effect("the object form carries url and email", () =>
    Effect.gen(function* () {
      const bugs = yield* decode(Bugs.FromValue, {
        url: "https://github.com/effected/kit/issues",
        email: "bugs@example.com",
      });
      assert.strictEqual(bugs.url, "https://github.com/effected/kit/issues");
      assert.strictEqual(bugs.email, "bugs@example.com");
    })
  );

  it.effect("an email-only object is legal — npm permits it", () =>
    Effect.gen(function* () {
      const bugs = yield* decode(Bugs.FromValue, { email: "bugs@example.com" });
      assert.isUndefined(bugs.url);
      assert.strictEqual(bugs.email, "bugs@example.com");
    })
  );

  it.effect("a string round-trips as a string", () =>
    Effect.gen(function* () {
      const input = "https://github.com/effected/kit/issues";
      const decoded3 = yield* decode(Bugs.FromValue, input);
      const encoded = yield* encode(Bugs.FromValue, decoded3);
      assert.strictEqual(encoded, input);
    })
  );
});

describe("Repository — directoryUrl", () => {
  it.effect("descends into `directory` on each host it knows", () =>
    Effect.gen(function* () {
      const cases = [
        ["effected/kit", "https://github.com/effected/kit/tree/HEAD/packages/spdx"],
        ["gitlab:effected/kit", "https://gitlab.com/effected/kit/-/tree/HEAD/packages/spdx"],
        ["bitbucket:effected/kit", "https://bitbucket.org/effected/kit/src/HEAD/packages/spdx"],
      ] as const;
      for (const [url, expected] of cases) {
        const repo = yield* decode(Repository.FromValue, { url, directory: "packages/spdx" });
        assert.deepStrictEqual(
          repo.directoryUrl,
          O.some(expected),
          `${url}: monorepo members share one url and differ only by directory, so browseUrl cannot tell them apart`
        );
      }
    })
  );

  it.effect("two members of one repository get two different URLs", () =>
    Effect.gen(function* () {
      const spdx = yield* decode(Repository.FromValue, { url: "effected/kit", directory: "packages/spdx" });
      const glob = yield* decode(Repository.FromValue, { url: "effected/kit", directory: "packages/glob" });
      assert.notDeepEqual(spdx.directoryUrl, glob.directoryUrl, "a crawler tells two packages apart by this field");
      assert.deepStrictEqual(spdx.browseUrl, glob.browseUrl);
    })
  );

  it.effect("without `directory` the package is the root, and that is an answer", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "effected/kit");
      assert.deepStrictEqual(repo.directoryUrl, O.some("https://github.com/effected/kit"));
      assert.deepStrictEqual(repo.directoryUrl, repo.browseUrl);
    })
  );

  it.effect("a `directory` naming the root itself is the root", () =>
    Effect.gen(function* () {
      for (const directory of [".", "/", "", "./"]) {
        const repo = yield* decode(Repository.FromValue, { url: "effected/kit", directory });
        assert.deepStrictEqual(repo.directoryUrl, O.some("https://github.com/effected/kit"), directory);
      }
    })
  );

  it.effect("an unknown host yields a none directoryUrl, not the repository root posing as a real answer", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, {
        url: "https://git.example.com/team/thing",
        directory: "packages/spdx",
      });
      assert.deepStrictEqual(repo.browseUrl, O.some("https://git.example.com/team/thing"));
      assertNone(repo.directoryUrl);
    })
  );

  it.effect("a gist has no subdirectories to descend into", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, { url: "gist:abc123def", directory: "packages/spdx" });
      assertNone(repo.directoryUrl);
    })
  );

  it.effect("a `directory` that climbs out of the repository is refused", () =>
    Effect.gen(function* () {
      for (const directory of ["../elsewhere", "packages/../../elsewhere", ".."]) {
        const repo = yield* decode(Repository.FromValue, { url: "effected/kit", directory });
        assertNone(repo.directoryUrl);
      }
    })
  );

  it.effect("segments are percent-encoded, and separators survive", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, {
        url: "effected/kit",
        directory: "packages/my package",
      });
      assert.deepStrictEqual(
        repo.directoryUrl,
        O.some("https://github.com/effected/kit/tree/HEAD/packages/my%20package")
      );
    })
  );

  it.effect("a lone UTF-16 surrogate yields none without changing the wire", () =>
    Effect.gen(function* () {
      const codec = S.fromJsonString(Repository.FromValue);
      for (const text of [
        '{"url":"github:owner/repo","directory":"src/\\ud800","tracker":"linear"}',
        '{"url":"github:owner/repo","directory":"src/\\udfff/tail","tracker":"linear"}',
      ]) {
        const input = yield* decode(Json, text);
        const repo = yield* decode(codec, text);
        assert.instanceOf(repo, Repository);
        assert.doesNotThrow(() => assertNone(repo.directoryUrl));
        const encoded4 = yield* encode(Repository.FromValue, repo);
        assert.deepStrictEqual(encoded4, input);
        const encoded = yield* encode(codec, repo);
        assert.strictEqual(encoded, text);
        const roundTripped = yield* decode(codec, encoded);
        assert.strictEqual(roundTripped.directory, repo.directory);
        assertNone(roundTripped.directoryUrl);
        const encoded5 = yield* encode(codec, roundTripped);
        assert.strictEqual(encoded5, text);
      }
    })
  );

  it.effect("an uninterpretable url stays uninterpretable", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, { url: "", directory: "packages/spdx" });
      assertNone(repo.directoryUrl);
    })
  );

  it.effect("reading directoryUrl does not rewrite the field", () =>
    Effect.gen(function* () {
      const input = { url: "effected/kit", directory: "packages/spdx" };
      const repo = yield* decode(Repository.FromValue, input);
      assertSome(repo.directoryUrl, O.getOrThrow(repo.directoryUrl));
      const encoded6 = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(encoded6, input, "wire fidelity holds for the derived getters, as for browseUrl");
    })
  );
});

describe("Repository and Bugs — the object wire is replayed only while it is faithful", () => {
  it.effect("an edited url does not re-encode as the original", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, { type: "git", url: "effected/kit" });
      Object.assign(repo, { url: "effected/other" } satisfies Partial<Repository>);
      const encoded7 = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(
        encoded7,
        {
          type: "git",
          url: "effected/other",
        },
        "wire fidelity forbids rewriting one legal encoding into another, not an edit: replay is not write-back"
      );
    })
  );

  it.effect("an edited directory does not re-encode as the original", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, { url: "effected/kit", directory: "packages/spdx" });
      Object.assign(repo, { directory: "packages/glob" } satisfies Partial<Repository>);
      const encoded8 = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(
        encoded8,
        {
          url: "effected/kit",
          directory: "packages/glob",
        },
        "a stale replay would hand back a directoryUrl for the wrong package"
      );
    })
  );

  it.effect("an unedited object still replays verbatim, key order and all", () =>
    Effect.gen(function* () {
      const input = { type: "git", url: "git+https://github.com/effected/kit.git", directory: "packages/spdx" };
      const repo = yield* decode(Repository.FromValue, input);
      const encoded = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(encoded, input);
      const value9 = yield* S.encodeEffect(Json)(encoded);
      const value23 = yield* S.encodeEffect(Json)(input);
      assert.strictEqual(value9, value23, "the guard must not cost the fidelity it protects: same bytes as read");
    })
  );

  it.effect("an unknown key survives an unrelated edit", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, { url: "effected/kit", homepage: "https://example.com" });
      Object.assign(repo, { url: "effected/other" } satisfies Partial<Repository>);
      const encoded10 = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(encoded10, {
        url: "effected/other",
        homepage: "https://example.com",
      });
    })
  );

  it.effect("Bugs: an edited url does not re-encode as the original", () =>
    Effect.gen(function* () {
      const bugs = yield* decode(Bugs.FromValue, { url: "https://example.com/a" });
      Object.assign(bugs, { url: "https://example.com/b" } satisfies Partial<Bugs>);
      const encoded11 = yield* encode(Bugs.FromValue, bugs);
      assert.deepStrictEqual(encoded11, { url: "https://example.com/b" });
    })
  );

  it.effect("Bugs: an edited email does not re-encode as the original", () =>
    Effect.gen(function* () {
      const bugs = yield* decode(Bugs.FromValue, { email: "old@example.com" });
      Object.assign(bugs, { email: "new@example.com" } satisfies Partial<Bugs>);
      const encoded12 = yield* encode(Bugs.FromValue, bugs);
      assert.deepStrictEqual(encoded12, { email: "new@example.com" });
    })
  );

  it.effect("Bugs: an unedited object still replays verbatim", () =>
    Effect.gen(function* () {
      const input = { url: "https://github.com/effected/kit/issues", email: "bugs@example.com" };
      const bugs = yield* decode(Bugs.FromValue, input);
      const encoded13 = yield* encode(Bugs.FromValue, bugs);
      assert.deepStrictEqual(encoded13, input);
    })
  );

  it.effect("CONTROL — Person, which has always guarded this, behaves identically", () =>
    Effect.gen(function* () {
      const person = yield* decode(Person.FromValue, { name: "Ada", email: "ada@example.com" });
      Object.assign(person, { name: "Grace" } satisfies Partial<Person>);
      const encoded14 = yield* encode(Person.FromValue, person);
      assert.deepStrictEqual(
        encoded14,
        {
          name: "Grace",
          email: "ada@example.com",
        },
        "a failing control puts the bug in the shared provenance model, not in Repository or Bugs"
      );
    })
  );
});

describe("Repository and Bugs — the shorthand is replayed only while it can carry the value", () => {
  it.effect("a directory added to a string-decoded repository is not dropped (the monorepo-member edit)", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "effected/kit");
      Object.assign(repo, { directory: "packages/spdx" } satisfies Partial<Repository>);
      const encoded15 = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(
        encoded15,
        {
          url: "effected/kit",
          directory: "packages/spdx",
        },
        "the shorthand has no syntax for directory, so replaying it would drop the addition silently"
      );
    })
  );

  it.effect("a type added to a string-decoded repository is not dropped", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "effected/kit");
      Object.assign(repo, { type: "git" } satisfies Partial<Repository>);
      const encoded16 = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(
        encoded16,
        { type: "git", url: "effected/kit" },
        "the shorthand has no syntax for type, so replaying it would drop the addition silently"
      );
    })
  );

  it.effect("an unknown key added to a string-decoded repository is not dropped", () =>
    Effect.gen(function* () {
      const repo = yield* decode(Repository.FromValue, "effected/kit");
      Object.assign(repo, { rest: { homepage: "https://example.com" } } satisfies Partial<Repository>);
      const encoded17 = yield* encode(Repository.FromValue, repo);
      assert.deepStrictEqual(
        encoded17,
        {
          url: "effected/kit",
          homepage: "https://example.com",
        },
        "the shorthand has no syntax for an unknown key, so replaying it would drop the addition silently"
      );
    })
  );

  it.effect("an untouched shorthand still replays verbatim", () =>
    Effect.gen(function* () {
      for (const input of ["effected/kit", "github:effected/kit", "git@github.com:effected/kit.git"]) {
        const repo = yield* decode(Repository.FromValue, input);
        const encoded18 = yield* encode(Repository.FromValue, repo);
        assert.strictEqual(encoded18, input, `${input}: the guard must not cost the fidelity it protects`);
      }
    })
  );

  it.effect("Bugs: an unknown key added to a string-decoded entry is not dropped", () =>
    Effect.gen(function* () {
      const bugs = yield* decode(Bugs.FromValue, "https://example.com/issues");
      Object.assign(bugs, { rest: { tracker: "linear" } } satisfies Partial<Bugs>);
      const encoded19 = yield* encode(Bugs.FromValue, bugs);
      assert.deepStrictEqual(encoded19, {
        url: "https://example.com/issues",
        tracker: "linear",
      });
    })
  );

  it.effect("Bugs: an email added to a string-decoded entry is still not dropped", () =>
    Effect.gen(function* () {
      const bugs = yield* decode(Bugs.FromValue, "https://example.com/issues");
      Object.assign(bugs, { email: "bugs@example.com" } satisfies Partial<Bugs>);
      const encoded20 = yield* encode(Bugs.FromValue, bugs);
      assert.deepStrictEqual(
        encoded20,
        {
          url: "https://example.com/issues",
          email: "bugs@example.com",
        },
        "a rewrite of the replay predicate must keep the email clause"
      );
    })
  );

  it.effect("Bugs: an untouched string still replays verbatim", () =>
    Effect.gen(function* () {
      const input = "https://example.com/issues";
      const bugs = yield* decode(Bugs.FromValue, input);
      const encoded21 = yield* encode(Bugs.FromValue, bugs);
      assert.strictEqual(encoded21, input);
    })
  );
});

describe("Bugs shorthand property", () => {
  it.effect.prop(
    "a generated bugs string decodes to its url and re-encodes as the same string",
    [S.String],
    ([url]) =>
      Effect.gen(function* () {
        const bugs = yield* S.decodeEffect(Bugs.FromValue)(url);
        assert.strictEqual(bugs.url, url);
        const value22 = yield* S.encodeEffect(Bugs.FromValue)(bugs);
        assert.strictEqual(value22, url);
      }),
    { arbitrary: fcRuns(50) }
  );
});
