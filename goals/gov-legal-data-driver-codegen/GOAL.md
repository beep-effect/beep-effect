# GOAL: Build the gov/legal driver substrate (tiered codegen + shared transport)

Repo: `beep-effect` (this checkout).

Outcome: a proven OpenAPI→Effect-Schema codegen + hand-authored transport
substrate — `@beep/govinfo` finished (keyed) and one keyless driver built — with
the shared auth/retry/cache/rate-limit transformer incubated in govinfo and
promoted once a 2nd driver consumes it.

Treat the packet files as the detailed contract:

- `goals/gov-legal-data-driver-codegen/README.md`
- `goals/gov-legal-data-driver-codegen/SPEC.md`
- `goals/gov-legal-data-driver-codegen/PLAN.md`
- `goals/gov-legal-data-driver-codegen/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and
`standards/architecture/07-non-slice-families.md`. Higher-priority repo standards
outrank packet prose when they conflict.

Scope:

- In: `packages/drivers/{govinfo,ecfr,dol,federal-register,courtlistener}`, the
  incubated transformer (→ `foundation/capability/<name>` at P3), per-driver
  `scripts/generate.ts` + `src/_generated/*`.
- Out: the `gov-legal-mcp` server (follow-on, gated on ≥2 drivers); CourtListener
  caching before the data-terms matrix; Orval/axios/Zod; PatentsView; a global
  `build→codegen` turbo edge; restarting govinfo; an OpenAPI→MCP-Toolkit
  generator.

Workflow:

1. Inspect the packet, the runpod `*.generated`/`*.service`/`*.config` split, and
   govinfo's `Search` contract + value models.
2. P0: finish govinfo — repair manifest (`@beep/identity` + `@beep/schema`), add
   hand-authored service/config/auth/retry/cache, incubate the transformer via
   `HttpApiClient.make`'s `transformClient`.
3. P1: build a keyless driver (eCFR/FedReg) on `HttpClient.mapRequest` (the 2nd
   consumer); run the `@effect/openapi-generator` Swagger-2.0 spike and record
   dialect warnings.
4. P2 (GATED on the data-terms matrix): CourtListener + DOL authed drivers;
   ephemeral-only CL cache; no third-party fixtures.
5. P3: per-package generate-first audit + CI `git diff --exit-code` drift check;
   promote the transformer to `foundation/capability/<name>` with a ≥2-consumer
   README record.
6. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] govinfo `Search` round-trips through the value models with auth attached,
      rate-limit honored, cache hit on repeat; one keyless driver builds offline.
- [ ] Codegen emits Schema + operation descriptors only into `src/_generated/*`;
      transport stays hand-authored.
- [ ] The `git diff --exit-code` codegen-drift check is green; build/check are
      network-free.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/gov-legal-data-driver-codegen/GOAL.md)" -le 4000
jq . goals/gov-legal-data-driver-codegen/ops/manifest.json
git diff --check -- goals/gov-legal-data-driver-codegen
```

Stop and report before changing public API, schema, auth, dependencies,
lockfiles, generated files, destructive state, or shipping CourtListener
caching/fixtures before the data-terms matrix exists, unless `SPEC.md` explicitly
requires it.

Launch:

```text
/goal follow the instructions in goals/gov-legal-data-driver-codegen/GOAL.md
```

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
