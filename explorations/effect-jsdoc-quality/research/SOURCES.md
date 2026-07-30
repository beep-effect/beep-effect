# Effect-level JSDoc quality — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft upstream is CLEAN-ROOM reimplement only;
  permissive (MIT/Apache/BSD) may be ported WITH attribution.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** kickoff brief + three WebStorm hover screenshots
  (2026-07-30, referenced in `CAPTURE.md`); mining executed the same day by
  three explorer passes plus a five-agent gap-fill workflow; every line-cite
  below re-verified by a dedicated claim-verification pass.
- **Provenance:** all evidence is on-disk in this repo (`.repos/effect`
  subtree + beep sources); no external secondary sources were used.

## 1. Mined source corpus

All paths relative to `.repos/effect/` unless noted.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `grammar-tag-order` | Tag order map | Effect-TS/effect | `packages/tools/jsdocs/src/Jsdocs.ts:425-431` | deprecated→default→see→category→since | port (semantics) |
| `grammar-headings` | `standardHeadings` | Effect-TS/effect | `packages/tools/jsdocs/src/Jsdocs.ts:1020` | **When to use** / **Details** / **Gotchas** | port (semantics) |
| `grammar-prefixes` | `whenToUsePrefixes` | Effect-TS/effect | `packages/tools/jsdocs/src/Jsdocs.ts:1024` | "Use to/when/as/with" openers | port (semantics) |
| `grammar-allowed-tags` | Per-scope tag whitelist | Effect-TS/effect | `packages/tools/jsdocs/src/Jsdocs.ts:1395-1402` | 5-tag universe, scoped subsets | port (semantics) |
| `grammar-example-ban` | `forbidden-tag` for `@example` | Effect-TS/effect | `packages/tools/jsdocs/src/Jsdocs.ts:1411-1413` | sections replace the tag | reference (grill decision) |
| `grammar-since` | Stable-semver `@since` | Effect-TS/effect | `packages/tools/jsdocs/src/Jsdocs.ts:435,1460-1461` | real version history | reference (conflicts with our 0.0.0 policy) |
| `grammar-links` | `{@link}` resolution via compiler | Effect-TS/effect | `packages/tools/jsdocs/src/Jsdocs.ts:1524-1545` | links must resolve to documented symbols | port (semantics) |
| `bin-check-gate` | Diagnostics fail only under `--check` | Effect-TS/effect | `packages/tools/jsdocs/src/bin.ts:13,32-34` | toothless CI wiring | reference (anti-pattern) |
| `jsdocs-config` | Validator config | Effect-TS/effect | `jsdocs.config.json:1-16` | include/exclude + `.data/jsdocs.json` cache | reference |
| `docs-scripts` | Doc scripts | Effect-TS/effect | `package.json:23-27` | jsdocs-inside-lint, docgen, ai-docgen | reference |
| `ci-lanes` | Lint / Docgen / AI-docgen lanes | Effect-TS/effect | `.github/workflows/check.yml:16-26,149-160,162-180` | AI lane fails on dirty tree | reference |
| `dead-example-compile` | Idle `examplesCompilerOptions` | Effect-TS/effect | `packages/effect/docgen.json:5-8`; `packages/tools/docgen/src/Parser.ts:105` | v4 lost example typechecking | reference (do not copy) |
| `style-option` | `Option` type / `none` / `some` JSDoc | Effect-TS/effect | `packages/effect/src/Option.ts:38-54,229-260,262-293` | showcase hover style (screenshots) | port-with-attribution (prose patterns) |
| `style-taggedunion` | `Schema.TaggedUnion` JSDoc | Effect-TS/effect | `packages/effect/src/Schema.ts:6328-6354` | dense summary + titled example | port-with-attribution (prose patterns) |
| `adoption-sample` | Section/tag frequency, 6 modules | Effect-TS/effect | `packages/effect/src/{Option,Effect,Schema,Layer,Stream,Cause}.ts` | uneven adoption; Schema=14% examples | evidence |
| `ai-docs` | Typechecked LLM doc corpus | Effect-TS/effect | `ai-docs/`, `LLMS.md`, `tsconfig.packages.json:6` | committed generated artifact + dirty-tree gate | reference (future goal) |

**How these inform this packet:** the `grammar-*` rows are the portable spec —
they become candidate `jsdoc-inventory` rules and pattern-doc law; the
`style-*` rows calibrate the prose rubric; `bin-check-gate` +
`dead-example-compile` are the two upstream regressions we explicitly refuse
to import; `adoption-sample` justifies ratchet-on-touch over retroactive
migration.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect-TS/effect (vendored subtree at `.repos/effect`) | MIT | port-with-attribution | Grammar semantics (headings, prefixes, tag order, link resolution), prose/section patterns, example idioms (ASCII type arrows, `// Output:` comments). We do NOT depend on `@effect/jsdocs` (private package) — semantics are re-implemented in our inventory. |

## 3. External research sources

No external URLs were consulted; all claims trace to on-disk sources. The
only URL in the packet is the upstream repo home,
<https://github.com/Effect-TS/effect> (also cited in `CAPTURE.md`). The three
reference screenshots are local-only paths recorded in `CAPTURE.md`
(deliberately not committed — public repo).

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/repo-docgen` (pre-v4 `@effect/docgen` port; compiles `@example` via `tsc --noEmit`) | `packages/tooling/tool/docgen/` (`Parser.ts:163`, `Core.ts:268-271,450-456`, `Configuration.ts:99-126`) | extend (optionally harvest `**Example**` fences; `runExamples` exists, default false) |
| JSDoc inventory + 12 mechanical rules | `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:272-478` | extend (new grammar rule codes) |
| Fail-on-growth ratchet + required CI lane | `standards/jsdoc-totals.regression-baseline.jsonc:12-19`; `.github/workflows/check.yml:499-528` ("JSDoc Ratchet" is a required check) | reuse (new codes ride the same baseline) |
| Example-quality scorer `deterministic-rubric-v1` (15 finding codes, advisory-only) | `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.schemas.ts:177-192`, `Quality.rubric.ts:340-352` | extend / wire to CI (Option D) |
| Canonical category vocabulary (80 slugs, LiteralKit) + alias/reject normalization | `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts:31-126,202-263` | reuse (note: 39 non-canonical values live in source today — see RESEARCH.md) |
| Custom tag definitions (15 tags incl. `@effects`, `@precondition`) | `tsdoc.json:3-30` | extend / cleanup (`@module`/`@template` registered but banned by law) |
| JSDoc law | `.patterns/jsdoc-documentation.md` (tag order :55-82, `@remarks` :183-186, copy-paste bug :848) | rewrite (the goal's main convention surface) |
| Annotation skill | `.agents/skills/jsdoc-annotation-specialist/` (3 stale Source Reference paths noted in CAPTURE.md) | rewrite |
| LLM worker eval (advisory scoring; verdicts + reusable packet contract) | `goals/jsdoc-worker-eval/SPEC.md:16-123,286-311` | reference (Option D input; write-mode explicitly non-goal) |
| JSDoc tag exhaustiveness audit (tag database + `ASTDerivability`, SyntaxKind maps, category taxonomy) | `goals/repo-codegraph-jsdoc/history/outputs/jsdoc-exhaustiveness-audit/*.ts` | reference (port to LiteralKit forms if used; files are untypechecked prior art) |
| Ratchet mechanism precedent | `goals/quality-gate-ratchets/` | reference |
| In-repo titled-example precedent (bold `**Example**` headings) | `packages/law-practice/domain/src/values/{DurableLocator,NeutralCitation,StatutesAtLargeCitation}/*.ts` | evidence (the convention already grew locally) |
| Hover-fidelity lab (WebStorm eyeball probe) | `scratchpad/jsdoc-hover-lab.ts` (uncommitted scratch) | evidence (RQ4) |

NOT FOUND (net-new if chosen at grill): any section-grammar validation rule
(no "When to use" anywhere in `.patterns/jsdoc-documentation.md` — verified);
any `{@link}`-resolution check; any described-`@see` convention.

## 5. Cross-links & provenance

- This packet: `RESEARCH.md` (synthesis), `research/effect-doc-pipeline.md`,
  `research/diff-effect-vs-beep.md`, `research/quality-rubric.md`,
  `research/options.md`, `DECISIONS.md` (pending grill).
- Exploration ↔ goal links: none yet — graduation happens only after
  `/grill-with-docs` (see `ops/manifest.json` `links.goals`).
- Sibling prior art: `goals/jsdoc-worker-eval`, `goals/repo-codegraph-jsdoc`,
  `goals/quality-gate-ratchets`; killed packet `effect-capability-kg` (ATLAS
  history — resume-as-fresh precedent).
