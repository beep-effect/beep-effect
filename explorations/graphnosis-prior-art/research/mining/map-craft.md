# Mapping — Graphnosis craft findings onto beep-effect

Territory: product scope discipline, docs craft & positioning.
Repo mapped: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean).
Source survey: `scratchpad/graphnosis/survey-craft.md`. Source repo: `/home/elpresidank/YeeBois/dev/Graphnosis`.

## Standing shape of the target repo (verified, not assumed)

- 125 package manifests under `packages/**`; **every one is `"private": true`**
  (`rg -n '"private"' --glob 'packages/**/package.json' -N | awk -F: '{print $NF}' | sort | uniq -c` → `1 true` + `126 true,`).
  `package.json:421` `"release": "bun run build && bun run test && bun run lint && bun run audit:full && changeset publish"`.
  There is therefore **no npm tarball a consumer installs** today; the shipped artifacts are the Tauri
  desktop bundle (`.github/workflows/release-desktop.yml`) and the planned `.mcpb` bundle for
  `apps/practice-kg-mcp`.
- Root docs: `README.md` (269 lines), `AGENTS.md` (121), `docs/ROADMAP.md` (194),
  `THIRD_PARTY_NOTICES.md` (97), `docs/README.md` (22).
- Workflows: `check.yml`, `release.yml`, `release-desktop.yml`, `storybook.yml`,
  `property-laws-nightly.yml`, `data-sync.yml`.
- 316 pending changesets in `.changeset/`.
- Packet pipelines: 50 `explorations/`, 130 `goals/`.

---

## gcr-01 — README leads with a ten-second demo, hands the claim to a picture

**Searches run**

```
rg -n -i 'see it in|ten seconds|quickstart|quick start|try it now|no install|zero install|one command demo' README.md docs/*.md AGENTS.md CLAUDE.md   # 0 hits
rg -n '"(dev|start|demo|proof|architecture:proof|lab)[^"]*":' package.json                                   # only "dev": "bunx turbo run dev"
```

**What exists.** `README.md:1-18` opens with two badges then **Mission / North Star / Core Bet** prose.
The first executable thing is `README.md:~172-186` ("Key Commands"): `bun run beep architecture`,
`bun run beep create-package ... --dry-run`, `bun run docgen:local`, `bun run beep yeet verify`. There
IS a picture surface — `docs/PROSE_TO_PROOF_VISUALIZATION.html`, `docs/PROSE_TO_PROOF_GRAPH.html`,
`docs/PROSE_TO_PROOF_CHAT.html`, `apps/storybook`, `goals/graph-3d-view` — and an executable proof
harness `apps/architecture-lab-proof` (README cites it at :74-76). None of them is the README's
opening move, none is offered as "run this and look", and `apps/architecture-lab-proof/package.json`
has no `demo`/`start` script (only `beep:audit`, `beep:build`, `beep:check`, `beep:test`).

**Verdict:** `partial`. The bricks (an executable proof harness, three rendered HTML pictures, a
generator CLI) exist but the README does not lead with any of them, and there is no zero-prerequisite
first line. Note the finding's triple does NOT transfer wholesale — beep-effect has no `npx` surface
and no "point it at your own files" story; the transferable half is "first content is executable, and
the claim prose is bad at is explicitly handed to the picture."

---

## gcr-02 — ROADMAP as triage: enumerated in-scope, complement out-of-scope, stated default

**What exists — placement triage is already strong.**

- `standards/architecture/02-shared-kernel.md:8-30` `## What Belongs In Shared` (enumerated),
  `:32-52` `## What Does Not Belong In Shared` (11 bullets), `:53` "If a concept belongs to `iam`,
  keep it in `iam`."
- Promotion records carry **"Rejected homes"** (`standards/architecture/02-shared-kernel.md:106,190`;
  `standards/ARCHITECTURE.md:372`; the README reproduces one at `README.md:~130-137`).
- Placement decision rules: `standards/architecture/03-driver-boundaries.md:36,98,100`;
  `07-non-slice-families.md:158,160`.
- Admission control: `docs/ROADMAP.md:176-184` "**Shape freely, graduate only into a lane slot.**"
  and `explorations/README.md:139-141` "Graduation Contract — an exploration may graduate only when
  all four hold".

**What is missing.** `docs/ROADMAP.md:12-27` declares itself "the **only cross-portfolio priority
layer**" — priority, lanes, horizons, resume conditions — explicitly **not** a scope/triage
instrument. There is no enumerated in-scope capability/API surface, no stated default answer for a
borderline request, and no three-question proposal template that puts the scope argument on the
applicant.

**Verdict:** `partial`. beep-effect answers "where does it go", Graphnosis answers "should it be here
at all, and who has to argue". The cheap steal is the burden-shifting question 3 and the softened
restatement.

---

## gcr-03 — one engine implementation on purpose, justified by determinism

**What exists.**

- "Process boundary, not a rewrite" is already the product thesis:
  `docs/ROADMAP.md:64-66` — "The MCP surface is thesis, not shim: Claude Desktop is client #1;
  Word/Outlook/cron/background agents are the same consumer."
- Binding determinism rules for the shipped bundle:
  `goals/practice-kg-mcp/research/bundle-contract.md` §5 — "every INSERT batch ordered by full natural
  key; no wall-clock values in any row (build time lives only in `kg_build` / manifest); IRIs from
  natural keys only; email parse order = `(archive_digest, folder_path, message_ord)`".
- Byte-for-byte proof oracle: `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`
  (+ `apps/architecture-lab-proof`); canonical RDF via `packages/drivers/rdf-canonize`.

**What is missing.** `rg -n -i 'determinis' standards/ARCHITECTURE.md standards/architecture/*.md AGENTS.md`
→ 1 hit only (`08-testing.md:188`, "deterministic clock"). There is no repo-level doctrine paragraph
deriving a refusal (or a permission) from determinism, and no named divergence mechanisms.

**Verdict:** `already-have` in substance, at a lower altitude. Value to beep is low.

---

## gcr-04 — a badge that reads "re-measuring", plus recomputable per-question evidence

**What exists — the evidence layer is real.**

- Committed ratchet baselines: `standards/coverage.regression-baseline.jsonc`,
  `standards/jsdoc-totals.regression-baseline.jsonc`, `standards/knip.regression-baseline.jsonc`,
  `standards/fallow.{dead-code,health}.regression-baseline.jsonc` (`goals/quality-gate-ratchets`, 5/5).
- Schema-validated judge inventories (`qa-inventory/v1`, `CLAUDE.md` Browser QA law) and
  `packages/tooling/tool/cli/src/commands/Qa/JudgeIngest.ts:122`.
- Claim-level verification with verdicts: `goals/graph-3d-view/research/VERIFICATION.md:15,16,34,36`
  — CONFIRMED / CONTRADICTED per claim with file:line evidence, and `:61`,`:80` **quarantine** two
  corpus indexes as unsafe claim evidence.
- Adversarial enforcement of the same norm: `goals/graph-3d-view/research/DESIGN-REVIEW.md:9` —
  "commit a durable benchmark source plus raw run output ... Re-run all configurations from immutable
  inputs; do not report the absent 12,500-edge run".
- Null results kept rather than deleted: `goals/box-typecheck-cost/ops/manifest.json:167,173`
  ("NOT BUILT - P2 met budget, so this lever was never fired"), `PLAN.md:58`, `README.md:78`.

**What is missing.** No norm that a measurement is *withdrawn* when the code under it moves. Measured
claims in packet READMEs and changesets carry no "measured at commit X" stamp and no expiry, and no
script recomputes a published figure and exits non-zero on disagreement. Related live hazard already
in memory: `coverage-ratchet-penalizes-deletion`, `instantiation-budgets-need-a-floor`.

Also a live instance of the exact defect Graphnosis withdrew a figure for (a citation the reader
cannot reach): 42 machine-local absolute paths in tracked public docs, **12 of them dead**, e.g.
`standards/effect-first-development.md:443` → `/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/SCHEMA.md`
(wrong checkout; `ls` → No such file or directory).

**Verdict:** `partial`.

---

## gcr-05 — changelog entries price each change in measured numbers

**What exists.** The habit is present in the best changesets:

- `.changeset/leaf-boundaries-instantiation.md` — "−21.8% for the module ... −86.8%, 15.2M → 2.0M
  instantiations; peak RSS 5.1GB → 0.85GB".
- `.changeset/box-demand-scoped-surface.md` — "~4.8M ... → ~2.5M instantiations (-66.5%), and the
  generated file drops from 88,709 to 9,822 lines with its own contribution down 89%", plus the
  blast-radius sentence ("A manager outside the manifest has no generated operations, so calling it
  is a compile error rather than a runtime failure").
- `.changeset/box-error-json-context.md` — mechanism + consumer-visible consequence, no numbers.

**What is missing.**

```
total=316   with-numbers=4      # grep -l -E '[0-9]+(\.[0-9]+)?%|[0-9,]+ ?→ ?[0-9,]+|[0-9]+/[0-9]+' .changeset/*.md
bodies <=15 words = 85 of 316
git log -300 --format='%b' | grep -ci '^cost:'                     -> 0
git log -300 --format='%b' | grep -ci 'does not change|behavior unchanged'  -> 1
```

`bun run beep quality changeset-graph` validates the changeset **package graph**
(`packages/tooling/tool/cli/src/commands/Quality/ChangesetGraph.ts`), never the prose. No law in
`AGENTS.md` requires a priced entry. The "what this costs" move is absent from the corpus entirely.

**Verdict:** `partial`.

---

## gcr-06 — "Errata (added after release)" amending a shipped entry

**What exists — and beep-effect's version is better reasoned.**

- `explorations/academia-corpus-mining/README.md:35` — "**ERRATA WARNING (2026-07-25):** its code
  snippets are NOT safe to copy — 36 of 56 TypeScript fences carry verified defects ... the file
  itself stays byte-identical because the audit and the prior-72 reconstruction cite its exact line
  numbers."
- `explorations/academia-corpus-mining/DECISIONS.md:142-149` — "**Errata placement deviation:** the
  audit recommends an in-file dated banner ... Deviated deliberately: BOTH the audit's 13 findings and
  the prior-72 reconstruction cite exact line numbers into the byte-identical file, so any
  top-of-file insertion would shift every reference. Errata banners live at the entry points instead."
- Same errata replicated at the other entry point: `research/SOURCES.md:72`, `RESEARCH.md:37`.
- Sibling pattern: `goals/ontology-interop-roadmap/README.md:22-30` "Authoring-surface caveat: ...
  read them as dead prior art".
- `standards/architecture/11-evolution-and-deprecation.md:15` — DECISIONS entries are marked
  `Superseded` with `Superseded-by:` rather than edited.

**Residue.** The practice covers research artifacts, not release notes; no changeset/CHANGELOG entry
has ever been amended, and there is no "record it rather than quietly fix it" law. Also the
per-omission *downstream consequence* naming and the versioned remediation commitment are the two
moves beep does not do.

**Verdict:** `already-have` (mechanism present, better-reasoned; residue is narrow).

---

## gcr-07 — breaking-change classification by which view of a type breaks

**Searches run**

```
rg -n -i 'adding a required field|required field.*break|constructor.*break|producer.*view|breaks the constructor|encoded side.*break' -g '!node_modules' .
   # only tangential hits (rich-text reflection about encoded-side optionality); nothing normative
rg -n -i 'required field|optional field|additive' standards/architecture/04-rich-domain-model.md standards/schema-first-development-prompt.md standards/effect-first-development.md .claude/skills/schema-first-development/SKILL.md
   # 1 hit, an unrelated reference link
```

**What exists.** `standards/architecture/11-evolution-and-deprecation.md`:
- `:28-34` "### Additive changes are free — Adding **optional** fields to a command, query, or event schema"
- `:36-43` "### Breaking changes require a new tagged variant — renaming a field / changing a field's
  type / removing a field / changing the semantic meaning of a value"
- `:52` "A breaking change without a `V2` variant is a contract violation, even if the producer's
  tests pass."

**The hole.** Adding a **required** field is in neither list. In beep-effect that hole is wider than
in Graphnosis, because `S.Class` schemas are opaque and double as the decoded type — every
`X.make({...})` call site, test fixture, and `Model.Class` mock breaks while readers are untouched —
and the encoded/decoded duality doubles the axes (a change can break encoders and not decoders, or
the other way). Two of 316 pending changesets are `major`; two mention "breaking".

**Verdict:** `gap`.

---

## gcr-08 — state the disclaimer where the belief forms; make it normative on your own docs

**The high-value instance is live and unmitigated.**

`goals/practice-kg-mcp` (active, 5/9, Lane 1 live front) ships a **portable bundle of an IP practice's
corpus** to a foreign host:

`goals/practice-kg-mcp/research/bundle-contract.md` §4 —
```
practice-kg-bundle/
  bundle.manifest.json
  kg.pglite/            # epistemic tables + kg_node/kg_edge/kg_build
  practice.duckdb
  README.txt            # one page, non-technical
```
copied into a directory, pointed at by `user_config.bundle_dir` in the `.mcpb` manifest, plus an
optional `corpus_root` for full document bodies.

```
grep -rl -i 'encrypt' goals/practice-kg-mcp/   -> (no output, exit 1)
rg -n -i 'encrypt|at rest|confidential|privilege|leak|hand over|portable' goals/practice-kg-mcp/SPEC.md goals/practice-kg-mcp/research/bundle-contract.md
   -> SPEC.md:10 "portable data bundle"; SPEC.md:69 "Corpus/PII stays outside the repo; gitleaks stays clean."
```

`SPEC.md:69` is a statement about **the repo**, in the document a reader consults about the repo. The
document a reader consults while deciding whether the bundle is safe to copy, sync, back up, or hand
to a co-counsel says nothing at all. This is the `.gai` situation exactly, on privileged material, in
a practice governed by the standing OIP confidentiality rule.

**The normative half is also absent.** RFC-2119 obligations exist in beep-effect standards but only
about code:
`standards/architecture/12-observability.md:51-52`, `10-cross-slice-coordination.md:55-57`,
`11-evolution-and-deprecation.md:9`, `09-errors-across-boundaries.md:14`. None binds a documentation
claim. Nearest brick: `goals/knowledge-surface-automation/SPEC.md:172` — "Contradiction/redundancy
pass: one authoritative home per normative rule, other appearances become links/transclusions; genuine
conflicts go to a grill session" (planned, not shipped).

**Verdict:** `gap` (highest-value mapping in this batch).

---

## gcr-09 — NOTICE documents inlined transitive deps of a vendored bundle, and why it is vendored

**What exists — and it is genuinely excellent per donor.**

`THIRD_PARTY_NOTICES.md` names, for each donor: upstream URL, pinned release AND pinned commit,
affected material, form of use, and — for Graphiti — the §4(d) reasoning
(`:79-80` "Upstream ships no root `NOTICE` file at the pinned revision, so no Apache-2.0 §4(d)
attribution-notice reproduction applies"). The reasoning trail lives in
`explorations/agent-memory-tiers-bitemporal-edges/research/license-aware-clean-room-reimplementation.md:25`
(the same §4 analysis, done first).

**What is missing — coverage, not craft.**

```
git ls-files .repos | wc -l        -> 3340      # vendored Effect v4 subtree, LICENSE at .repos/effect/LICENSE
git ls-files | grep -iE 'vendor'   -> tools/skillopt/vendor/prompts/**  (many files)
ls tools/skillopt/                 -> configs pyproject.toml src tests uv.lock vendor   # no README, no LICENSE, no NOTICE
find tools/skillopt -maxdepth 3 -iname '*.md'  -> (no output)
ls patches/                        -> knip@6.27.0.patch  sharp@0.35.0.patch
rg -n -i 'effect|skillopt|vendor|subtree' THIRD_PARTY_NOTICES.md
   -> only lines 74-75, the Graphiti "No Python source is copied, vendored, or redistributed" sentence
```

So the canonical notice file covers two behavioural-reimplementation donors and **none of the three
surfaces that actually redistribute third-party bytes**: the tracked `.repos/effect` subtree, the
`tools/skillopt/vendor/prompts/**` tree (landed in `fb7ce421ce`, PR #309, with no provenance file of
any kind), and the two patch files that modify third-party code. Graphnosis's other half — "state why
the vendoring exists, tied to the product property it protects" — has no analog either.

This is a public repo (`docs/README.md`: "this repository is public") owned by a practicing IP
attorney's principal. Attribution hygiene here is not theoretical.

**Verdict:** `partial`.

---

## gcr-10 — commit subjects are claims, bodies are four-move arguments with Deferred sections

**What exists.** Subjects already are claims in plain English, conventional-commit prefixed, no ticket
refs (`git log --format='%s' -40`):

```
fix(repo-cli): make remote branch deletion a leased compare-and-swap (#571)
docs(jsdoc): give override records the kind field the binding rule requires (#585)
docs(jsdoc): fix carrier policy contradiction and graduate migration packet (#576)
fix(repo-cli): merge-ready honesty fix; ledger 76-78; PR-closeout law (#583)
perf(quality-speedup): retire tstyche surface, defuse MimeType check bomb, cap CI concurrency (#548)
```

Bodies are dense and mechanism-first (see `2ad30781e2`: the sub-agent-idleness amendment names the
three failure modes and the interim doctrine).

**What is missing.**

```
git log -300 --format='%b' | grep -ci '^Deferred:'                       -> 0
git log -300 --format='%H %s%n%b' | grep -in 'deferred:'                 -> 0
git log -300 --format='%b' | grep -ci '^cost:'                           -> 0
git log -300 --format='%b' | grep -ci 'does not change|behavior unchanged'-> 1
```

No labelled Deferred paragraph, no cost / does-not-change move, no verification-method statement
("each corrected snippet was executed from a packed tarball rather than read"). **But** the deferred
content has a durable home elsewhere — `goals/speed-loop/research/OPPORTUNITIES.md` (988 lines, 83+
numbered items with `unowned`/`queued`/`spiked` status) plus the AGENTS.md friction-capture law
("Friction is a first-class output ... record a receipt ... at the moment it happens, never saved for
closeout"). So the gap is placement (commit vs ledger), not the discipline.

**Verdict:** `partial`.

---

## gcr-11 — a spec written for a stranger: per-layer L1/L2/L3 conformance

**What exists.**

- Normative-spec doctrine with an explicit precedence ladder:
  `goals/_template/SPEC.md:11-21` "Source Hierarchy ... Higher sources outrank lower sources when they
  conflict"; `## Non-Goals` is a mandatory section at `:7-9`.
- Real conformance machinery for a *foreign* spec: `packages/foundation/modeling/html/src/Html.conformance.ts`
  (generated conformance registries, frozen proof tokens — see `standards/effect-laws.allowlist.jsonc:15-35`),
  `packages/drivers/rdf-canonize`, `packages/drivers/shacl`.
- Versioned wire envelopes a second implementation could target:
  `qa-inventory/v1`, `yeet-verdict/v2`, `yeet-run-state/v1`, `yeet-attempt-journal/v1`,
  `fallow-report-envelope/v1`, `github-check-run/v1`
  (`packages/tooling/tool/cli/test/yeet.test.ts:298,304,726,1781,1805,1887,2188`),
  `DocgenProofManifestSchemaVersion` (`packages/tooling/tool/docgen/src/ProofManifest.ts:72`),
  the goal manifest schema, and `bundle.manifest.json` (`schemaVersion` per store).

**What is missing.** None of those envelopes states what an independent reader **must** do versus may
ignore; there is no layered claim ("declaring L2 is a complete claim, not a partial one"); and the
editorial rule "write it for the implementer, not for a reader of this repo" has no analog — beep
SPECs cite packet-internal history and PR numbers freely (which is correct for a packet, and wrong
for a format).

**Verdict:** `partial`.

---

## gcr-12 — "one break, once": budget the breakage, name the v3 exceptions, list what v2 refuses

**What exists — the "deliberately NOT" half is institutionalized.**

- `goals/_template/SPEC.md:7-9` mandatory `## Non-Goals`.
- `goals/skillopt-training-pilot/GOAL.md:24` "Out: adopting the trained skill; vendoring SkillOpt;
  raw-transcript ..."; `SPEC.md:22` same.
- `goals/box-typecheck-cost/ops/manifest.json:167,173` — levers recorded as "NOT BUILT ... this lever
  was never fired. Was conditional on P2 misses budget", with the pre-agreed re-entry trigger retained.
- Forward-compatible decode is already a deliberate design move:
  `goals/knowledge-surface-automation/README.md:33-37` — manifest `provides`/`requires` "declared
  ahead of schema support on purpose - decode-compatibility is a P1 test";
  `SPEC.md:~186` "Manifest schema extension (additive, defaulted — existing manifests decode unchanged)".

**What is missing — the versioning half.** Envelopes bump versions ad hoc
(`goals/speed-loop/history/i4-report.md:78` "`YeetVerdict`: version bumped from `yeet-verdict/v1` to
..."). There is no budget on how many breaks a format may take, no must-understand feature-tag list,
no named admissible reasons for the next break. And readers reject on unknown **version** today —
`packages/tooling/tool/cli/test/corpus-command.test.ts:101` "rejects records that are too short or have
unknown versions"; `packages/foundation/ui-system/dock/test/DockEngine.test.ts:134` "rejects legacy
unversioned workspace snapshots" — which is exactly the "version skew reported as a wrong-format
error" behaviour the Graphnosis spec argues against.

**Verdict:** `partial`.

---

## gcr-13 — prove the packaged artifact, and prove the prover with a positive control

Two separable halves; they land differently.

**Half B, "prove the prover" — `already-have`, and institutionalized.**
`goals/professional-desktop-adversarial-qa/ledgers/findings.md` records "mutation-tested" as the
standard closure evidence on F-000-03, F-002-01, F-002-04, F-002-13, F-002-15, F-002-17, F-002-18 and
F-002-23 ("mutation-tested guard fails if the list drifts"). Vacuity is named as a defect class:
`apps/professional-desktop/test/composer-send-lifetime.test.tsx:48` ("empty composer is a legitimate
no-op and would pass this test vacuously"), `goals/knowledge-surface-automation/SPEC.md:159`
("requiring failure — vacuous checks die"), `goals/jsdoc-carrier-migration/SPEC.md:272` and
`GOAL.md:54`, `goals/knowledge-surface-automation/research/p1-bootstrap-adopt-plan-design.md:298`
("A vacuous preservation test that never demonstrates the loss proves ..."). Refusal-first fixtures
too: `apps/professional-desktop/test/intake-refusal.test.ts` ("what intake refuses, before it reads a
byte").

**Half A, "prove the artifact" — `gap`, but the npm framing is moot.**
```
rg -n 'from "\.\./dist|/dist/' --glob '*.test.ts' packages/ apps/    # only path-string assertions in
                                                                    # PackageJson.test.ts / architecture-operation-plan.test.ts
rg -l -i 'npm pack|packed tarball|publint|attw|verify-package'       # zero hits in packages/, apps/, scripts/, .github/
```
All 126 package manifests are private, so there is no tarball to install. But the class is not moot:
`release-desktop.yml:284-305` only asserts each Tauri artifact **path exists and is a file**; nothing
installs a built bundle in a clean environment and exercises its declared entry points. The `.mcpb`
bundle for `apps/practice-kg-mcp` is the one artifact that will be handed to a real user's Claude
Desktop, and its verification story is not written.

**Verdict:** `partial`.

---

## gcr-14 — CI gates are incident post-mortems, ordered by irreversibility

**Half A, post-mortem comments — `already-have`, and better sourced than Graphnosis.**
`rg -n '^\s*#' .github/workflows/*.yml`:
- `release.yml:61-63` — "@changesets/changelog-github resolves PR/author links via the GitHub API and
  hard-fails without a token (**main-red cause, fixed 2026-07-05, goals/agent-pipeline-velocity B3**)."
- `check.yml:199-203` — "Lane bodies live in the beep CLI (one-round-loop P0 inversion; same-SHA
  parity proof recorded in `goals/one-round-loop/history/p0-parity-evidence.md`)."
- `check.yml:309-312` — the property-law lane's non-required status and the P4 close criterion for
  flipping it.
- `check.yml:661-673` — why gitleaks is pinned to the **base branch** config: "a PR could broaden the
  allowlist ... in the SAME change to hide a planted secret and still pass the required check."
- `check.yml:715-726` — "Security property (**CSF-022**): never silently FAIL OPEN", with the
  benign-vs-genuine `gh api` distinction spelled out.
- `storybook.yml:31-33` — the "No space left on device" incident.
- `property-laws-nightly.yml:1-9` — why the nightly exists and how to verify it (dispatch, not cron).

Graphnosis cites incidents; beep-effect cites incidents **plus the packet and PR that fixed them**.

**Half B, irreversibility ordering — `gap`.**
```
rg -n -i 'irreversib' packages/tooling/tool/cli/src/commands/Yeet/*.ts .claude/skills/yeet/SKILL.md  -> 0
```
`release.yml` publish job: checkout → setup → `actions/setup-node` (registry) → `bun run release`.
Every gate lives inside `package.json:421` (`build && test && lint && audit:full && changeset
publish`), so nothing re-verifies the manifest immediately before the unretractable step, and no
doctrine says the last gate should guard it. The protections that do exist are human
(`inputs.confirm_publish == 'PUBLISH'`, `environment: release-publish` with required reviewers). The
"silence would look like success" justification for a redundant step also has no analog.

**Verdict:** `partial`.

---

## Antipatterns — does beep-effect risk the same mistakes?

| Graphnosis antipattern | beep-effect exposure |
|---|---|
| A1 orphaned high-authority doc | **Partly defended.** `docs/ROADMAP.md:3` carries `Freshness: 2026-07-27`; `docs/mirror/2026-07-08-roadmap.md` is explicitly superseded ("Where the two disagree, this file wins"); `docs/BEEPGRAPH_ARCHITECTURE.md` is labelled "remains a proposal" (`docs/ROADMAP.md:128`). `beep lint roadmap-refs` (`packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts`) resolves every goal/exploration link in ROADMAP.md. **Undefended:** nothing enumerates docs reachable from no top-level page; `docs/agent-memory-infra/` (15 files) and `docs/graphs/` (4) are linked from `docs/README.md` only by directory glob. |
| A2 agent-instruction files as shadow specs | **Actively defended.** `AGENTS.md`/`CLAUDE.md` are the prompt-cache prefix and are explicitly budgeted ("Context Economy"), `docs(agents): prune always-loaded context and fix stale routing facts (#564)` is a recent maintenance commit, and `goals/knowledge-surface-automation` treats `.claude/`/`.agents/`/`.codex/` as gated surfaces. |
| A3 normative claim contradicted in a third file | **Real risk, named but not shipped.** `goals/knowledge-surface-automation/SPEC.md:172` is the planned contradiction pass. A concrete live instance: 42 `/home/elpresidank/...` absolute paths in tracked public docs, **12 dead**, including `standards/effect-first-development.md:443`. |
| A4 retraction placed below the claim | **Already solved better** — `explorations/academia-corpus-mining/DECISIONS.md:142-149` reasons explicitly about errata *placement* and puts the banner at the entry points. |
| A5 hand-maintained test chain | **Not applicable.** turbo + vitest + `beep ci lane <name>`; lane bodies live in the CLI, not in a `&&` string. |
| A6 stale transcript at the repo root teaching a wrong constant | **Mild.** `THE_SCHEMA_IS_TRUTH_A_CATEGORICAL_FEVER_DREAM...md` and `docs/PROSE_TO_PROOF_CHAT.html` are root-level narrative artifacts; `scratchpad/` is repo-tracked and holds experiment code (`scratchpad/effect-ontology/**`, `scratchpad/claudecode/**`) that an agent browsing the repo could implement from. Neither carries a staleness banner. |

---

## Landing-packet notes

- `goals/practice-kg-mcp` (active, 5/9, Lane 1 live front) — gcr-03, gcr-08, gcr-11, gcr-13.
- `goals/knowledge-surface-automation` (active, 2/7) — gcr-01, gcr-02, gcr-12.
- `goals/coding-agent-effectiveness-evidence-loop` (active, 0/9) — gcr-04.
- `explorations/compound-engineering` (seeded 2026-08-06, CAPTURE only) — gcr-05, gcr-06, gcr-10.
- `goals/speed-loop` (active, 1/3, standing loop with the 988-line OPPORTUNITIES ledger) — gcr-14.
- `goals/domain-kernel-hardening` (paused, 0/4, resumes "before KG tables scale") — gcr-07.
- `explorations/agent-memory-tiers-bitemporal-edges` (active, stage `graduate`; owns the license-aware
  clean-room analysis that produced THIRD_PARTY_NOTICES.md) — gcr-09.
