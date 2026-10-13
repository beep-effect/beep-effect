import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Bugs, Repository } from "../../effected/package-json/Repository.ts";
describe("repository permissive shapes", () => {
  it.effect("an empty authority and an authority-less path have no browsable directory", () => Effect.sync(() => {
    assertNone(Repository.make({ url: "https://" }).browseUrl);
    assertNone(Repository.make({ url: "https:///owner/repo", directory: "src" }).directoryUrl);
    assertNone(Repository.make({ url: "https://git@" }).browseUrl);
  }));
  it.effect("missing or non-string repository URL degrades to empty without losing wire data", () => Effect.gen(function* () {
    for (const wire of [{ type: "git" }, { url: 123, custom: true }]) {
      const value = yield* S.decodeEffect(Repository.FromValue)(wire);
      assert.strictEqual(value.url, "");
      assert.deepStrictEqual(yield* S.encodeEffect(Repository.FromValue)(value), { ...(value.type === undefined ? {} : { type: value.type }), url: "", ...value.rest });
    }
  }));
  it.effect("bugs preserve unknown keys and omit malformed known keys from the model", () => Effect.gen(function* () {
    const wire = { email: 123, url: "https://issues.dev", tracker: { kind: "custom" } };
    const value = yield* S.decodeEffect(Bugs.FromValue)(wire);
    assert.strictEqual(value.email, undefined);
    assert.deepStrictEqual(value.rest, { tracker: { kind: "custom" } });
    assert.deepStrictEqual(yield* S.encodeEffect(Bugs.FromValue)(value), { url: "https://issues.dev", tracker: { kind: "custom" } });
  }));
});
