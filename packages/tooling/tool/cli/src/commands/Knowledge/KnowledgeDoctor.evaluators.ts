/**
 * The knowledge doctor's domain evaluators: goal-packet claims, `@beep/*` symbols, and the hermetic
 * skills evaluator, plus the prose readers that extract their spans. Every evaluator reads only the
 * doctor tree it is given and returns witness-bearing outcomes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { isGoalStatus } from "../Goals/Goals.schemas.ts";
import { SkillGitRevision } from "../Skills/Skills.schemas.ts";
import { knowledgeInlineSpans, knowledgeLineMatches } from "./Knowledge.refs.ts";
import { KnowledgeFindingCandidate, KnowledgeFindingLocation } from "./Knowledge.schemas.ts";
import { KNOWLEDGE_SKILLS_DIR, KNOWLEDGE_SKILLS_LOCK_PATH, KNOWLEDGE_TSCONFIG_PATH } from "./KnowledgeDoctor.domain.ts";
import {
  EvaluationFailed,
  EvaluationResolved,
  ExportWitness,
  KnowledgeEvaluationFailure,
  KnowledgePackageEntrypoint,
  KnowledgeSpan,
  KnowledgeSpanForm,
  LockEntryWitness,
  ManifestFieldWitness,
  TreeEntryWitness,
} from "./KnowledgeDoctor.schemas.ts";
import type { GoalDoctorFindingKind } from "../Goals/Doctor.ts";
import type { KnowledgeOperationalError } from "./Knowledge.errors.ts";
import type { KnowledgeDocumentFenceLine } from "./Knowledge.refs.ts";
import type { KnowledgeFindingKind } from "./Knowledge.schemas.ts";
import type { KnowledgeDoctorDomain } from "./KnowledgeDoctor.domain.ts";
import type {
  KnowledgeEvaluationOutcome,
  KnowledgePacketFacts,
  KnowledgeSkillLockFacts,
  KnowledgeWorkspacePackage,
  ResolutionWitness,
} from "./KnowledgeDoctor.schemas.ts";
import type { KnowledgeDoctorTree, KnowledgeEvaluator } from "./KnowledgeDoctor.service.ts";

const nfc = Str.normalize("NFC");

/* -------------------------------------------------------------------------------------------------
 * Shared outcome builders
 * ---------------------------------------------------------------------------------------------- */

/**
 * The document identity a doctor finding is filed under.
 *
 * **Example** (Identify a document)
 *
 * ```ts
 * import { knowledgeDoctorDocumentId } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 *
 * console.log(knowledgeDoctorDocumentId("AGENTS.md")) // "tree:AGENTS.md"
 * ```
 *
 * @param documentPath - Repository path of the document a span came from.
 * @returns The NFC `tree:`-prefixed document identity.
 * @category constructors
 * @since 0.0.0
 */
export const knowledgeDoctorDocumentId = (documentPath: string): string => nfc(`tree:${documentPath}`);

/**
 * The cause key of one goals-doctor finding, shared by the delegated finding and by every knowledge
 * claim it explains.
 *
 * **Details**
 *
 * The key is `goals-doctor:<kind>:<slug>`, suffixed with `:<detail>` when the goals doctor
 * distinguishes several findings of one kind in a packet (a reflection file name, a capability). A
 * packet-status claim under a missing or invalid manifest uses the same key, which is what lets the
 * manifest finding collapse the claims beneath it into one group.
 *
 * **Example** (Key an invalid manifest)
 *
 * ```ts
 * import { knowledgeGoalsDoctorCauseKey } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 *
 * console.log(knowledgeGoalsDoctorCauseKey({ kind: "manifest-invalid", slug: "demo" })) // "goals-doctor:manifest-invalid:demo"
 * ```
 *
 * @param cause - Goals-doctor finding kind, packet slug, and the goals doctor's key suffix when it has one.
 * @returns `goals-doctor:<kind>:<slug>`, with `:<detail>` appended when a detail is given.
 * @category constructors
 * @since 0.0.0
 */
export const knowledgeGoalsDoctorCauseKey = (cause: {
  readonly kind: GoalDoctorFindingKind;
  readonly slug: string;
  readonly detail?: string | undefined;
}): string =>
  pipe(
    O.fromUndefinedOr(cause.detail),
    O.filter(Str.isNonEmpty),
    O.match({
      onNone: () => `goals-doctor:${cause.kind}:${cause.slug}`,
      onSome: (detail) => `goals-doctor:${cause.kind}:${cause.slug}:${detail}`,
    })
  );

type KnowledgeFailureFields = {
  readonly kind: KnowledgeFindingKind;
  readonly subject: string;
  readonly message: string;
  readonly remediation: string;
  readonly causeKey: string;
};

/**
 * Builds one evaluation failure for a span.
 *
 * **Example** (Fail a path span)
 *
 * ```ts
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { knowledgeEvaluationFailure } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 * import { KnowledgeSpan } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const span = KnowledgeSpan.make({
 *   form: "path",
 *   documentPath: "AGENTS.md",
 *   surface: "live",
 *   location: KnowledgeFindingLocation.make({ path: "AGENTS.md" }),
 *   raw: "goals/missing.md",
 *   generatedBy: O.none(),
 *   citation: O.none(),
 * })
 * const row = knowledgeEvaluationFailure(span, {
 *   kind: "broken-tracked-path",
 *   subject: "repo-path:goals/missing.md",
 *   message: "Tracked path does not exist: goals/missing.md.",
 *   remediation: "Update the inline path.",
 *   causeKey: "path:goals/missing.md",
 * })
 *
 * console.log(row.candidate.documentId) // "tree:AGENTS.md"
 * ```
 *
 * @param span - Span the failure belongs to.
 * @param fields - Finding kind, subject, message, remediation, and cause identity.
 * @returns The failure, with subject and cause normalized to NFC.
 * @category constructors
 * @since 0.0.0
 */
export const knowledgeEvaluationFailure: {
  (fields: KnowledgeFailureFields): (span: KnowledgeSpan) => KnowledgeEvaluationFailure;
  (span: KnowledgeSpan, fields: KnowledgeFailureFields): KnowledgeEvaluationFailure;
} = dual(
  2,
  (span: KnowledgeSpan, fields: KnowledgeFailureFields): KnowledgeEvaluationFailure =>
    KnowledgeEvaluationFailure.make({
      candidate: KnowledgeFindingCandidate.make({
        kind: fields.kind,
        documentId: knowledgeDoctorDocumentId(span.documentPath),
        subject: nfc(fields.subject),
        location: span.location,
        message: fields.message,
        remediation: fields.remediation,
      }),
      causeKey: nfc(fields.causeKey),
    })
);

const failedWith = (first: KnowledgeEvaluationFailure, ...rest: ReadonlyArray<KnowledgeEvaluationFailure>) =>
  EvaluationFailed.make({ failures: [first, ...rest] });

const resolvedBy = (first: ResolutionWitness, ...rest: ReadonlyArray<ResolutionWitness>) =>
  EvaluationResolved.make({ witnesses: [first, ...rest], unchecked: [] });

const outcomeOf = (
  failures: ReadonlyArray<KnowledgeEvaluationFailure>,
  witnesses: () => readonly [ResolutionWitness, ...ReadonlyArray<ResolutionWitness>]
): KnowledgeEvaluationOutcome =>
  A.match(failures, {
    onNonEmpty: ([first, ...rest]): KnowledgeEvaluationOutcome => failedWith(first, ...rest),
    onEmpty: (): KnowledgeEvaluationOutcome => {
      const [first, ...rest] = witnesses();
      return resolvedBy(first, ...rest);
    },
  });

/* -------------------------------------------------------------------------------------------------
 * Prose readers
 * ---------------------------------------------------------------------------------------------- */

const PACKET_STATUS_CLAIM_PATTERN = /`goals\/([a-z0-9][a-z0-9-]*)\/?`([^`\r\n]{0,32}?)`([a-z-]+)`/gu;
const CLAIM_GAP_PATTERN = /^[\s(:=,]*(?:(?:is|now|currently|lifecycle|status|stays|remains|→|->)[\s(:=,]*)*$/u;
const SYMBOL_SPAN_PATTERN = /^@beep\/[a-z0-9][a-z0-9-]*(?:\/[A-Za-z0-9._-]+)*(?:#[\w:.-]+)?$/u;
const SYMBOL_EXPORT_CLAIM_PATTERN = /`([A-Za-z_$][\w$]*)` from `(@beep\/[a-z0-9][a-z0-9-]*(?:\/[A-Za-z0-9._-]+)*)`/gu;
const PACKET_README_PATTERN = /^goals\/([a-z0-9][a-z0-9-]*)\/README\.md$/u;
// Live READMEs write `## Current Phase`, `## Current phase`, and titled variants such as
// `## Current phase — MCP toolkit expansion`; the phase id itself is on the body line.
const CURRENT_PHASE_HEADING_PATTERN = /^##[ \t]+current[ \t]+phase\b.*$/iu;
const PHASE_CLAIM_PATTERN = /^(?:\*\*|`)?(P\d+)\b/u;

type DomainLineSpan = readonly [KnowledgeSpanForm, string, number];

const columnOrder = Order.mapInput(Order.Number, (span: DomainLineSpan) => span[2]);

const packetStatusClaims = (lineText: string): ReadonlyArray<DomainLineSpan> =>
  A.getSomes(
    A.map(knowledgeLineMatches(PACKET_STATUS_CLAIM_PATTERN, lineText), (match) => {
      const [, slug = "", gap = "", status = ""] = match;
      return CLAIM_GAP_PATTERN.test(gap) && isGoalStatus(status)
        ? O.some<DomainLineSpan>(["packet-status", `goals/${slug} ${status}`, match.index + 1])
        : O.none();
    })
  );

const symbolExportClaims = (lineText: string): ReadonlyArray<readonly [DomainLineSpan, number]> =>
  A.map(knowledgeLineMatches(SYMBOL_EXPORT_CLAIM_PATTERN, lineText), (match) => {
    const [whole, name = "", specifier = ""] = match;
    const specifierColumn = match.index + Str.length(whole) - Str.length(specifier) - 1;
    return [["symbol-export", `${name} from ${specifier}`, match.index + 1], specifierColumn] as const;
  });

/**
 * Whether an inline code span names an `@beep/*` package, subpath, or package-scoped task.
 *
 * **Details**
 *
 * A package (`@beep/schema`), a subpath (`@beep/schema/LiteralKit`), and a Turborepo task id
 * (`@beep/repo-cli#test`, read for its package) qualify. Globs such as `@beep/*` and colon-joined
 * task spellings do not.
 *
 * **Example** (Separate a package from a glob)
 *
 * ```ts
 * import { isKnowledgeSymbolSpan } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 *
 * console.log(isKnowledgeSymbolSpan("@beep/schema/LiteralKit")) // true
 * console.log(isKnowledgeSymbolSpan("@beep/*")) // false
 * ```
 *
 * @param span - Inline code span content.
 * @returns Whether the symbols evaluator reads the span.
 * @category predicates
 * @since 0.0.0
 */
export const isKnowledgeSymbolSpan = (span: string): boolean => SYMBOL_SPAN_PATTERN.test(span);

/**
 * Reads the domain spans of one prose line: packet-status claims, imported-symbol claims, and
 * `@beep/*` spans, in source order.
 *
 * **Details**
 *
 * A packet-status claim is a `goals/<slug>` span followed on the same line by a lifecycle-word span,
 * with only connective text between them (`(`, `is`, `now`, `lifecycle`, `status`, an arrow); a
 * past-tense or plural connective (`was`, `both`) is not a current claim and is skipped. An
 * imported-symbol claim is an identifier span, the word `from`, and an `@beep/...` specifier span;
 * the specifier span is read once, as part of the claim. Columns are 1-based and point at the claim's first backtick.
 *
 * **Example** (Read a status claim and a symbol claim)
 *
 * ```ts
 * import { knowledgeDomainLineSpans } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 *
 * console.log(knowledgeDomainLineSpans("`goals/x` (`active`) uses `LiteralKit` from `@beep/schema`."))
 * // [ [ "packet-status", "goals/x active", 1 ], [ "symbol-export", "LiteralKit from @beep/schema", 27 ] ]
 * ```
 *
 * @param lineText - One prose line.
 * @returns Form, raw claim text, and column of every domain span on the line.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeDomainLineSpans = (lineText: string): ReadonlyArray<DomainLineSpan> => {
  const exportClaims = symbolExportClaims(lineText);
  const consumed = HashSet.fromIterable(A.map(exportClaims, ([, column]) => column));
  const symbols = A.getSomes(
    A.map(knowledgeInlineSpans(lineText), (inline) =>
      isKnowledgeSymbolSpan(inline.span) && !HashSet.has(consumed, inline.column)
        ? O.some<DomainLineSpan>(["symbol", inline.span, inline.column])
        : O.none()
    )
  );
  return A.sort(
    A.appendAll(
      A.appendAll(
        packetStatusClaims(lineText),
        A.map(exportClaims, ([span]) => span)
      ),
      symbols
    ),
    columnOrder
  );
};

/**
 * Reads the current-phase claim of a goal packet README: the phase id that opens the first
 * non-blank line under `## Current Phase`.
 *
 * **Example** (Read a packet's current phase)
 *
 * ```ts
 * import { knowledgeDocumentFenceLines } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { knowledgeCurrentPhaseClaim } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 * import * as O from "effect/Option"
 *
 * const lines = knowledgeDocumentFenceLines("# Demo\n\n## Current Phase\n\nP2 in progress.")
 *
 * console.log(O.getOrNull(knowledgeCurrentPhaseClaim("goals/demo/README.md", lines))) // [ 5, "P2", 1 ]
 * ```
 *
 * @param documentPath - Repository path of the scanned document; only `goals/<slug>/README.md` reads.
 * @param lines - The document's fence-aware lines.
 * @returns The claim's 1-based line, phase id, and column, when the README states one.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeCurrentPhaseClaim: {
  (
    lines: ReadonlyArray<KnowledgeDocumentFenceLine>
  ): (documentPath: string) => O.Option<readonly [number, string, number]>;
  (documentPath: string, lines: ReadonlyArray<KnowledgeDocumentFenceLine>): O.Option<readonly [number, string, number]>;
} = dual(
  2,
  (
    documentPath: string,
    lines: ReadonlyArray<KnowledgeDocumentFenceLine>
  ): O.Option<readonly [number, string, number]> =>
    PACKET_README_PATTERN.test(documentPath)
      ? pipe(
          A.findFirstIndex(lines, (line) => line.prose && CURRENT_PHASE_HEADING_PATTERN.test(line.text)),
          O.flatMap((heading) =>
            A.findFirst(A.drop(lines, heading + 1), (line) => Str.isNonEmpty(Str.trim(line.text)))
          ),
          O.filter((line) => line.prose),
          O.flatMap((line) =>
            pipe(
              O.fromNullishOr(PHASE_CLAIM_PATTERN.exec(line.text)?.[1]),
              O.map((phase) => [line.number, phase, 1] as const)
            )
          )
        )
      : O.none()
);

/* -------------------------------------------------------------------------------------------------
 * Packet-status evaluator
 * ---------------------------------------------------------------------------------------------- */

const STATUS_FIELD = "initiative.status";
const PACKET_REMEDIATION = "Update the claim to the packet's manifest, or the manifest to the claim.";

type PacketClaim = {
  readonly slug: string;
  readonly phase: boolean;
  readonly value: string;
};

const packetClaim = (span: KnowledgeSpan): PacketClaim =>
  KnowledgeSpanForm.is["packet-phase"](span.form)
    ? {
        slug: O.getOrElse(O.fromNullishOr(PACKET_README_PATTERN.exec(span.documentPath)?.[1]), () => ""),
        phase: true,
        value: span.raw,
      }
    : {
        slug: Str.slice(Str.length("goals/"))(A.headNonEmpty(Str.split(" ")(span.raw))),
        phase: false,
        value: A.lastNonEmpty(Str.split(" ")(span.raw)),
      };

const claimSubject = (claim: PacketClaim): string =>
  `${claim.phase ? "packet-phase" : "packet-status"}:${claim.slug}:${claim.value}`;

const packetFailure = (span: KnowledgeSpan, claim: PacketClaim, message: string, causeKey: string) =>
  failedWith(
    knowledgeEvaluationFailure(span, {
      kind: "packet-status-claim-drift",
      subject: claimSubject(claim),
      message,
      remediation: PACKET_REMEDIATION,
      causeKey,
    })
  );

const evaluateStatusClaim = (
  span: KnowledgeSpan,
  claim: PacketClaim,
  facts: KnowledgePacketFacts
): KnowledgeEvaluationOutcome =>
  O.match(facts.status, {
    onNone: () =>
      packetFailure(span, claim, `goals/${claim.slug} records no initiative.status.`, `packet-status:${claim.slug}`),
    onSome: (status) =>
      status === claim.value
        ? resolvedBy(ManifestFieldWitness.make({ slug: claim.slug, field: STATUS_FIELD }))
        : packetFailure(
            span,
            claim,
            `goals/${claim.slug} is "${status}" in its manifest, not "${claim.value}".`,
            `packet-status:${claim.slug}`
          ),
  });

const evaluatePhaseClaim = (
  span: KnowledgeSpan,
  claim: PacketClaim,
  facts: KnowledgePacketFacts
): KnowledgeEvaluationOutcome =>
  // Phase ids compare case-insensitively (record keys such as `p1` vs a `P1` claim); the
  // witness names the manifest's own spelling so removing it flips the claim.
  O.match(
    A.findFirst(facts.phaseIds, (id) => Str.toUpperCase(id) === Str.toUpperCase(claim.value)),
    {
      onSome: (id) => resolvedBy(ManifestFieldWitness.make({ slug: claim.slug, field: `phases.${id}` })),
      onNone: () =>
        packetFailure(
          span,
          claim,
          `goals/${claim.slug} declares no phase ${claim.value} (phases: ${A.join(facts.phaseIds, ", ") || "none"}).`,
          `packet-phase:${claim.slug}:${claim.value}`
        ),
    }
  );

const evaluateClaimAgainst = (
  span: KnowledgeSpan,
  claim: PacketClaim,
  facts: KnowledgePacketFacts
): KnowledgeEvaluationOutcome => {
  if (facts.manifest !== "decoded") {
    return packetFailure(
      span,
      claim,
      `goals/${claim.slug} claim cannot be checked: its ops/manifest.json is ${facts.manifest} (a goals doctor finding).`,
      knowledgeGoalsDoctorCauseKey({ kind: `manifest-${facts.manifest}`, slug: claim.slug })
    );
  }
  return claim.phase ? evaluatePhaseClaim(span, claim, facts) : evaluateStatusClaim(span, claim, facts);
};

const evaluatePacketSpan = Effect.fn("KnowledgeDoctor.evaluatePacketSpan")(function* (
  span: KnowledgeSpan,
  tree: KnowledgeDoctorTree
) {
  const claim = packetClaim(span);
  const packets = yield* tree.domain.packets;
  return O.match(
    A.findFirst(packets, (facts) => facts.slug === claim.slug),
    {
      onNone: () =>
        packetFailure(
          span,
          claim,
          `No goal packet goals/${claim.slug} exists in this tree.`,
          `path:goals/${claim.slug}`
        ),
      onSome: (facts) => evaluateClaimAgainst(span, claim, facts),
    }
  );
});

/**
 * The packet-status evaluator: lifecycle and phase claims checked against the goal manifests read
 * through the doctor tree.
 *
 * **Details**
 *
 * Manifests are read by the goals packet core's own readers (`parseGoalManifestText`,
 * `decodeGoalManifest`, `goalManifestPhases`) from tree bytes. A lifecycle claim resolves through the
 * manifest's `initiative.status`, a phase claim through the phase id. A missing or invalid manifest is
 * owned by `goals doctor`; the claims beneath it fail with that finding as their cause.
 *
 * **Example** (Read the evaluator identity)
 *
 * ```ts
 * import { KnowledgePacketStatusEvaluator } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 *
 * console.log(KnowledgePacketStatusEvaluator.id) // "packet-status"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const KnowledgePacketStatusEvaluator: KnowledgeEvaluator = {
  id: "packet-status",
  forms: ["packet-status", "packet-phase"],
  kinds: ["packet-status-claim-drift"],
  evaluate: evaluatePacketSpan,
};

/* -------------------------------------------------------------------------------------------------
 * Symbols evaluator
 * ---------------------------------------------------------------------------------------------- */

const MAX_EXPORT_SEARCH_FILES = 256;
const SYMBOL_REMEDIATION = "Update the reference to a package, subpath, or export the workspace declares.";

type SymbolClaim = {
  readonly specifier: string;
  readonly packageName: string;
  readonly key: string;
  readonly exportName: O.Option<string>;
};

const symbolClaim = (span: KnowledgeSpan): SymbolClaim => {
  const parts = Str.split(" from ")(span.raw);
  const exported = KnowledgeSpanForm.is["symbol-export"](span.form);
  const specifier = exported ? A.lastNonEmpty(parts) : A.headNonEmpty(Str.split("#")(span.raw));
  const segments = Str.split("/")(specifier);
  const rest = A.drop(segments, 2);
  return {
    specifier,
    packageName: A.join(A.take(segments, 2), "/"),
    key: A.isReadonlyArrayNonEmpty(rest) ? `./${A.join(rest, "/")}` : ".",
    exportName: exported ? O.some(A.headNonEmpty(parts)) : O.none(),
  };
};

const symbolFailure = (span: KnowledgeSpan, subject: string, message: string, causeKey: string) =>
  failedWith(
    knowledgeEvaluationFailure(span, {
      kind: "unknown-beep-symbol",
      subject,
      message,
      remediation: SYMBOL_REMEDIATION,
      causeKey,
    })
  );

const patternTarget = (entry: KnowledgePackageEntrypoint, key: string): O.Option<KnowledgePackageEntrypoint> => {
  const [prefix = "", suffix = ""] = Str.split("*")(entry.key);
  const fits =
    Str.startsWith(prefix)(key) &&
    Str.endsWith(suffix)(key) &&
    Str.length(key) > Str.length(prefix) + Str.length(suffix);
  return fits
    ? O.some(
        KnowledgePackageEntrypoint.make({
          key: entry.key,
          target: O.map(
            entry.target,
            Str.replace("*", Str.slice(Str.length(prefix), Str.length(key) - Str.length(suffix))(key))
          ),
        })
      )
    : O.none();
};

const patternLength = Order.mapInput(Order.Number, (entry: KnowledgePackageEntrypoint) => Str.length(entry.key));

/**
 * Matches a subpath against entry points the way Node resolves `exports`: an exact key first, then
 * the wildcard key with the longest pattern.
 *
 * **Example** (Resolve through a wildcard key)
 *
 * ```ts
 * import { matchKnowledgeEntrypoint } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 * import { KnowledgePackageEntrypoint } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const entry = matchKnowledgeEntrypoint(
 *   [KnowledgePackageEntrypoint.make({ key: "./commands/*", target: O.some("pkg/src/commands/*\/index.ts") })],
 *   "./commands/Goals"
 * )
 *
 * console.log(O.getOrNull(O.flatMap(entry, (value) => value.target))) // "pkg/src/commands/Goals/index.ts"
 * ```
 *
 * @param entrypoints - Exports-map keys or path aliases of one manifest.
 * @param key - Subpath (`.`, `./Sub`) or full specifier for a path alias.
 * @returns The matched entry point with its target substituted, when one matches.
 * @category predicates
 * @since 0.0.0
 */
export const matchKnowledgeEntrypoint: {
  (key: string): (entrypoints: ReadonlyArray<KnowledgePackageEntrypoint>) => O.Option<KnowledgePackageEntrypoint>;
  (entrypoints: ReadonlyArray<KnowledgePackageEntrypoint>, key: string): O.Option<KnowledgePackageEntrypoint>;
} = dual(
  2,
  (entrypoints: ReadonlyArray<KnowledgePackageEntrypoint>, key: string): O.Option<KnowledgePackageEntrypoint> =>
    O.orElse(
      A.findFirst(entrypoints, (entry) => entry.key === key),
      () =>
        A.head(
          A.sort(
            A.getSomes(
              A.map(
                A.filter(entrypoints, (entry) => Str.includes("*")(entry.key)),
                (entry) => patternTarget(entry, key)
              )
            ),
            Order.flip(patternLength)
          )
        )
    )
);

type ResolvedEntry = {
  readonly witness: ExportWitness;
  readonly target: O.Option<string>;
};

const resolveEntry = Effect.fn("KnowledgeDoctor.resolveSymbolEntry")(function* (
  domain: KnowledgeDoctorDomain,
  pkg: KnowledgeWorkspacePackage,
  claim: SymbolClaim
) {
  const fromExports = O.map(
    matchKnowledgeEntrypoint(pkg.entrypoints, claim.key),
    (entry): ResolvedEntry => ({
      witness: ExportWitness.make({ packageName: pkg.name, file: pkg.manifestPath, exportName: entry.key }),
      target: entry.target,
    })
  );
  if (O.isSome(fromExports)) {
    return fromExports;
  }
  const aliases = yield* domain.pathAliases;
  return O.map(
    matchKnowledgeEntrypoint(aliases, claim.specifier),
    (entry): ResolvedEntry => ({
      witness: ExportWitness.make({ packageName: pkg.name, file: KNOWLEDGE_TSCONFIG_PATH, exportName: entry.key }),
      target: entry.target,
    })
  );
});

const searchExport = (
  domain: KnowledgeDoctorDomain,
  name: string,
  frontier: ReadonlyArray<string>,
  seen: HashSet.HashSet<string>
): Effect.Effect<O.Option<string>, KnowledgeOperationalError> =>
  A.match(frontier, {
    onEmpty: () => Effect.succeedNone,
    onNonEmpty: ([file, ...rest]) =>
      HashSet.has(seen, file) || HashSet.size(seen) >= MAX_EXPORT_SEARCH_FILES
        ? searchExport(domain, name, rest, seen)
        : Effect.flatMap(domain.fileExports(file), (scan) =>
            A.contains(scan.names, name)
              ? Effect.succeedSome(file)
              : searchExport(domain, name, A.appendAll(rest, scan.stars), HashSet.add(seen, file))
          ),
  });

const evaluateExport = Effect.fn("KnowledgeDoctor.evaluateSymbolExport")(function* (
  span: KnowledgeSpan,
  tree: KnowledgeDoctorTree,
  claim: SymbolClaim,
  witnesses: readonly [ResolutionWitness, ...ReadonlyArray<ResolutionWitness>],
  target: string
) {
  if (O.isNone(claim.exportName)) {
    return resolvedBy(...witnesses);
  }
  const name = claim.exportName.value;
  const declaring = yield* searchExport(tree.domain, name, [target], HashSet.empty());
  return O.match(declaring, {
    onNone: (): KnowledgeEvaluationOutcome =>
      symbolFailure(
        span,
        `beep-export:${claim.specifier} ${name}`,
        `${claim.specifier} does not export ${name}.`,
        `beep-export:${claim.specifier}:${name}`
      ),
    onSome: (file): KnowledgeEvaluationOutcome =>
      resolvedBy(...witnesses, ExportWitness.make({ packageName: claim.packageName, file, exportName: name })),
  });
});

const evaluateSubpath = Effect.fn("KnowledgeDoctor.evaluateSymbolSubpath")(function* (
  span: KnowledgeSpan,
  tree: KnowledgeDoctorTree,
  claim: SymbolClaim,
  pkg: KnowledgeWorkspacePackage
) {
  const entry = yield* resolveEntry(tree.domain, pkg, claim);
  const subjectSubpath = `beep-subpath:${claim.specifier}`;
  const target = O.flatMap(entry, (value) => value.target);
  if (O.isNone(entry) || O.isNone(target)) {
    return symbolFailure(span, subjectSubpath, `${claim.specifier} is not exported by ${pkg.name}.`, subjectSubpath);
  }
  if (!HashSet.has(tree.entryIndex.paths, target.value)) {
    return symbolFailure(
      span,
      subjectSubpath,
      `${claim.specifier} resolves to ${target.value}, which is not tracked.`,
      `path:${target.value}`
    );
  }
  return yield* evaluateExport(
    span,
    tree,
    claim,
    [
      TreeEntryWitness.make({ path: pkg.manifestPath }),
      entry.value.witness,
      TreeEntryWitness.make({ path: target.value }),
    ],
    target.value
  );
});

const isPackageOnly = (claim: SymbolClaim): boolean => claim.key === "." && O.isNone(claim.exportName);

const evaluateSymbolSpan = Effect.fn("KnowledgeDoctor.evaluateSymbolSpan")(function* (
  span: KnowledgeSpan,
  tree: KnowledgeDoctorTree
) {
  const claim = symbolClaim(span);
  const packages = yield* tree.domain.packages;
  const pkg = A.findFirst(packages, (candidate) => candidate.name === claim.packageName);
  if (O.isNone(pkg)) {
    const subject = `beep-package:${claim.packageName}`;
    return symbolFailure(span, subject, `No workspace package is named ${claim.packageName}.`, subject);
  }
  return isPackageOnly(claim)
    ? resolvedBy(TreeEntryWitness.make({ path: pkg.value.manifestPath }))
    : yield* evaluateSubpath(span, tree, claim, pkg.value);
});

/**
 * The symbols evaluator: `@beep/*` package names, subpaths, and imported identifiers resolved against
 * the workspace manifests and barrels of the doctor tree.
 *
 * **Details**
 *
 * A package resolves through its tracked `package.json`. A subpath resolves through the package's
 * `exports` map (exact key, then the longest wildcard key; a `null` value blocks it) or, failing
 * that, a root `tsconfig.json` `paths` alias, and its target file must be tracked. An imported
 * identifier is found by a declaration scan of the target file and the files it star re-exports,
 * never by the compiler. A Turborepo task id is read for its package only.
 *
 * **Example** (Read the evaluator identity)
 *
 * ```ts
 * import { KnowledgeSymbolsEvaluator } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 *
 * console.log(KnowledgeSymbolsEvaluator.forms) // [ "symbol", "symbol-export" ]
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const KnowledgeSymbolsEvaluator: KnowledgeEvaluator = {
  id: "symbols",
  forms: ["symbol", "symbol-export"],
  kinds: ["unknown-beep-symbol"],
  evaluate: evaluateSymbolSpan,
};

/* -------------------------------------------------------------------------------------------------
 * Skills evaluator
 * ---------------------------------------------------------------------------------------------- */

const isSkillGitRevision = S.is(SkillGitRevision);

const skillSpan = (skill: string, entry: O.Option<KnowledgeSkillLockFacts>): KnowledgeSpan => {
  const documentPath = O.isSome(entry) ? KNOWLEDGE_SKILLS_LOCK_PATH : `${KNOWLEDGE_SKILLS_DIR}/${skill}/SKILL.md`;
  return KnowledgeSpan.make({
    form: "skill",
    documentPath,
    surface: "live",
    location: KnowledgeFindingLocation.make({
      path: documentPath,
      line: O.getOrElse(
        O.flatMap(entry, (value) => value.line),
        () => S.Natural.make(1)
      ),
      column: S.Natural.make(1),
    }),
    raw: skill,
    generatedBy: O.none(),
    citation: O.none(),
  });
};

const skillTreeSpans = Effect.fn("KnowledgeDoctor.skillTreeSpans")(function* (tree: KnowledgeDoctorTree) {
  const facts = yield* tree.domain.skills;
  const names = A.sort(
    A.dedupe(
      A.appendAll(
        A.map(facts.entries, (entry) => entry.skill),
        facts.installed
      )
    ),
    Order.String
  );
  return A.map(names, (skill) =>
    skillSpan(
      skill,
      A.findFirst(facts.entries, (entry) => entry.skill === skill)
    )
  );
});

const skillFailure = (span: KnowledgeSpan, kind: KnowledgeFindingKind, detail: string, message: string) =>
  knowledgeEvaluationFailure(span, {
    kind,
    subject: `skill:${span.raw}:${detail}`,
    message,
    remediation: "Run bun run beep skills update, or pin and license the skill in skills-lock.json.",
    causeKey: `skill:${span.raw}:${detail}`,
  });

const sourceFailures = (
  span: KnowledgeSpan,
  entry: KnowledgeSkillLockFacts
): ReadonlyArray<KnowledgeEvaluationFailure> =>
  entry.sourceType === "local"
    ? A.empty()
    : A.getSomes([
        O.isNone(entry.source)
          ? O.some(
              skillFailure(span, "unresolvable-skill-source", "source", `Skill ${span.raw} records no upstream source.`)
            )
          : O.none(),
        O.exists(entry.revision, isSkillGitRevision)
          ? O.none()
          : O.some(
              skillFailure(
                span,
                "floating-github-skill-source",
                "revision",
                `Skill ${span.raw} follows the floating revision ${O.getOrElse(entry.revision, () => "(none)")}, not a pinned commit.`
              )
            ),
        entry.licensed
          ? O.none()
          : O.some(
              skillFailure(
                span,
                "skill-license-unrecorded",
                "license",
                `Skill ${span.raw} records no upstream license.`
              )
            ),
      ]);

const installedTarget = (tree: KnowledgeDoctorTree, entry: KnowledgeSkillLockFacts): O.Option<string> =>
  A.findFirst(entry.installedTargets, (target) => HashSet.has(tree.entryIndex.paths, `${target}/SKILL.md`));

const evaluateLockedSkill = (
  span: KnowledgeSpan,
  tree: KnowledgeDoctorTree,
  entry: KnowledgeSkillLockFacts
): KnowledgeEvaluationOutcome => {
  const target = installedTarget(tree, entry);
  const coverage = O.isNone(target)
    ? [
        skillFailure(
          span,
          "skill-lock-coverage-drift",
          "uninstalled",
          `Locked skill ${span.raw} has no installed SKILL.md.`
        ),
      ]
    : A.empty<KnowledgeEvaluationFailure>();
  return outcomeOf(A.appendAll(coverage, sourceFailures(span, entry)), () => [
    LockEntryWitness.make({ skill: span.raw }),
    TreeEntryWitness.make({ path: O.getOrElse(target, () => `${KNOWLEDGE_SKILLS_DIR}/${span.raw}`) }),
  ]);
};

const evaluateSkillSpan = Effect.fn("KnowledgeDoctor.evaluateSkillSpan")(function* (
  span: KnowledgeSpan,
  tree: KnowledgeDoctorTree
) {
  const facts = yield* tree.domain.skills;
  return O.match(
    A.findFirst(facts.entries, (entry) => entry.skill === span.raw),
    {
      onNone: (): KnowledgeEvaluationOutcome =>
        failedWith(
          skillFailure(
            span,
            "skill-lock-coverage-drift",
            "unlocked",
            `Installed skill ${span.raw} has no ${KNOWLEDGE_SKILLS_LOCK_PATH} entry.`
          )
        ),
      onSome: (entry) => evaluateLockedSkill(span, tree, entry),
    }
  );
});

/**
 * The hermetic skills evaluator: lock coverage, source pinning, and license presence for every
 * installed or locked skill, read from `skills-lock.json` and the installed trees of the doctor tree.
 *
 * **Details**
 *
 * Its spans are synthesized from the tree (`treeSpans`), one per skill in the lock or under
 * `.claude/skills/<name>/SKILL.md`, rather than read from prose. Both lock versions are read: v2
 * through `SkillsLockDocument`, v1 through `SkillLockFile`. A resolved skill cites its lock entry
 * and its installed directory. Remote drift needs the network and stays in `skills update --check`.
 *
 * **Example** (Read the evaluator kinds)
 *
 * ```ts
 * import { KnowledgeSkillsLocalEvaluator } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 *
 * console.log(KnowledgeSkillsLocalEvaluator.kinds.length) // 4
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const KnowledgeSkillsLocalEvaluator: KnowledgeEvaluator = {
  id: "skills-local",
  forms: ["skill"],
  kinds: [
    "skill-lock-coverage-drift",
    "unresolvable-skill-source",
    "floating-github-skill-source",
    "skill-license-unrecorded",
  ],
  evaluate: evaluateSkillSpan,
  treeSpans: skillTreeSpans,
};

/**
 * Evaluates every skill of a tree hermetically, with no network capability in its requirements.
 *
 * **Details**
 *
 * The returned effect requires nothing: no `HttpClient`, no filesystem, no process spawner. That is
 * the type-level proof that skill sources and licenses are checked from tree bytes alone; remote
 * drift belongs to `skills update --check`.
 *
 * **Example** (Evaluate the skills of an empty fixture tree)
 *
 * ```ts
 * import { evaluateSkillsLocal } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 * import { makeKnowledgeDoctorMemoryTree } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(evaluateSkillsLocal(makeKnowledgeDoctorMemoryTree({ files: {} })))) // true
 * ```
 *
 * @param tree - Doctor tree to evaluate.
 * @returns Each synthesized skill span with its outcome, sorted by skill name.
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateSkillsLocal = Effect.fn("KnowledgeDoctor.evaluateSkillsLocal")(function* (
  tree: KnowledgeDoctorTree
) {
  const spans = yield* skillTreeSpans(tree);
  return yield* Effect.forEach(spans, (span) =>
    Effect.map(evaluateSkillSpan(span, tree), (outcome) => [span, outcome] as const)
  );
});
