import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CliUiTest } from "../../../../effected/cli/ui/testing/CliUiTest.ts";

const runs = { arbitrary: fcRuns(100) };
const text = Arbitrary.schema(S.String);
it.effect.prop("styled preserves text and emphasis and is idempotent", [text], ([sample]) => Effect.sync(() => {
  const value = Str.replaceAll(/\u001b/g, "")(sample);
  const parsed = CliUiTest.styled(`\u001b[1m${value}\u001b[22m`);
  assert.strictEqual(parsed, `[b]${value}[/b]`);
  assert.strictEqual(CliUiTest.styled(parsed), parsed);
  // Re-encode the parsed emphasis to ANSI and parse it again.
  const encoded = `\u001b[1m${parsed.slice(3, -4)}\u001b[22m`;
  assert.strictEqual(CliUiTest.styled(encoded), parsed);
}), runs);
it.effect.prop("snapshot formatting is idempotent and preserves styled content except trailing space", [text], ([sample]) => Effect.sync(() => {
  const value = Str.replaceAll(/\u001b/g, "")(sample);
  const ansi = `\u001b[31m${value}\u001b[39m  \n`;
  const formatted = CliUiTest.serializer.serialize(ansi);
  assert.strictEqual(formatted, Str.split(CliUiTest.styled(ansi), "\n").map(Str.trimEnd).join("\n"));
  assert.strictEqual(CliUiTest.serializer.serialize(formatted), formatted);
  assert.strictEqual(CliUiTest.serializer.serialize(CliUiTest.styled(ansi)), formatted);
}), runs);
