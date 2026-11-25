# P4 after the main merges: cache review

P4 (text-knowledge-stack-rebuild claims) merges the P3 head, `c402896ccd5` and `origin/main`.
`bun run beep cache audit` then reports nine blocking `configuration-drift` findings and one
`configuration-source-drift: turbo.json` review finding. Each input change is listed below.

- `@beep/epistemics#build`, `#check`, `#lint:deprecated-apis` and `#test`: the package manifest
  gains `@beep/annotation` and `@beep/rdf` dependencies and the `@beep/test-utils` dev dependency.
  It drops the deleted `./EvidenceSpan` export, and its source moves to the P4 claim modules.
- `@beep/party-server#build`, `#check`, `#lint:deprecated-apis` and `#test`: the package manifest
  gains `@beep/jsonc` and `@beep/text` dependencies for the claim-core ledger.
- `//#lint:policy-fingerprint`: the regenerated root task projection in `turbo.json` adds the
  `@beep/text` source glob and the new P4 epistemics, schema, text and repo-cli claim source
  files to the policy-fingerprint inputs. That is also the `turbo.json` source drift.

No command, cache flag, output or environment changed, and no cache qualification is granted.
The three subjects are re-recorded under the checkout's Bun 1.4.5 profile.
