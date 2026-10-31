# Foundation cache input review

Basis: delivery checkout, base `cb0a51ef298c62f06da66a53eee89ffae79978aa`, foundation commit `1ed9704cc6` plus canonical policy-fingerprint regeneration. The audit reports six blocking task configurations in two subjects, and a review-only turbo source change.

| Subject/task | Changed input and reason |
| --- | --- |
| `//#lint:policy-fingerprint` | The CLI dependency closure now includes `@beep/jsonl` through ai-metrics. The canonical fingerprint writer adds only the jsonl manifest and source glob to its fingerprint and the matching Turbo inputs. |
| `@beep/repo-ai-metrics#build` | Manifest dependencies add the reused JSONL reader and protobuf wire encoder; platform-node moves from dev to runtime because the worker uses Node services. Build command and output contract are unchanged. |
| `@beep/repo-ai-metrics#check` | Same manifest changes plus development dependencies on ai-provider-cli, platform-bun and sql-sqlite-bun for synthetic harness and SQLite/process proofs. Check scripts are unchanged. |
| `@beep/repo-ai-metrics#lint:deprecated-apis` | The same dependency manifest participates in task identity; command and policy are unchanged. |
| `@beep/repo-ai-metrics#test` | The same manifest adds required synthetic integration providers. Test command is unchanged; source test additions do not grant cache qualification. |
| `@beep/repo-ai-metrics#test:property` | The same manifest is an input; property test alias remains unchanged. |

The permitted request names only `//` and `@beep/repo-ai-metrics`. Preserve baseline scope, profile, epoch and every existing qualification posture. No new qualification, exception, task, output exclusion or debt row is authorized by this review. This acknowledges changed configuration bytes; it is not a passing test receipt. Reverse by restoring the old manifest and generated fingerprint inputs together, then reviewing that reverted configuration.

Exact input hashes:

| File | Base SHA-256 | Reviewed SHA-256 |
| --- | --- | --- |
| `packages/tooling/library/ai-metrics/package.json` | `7d7c2ddda09c1759e708ad4b684eee9c7484996fcf26999b695533ee71ae6614` | `2771e64c027fee88d87effbd6a1dcfebbaa8bf890a661b7232c46d3cc9b82e99` |
| `standards/policy-tools.fingerprint.json` | `7416e97c11d8f08e779c0d53f3e4320b3c00fbe782d5fc465292087155abf3c7` | `ef4954f389e01fca4a0531b4f7fcee8c02a2cf35b7d7bee782cc4d0d39a9555e` |
| `turbo.json` | `e1fdc840e70992359d20318b3841fb0c0bcbd18802ad76bf5879c45ebcfcb8cf` | `61c1cb309c83a1b2f74f3967d6921409380691d50eb3fbb9bcf619034770010a` |

Independent Astra panel review accepted this basis on 2026-10-29: all three base/current hash pairs and six named drift tasks match; scripts, outputs and cache flags are unchanged. This is pre-write review only. The generated request and resulting baseline still require exact scope/posture verification and a fresh audit.
