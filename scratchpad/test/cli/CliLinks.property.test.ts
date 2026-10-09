import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Layer from "effect/Layer";
import { CurrentRuntimeEnv } from "../../effected/env/index.ts";
import { ambientLinksLayer } from "../../effected/cli/CliLinks.ts";
import * as S from "effect/Schema";
import { CliLinks } from "../../effected/cli/CliLinks.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";

const runs = { arbitrary: fcRuns(100) };
it.layer(CliLinks.layerTest("file"), { timeout: "30 seconds" })((it) => {
it.effect.prop("URL normalization is idempotent and retains the normalized target", [Arbitrary.schema(S.String)], ([text]) => Effect.gen(function* () {
  const links = yield* CliLinks;
  const target = links.target({ url: text });
  if (O.isSome(target)) {
    assert.deepStrictEqual(links.target({ url: target.value }), target);
    assert.strictEqual(target.value, Fmt.sanitize(text).replace(/[\r\n]/g, ""));
  } else {
    assert.deepStrictEqual(links.target({ url: Fmt.sanitize(text).replace(/[\r\n]/g, "") }), target);
  }
}), runs);
it.effect.prop("file URL formatting preserves the path and agent links preserve the label", [Arbitrary.schema(S.String)], ([text]) => Effect.gen(function* () {
  const links = yield* CliLinks;
  const file = `/repo/${text.toWellFormed()}`;
  const target = links.target({ file });
  const encoded = O.getOrThrow(target);
  assert.strictEqual(decodeURIComponent(encoded.slice("file://".length)), file);
  assert.deepStrictEqual(links.target({ url: encoded }), target);
  const link = CliLinks.linker({ links, audience: "agent", hyperlinks: true });
  assert.strictEqual(link({ file }, text), text);
  assert.strictEqual(link({ file }, link({ file }, text)), text);
}), runs);

});

it.effect.prop("editor setting parsing keeps fidelity through canonical formatting and normalizes case and whitespace", [Arbitrary.schema(S.Literals(["file", "vscode", "off"]))], ([mode]) => Effect.gen(function* () {
  const parse = (value: string) => Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(ambientLinksLayer({ envVar: "EDITOR_MODE" }).pipe(Layer.provide(CurrentRuntimeEnv.layerTest()), Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ EDITOR_MODE: value })))), scope), (context) => Effect.provideContext(CliLinks, context)));
  const first = yield* parse(`  ${mode.toUpperCase()}  `);
  const second = yield* parse(first.mode);
  assert.strictEqual(first.mode, mode);
  assert.strictEqual(second.mode, first.mode);
  assert.strictEqual((yield* parse(second.mode)).mode, second.mode);
}), runs);
