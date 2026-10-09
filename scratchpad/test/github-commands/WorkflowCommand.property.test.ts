import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AnnotationProperties, WorkflowCommand } from "../../effected/github-commands/WorkflowCommand.ts";

const runs = { arbitrary: fcRuns(100) };
const text = Arbitrary.schema(S.String).pipe(Arbitrary.map((value) => `${value}%0A%25\r\n:,=::##[error]`));
const names = Arbitrary.schema(S.Literals(["debug", "notice", "warning", "error", "group", "endgroup", "add-mask"]));

// Independent runner-style oracle: decode delimiters/newlines before percent,
// exactly once, so literal escape-looking data remains literal data.
const messageValue = (value: string): string => value.replaceAll("%0D", "\r").replaceAll("%0A", "\n").replaceAll("%25", "%");
const propertyValue = (value: string): string => messageValue(value.replaceAll("%3A", ":").replaceAll("%2C", ","));
const parse = (wire: string) => {
  const match = /^::([^ :]+)(?: ([\s\S]*?))?::([\s\S]*)$/.exec(wire);
  if (match === null) throw new Error("Malformed workflow command");
  const name = match[1];
  const message = match[3];
  assertDefined(name);
  assertDefined(message);
  const properties = R.fromEntries(A.map(match[2] === undefined ? [] : Str.split(match[2], ","), (entry) => {
    const separator = entry.indexOf("=");
    assertTrue(separator >= 0);
    return [entry.slice(0, separator), propertyValue(entry.slice(separator + 1))] as const;
  }));
  return { name, properties, message: messageValue(message) };
};
const stringify = (command: ReturnType<typeof parse>): string => WorkflowCommand.render(command.name, command.properties, command.message);
const canonicalize = (wire: string): string => stringify(parse(wire));
const fidelity = (wire: string, name: string, properties: Readonly<Record<string, string>>, message: string): void => {
  const parsed = parse(wire);
  assert.deepStrictEqual(parsed, { name, properties, message });
  assert.deepStrictEqual(parse(stringify(parsed)), parsed);
  assert.strictEqual(canonicalize(wire), wire);
  assert.strictEqual(canonicalize(canonicalize(wire)), canonicalize(wire));
  assert.strictEqual(Str.includes("\r")(wire), false);
  assert.strictEqual(Str.includes("\n")(wire), false);
};

describe("WorkflowCommand property floor", () => {
  it.effect.prop("AnnotationProperties decode(encode(x)) equals x and decoding never fails", [Arbitrary.schema(AnnotationProperties)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(AnnotationProperties)(value);
      const decoded = yield* S.decodeEffect(AnnotationProperties)(encoded);
      assertTrue(S.toEquivalence(AnnotationProperties)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(AnnotationProperties)(decoded), encoded);
    }), runs);

  it.effect.prop("render preserves property and message data, omits undefined, and its wire form is idempotent through parsing", [names, text, text, Arbitrary.schema(S.Boolean), Arbitrary.schema(S.Finite)], ([name, message, title, flag, count]) =>
    Effect.sync(() => {
      fidelity(WorkflowCommand.render(name, { title, flag, count, omitted: undefined }, message), name, { title, flag: String(flag), count: String(count) }, message);
    }), runs);

  it.effect.prop("annotation formatters preserve all schema fields with the runner's wire names and round-trip canonically", [Arbitrary.schema(AnnotationProperties), text], ([properties, message]) =>
    Effect.sync(() => {
      const expected = R.fromEntries(A.map(A.filter([
        ["title", properties.title], ["file", properties.file], ["line", properties.startLine],
        ["endLine", properties.endLine], ["col", properties.startColumn], ["endColumn", properties.endColumn],
      ] as const, ([, value]) => value !== undefined), ([key, value]) => [key, String(value)] as const));
      fidelity(WorkflowCommand.notice(message, properties), "notice", expected, message);
      fidelity(WorkflowCommand.warning(message, properties), "warning", expected, message);
      fidelity(WorkflowCommand.error(message, properties), "error", expected, message);
    }), runs);

  it.effect.prop("debug, group, endGroup and addMask preserve raw data and their wire form is idempotent through parsing", [text], ([message]) =>
    Effect.sync(() => {
      fidelity(WorkflowCommand.debug(message), "debug", {}, message);
      fidelity(WorkflowCommand.group(message), "group", {}, message);
      fidelity(WorkflowCommand.endGroup(), "endgroup", {}, "");
      fidelity(WorkflowCommand.addMask(message), "add-mask", {}, message);
    }), runs);
});
