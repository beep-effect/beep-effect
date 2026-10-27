# Cache baseline review: the Effect-patched tsrs runs the typecheck and build gates (2026-10-26)

Reviewer: Claude Fable 5.1 (tsrs-gates, `feat/tsrs-gates`).

## What changed

- Root `package.json`, a `global.inputs` entry of `turbo.json`, changed: the
  catalog pins `@effect/tsgo` 0.59.0 and `tsrs` 0.20.0-ts7.1.0-beta replace
  `@effect/tsgo` 0.55.0 and `tsc-rs` 0.8.0, the root devDependency moves with
  the catalog, `prepare` adds `--tsrs` to `effect-tsgo unpatch` and `patch`, and
  `check:configs` runs `tsrs`. Every cached computation hashes that global input,
  so every task of every subject drifts (1621 tasks, 189 subjects, the root
  `//` included).
- Every workspace manifest's `beep:build`, `beep:check` and `beep:check:tests`
  (and the `beep:check:scripts`, `beep:check:stories`, `beep:check:examples`
  variants) and infra's `-b` build invoke `tsrs` instead of `tsc-rs`
  (`goals/tsrs-gates`, decision log 2026-10-26). The task graph is unchanged: the
  same task names run the same project files with the same inputs and outputs,
  `cache` flags and `turbo.json` declarations are untouched, and no dependency
  edge moved. Subjects whose review basis is their own manifest bytes
  (`@beep/ciops`, `@beep/infra`, `@beep/m365-mcp`) re-record against the
  rewritten manifests.

No qualification is granted or widened; the same tasks keep the same `cache`
flags, inputs, outputs and dependency edges. Only the compiler binary behind the
typecheck and build commands changed, and the root manifest bytes with it.

## Evidence

- `goals/tsrs-gates/research/measurements-2026-10-26.md`: the Effect-patched
  tsrs produces identical diagnostics to tsc-rs 0.8.0 on all 181 check projects
  and infra's `-b` build, and knows every rule of the standalone profile.
- `bun run beep lint package-scripts`: 189 manifests, 0 drifting.
- `@beep/repo-configs` `EffectTsgoEffectFnPolicy.test.ts` and the nine
  `@beep/repo-cli` tests that name the compiler pass on the patched binary.

## Main merge (2026-10-27)

Merging `origin/main` 8b1da02360 brought #2258, which adds `!**/dist/**` to the
root `//#effect-imports` task inputs and stamped its own review on the root
subject, and #2259 (test-only). The merge took main's baseline and re-applied
this review on top of it: the audit of the merged tree names the same 189
subjects and 1621 tasks as before, all from this branch's root-manifest and
compiler-word change. #2258's input change is already reviewed on main and is
carried, not re-qualified.

## Drifted tasks

| Subject | Tasks | Task names |
| --- | --- | --- |
| `//` | 28 | `config-sync:check`, `goals:index-check`, `jsdoc:inventory:check`, `jsdoc:ratchet:check`, `lint:allowlist`, `lint:circular`, `lint:ecosystem-polarity`, `lint:effect-imports`, `lint:effect-imports-markdown`, `lint:effect-vitest`, `lint:identity-registry`, `lint:jsdoc:root`, `lint:judge-rubric`, `lint:native-runtime:roots`, `lint:opaque-roundtrips`, `lint:package-scripts`, `lint:package-test-typecheck`, `lint:policy-fingerprint`, `lint:reflection-artifacts`, `lint:roadmap-refs`, `lint:schema-first`, `lint:tsconfig-overlay`, `lint:tsgo-rules`, `repo-sanity:changeset-graph`, `repo-sanity:sherif`, `repo-sanity:syncpack`, `repo-sanity:versions`, `topo-sort` |
| `@beep/acp` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/agents-client` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/agents-domain` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/agents-server` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/agents-tables` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/agents-use-cases` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/ai-provider-cli` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/ai-sync` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/anthropic` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/api-docs` | 6 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:laws`, `test` |
| `@beep/api-transport` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/architecture-lab-client` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/architecture-lab-config` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/architecture-lab-domain` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/architecture-lab-proof` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/architecture-lab-server` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/architecture-lab-tables` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/architecture-lab-ui` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/architecture-lab-use-cases` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/box` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/box-provisioning` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/brand` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/chalk` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/ciops` | 6 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:laws`, `test` |
| `@beep/cli-kit` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/codegen-kit` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/colors` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/commands` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/config-file` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/cosmos` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/data` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/db-admin` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/discord` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/doc-text` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/dock` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/dock-react` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/docket-intake` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/documents-domain` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/documents-server` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/documents-tables` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/documents-use-cases` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/drizzle` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/duckdb` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/ecfr` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/editor` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/effect-drizzle` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/epistemic-client` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/epistemic-config` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/epistemic-domain` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/epistemic-server` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/epistemic-tables` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/epistemic-ui` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/epistemic-use-cases` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/epistemics` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/exiftool` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/fc-runs` | 7 | `build`, `check`, `docgen`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/ffmpeg` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/file-processing` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/freshbooks` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/git` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/github` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/github-actions` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/github-commands` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/github-references` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/github-reporting` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/glob` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/gov-legal-mcp` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/govinfo` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/graph-3d` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/html` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/hubspot` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/identity` | 9 | `build`, `check`, `docgen`, `doctest`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/infra` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/jsonc` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/jsonl` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/langextract` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/law-practice-domain` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/law-practice-server` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/law-practice-tables` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/law-practice-use-cases` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/lejeune-bolt-workbench` | 6 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:laws`, `test` |
| `@beep/lexical-schema` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/libpff` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/lint-rules` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/lockfiles` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/m365` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/m365-mcp` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/managed-section` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/markdown` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/mcp-kit` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/mcpb-kit` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/md` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/memfs` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/n3` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/nlp` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/nlp-mcp` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/nlp-processing` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/npm-spec` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/obs` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/observability` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/occt` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/oip-web` | 8 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/onepassword-cli` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/ontology` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/ontology-client` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/ontology-config` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/ontology-domain` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/ontology-server` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/ontology-ui` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/ontology-use-cases` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/openai` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/openai-compat` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/openclaw` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/oxigraph` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/pacer` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/package-json` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/palantiri` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/pandoc-ast` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/pdf-tools` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/pglite` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/phoenix` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/poppler` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/postgres` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/practice-claude-mod` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/practice-gateway` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/practice-identify` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/practice-kg-mcp` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/practice-m365-contacts` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/practice-mail-tagging` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/practice-review-hub` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/practice-setup` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/pretext` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/professional-desktop` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/provenance` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/public-site` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/qa-capture` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/rdf` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/rdf-canonize` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/repo-ai-metrics` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/repo-cli` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/repo-configs` | 8 | `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/repo-docgen` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/repo-tsconfig` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/repo-utils` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/repo-workspaces` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/runpod` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/runtime-env` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/sanity` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/sbom` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/schema` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/schema-org` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/scratchpad` | 1 | `docgen` |
| `@beep/semantic-web` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/semantica` | 6 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:laws`, `test` |
| `@beep/semver` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/shacl` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/shared-domain` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/shared-tables` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/shared-use-cases` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/skill-contract` | 9 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/spdx` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/storybook` | 8 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `storybook:build`, `test` |
| `@beep/t3-code` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/tailscale` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/technical-drawing` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/tesseract` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/test-runner` | 7 | `build`, `check`, `docgen`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/test-utils` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/tika` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/todox` | 7 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/toml` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/trustgraph-workbench` | 6 | `build`, `check`, `lint`, `lint:deprecated-apis`, `lint:laws`, `test` |
| `@beep/tsconfig` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/types` | 8 | `build`, `check`, `docgen`, `doctest`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/ui` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/uspto` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/uspto-mcp` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/utils` | 10 | `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/walker` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/windows-secrets` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/wink` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/workspace-domain` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/workspace-server` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/workspace-tables` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/workspace-use-cases` | 9 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`, `test:property` |
| `@beep/xdg` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/xstate` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
| `@beep/yaml` | 8 | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` |
