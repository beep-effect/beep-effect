/**
 * Schemas for the sequential multi-model critic loop over a rendered sheet set.
 *
 * **Details**
 *
 * A critic pack is a directory a reviewer works in: sheet rasters, 300 dpi
 * zooms, the SVG vectors and their stroke tables, operator-supplied context,
 * a brief, and the earlier reviewers' reports of the same loop. Reviewers run
 * in order; each sees the earlier reports and must confirm, refute, or extend
 * them instead of repeating them. The report every reviewer returns is
 * {@link CriticReport}; its JSON Schema is derived from the same class so the
 * contract the reviewers are given and the decoder that reads them back cannot
 * drift.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { QaSeverity } from "@beep/qa-capture/QaInventory.schemas";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FigureNumber } from "./Drawings.review.schemas.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.critics.schemas");

const CriticRouteBase = LiteralKit(["codex", "grok", "claude", "cursor"]);

/**
 * The command-line route a reviewer runs on.
 *
 * **Example** (Route literals)
 *
 * ```ts
 * import { CriticRoute } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticRoute.literals) // ["codex", "grok", "claude", "cursor"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticRoute = CriticRouteBase.pipe(
  $I.annoteSchema("CriticRoute", {
    description: "The CLI a reviewer runs on: codex exec, the grok CLI, claude -p, or cursor-agent.",
  }),
  SchemaUtils.withLiteralKitStatics(CriticRouteBase)
);

/**
 * The CLI a reviewer runs on.
 *
 * @category models
 * @since 0.0.0
 */
export type CriticRoute = typeof CriticRoute.Type;

const CriticScopeBase = LiteralKit(["matter", "synthetic"]);

/**
 * Which pack a reviewer may see: the matter's own render, or only the public
 * synthetic twin plus the repository (a Cursor-hosted reviewer never sees
 * matter material).
 *
 * **Example** (Scope literals)
 *
 * ```ts
 * import { CriticScope } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticScope.Enum.synthetic) // "synthetic"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticScope = CriticScopeBase.pipe(
  $I.annoteSchema("CriticScope", {
    description: "matter: the reviewer sees the matter pack; synthetic: only the public synthetic pack and the repo.",
  }),
  SchemaUtils.withLiteralKitStatics(CriticScopeBase)
);

/**
 * Which pack a reviewer may see.
 *
 * @category models
 * @since 0.0.0
 */
export type CriticScope = typeof CriticScope.Type;

/**
 * One reviewer of the sequence: its display name, the id prefix its findings
 * carry, the route, the model, the effort the route accepts, and its scope.
 *
 * **Example** (The Codex reviewer at the highest effort)
 *
 * ```ts
 * import { CriticReviewer } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const astra = CriticReviewer.make({ name: "codex-gpt-6-astra", idPrefix: "A", route: "codex", model: "gpt-6-astra", effort: O.some("xhigh"), scope: "matter" })
 * console.log(astra.idPrefix) // "A"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticReviewer extends S.Opaque<CriticReviewer, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "Reviewer name written into every report." }),
    idPrefix: S.NonEmptyString.check(S.isMaxLength(3)).annotateKey({
      description: "Prefix of the reviewer's finding ids (`A` gives A-01, A-02, …).",
    }),
    route: CriticRoute.annotateKey({ description: "CLI the reviewer runs on." }),
    model: S.NonEmptyString.annotateKey({ description: "Model id as the route's CLI names it." }),
    effort: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Reasoning effort passed to the route when it accepts one." })
    ),
    scope: CriticScope.annotateKey({ description: "Which pack the reviewer may see." }),
  }).pipe(
    $I.annoteSchema("CriticReviewer", {
      description: "Name, id prefix, route, model, effort, and scope of one reviewer.",
    })
  )
) {}

const CriticRelationKindBase = LiteralKit(["new", "extends"]);

/**
 * Whether a finding is new to the loop or extends an earlier reviewer's.
 *
 * **Example** (Relation kinds)
 *
 * ```ts
 * import { CriticRelationKind } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticRelationKind.literals) // ["new", "extends"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticRelationKind = CriticRelationKindBase.pipe(
  $I.annoteSchema("CriticRelationKind", { description: "new, or extends an earlier finding of this loop." }),
  SchemaUtils.withLiteralKitStatics(CriticRelationKindBase)
);

/**
 * How a finding relates to the earlier reviewers' findings: `new`, or
 * `extends` the finding named by `of` (new figures, a different root cause, or
 * a measurement that changes its severity). A new finding carries `of: null`
 * so every key is present, which the strict structured-output modes require.
 *
 * **Example** (A new finding)
 *
 * ```ts
 * import { CriticFindingRelation } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * console.log(CriticFindingRelation.make({ kind: "new", of: O.none() }).kind) // "new"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticFindingRelation extends S.Opaque<CriticFindingRelation, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: CriticRelationKind.annotateKey({ description: "new or extends." }),
    of: S.OptionFromNullOr(S.NonEmptyString).annotateKey({
      description: "Id of the earlier finding this one extends; null for a new finding.",
    }),
  }).pipe($I.annoteSchema("CriticFindingRelation", { description: "new, or extends an earlier finding by id." }))
) {}

const CriticFindingScopeBase = LiteralKit(["this-render", "pending-branch"]);

/**
 * Whether a finding is a defect of what this render carries, or concerns an
 * item the brief lists as pending in another branch.
 *
 * **Example** (Scope literals)
 *
 * ```ts
 * import { CriticFindingScope } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticFindingScope.Enum["this-render"]) // "this-render"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticFindingScope = CriticFindingScopeBase.pipe(
  $I.annoteSchema("CriticFindingScope", { description: "this-render, or pending-branch for items the brief defers." }),
  SchemaUtils.withLiteralKitStatics(CriticFindingScopeBase)
);

const CriticCategoryBase = LiteralKit([
  "rule",
  "attorney-request",
  "shading",
  "geometry",
  "labels-sheet",
  "consistency",
  "pdf-structure",
  "other",
]);

/**
 * The convention family a finding belongs to.
 *
 * **Example** (Category literals)
 *
 * ```ts
 * import { CriticCategory } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticCategory.literals.length) // 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticCategory = CriticCategoryBase.pipe(
  $I.annoteSchema("CriticCategory", { description: "Convention family of a finding." }),
  SchemaUtils.withLiteralKitStatics(CriticCategoryBase)
);

const Confidence = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }));

/**
 * One finding of a critic report: where, on what basis, what was observed,
 * the proposed fix, and the reviewer's confidence.
 *
 * **Example** (A measured shading finding)
 *
 * ```ts
 * import { CriticFinding, CriticFindingRelation } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const finding = CriticFinding.make({
 *   id: "A-01",
 *   relation: CriticFindingRelation.make({ kind: "new", of: O.none() }),
 *   severity: "P1",
 *   scope: "this-render",
 *   category: "shading",
 *   figures: [2],
 *   location: "left wall of the centred point, strokes at x = 111.2 and 109.1 mm",
 *   basis: "37 CFR 1.84(m); 1993 Guide Example 34",
 *   observation: "The band sits at the lit end of the wall.",
 *   proposedFix: "Anchor the band at the shadow end.",
 *   confidence: 0.9,
 * })
 * console.log(finding.figures) // [2]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticFinding extends S.Opaque<CriticFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString.annotateKey({ description: "<prefix>-<nn>, numbered within the reviewer." }),
    relation: CriticFindingRelation.annotateKey({ description: "new, or extends an earlier finding." }),
    severity: QaSeverity.annotateKey({ description: "P0 blocks filing, P1 the attorney would send back, P2 polish." }),
    scope: CriticFindingScope.annotateKey({ description: "this-render or pending-branch." }),
    category: CriticCategory.annotateKey({ description: "Convention family." }),
    figures: S.Array(FigureNumber).annotateKey({ description: "FIG.s the finding applies to." }),
    location: S.NonEmptyString.annotateKey({ description: "What and where, with mm or px." }),
    basis: S.NonEmptyString.annotateKey({
      description: "Rule section, attorney ruling, Guide example, or convention.",
    }),
    observation: S.NonEmptyString.annotateKey({ description: "What the reviewer saw or measured." }),
    proposedFix: S.NonEmptyString.annotateKey({ description: "The change that would correct it." }),
    confidence: Confidence.annotateKey({ description: "0 to 1." }),
  }).pipe(
    $I.annoteSchema("CriticFinding", {
      description:
        "Id, relation, severity, scope, category, figures, location, basis, observation, fix, and confidence.",
    })
  )
) {}

const CriticPriorStanceBase = LiteralKit(["confirm", "refute", "cannot-verify"]);

/**
 * A reviewer's stance on an earlier reviewer's finding.
 *
 * **Example** (Stance literals)
 *
 * ```ts
 * import { CriticPriorStance } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticPriorStance.literals) // ["confirm", "refute", "cannot-verify"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticPriorStance = CriticPriorStanceBase.pipe(
  $I.annoteSchema("CriticPriorStance", {
    description: "confirm (measured and agree), refute (say what was measured), or cannot-verify.",
  }),
  SchemaUtils.withLiteralKitStatics(CriticPriorStanceBase)
);

/**
 * One earlier finding assessed by a later reviewer.
 *
 * **Example** (Confirming an earlier finding)
 *
 * ```ts
 * import { CriticPriorAssessment } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticPriorAssessment.make({ id: "A-01", stance: "confirm", note: "Measured 1.50 mm from the SVG." }).stance)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPriorAssessment extends S.Opaque<CriticPriorAssessment, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString.annotateKey({ description: "Earlier finding id." }),
    stance: CriticPriorStance.annotateKey({ description: "confirm, refute, or cannot-verify." }),
    note: S.NonEmptyString.annotateKey({ description: "What was measured, or why it could not be." }),
  }).pipe($I.annoteSchema("CriticPriorAssessment", { description: "Stance and note on one earlier finding." }))
) {}

const CriticVerdictBase = LiteralKit(["accept", "accept-with-fixes", "reject"]);

/**
 * A reviewer's verdict on the whole set.
 *
 * **Example** (Verdict literals)
 *
 * ```ts
 * import { CriticVerdict } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticVerdict.Enum.reject) // "reject"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticVerdict = CriticVerdictBase.pipe(
  $I.annoteSchema("CriticVerdict", { description: "accept, accept-with-fixes, or reject." }),
  SchemaUtils.withLiteralKitStatics(CriticVerdictBase)
);

/**
 * The document every reviewer returns. Its JSON Schema, derived by
 * {@link criticReportJsonSchema}, is what the structured-output routes are
 * given, so the contract and the decoder are one class.
 *
 * **Example** (An empty accept)
 *
 * ```ts
 * import { CriticReport } from "@beep/repo-cli/commands/Drawings"
 *
 * const report = CriticReport.make({ reviewer: "grok-4.7", verdict: "accept", blockers: [], priorAssessment: [], findings: [], couldNotAssess: [] })
 * console.log(report.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticReport extends S.Opaque<CriticReport, { readonly brand: unique symbol }>()(
  S.Struct({
    reviewer: S.NonEmptyString.annotateKey({ description: "Reviewer name." }),
    verdict: CriticVerdict.annotateKey({ description: "Verdict on the set." }),
    blockers: S.Array(S.String).annotateKey({ description: "One line per blocker." }),
    priorAssessment: S.Array(CriticPriorAssessment).annotateKey({
      description: "One entry per earlier finding id of this loop.",
    }),
    findings: S.Array(CriticFinding).annotateKey({ description: "New or extending findings only." }),
    couldNotAssess: S.Array(S.String).annotateKey({ description: "What the reviewer could not examine, and why." }),
  }).pipe(
    $I.annoteSchema("CriticReport", {
      description:
        "Reviewer, verdict, blockers, assessment of earlier findings, findings, and what could not be assessed.",
    })
  )
) {}

const reportCodec = S.fromJsonString(CriticReport);
const decodeCriticReportJson = S.decodeEffect(reportCodec);
const encodeCriticReportJson = S.encodeEffect(reportCodec);

/**
 * Decode a critic report from JSON text.
 *
 * **Example** (Decode an accept)
 *
 * ```ts
 * import { decodeCriticReport } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const text = '{"reviewer":"x","verdict":"accept","blockers":[],"priorAssessment":[],"findings":[],"couldNotAssess":[]}'
 * Effect.runPromise(decodeCriticReport(text)).then((r) => console.log(r.verdict)) // "accept"
 * ```
 *
 * @param text - JSON document containing one reviewer report.
 * @returns An effect yielding the validated report, or a schema decoding failure.
 * @category decoding
 * @since 0.0.0
 */
export const decodeCriticReport = (text: string) => decodeCriticReportJson(text);

/**
 * Encode a critic report as JSON text.
 *
 * **Example** (Encode an accept)
 *
 * ```ts
 * import { CriticReport, encodeCriticReport } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const report = CriticReport.make({ reviewer: "x", verdict: "accept", blockers: [], priorAssessment: [], findings: [], couldNotAssess: [] })
 * Effect.runPromise(encodeCriticReport(report)).then((text) => console.log(text.length > 0)) // true
 * ```
 *
 * @param report - Validated report whose findings and prior assessments will be serialized.
 * @returns An effect yielding JSON text suitable for storing as a reviewer report.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCriticReport = (report: CriticReport) => encodeCriticReportJson(report);

/**
 * The JSON Schema (draft 2020-12) of {@link CriticReport} as the structured-output
 * routes expect it: definitions inlined, every key required, no excess
 * properties, and only the keywords the strict modes accept (`type`,
 * `properties`, `required`, `additionalProperties`, `items`, `enum`, `anyOf`,
 * `description`). Length and range checks stay on the decoder.
 *
 * **Example** (The schema names its required keys)
 *
 * ```ts
 * import { criticReportJsonSchema } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(JSON.parse(criticReportJsonSchema()).required) // ["reviewer", "verdict", ...]
 * ```
 *
 * @returns Pretty-printed JSON Schema with definitions inlined and unsupported strict-mode keywords removed.
 * @category encoding
 * @since 0.0.0
 */
export const criticReportJsonSchema = (): string =>
  Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown, { space: 2 }))(
      strictKeywords(
        S.toJsonSchemaDocument(CriticReport, { onExcessProperty: "error", referencePolicy: () => undefined }).schema
      )
    ),
    identity
  );

const STRICT_KEYWORDS = HashSet.fromIterable([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "anyOf",
  "description",
]);

const isRecord = (value: unknown): value is Record<string, unknown> => P.isObject(value);

// Keep only the keywords the strict structured-output modes accept, recursively;
// the children of `properties` are property names, not keywords, and stay.
const strictKeywords = (node: unknown): unknown =>
  A.isArray(node)
    ? A.map(node, strictKeywords)
    : isRecord(node)
      ? pipe(
          node,
          R.filter((_, key) => HashSet.has(STRICT_KEYWORDS, key)),
          R.map((value, key) =>
            key === "properties" && isRecord(value) ? R.map(value, strictKeywords) : strictKeywords(value)
          )
        )
      : node;

/**
 * A 300 dpi crop of one sheet, in raster pixels at 300 dpi from the page's
 * top-left corner.
 *
 * **Example** (A wall crop)
 *
 * ```ts
 * import { CriticZoom } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticZoom.make({ figure: 1, label: "walls", x: 500, y: 1500, width: 1700, height: 1400 }).label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticZoom extends S.Opaque<CriticZoom, { readonly brand: unique symbol }>()(
  S.Struct({
    figure: FigureNumber.annotateKey({ description: "FIG. the crop is cut from." }),
    label: S.NonEmptyString.annotateKey({ description: "Short name used in the file name." }),
    x: S.Natural.annotateKey({ description: "Left edge, px at 300 dpi." }),
    y: S.Natural.annotateKey({ description: "Top edge, px at 300 dpi." }),
    width: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "Width, px at 300 dpi." }),
    height: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "Height, px at 300 dpi." }),
  }).pipe($I.annoteSchema("CriticZoom", { description: "Figure, label, and crop rectangle of a 300 dpi zoom." }))
) {}

/**
 * What a critic pack holds, written as `pack.json` in the pack directory.
 *
 * **Example** (Reference the class)
 *
 * ```ts
 * import { CriticPackManifest } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticPackManifest.name) // "CriticPackManifest"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPackManifest extends S.Opaque<CriticPackManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("drawing-critic-pack/v1").annotateKey({ description: "Schema version." }),
    title: S.NonEmptyString.annotateKey({ description: "Title from the render manifest." }),
    sheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet-set PDF the pack was built from." }),
    specSha256: Sha256Hex.annotateKey({ description: "Hash of the spec the set was rendered from." }),
    sheets: S.Array(S.NonEmptyString).annotateKey({ description: "Pack-relative 150 dpi sheet PNGs, in FIG. order." }),
    zooms: S.Array(S.NonEmptyString).annotateKey({ description: "Pack-relative 300 dpi crops." }),
    svgs: S.Array(S.NonEmptyString).annotateKey({ description: "Pack-relative figure SVGs." }),
    images: S.Array(S.NonEmptyString).annotateKey({
      description: "Pack-relative context images (markup pages, photographs) attached to image-taking routes.",
    }),
    strokeTable: S.NonEmptyString.annotateKey({ description: "Pack-relative stroke table (RENDER.md)." }),
    measurements: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Pack-relative MEASUREMENTS.md (beside measurements.json) the harness measured; absent in packs built before it did.",
      })
    ),
    brief: S.NonEmptyString.annotateKey({ description: "Pack-relative brief every reviewer reads first." }),
  }).pipe($I.annoteSchema("CriticPackManifest", { description: "Hashes and pack-relative files of a critic pack." }))
) {}

/**
 * Decode a pack manifest from JSON text.
 *
 * @category decoding
 * @since 0.0.0
 */
const manifestCodec = S.fromJsonString(CriticPackManifest);
const decodeCriticPackManifestJson = S.decodeEffect(manifestCodec);
const encodeCriticPackManifestJson = S.encodeEffect(manifestCodec);

/**
 * Decode a manifest from JSON text.
 *
 * **Example** (A one-sheet pack)
 *
 * ```ts
 * import { decodeCriticPackManifest } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const text = '{"schemaVersion":"drawing-critic-pack/v1","title":"Bracket","sheetSetSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","specSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sheets":["render/pg-1.png"],"zooms":[],"svgs":["render/fig-1.svg"],"images":[],"strokeTable":"render/RENDER.md","brief":"BRIEF.md"}'
 * Effect.runPromise(decodeCriticPackManifest(text)).then((manifest) => console.log(manifest.sheets)) // ["render/pg-1.png"]
 * ```
 *
 * @param text - JSON document describing pack hashes and pack-relative input files.
 * @returns An effect yielding the validated manifest, or a schema decoding failure.
 * @category decoding
 * @since 0.0.0
 */
export const decodeCriticPackManifest = (text: string) => decodeCriticPackManifestJson(text);

/**
 * Encode a pack manifest as JSON text.
 *
 * **Example** (Round-trip a pack manifest)
 *
 * ```ts
 * import { decodeCriticPackManifest, encodeCriticPackManifest } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const text = '{"schemaVersion":"drawing-critic-pack/v1","title":"Bracket","sheetSetSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","specSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sheets":["render/pg-1.png"],"zooms":[],"svgs":["render/fig-1.svg"],"images":[],"strokeTable":"render/RENDER.md","brief":"BRIEF.md"}'
 * Effect.runPromise(Effect.flatMap(decodeCriticPackManifest(text), encodeCriticPackManifest)).then(console.log)
 * ```
 *
 * @param manifest - Validated pack manifest with paths relative to the pack directory.
 * @returns An effect yielding JSON text suitable for the pack.json file.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCriticPackManifest = (manifest: CriticPackManifest) => encodeCriticPackManifestJson(manifest);

const CriticSeatUnavailableReasonBase = LiteralKit(["sandbox-deny-path-unresolved", "time-limit", "output-limit"]);

/**
 * Why a reviewer's seat ended without a report: it could not start on this
 * host, or it stopped at a limit.
 *
 * **Details**
 *
 * `sandbox-deny-path-unresolved`: the Grok CLI refused to start because its
 * `--sandbox strict` profile could not resolve a runtime-socket path it must
 * deny, so it would not run with its protections missing.
 *
 * `time-limit`: the seat ran past the run's `--timeout-minutes` and the
 * harness stopped it. What it printed before then is kept as `<name>.log`
 * (stderr) and `<name>.raw` (stdout) in the loop directory, and is never read
 * as a report.
 *
 * `output-limit`: a `claude -p` seat ended with `api_error`
 * `max_output_tokens`: one response ran past the output-token cap, so the run
 * ended without a final message.
 *
 * **Example** (Reason literals)
 *
 * ```ts
 * import { CriticSeatUnavailableReason } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticSeatUnavailableReason.literals) // ["sandbox-deny-path-unresolved", "time-limit", "output-limit"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticSeatUnavailableReason = CriticSeatUnavailableReasonBase.pipe(
  $I.annoteSchema("CriticSeatUnavailableReason", {
    description:
      "Why a reviewer seat ended without a report: it could not start on this host, or it stopped at a limit.",
  }),
  SchemaUtils.withLiteralKitStatics(CriticSeatUnavailableReasonBase)
);

const CriticSeatLimitUnitBase = LiteralKit(["minutes", "output-tokens"]);

/**
 * The unit of a seat limit: minutes of run time, or output tokens in one
 * response.
 *
 * **Example** (Unit literals)
 *
 * ```ts
 * import { CriticSeatLimitUnit } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticSeatLimitUnit.literals) // ["minutes", "output-tokens"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticSeatLimitUnit = CriticSeatLimitUnitBase.pipe(
  $I.annoteSchema("CriticSeatLimitUnit", {
    description: "Unit of a seat limit: minutes of run time, or output tokens in one response.",
  }),
  SchemaUtils.withLiteralKitStatics(CriticSeatLimitUnitBase)
);

/**
 * The limit a seat reached: an amount and its unit.
 *
 * **Example** (The 90-minute seat limit)
 *
 * ```ts
 * import { CriticSeatLimit } from "@beep/repo-cli/commands/Drawings"
 *
 * const limit = CriticSeatLimit.make({ amount: 90, unit: "minutes" })
 * console.log(limit.amount, limit.unit) // 90 "minutes"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticSeatLimit extends S.Opaque<CriticSeatLimit, { readonly brand: unique symbol }>()(
  S.Struct({
    amount: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "The limit, counted in `unit`." }),
    unit: CriticSeatLimitUnit.annotateKey({ description: "Minutes of run time, or output tokens in one response." }),
  }).pipe(
    $I.annoteSchema("CriticSeatLimit", {
      description: "Amount and unit of the limit a reviewer seat reached.",
    })
  )
) {}

/**
 * A reviewer seat that ended without a report: the reason, the path the
 * failure names (when it names one), the limit it reached (when it stopped at
 * one), and a sentence for the loop record and the summary.
 *
 * **Details**
 *
 * `limit` is null for a seat that could not start; a seat record written
 * before the key existed decodes it as null.
 *
 * **Example** (The Grok seat whose sandbox could not resolve a deny path)
 *
 * ```ts
 * import { CriticSeatUnavailable } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const seat = CriticSeatUnavailable.make({
 *   reason: "sandbox-deny-path-unresolved",
 *   path: O.some("/run/example/runtime.sock"),
 *   detail: "grok refused to start: its --sandbox strict profile could not resolve the runtime-socket deny path /run/example/runtime.sock on this host",
 * })
 * console.log(seat.reason, O.isNone(seat.limit)) // "sandbox-deny-path-unresolved" true
 * ```
 *
 * **Example** (A seat stopped at its time limit)
 *
 * ```ts
 * import { CriticSeatLimit, CriticSeatUnavailable } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const seat = CriticSeatUnavailable.make({
 *   reason: "time-limit",
 *   path: O.none(),
 *   limit: O.some(CriticSeatLimit.make({ amount: 90, unit: "minutes" })),
 *   detail: "the seat ran past its 90-minute limit and was stopped",
 * })
 * console.log(seat.reason) // "time-limit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticSeatUnavailable extends S.Opaque<CriticSeatUnavailable, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: CriticSeatUnavailableReason.annotateKey({ description: "Why the seat ended without a report." }),
    path: S.OptionFromNullOr(S.NonEmptyString).annotateKey({
      description: "The path the failure names; null when the message names none.",
    }),
    limit: S.OptionFromNullOr(CriticSeatLimit).pipe(
      S.withDecodingDefaultKey(Effect.succeed(null)),
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The limit the seat reached; null when it stopped at none." })
    ),
    detail: S.NonEmptyString.annotateKey({ description: "One sentence for the loop record and the summary." }),
  }).pipe(
    $I.annoteSchema("CriticSeatUnavailable", {
      description:
        "Reason, named path, reached limit, and explanation of a reviewer seat that could not run on this host or stopped at a limit.",
    })
  )
) {}

/**
 * One reviewer's run inside a loop.
 *
 * **Details**
 *
 * `unavailable` is set when the reviewer's seat ended without a report for a
 * reason the harness recognises: it could not start on this host, it ran past
 * its time limit, or a `claude -p` seat ended at its output-token cap. It is
 * `null` for every other run, whatever its exit code. A seat stopped at its
 * time limit never exited, so its `exitCode` is 124, the `timeout(1)`
 * convention. A record written before the key existed decodes it as `null`.
 *
 * **Example** (Reference the class)
 *
 * ```ts
 * import { CriticRunRecord } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticRunRecord.name) // "CriticRunRecord"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticRunRecord extends S.Opaque<CriticRunRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    order: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({ description: "Position in the sequence, from 1." }),
    reviewer: CriticReviewer.annotateKey({ description: "The reviewer." }),
    exitCode: S.Int.annotateKey({ description: "Exit code of the route's CLI." }),
    report: S.OptionFromNullOr(S.NonEmptyString).annotateKey({
      description: "Loop-relative report file, when the run produced a decodable report.",
    }),
    reportSha256: S.OptionFromNullOr(Sha256Hex).annotateKey({ description: "Hash of that file." }),
    findings: S.Natural.annotateKey({ description: "Findings in the report; 0 when absent." }),
    startedAt: S.NonEmptyString.annotateKey({ description: "ISO-8601 start." }),
    finishedAt: S.NonEmptyString.annotateKey({ description: "ISO-8601 end." }),
    unavailable: S.OptionFromNullOr(CriticSeatUnavailable).pipe(
      S.withDecodingDefaultKey(Effect.succeed(null)),
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Why the seat ended without a report: it could not start or stopped at a limit; null otherwise.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CriticRunRecord", {
      description: "Order, reviewer, exit code, report file, hash, count, times, and seat outcome of one run.",
    })
  )
) {}

/**
 * One loop of the sequence, written as `loop.json` in the loop directory.
 *
 * **Example** (Reference the class)
 *
 * ```ts
 * import { CriticLoopRecord } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CriticLoopRecord.name) // "CriticLoopRecord"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticLoopRecord extends S.Opaque<CriticLoopRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("drawing-critic-loop/v1").annotateKey({ description: "Schema version." }),
    loop: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({ description: "One-based loop number." }),
    sheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet set reviewed." }),
    runs: S.Array(CriticRunRecord).annotateKey({ description: "Every run, in order." }),
  }).pipe($I.annoteSchema("CriticLoopRecord", { description: "Loop number, sheet-set hash, and runs of one loop." }))
) {}

/**
 * Decode a loop record from JSON text.
 *
 * @category decoding
 * @since 0.0.0
 */
const recordCodec = S.fromJsonString(CriticLoopRecord);
const decodeCriticLoopRecordJson = S.decodeEffect(recordCodec);
const encodeCriticLoopRecordJson = S.encodeEffect(recordCodec);

/**
 * Decode a record from JSON text.
 *
 * **Example** (A loop with no runs yet)
 *
 * ```ts
 * import { decodeCriticLoopRecord } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const text = '{"schemaVersion":"drawing-critic-loop/v1","loop":1,"sheetSetSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","runs":[]}'
 * Effect.runPromise(decodeCriticLoopRecord(text)).then((record) => console.log(record.loop)) // 1
 * ```
 *
 * @param text - JSON document recording a loop number, sheet-set hash, and reviewer runs.
 * @returns An effect yielding the validated loop record, or a schema decoding failure.
 * @category decoding
 * @since 0.0.0
 */
export const decodeCriticLoopRecord = (text: string) => decodeCriticLoopRecordJson(text);

/**
 * Encode a loop record as JSON text.
 *
 * **Example** (Round-trip a loop record)
 *
 * ```ts
 * import { decodeCriticLoopRecord, encodeCriticLoopRecord } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const text = '{"schemaVersion":"drawing-critic-loop/v1","loop":1,"sheetSetSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","runs":[]}'
 * Effect.runPromise(Effect.flatMap(decodeCriticLoopRecord(text), encodeCriticLoopRecord)).then(console.log)
 * ```
 *
 * @param record - Validated loop record whose reviewer run order will be preserved.
 * @returns An effect yielding JSON text suitable for persisting the loop record.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCriticLoopRecord = (record: CriticLoopRecord) => encodeCriticLoopRecordJson(record);

const optionalDirectory = (description: string) =>
  S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description })
  );

/**
 * A request to build a critic pack from a render manifest: the manifest, the
 * pack directory to create, the brief, an optional context directory, the
 * context-image directories, and the 300 dpi zooms to cut.
 *
 * **Example** (A pack with one zoom and no context directory)
 *
 * ```ts
 * import { CriticPackRequest, CriticZoom } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const request = CriticPackRequest.make({
 *   manifestPath: "render/manifest.json",
 *   outDir: "packs/loop-1",
 *   briefPath: "BRIEF.md",
 *   imagesDirs: [],
 *   zooms: [CriticZoom.make({ figure: 1, label: "walls", x: 500, y: 1500, width: 1700, height: 1400 })],
 * })
 * console.log(O.isNone(request.contextDir)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticPackRequest extends S.Opaque<CriticPackRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    manifestPath: S.NonEmptyString.annotateKey({ description: "Render manifest.json of the sheet set to review." }),
    outDir: S.NonEmptyString.annotateKey({ description: "Pack directory to create." }),
    briefPath: S.NonEmptyString.annotateKey({ description: "Brief copied into the pack as BRIEF.md." }),
    contextDir: optionalDirectory("Directory copied into the pack as context/, when given."),
    imagesDirs: S.Array(S.NonEmptyString).annotateKey({
      description: "Directories of context images copied under images/<name>/.",
    }),
    zooms: S.Array(CriticZoom).annotateKey({ description: "300 dpi crops cut from the sheet set." }),
  }).pipe(
    $I.annoteSchema("CriticPackRequest", {
      description: "Manifest, pack directory, brief, context directory, image directories, and zooms of a pack build.",
    })
  )
) {}

/**
 * A request to run reviewers on a pack: the loop number and directory, the
 * pack, the reviewers in order, the synthetic pack and workspace a
 * synthetic-scope reviewer uses, and the minutes each reviewer may run.
 *
 * **Example** (The default sequence on loop 1)
 *
 * ```ts
 * import { CriticRunRequest, DEFAULT_CRITIC_REVIEWERS } from "@beep/repo-cli/commands/Drawings"
 *
 * const request = CriticRunRequest.make({
 *   loop: 1,
 *   loopDir: "loops/1",
 *   packDir: "packs/loop-1",
 *   reviewers: DEFAULT_CRITIC_REVIEWERS,
 *   timeoutMinutes: 90,
 * })
 * console.log(request.reviewers.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticRunRequest extends S.Opaque<CriticRunRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    loop: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({ description: "One-based loop number." }),
    loopDir: S.NonEmptyString.annotateKey({
      description: "Directory that receives this loop's reports, logs, prior/ and loop.json.",
    }),
    packDir: S.NonEmptyString.annotateKey({ description: "Pack directory built by the pack step." }),
    reviewers: S.Array(CriticReviewer).annotateKey({ description: "Reviewers, run in this order." }),
    syntheticPack: optionalDirectory("Client-free pack a synthetic-scope reviewer reviews, when given."),
    timeoutMinutes: S.Int.check(S.isGreaterThan(0)).annotateKey({
      description: "Minutes a reviewer may run before it is stopped and recorded as a time-limit outcome.",
    }),
    workspace: optionalDirectory("Repository checkout a synthetic-scope reviewer works in, when given."),
  }).pipe(
    $I.annoteSchema("CriticRunRequest", {
      description: "Loop, loop directory, pack, reviewers, synthetic pack, timeout, and workspace of a critic run.",
    })
  )
) {}

const CriticReportSourceKind = LiteralKit(["file", "stdout"]);

/**
 * Where a route leaves its report, tagged on `kind`: a file it was told to
 * write, or its stdout.
 *
 * **Example** (A report file)
 *
 * ```ts
 * import { CriticReportSource } from "@beep/repo-cli/commands/Drawings"
 *
 * const source = CriticReportSource.cases.file.make({ kind: "file", path: "/loop/codex-gpt-6-astra.json" })
 * console.log(source.kind) // "file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CriticReportSource = CriticReportSourceKind.toTaggedUnion("kind")({
  file: {
    path: S.NonEmptyString.annotateKey({ description: "Report file the route was told to write." }),
  },
  stdout: {},
}).pipe(
  $I.annoteSchema("CriticReportSource", {
    description: "file: the route writes the report to a path; stdout: the report is read from its standard output.",
  })
);

/**
 * Type for {@link CriticReportSource}.
 *
 * **Example** (Annotate a stdout source)
 *
 * ```ts
 * import { CriticReportSource } from "@beep/repo-cli/commands/Drawings"
 *
 * const source: CriticReportSource = CriticReportSource.cases.stdout.make({ kind: "stdout" })
 * console.log(source.kind) // "stdout"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CriticReportSource = typeof CriticReportSource.Type;

/**
 * A reviewer's invocation: what to spawn, where, with which environment, and
 * how its report comes back.
 *
 * **Example** (A Grok invocation that reports on stdout)
 *
 * ```ts
 * import { CriticInvocation, CriticReportSource } from "@beep/repo-cli/commands/Drawings"
 *
 * const invocation = CriticInvocation.make({
 *   executable: "grok",
 *   args: ["-m", "grok-4.7", "-p", "review"],
 *   cwd: "/pack",
 *   env: { HOME: "/home/reviewer" },
 *   reportFrom: CriticReportSource.cases.stdout.make({ kind: "stdout" }),
 * })
 * console.log(invocation.reportFrom.kind) // "stdout"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticInvocation extends S.Opaque<CriticInvocation, { readonly brand: unique symbol }>()(
  S.Struct({
    executable: S.NonEmptyString.annotateKey({ description: "CLI to spawn." }),
    args: S.Array(S.String).annotateKey({ description: "Arguments passed to the CLI, in order." }),
    cwd: S.NonEmptyString.annotateKey({ description: "Working directory of the spawned CLI." }),
    env: S.Record(S.String, S.String).annotateKey({
      description: "The whole environment the CLI runs with; nothing else is inherited.",
    }),
    reportFrom: CriticReportSource.annotateKey({
      description: "Where the route writes its report: a file it was told to write, or its stdout.",
    }),
  }).pipe(
    $I.annoteSchema("CriticInvocation", {
      description: "Executable, arguments, working directory, environment, and report source of one reviewer run.",
    })
  )
) {}

/**
 * The `result` event `claude -p` prints when a run ends: the whole
 * `--output-format json` envelope, or the last `result` event of a
 * `--verbose` run (a JSON array, or one event per line with `stream-json`).
 *
 * **Details**
 *
 * Only the keys the critic loop reads are modeled; the CLI's other keys
 * (`subtype`, `duration_ms`, `session_id`, …) are ignored on decode. An
 * absent `is_error` decodes as `false`. An event without `result` (an
 * `error_max_turns` stop, for one) carries no final message.
 *
 * **Example** (Decode a successful envelope)
 *
 * ```ts
 * import { CriticClaudeResult } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(CriticClaudeResult)({ type: "result", subtype: "success", is_error: false, result: "{}" })
 * console.log(event.is_error, O.getOrElse(event.result, () => "")) // false "{}"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticClaudeResult extends S.Opaque<CriticClaudeResult, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("result").annotateKey({ description: "Event kind; only the result event ends a run." }),
    is_error: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(false)),
      S.annotateKey({ description: "Whether the run ended in an error; absent means it did not." })
    ),
    result: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "The reviewer's final message, absent when the run stopped without one.",
    }),
  }).pipe(
    $I.annoteSchema("CriticClaudeResult", {
      description: "Error flag and final message of the result event a claude -p run prints.",
    })
  )
) {}

/**
 * The `result` event of a `claude -p` run that ended because one response ran
 * past the output-token cap (`CLAUDE_CODE_MAX_OUTPUT_TOKENS`).
 *
 * **Details**
 *
 * The CLI flags such a run `is_error`, sets `api_error` to
 * `"max_output_tokens"` (and `terminal_reason` to `"api_error"`, which is not
 * read), and puts its own message, naming the cap, in `result`. Only `type`,
 * `api_error` and `result` are modeled; any other `api_error` does not decode.
 *
 * **Example** (Decode the stop)
 *
 * ```ts
 * import { CriticClaudeOutputLimitStop } from "@beep/repo-cli/commands/Drawings"
 * import * as S from "effect/Schema"
 *
 * const stop = S.decodeUnknownSync(CriticClaudeOutputLimitStop)({ type: "result", is_error: true, api_error: "max_output_tokens", result: "API Error: Claude's response exceeded the 64000 output token maximum." })
 * console.log(stop.api_error) // "max_output_tokens"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticClaudeOutputLimitStop extends S.Opaque<
  CriticClaudeOutputLimitStop,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("result").annotateKey({ description: "Event kind; only the result event ends a run." }),
    api_error: S.tag("max_output_tokens").annotateKey({
      description: "The API error the run ended on: one response ran past the output-token cap.",
    }),
    result: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "The CLI's message, which names the cap; absent when it printed none.",
    }),
  }).pipe(
    $I.annoteSchema("CriticClaudeOutputLimitStop", {
      description: "The result event of a claude -p run that ended at the output-token cap, with the CLI's message.",
    })
  )
) {}

/**
 * Any event `claude -p` prints with `--output-format stream-json --verbose`:
 * a JSON object whose `type` is a string.
 *
 * **Details**
 *
 * Only `type` is modeled, so every event kind (`system`, `assistant`,
 * `user`, `result`) decodes; a line that is JSON but not such an object
 * (a bare number, an array) is not an event.
 *
 * **Example** (Tell an event from other JSON)
 *
 * ```ts
 * import { CriticClaudeEvent } from "@beep/repo-cli/commands/Drawings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CriticClaudeEvent)({ type: "system", subtype: "init" }), S.is(CriticClaudeEvent)([1])) // true false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CriticClaudeEvent extends S.Opaque<CriticClaudeEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.String.annotateKey({ description: "Event kind." }),
  }).pipe(
    $I.annoteSchema("CriticClaudeEvent", {
      description: "Any claude -p stream-json event: a JSON object with a string `type`.",
    })
  )
) {}
