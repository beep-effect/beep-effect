import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { GitConfig, GitConfigEditError, GitConfigParseError } from "../../effected/git/GitConfig.ts";

describe("GitConfig coverage", () => {
  it.effect("diagnostic messages include positions and additional diagnostic count", () => Effect.gen(function* () {
    assert.strictEqual(GitConfigParseError.make({ input: "", diagnostics: [] }).message, "malformed git-config text");
    const failed = GitConfig.parseResult("[broken\n# comment\n# another\n[also broken\n");
    if (Result.isSuccess(failed)) assert.fail("Expected a typed failure");
    assertFailure(failed, failed.failure);
    assert.deepStrictEqual(failed.failure.diagnostics.map(d => [d.line, d.character]), [[0, 0], [3, 0]]);
    assert.strictEqual(failed.failure.message, `${failed.failure.diagnostics[0]?.message} (line 1) — and 1 more`);
    const exit = yield* Effect.result(GitConfig.parse("[broken"));
    if (Result.isSuccess(exit)) assert.fail("Expected a typed failure");
    assertFailure(exit, exit.failure);
    assert.strictEqual(exit.failure.input, "[broken");
  }));

  it.effect("edit errors describe every reason with optional addresses and keys", () => Effect.sync(() => {
    const messages: ReadonlyArray<readonly [GitConfigEditError["reason"], string]> = [
      ["missingSection", 'unset: section [core] does not exist'],
      ["missingKey", 'unset: [core] does not exist'],
      ["invalidSectionName", 'unset: invalid section name "core"'],
      ["invalidSubsection", 'unset: invalid subsection name'],
      ["invalidKey", 'unset: invalid variable name ""'],
      ["invalidValue", 'unset: the value cannot be represented in git-config syntax'],
    ];
    for (const [reason, message] of messages) {
      assert.strictEqual(GitConfigEditError.make({ op: "unset", section: "core", reason }).message, message);
    }
    assert.strictEqual(GitConfigEditError.make({ op: "unset", section: "remote", subsection: "Origin", key: "url", reason: "missingKey" }).message, 'unset: [remote "Origin"] url does not exist');
    assert.strictEqual(GitConfigEditError.make({ op: "set", section: "core", key: "1bad", reason: "invalidKey" }).message, 'set: invalid variable name "1bad"');
  }));

  it.effect("include collection skips malformed addresses, unrelated keys and bare paths", () => Effect.gen(function* () {
    const config = yield* GitConfig.parse('[core]\npath = other\n[include "ignored"]\npath = ignored\n[includeIf]\npath = ignored\n[include]\nother = ignored\npath\npath = plain\n[includeIf "gitdir:work/"]\npath = conditional\n');
    assert.deepStrictEqual(config.includes().map(i => [i.path, i.condition]), [["plain", undefined], ["conditional", "gitdir:work/"]]);
  }));

  it.effect("append inserts separators at EOF and falls back to existing or new sections", () => Effect.gen(function* () {
    const config = yield* GitConfig.parse('[core]\nkey = first');
    const appended = yield* Effect.fromResult(config.append("core", undefined, "key", "second"));
    assert.strictEqual(appended.stringify(), '[core]\nkey = first\nkey = second\n');
    const newKey = yield* Effect.fromResult(config.append("core", undefined, "new", "value"));
    assert.strictEqual(newKey.stringify(), '[core]\nkey = first\nnew = value\n');
    const newSection = yield* Effect.fromResult(config.append("remote", "origin", "url", "u"));
    assert.strictEqual(newSection.stringify(), '[core]\nkey = first\n[remote "origin"]\n\turl = u\n');
    const empty = yield* GitConfig.parse("");
    const inserted = yield* Effect.fromResult(empty.addSection("core", undefined));
    assert.strictEqual(inserted.stringify(), '[core]\n');
    const header = yield* GitConfig.parse('[core]');
    const value = yield* Effect.fromResult(header.set("core", undefined, "key", "v"));
    assert.strictEqual(value.stringify(), '[core]\n\tkey = v\n');
    const invalid = config.append("core", undefined, "1invalid", "v");
    if (Result.isSuccess(invalid)) assert.fail("Expected a typed failure");
    assertFailure(invalid, invalid.failure);
  }));

  it.effect("missing sections and keys fail unsetAll and renameSection", () => Effect.gen(function* () {
    const config = yield* GitConfig.parse('[core]\nkey = value\n');
    const missingSection = config.unsetAll("remote", "origin", "url");
    if (Result.isSuccess(missingSection)) assert.fail("Expected a typed failure");
    assertFailure(missingSection, missingSection.failure);
    assert.strictEqual(missingSection.failure.reason, "missingSection");
    const missingKey = config.unsetAll("core", undefined, "absent");
    if (Result.isSuccess(missingKey)) assert.fail("Expected a typed failure");
    assertFailure(missingKey, missingKey.failure);
    assert.strictEqual(missingKey.failure.reason, "missingKey");
    const missingRename = config.renameSection("remote", "origin", "remote", "other");
    if (Result.isSuccess(missingRename)) assert.fail("Expected a typed failure");
    assertFailure(missingRename, missingRename.failure);
    assert.strictEqual(missingRename.failure.reason, "missingSection");
    const removed = config.unsetAll("core", undefined, "key");
    if (Result.isFailure(removed)) assert.fail("Expected success");
    assertSuccess(removed, removed.success);
    assert.strictEqual(removed.success.stringify(), "[core]\n");
  }));

  it.effect("replacing empty values preserves comment separators", () => Effect.gen(function* () {
    for (const marker of ["#", ";"]) {
      const config = yield* GitConfig.parse(`[core]\nkey =${marker} comment\n`);
      const edited = yield* Effect.fromResult(config.set("core", undefined, "key", "v"));
      assert.strictEqual(edited.stringify(), `[core]\nkey =v ${marker} comment\n`);
      assert.deepStrictEqual(edited.getAll("core", undefined, "key"), ["v"]);
    }
  }));

  it.effect("removing header-line entries preserves CR, CRLF and an absent final newline", () => Effect.gen(function* () {
    for (const ending of ["\r", "\r\n", ""]) {
      const config = yield* GitConfig.parse(`[core] key = value${ending}`);
      const edited = yield* Effect.fromResult(config.unset("core", undefined, "key"));
      assert.strictEqual(edited.stringify(), `[core]${ending}`);
      assert.deepStrictEqual(edited.getAll("core", undefined, "key"), []);
    }
  }));
});
