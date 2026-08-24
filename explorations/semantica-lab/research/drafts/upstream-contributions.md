# Draft upstream contributions for Semantica

Nothing in this document has been posted or pushed.

## Dedupe status against the upstream tracker (2026-08-24 sweep, skeptic-verified)

Source: [`../upstream-tracker-mining.md`](../upstream-tracker-mining.md) and its
[review](../reviews/2026-08-24-tracker-mining-review.md). Verdicts and recommendations; Benjamin
decides.

| Draft | Verdict | Recommendation |
| --- | --- | --- |
| DELETE removes implicit graph-backed registry entries | PARTIAL (#518 specifies the DELETE route; the surviving-entries defect is unreported) | post as-is, cite #518 |
| persist registry + session graph across restarts | PARTIAL (#376 checkpoint persistence, #967/#1134 MCP `SEMANTICA_KG_PATH` never saves; Explorer path unreported) | post as-is, reference #376 and #1134 |
| key registry entries by source URL when no IRI | NOT-FOUND | post as-is |
| Doc issue 1: FAQ lists two latest versions | NOT-FOUND (#918 last bumped the FAQ answer to v0.6.5) | post as-is |
| Doc issue 2: modules page advertises runnable evals | PARTIAL (#228 placeholder; #1090 open replacement) | comment on #1090 instead of a standalone issue |
| Doc issue 3: three pages absent from docs.json | PARTIAL (#658 had wired the changelog tab; #899 adds storage-backends only) | rewrite as two never-wired pages + one navigation regression |
| New issue: OntologyValidator reports HermiT/Pellet consistency without running a reasoner | NOT-FOUND (unique D6 finding; #228 only lists it as an evals wishlist item) | post as-is; draft in [`upstream-issue-hermit-pellet.md`](./upstream-issue-hermit-pellet.md) (Codex-drafted 2026-08-24, seven file:line citations, spot-checked) |

## Local branch summary

- Branch: `upstream/explorer-registry-fixes`
- Base: `origin/main` at `6c2ccfd3afae2c12ba903c61c08a3c3b1970af45`
- Review checkout: `~/YeeBois/workstation-apps/semantica/.draft-worktrees/upstream-explorer-registry-fixes`
- Note: the branch lives in a local review clone; no remote was contacted.
- `c87ba6e5` `fix(explorer): make ontology DELETE remove implicit graph-backed registry entries`
- `27a0fd98` `feat(explorer): persist ontology registry and session graph across restarts`
- `18737666` `fix(explorer): key registry entries by source URL when the ontology declares no IRI`
- Duplicate pairs were confirmed by stable patch ID and included once each: `11f7965c`/`68b627de`, `edc7a34c`/`749da61a`, and `820d6695`/`06d37cb0`.
- Files changed: `semantica/explorer/app.py`, `semantica/explorer/routes/export_import.py`, `semantica/explorer/routes/ontology.py`, and `semantica/explorer/session.py`.
- Diff size: 154 insertions and 8 deletions.
- Conflicts: none. All three cherry-picks applied without manual edits.
- Checks: `git diff --check` passed. Python AST parsing passed for all four changed files.
- Targeted pytest: not run. `pytest` was unavailable on `PATH`; `uv run --frozen pytest -q tests/explorer/test_explorer_api.py` could not create a cache lock because the sandbox mounts `~/.cache/uv` read-only.

## Draft pull request

### Title

Persist Explorer ontology state and fix registry deletion and URL keys

### Description

#### Summary

This change fixes three related Ontology Hub state problems. Related tracker items (2026-08-24 sweep): #518 specified the registry (URI + source URL, remove action, `DELETE /api/ontology/{ontology_uri:path}`) that these fixes complete; #376 asked for graph checkpoint persistence; #967 and #1134 report `SEMANTICA_KG_PATH` never saving on the MCP surface. None of them reports the three defects below.

- Use the source URL as the registry key when a loaded ontology has no declared IRI, instead of allowing empty-string keys to overwrite one another.
- Persist the ontology registry to `SEMANTICA_REGISTRY_PATH`, restore it during app startup, and add `POST /api/session/save` to save the current graph to `SEMANTICA_KG_PATH` together with the registry sidecar.
- Let ontology DELETE resolve fragment and trailing-slash variants and remove implicit graph-backed entries with their associated nodes and edges.

The session save remains explicit. This change does not add automatic graph saves.

#### Files changed

- `semantica/explorer/app.py`
- `semantica/explorer/routes/export_import.py`
- `semantica/explorer/routes/ontology.py`
- `semantica/explorer/session.py`

#### Test plan

- `git diff --check` passes.
- All changed Python files parse successfully.
- The targeted Explorer pytest was not run in the preparation environment because pytest was unavailable and the package runner could not write its cache.

## Draft issue 1

### Title

FAQ lists two different latest Semantica versions

### Body

Found while evaluating Semantica.

The FAQ gives two different answers for the latest release:

- The Quick Answers table says `v0.6.6` at [`docs/faq.md:20`](https://github.com/semantica-agi/semantica/blob/main/docs/faq.md#L20).
- The "What's the latest version?" accordion says `v0.5.0` at [`docs/faq.md:73`](https://github.com/semantica-agi/semantica/blob/main/docs/faq.md#L73).

These statements appear on the same published page: <https://docs.getsemantica.ai/faq>.

Expected: both locations identify the same current release, or the page derives the version from one maintained source.

## Draft issue 2

### Title

Modules page shows runnable evals API although semantica.evals is a placeholder

### Body

Found while evaluating Semantica.

The Evals section in [`docs/modules.md:460-485`](https://github.com/semantica-agi/semantica/blob/main/docs/modules.md#L460-L485) presents imports and runnable examples for `KGEvaluator`, `ExtractionEvaluator`, `PipelineEvaluator`, and `RegressionTracker`.

The dedicated reference states that `semantica.evals` is not implemented, has `__all__ = []`, and exposes no importable classes or functions in [`docs/reference/evals.md:7-15`](https://github.com/semantica-agi/semantica/blob/main/docs/reference/evals.md#L7-L15).

The conflicting pages are published at:

- <https://docs.getsemantica.ai/modules>
- <https://docs.getsemantica.ai/reference/evals>

Expected: mark the Modules example as a planned API, or replace it with the documented `semantica.ontology.OntologyEvaluator` workaround until `semantica.evals` ships.

## Draft issue 3

### Title

Three existing documentation pages are absent from docs.json navigation

### Body

Found while evaluating Semantica.

The repository contains these documentation pages:

- [`docs/storage-backends.md`](https://github.com/semantica-agi/semantica/blob/main/docs/storage-backends.md)
- [`docs/migration/kg-provenance-tracker.md`](https://github.com/semantica-agi/semantica/blob/main/docs/migration/kg-provenance-tracker.md)
- [`docs/changelog.md`](https://github.com/semantica-agi/semantica/blob/main/docs/changelog.md)

None appears in the Mintlify navigation configured in [`docs/docs.json:52-264`](https://github.com/semantica-agi/semantica/blob/main/docs/docs.json#L52-L264). The Changelog tab links to GitHub Releases instead of the existing `docs/changelog.md` page.

The corresponding documentation routes are therefore never published through the configured navigation:

- <https://docs.getsemantica.ai/storage-backends>
- <https://docs.getsemantica.ai/migration/kg-provenance-tracker>
- <https://docs.getsemantica.ai/changelog>

Expected: add the three pages to appropriate navigation groups, or remove or redirect files that are not intended for publication.

## Comment draft for upstream PR #1090 (replaces standalone doc issue 2)

> While #1090 is open: `docs/modules.md` currently presents `semantica.evals` as a runnable API
> (`from semantica.evals import ...` with a metrics table), but `semantica/evals/` on `main` is
> still the placeholder that #228 recorded ("Coming Soon"). Until this PR lands, could the
> modules page either point at this PR as the pending implementation or mark the section as
> planned? Readers following the modules page today hit an import that does nothing. Happy to
> send a one-line docs patch if that is easier than folding it in here.

Status: draft-and-hold; post only after Benjamin's review (DECISIONS T-block, 2026-08-24).
