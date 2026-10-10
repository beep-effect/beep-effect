# Semantic Foundation Plan

## Status

Status: `completed-retained`

## Sequencing

M1 and R1-R4 are complete. The 2026-10-09 product pull reopens M2 and M3;
M3 code waits for M2 tests and real-artifact readiness. M4 remains gated.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| M1 Intake-Serving Semantic Seed | complete | Ship the repo-owned SKOS seed, document-class vocabulary, filing-path semantics, and `@beep/ontology` taxonomy registry/loader. | Sample document classification produces taxonomy concept, document class, filing path, and FOLIO-aligned concept IRI; repo proof is green or unrelated failures are documented. |
| R1 Research Feed: FOLIO and Legal Vocab Alignment | complete | Decide which FOLIO/vendor slices are vetted for loader support and which alignments are `exactMatch` vs `closeMatch`. | Research and the asset manifest name the exact loadable FOLIO slice, license, checksum, and `closeMatch` rationale. |
| R2 Research Feed: Classification Schemes | complete | Ground IPC/CPC/Nice edition strategy and constant eligibility. | Research report decides M2 seed boundaries, edition metadata, and whether `@beep/rdf` constants are warranted. |
| R3 Research Feed: Docketing and Party Roles | complete | Ground deadline and role vocabularies without creating domain entities. | Research report separates enduring party identity from time-bounded legal role vocabulary and names M3 prerequisites. |
| R4 Research Feed: SHACL and Topology | complete | Decide shape-authoring needs and whether any future SPARQL/topology report is warranted. | Research report keeps `UnsupportedSparqlQueryServiceLive` unchanged for v1 or opens a separate gated topology packet. |
| M2 Classification Schemes | complete | Load IPC/CPC/Nice SKOS schemes with edition tracking and hierarchy lookup. | Gate condition met: August 5 first-user metric or demo-day pull. |
| M3 Docketing and Party Roles | complete | Add docketing/deadline and party-role vocabulary modules. When the vocabulary stabilizes, spawn a `trademark-docketing-domain` packet to replace the removed stub. | Gate condition met and dependent trademark docketing packet can start. |
| M4 ClaimGate Shapes | gated | Author intake/ClaimGate SHACL shapes against bounded semantic-web validator. | Gate condition met; shapes work without semantic-web contract changes. |

## M1 Work Items

1. [x] Inspect the current target surfaces and confirm the exact package-local
   paths for `@beep/rdf`, `@beep/ontology`, `@beep/identity`, and
   `@beep/semantic-web`.
2. [x] Define the repo-owned M1 taxonomy seed as SKOS TTL/JSON-LD data using
   `https://ns.beep.sh/` IRIs minted by `@beep/identity`.
3. [x] Model document-class vocabulary for `draft`, `redline`, `filed`,
   `received`, `privileged`, and `extracted-child`.
4. [x] Add schema-first concept-scheme/taxonomy registry models and a loader
   service in `@beep/ontology`.
5. [x] Load committed seed data plus vetted gitignored vendor slices named by the
   exploration asset-pack manifest; fail closed when the manifest is missing or
   a vendor slice is unvetted.
6. [x] Expose filing-path semantics for local vault plus Box mirror as vocabulary
   data and projection rules for consumers.
7. [x] Prove a fixture intake librarian classification loop that emits concept IRI,
   document class, and filing path without implementing the document slice.

## M2 Work Items

- [x] Record edition pins, scheme identities, bounded seed and deferred schemes.
- [x] Check reuse terms and retain a licence ledger before code or manifest rows.
- [x] Commit R3 loader kind admission and real-manifest tests before rows.
- [x] Add checksum-pinned rows and safe archive fetching.
- [x] Author classification schemas, service contract, then XML implementation.
- [x] Prove synthetic lookup/CQ fixtures and coverage without lowering baselines.
- [x] Prove real IPC/CPC/Nice editions and the M1 real-manifest regression (run-8 handoff).
- [x] Package-verify passes; publish wave 1 and record hosted checks. Private ontology has release notes under #1566.

M2 real-edition proof passes: IPC 80,145, CPC 254,314, Nice 10,168 concepts;
M1 remains nine concepts with its vetted email alignment. Run-8 handoff retains
the archive hashes and lookups. Wave 1 is draft #1598; inherited Repo Sanity private changesets and Vercel rate limits are attributed in the handoff. Heavy required checks are queued.

## M3 Work Items

- [x] Audit kind/role/deadline/event distinctions.
- [x] Add versioned docketing and separate party-kind/legal-role seeds.
- [x] Prove seed parity, separation and CQ 1/5/7/8/18 fixtures.
- [x] Retain stable vocabulary contract and bootstrap plan; create no downstream packet.
- [x] Verify edited packages and commit M3.
- [x] Reflect, close P3/P4 and publish final wave ready for orchestrator merge.

## P4 Closeout Checklist

Before marking the packet closed (and `status` -> `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes, especially concurrent exploration
  research and asset-pack edits.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep third-party ontology material in the exploration asset pack; commit only
  manifest/fetch metadata there and repo-owned seed data in implementation.
- The former ontology-survey packet was removed 2026-07-14, so its no-annotation
  fence is moot; use `explorations/legal-ontology-landscape` for grounding.

## Verification Commands

```sh
test "$(wc -m < goals/semantic-foundation/GOAL.md)" -le 4000
jq . goals/semantic-foundation/ops/manifest.json
rg -n "semantic-foundation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantic-foundation
git diff --check -- goals/semantic-foundation explorations/legal-ontology-landscape explorations/ATLAS.md
# repo quality: hosted CI on the PR (SPEC Decision Log 2026-10-09)
```
