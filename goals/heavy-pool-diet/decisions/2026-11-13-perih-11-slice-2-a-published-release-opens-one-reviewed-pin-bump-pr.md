---
title: "PERIH-11 slice 2: a published release opens one reviewed pin-bump PR"
date: 2026-11-13
kind: checkpoint
lane: "ci/heavy-pool-diet-pin-bump-pr"
pullRequest: 3299
reversal: "Revert this PR's squash commit; pin bumps are then hand-written again."
---

PLAN slice 7 lands PERIH-11 slice 2. When `beep-ci-binary.yml` publishes a new `beep-ci-*` release on main (the closure digest changed and the compiled bytes differ from the latest release), the same job rewrites the pin in `.github/actions/fetch-beep-ci/action.yml` and opens one pull request for review.

- The rewrite is `bun run beep ci binary-pin --tag <beep-ci-...> --sha256 <hex> [--check|--write]`, a source-CLI command beside `binary-closure` and `compile-binary`. It decodes the tag (`beep-ci-` plus 12 lowercase hex) and the digest (`@beep/schema/Sha256` `Sha256Hex`), rewrites exactly the `BEEP_CI_RELEASE_TAG` and `BEEP_CI_SHA256` values, and fails typed when the file holds none or more than one of either line. `test/ci-binary-pin.test.ts` covers the idempotent rewrite, malformed tags and digests, and missing or duplicated pin lines. It stays out of `bin-ci.ts`: the release job has the toolchain installed, and the binary surface would grow for a command no pre-toolchain job runs.
- No pull request for an unchanged closure (skip path), a byte-identical recompile (re-record path), a `verify_reproducible` dispatch or a non-default ref: the rewrite step requires the publish step's `published=true` output, `!inputs.verify_reproducible` and the default-branch ref, and the three pull-request steps require the rewrite step to have succeeded. The "Require the default branch" guard and the ref-keyed concurrency group are unchanged.
- One pin-bump pull request at a time: `peter-evans/create-pull-request` always uses the branch `ci/beep-ci-pin-bump`. A newer release force-updates that branch and refreshes the open pull request's title and body instead of opening a second one. The pull request is labelled `ready-for-heavy` and is never auto-merged.
- Credential: the knowledge-mint GitHub App (`KNOWLEDGE_MINT_APP_CLIENT_ID`, `KNOWLEDGE_MINT_APP_PRIVATE_KEY`), the same App `knowledge-baseline-mint.yml` uses to open pull requests and `catalog-regeneration.yml` and `skills-update-train.yml` use to push. Its pull requests start workflows (#3015 ran Check and Heavy), which a `github.token` pull request does not. The token is minted in the step right before the pull-request step with contents, pull-requests and issues write (issues only for the label), and only that step reads it. The job's own `permissions` did not grow. The App holds no `workflows` permission and needs none, because the pin is a composite action, not a workflow file. A fail-closed step stops the job when the App variable is missing, and the run summary always prints the four commands an agent runs to open the pull request by hand.
- `bun run beep ci binary-closure` moved from 34ec6eee1b3f to fd2f159d8fc3 on this branch, only because the workflow file is a closure input. `bin-ci.ts` and its imports are unchanged, so the first main run after merge should compile identical bytes and take the re-record path: no release and no pin-bump pull request.

Still to read on main after merge: that first run re-recording rather than publishing; the first real closure change opening one pin-bump pull request that passes its own Check; and a closure-unchanged push opening none.
