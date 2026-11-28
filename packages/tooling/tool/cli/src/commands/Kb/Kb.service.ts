/**
 * Schema-decoded knowledge ledger service and structural admission checks.
 * @packageDocumentation
 * @since 0.0.0
 */
import { claimReferenceKey } from "@beep/epistemics/ClaimImport.schema";
import { $RepoCliId } from "@beep/identity/packages";
import { Line } from "@beep/jsonl/Line";
import { isUtf16Boundary, TextAnchor } from "@beep/text/TextAnchor";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
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
import { withAppendLock } from "../../internal/claims/AppendLock.ts";
import { decodeKbAssertionLine, decodeKbClaimLine, joinKbClaims, planKbAppend } from "./internal/KbStore.ts";
import { KbError } from "./Kb.errors.ts";
import {
  KbReport,
  KbSnapshot,
  kbClaimKey,
  kbClaimLabel,
  kbLogicalKey,
  kbProposition,
  kbReferenceLabel,
} from "./Kb.schemas.ts";
import { KbRegistryNode } from "./KbGraph.schemas.ts";
import type { ClaimHistoryRefused } from "../../internal/claims/ClaimHistory.ts";
import type { Assertion, KbClaim, KbClaimEvent, KbView } from "./Kb.schemas.ts";

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
  A.contains(claim.evidence.supportedBy, id) || A.contains(claim.evidence.challengedBy, id);
const linkViolations = (a: Assertion, claimIndex: ClaimIndex): ReadonlyArray<string> =>
  O.match(HashMap.get(claimIndex, claimReferenceKey(a.claim)), {
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
const everyAssertionViolations = (
  assertions: ReadonlyArray<Assertion>,
  claimIndex: ClaimIndex
): ReadonlyArray<string> => {
  const latestAssertionByCapture = MutableHashMap.empty<string, Assertion>();
  return A.flatMap(assertions, (a) => {
    const previous = MutableHashMap.get(latestAssertionByCapture, a.captureId);
    MutableHashMap.set(latestAssertionByCapture, a.captureId, a);
    return assertionViolations(a, claimIndex, previous);
  });
};
const claimViolations = (c: KbClaim, claimIndex: ClaimIndex, assertionIndex: AssertionIndex): ReadonlyArray<string> =>
  A.flatten([
    A.flatMap(A.flatten([c.evidence.supportedBy, c.evidence.challengedBy]), (id) =>
      flag(
        !O.exists(HashMap.get(assertionIndex, id), (a) => claimReferenceKey(a.claim) === kbClaimKey(c)),
        `Claim ${kbClaimLabel(c)}: missing or mismatched assertion ${id}`
      )
    ),
    flag(
      O.exists(O.map(c.predecessor, claimReferenceKey), (id) => id === kbClaimKey(c) || !HashMap.has(claimIndex, id)),
      `Claim ${kbClaimLabel(c)}: invalid supersedes reference`
    ),
    flag(
      O.exists(O.map(c.predecessor, claimReferenceKey), (id) =>
        O.exists(
          HashMap.get(claimIndex, id),
          (previous) => kbLogicalKey(kbProposition(previous)) !== kbLogicalKey(kbProposition(c))
        )
      ),
      `Claim ${kbClaimLabel(c)}: supersedes a different proposition`
    ),
  ]);
const isOutwardEligible = (
  c: KbClaim,
  superseded: HashSet.HashSet<string>,
  assertions: ReadonlyArray<Assertion>
): boolean =>
  c.review._tag === "Accepted" &&
  !HashSet.has(superseded, kbClaimKey(c)) &&
  O.isNone(c.knowledge.end) &&
  A.some(
    assertions,
    (a) =>
      claimReferenceKey(a.claim) === kbClaimKey(c) && A.contains(c.evidence.supportedBy, a.id) && isOutwardAssertion(a)
  );
const outwardEligibleIds = (
  claims: ReadonlyArray<KbClaim>,
  assertions: ReadonlyArray<Assertion>
): ReadonlyArray<string> => {
  const superseded = HashSet.fromIterable(A.getSomes(A.map(claims, (c) => O.map(c.predecessor, claimReferenceKey))));
  return A.sort(
    A.map(
      A.filter(claims, (c) => isOutwardEligible(c, superseded, assertions)),
      kbClaimLabel
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
  const claimIndex = HashMap.fromIterable(A.map(claims, (c) => Tuple.make(kbClaimKey(c), c)));
  const assertionIndex = HashMap.fromIterable(A.map(assertions, (a) => Tuple.make(a.id, a)));
  const violations = A.flatten([
    flag(
      HashMap.size(claimIndex) !== A.length(claims) ||
        HashSet.size(HashSet.fromIterable(A.map(claims, kbClaimLabel))) !== A.length(claims),
      "Duplicate claim ids"
    ),
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
  const selected = view === "outward" ? A.filter(claims, (c) => HashSet.has(eligible, kbClaimLabel(c))) : claims;
  const selectedIds = HashSet.fromIterable(A.map(selected, (c) => kbClaimKey(c)));
  const evidence = A.filter(
    assertions,
    (a) => HashSet.has(selectedIds, claimReferenceKey(a.claim)) && (view === "planning" || isOutwardAssertion(a))
  );
  return KbSnapshot.make({ claims: selected, assertions: evidence, report });
});

/**
 * File-backed ledger contract. Root is always supplied by the caller.
 *
 * **Details**
 * Reads accept frozen v1 rows and v2 records line by line; appends write v2 records only and
 * never rewrite an existing line.
 *
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
    readonly append: (root: string, events: ReadonlyArray<KbClaimEvent>) => Effect.Effect<void, KbError>;
  }
>()($I`KbLedger`) {}

const refusedMessage = (refused: ClaimHistoryRefused): string =>
  `Claim history refused (${refused.reason}): ${refused.claim}`;

const evidenceLinkViolations = (
  events: ReadonlyArray<KbClaimEvent>,
  assertions: ReadonlyArray<Assertion>
): ReadonlyArray<string> => {
  const assertionIndex = HashMap.fromIterable(A.map(assertions, (a) => Tuple.make(a.id, a)));
  return A.flatMap(events, (event) =>
    event.event === "Evidence"
      ? A.flatMap(A.flatten([event.supportedBy, event.challengedBy]), (id) =>
          flag(
            !O.exists(
              HashMap.get(assertionIndex, id),
              (a) => claimReferenceKey(a.claim) === claimReferenceKey(event.claim)
            ),
            `Evidence for ${kbReferenceLabel(event.claim)}: missing or mismatched assertion ${id}`
          )
        )
      : A.empty<string>()
  );
};

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
  const digest = yield* Digest.Digest;
  const withDigest = Effect.provideService(Digest.Digest, digest);
  const readText = (file: string) =>
    fs
      .readFileString(file)
      .pipe(Effect.mapError(() => KbError.make({ message: `Cannot read ${path.basename(file)}` })));
  const decodeRows = Effect.fn("Kb.decodeRows")(function* <Row, E>(
    file: string,
    text: string,
    decode: (text: string, json: unknown) => Effect.Effect<Row, E, Digest.Digest>
  ) {
    return yield* Effect.forEach(
      A.filter(Line.split(text), (line) => !Line.isBlank(line)),
      Effect.fnUntraced(function* (line) {
        const parsed = Line.parseResult(line);
        if (Result.isFailure(parsed))
          return yield* KbError.make({ message: `Malformed JSON in ${path.basename(file)} at byte ${line.offset}` });
        return yield* decode(line.text, parsed.success.value).pipe(
          Effect.mapError(() =>
            KbError.make({ message: `Invalid row in ${path.basename(file)} at byte ${line.offset}` })
          )
        );
      }),
      { concurrency: 1 }
    ).pipe(withDigest);
  });
  const readRows = <Row, E>(
    file: string,
    decode: (text: string, json: unknown) => Effect.Effect<Row, E, Digest.Digest>
  ) => Effect.flatMap(readText(file), (text) => decodeRows(file, text, decode));
  const readClaimLines = (root: string) => readRows(path.join(root, "claims.jsonl"), decodeKbClaimLine);
  const readAssertions = (root: string) =>
    readRows(path.join(root, "assertions.jsonl"), (_text, json) => decodeKbAssertionLine(json));
  const inspect = (file: string) =>
    fs.exists(file).pipe(Effect.mapError(() => KbError.make({ message: `Cannot inspect ${path.basename(file)}` })));
  const appendUnlocked = Effect.fnUntraced(function* (root: string, events: ReadonlyArray<KbClaimEvent>) {
    const file = path.join(root, "claims.jsonl");
    const text = (yield* inspect(file)) ? yield* readText(file) : "";
    const existing = yield* decodeRows(file, text, decodeKbClaimLine);
    const lines = yield* planKbAppend(existing, events).pipe(
      withDigest,
      Effect.mapError((cause) =>
        KbError.make({
          message: cause._tag === "ClaimHistoryRefused" ? refusedMessage(cause) : "Cannot encode claim records",
        })
      )
    );
    const assertions = (yield* inspect(path.join(root, "assertions.jsonl"))) ? yield* readAssertions(root) : [];
    const broken = evidenceLinkViolations(events, assertions);
    if (A.isReadonlyArrayNonEmpty(broken)) return yield* KbError.make({ message: A.join(broken, "; ") });
    const separator = Str.isEmpty(text) || Str.endsWith("\n")(text) ? "" : "\n";
    yield* fs
      .writeFileString(file, `${separator}${A.join(lines, "\n")}\n`, { flag: "a" })
      .pipe(Effect.mapError(() => KbError.make({ message: "Cannot append to claims.jsonl" })));
  });
  return KbLedger.of({
    readRegistry: Effect.fn("KbLedger.readRegistry")(function* (root) {
      const file = path.join(root, "registry.jsonl");
      const rows = (yield* inspect(file))
        ? yield* readRows(file, (_text, json) => S.decodeUnknownEffect(KbRegistryNode)(json))
        : [];
      if (HashSet.size(HashSet.fromIterable(A.map(rows, (row) => row.id))) !== A.length(rows))
        return yield* KbError.make({ message: "Duplicate registry ids" });
      return rows;
    }),
    read: Effect.fn("KbLedger.read")(function* (root) {
      const lines = yield* readClaimLines(root);
      const claims = yield* joinKbClaims(lines).pipe(
        withDigest,
        Effect.mapError((refused) => KbError.make({ message: refusedMessage(refused) }))
      );
      const assertions = yield* readAssertions(root);
      return KbSnapshot.make({ claims, assertions, report: validateKb(claims, assertions) });
    }),
    append: Effect.fn("KbLedger.append")(function* (root, events) {
      if (A.isReadonlyArrayEmpty(events)) return;
      if (!(yield* inspect(root))) return yield* KbError.make({ message: "Ledger root does not exist" });
      yield* appendUnlocked(root, events).pipe(
        withAppendLock({
          platform: { fs, path, digest },
          lockFile: path.join(root, "claims.jsonl.lock"),
          busy: KbError.make({ message: "claims.jsonl is locked by another running append; retry once it finishes" }),
        })
      );
    }),
  });
});
