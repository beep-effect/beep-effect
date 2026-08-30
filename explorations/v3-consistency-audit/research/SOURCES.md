# v3 Consistency Audit — Sources & Provenance

- **Cluster / origin:** operator brief (2026-08-29) + a multi-phase workflow
  over two local checkouts. No external web research; every source is a file on
  disk in one of the two repos.
- **Provenance:** [`../CAPTURE.md`](../CAPTURE.md) (the brief and the first
  scout numbers), [`../DECISIONS.md`](../DECISIONS.md) (build method),
  [`../synthesis/`](../synthesis/) (every artifact carries its own evidence
  tables with the command run and the count observed).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| `v3-iam` | v3 IAM slice (domain/tables/server/client/ui) | `effect-v3-main-archive` (local `~/YeeBois/projects/beep-effect4`, HEAD `997a827454`) | `packages/iam/**` | directory grammar, role suffixes, barrels, `$I` identity, kebab tables, per-operation client folders | reference — patterns only; no code ported |
| `v3-knowledge` | v3 Knowledge slice | same | `packages/knowledge/**` | entity-folder grammar, duplicated error homes, topical server modules, mirrored `test/` tree, `_shared` test helpers | reference — patterns only |
| `v3-archaeology` | Prior v3 surveys | this repo | `explorations/atlas-synthesis/synthesis/40-*.md`, `41-*.md`, `42-*.md` | what v3 built/proved; the "~1:1 test ratio" claim (by LOC) | reference; numbers re-measured here |
| `v4-doctrine` | Architecture standard | this repo (HEAD `3435c24f94`) | `standards/ARCHITECTURE.md`; `standards/architecture/{01,05,07,08,09,13}.md`, `DECISIONS.md`, `GLOSSARY.md` | slice spine, domain-kind folders, role vocabulary per tier, root files, subpath grammar, boundary arrows, enforcement lanes | binding; not modified by this packet |
| `v4-slices` | Actual slice packages | this repo | `packages/{agents,architecture-lab,documents,epistemic,law-practice,ontology,shared,workspace}/**` | conformance census | measured |
| `v4-cli` | Architecture command + gates | this repo | `packages/tooling/tool/cli/src/commands/{Architecture,Lint,Laws,Quality,Fallow,TsconfigSync,CreatePackage,Ci}/**`, `.fallowrc.jsonc`, `standards/fallow.boundaries.generated.jsonc`, `.github/workflows/*.yml` | what is mechanically checked today; where a topology auditor would hook | extend |
| `v4-proof` | Canonical slice factory | this repo | `goals/canonical-slice-factory/{README,SPEC,PLAN}.md`, `packages/architecture-lab/**` | the accepted proof the CLI replays; its divergence from doctrine vocabulary | extend |

**How these inform this packet:** v3 sources supply the *uniformity* patterns
and the counts proving how uniform they really were; v4 doctrine supplies the
*codified* half of each verdict; v4 slices and CLI supply the *drifted/missing*
half and the hook points for enforcement.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `effect-v3-main-archive` (beep-effect v3, same author) | same ownership as this repo | reference-only in this packet (no code moves) | naming/organization patterns only |

## 3. External research sources

None. No URLs are cited in this packet; all claims are carried by the on-disk
evidence tables in `synthesis/10`–`15` and `20`–`25`.

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| `beep architecture` operation-plan core (`ArchitectureSliceRole`, `ArchitecturePlanStage`, `ArchitectureDomainKind`, `CanonicalSliceOperationPlan`, `check`) | `packages/tooling/tool/cli/src/commands/Architecture/` | extend (audit over existing packages) |
| `AcceptedProofManifest` + `TemplateRetarget` (proof → concept rename) | `.../Architecture/internal/` | extend (vocabulary must be fixed here first) |
| `beep lint schema-topology` walker (`@beep/schema`-only topology lint) | `.../Lint/SchemaTopology.ts` | reuse as walker pattern |
| `beep lint identity-registry` | `.../Lint/IdentityRegistry.ts` | reuse (identity `$I` convention already gated) |
| `beep lint package-test-imports` | `.../Lint/PackageTestImports.ts` | reuse (test alias rule) |
| Fallow boundary zones (generated from workspace deps) | `.fallowrc.jsonc`, `standards/fallow.boundaries.generated.jsonc`, `.../Fallow/` | reuse / extend for direction rules |
| coverage ratchet (baseline + regression gate) | `beep ci lane` coverage lanes | pattern to copy for a test-collocation ratchet |
| `LiteralKit` (`@beep/schema`) | `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts` | reuse — closed suffix vocabularies |

## 5. Cross-links & provenance

- Exploration siblings: [`../../atlas-synthesis/`](../../atlas-synthesis/README.md)
  (`40`–`43` v3 prior art), [`../../packet-system-redesign/`](../../packet-system-redesign/README.md).
- Goal packets touching the same surface: `goals/canonical-slice-factory`
  (completed-retained; the proof this audit measures against),
  `goals/beep-schema-topology` (the only existing topology lint, `@beep/schema`
  scope), `goals/per-module-imports` (import-shape lint tooling landscape),
  `goals/fallow-quality-enforcement` / `goals/fallow-advisory-ratchets`
  (advisory → ratchet rollout pattern).
- This packet: [`../README.md`](../README.md), [`../RESEARCH.md`](../RESEARCH.md)
  (index), [`../DECISIONS.md`](../DECISIONS.md), [`../synthesis/`](../synthesis/).
