import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { LenientManifest } from "@beep/package-json/LenientManifest";
import { Package } from "@beep/package-json/Package";
import { Bugs, Repository } from "@beep/package-json/Repository";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

describe("repository permissive shapes", () => {
  it.effect("an empty authority and an authority-less path have no browsable directory", () =>
    Effect.sync(() => {
      assertNone(Repository.make({ url: "https://" }).browseUrl);
      assertNone(Repository.make({ url: "https:///owner/repo", directory: "src" }).directoryUrl);
      assertNone(Repository.make({ url: "https://git@" }).browseUrl);
    })
  );
  it.effect("a missing or malformed known repository key fails the decode instead of being rewritten", () =>
    Effect.gen(function* () {
      for (const wire of [
        { type: "git" },
        { url: 123, custom: true },
        { url: "effected/kit", type: 1 },
        { url: "effected/kit", directory: ["packages"] },
      ]) {
        const error = yield* Effect.flip(S.decodeEffect(Repository.FromValue)(wire));
        assert.strictEqual(error._tag, "SchemaError");
      }
    })
  );
  it.effect("malformed known bugs keys fail the decode instead of being dropped", () =>
    Effect.gen(function* () {
      for (const wire of [
        { email: 123, url: "https://issues.dev" },
        { url: 42 },
        { url: "https://issues.dev", email: ["bugs@example.com"] },
      ]) {
        const error = yield* Effect.flip(S.decodeEffect(Bugs.FromValue)(wire));
        assert.strictEqual(error._tag, "SchemaError");
      }
    })
  );
  it.effect("well-formed objects with unknown keys round-trip verbatim", () =>
    Effect.gen(function* () {
      const repositoryWire = { type: "git", url: "effected/kit", directory: "packages/spdx", custom: true };
      const repository = yield* S.decodeEffect(Repository.FromValue)(repositoryWire);
      assert.deepStrictEqual(repository.rest, { custom: true });
      const value1 = yield* S.encodeEffect(Repository.FromValue)(repository);
      assert.deepStrictEqual(value1, repositoryWire);
      const bugsWire = { email: "bugs@example.com", url: "https://issues.dev", tracker: { kind: "custom" } };
      const bugs = yield* S.decodeEffect(Bugs.FromValue)(bugsWire);
      assert.deepStrictEqual(bugs.rest, { tracker: { kind: "custom" } });
      const value2 = yield* S.encodeEffect(Bugs.FromValue)(bugs);
      assert.deepStrictEqual(value2, bugsWire);
    })
  );
  it.effect("the strict manifest tier rejects a malformed repository url with a typed error", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Package.decode({ name: "pkg", version: "1.0.0", repository: { url: 123 } }));
      assert.strictEqual(error._tag, "PackageDecodeError");
      const bugsError = yield* Effect.flip(Package.decode({ name: "pkg", version: "1.0.0", bugs: { email: 123 } }));
      assert.strictEqual(bugsError._tag, "PackageDecodeError");
    })
  );
  it.effect("the lenient tier keeps object-shaped fields verbatim and degrades non-objects", () =>
    Effect.gen(function* () {
      const kept = yield* LenientManifest.decode({ repository: { url: 123 }, bugs: { email: 123 } });
      assert.deepStrictEqual(kept.repository, { url: 123 });
      assert.deepStrictEqual(kept.bugs, { email: 123 });
      assert.strictEqual(kept.issues.length, 0);
      const degraded = yield* LenientManifest.decode({ repository: 42 });
      assert.isUndefined(degraded.repository);
      assert.strictEqual(degraded.rest?.repository, 42);
      assert.deepStrictEqual(
        A.map(degraded.issues, (issue) => issue.field),
        ["repository"]
      );
    })
  );
});

describe("repository object property", () => {
  it.effect.prop(
    "a generated repository object replays verbatim",
    [S.Struct({ type: S.String, url: S.String })],
    ([wire]) =>
      Effect.gen(function* () {
        const value = yield* S.decodeEffect(Repository.FromValue)(wire);
        assert.strictEqual(value.url, wire.url);
        const value3 = yield* S.encodeEffect(Repository.FromValue)(value);
        assert.deepStrictEqual(value3, wire);
      }),
    { arbitrary: fcRuns(50) }
  );
});
