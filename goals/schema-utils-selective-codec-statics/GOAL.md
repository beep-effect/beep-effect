# GOAL: Selective Schema Codec Statics

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: replace broad `SchemaUtils` codec-static bundles with safe, selected,
hoisted statics; migrate all live uses to their minimal required set; delete
the old variants; and ratchet inline schema compilation to an error.

Read first:

- `goals/schema-utils-selective-codec-statics/SPEC.md` — normative contract.
- `goals/schema-utils-selective-codec-statics/DECISIONS.md` — ratified choices.
- `goals/schema-utils-selective-codec-statics/PLAN.md` — sequencing.
- `goals/schema-utils-selective-codec-statics/ops/manifest.json` — lifecycle
  and unresolved frontier.
- `goals/schema-utils-selective-codec-statics/research/SOURCES.md` — evidence.
- `AGENTS.md`, `CLAUDE.md`, and required schema/effect skills.

Hard gate: do not implement while manifest `openQuestions` is non-empty or
before the operator explicitly confirms shared understanding.

Scope:

- Implement one explicit `withCodecStatics(keys)` selector that constructs and
  exposes exactly the requested native Effect helpers.
- Implement only the safe, grilled `S.Class` utility form; never build a custom
  Schema class, proxy, decorator, or AST-compatible wrapper.
- Inventory every existing bare selector and Sync, Promise, Effect, Exit,
  Option, and Result bundle use, including exports and generators.
- Migrate every use to its audited minimal key tuple, then delete the broad
  helpers, implementations, exports, tests, docs, and examples.
- Resolve JSON format options at named `S.fromJsonString` construction and keep
  `AST.ParseOptions` at runner invocation unless a ratified decision says
  otherwise.
- Hoist remaining inline schema compilers and promote
  `beep(no-inline-schema-compile)` from warning to error only after the scope is
  clean.

Workflow:

1. Preserve unrelated worktree changes.
2. Complete P0 decision and census gates before code edits.
3. Use schema-first and effect-first development for implementation.
4. Update generators before generated outputs.
5. Preserve native Effect signatures and prove unselected runners are not
   constructed.
6. Run focused tests, `bun run beep quality package-verify @beep/schema`,
   docgen, and the canonical Yeet verification/publish/monitor lane.
7. Record friction immediately in `research/OPPORTUNITIES.md`, sanitized for
   this public repository.
8. Close with `/reflect` and synchronized packet state.

Acceptance:

- [ ] The complete `SPEC.md` contract is satisfied.
- [ ] No broad helper or zero-argument selector remains in live source.
- [ ] Every migrated schema exposes only its evidenced static set.
- [ ] Class and JSON footguns have focused runtime and type tests.
- [ ] Inline schema compilation is error-level and clean.
- [ ] Required local and hosted checks are green.

Stop and report if the work would require custom Effect Schema machinery,
cannot establish an exported schema's public static surface, would rebuild a
codec per business call, or exceeds the named scope.

Done only when the implementation PR is merge-ready through Yeet and the packet
is closed with a validated reflection.

