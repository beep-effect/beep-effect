import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { formatIssue, issueEntries, issueTreeChildren } from "../../../effected/cli/internal/format.ts";
import type { IssueEntry, IssueTreeNode } from "../../../effected/cli/internal/format.ts";
const sample = S.Struct({ key: S.String, value: S.Json });
it.effect.prop("issue parsing and formatting preserve the rejected key, deduplicate, and are stable across repeated strict decoding", [Arbitrary.schema(sample)], ([input]) => Effect.gen(function* () {
  const schema = S.Struct({ accepted: S.String });
  const raw = { accepted: "ok", [`extra_${input.key}`]: input.value };
  const decode = S.decodeUnknownEffect(schema);
  const error = yield* decode(raw, { onExcessProperty: "error" }).pipe(Effect.flip);
  const parsed = issueEntries(error.issue);
  assert.deepStrictEqual(parsed, [{ message: "unknown key", path: [`extra_${input.key}`] }]);
  assert.deepStrictEqual(formatIssue(error.issue), parsed.map((entry) => `${entry.message} at ${entry.path.join(".")}`));
  const json = S.fromJsonString(S.Json);
  const reparsedRaw = yield* S.decodeEffect(json)(yield* S.encodeEffect(json)(raw));
  const reparsedError = yield* decode(reparsedRaw, { onExcessProperty: "error" }).pipe(Effect.flip);
  assert.deepStrictEqual(issueEntries(reparsedError.issue), parsed);
  assert.deepStrictEqual(formatIssue(reparsedError.issue), formatIssue(error.issue));
}), runs);
const path = S.Array(S.Literals(["group", "item", "value"]));
const entry = S.Struct({ message: S.String, path });
const readTree = (nodes: ReadonlyArray<IssueTreeNode>, path: ReadonlyArray<string> = []): ReadonlyArray<IssueEntry> => nodes.flatMap((node) => {
  if (node.children !== undefined) return readTree(node.children, [...path, node.label]);
  // Collapsed single leaves have the last segment followed by ': '.
  const separator = node.label.indexOf(": ");
  return separator < 0 ? [{ message: node.label, path }] : [{ message: node.label.slice(separator + 2), path: [...path, node.label.slice(0, separator)] }];
});
// Messages without ': ' make the compact tree representation unambiguous.
const entries = entry.pipe(S.Array, Arbitrary.schema, Arbitrary.map((values) => values.map((value) => ({ ...value, message: value.message.replaceAll(": ", "colon ") }))));
it.effect.prop("the issue trie has an idempotent parse/render form and retains every path and message", [entries], ([input]) => Effect.sync(() => {
  const tree = issueTreeChildren(input);
  const parsed = readTree(tree);
  const ordered = (values: ReadonlyArray<IssueEntry>) => values.map((value) => JSON.stringify([value.path, value.message])).sort();
  assert.deepStrictEqual(ordered(parsed), ordered(input));
  assert.deepStrictEqual(issueTreeChildren(parsed), tree);
  assert.deepStrictEqual(readTree(issueTreeChildren(parsed)), parsed);
}), runs);
