# GOAL: Claim Element Antecedent Check

Repo root: the current working directory, the `beep-effect` checkout you run
in. All paths are repo-relative.

Outcome: a span-anchored claim-element tree, a pure deterministic decomposer,
and an advisory §112(b) antecedent and dependency checker. Findings reach the
attorney as `claim-finding` review items, measured on public USPTO claims with
strict structural equality.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/claim-element-antecedent-check/SPEC.md` (normative)
- `goals/claim-element-antecedent-check/PLAN.md`
- `goals/claim-element-antecedent-check/README.md`
- `goals/claim-element-antecedent-check/ops/manifest.json`

Read those, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`, and
the source exploration `explorations/claim-element-graph/` (BRIEF, DECISIONS,
MAP). Higher repo standards outrank packet prose.

Scope:

- In: `packages/law-practice/domain/src/values/ClaimElement/` (schemas,
  `.behavior.ts` decomposer, `.policy.ts` checker); `ClaimSelfCheck` service
  and a practice MCP read tool in `packages/law-practice/use-cases`; the USPTO
  claims adapter in `packages/law-practice/server`; public USPTO fixtures and
  tests; the evaluation report under this packet's `history/`.
- Out: any `PatentClaim` shape change, `shared/*` promotion, LLM
  decomposition, training, retrieval, Markush, IPRally adapter, DOCX, §112(f),
  blocking gates, MCP write tools, NC-licensed data in the repo, and the gated
  `MAP.md` rows.

Phases (PLAN.md has entry/exit criteria):

1. P0 Schema: `ClaimElementTree`, `ClaimElement`, `ClaimTerm`, the
   `ClaimElementEdge` and `AntecedentFinding` tagged unions (including
   `pattern-not-covered`), `TextAnchor` spans.
2. P1 Contract: `ClaimSelfCheck` `Context.Service`, decomposer and policy
   signatures, USPTO claims port. No bodies.
3. P2 Implementation, USPTO adapter, first vertical slice, labelled set (~60
   families via an extractor/critic loop with ~10% attorney spot-check; ~200
   allowed claim sets).
4. P3 Review items and evaluation. Needs `review-verdict-envelope` P1.
5. Yeet: PR to mergeable. Then Close with a reflection.

Binding order: schema, then contract, then implementation. Effect v4,
`LiteralKit`, `S.Class`, `effect/HashMap`/`HashSet`, JSDoc law. Public repo:
no client data, names or machine paths.

Workflow: make the smallest change that satisfies `SPEC.md`, phase by phase;
preserve unrelated worktree changes; tie decisions to evidence; update README,
PLAN and manifest status as phases move. At Close, write
`history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
`bun run beep lint reflection-artifacts` must pass.

If the deterministic floor measures badly, stop at the measurement and report
it. Do not expand scope.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/claim-element-antecedent-check/GOAL.md)" -le 4000
jq . goals/claim-element-antecedent-check/ops/manifest.json
git diff --check -- goals/claim-element-antecedent-check
bun run beep quality package-verify @beep/law-practice-domain
bun run beep quality package-verify @beep/law-practice-use-cases
bun run beep quality package-verify @beep/law-practice-server
```

Decide public API, schema, dependency or generated-file changes yourself when
the goal needs them: record each in SPEC.md's Decision Log with its reason and
how to reverse it. Escalate only what AGENTS.md "Autonomy" lists.

Done only at `completed-retained`, or when a blocker that needs the operator is
reported with file/command evidence.
