# GOAL: Semantic foundation M2 and M3 ready slices

Repo root: the current working checkout. All paths below are repo-relative.

Outcome: ship version-pinned IPC/CPC/Nice classification schemes and repo-owned
docketing/deadline, party-kind and legal-role vocabularies for the gated
oppold-corpus-semantic-ingestion-v2 consumer. M1 remains shipped; M4 stays
pending and belongs to legal-document-intake P4.

Read README.md, SPEC.md, PLAN.md and ops/manifest.json in this packet, then
AGENTS.md and explorations/legal-ontology-landscape research and asset metadata.
SPEC is normative; the 2026-07-08 user-locked non-goals remain binding.

Scope: @beep/ontology schemas, registry/loader, repo-owned seeds and tests;
manifest/fetch metadata in the exploration asset pack; justified named RDF
constants and identity composition. No graph store, SPARQL wiring, SHACL,
law-practice entities, document-intake implementation or downstream packet.
Third-party archives and XML stay under gitignored assets/vendor/.

Workflow:
1. Reopen through goals set-status; record gate, verification and R5 decisions.
2. Record edition/IRI decisions and explicit reuse evidence before code or rows.
3. Commit R3 loadKind domain and M1 skip/real-manifest proof before M2 rows.
4. Implement classification schemas, service contract, then XML loading; prove
   fixtures, coverage and real artifacts through beep-heavy (32G cap).
5. Publish complete M2 as wave 1; record hosted checks. Only then start M3.
6. Audit kind/role distinctions; add versioned vocabulary seeds and CQ fixtures.
7. Retain frozen contracts and a read-only downstream bootstrap plan.
8. Verify packages, add changesets, reflect and return to completed-retained.
9. Merge origin/main and publish final wave ready. Orchestrator owns merging.

Acceptance: pinned editions preserve IPC/CPC identities and hierarchical
lookups; typed admission failures fail closed; real manifest preserves M1;
M3 seed parity, distinct party kinds and roles, versioned CQs and stable
contracts pass. Cite each proof in SPEC and the append-only handoff.

Verification:
```sh
test "$(wc -m < goals/semantic-foundation/GOAL.md)" -le 4000
jq . goals/semantic-foundation/ops/manifest.json
rg -n "semantic-foundation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantic-foundation
git diff --check -- goals/semantic-foundation explorations/legal-ontology-landscape explorations/ATLAS.md
bun run beep lint reflection-artifacts
# repo quality: hosted CI on the PR
```

Run package-verify and hosted parity through beep-heavy; existing coverage rows
stay unchanged. Follow SPEC Decision Log for verification and gate amendments.

Stop and report before changing public API outside target surfaces,
dependencies, lockfiles, generated files, SPARQL/graph-store topology, auth,
infra, package source outside this spec, or destructive state.
