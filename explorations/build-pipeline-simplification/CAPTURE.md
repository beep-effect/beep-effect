# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-09

Operator (verbatim, from the session that opened this packet):

> For a while now I've been thinking about bundlers & simplifying our package.json build scripts, improving speed & performance both for runtime, build & bundle size. In addition for packages that export schema's I've been wanting to make more use of effect's SchemaCompiler for those goals.
>
> I like many aspects of the [effected, okfit, pluginfinity, ai-plugin-marketplace-manager, tsdoctor, vitest-agent] repos, all by Spencer Beggs's. I find his repositories very clean & well organized I wonder what reason he uses bundlers on his repositories vs doing something more like what effect does & what we do.
>
> I want to know if we were to start using a bundler what would be the best choice for my goals.
>
> I lean towards based on my current understanding of the ecosystem, bun build but I'm not 100%

Candidate list the operator had in mind: tsc, tsgo, swc, esbuild, vite, rspack, Turbopack, Rsbuild, Rslib, rolldown, tsdown, farm, Mako, oxc, swc4j, webpack, rollup, parcel, tsup (unmaintained → tsdown), babel, sucrase, ezno, stc.

Deep-research run the same day (six research threads + synthesis), filed under
[`research/deep-research/`](./research/deep-research/):

- [`REPORT.md`](./research/deep-research/REPORT.md) — "Keep tsgo emitting; bundle only what ships".
- `spencer_bundler_rationale.md` — what `@savvy-web/bundler` 2.4.24 actually is (tsdown/rolldown + rolldown-plugin-dts + API Extractor), the manifest projection, why he bundles.
- `beep_effect_current_pipeline.md` — 161 manifests, `tsc -p && babel annotate-pure-calls`, `dist/*.js` has no runtime consumer, only `.d.ts` is load-bearing; timings.
- `bun_build_library_bundler.md` — Bun 1.4.2 probe: no `.d.ts`, no preserveModules, silent unknown flags, `check` unreleased, barrel/sideEffects bug #18008.
- `rust_library_bundlers_compared.md` — tsdown 0.23 / rolldown 1.2 / Rslib 1.0 / esbuild 0.28 / TypeScript 7.0.
- `effect_schema_compiler.md` — SchemaCompiler registry, JIT vs AOT, emitted module shape, unsupported nodes, the 2026-09-28 DEFER ruling.
- `bundle_vs_emit_effect_libraries.md` — Effect team practice, dual-instance hazard, pure annotations, Turborepo JIT vs compiled.

Headline from the report: the library build is a declaration pipeline. `bun build`
fails the hard constraint (no `.d.ts`). tsdown buys publishing hygiene, not speed.
Proposed two-tier shape: effect-tsgo emit for every private package behind one
generated `beep:build` owned by a shared build-kit; tsdown `unbundle` + `exports`
+ attw/publint only for `publishConfig.access: "public"` packages; Babel pure
annotations conditional on publishability; `bun build --compile --bytecode` stays
in the CLI release lane. SchemaCompiler must not drive the bundler choice.

Borrow from Spencer: manifest projection from a `private: true` source, the
two-catalog peer discipline (`catalog:effect` dev / `catalog:effect:peers`),
`issues.json` as an agent-readable gate, auto-externalising declared deps.
Don't borrow: rolled-up `.d.ts`, API Extractor, stripped maps/source, `tsc` over `tsgo`.

Pending experiments named by the report (not yet run):

1. Re-run the Bun tree-shaking probe (the effect-drizzle re-export graph stub) on Bun 1.4.2.
2. Time `@beep/schema` three ways on a quiet machine: effect-tsgo emit, tsdown `unbundle` + dts, `bun build` + `tsc --emitDeclarationOnly`.

Conflict noted in the notes: one note calls Spencer's tool `@savvy-web/bun-builder`;
the installed-source audit shows `@savvy-web/bundler` is tsdown-based. Installed
source treated as authoritative.

## 2026-10-09 (later, same session)

Operator pushback on the report's SchemaCompiler paragraph ("must not drive the
bundler choice; 1.2x–1.5x on real @beep shapes; any sideEffects-honouring
pipeline can host it later"):

> I feel like this misses bundle size benefits & runtime performance according to what I know.

Evidence on file that the pushback has to be reconciled with (see
`research/deep-research/effect_schema_compiler.md`): the compiler is a registry
beside the interpreter (AST identity keys, per-node fallback), so AST +
interpreter stay in the bundle; PR #7908 measured AOT at about +2 KB and JIT at
about +7 KB min+gz over an 18 KB baseline; the 2026-09-28 repo spike measured
3.7x on transformation-free wire structs, 1.2x–1.5x on `S.Class` rows, none on
recursive graphs. Open: does the operator know of a mode that drops the
interpreter/AST, or newer numbers? Carry into align.
