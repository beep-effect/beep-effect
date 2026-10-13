import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Traversal, badMaxDepthMessage, joinRelative } from "../../../effected/workspaces/internal/traverse.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("depth diagnostics preserve the exact bound across rendering and repeat deterministically", [Arbitrary.schema(S.Int)], ([depth]) => Effect.sync(() => {
  const prefix = "maxDepth must be a positive integer, received ";
  const formatted = badMaxDepthMessage(depth);
  const parsed = Number(formatted.slice(prefix.length));
  assert.strictEqual(parsed, depth);
  assert.strictEqual(badMaxDepthMessage(parsed), formatted);
  assert.strictEqual(badMaxDepthMessage(Number(badMaxDepthMessage(parsed).slice(prefix.length))), formatted);
}), runs);
it.effect.prop("joining the root preserves a queued child's path and traversal depth", [Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([base, entry]) => Effect.sync(() => {
  const relative = joinRelative(base, entry);
  assert.strictEqual(relative, base === "" ? entry : `${base}/${entry}`);
  assert.strictEqual(joinRelative(entry)(base), relative);
  const traversal = new Traversal(base, "/repo", 1);
  const parent = { relative: base, absolute: "/repo", depth: 0 };
  assert.deepStrictEqual(traversal.next(), parent);
  traversal.push(parent, relative, "/repo/child");
  assert.deepStrictEqual(traversal.next(), { relative, absolute: "/repo/child", depth: 1 });
  assert.isUndefined(traversal.next());
}), runs);
