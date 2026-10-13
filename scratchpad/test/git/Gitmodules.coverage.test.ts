import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GitConfig } from "../../effected/git/GitConfig.ts";
import { Gitmodules, GitmodulesEntry, GitmodulesDecodeError } from "../../effected/git/Gitmodules.ts";

describe("Gitmodules coverage", () => {
  it.effect("decode errors render field-specific and generic invalid values", () => Effect.sync(() => {
    assert.strictEqual(GitmodulesDecodeError.make({ name: "lib", reason: "missingUrl" }).message, 'submodule "lib" has no url');
    assert.strictEqual(GitmodulesDecodeError.make({ name: "lib", reason: "invalidValue" }).message, 'submodule "lib": invalid value "" for a field');
    assert.strictEqual(GitmodulesDecodeError.make({ name: "lib", reason: "invalidValue", field: "ignore", value: "bad" }).message, 'submodule "lib": invalid value "bad" for ignore');
  }));

  it.effect("bare mandatory or string-valued fields fail with the corresponding typed error", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [string, string, GitmodulesDecodeError["reason"]]> = [
      ['path\nurl = u', "path", "missingPath"],
      ['path = p\nurl', "url", "missingUrl"],
      ['path = p\nurl = u\nbranch', "branch", "invalidValue"],
      ['path = p\nurl = u\nupdate', "update", "invalidValue"],
      ['path = p\nurl = u\nignore', "ignore", "invalidValue"],
    ];
    for (const [body, field, reason] of cases) {
      const parsed = Gitmodules.parseResult(`[submodule "lib"]\n${body}\n`);
      if (Result.isSuccess(parsed)) assert.fail("Expected a typed failure");
      assertFailure(parsed, parsed.failure);
      if (S.is(GitmodulesDecodeError)(parsed.failure)) {
        assert.strictEqual(parsed.failure.field, field);
        assert.strictEqual(parsed.failure.reason, reason);
        assert.strictEqual(parsed.failure.value, undefined);
      } else {
        assert.fail("Expected GitmodulesDecodeError");
      }
    }
  }));

  it.effect("shallow setters write false and remove the key", () => Effect.gen(function* () {
    const config = yield* GitConfig.parse('[submodule "lib"]\npath = p\nurl = u\n');
    const written = yield* Effect.fromResult(Gitmodules.setShallow(config, "lib", false));
    assert.deepStrictEqual(written.getAll("submodule", "lib", "shallow"), ["false"]);
    const removed = yield* Effect.fromResult(Gitmodules.setShallow(written, "lib"));
    assertNone(removed.get("submodule", "lib", "shallow"));
  }));

  it.effect("adding entries writes every boolean and on-demand spelling", () => Effect.gen(function* () {
    const config = yield* GitConfig.parse("");
    for (const fetchRecurseSubmodules of [true, false, "on-demand"] as const) {
      const entry = GitmodulesEntry.make({ name: "lib", path: "p", url: "u", shallow: false, fetchRecurseSubmodules });
      const added = yield* Effect.fromResult(Gitmodules.add(config, entry));
      const decoded = yield* Gitmodules.parse(added.stringify());
      assert.deepStrictEqual(decoded.entries, [entry]);
    }
  }));

  it.effect("adding an unchecked invalid entry preserves the first surgical refusal", () => Effect.gen(function* () {
    const config = yield* GitConfig.parse("");
    const invalidName = GitmodulesEntry.make({ name: "bad\nname", path: "p", url: "u" }, { disableChecks: true });
    const added = Gitmodules.add(config, invalidName);
    if (Result.isSuccess(added)) assert.fail("Expected a typed failure");
    assertFailure(added, added.failure);
    assert.strictEqual(added.failure.reason, "invalidSubsection");
    const invalidPath = GitmodulesEntry.make({ name: "lib", path: "p\0", url: "u" }, { disableChecks: true });
    const invalidAdded = Gitmodules.add(config, invalidPath);
    if (Result.isSuccess(invalidAdded)) assert.fail("Expected a typed failure");
    assertFailure(invalidAdded, invalidAdded.failure);
    assert.strictEqual(invalidAdded.failure.reason, "invalidValue");
    const decoded = yield* Effect.result(S.decodeEffect(Gitmodules.FromString)('[submodule "lib"]\npath = p\nurl = u\nignore = bad\n'));
    if (Result.isSuccess(decoded)) assert.fail("Expected a typed failure");
    assertFailure(decoded, decoded.failure);
  }));
});
