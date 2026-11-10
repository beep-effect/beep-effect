# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

Evidence for every 2026-11-10 entry:
[`research/experiments/2026-11-10-reverification-and-check-sweep.md`](./research/experiments/2026-11-10-reverification-and-check-sweep.md)
(Experiment 3) and [`RESEARCH.md`](./RESEARCH.md).

## 2026-11-10 — Q1 bundler for library builds

**Question:** Should library packages build through a bundler (the operator
leaned `bun build`), or keep compiler emit?

**Answer:** No bundler for library builds. The Effect-patched `tsrs` stays the
emitter. `bun build --compile` stays only in the binary lanes that already use
it (kg-mcp, desktop sidecar, the `beep ci` binary).

**Rationale:** Recommended and accepted by the operator. `bun build` emits no
`.d.ts` and has no per-module output, and the only artifact anything reads from
`dist` is the declaration. Experiment 2 found no bundler faster than plain emit
on `@beep/schema`; tsdown was about 2x slower and skipped type-checking.
Rejected: keeping `bun build` open with a dated re-test (nothing in Bun's
tracker points at declaration emit). Re-entry: Bun ships declaration emit and
per-module output, or the repo adopts `isolatedDeclarations`.

## 2026-11-10 — Q2 publishable tier and tsdown

**Question:** Is tsdown worth adopting for a publishable tier of packages?

**Answer:** No tier and no tsdown lane now. The packet's predicate
(`publishConfig.access: "public"`) is withdrawn.

**Rationale:** Agent call from doctrine, not an operator answer.
`standards/architecture/14-ecosystem-packages.md` ("Release Lane") calls that
field a dormant template setting, "not a publication promise". 172 of 210
workspace manifests carry it and none has `private: false`, so the predicate
selects most of the repo and no package that publishes. `drizzle-orm` is still
a release candidate, so the first ecosystem member's activation condition is
unmet. Re-entry: Release Lane activation for an ecosystem member, which the
standard already defines as a deliberate release-policy change. A publish lane
(manifest projection, attw/publint, pure annotations in the shipped output) is
designed then, for that member. Reversal: reopen this packet at `decompose`.

## 2026-11-10 — Q3 shared build-kit package

**Question:** Should a new `packages/tooling/library/build-kit` own the
generated `beep:build` script, the artifact assertion and the tsbuildinfo purge?

**Answer:** No new package. Changes go through the existing generated-scripts
policy in `@beep/repo-cli-kit` (`PackageScripts.schemas.ts`) and its Turbo
task-contract test.

**Rationale:** Agent call. The report's main reason for the package was the
stale-tsbuildinfo incident. #1874 (2026-10-18) fixed that with a one-line
emit-layout change and a contract test asserting that a dist-only clean
re-emits every file. What is left (a manifest projection for publishing) has no
customer per Q2. A `BuildPlan` schema and service to run one compiler command
is more structure than the work needs. Reversal: `bun run beep create-package`
when a publish lane exists to own.

## 2026-11-10 — Q4 Babel pure-annotation pass

**Question:** Keep `babel dist --plugins annotate-pure-calls` in 169 package
builds, keep it for some, or remove it?

**Answer:** Remove it from the generated build script repo-wide, together with
the `babel` script key, once a full-gate run proves nothing reads `dist/*.js`.

**Rationale:** Recommended and accepted by the operator. The markers go into
files nothing bundles: apps, tests and the binaries resolve `exports` to `src`,
and the effect-drizzle bundle probe aliases to `src` and relies on 92 markers
hand-written in source. On `@beep/schema` the pass now costs more than the
compile (0.64 s against 0.27 s best of six). Rejected: keeping it for
`packages/ecosystem/*` only (the standard asks for "pure annotations where a
bundler needs help", which that package meets in source) and keeping it
everywhere to mirror Effect's recipe (Effect publishes; this repo does not).
The pass returns inside a publish lane at Release Lane activation (Q2).
Reversal: restore the script value in the policy and run
`bun run beep lint package-scripts --write`.

## 2026-11-10 — Q5 SchemaCompiler

**Question:** The operator believed the report understated SchemaCompiler's
bundle-size and runtime wins. Does it change this packet?

**Answer:** No. Closed here and handed back to the `effect-schema-parity` DEFER
ruling of 2026-09-28 and its three re-entry triggers.

**Rationale:** Recommended and accepted by the operator; no new mechanism or
numbers were offered. On record: AOT adds about 2 KB because the interpreter
and AST stay in the bundle; the repo spike measured 3.7x on transformation-free
wire structs and 1.2x to 1.5x on `S.Class` rows. Effect 4.1.2 still excludes
`Declaration` and `Suspend` from code generation and the API is still
`@stability unstable`, so triggers two and three have not fired. The cases
where it pays are wire-shape decode at volume and production CSP, where AOT is
the only compiled path. Rejected: a JIT spike on one server entry as a goal
from this packet (it belongs to the ruling's own re-entry experiment).

## 2026-11-10 — Q6 app-side aims

**Question:** Runtime speed and bundle size turned out to be properties of the
apps, not of the library build. Where does that work go?

**Answer:** One bullet in `explorations/INBOX.md` for a separate app bundle and
start-up measurement exploration. This packet stays about the library build.

**Rationale:** Recommended and accepted by the operator. Nothing in this packet
measured an app bundle or a compiled CLI's start-up, so there is no evidence
here to shape that work from. Rejected: a measurement phase inside this
packet's goal (different owners and gates), and dropping the aims.

## 2026-11-10 — Q7 emit shape after Babel

**Question:** Once Babel is gone, what should a library build produce and what
should `check` depend on?

**Answer:** Keep project references. The build emits declarations only (no
JavaScript, no JavaScript maps). If a proof shows identical diagnostics, a
package's own source check is served by its build, so `src` is type-checked
once per package instead of twice.

**Rationale:** Recommended and accepted by the operator. 197 of 199
`tsconfig.check.json` files differ from the build config only in emit options,
so `beep:check` re-runs the type-check `beep:build` already did. Rejected:

- Source-resolved checking with no `dist`. It was measured: 187 of 199 projects
  pass, at 2.3x wall and 1.46x memory per project (87.4 s against 31.9 s
  serial, peak 4.0 GB against 2.5 GB), and one consumer failed inside a
  dependency's source because that source was checked under the consumer's
  compiler options. The cost lands on the per-package check every lane runs
  most, and #1874 already removed the incident that motivated it. Re-entry: the
  per-project ratio falls under about 1.3x, or stale-`dist` failures recur.
- Declarations only with `check` left separate (keeps the double type-check).
- Stopping at Babel (keeps emitting about 1 MB of JavaScript and maps per large
  package into the Turbo cache for no reader).

The "check once" half is conditional. If the proof finds any diagnostic
difference between the two passes, incremental state included, it is dropped
and the goal ships declarations only. Reversal for either half: restore the
policy values and regenerate scripts.

## 2026-11-10 — Q8 appetite

**Question:** How much is this worth?

**Answer:** Small. One goal, three PRs, about a week of lane time: the proof and
measurement, the Babel removal, then the emit change. Anything that does not
fit is cut, not extended.

**Rationale:** Recommended and accepted by the operator. Every step is a
generated-script policy edit plus regeneration, reversible the same way.
Rejected: one PR for Babel only with the emit shape deferred, and parking.

## 2026-11-10 — Q9 stale findings ride the first PR

**Question:** Three small defects surfaced during research never landed. Where
do they go?

**Answer:** Into the goal's first PR: the stale `Bun.build 1.3.14` comment in
`packages/ecosystem/effect-drizzle/test/bundle-build.ts` (retired by Experiment
1), the probe's floor-only size check (add presence and import-validity
assertions; Experiment 1 showed a 98-byte invalid stub passes a floor), and the
pre-#1874 `**/node_modules/.tmp/*.tsbuildinfo` glob in `turbo.json`
`build.outputs` if no package still writes there.

**Rationale:** Agent call under the fix-where-found rule. Each is a few lines
in files the first PR already has reason to read. Reversal: revert the PR.
