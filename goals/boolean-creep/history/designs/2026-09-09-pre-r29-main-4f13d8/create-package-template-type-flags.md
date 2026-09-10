# R28 P2 design: create-package-template-type-flags

Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Native P2 source/design proof is bound by `data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md` and the original bytes are archived by `data/r28-cli-retained-integration.json`. Independent replacement P3 design review remains pending; no prior review approval is transferred and no product implementation or test acceptance is claimed. Preserve the complete decoded API, public schema/method/test-kit exports, full payloads and encoded outputs described below. Raw request defaults, typed diagnostics and their ordering remain supported contracts; their D1 owners are not implementation targets of this returned-state migration.

# Current shape

CreatePackage.command.ts732–765 exports TemplateContext, a real S.Class that
receives the resolved scaffold selection and full template payload. It carries
PackageType, optional PackageFamily/PackageKind/AppKind and eleven Booleans:
isTool/isApp/isLibrary, isNextjsApp/isTauriApp/isViteApp/isServiceApp/
isRuntimeProofApp/isRealApp, isLab/isEcosystem. The only constructor1477–1502
runs after type/app/family/kind/lab validation and the dry-run return1465.

ScaffoldShape1415 is a different private operation owner; it is not folded into
this public template model. No raw config flag object or anonymous handler
parameter is being admitted. Required names, scoped name, description, year,
parent directory, package path, rootRelative, portlessLabel, rootDirRelative,
identityAccessor and both language-service-plugin JSON strings are full
payloads. They retain exact bytes and do not become Boolean presence axes.

No other TemplateContext.make or live decoder/assignment fixture exists across
packages/apps. TemplateService's general record contexts are a different public
API. The malformed tiny S.is JSDoc candidate721–727 does not construct an
alternate supported TemplateContext. Public exports must still be migrated
honestly; this is not a private class just because its sole writer is local.

# Cardinality gap

The complete finite product is 3 types ×5 optional families ×9 optional kinds
×6 optional app kinds ×2^11 Booleans = **1,658,880**. Source permits **31**:

| Operation | Supported selection | Count |
| --- | --- | --- |
| Package | Type library or tool, each with no family/kind; drivers; ecosystem; foundation one of4 kinds; tooling one of4 kinds | 22 |
| Real app | nextjs/vite/service/tauri, each standard or lab, no family/kind | 8 |
| Runtime proof | runtime-proof, standard only, no family/kind | 1 |

For the no-family package branch a valid explicit parent override avoids the
normal inferred tooling family; keep that supported branch. Explicit tooling
kind is not constrained to equal PackageType. Stories admission is separate
and does not prohibit ordinary tool/foundation combinations. Every eleven-bit
projection is uniquely fixed by the chosen selection. Lab plus ecosystem is
impossible because lab requires app, and app rejects family. This relation
connects the old pair to both old flag rows; keeping three independent census
records would undercount the cluster and duplicate migration.

# Target schema

Retain the public TemplateContext name and all common payload fields. Replace
the fifteen-field classification cluster with one schema-owned `selection`.
Use existing LiteralKit building blocks at134–138/216–291 for literal domains,
not a new list of Boolean projections or hand-written TypeScript unions.

Model the31 states compositionally: a package branch owns nonapp PackageType
(library/tool) and a family-choice schema with eleven legal alternatives
(unclassified; drivers; ecosystem; each foundation/tooling kind). Real-app
branches own one of four real AppKind values and a named standard/lab placement
literal. Runtime-proof is its own branch with standard placement fixed.
This is a tagged schema family, not31 disconnected payload-free literals:
it carries full type/family/kind/app semantics while eliminating the repeated
flags. Use named case schema classes, existing kit literal values, S.Union
plus S.toTaggedUnion and derived S.is guards. No new schema accepts contradictory
selection families or stores both a selection and the eleven flags.

The command constructs selection only at the current TemplateContext.make
point from already-validated values. Keep all raw argument descriptors,
defaults, named errors and guard order. Do not move public CLI validation into
a TemplateContext codec and then change which diagnostic appears first.

# Migration inventory

- CreatePackage.command.ts134–138/216–291: reuse type/family/kind/app kits and
  existing validators. Add selection schemas in the current module or an
  architecture-approved neighboring schema role; any future split requires
  the existing architecture command before product edits, not a hand-built
  new package. No new public subpath is needed for this design.
- Declaration732–765 and constructor1477–1502: remove eleven flags and the
  independently broad repeated selection fields; construct one selection and
  preserve all other exact payload values. isEcosystem1472 still controls
  plugin-profile loading before allocation: replace its local use with direct
  resolved-family classification, preserving OR short-circuit with nextjs1474.
  The source-local `isRealAppKind` helper709 is removable only after its sole
  flag writer1495 is removed; `appKindIs`706 still serves other live helpers.
- TemplateRenderRequest creation1507–1511: hand over common payload plus a
  single template-facing classification literal/structured selection. Do not
  spread duplicated legacy flags back into the rendering context. Keep
  TemplateService's unrelated generic context contract120–135 and other callers.
- Handlebars environment188–197: add a local literal-equality helper, retaining
  existing casing helpers and HTML escaping. For external custom contexts this
  is an additive helper; only the package's own selection-aware templates use
  it. Derive one view classification from selection when necessary; do not
  register helpers named after each former Boolean.
- app-real-AGENTS.md.hbs7/10: match the existing nextjs/tauri app selections.
  app-vite-src-styles-globals.css.hbs1: match lab placement.
  tsconfig.json.hbs8 and tsconfig.test.json.hbs14: match ecosystem family.
  Preserve exact whitespace, commas, branches, helper escaping and rendered
  plugin JSON. The other seven flags have no template readers.
- The current CreatePackage barrel wildcard exposes TemplateContext; preserve
  that public name and relevant .Type/.make ergonomics for the new decoded
  shape. Migrate its source example rather than claiming the partial S.is
  candidate is valid. Package metadata exports source/dist command subpaths;
  do not add blocked/internal exports or claim external users were searched.
- create-package.test.ts and create-package-lab.test.ts: retain every real
  command constructor, default/family/kind/app/lab/stories/parent override,
  refusal, generated config/plugin/AGENTS/CSS assertion and retired-name test.
  General TemplateService tests retain arbitrary record contexts.

# Guard-deletion accounting

Delete the eleven TemplateContext Boolean writes and declarations. Replace the
five actual template conditions (one lab, two ecosystem, nextjs and tauri)
with selection matches. Remove the solely-used isRealAppKind projection; do
not delete shared appKindIs/type/family validators. The type one-hot projection
has no reader, so its concrete deletion is the three redundant writes/schema
fields, not invented downstream guards. The old type/app-kind/lab-ecosystem
designs must not each claim these same writes.

No CLI validation gate1188–1412, stories refusal, retired-name authorization,
workspace safety check, plugin-profile validation or filesystem error is
counted as a deletion. ScaffoldShape retains its separate11-state design and
reader ownership; shared template edits land atomically or are explicitly
sequenced to avoid duplicate guard credit.

# Encoded-side impact

There is no live persisted/JSON encode/decode of TemplateContext. It is an
exported in-process template input and has one live construction/record-spread
boundary, so Tier1 remains appropriate on current evidence. Public .make and
schema consumers are part of the decoded API migration; generic schema
acceptance alone does not require retaining contradictory operation states.
Unknown external consumers are not claimed absent.

Generated package files are real compatibility output: old/new context plus
shipped templates must produce identical bytes for all31 supported selections,
including plugin JSON, lab globals, app AGENTS, scope/paths/year/descriptions,
root-relative values and absent family/kind/app fields as seen by templates.
Preserve general template-service contexts, assets, symlinks, file order and
file-generation plan behavior. If an actual persisted context or supported
custom constructor is found before application, stop this Tier1 integration
and add its exact codec/constructor compatibility proof; do not silently discard
such evidence. No incoming codec is invented for a nonexistent live boundary.

# Test impact

Use the current explicit CLI fixture builders as the source of supported
selection cases. Add a focused31-row schema construction matrix and negative
cross-family/flag-reintroduction checks. Compare generated bytes for old/new
views using the existing Handlebars service, with nonempty and empty full
payload strings and the already supported plugin profiles. Preserve CLI
both-success and diagnostic tests, stories/lab gates, standard apps,
runtime-proof, no-family parent overrides and no-op/dry-run behavior.

No product commands or tests ran in this P2 task. Implementation must run
focused CreatePackage/TemplateService coverage and required package verification
after independent review. These obligations do not authorize service or
filesystem mutations during the source census.

# Risk

The main risk is incomplete cardinality from the old projections and accidental
changes to rendered whitespace or language-service plugin loading. The full
source-derived31-state grammar fixes the former; exact generated-byte fixtures
address the latter. Preserve temporal allocation after dry-run and all full
payloads. The superseded app-kind and lab/ecosystem rows and prior designs
are preserved by the integration archive, with the A-C correction receipt
bound separately. Obtain replacement P3 for this complete owner.

Local Effect v4 reference: Schema.ts6105 (`toTaggedUnion`),6255 (`TaggedUnion`).
If an actual encoded boundary emerges, Schema.ts5366–5382 uses `decodeTo` with
both SchemaGetter decode and encode functions; no v3 transform API is assumed.

Landing: use the ordered Tier 1E internal tooling subsystem batches, not singleton PRs per Tier 1 record. Coordinate the complete TemplateContext, separate ScaffoldShape and retired-name lifecycle designs in the CreatePackage subsystem; apply shared command/template edits serially and count each actual deletion once. Superseded app-kind/lab rows are not additional work items.
