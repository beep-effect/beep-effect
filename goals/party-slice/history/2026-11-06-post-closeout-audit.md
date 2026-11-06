# Post-closeout acceptance audit — 2026-11-06

An independent re-run of every SPEC.md acceptance criterion and Verification
Matrix command against a clean `origin/main` checkout at `7484d606e6`, after the
closeout was adopted in [#2703](https://github.com/beep-effect/beep-effect/pull/2703).
The tests ran on `main` itself, not in the lane that produced them. This
receipt records evidence only; it changes no lifecycle state.

## Verification Matrix

| Check | Command | Result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/party-slice/GOAL.md)" -le 4000` | Pass |
| Manifest JSON | `jq . goals/party-slice/ops/manifest.json` | Pass |
| Whitespace | `git diff --check -- goals/party-slice` | Pass |
| Party packages | `bun run beep quality package-verify @beep/party-{domain,use-cases,server}` | Pass, exit 0 each (audit and docgen ok) |
| Boundary: law-practice | `rg -n '@beep/law-practice' packages/party` | No matches |
| Boundary: law-practice server | `rg --no-filename -o '@beep/party-[A-Za-z0-9_./-]+' packages/law-practice/server/src \| rg -v '^@beep/party-use-cases(/…)?$'` | No matches |
| Boundary: server manifest | `jq` over law-practice-server `dependencies` and `devDependencies` | No matches |
| Boundary: law-practice tiers | `rg -n '@beep/party-' packages/law-practice/{domain,use-cases,tables}` | No matches |
| Boundary: epistemic product | `rg -n '@beep/epistemic-' packages/party` | No matches |
| Closeout | `git show origin/main:goals/party-slice/ops/manifest.json \| jq -e '.closeout.status == .initiative.status'` | `true` |
| Reflection | `bun run beep lint reflection-artifacts` | 0 blocking, 0 advisory |

## Acceptance evidence

`bunx vitest run --reporter=verbose` in each package:

| Package | Files | Tests |
| --- | --- | --- |
| `@beep/party-domain` | 7 passed | 68 passed |
| `@beep/party-use-cases` | 1 passed | 1 passed |
| `@beep/party-server` | 11 passed | 76 passed |

- Competency tests (identity, admission, hierarchy, ledger, resolution):
  `Party.competency.test.ts` 15, `Admission.test.ts` 4, `Resolution.test.ts` 7,
  `Ledger.test.ts` 8.
- Claim binding to `makeClaimEnvelope` and the P1b factories: `Claim.test.ts` 6,
  `Factories.test.ts` 8.
- PartyKey v1 fixtures and the cross-adapter equality matrix:
  `PartyKey.test.ts` 27, `AdapterKeys.test.ts` 1.
- Ingestion adapters end to end on synthetic input: `MailRecord.test.ts` 10,
  `MailIndex.test.ts` 3, `MailCensus.test.ts` 7, `IdentityEvidence.test.ts` 20,
  `ContactEvidence.test.ts` 5, `GraphContact.test.ts` 2, `OrgEvidence.test.ts` 8,
  `ReviewLoop.test.ts` 11.
- Law-practice contact port and server boundary:
  `PartyContactSource.test.ts` 4 and `PartyContactSource.boundary.test.ts` 4, all passing.
- Rename: `packages/law-practice/domain/src/entities/LegalPartyReference/` exists;
  no `LawPractice.PartyId` importer remains, and the only `Party` schema is
  `packages/party/domain/src/values/Party/Party.model.ts`.
- Scratchpad migration: `scratchpad/party/test/` holds only
  `ReviewPageAdapter.test.ts`, as `2026-11-03-competency-migration.md` records.

## Unrelated failure, reproduced and recorded separately

`@beep/law-practice-server` does not pass `package-verify` on this `main`, and the
cause is outside this packet's scope:

- `package-verify` fails 4 of 37 integration tests, all in
  `test/integration/CitationRegexTranslator.test.ts`: a native child exits with
  code 1 (`{"outcome":"failure","phase":"program"}`).
- A verbose `vitest` run of the whole package fails 100 of 863 tests in 40 files.
  Every failing file is a `Citation*` test, and each failure starts with
  `TypeError: Bun.build is not a function` in `test/CitationNativeSpawner.fixtures.ts`.
  No non-citation test fails.
- Attribution: introduced by [#2511](https://github.com/beep-effect/beep-effect/pull/2511)
  (`96a7698b63`, merged by hand while its `Heavy / Test Integration` job was
  cancelled). It is not caused by party-slice: the party contact-port and boundary tests in
  the same package pass.
- Routed on 2026-11-06 to the orchestrator thread for the citation owner or an
  unblocker PR, and recorded as not owned in the audit checkout's inbox.
