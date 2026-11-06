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
  let violations = A.empty<string>();
  const claimIndex = HashMap.fromIterable(A.map(claims, (c) => Tuple.make(c.id, c)));
  const assertionIndex = HashMap.fromIterable(A.map(assertions, (a) => Tuple.make(a.id, a)));
  if (HashMap.size(claimIndex) !== A.length(claims)) violations = A.append(violations, "Duplicate claim ids");
  if (HashMap.size(assertionIndex) !== A.length(assertions))
    violations = A.append(violations, "Duplicate assertion ids");
  let captures = HashMap.empty<string, Assertion>();
  for (const a of assertions) {
    const claim = HashMap.get(claimIndex, a.claimId);
    if (O.isNone(claim)) violations = A.append(violations, `Assertion ${a.id}: missing claim`);
    else if (!A.contains(claim.value.supportedBy, a.id) && !A.contains(claim.value.challengedBy, a.id))
      violations = A.append(violations, `Assertion ${a.id}: absent from claim evidence links`);
    if (HashSet.has(internalOnlyKinds, a.sourceRef.kind) && a.audience !== "internal")
      violations = A.append(violations, `Assertion ${a.id}: internal-only source requires internal audience`);
    const previous = HashMap.get(captures, a.captureId);
    if (
      O.isSome(previous) &&
      (previous.value.audience !== a.audience ||
        previous.value.sourceRef.sha256 !== a.sourceRef.sha256 ||
        previous.value.sourceRef.kind !== a.sourceRef.kind ||
        previous.value.sourceRef.locator !== a.sourceRef.locator)
    )
      violations = A.append(violations, `Assertion ${a.id}: inconsistent capture metadata`);
    captures = HashMap.set(captures, a.captureId, a);
    const selector = a.selector;
    if (selector._tag === "TextQuote") {
      if (
        selector.exact !== a.quote ||
        !TextAnchor.isInternallyConsistent({ startChar: selector.start, endChar: selector.end, quote: selector.exact })
      )
        violations = A.append(violations, `Assertion ${a.id}: invalid UTF-16 quote range`);
      const text = a.sourceRef.text;
      if (
        text !== undefined &&
        (!isUtf16Boundary(text, selector.start) ||
          !isUtf16Boundary(text, selector.end) ||
          Str.slice(selector.start, selector.end)(text) !== selector.exact ||
          !Str.endsWith(selector.prefix)(Str.slice(0, selector.start)(text)) ||
          !Str.startsWith(selector.suffix)(Str.slice(selector.end)(text)))
      )
        violations = A.append(violations, `Assertion ${a.id}: quote or context does not match capture text`);
    } else if (selector.end <= selector.start)
      violations = A.append(violations, `Assertion ${a.id}: invalid media interval`);
    if (a.derivation.basis !== "none" && Str.isEmpty(Str.trim(a.derivation.ref)))
      violations = A.append(violations, `Assertion ${a.id}: derivation requires a reference`);
  }
  for (const c of claims) {
    for (const id of A.appendAll(c.supportedBy, c.challengedBy)) {
      if (!O.exists(HashMap.get(assertionIndex, id), (a) => a.claimId === c.id))
        violations = A.append(violations, `Claim ${c.id}: missing or mismatched assertion ${id}`);
    }
    if (O.exists(c.supersedes, (id) => id === c.id || !HashMap.has(claimIndex, id)))
      violations = A.append(violations, `Claim ${c.id}: invalid supersedes reference`);
    if (
      O.exists(c.supersedes, (id) =>
        O.exists(HashMap.get(claimIndex, id), (previous) => previous.logicalKey !== c.logicalKey)
      )
    )
      violations = A.append(violations, `Claim ${c.id}: supersedes a different proposition`);
  }
  const superseded = HashSet.fromIterable(A.getSomes(A.map(claims, (c) => c.supersedes)));
  const outwardEligible = A.map(
    A.filter(
      claims,
      (c) =>
        c.review._tag === "Accepted" &&
        !HashSet.has(superseded, c.id) &&
        O.isNone(c.knowledge.expiredAt) &&
        A.some(assertions, (a) => a.claimId === c.id && A.contains(c.supportedBy, a.id) && isOutwardAssertion(a))
    ),
    (c) => c.id
  );
  return KbReport.make({
    valid: A.isReadonlyArrayEmpty(violations),
    claims: A.length(claims),
    assertions: A.length(assertions),
    outwardEligible: A.sort(outwardEligible, Str.Order),
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
