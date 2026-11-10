/**
 * Versioned schemas for the Stage-2 knowledge doctor: classified spans, resolution witnesses,
 * evaluation outcomes, and the read-only report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { GoalStatus } from "../Goals/Goals.schemas.ts";
import { KnowledgeCommitSha, KnowledgeRefSurface } from "./Knowledge.refs.ts";
import {
  KnowledgeFinding,
  KnowledgeFindingCandidate,
  KnowledgeFindingId,
  KnowledgeFindingKind,
  KnowledgeFindingLocation,
} from "./Knowledge.schemas.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.schemas");

/**
 * The class a reference-shaped span is assigned by the ordered classification rule table.
 *
 * **Details**
 *
 * `generated-example` marks the fence of a `beep:generated=<producer-id>` block, `historical-with-commit`
 * a span on an archival path under an ancestor historical citation, `verified` every span on a live
 * surface (always checked at the scanned tree), and `unclassified` everything else.
 *
 * **Example** (Recognize the live-surface class)
 *
 * ```ts
 * import { KnowledgeSpanClass } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeSpanClass.is.verified("verified")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeSpanClass = LiteralKit([
  "verified",
  "generated-example",
  "historical-with-commit",
  "unclassified",
]).pipe(
  $I.annoteSchema("KnowledgeSpanClass", {
    description: "Span class assigned by the total, ordered knowledge-doctor classification rule table.",
  })
);

/**
 * The class a reference-shaped span is assigned by the ordered classification rule table.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeSpanClass = typeof KnowledgeSpanClass.Type;

/**
 * The syntactic form a span was extracted from.
 *
 * **Details**
 *
 * `path` is an inline code span naming a governed repository path, `path-assertion` a
 * `<!-- beep:assert path-exists ... -->` marker, `command` an inline `bun run beep` span, and
 * `generated-fence` the opening delimiter of a fence whose info string carries `beep:generated=`.
 *
 * The domain forms: `packet-status` is a `goals/<slug>` span followed by a lifecycle word span,
 * `packet-phase` the phase id that opens a packet README's `## Current Phase` section, `symbol` an
 * inline `@beep/*` package or subpath span, `symbol-export` an identifier span written as imported
 * from an `@beep/*` span, and `skill` one installed or locked skill, synthesized from the tree rather
 * than read from prose.
 *
 * **Example** (Recognize a command span form)
 *
 * ```ts
 * import { KnowledgeSpanForm } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeSpanForm.is.command("command")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeSpanForm = LiteralKit([
  "path",
  "path-assertion",
  "command",
  "generated-fence",
  "packet-status",
  "packet-phase",
  "symbol",
  "symbol-export",
  "skill",
]).pipe(
  $I.annoteSchema("KnowledgeSpanForm", {
    description: "Syntactic form of one extracted knowledge reference span.",
  })
);

/**
 * The syntactic form a span was extracted from.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeSpanForm = typeof KnowledgeSpanForm.Type;

/**
 * Identifiers of the evaluators that check classified spans.
 *
 * **Example** (Recognize the paths evaluator)
 *
 * ```ts
 * import { KnowledgeEvaluatorId } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeEvaluatorId.is.paths("paths")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeEvaluatorId = LiteralKit(["paths", "commands", "symbols", "packet-status", "skills-local"]).pipe(
  $I.annoteSchema("KnowledgeEvaluatorId", {
    description: "Identifier of one witness-bearing knowledge-doctor evaluator.",
  })
);

/**
 * Identifiers of the evaluators that check classified spans.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeEvaluatorId = typeof KnowledgeEvaluatorId.Type;

/**
 * Which gate owns a finding's blocking decision.
 *
 * **Details**
 *
 * `owned` findings belong to the knowledge doctor. `delegated` findings are already gated by a domain
 * command and appear in the report only as causal context; they are never baselined here.
 *
 * **Example** (Recognize an owned finding)
 *
 * ```ts
 * import { KnowledgeFindingOrigin } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeFindingOrigin.is.owned("owned")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeFindingOrigin = LiteralKit(["owned", "delegated"]).pipe(
  $I.annoteSchema("KnowledgeFindingOrigin", {
    description: "Whether the knowledge doctor or a domain command owns a finding's gate.",
  })
);

/**
 * Which gate owns a finding's blocking decision.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeFindingOrigin = typeof KnowledgeFindingOrigin.Type;

/**
 * The two spellings of a historical citation.
 *
 * **Details**
 *
 * `block` is `<!-- beep:historical commit=<40-hex> -->` on its own line, scoping the next Markdown
 * block. `document` is the frontmatter key `beep-historical: <40-hex>`, scoping the whole document.
 *
 * **Example** (Recognize a block citation)
 *
 * ```ts
 * import { KnowledgeHistoricalCitationForm } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeHistoricalCitationForm.is.block("block")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeHistoricalCitationForm = LiteralKit(["block", "document"]).pipe(
  $I.annoteSchema("KnowledgeHistoricalCitationForm", {
    description: "Block-comment or frontmatter spelling of a historical citation.",
  })
);

/**
 * The two spellings of a historical citation.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeHistoricalCitationForm = typeof KnowledgeHistoricalCitationForm.Type;

/**
 * One historical citation marker and the commit it cites.
 *
 * **Example** (Describe a block citation)
 *
 * ```ts
 * import { KnowledgeHistoricalCitation } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const citation = KnowledgeHistoricalCitation.make({
 *   form: "block",
 *   commit: "2162ebdc8a2162ebdc8a2162ebdc8a2162ebdc8a",
 *   line: 3,
 * })
 *
 * console.log(citation.form) // "block"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeHistoricalCitation extends S.Opaque<
  KnowledgeHistoricalCitation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    form: KnowledgeHistoricalCitationForm,
    commit: KnowledgeCommitSha,
    line: S.Natural,
  }).pipe(
    $I.annoteSchema("KnowledgeHistoricalCitation", {
      description: "A historical citation marker, its cited commit, and the 1-based line it sits on.",
    })
  )
) {}

/**
 * One reference-shaped span with the context the classification rule table reads.
 *
 * **Details**
 *
 * `raw` is the span exactly as written: the inline code content, the asserted path, or the producer
 * id of a generated fence. `generatedBy` is set only for a `generated-fence` span. `citation` is the
 * innermost historical citation covering the span (a block marker wins over the document marker),
 * whether or not it later proves valid.
 *
 * **Example** (Describe a live path span)
 *
 * ```ts
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeSpan } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const span = KnowledgeSpan.make({
 *   form: "path",
 *   documentPath: "docs/README.md",
 *   surface: "live",
 *   location: KnowledgeFindingLocation.make({ path: "docs/README.md", line: 1, column: 5 }),
 *   raw: "goals/INDEX.md",
 *   generatedBy: O.none(),
 *   citation: O.none(),
 * })
 *
 * console.log(span.surface) // "live"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSpan extends S.Opaque<KnowledgeSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    form: KnowledgeSpanForm,
    documentPath: S.String,
    surface: KnowledgeRefSurface,
    location: KnowledgeFindingLocation,
    raw: S.String,
    generatedBy: S.OptionFromOptionalKey(S.String),
    citation: S.OptionFromOptionalKey(KnowledgeHistoricalCitation),
  }).pipe(
    $I.annoteSchema("KnowledgeSpan", {
      description: "One extracted knowledge reference span plus its classification context.",
    })
  )
) {}

/**
 * One registered producer and the derived repository path it writes.
 *
 * **Example** (Register the goals index projection)
 *
 * ```ts
 * import { KnowledgeProducerOutput } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const output = KnowledgeProducerOutput.make({ producerId: "producer://goals/index", targetPath: "goals/INDEX.md" })
 *
 * console.log(output.producerId) // "producer://goals/index"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeProducerOutput extends S.Opaque<KnowledgeProducerOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    producerId: S.String,
    targetPath: S.String,
  }).pipe(
    $I.annoteSchema("KnowledgeProducerOutput", {
      description: "A registered producer id and the derived repository path it owns.",
    })
  )
) {}

/**
 * Witness that a tracked tree entry, or a tracked directory, exists.
 *
 * **Details**
 *
 * `path` is the normalized repository path the span resolved to. When it names a directory, the
 * witness is the whole directory: hiding it hides every entry below it.
 *
 * **Example** (Witness a tracked file)
 *
 * ```ts
 * import { TreeEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(TreeEntryWitness.make({ path: "goals/INDEX.md" })._tag) // "TreeEntryWitness"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TreeEntryWitness extends S.Opaque<TreeEntryWitness, { readonly brand: unique symbol }>()(
  S.TaggedStruct("TreeEntryWitness", { path: S.String }).pipe(
    $I.annoteSchema("TreeEntryWitness", {
      description: "A tracked tree entry or directory whose existence resolved a span.",
    })
  )
) {}

/**
 * Witness that a command node, or one declared option on it, exists in the static command surface.
 *
 * **Details**
 *
 * `commandPath` is the canonical command path (aliases resolved); the empty path is the CLI root,
 * which is also where the Effect CLI built-in global flags live. `option` is the flag's canonical
 * name when the witness is an option rather than the command itself.
 *
 * **Example** (Witness a declared option)
 *
 * ```ts
 * import { CommandNodeWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const witness = CommandNodeWitness.make({ commandPath: ["knowledge", "refs"], option: "json" })
 *
 * console.log(witness.option) // "json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommandNodeWitness extends S.Opaque<CommandNodeWitness, { readonly brand: unique symbol }>()(
  S.TaggedStruct("CommandNodeWitness", { commandPath: S.Array(S.String), option: S.optionalKey(S.String) }).pipe(
    $I.annoteSchema("CommandNodeWitness", {
      description: "A static command node, or one declared flag on it, that resolved a span.",
    })
  )
) {}

/**
 * Witness that a registered producer owns an untracked derived path.
 *
 * **Example** (Witness the goals index projection)
 *
 * ```ts
 * import { ProducerWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const witness = ProducerWitness.make({ producerId: "producer://goals/index", targetPath: "goals/INDEX.md" })
 *
 * console.log(witness.targetPath) // "goals/INDEX.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProducerWitness extends S.Opaque<ProducerWitness, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ProducerWitness", { producerId: S.String, targetPath: S.String }).pipe(
    $I.annoteSchema("ProducerWitness", {
      description: "A registered producer whose derived output resolved a span naming an untracked path.",
    })
  )
) {}

/**
 * Witness that a goal-packet manifest decodes and holds one field.
 *
 * **Details**
 *
 * `field` is `initiative.status` for a lifecycle claim and `phases.<id>` for a phase claim.
 * Removing the witness drops exactly that field from the packet facts the evaluators read.
 *
 * **Example** (Witness a packet lifecycle)
 *
 * ```ts
 * import { ManifestFieldWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const witness = ManifestFieldWitness.make({ slug: "goals-doctor", field: "initiative.status" })
 *
 * console.log(witness.field) // "initiative.status"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ManifestFieldWitness extends S.Opaque<ManifestFieldWitness, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ManifestFieldWitness", { slug: S.String, field: S.String }).pipe(
    $I.annoteSchema("ManifestFieldWitness", {
      description: "A decoded goal-packet manifest field that resolved a packet claim.",
    })
  )
) {}

/**
 * Witness that a workspace file exposes one export.
 *
 * **Details**
 *
 * For a package manifest the export is an `exports` map key (`.` or `./Sub`); for the root
 * `tsconfig.json` it is a `paths` alias; for a source file it is a declared or re-exported
 * identifier. Map keys start with `.` or `@` and identifiers never do, so one witness shape covers
 * all three, and removing it drops exactly that export from that file.
 *
 * **Example** (Witness an exported identifier)
 *
 * ```ts
 * import { ExportWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const witness = ExportWitness.make({
 *   packageName: "@beep/schema",
 *   file: "packages/foundation/modeling/schema/src/LiteralKit.ts",
 *   exportName: "LiteralKit",
 * })
 *
 * console.log(witness.exportName) // "LiteralKit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportWitness extends S.Opaque<ExportWitness, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ExportWitness", { packageName: S.String, file: S.String, exportName: S.String }).pipe(
    $I.annoteSchema("ExportWitness", {
      description: "An exports-map key, path alias, or exported identifier of one workspace file.",
    })
  )
) {}

/**
 * Witness that `skills-lock.json` records one skill.
 *
 * **Example** (Witness a lock entry)
 *
 * ```ts
 * import { LockEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(LockEntryWitness.make({ skill: "yeet" })._tag) // "LockEntryWitness"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LockEntryWitness extends S.Opaque<LockEntryWitness, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LockEntryWitness", { skill: S.String }).pipe(
    $I.annoteSchema("LockEntryWitness", {
      description: "A skills-lock entry that resolved a skill span.",
    })
  )
) {}

/**
 * Any resolution witness an evaluator may cite.
 *
 * **Example** (Discriminate a witness)
 *
 * ```ts
 * import { ResolutionWitness, TreeEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(ResolutionWitness.guards.TreeEntryWitness(TreeEntryWitness.make({ path: "docs" }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResolutionWitness = S.Union([
  TreeEntryWitness,
  CommandNodeWitness,
  ProducerWitness,
  ManifestFieldWitness,
  ExportWitness,
  LockEntryWitness,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ResolutionWitness", {
    description:
      "A tree entry, command node, producer output, manifest field, export, or lock entry that proves one span resolved.",
  })
);

/**
 * Any resolution witness an evaluator may cite.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolutionWitness = typeof ResolutionWitness.Type;

/**
 * Whether a goal packet's manifest is present and decodes.
 *
 * **Example** (Recognize a decoded manifest)
 *
 * ```ts
 * import { KnowledgePacketManifestState } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgePacketManifestState.is.decoded("decoded")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgePacketManifestState = LiteralKit(["decoded", "missing", "invalid"]).pipe(
  $I.annoteSchema("KnowledgePacketManifestState", {
    description: "Whether a goal packet's ops/manifest.json is decoded, missing, or invalid.",
  })
);

/**
 * Whether a goal packet's manifest is present and decodes.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgePacketManifestState = typeof KnowledgePacketManifestState.Type;

/**
 * The packet facts packet claims are checked against, read from one tree.
 *
 * **Details**
 *
 * `status` is the manifest's `initiative.status` and `phaseIds` its phase ids, both present only for
 * a decoded manifest. A missing or invalid manifest is a goals-doctor finding; the claims beneath it
 * fail with that finding as their cause.
 *
 * **Example** (Describe an active packet)
 *
 * ```ts
 * import { KnowledgePacketFacts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const facts = KnowledgePacketFacts.make({
 *   slug: "goals-doctor",
 *   manifestPath: "goals/goals-doctor/ops/manifest.json",
 *   manifest: "decoded",
 *   status: O.some("active"),
 *   phaseIds: ["P0", "P1"],
 * })
 *
 * console.log(facts.phaseIds.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgePacketFacts extends S.Opaque<KnowledgePacketFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    manifestPath: S.String,
    manifest: KnowledgePacketManifestState,
    status: S.OptionFromOptionalKey(GoalStatus),
    phaseIds: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgePacketFacts", {
      description: "One goal packet's manifest state, lifecycle status, and phase ids as read from a tree.",
    })
  )
) {}

/**
 * One entry point a workspace manifest exposes: an `exports` key or a `tsconfig.json` path alias.
 *
 * **Details**
 *
 * `target` is the repository path the key resolves to; it is absent when the map blocks the key
 * with `null`. A key may carry one `*` wildcard, matched like Node's subpath patterns.
 *
 * **Example** (Describe the root export)
 *
 * ```ts
 * import { KnowledgePackageEntrypoint } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const entry = KnowledgePackageEntrypoint.make({ key: ".", target: O.some("packages/x/src/index.ts") })
 *
 * console.log(entry.key) // "."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgePackageEntrypoint extends S.Opaque<
  KnowledgePackageEntrypoint,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    key: S.String,
    target: S.OptionFromOptionalKey(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgePackageEntrypoint", {
      description: "An exports-map key or path alias and the repository path it resolves to, if any.",
    })
  )
) {}

/**
 * One `@beep/*` workspace package as read from a tracked `package.json`.
 *
 * **Example** (Describe a package without an exports map)
 *
 * ```ts
 * import { KnowledgeWorkspacePackage } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const pkg = KnowledgeWorkspacePackage.make({
 *   name: "@beep/demo",
 *   manifestPath: "apps/demo/package.json",
 *   root: "apps/demo",
 *   entrypoints: [],
 * })
 *
 * console.log(pkg.root) // "apps/demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeWorkspacePackage extends S.Opaque<KnowledgeWorkspacePackage, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    manifestPath: S.String,
    root: S.String,
    entrypoints: S.Array(KnowledgePackageEntrypoint),
  }).pipe(
    $I.annoteSchema("KnowledgeWorkspacePackage", {
      description: "A workspace package name, manifest path, root, and exports-map entry points.",
    })
  )
) {}

/**
 * The exports one source file declares itself, plus the files it re-exports wholesale.
 *
 * **Details**
 *
 * `names` come from a declaration scan (`export const|function|class|interface|type|enum|namespace`,
 * `export { a, b as c }`, `export * as ns from`), never from the compiler. `stars` are the repository
 * paths of relative `export * from` targets that exist in the tree; `opaqueStars` are the specifiers of
 * every other `export * from` (a package, or a relative target the tree lacks), which the export search
 * cannot follow, so an identifier missing behind one is unproven rather than absent.
 *
 * **Example** (Describe a barrel)
 *
 * ```ts
 * import { KnowledgeFileExports } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const exports = KnowledgeFileExports.make({ file: "src/index.ts", names: [], stars: ["src/a.ts"], opaqueStars: [] })
 *
 * console.log(exports.stars) // [ "src/a.ts" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeFileExports extends S.Opaque<KnowledgeFileExports, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    names: S.Array(S.String),
    stars: S.Array(S.String),
    opaqueStars: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeFileExports", {
      description:
        "Identifiers one source file exports itself, the files it star re-exports, and the star specifiers it cannot follow.",
    })
  )
) {}

/**
 * One skills-lock entry, normalized across lock versions 1 and 2.
 *
 * **Details**
 *
 * `revision` is the pinned upstream revision (v2 `upstream.sourceRevision`) or the floating v1
 * `ref`; `licensed` records whether a `SkillLicense` is on the entry. A local skill needs neither.
 * `line` is the 1-based line of the entry's key in `skills-lock.json`.
 *
 * **Example** (Describe a local skill)
 *
 * ```ts
 * import { KnowledgeSkillLockFacts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const facts = KnowledgeSkillLockFacts.make({
 *   skill: "yeet",
 *   sourceType: "local",
 *   source: O.none(),
 *   revision: O.none(),
 *   licensed: false,
 *   installedTargets: [".claude/skills/yeet"],
 *   line: O.some(3),
 * })
 *
 * console.log(facts.sourceType) // "local"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSkillLockFacts extends S.Opaque<KnowledgeSkillLockFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    skill: S.String,
    sourceType: S.String,
    source: S.OptionFromOptionalKey(S.String),
    revision: S.OptionFromOptionalKey(S.String),
    licensed: S.Boolean,
    installedTargets: S.Array(S.String),
    line: S.OptionFromOptionalKey(S.Natural),
  }).pipe(
    $I.annoteSchema("KnowledgeSkillLockFacts", {
      description: "One skills-lock entry's source type, upstream, revision, license presence, and targets.",
    })
  )
) {}

/**
 * The skill facts the hermetic skills evaluator reads from one tree.
 *
 * **Details**
 *
 * `installed` lists every `.claude/skills/<name>` directory that tracks a `SKILL.md`, the same rule
 * `skills update` uses; `lockVersion` is absent when the tree has no `skills-lock.json`.
 *
 * **Example** (A tree without skills)
 *
 * ```ts
 * import { KnowledgeSkillsFacts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const facts = KnowledgeSkillsFacts.make({ lockVersion: O.none(), entries: [], installed: [] })
 *
 * console.log(facts.installed.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSkillsFacts extends S.Opaque<KnowledgeSkillsFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    lockVersion: S.OptionFromOptionalKey(S.Literals([1, 2])),
    entries: S.Array(KnowledgeSkillLockFacts),
    installed: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeSkillsFacts", {
      description: "Normalized skills-lock entries plus the installed skill directories of one tree.",
    })
  )
) {}

/**
 * One failure an evaluator found in a span, with the identity of its cause.
 *
 * **Details**
 *
 * `causeKey` names the missing target (a path, command node, or option), so one deleted target cited
 * from many documents shares one cause.
 *
 * **Example** (Describe a missing-path failure)
 *
 * ```ts
 * import { KnowledgeFindingCandidate, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeEvaluationFailure } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const failure = KnowledgeEvaluationFailure.make({
 *   candidate: KnowledgeFindingCandidate.make({
 *     kind: "broken-tracked-path",
 *     documentId: "doc:docs/README.md",
 *     subject: "repo-path:docs/missing.md",
 *     location: KnowledgeFindingLocation.make({ path: "docs/README.md" }),
 *     message: "Tracked path does not exist: docs/missing.md.",
 *     remediation: "Update the inline path or add the tracked target.",
 *   }),
 *   causeKey: "path:docs/missing.md",
 * })
 *
 * console.log(failure.causeKey) // "path:docs/missing.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeEvaluationFailure extends S.Opaque<
  KnowledgeEvaluationFailure,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    candidate: KnowledgeFindingCandidate,
    causeKey: S.String,
  }).pipe(
    $I.annoteSchema("KnowledgeEvaluationFailure", {
      description: "A finding candidate plus the identity of the missing target that caused it.",
    })
  )
) {}

/**
 * A span that resolved, carrying the non-empty witnesses that prove it.
 *
 * **Details**
 *
 * The witness array is schema-enforced non-empty, so witness-free success cannot be represented and
 * every pass is counterfactually testable. `unchecked` lists option tokens the evaluator could not
 * check because the resolved command's options are not statically derivable; they are reported,
 * never silently counted as passes.
 *
 * **Example** (Resolve a span through one tree entry)
 *
 * ```ts
 * import { EvaluationResolved, TreeEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const resolved = EvaluationResolved.make({
 *   witnesses: [TreeEntryWitness.make({ path: "goals/INDEX.md" })],
 *   unchecked: [],
 * })
 *
 * console.log(resolved.witnesses.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvaluationResolved extends S.Opaque<EvaluationResolved, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Resolved", {
    witnesses: S.NonEmptyArray(ResolutionWitness),
    unchecked: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("EvaluationResolved", {
      description: "A resolved span with its non-empty resolution witnesses and any unchecked option tokens.",
    })
  )
) {}

/**
 * A span that failed, carrying one or more failures.
 *
 * **Example** (Check the failed tag)
 *
 * ```ts
 * import { KnowledgeFindingCandidate, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { EvaluationFailed, KnowledgeEvaluationFailure } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const failed = EvaluationFailed.make({
 *   failures: [
 *     KnowledgeEvaluationFailure.make({
 *       candidate: KnowledgeFindingCandidate.make({
 *         kind: "unknown-beep-command",
 *         documentId: "doc:AGENTS.md",
 *         subject: "beep-command:nope",
 *         location: KnowledgeFindingLocation.make({ path: "AGENTS.md" }),
 *         message: "Unknown beep command path: nope.",
 *         remediation: "Update the inline command.",
 *       }),
 *       causeKey: "command:nope",
 *     }),
 *   ],
 * })
 *
 * console.log(failed._tag) // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvaluationFailed extends S.Opaque<EvaluationFailed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Failed", { failures: S.NonEmptyArray(KnowledgeEvaluationFailure) }).pipe(
    $I.annoteSchema("EvaluationFailed", {
      description: "A span whose evaluation found one or more failures.",
    })
  )
) {}

/**
 * The outcome of evaluating one span.
 *
 * **Example** (Discriminate an outcome)
 *
 * ```ts
 * import {
 *   EvaluationResolved,
 *   KnowledgeEvaluationOutcome,
 *   TreeEntryWitness,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const outcome = EvaluationResolved.make({ witnesses: [TreeEntryWitness.make({ path: "docs" })], unchecked: [] })
 *
 * console.log(KnowledgeEvaluationOutcome.guards.Resolved(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeEvaluationOutcome = S.Union([EvaluationResolved, EvaluationFailed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("KnowledgeEvaluationOutcome", {
    description: "Resolved-with-witnesses or failed outcome of one span evaluation.",
  })
);

/**
 * The outcome of evaluating one span.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeEvaluationOutcome = typeof KnowledgeEvaluationOutcome.Type;

/**
 * The spans and historical markers extracted from one document.
 *
 * **Example** (An empty extraction)
 *
 * ```ts
 * import { KnowledgeDocumentExtraction } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeDocumentExtraction.make({ markers: [], spans: [] }).spans.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDocumentExtraction extends S.Opaque<
  KnowledgeDocumentExtraction,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    markers: S.Array(KnowledgeHistoricalCitation),
    spans: S.Array(KnowledgeSpan),
  }).pipe(
    $I.annoteSchema("KnowledgeDocumentExtraction", {
      description: "Source-ordered spans plus every historical marker extracted from one document.",
    })
  )
) {}

/**
 * How one witness behaved under its counterfactual overlay.
 *
 * **Details**
 *
 * `failed`: removing the witness made the span fail, the expected verdict. `rebound`: the span still
 * resolved through a different, independently held witness (for example an option alias shadowed by
 * a global flag). `vacuous`: the span still resolved citing the removed witness, or the witness did
 * not hold in the tree to begin with, so the evaluator's pass did not depend on the tree.
 *
 * **Example** (Recognize the expected verdict)
 *
 * ```ts
 * import { KnowledgeCounterfactualVerdictKind } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeCounterfactualVerdictKind.is.failed("failed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeCounterfactualVerdictKind = LiteralKit(["failed", "rebound", "vacuous"]).pipe(
  $I.annoteSchema("KnowledgeCounterfactualVerdictKind", {
    description: "Outcome of re-evaluating a resolved span with one of its witnesses removed.",
  })
);

/**
 * How one witness behaved under its counterfactual overlay.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeCounterfactualVerdictKind = typeof KnowledgeCounterfactualVerdictKind.Type;

/**
 * One counterfactual-harness row: the span, the removed witness, and the verdict.
 *
 * **Example** (Describe a load-bearing witness)
 *
 * ```ts
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import {
 *   KnowledgeCounterfactualVerdict,
 *   KnowledgeSpan,
 *   TreeEntryWitness,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const row = KnowledgeCounterfactualVerdict.make({
 *   evaluator: "paths",
 *   span: KnowledgeSpan.make({
 *     form: "path",
 *     documentPath: "AGENTS.md",
 *     surface: "live",
 *     location: KnowledgeFindingLocation.make({ path: "AGENTS.md" }),
 *     raw: "goals",
 *     generatedBy: O.none(),
 *     citation: O.none(),
 *   }),
 *   witness: TreeEntryWitness.make({ path: "goals" }),
 *   verdict: "failed",
 * })
 *
 * console.log(row.verdict) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCounterfactualVerdict extends S.Opaque<
  KnowledgeCounterfactualVerdict,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    evaluator: KnowledgeEvaluatorId,
    span: KnowledgeSpan,
    witness: ResolutionWitness,
    verdict: KnowledgeCounterfactualVerdictKind,
  }).pipe(
    $I.annoteSchema("KnowledgeCounterfactualVerdict", {
      description: "A resolved span, one of its witnesses, and how the span behaved with that witness removed.",
    })
  )
) {}

/**
 * One knowledge-doctor finding: a v1 finding plus its span class, origin, evaluator, and cause.
 *
 * **Details**
 *
 * `evaluator` is absent for findings the classification stage emits itself, such as a historical
 * marker on a live surface.
 *
 * **Example** (Read the span class of a doctor finding)
 *
 * ```ts
 * import { KnowledgeFinding, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeDoctorFinding } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const finding = KnowledgeDoctorFinding.make({
 *   finding: KnowledgeFinding.make({
 *     findingId: "knowledge-finding/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     kind: "broken-tracked-path",
 *     severity: "blocking",
 *     documentId: "doc:docs/README.md",
 *     subject: "repo-path:docs/missing.md",
 *     occurrence: 0,
 *     location: KnowledgeFindingLocation.make({ path: "docs/README.md" }),
 *     message: "Tracked path does not exist: docs/missing.md.",
 *     remediation: "Update the inline path or add the tracked target.",
 *   }),
 *   spanClass: "verified",
 *   origin: "owned",
 *   evaluator: O.some("paths"),
 *   causeKey: "path:docs/missing.md",
 * })
 *
 * console.log(finding.spanClass) // "verified"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorFinding extends S.Opaque<KnowledgeDoctorFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    finding: KnowledgeFinding,
    spanClass: KnowledgeSpanClass,
    origin: KnowledgeFindingOrigin,
    evaluator: S.OptionFromOptionalKey(KnowledgeEvaluatorId),
    causeKey: S.String,
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorFinding", {
      description: "A normalized finding with its span class, gate owner, evaluator, and cause identity.",
    })
  )
) {}

/**
 * Per-class span totals for one scanned tree.
 *
 * **Example** (Count no spans)
 *
 * ```ts
 * import { KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const counts = KnowledgeSpanCounts.make({
 *   verified: 0,
 *   "generated-example": 0,
 *   "historical-with-commit": 0,
 *   unclassified: 0,
 * })
 *
 * console.log(counts.verified) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSpanCounts extends S.Opaque<KnowledgeSpanCounts, { readonly brand: unique symbol }>()(
  S.Struct({
    verified: S.Natural,
    "generated-example": S.Natural,
    "historical-with-commit": S.Natural,
    unclassified: S.Natural,
  }).pipe(
    $I.annoteSchema("KnowledgeSpanCounts", {
      description: "Number of extracted spans in each span class.",
    })
  )
) {}

/**
 * How a path left the tree's history: deleted outright, or renamed away.
 *
 * **Example** (Recognize a rename)
 *
 * ```ts
 * import { KnowledgePathChange } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgePathChange.is.renamed("renamed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgePathChange = LiteralKit(["deleted", "renamed"]).pipe(
  $I.annoteSchema("KnowledgePathChange", {
    description: "Whether a commit deleted a path or renamed it away.",
  })
);

/**
 * How a path left the tree's history.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgePathChange = typeof KnowledgePathChange.Type;

/**
 * One path a commit deleted or renamed away, read from `git log --diff-filter=DR`.
 *
 * **Example** (A rename with its new path)
 *
 * ```ts
 * import { KnowledgePathRemoval } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const removal = KnowledgePathRemoval.make({
 *   path: "docs/old.md",
 *   commit: "1111111111111111111111111111111111111111",
 *   subject: "docs: move the guide",
 *   change: "renamed",
 *   renamedTo: O.some("docs/new.md"),
 * })
 *
 * console.log(removal.change) // "renamed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgePathRemoval extends S.Opaque<KnowledgePathRemoval, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    commit: KnowledgeCommitSha,
    subject: S.String,
    change: KnowledgePathChange,
    renamedTo: S.OptionFromOptionalKey(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgePathRemoval", {
      description: "A path a commit deleted or renamed away, with the commit's subject and any rename target.",
    })
  )
) {}

/**
 * One commit of the tree-only removal walk: its id and every path it deleted, renames read as deletions.
 *
 * **Details**
 *
 * The walk is `git log --diff-filter=D --no-renames`, which compares trees and never reads a blob, so
 * it costs no object fetch in a blobless partial clone. A commit that renames a path lists the source
 * here as a deletion; the rename-detecting read of {@link KnowledgePathRemoval} lists the same paths
 * for the same commit.
 *
 * **Example** (One commit that removed two paths)
 *
 * ```ts
 * import { KnowledgeRemovalCommit } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const commit = KnowledgeRemovalCommit.make({
 *   commit: "1111111111111111111111111111111111111111",
 *   paths: ["docs/old.md", "packages/gone/package.json"],
 * })
 *
 * console.log(commit.paths.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRemovalCommit extends S.Opaque<KnowledgeRemovalCommit, { readonly brand: unique symbol }>()(
  S.Struct({
    commit: KnowledgeCommitSha,
    paths: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeRemovalCommit", {
      description: "A commit of the tree-only removal walk with every path it deleted or renamed away.",
    })
  )
) {}

/**
 * What a reader of the tree's path removals will look up, so only the commits it reads are resolved.
 *
 * **Details**
 *
 * `targets` are the paths whose newest removal (of the path itself or of a file under it) the cause
 * grouping attributes. The mint's retired-package names need no query: they come from the tree-only
 * walk's removed paths, which name every deleted or renamed-away `package.json` without a blob.
 *
 * **Example** (Ask for one target)
 *
 * ```ts
 * import { KnowledgePathRemovalQuery } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as HashSet from "effect/HashSet"
 *
 * const query = KnowledgePathRemovalQuery.make({ targets: HashSet.make("docs/gone.md") })
 *
 * console.log(HashSet.size(query.targets)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgePathRemovalQuery extends S.Opaque<KnowledgePathRemovalQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    targets: S.HashSet(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgePathRemovalQuery", {
      description: "The target paths whose newest removals one reader will look up.",
    })
  )
) {}

/**
 * The authoring commit of a cause group's root: the commit that removed the missing target.
 *
 * **Details**
 *
 * `removedPath` is the path the commit removed, which is the target itself or, for a directory
 * target, a file under it. `repairTarget` is the rename lineage's proposal for where the target went;
 * prose is never rewritten from it automatically.
 *
 * **Example** (Attribute a deleted file)
 *
 * ```ts
 * import { KnowledgeRootAttribution } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const attribution = KnowledgeRootAttribution.make({
 *   commit: "1111111111111111111111111111111111111111",
 *   subject: "chore: drop the old guide",
 *   change: "deleted",
 *   removedPath: "docs/old.md",
 *   repairTarget: O.none(),
 * })
 *
 * console.log(attribution.change) // "deleted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRootAttribution extends S.Opaque<KnowledgeRootAttribution, { readonly brand: unique symbol }>()(
  S.Struct({
    commit: KnowledgeCommitSha,
    subject: S.String,
    change: KnowledgePathChange,
    removedPath: S.String,
    repairTarget: S.OptionFromOptionalKey(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeRootAttribution", {
      description: "The commit that removed a cause group's missing target, plus any rename repair proposal.",
    })
  )
) {}

/**
 * Findings that share one cause: a missing target, or a delegated domain finding.
 *
 * **Details**
 *
 * `rootOrigin` is `delegated` when a delegated domain finding carries the group's `causeKey`; `root`
 * is then that finding's id and `dependents` are the owned findings it explains. Otherwise the cause
 * is a target the knowledge doctor owns (a path, command node, export, or manifest claim), `root` is
 * absent, and `dependents` are every finding naming it. Dependents are sorted by id.
 *
 * **Example** (One deleted file cited twice)
 *
 * ```ts
 * import { KnowledgeCauseGroup } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const group = KnowledgeCauseGroup.make({
 *   causeKey: "path:docs/old.md",
 *   rootOrigin: "owned",
 *   root: O.none(),
 *   dependents: [
 *     "knowledge-finding/v1:1111111111111111111111111111111111111111111111111111111111111111",
 *     "knowledge-finding/v1:2222222222222222222222222222222222222222222222222222222222222222",
 *   ],
 *   attribution: O.none(),
 * })
 *
 * console.log(group.dependents.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCauseGroup extends S.Opaque<KnowledgeCauseGroup, { readonly brand: unique symbol }>()(
  S.Struct({
    causeKey: S.String,
    rootOrigin: KnowledgeFindingOrigin,
    root: S.OptionFromOptionalKey(KnowledgeFindingId),
    dependents: S.Array(KnowledgeFindingId),
    attribution: S.OptionFromOptionalKey(KnowledgeRootAttribution),
  }).pipe(
    $I.annoteSchema("KnowledgeCauseGroup", {
      description:
        "Every finding sharing one cause key, its delegated root when one exists, and the root's authoring commit.",
    })
  )
) {}

/**
 * Whether the scanned tree's Git history was available for root attribution.
 *
 * **Details**
 *
 * `unavailable` (a shallow clone, or no readable history) leaves every group unattributed; the report
 * itself never fails on missing history.
 *
 * **Example** (Recognize available history)
 *
 * ```ts
 * import { KnowledgeRootHistory } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeRootHistory.is.available("available")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRootHistory = LiteralKit(["available", "unavailable"]).pipe(
  $I.annoteSchema("KnowledgeRootHistory", {
    description: "Whether Git history was available to attribute cause-group roots.",
  })
);

/**
 * Whether the scanned tree's Git history was available for root attribution.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeRootHistory = typeof KnowledgeRootHistory.Type;

/**
 * Whether a doctor report is the read-only census or the gating check.
 *
 * **Example** (Recognize the gating form)
 *
 * ```ts
 * import { KnowledgeDoctorMode } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * console.log(KnowledgeDoctorMode.is.check("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeDoctorMode = LiteralKit(["report", "check"]).pipe(
  $I.annoteSchema("KnowledgeDoctorMode", {
    description: "Read-only report or gating check form of a knowledge-doctor run.",
  })
);

/**
 * Whether a doctor report is the read-only census or the gating check.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeDoctorMode = typeof KnowledgeDoctorMode.Type;

/**
 * The durable identity of one baselineable finding in the sealed baseline.
 *
 * **Details**
 *
 * The digest covers the length-prefixed key version, kind, durable document identity, NFC subject,
 * and occurrence. The durable document identity is the path the document had at `mintedAt`, so a
 * rename since the mint keeps the key (contract 10).
 *
 * **Example** (Validate a key)
 *
 * ```ts
 * import { KnowledgeBaselineKey } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KnowledgeBaselineKey)(`knowledge-doctor/v1:${"a".repeat(64)}`)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeBaselineKey = S.TemplateLiteral(["knowledge-doctor/v1:", Sha256Hex]).pipe(
  $I.annoteSchema("KnowledgeBaselineKey", {
    description: "SHA-256 durable identity of one baselineable knowledge-doctor finding.",
  })
);

/**
 * The durable identity of one baselineable finding in the sealed baseline.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeBaselineKey = typeof KnowledgeBaselineKey.Type;

/**
 * One finding of the scanned tree with its baseline key.
 *
 * **Example** (Pair a finding with its key)
 *
 * ```ts
 * import { KnowledgeRatchetEntry } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const entry = KnowledgeRatchetEntry.make({
 *   findingId: `knowledge-finding/v1:${"1".repeat(64)}`,
 *   key: `knowledge-doctor/v1:${"2".repeat(64)}`,
 * })
 *
 * console.log(entry.key.startsWith("knowledge-doctor/v1:")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRatchetEntry extends S.Opaque<KnowledgeRatchetEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    findingId: KnowledgeFindingId,
    key: KnowledgeBaselineKey,
  }).pipe(
    $I.annoteSchema("KnowledgeRatchetEntry", {
      description: "A finding id of the scanned tree paired with its durable baseline key.",
    })
  )
) {}

/**
 * How the gating check classified every baselineable finding against the sealed baseline.
 *
 * **Details**
 *
 * `inherited` findings carry a baseline key and stay advisory. `leased` findings carry an active,
 * violation-free lease. `introduced` findings carry neither and belong to a kind promoted at the
 * merge-base, so they block. `pending` findings carry neither but belong to a kind still in its
 * report-only window, so they are listed and never block (contract 1). `resolved` lists baseline keys
 * no finding carries any more. `identityRejected` lists identity-sidecar mappings the C6 rules did not
 * admit, as `from -> to: reason`.
 *
 * **Example** (A clean check)
 *
 * ```ts
 * import { KnowledgeDoctorRatchet } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 *
 * const ratchet = KnowledgeDoctorRatchet.make({
 *   baseRef: "origin/main",
 *   mergeBase: "1111111111111111111111111111111111111111",
 *   mintedAt: "2222222222222222222222222222222222222222",
 *   promotedKinds: [],
 *   introduced: [],
 *   pending: [],
 *   inherited: [],
 *   leased: [],
 *   resolved: [],
 *   identityRejected: [],
 * })
 *
 * console.log(ratchet.introduced.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorRatchet extends S.Opaque<KnowledgeDoctorRatchet, { readonly brand: unique symbol }>()(
  S.Struct({
    baseRef: S.String,
    mergeBase: KnowledgeCommitSha,
    mintedAt: KnowledgeCommitSha,
    promotedKinds: S.Array(KnowledgeFindingKind),
    introduced: S.Array(KnowledgeRatchetEntry),
    pending: S.Array(KnowledgeRatchetEntry),
    inherited: S.Array(KnowledgeRatchetEntry),
    leased: S.Array(KnowledgeRatchetEntry),
    resolved: S.Array(KnowledgeBaselineKey),
    identityRejected: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorRatchet", {
      description: "Introduced, pending, inherited, leased, and resolved buckets of a gating knowledge-doctor check.",
    })
  )
) {}

/**
 * The read-only `knowledge doctor --report` document.
 *
 * **Details**
 *
 * Findings are sorted by `findingId` and cause groups by `causeKey`, so two runs over one tree encode
 * to identical bytes. `findings` keeps every finding, delegated ones included; `groups` collapses
 * them into causal roots.
 * `ratchet` is present only in `check` mode, where governance findings (`baseline-tamper`, lease
 * violations) are listed among `findings` too.
 * `uncheckedOptionCount` totals option tokens on resolved commands whose declared options are not
 * statically derivable; a non-zero count is lost coverage, never a pass.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import { KnowledgeDoctorReport, KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const report = KnowledgeDoctorReport.make({
 *   treeish: "HEAD",
 *   tree: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   mode: "report",
 *   spanCounts: KnowledgeSpanCounts.make({
 *     verified: 0,
 *     "generated-example": 0,
 *     "historical-with-commit": 0,
 *     unclassified: 0,
 *   }),
 *   uncheckedOptionCount: 0,
 *   rootHistory: "available",
 *   groups: [],
 *   findings: [],
 *   ratchet: O.none(),
 * })
 *
 * console.log(report.schemaVersion) // "knowledge-doctor/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorReport extends S.Opaque<KnowledgeDoctorReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("knowledge-doctor/v1"),
    treeish: S.String,
    tree: KnowledgeCommitSha,
    mode: KnowledgeDoctorMode,
    spanCounts: KnowledgeSpanCounts,
    uncheckedOptionCount: S.Natural,
    rootHistory: KnowledgeRootHistory,
    groups: S.Array(KnowledgeCauseGroup),
    findings: S.Array(KnowledgeDoctorFinding),
    ratchet: S.OptionFromOptionalKey(KnowledgeDoctorRatchet),
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorReport", {
      description:
        "Knowledge-doctor report: span-class totals, causal groups, every classified finding, and the check ratchet.",
    })
  )
) {}

/**
 * Encodes a knowledge-doctor report as one canonical JSON line.
 *
 * **Example** (Encode an empty report)
 *
 * ```ts
 * import {
 *   encodeKnowledgeDoctorReportJson,
 *   KnowledgeDoctorReport,
 *   KnowledgeSpanCounts,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const report = KnowledgeDoctorReport.make({
 *   treeish: "HEAD",
 *   tree: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   mode: "report",
 *   spanCounts: KnowledgeSpanCounts.make({
 *     verified: 0,
 *     "generated-example": 0,
 *     "historical-with-commit": 0,
 *     unclassified: 0,
 *   }),
 *   uncheckedOptionCount: 0,
 *   rootHistory: "available",
 *   groups: [],
 *   findings: [],
 *   ratchet: O.none(),
 * })
 *
 * console.log(Effect.isEffect(encodeKnowledgeDoctorReportJson(report))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeKnowledgeDoctorReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<string, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(S.fromJsonString(KnowledgeDoctorReport)));

/**
 * Decodes a knowledge-doctor report from its JSON line.
 *
 * **Example** (Decode is effectful)
 *
 * ```ts
 * import { decodeKnowledgeDoctorReportJson } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeKnowledgeDoctorReportJson("{}"))) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeKnowledgeDoctorReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<KnowledgeDoctorReport, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<KnowledgeDoctorReport, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(KnowledgeDoctorReport)));
