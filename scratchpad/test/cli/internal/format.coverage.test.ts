import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { formatIssue, issueEntries, issueTreeChildren } from "../../../effected/cli/internal/format.ts";

it.effect("root issues keep core phrasing and a trie retains root, repeated-path and parent messages", () => Effect.gen(function* () {
  const error = yield* S.decodeUnknownEffect(S.String)(42).pipe(Effect.flip);
  const entries = issueEntries(error.issue);
  assert.lengthOf(entries, 1);
  assert.deepStrictEqual(formatIssue(error.issue), entries.map((entry) => entry.message));
  assert.deepStrictEqual(issueTreeChildren([
    { message: "root", path: [] },
    { message: "first", path: ["group"] },
    { message: "second", path: ["group"] },
    { message: "leaf", path: ["group", "key"] },
    { message: "third", path: ["other"] },
    { message: "fourth", path: ["other"] },
  ]), [
    { label: "root" },
    { label: "group", children: [{ label: "first" }, { label: "second" }, { label: "key: leaf" }] },
    { label: "other", children: [{ label: "third" }, { label: "fourth" }] },
  ]);
  assert.deepStrictEqual(issueTreeChildren([]), []);
}));
