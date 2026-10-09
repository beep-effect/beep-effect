import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { getAliasName, getAnchorName, scanName } from "../../../../effected/yaml/internal/composer/anchors.ts";

const runs = { arbitrary: fcRuns(100) };
describe("anchor-name parser properties", () => {
  it.effect.prop("scanning is idempotent and both sigil renderings preserve names", [Arbitrary.schema(S.String)], ([input]) => Effect.sync(() => {
    const name = scanName(input, 0);
    assert.strictEqual(scanName(name, 0), name);
    const anchor = { type: "anchor", source: `&${name}`, offset: 0, length: name.length + 1 } as const;
    const alias = { type: "alias", source: `*${name}`, offset: 0, length: name.length + 1 } as const;
    assert.strictEqual(getAnchorName(anchor, anchor.source), name);
    assert.strictEqual(getAliasName(alias, alias.source), name);
    const parsedAnchor = getAnchorName(anchor, `&${input}`);
    const parsedAlias = getAliasName(alias, `*${input}`);
    assert.strictEqual(getAnchorName(anchor, `&${parsedAnchor}`), parsedAnchor);
    assert.strictEqual(getAliasName(alias, `*${parsedAlias}`), parsedAlias);
  }), runs);
});
