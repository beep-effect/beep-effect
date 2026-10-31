# First manual probes (2026-10-31)

Hand-run before `beep holds probe` exists, to check that each wave 1 slice
candidate has a control that still reproduces. Workstation: Bun 1.4.4,
vitest 5.0.5 (the version `bun.lock` resolves). Scratch installs went under
`~/.cache/beep/holds-probe/`.

## jsdom (`syncpack.config.ts` held group, pinned 30.0.1)

Recorded reason: jsdom 30.1.x breaks every vitest jsdom-environment file at
worker start under `--bun` with "not a valid instance of EventTarget". Last
reproduced on 30.1.3 on 2026-10-17.

| Run | jsdom | Runtime | Result |
| --- | --- | --- | --- |
| Minimal scratch project, one `@vitest-environment jsdom` test | 30.1.0 (control) | `bun --bun vitest run` | Passed, no signature |
| Minimal scratch project | latest (30.1.3) | `bun --bun vitest run` | Passed |
| Minimal scratch project | 30.0.1 (pinned) | `bun --bun vitest run` | Passed |
| This lane, root catalog bumped to 30.1.3, `@beep/brand` `beep:test` (`bunx --bun vitest run`) | 30.1.3 | Bun | 3 files, 18 tests passed |
| Same lane, `apps/oip-web` `beep:test` (environment `jsdom`) | 30.1.3 | Bun | 3 files, 58 tests passed |

The lane was restored to 30.0.1 afterwards (`git checkout package.json bun.lock`,
then `bun install`).

**Verdict by the goal's rules: `probe-broken`.** The control no longer
reproduces the recorded signature, so the probe cannot prove the hold is still
needed, and the repo suites that the hold was protecting pass on the latest
jsdom. The hold looks stale, and an unpin to 30.1.3 is the likely exit. Hosted
CI on that unpin is the proof, because the original failure may have depended
on a different Bun or vitest build.

## statelyai (root catalog exact pin `0.14.3`)

Recorded reason: 0.15.0 depends on `@statelyai/model-testing@0.2.0`, which was
never published (npm 404), so `bun install` cannot resolve.

| Run | statelyai | Result |
| --- | --- | --- |
| Scratch `bun install` | 0.15.0 (control) | Failed: `GET .../@statelyai%2fmodel-testing - 404`, `@statelyai/model-testing@0.2.0 failed to resolve` |
| Scratch `bun install` | latest (0.19.0) | Installed, 80 packages |

`npm view @statelyai/model-testing` still returns 404, and npm `latest` for
statelyai is 0.19.0.

**Verdict by the goal's rules: `candidate-passed`** (one run, so
`Unconfirmed`). The control reproduces deterministically, so this hold has a
trustworthy probe. The install-only probe says nothing about API changes
between 0.14.3 and 0.19.0. The unpin lane still has to pass the consumers'
tests.
