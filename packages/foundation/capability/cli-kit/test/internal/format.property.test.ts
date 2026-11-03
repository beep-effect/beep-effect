import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { formatIssue, issueEntries, issueTreeChildren } from "@beep/cli-kit/internal/format";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import type { IssueEntry, IssueTreeNode } from "@beep/cli-kit/internal/format";

const UnknownJson = S.fromJsonString(S.Unknown);

const sample = S.Struct({ key: S.String, value: S.Json });
it.effect("issue deduplication distinguishes a dotted key from the same displayed nested path", () =>
  Effect.gen(function* () {
    const schema = S.Struct({ "a.b": S.String, a: S.Struct({ b: S.String }) });
    const error = yield* S.decodeUnknownEffect(schema)({ "a.b": 1, a: { b: 2 } }, { errors: "all" }).pipe(Effect.flip);
    const parsed = issueEntries(error.issue);
    assert.deepStrictEqual(parsed, [
      { message: "Expected string", path: ["a.b"] },
      { message: "Expected string", path: ["a", "b"] },
    ]);
    assert.deepStrictEqual(formatIssue(error.issue), ["Expected string at a.b", "Expected string at a.b"]);
    assert.deepStrictEqual(issueTreeChildren(parsed), [
      { label: "a.b: Expected string" },
      { label: "a", children: [{ label: "b: Expected string" }] },
    ]);
  })
);
it.effect.prop(
  "issue parsing and formatting preserve the rejected key, deduplicate, and are stable across repeated strict decoding",
  [Arbitrary.schema(sample)],
  ([input]) =>
    Effect.gen(function* () {
      const schema = S.Struct({ accepted: S.String });
      const raw = { accepted: "ok", [`extra_${input.key}`]: input.value };
      const decode = S.decodeUnknownEffect(schema);
      const error = yield* decode(raw, { onExcessProperty: "error" }).pipe(Effect.flip);
      const parsed = issueEntries(error.issue);
      assert.deepStrictEqual(parsed, [{ message: "unknown key", path: [`extra_${input.key}`] }]);
      assert.deepStrictEqual(
        formatIssue(error.issue),
        A.map(parsed, (entry) => `${entry.message} at ${A.join(entry.path, ".")}`)
      );
      const json = S.fromJsonString(S.Json);
      const argument = S.decodeEffect(json);
      const value1 = yield* S.encodeEffect(json)(raw);
      const reparsedRaw = yield* argument(value1);
      const reparsedError = yield* decode(reparsedRaw, { onExcessProperty: "error" }).pipe(Effect.flip);
      assert.deepStrictEqual(issueEntries(reparsedError.issue), parsed);
      assert.deepStrictEqual(formatIssue(reparsedError.issue), formatIssue(error.issue));
    }),
  runs
);
const path = S.Array(S.Literals(["group", "item", "value"]));
const entry = S.Struct({ message: S.String, path });
const readTree = (
  nodes: ReadonlyArray<IssueTreeNode.Encoded>,
  path: ReadonlyArray<string> = []
): ReadonlyArray<IssueEntry.Encoded> =>
  A.flatMap(nodes, (node) => {
    if (node.children !== undefined) return readTree(node.children, [...path, node.label]);
    // Collapsed single leaves have the last segment followed by ': '.
    return O.match(Str.indexOf(": ")(node.label), {
      onNone: () => [{ message: node.label, path }],
      onSome: (separator) => [
        { message: Str.slice(separator + 2)(node.label), path: [...path, Str.slice(0, separator)(node.label)] },
      ],
    });
  });
// Messages without ': ' make the compact tree representation unambiguous.
const entries = entry.pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((values) =>
    A.map(values, (value) => ({ ...value, message: Str.replaceAll(": ", "colon ")(value.message) }))
  )
);
it.effect.prop(
  "the issue trie has an idempotent parse/render form and retains every path and message",
  [entries],
  ([input]) =>
    Effect.sync(() => {
      const tree = issueTreeChildren(input);
      const parsed = readTree(tree);
      const ordered = (values: ReadonlyArray<IssueEntry.Encoded>) =>
        A.map(values, (value) =>
          Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)([value.path, value.message]), identity)
        ).sort();
      assert.deepStrictEqual(ordered(parsed), ordered(input));
      assert.deepStrictEqual(issueTreeChildren(parsed), tree);
      assert.deepStrictEqual(readTree(issueTreeChildren(parsed)), parsed);
    }),
  runs
);
