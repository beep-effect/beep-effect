# GOAL: deliver secure document delivery

Repo root: the current `beep-effect` checkout. Do not assume an absolute path;
several checkouts exist.

Outcome: one attorney-authorized, fixture-backed USPTO/ODP office-action PDF
traverses mint → seal → gate → serve through an incubated provider-neutral
capability and authenticated desktop route without leaking raw origin URLs,
business identifiers, serving keys, or PDF bytes into prohibited surfaces.

Read these as the detailed contract:

- `goals/secure-document-delivery/README.md`
- `goals/secure-document-delivery/SPEC.md`
- `goals/secure-document-delivery/PLAN.md`
- `goals/secure-document-delivery/ops/manifest.json`
- `goals/secure-document-delivery/research/SOURCES.md`

Then read `AGENTS.md`, `CLAUDE.md`, governing standards, and the exploration.

Scope:

- In: incubated `secure-document-delivery`; document schemas/errors,
  mint/resolve/revoke, persistence, and `ServingKeyCustody` ports; mapping
  envelope; desktop PGlite/custody/HTTP bindings; product adapters; OA fixture.
- Out: generic crypto/proxy platform; raw URLs; live fetch; Box/viewer/other
  origins; asset/localhost protocol; PDF persistence; shared vault codec;
  `@beep/m365` import; new dependencies; `goals/INDEX.md`.

Workflow:

1. Inspect the exploration, worktree, source bricks, and package laws.
2. Complete P0 first: threat model; envelope/rotation vectors; packaged
   cross-platform custody proof; webview, Range/HEAD, and stream policy.
3. Implement schema-first, Effect-first contracts. Accept only authorized
   provider references; consumers own authorization/provenance and drivers own
   dereference, credentials, and SSRF behavior.
4. Mint a 128–256-bit opaque CSPRNG reference (strict UUIDv4 only if chosen).
   Keep business/expiry data out of the URL and enforce store expiry/revocation.
5. Seal only mappings with versioned WebCrypto AES-256-GCM, fresh 96-bit nonce,
   key id, and AAD for token, workspace, origin, expiry, and version. Active
   keys are `Redacted`; do not share the credential-vault codec.
6. Add a loopback document route outside RPC CORS. Require Host, session,
   audience, store, and envelope gates; every denial is the same 404. Set the
   required security/content headers, bounds, cancellation, and Range/HEAD rule.
7. Extend the catalog-0.5.4 desktop PGlite/Drizzle runtime and boot migrations;
   add no second store or PDF cache.
8. Keep live fetch blocked by the rebinding harness; proof stays network-free.
9. Preserve unrelated changes. At P3, reflect and drive the PR to mergeable.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion passes.
- [ ] P0 security and packaged-custody gates are evidenced.
- [ ] One authorized OA fixture completes mint → seal → gate → serve.
- [ ] Denial classes are identical 404s; expiry/revocation and rotation pass.
- [ ] No prohibited URL, identifier, key, envelope bytes, or PDF cache leaks.
- [ ] Required verification passes without unrelated churn.

Verification:

```sh
test "$(wc -m < goals/secure-document-delivery/GOAL.md)" -le 4000
jq . goals/secure-document-delivery/ops/manifest.json
git diff --check -- goals/secure-document-delivery
```

Stop before widening scope, adding dependencies, enabling live fetch, promoting
the capability, or weakening a fail-closed boundary.

Done only when acceptance is green and the PR is mergeable through Yeet;
otherwise report blockers with file/command evidence.
