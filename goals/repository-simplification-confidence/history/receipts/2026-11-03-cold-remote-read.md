# Cold remote-cache read with the read-only token (#1872)

UTC: `2026-11-03T05:28:50Z`. Fixture revision: `602e28d3abe9ae8ece90c2dc86722bdfef414282`
(the trusted `main` writer run 37471280558, 2026-10-06). Turbo 2.11.7. Mode: remote read only;
no remote or workstation writes.

## Credential route

- The agent service account sees one vault, `BEEP_SECRETS`. The workstation reference
  `op://BEEP_CI/BEEP_CI_TURBO_CACHE_READ_ONLY_TOKEN/password` still fails on the agent route
  (`"BEEP_CI" isn't a vault in this account`), as in `stage-5-cache.md`.
- The existing agent-visible field `op://BEEP_SECRETS/BEEP_TURBO_AWS_BASELINE/AWS_BASELINE_READ_TOKEN`
  is the approved read-only token. Its SHA-256 equals the SSM parameter
  `/beep-ci/cache/read-only-token`, which the cache authorizer checks, and differs from
  `/beep-ci/cache/trusted-write-token`. Only hash equality was compared; no value was printed.
- No operator step, copy or share was needed. The trusted-write token was never resolved for use.

## Remote hit

Clean detached checkout at `602e28d3ab`, both tasks' `dist/` removed, `.turbo/runs` cleared, an
empty private `--cache-dir`, and `TURBO_CACHE`, `TURBO_CACHE_DIR` and `BEEP_TURBO_TRUSTED_WRITER` unset:

```sh
op run --env-file=<private: TURBO_API, TURBO_TEAM, TURBO_TOKEN=<read-only op:// reference>> -- \
  node_modules/.bin/turbo run '@beep/fc-runs#build' '@beep/types#build' \
    --cache=remote:r --cache-dir=<empty> --summarize --output-logs=hash-only
```

Before the run, a credential-free `--dry=json` at the fixture computed the same hashes that the
trusted writer recorded.

| Task | Hash | Status | Source | `local` | `remote` | Restored files |
| --- | --- | --- | --- | --- | --- | --- |
| `@beep/fc-runs#build` | `0d8ccf62fa69d324` | HIT | REMOTE | false | true | 8 |
| `@beep/types#build` | `7d05d61faf1b47a2` | HIT | REMOTE | false | true | 20 |

Turbo printed `Remote caching enabled`, `2 cached, 2 total` and `FULL TURBO`. The run summary's
`scm.sha` is the fixture revision. The `remote:r` run left the empty local cache directory with
0 files.

Read-only HEAD probes ran earlier the same night (status codes only). All five 2026-10-06
candidate hashes returned 200, and the all-zero control returned 404.

### Restored output manifest (28 files; SHA-256 prefix)

```text
22d77a2c6e069728  packages/tooling/test-kit/fc-runs/dist/FastCheckRuns.d.ts
4b4396ff58aed63c  packages/tooling/test-kit/fc-runs/dist/FastCheckRuns.d.ts.map
c49bdbce2d0f2587  packages/tooling/test-kit/fc-runs/dist/FastCheckRuns.js
4cfc8d9c7b6d6785  packages/tooling/test-kit/fc-runs/dist/FastCheckRuns.js.map
c8f6e8efb75aaee3  packages/tooling/test-kit/fc-runs/dist/index.d.ts
cf71e81b73d48195  packages/tooling/test-kit/fc-runs/dist/index.d.ts.map
ce1ae19906762c74  packages/tooling/test-kit/fc-runs/dist/index.js
e0ac88b3528c5558  packages/tooling/test-kit/fc-runs/dist/index.js.map
c8b5d9823df87d2f  packages/foundation/primitive/types/dist/index.d.ts
0c2dc02a7aa8ac09  packages/foundation/primitive/types/dist/index.d.ts.map
e98240ee6e51b458  packages/foundation/primitive/types/dist/index.js
0b3951377e739f3f  packages/foundation/primitive/types/dist/index.js.map
af2074c8290b1537  packages/foundation/primitive/types/dist/TArray.types.d.ts
d4f1ef28d6736954  packages/foundation/primitive/types/dist/TArray.types.d.ts.map
98081076fd99affa  packages/foundation/primitive/types/dist/TArray.types.js
384cf5e9f5fa58a2  packages/foundation/primitive/types/dist/TArray.types.js.map
e7e74cae8fbc3d08  packages/foundation/primitive/types/dist/TString.types.d.ts
b6be06f74dfff3bf  packages/foundation/primitive/types/dist/TString.types.d.ts.map
6a90a08708abc097  packages/foundation/primitive/types/dist/TString.types.js
573cde34534ee5d6  packages/foundation/primitive/types/dist/TString.types.js.map
66ef5b290310080c  packages/foundation/primitive/types/dist/TUnsafe.types.d.ts
cf911d1c4dd6faff  packages/foundation/primitive/types/dist/TUnsafe.types.d.ts.map
f234350bb4ec9aa9  packages/foundation/primitive/types/dist/TUnsafe.types.js
6901a2a9a9c34fc5  packages/foundation/primitive/types/dist/TUnsafe.types.js.map
a8e785d89d8d9919  packages/foundation/primitive/types/dist/TUtils.types.d.ts
7b7c52c1b09964bf  packages/foundation/primitive/types/dist/TUtils.types.d.ts.map
10933b758f9f35df  packages/foundation/primitive/types/dist/TUtils.types.js
1d164e7b199fd693  packages/foundation/primitive/types/dist/TUtils.types.js.map
```

## Scope

The local, cross-checkout, linked and changed-input proofs stay in `stage-5-cache.md`; this
receipt does not restate them. No TTC reuse was claimed, no workstation remote write was enabled,
and no checkout `.env` was changed.
