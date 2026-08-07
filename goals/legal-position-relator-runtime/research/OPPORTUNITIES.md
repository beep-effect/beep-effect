# Opportunities & friction ledger

Receipts recorded at the moment of friction, per the repo friction-capture law.

## 2026-08-06 — P0 research

### `SourceTextResolver` port consumption has no law-practice README coupling record

- **What happened:** while verifying the foundation-mediated port-inversion shape for the
  rung-2 handoff decision, the evidence walk found that `packages/law-practice/use-cases`
  already consumes the `SourceTextResolver` port (`CandorPolicy.ports.ts:14`) with **no
  README coupling record on the law-practice side**, which
  `standards/architecture/DECISIONS.md:1117-1120` requires in both packages. The ratified
  mechanism's own record-keeping requirement is unmet for the one precedent this slice
  consumes.
- **Evidence:** [`02-handoff-shape-evidence.md`](./02-handoff-shape-evidence.md) §C4;
  `rg -n "SourceTextResolver" packages/law-practice/use-cases/README.md` returns nothing.
- **Prevention:** a lint that pairs foundation-port imports in slice packages with a README
  coupling-record mention (same spirit as `lint:promotion-records`) would have caught this
  when the candor gate landed. Fixing the missing record is a named follow-up, not this
  goal's edit — this packet must not carry unrelated refactors.

## 2026-08-06 — P1 rung 1

### `standards/schema-catalog.generated.jsonc` is stale on `main`

- **What happened:** during rung-1 schema authoring, `bun run beep lint
  schema-catalog --write` produced +6049/−280 — 768 added symbol entries
  unrelated to this branch versus 16 belonging to the new work (tracked 3764
  entries, regenerated 4496). The implementing agent reverted the regeneration:
  landing 768 unrelated entries would violate the SPEC's always-binding "No
  unrelated refactors or formatting churn".
- **Evidence:** `PracticeKgHostError` is declared at
  `apps/practice-kg-mcp/src/runtime/Host.ts:41` in HEAD yet appears zero times
  in HEAD's catalog — the staleness pre-exists this branch. `beep lint
  schema-catalog` was already red on `main` and stays red here (inherited, not
  introduced).
- **Prevention:** a CI gate (or post-merge refresh job) keeping the generated
  catalog in lockstep with `main` would stop every feature branch from
  inheriting a red catalog lane and having to prove non-attribution. The
  repo-wide refresh needs its own commit/PR; decide before P3 yeet whether to
  land it separately.

### Opus subagent died on the account session limit after writing its report

- **What happened:** the P0 handoff-evidence agent (Opus 5, per SPEC decision 3 and the
  operator's session directive) hit "You've hit your session limit · resets 9:40pm
  (America/Chicago)" and failed its final return. Its full 791-line dossier survived only
  because the orchestration contract makes agents write deliverables to disk before
  returning; the orchestrator resumed from the file with zero loss.
- **Evidence:** teammate failure notification 2026-08-06T22:57:45Z; recovered report at
  [`02-handoff-shape-evidence.md`](./02-handoff-shape-evidence.md) (scratchpad original
  written 22:57, 42,963 bytes).
- **Prevention:** the durable on-disk handoff doctrine (AGENTS.md Context Economy) is the
  prevention and it worked — worth noting that Opus-only orchestration mandates inherit a
  hard stall window when the account session limit trips mid-phase; phase plans should keep
  a main-thread-recordable paperwork lane (evidence promotion, ledger, packet updates) to
  absorb the window.

## 2026-08-06 — P1 rung 1, stage 2 (policy contract)

### Adding one in-slice concept forces a full repo-wide docgen proof

- **What happened:** the new `LegalPositionRelatorPolicy` concept needs a
  `package.json` subpath export, and `bun run beep tsconfig-sync --check`
  reports drift until the matching root `tsconfig.json` alias is added
  (`tsconfig-sync: drift detected (1 file change(s)) — tsconfig.json
  [root-aliases] aliases: add 1`). Touching root `tsconfig.json` then makes
  `bun run docgen:local` refuse the bounded proof: `full proof required:
  tsconfig.json: Global docgen or Turbo input changed` — so proving a
  four-file, one-package change costs a 130+-package `bun run docgen`.
- **Evidence:** `bun run docgen:local` output above; the alias the tool wrote
  is byte-identical to the one-line hand edit it rejected as drift.
- **Prevention:** treat the root-alias block as a per-package input rather than
  a global docgen input — the aliases are append-only, package-scoped rows, so
  a change confined to one package's rows should invalidate only that package's
  docgen task. Alternatively let `docgen:local` diff the alias block and skip
  escalation when every changed row belongs to an already-selected package.
  Every new concept in every slice pays this today.

### `S.HashSet(...)` is a declared schema, not a codec over arrays

- **What happened:** building relator fixtures, `S.decodeUnknownEffect` on a
  relator whose `admittedPlayerKinds`/`scope` axes were encoded as JSON arrays
  failed. `S.HashSet(PartyKind)` decodes only an actual `HashSet` instance
  (`decode array FAIL: SchemaError(Expected HashSet)`), and its encoded form is
  the HashSet's own `toJSON` (`{"_id":"HashSet","values":[...]}`), not an array.
- **Evidence:** two probe cycles; worse, when a `.check(...)` filter sits on the
  HashSet the failure surfaces as the *filter's* identifier
  (`Expected .../LegalRoleAdmittedPlayerKindsCheck at ["bearer"]["admittedPlayerKinds"]`)
  rather than "Expected HashSet", which points the reader at a non-emptiness
  rule when the real problem is the input shape.
- **Prevention:** this is a rung-2 hazard, not a rung-1 one. Any durable store
  or wire boundary that round-trips `LegalRole`/`LegalScopeContext` will need an
  explicit `HashSet`-from-array codec, and the migration/repo lane should decide
  that shape deliberately rather than discovering it at the first failing
  insert. A shared `S.HashSetFromArray` in `@beep/schema` would also make the
  filter-shadowed error message land on the right cause.

### `packages/law-practice/use-cases/README.md` contradicts its own shipped precedent

- **What happened:** the README states "This tier owns CONTRACTS ONLY: typed
  `Context.Service` ports with no implementation bodies and no live Layers"
  (`:12-17`), but `CandorPolicy.service.ts` has shipped `makeCandorPolicy` and
  `CandorPolicyLive` since PR #575, and the SPEC directs this goal to mirror
  that file-role split exactly. A contributor following the README would write
  the opposite of what the slice's live precedent and this SPEC require.
- **Evidence:** `packages/law-practice/use-cases/README.md:12-17` against
  `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts:245`,
  `:286`.
- **Prevention:** the README was not corrected here — a docs-only fix in this
  packet would be exactly the unrelated churn the SPEC forbids. It belongs in
  the same follow-up that adds the missing `SourceTextResolver` coupling record
  recorded above, since both are README-accuracy debt on the same file.
