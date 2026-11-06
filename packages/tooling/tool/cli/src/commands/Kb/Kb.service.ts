/**
 * Schema-decoded knowledge ledger service and structural admission checks.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Line } from "@beep/jsonl/Line";
import { isUtf16Boundary, TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { KbError } from "./Kb.errors.ts";
import { Assertion, KbClaim, KbReport, KbSnapshot } from "./Kb.schemas.ts";
import { KbRegistryNode } from "./KbGraph.schemas.ts";
import type { KbView } from "./Kb.schemas.ts";

const $I = $RepoCliId.create("commands/Kb/Kb.service");
const internalOnlyKinds = HashSet.make("internal-file");

/**
 * Accepted independently derived evidence allowed into the outward view.
 * **Example** (Use the eligibility predicate)
 * ```ts
 * import { isOutwardAssertion } from "@beep/repo-cli/commands/Kb"
 * console.log(typeof isOutwardAssertion)
 * ```
 * @param a - Evidence item whose review and derivation are checked.
 * @returns Whether this assertion can be included in outward provenance.
 * @category policies
 * @since 0.0.0
 */
export const isOutwardAssertion = (a: Assertion): boolean =>
  a.review === "accepted" &&
  a.outcome === "captured" &&
  a.audience !== "internal" &&
  !HashSet.has(internalOnlyKinds, a.sourceRef.kind) &&
  a.derivation.basis !== "none" &&
  Str.isNonEmpty(Str.trim(a.derivation.ref));

type TextQuoteSelector = Extract<Assertion["selector"], { readonly _tag: "TextQuote" }>;
type ClaimIndex = HashMap.HashMap<string, KbClaim>;
type AssertionIndex = HashMap.HashMap<string, Assertion>;

const flag = (condition: boolean, message: string): ReadonlyArray<string> =>
  condition ? A.of(message) : A.empty<string>();
const isLinkedFrom = (claim: KbClaim, id: string): boolean =>
  A.contains(claim.supportedBy, id) || A.contains(claim.challengedBy, id);
const linkViolations = (a: Assertion, claimIndex: ClaimIndex): ReadonlyArray<string> =>
  O.match(HashMap.get(claimIndex, a.claimId), {
    onNone: () => A.of(`Assertion ${a.id}: missing claim`),
    onSome: (claim) => flag(!isLinkedFrom(claim, a.id), `Assertion ${a.id}: absent from claim evidence links`),
  });
const sameCapture = (previous: Assertion, a: Assertion): boolean =>
  previous.audience === a.audience &&
  previous.sourceRef.sha256 === a.sourceRef.sha256 &&
  previous.sourceRef.kind === a.sourceRef.kind &&
  previous.sourceRef.locator === a.sourceRef.locator;
const isQuoteRangeValid = (a: Assertion, selector: TextQuoteSelector): boolean =>
  selector.exact === a.quote &&
  TextAnchor.isInternallyConsistent({ startChar: selector.start, endChar: selector.end, quote: selector.exact });
const matchesCaptureText = (text: string, selector: TextQuoteSelector): boolean =>
  isUtf16Boundary(text, selector.start) &&
  isUtf16Boundary(text, selector.end) &&
  Str.slice(selector.start, selector.end)(text) === selector.exact &&
  Str.endsWith(selector.prefix)(Str.slice(0, selector.start)(text)) &&
  Str.startsWith(selector.suffix)(Str.slice(selector.end)(text));
const textQuoteViolations = (a: Assertion, selector: TextQuoteSelector): ReadonlyArray<string> =>
  A.appendAll(
    flag(!isQuoteRangeValid(a, selector), `Assertion ${a.id}: invalid UTF-16 quote range`),
    flag(
      O.exists(O.fromUndefinedOr(a.sourceRef.text), (text) => !matchesCaptureText(text, selector)),
      `Assertion ${a.id}: quote or context does not match capture text`
    )
  );
const selectorViolations = (a: Assertion): ReadonlyArray<string> => {
  const selector = a.selector;
  return selector._tag === "TextQuote"
    ? textQuoteViolations(a, selector)
    : flag(selector.end <= selector.start, `Assertion ${a.id}: invalid media interval`);
};
const assertionViolations = (
  a: Assertion,
  claimIndex: ClaimIndex,
  previous: O.Option<Assertion>
): ReadonlyArray<string> =>
  A.flatten([
    linkViolations(a, claimIndex),
    flag(
      HashSet.has(internalOnlyKinds, a.sourceRef.kind) && a.audience !== "internal",
      `Assertion ${a.id}: internal-only source requires internal audience`
    ),
    flag(
      O.exists(previous, (p) => !sameCapture(p, a)),
      `Assertion ${a.id}: inconsistent capture metadata`
    ),
    selectorViolations(a),
    flag(
      a.derivation.basis !== "none" && Str.isEmpty(Str.trim(a.derivation.ref)),
      `Assertion ${a.id}: derivation requires a reference`
    ),
  ]);
// Each assertion is compared with the most recent earlier assertion of the same capture.
const everyAssertionViolations = (
  assertions: ReadonlyArray<Assertion>,
  claimIndex: ClaimIndex
): ReadonlyArray<string> => {
  const captures = MutableHashMap.empty<string, Assertion>();
  return A.flatMap(assertions, (a) => {
    const previous = MutableHashMap.get(captures, a.captureId);
    MutableHashMap.set(captures, a.captureId, a);
    return assertionViolations(a, claimIndex, previous);
  });
};
const claimViolations = (c: KbClaim, claimIndex: ClaimIndex, assertionIndex: AssertionIndex): ReadonlyArray<string> =>
  A.flatten([
    A.flatMap(A.appendAll(c.supportedBy, c.challengedBy), (id) =>
      flag(
        !O.exists(HashMap.get(assertionIndex, id), (a) => a.claimId === c.id),
        `Claim ${c.id}: missing or mismatched assertion ${id}`
      )
    ),
    flag(
      O.exists(c.supersedes, (id) => id === c.id || !HashMap.has(claimIndex, id)),
      `Claim ${c.id}: invalid supersedes reference`
    ),
    flag(
      O.exists(c.supersedes, (id) =>
        O.exists(HashMap.get(claimIndex, id), (previous) => previous.logicalKey !== c.logicalKey)
      ),
      `Claim ${c.id}: supersedes a different proposition`
    ),
  ]);
const isOutwardEligible = (
  c: KbClaim,
  superseded: HashSet.HashSet<string>,
  assertions: ReadonlyArray<Assertion>
): boolean =>
  c.review._tag === "Accepted" &&
  !HashSet.has(superseded, c.id) &&
  O.isNone(c.knowledge.expiredAt) &&
  A.some(assertions, (a) => a.claimId === c.id && A.contains(c.supportedBy, a.id) && isOutwardAssertion(a));
const outwardEligibleIds = (
  claims: ReadonlyArray<KbClaim>,
  assertions: ReadonlyArray<Assertion>
): ReadonlyArray<string> => {
  const superseded = HashSet.fromIterable(A.getSomes(A.map(claims, (c) => c.supersedes)));
  return A.sort(
    A.map(
      A.filter(claims, (c) => isOutwardEligible(c, superseded, assertions)),
      (c) => c.id
    ),
    Str.Order
  );
};

/**
 * Validate cross-row references, capture audience consistency and selector sanity.
 * **Example** (Validate an empty ledger)
 * ```ts
 * import { validateKb } from "@beep/repo-cli/commands/Kb"
 * console.log(validateKb([], []).valid)
 * ```
 * @category validation
 * @since 0.0.0
 */
export const validateKb: {
  (claims: ReadonlyArray<KbClaim>, assertions: ReadonlyArray<Assertion>): KbReport;
  (assertions: ReadonlyArray<Assertion>): (claims: ReadonlyArray<KbClaim>) => KbReport;
} = dual(2, (claims: ReadonlyArray<KbClaim>, assertions: ReadonlyArray<Assertion>): KbReport => {
  const claimIndex = HashMap.fromIterable(A.map(claims, (c) => Tuple.make(c.id, c)));
  const assertionIndex = HashMap.fromIterable(A.map(assertions, (a) => Tuple.make(a.id, a)));
  const violations = A.flatten([
    flag(HashMap.size(claimIndex) !== A.length(claims), "Duplicate claim ids"),
    flag(HashMap.size(assertionIndex) !== A.length(assertions), "Duplicate assertion ids"),
    everyAssertionViolations(assertions, claimIndex),
    A.flatMap(claims, (c) => claimViolations(c, claimIndex, assertionIndex)),
  ]);
  return KbReport.make({
    valid: A.isReadonlyArrayEmpty(violations),
    claims: A.length(claims),
    assertions: A.length(assertions),
    outwardEligible: outwardEligibleIds(claims, assertions),
    violations,
  });
});

/**
 * Select claims before projection, then remove ineligible evidence from outward claims.
 * **Example** (Select an empty outward ledger)
 * ```ts
 * import { selectKb } from "@beep/repo-cli/commands/Kb"
 * console.log(selectKb([], [], "outward").claims.length)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const selectKb: {
  (claims: ReadonlyArray<KbClaim>, assertions: ReadonlyArray<Assertion>, view: KbView): KbSnapshot;
  (assertions: ReadonlyArray<Assertion>, view: KbView): (claims: ReadonlyArray<KbClaim>) => KbSnapshot;
} = dual(3, (claims: ReadonlyArray<KbClaim>, assertions: ReadonlyArray<Assertion>, view: KbView): KbSnapshot => {
  const report = validateKb(claims, assertions);
  const eligible = HashSet.fromIterable(report.valid ? report.outwardEligible : []);
  const selected = view === "outward" ? A.filter(claims, (c) => HashSet.has(eligible, c.id)) : claims;
  const selectedIds = HashSet.fromIterable(A.map(selected, (c) => c.id));
  const evidence = A.filter(
    assertions,
    (a) => HashSet.has(selectedIds, a.claimId) && (view === "planning" || isOutwardAssertion(a))
  );
  return KbSnapshot.make({ claims: selected, assertions: evidence, report });
});

/**
 * File-backed ledger contract. Root is always supplied by the caller.
 * **Example** (Access the service tag)
 * ```ts
 * import { KbLedger } from "@beep/repo-cli/commands/Kb"
 * console.log(KbLedger.key)
 * ```
 * @category services
 * @since 0.0.0
 */
export class KbLedger extends Context.Service<
  KbLedger,
  {
    readonly read: (root: string) => Effect.Effect<KbSnapshot, KbError>;
    readonly readRegistry: (root: string) => Effect.Effect<ReadonlyArray<KbRegistryNode>, KbError>;
  }
>()($I`KbLedger`) {}

/**
 * Capture platform dependencies inside the ledger implementation.
 * **Example** (Construct the service effect)
 * ```ts
 * import { makeKbLedger } from "@beep/repo-cli/commands/Kb"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(makeKbLedger))
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeKbLedger = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const readRows = Effect.fn("Kb.readRows")(function* <C extends S.Top & { readonly DecodingServices: never }>(
    schema: C,
    file: string
  ) {
    const text = yield* fs
      .readFileString(file)
      .pipe(Effect.mapError(() => KbError.make({ message: `Cannot read ${path.basename(file)}` })));
    return yield* Effect.forEach(
      A.filter(Line.split(text), (line) => !Line.isBlank(line)),
      Effect.fnUntraced(function* (line) {
        const parsed = Line.parseResult(line);
        if (Result.isFailure(parsed))
          return yield* KbError.make({ message: `Malformed JSON in ${path.basename(file)} at byte ${line.offset}` });
        return yield* S.decodeUnknownEffect(schema)(parsed.success.value).pipe(
          Effect.mapError(() =>
            KbError.make({ message: `Invalid row in ${path.basename(file)} at byte ${line.offset}` })
          )
        );
      })
    );
  });
  return KbLedger.of({
    readRegistry: Effect.fn("KbLedger.readRegistry")(function* (root) {
      const file = path.join(root, "registry.jsonl");
      const exists = yield* fs
        .exists(file)
        .pipe(Effect.mapError(() => KbError.make({ message: "Cannot inspect registry.jsonl" })));
      const rows = exists ? yield* readRows(KbRegistryNode, file) : [];
      if (HashSet.size(HashSet.fromIterable(A.map(rows, (row) => row.id))) !== A.length(rows))
        return yield* KbError.make({ message: "Duplicate registry ids" });
      return rows;
    }),
    read: Effect.fn("KbLedger.read")(function* (root) {
      const claims = yield* readRows(KbClaim, path.join(root, "claims.jsonl"));
      const assertions = yield* readRows(Assertion, path.join(root, "assertions.jsonl"));
      return KbSnapshot.make({ claims, assertions, report: validateKb(claims, assertions) });
    }),
  });
});
