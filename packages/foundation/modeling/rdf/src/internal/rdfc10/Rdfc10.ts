/**
 * The RDFC-1.0 canonical labelling of blank nodes, ported from `rdf-canonize`
 * 5.0.0 (`lib/RDFC10.js`, `lib/IdentifierIssuer.js`, `lib/Permuter.js`),
 * copyright Digital Bazaar, Inc., under the BSD 3-Clause licence in
 * `LICENSE.rdf-canonize` beside this module.
 *
 * **Details**
 *
 * Hashing runs through the `Digest.Digest` service. The work bound counts
 * Hash N-Degree Quads calls, the quantity upstream bounds with
 * `maxDeepIterations`, so one input passes or fails the same way on every
 * machine. First-degree N-Quads are sorted in Unicode code point order, the
 * order the W3C Recommendation states, where upstream sorts UTF-16 code units.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RdfId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { BlankNode, Quad, serializeQuad } from "../../Rdf.ts";
import type { GraphTerm, ObjectTerm, Subject } from "../../Rdf.ts";

const $I = $RdfId.create("internal/rdfc10/Rdfc10");

const encoder = new TextEncoder();

const utf8Of = (value: string): ReadonlyArray<number> => A.fromIterable(encoder.encode(value));

const byCodePoint: Order.Order<string> = Order.mapInput(Order.Array(Order.Number), utf8Of);

/**
 * Sort strings in Unicode code point order, the order RDFC-1.0 sorts N-Quads in.
 *
 * **Details**
 *
 * It differs from JavaScript's default UTF-16 order only when a
 * supplementary-plane character meets a character in U+E000 to U+FFFF.
 *
 * **Example** (Sort a supplementary-plane character after U+F600)
 *
 * ```ts
 * import { sortByCodePoint } from "@beep/rdf/internal/rdfc10/Rdfc10"
 *
 * console.log(sortByCodePoint(["\u{1F303}", "\uF600"]).length) // 2
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const sortByCodePoint = (lines: Iterable<string>): Array<string> => A.sort(lines, byCodePoint);

class Issuer extends S.Opaque<Issuer, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: S.String,
    counter: S.Int,
    issued: S.HashMap(S.String, S.String),
    order: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("Issuer", {
      description: "An identifier issuer: the prefix, the next counter and the identifiers issued in issue order.",
    })
  )
) {}

const makeIssuer = (prefix: string): Issuer => Issuer.make({ prefix, counter: 0, issued: HashMap.empty(), order: [] });

const issue = (issuer: Issuer, old: string): readonly [string, Issuer] =>
  O.match(HashMap.get(issuer.issued, old), {
    onSome: (id): readonly [string, Issuer] => [id, issuer],
    onNone: (): readonly [string, Issuer] => {
      const id = `${issuer.prefix}${issuer.counter}`;
      return [
        id,
        Issuer.make({
          prefix: issuer.prefix,
          counter: issuer.counter + 1,
          issued: HashMap.set(issuer.issued, old, id),
          order: A.append(issuer.order, old),
        }),
      ];
    },
  });

class Permutations extends S.Opaque<Permutations, { readonly brand: unique symbol }>()(
  S.Struct({
    current: S.Array(S.String),
    leftward: S.HashSet(S.String),
    done: S.Boolean,
  }).pipe(
    $I.annoteSchema("Permutations", {
      description: "Steinhaus-Johnson-Trotter permutation state: the current order and the elements moving left.",
    })
  )
) {}

class Mobile extends S.Opaque<Mobile, { readonly brand: unique symbol }>()(
  S.Struct({
    element: S.String,
    position: S.Int,
    swap: S.Int,
    neighbour: S.String,
  }).pipe(
    $I.annoteSchema("Mobile", {
      description: "A mobile permutation element, its position and the neighbour it swaps with.",
    })
  )
) {}

const startPermutations = (list: ReadonlyArray<string>): Permutations =>
  Permutations.make({ current: A.sort(list, Order.String), leftward: HashSet.fromIterable(list), done: false });

const mobileAt = (state: Permutations, element: string, position: number): O.Option<Mobile> => {
  const swap = HashSet.has(state.leftward, element) ? position - 1 : position + 1;
  return pipe(
    A.get(state.current, swap),
    O.filter((neighbour) => element > neighbour),
    O.map((neighbour) => Mobile.make({ element, position, swap, neighbour }))
  );
};

const largestMobile = (state: Permutations): O.Option<Mobile> =>
  A.reduce(state.current, O.none<Mobile>(), (best, element, position) =>
    O.match(mobileAt(state, element, position), {
      onNone: () => best,
      onSome: (mobile) => (O.exists(best, (largest) => element <= largest.element) ? best : O.some(mobile)),
    })
  );

const advance = (state: Permutations): Permutations =>
  O.match(largestMobile(state), {
    onNone: () => Permutations.make({ current: state.current, leftward: state.leftward, done: true }),
    onSome: (mobile) => {
      const current = A.map(state.current, (element, index) =>
        index === mobile.position ? mobile.neighbour : index === mobile.swap ? mobile.element : element
      );
      const leftward = A.reduce(current, state.leftward, (directions, element) =>
        element <= mobile.element
          ? directions
          : HashSet.has(directions, element)
            ? HashSet.remove(directions, element)
            : HashSet.add(directions, element)
      );
      return Permutations.make({ current, leftward, done: false });
    },
  });

const blankLabelOf = (term: Subject | ObjectTerm | GraphTerm): O.Option<string> =>
  term.termType === "BlankNode" ? O.some(term.value) : O.none();

const blankLabelsOf = (quad: Quad): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.getSomes([blankLabelOf(quad.subject), blankLabelOf(quad.object), blankLabelOf(quad.graph)]));

const quadsByBlankLabel = (quads: ReadonlyArray<Quad>): HashMap.HashMap<string, ReadonlyArray<Quad>> =>
  A.reduce(quads, HashMap.empty<string, ReadonlyArray<Quad>>(), (index, quad) =>
    A.reduce(A.fromIterable(blankLabelsOf(quad)), index, (inner, label) =>
      HashMap.set(inner, label, A.append(O.getOrElse(HashMap.get(inner, label), A.empty<Quad>), quad))
    )
  );

const relabel = <T extends Subject | ObjectTerm | GraphTerm>(term: T, label: (value: string) => string): T =>
  term.termType === "BlankNode" ? (BlankNode.make({ termType: "BlankNode", value: label(term.value) }) as T) : term;

/**
 * Rename every blank node of a quad through a label function.
 *
 * **Example** (Rename a blank subject)
 *
 * ```ts
 * import { makeBlankNode, makeLiteral, makeNamedNode, makeQuad, serializeQuad } from "@beep/rdf/Rdf"
 * import { relabelQuad } from "@beep/rdf/internal/rdfc10/Rdfc10"
 *
 * const quad = makeQuad(makeBlankNode("x"), makeNamedNode("https://example.test/p"), makeLiteral("v"))
 * console.log(serializeQuad(relabelQuad(quad, () => "c14n0"))) // _:c14n0 <https://example.test/p> "v" .
 * ```
 *
 * @internal
 * @category normalization
 * @since 0.0.0
 */
export const relabelQuad: {
  (label: (value: string) => string): (quad: Quad) => Quad;
  (quad: Quad, label: (value: string) => string): Quad;
} = dual(
  2,
  (quad: Quad, label: (value: string) => string): Quad =>
    Quad.make({
      subject: relabel(quad.subject, label),
      predicate: quad.predicate,
      object: relabel(quad.object, label),
      graph: relabel(quad.graph, label),
    })
);

const sha256Hex = Effect.fnUntraced(function* (input: string) {
  const digest = yield* Digest.Digest;
  return yield* digest.digestHex(Digest.sha256, encoder.encode(input));
});

const nquadLine = (quad: Quad): string => `${serializeQuad(quad)}\n`;

const groupBy = <K, V>(entries: ReadonlyArray<readonly [K, V]>): HashMap.HashMap<K, ReadonlyArray<V>> =>
  A.reduce(entries, HashMap.empty<K, ReadonlyArray<V>>(), (groups, [key, value]) =>
    HashMap.set(groups, key, A.append(O.getOrElse(HashMap.get(groups, key), A.empty<V>), value))
  );

class HashPath extends S.Opaque<HashPath, { readonly brand: unique symbol }>()(
  S.Struct({
    hash: S.String,
    issuer: Issuer,
  }).pipe(
    $I.annoteSchema("HashPath", {
      description: "A Hash N-Degree Quads result: the hash and the issuer that produced its chosen path.",
    })
  )
) {}

class PathAttempt extends S.Opaque<PathAttempt, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    issuer: Issuer,
    pruned: S.Boolean,
  }).pipe(
    $I.annoteSchema("PathAttempt", {
      description: "One permutation's path, the issuer copy that built it and whether it was pruned.",
    })
  )
) {}

class PermutationWalk extends S.Opaque<PermutationWalk, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    issuer: Issuer,
    recursion: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("PermutationWalk", {
      description:
        "A permutation walk so far: the path, the issuer copy and the related labels still to hash recursively.",
    })
  )
) {}

const walkRelated = (
  canonicalIssued: HashMap.HashMap<string, string>,
  walk: PermutationWalk,
  related: string
): PermutationWalk =>
  O.match(HashMap.get(canonicalIssued, related), {
    onSome: (id) =>
      PermutationWalk.make({ path: `${walk.path}_:${id}`, issuer: walk.issuer, recursion: walk.recursion }),
    onNone: () => {
      const [id, issuer] = issue(walk.issuer, related);
      return PermutationWalk.make({
        path: `${walk.path}_:${id}`,
        issuer,
        recursion: HashMap.has(walk.issuer.issued, related) ? walk.recursion : A.append(walk.recursion, related),
      });
    },
  });

/**
 * Issue the RDFC-1.0 canonical label of every blank node in a quad list.
 *
 * **Details**
 *
 * Returns the map from each input blank label to its `c14n` label. Fails with
 * `refuse(reached)` when Hash N-Degree Quads would run more than `bound`
 * times; `reached` is `bound + 1`.
 *
 * **Example** (Label one blank node)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 * import { makeBlankNode, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import { issueCanonicalLabels } from "@beep/rdf/internal/rdfc10/Rdfc10"
 *
 * const quads = [makeQuad(makeBlankNode("x"), makeNamedNode("https://example.test/p"), makeLiteral("v"))]
 * const program = issueCanonicalLabels(quads, 1024, (reached) => reached)
 *
 * Effect.runPromise(program.pipe(Effect.provide(Digest.layerWebCrypto))).then((labels) =>
 *   console.log(HashMap.get(labels, "x"))
 * )
 * ```
 *
 * @internal
 * @category normalization
 * @since 0.0.0
 */
export const issueCanonicalLabels = Effect.fnUntraced(function* <E>(
  quads: ReadonlyArray<Quad>,
  bound: number,
  refuse: (reached: number) => E
): Effect.fn.Return<HashMap.HashMap<string, string>, E, Digest.Digest> {
  const byLabel = quadsByBlankLabel(quads);
  const remaining = yield* Ref.make(bound);
  const canonical = yield* Ref.make(makeIssuer("c14n"));

  const quadsOf = (label: string): ReadonlyArray<Quad> => O.getOrElse(HashMap.get(byLabel, label), A.empty<Quad>);

  const firstDegreeHash = Effect.fnUntraced(function* (label: string) {
    const lines = A.map(quadsOf(label), (quad) =>
      nquadLine(relabelQuad(quad, (value) => (value === label ? "a" : "z")))
    );
    return yield* sha256Hex(A.join(sortByCodePoint(lines), ""));
  });

  const labels = byLabel.pipe(HashMap.keys, sortByCodePoint);
  const firstDegreeEntries = yield* Effect.forEach(
    labels,
    (label) => Effect.map(firstDegreeHash(label), (hash) => [label, hash] as const),
    { concurrency: 1 }
  );
  const firstDegree = HashMap.fromIterable(firstDegreeEntries);
  const firstDegreeOf = (label: string): string => HashMap.getUnsafe(firstDegree, label);

  const hashRelated = Effect.fnUntraced(function* (related: string, quad: Quad, issuer: Issuer, position: string) {
    const issuedCanonical = yield* Ref.get(canonical);
    const identifier = HashMap.get(issuedCanonical.issued, related).pipe(
      O.orElse(() => HashMap.get(issuer.issued, related)),
      O.match({ onSome: (id) => `_:${id}`, onNone: () => firstDegreeOf(related) })
    );
    const predicate = position === "g" ? "" : `<${quad.predicate.value}>`;
    return yield* sha256Hex(`${position}${predicate}${identifier}`);
  });

  const hashToRelated = Effect.fnUntraced(function* (label: string, issuer: Issuer) {
    const positioned = A.flatMap(quadsOf(label), (quad) =>
      A.getSomes(
        A.map(
          [
            [quad.subject, "s"],
            [quad.object, "o"],
            [quad.graph, "g"],
          ] as const,
          ([term, position]) =>
            pipe(
              blankLabelOf(term),
              O.filter((related) => related !== label),
              O.map((related) => [related, quad, position] as const)
            )
        )
      )
    );
    const hashed = yield* Effect.forEach(
      positioned,
      ([related, quad, position]) =>
        Effect.map(hashRelated(related, quad, issuer, position), (hash) => [hash, related] as const),
      { concurrency: 1 }
    );
    return groupBy(hashed);
  });

  const hashNDegree: (label: string, issuer: Issuer) => Effect.Effect<HashPath, E, Digest.Digest> = Effect.fnUntraced(
    function* (label: string, start: Issuer) {
      const allowed = yield* Ref.modify(remaining, (left) => (left === 0 ? [false, 0] : [true, left - 1]));
      if (!allowed) {
        return yield* Effect.fail(refuse(bound + 1));
      }
      const related = yield* hashToRelated(label, start);
      const groups = A.sort(
        A.fromIterable(related),
        Order.mapInput(Order.String, ([hash]: readonly [string, ReadonlyArray<string>]) => hash)
      );
      let issuer = start;
      let data = "";
      for (const [hash, list] of groups) {
        data += hash;
        let permutations = startPermutations(list);
        let chosen = yield* tryPermutation(permutations.current, issuer, O.none());
        permutations = advance(permutations);
        while (!permutations.done) {
          const attempt = yield* tryPermutation(permutations.current, issuer, O.some(chosen.path));
          permutations = advance(permutations);
          if (!attempt.pruned && attempt.path < chosen.path) {
            chosen = attempt;
          }
        }
        data += chosen.path;
        issuer = chosen.issuer;
      }
      return HashPath.make({ hash: yield* sha256Hex(data), issuer });
    }
  );

  const exceeds = (path: string, bound: O.Option<string>): boolean => O.exists(bound, (chosen) => path > chosen);

  const tryPermutation = Effect.fnUntraced(function* (
    permutation: ReadonlyArray<string>,
    issuer: Issuer,
    bound: O.Option<string>
  ) {
    const issuedCanonical = yield* Ref.get(canonical);
    let walk = PermutationWalk.make({ path: "", issuer, recursion: A.empty() });
    for (const related of permutation) {
      walk = walkRelated(issuedCanonical.issued, walk, related);
      if (exceeds(walk.path, bound)) {
        return PathAttempt.make({ path: walk.path, issuer: walk.issuer, pruned: true });
      }
    }
    let copy = walk.issuer;
    let path = walk.path;
    for (const related of walk.recursion) {
      const result = yield* hashNDegree(related, copy);
      const [id] = issue(copy, related);
      path += `_:${id}<${result.hash}>`;
      copy = result.issuer;
      if (exceeds(path, bound)) {
        return PathAttempt.make({ path, issuer: copy, pruned: true });
      }
    }
    return PathAttempt.make({ path, issuer: copy, pruned: false });
  });

  const byFirstDegree = groupBy(A.map(labels, (label) => [firstDegreeOf(label), label] as const));
  const firstDegreeHashes = byFirstDegree.pipe(HashMap.keys, A.sort(Order.String));
  const groups = A.map(firstDegreeHashes, (hash) => O.getOrElse(HashMap.get(byFirstDegree, hash), A.empty<string>));
  const unique = A.filter(groups, (group) => group.length === 1);
  const shared = A.filter(groups, (group) => group.length > 1);

  yield* Ref.update(canonical, (issuer) => A.reduce(A.flatten(unique), issuer, (next, label) => issue(next, label)[1]));

  for (const group of shared) {
    const issuedCanonical = yield* Ref.get(canonical);
    const pending = A.filter(group, (label) => !HashMap.has(issuedCanonical.issued, label));
    const paths = yield* Effect.forEach(pending, (label) => hashNDegree(label, issue(makeIssuer("b"), label)[1]), {
      concurrency: 1,
    });
    const ordered = A.sort(
      paths,
      Order.mapInput(Order.String, (path: HashPath) => path.hash)
    );
    yield* Ref.update(canonical, (issuer) =>
      A.reduce(ordered, issuer, (next, path) => A.reduce(path.issuer.order, next, (inner, old) => issue(inner, old)[1]))
    );
  }

  return (yield* Ref.get(canonical)).issued;
});
