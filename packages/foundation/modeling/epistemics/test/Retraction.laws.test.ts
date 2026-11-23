import { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import { orphanedDerivations } from "@beep/epistemics/ClaimLog";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertEquals } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const a = ClaimId.make(`sha256:${Str.repeat(64)("a")}`);
const b = ClaimId.make(`sha256:${Str.repeat(64)("b")}`);
const c = ClaimId.make(`sha256:${Str.repeat(64)("c")}`);
const d = ClaimId.make(`sha256:${Str.repeat(64)("d")}`);
const e = ClaimId.make(`sha256:${Str.repeat(64)("e")}`);
const f = ClaimId.make(`sha256:${Str.repeat(64)("f")}`);
const graph = HashMap.make(
  [a, HashSet.empty<ClaimId>()],
  [b, HashSet.make(a)],
  [c, HashSet.make(a)],
  [d, HashSet.make(b, c)],
  [e, HashSet.make(a, f)],
  [f, HashSet.empty<ClaimId>()]
);
const topological = [a, f, b, c, d, e];

it("L4-4 roots and partly supported claims survive while whole dead chains and diamonds flag transitively", () => {
  assertEquals(orphanedDerivations(graph, HashSet.empty()), HashSet.empty());
  assertEquals(orphanedDerivations(graph, HashSet.make(a)), HashSet.make(b, c, d));
  assertEquals(orphanedDerivations(HashSet.make(a, f))(graph), HashSet.make(b, c, d, e));
  assertEquals(orphanedDerivations(graph, HashSet.make(a, d)), HashSet.make(b, c));
  expect(HashSet.has(orphanedDerivations(graph, HashSet.make(a, f)), a)).toBe(false);
});
it.prop(
  "L4-4 coherent DAG retraction subsets equal an independent topological fixed point",
  [S.Array(S.Boolean).check(S.isMinLength(6), S.isMaxLength(6))],
  ([flags]) => {
    const retracted = HashSet.fromIterable(A.filter(topological, (_, i) => O.contains(A.get(flags, i), true)));
    const dead = A.reduce(topological, retracted, (dead, claim) => {
      const parents = O.getOrThrow(HashMap.get(graph, claim));
      return !HashSet.isEmpty(parents) && HashSet.every(parents, (parent) => HashSet.has(dead, parent))
        ? HashSet.add(dead, claim)
        : dead;
    });
    const expected = HashSet.difference(dead, retracted);
    assertEquals(orphanedDerivations(graph, retracted), expected);
    const reordered = graph.pipe(HashMap.toEntries, A.reverse, HashMap.fromIterable);
    assertEquals(orphanedDerivations(reordered, HashSet.fromIterable([...retracted, ...retracted])), expected);
  }
);
