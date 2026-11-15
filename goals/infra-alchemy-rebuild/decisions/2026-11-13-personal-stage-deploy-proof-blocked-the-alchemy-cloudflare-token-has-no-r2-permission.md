---
title: "Personal-stage live proof of the turbo cache, after the Cloudflare token gained R2 access"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "n/a (evidence record; the stage was destroyed and verified gone)."
---

First attempt, blocked: the stack's Cloudflare token (`op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`, also the `turbo-cache-prod` secret) had no R2 permission. `GET /accounts/<id>/r2/buckets` returned `Authentication error`, and `bunx alchemy plan --stage dev_elpresidank --env-file /dev/null` loaded the S3 state and then failed in `plan.diff.resource` with `Unauthorized: Authentication error` (Cloudflare code 10000). The token had been minted 2026-10-28 for the website stack with Workers Scripts, Secrets Store, Account Settings and four zone groups, no R2 group. The lane did not widen it. With the operator's authorization the orchestrator added **Workers R2 Storage Write** to that token later the same day (secret value unchanged). **Notifications Write** was not added, so the error alert stays opt-in (no `TURBO_CACHE_ALERT_EMAIL`).

Live proof, 2026-11-13, Alchemy `2.0.0-beta.86`, from the package directory with the aws-vault session exported (`eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"`, `AWS_REGION=us-east-1`) and the Cloudflare references passed through `op run`:

1. `bunx alchemy deploy --stage dev_$USER --yes --env-file /dev/null`: `Plan: 6 to create, 1 binding changes`, `Done: 6 succeeded`, Worker at a generated `turbocache-turbocache-dev-elpresidank-<id>.beep-effect.workers.dev` URL (personal stages do not pin names).
2. `bun token.ts --stage dev_$USER --principal ci-main -- sh -c "umask 077; cat > <scratch file>"` and the same for `ci-pr`: each printed only `TURBO_API=<worker url>` and `TURBO_TEAM=beep`; each file held 64 bytes, never printed, deleted afterwards.
3. A scratch Turborepo workspace outside the repository (one `build` task writing `out.txt`, `turbo` 2.11.11, `TURBO_CACHE=local:rw,remote:rw`, a fresh `--cache-dir` per run):
   - writer, empty local cache: `build: cache miss, executing 49dec4f73680ff15`, `Cached: 0 cached, 1 total`;
   - writer, fresh local cache: `build: cache hit, replaying logs 49dec4f73680ff15`, `Cached: 1 cached, 1 total`, run summary `"source": "REMOTE"`, `out.txt` restored;
   - reader, same input, fresh local cache: `cache hit, replaying logs 49dec4f73680ff15`, `"source": "REMOTE"` (a read token restores);
   - reader, changed input: `cache miss, executing dd4f4eb1ad453041` with `WARNING failed to contact remote cache: Unknown status read_only: The credential may read this team's artifacts but not upload them.`; the same run again with a fresh local cache is still `cache miss` (the upload was refused);
   - `curl -X PUT` of an artifact with the reader token: `403`, body `{"error":{"code":"read_only",...}}`; anonymous `GET /v8/artifacts/status?slug=beep`: `401`.
4. `bunx alchemy destroy --stage dev_$USER --yes --env-file /dev/null` first failed on the bucket with `BucketNotEmpty` (the writer's one artifact); Alchemy's `R2.Bucket` has no empty-on-delete option in beta.86. The one object in the dev bucket was deleted through the R2 objects API (name guarded to the `-dev-elpresidank-` bucket), then destroy reported `Done: 1 succeeded`. Verified gone: the account's R2 bucket list is `["beep-turbo-r2-pilot"]` only (the pilot, untouched), no Worker script named `turbocache*`, the Worker URL answers 404.

The hermetic equivalents run in CI: `bun run test:integration` in the package (workerd and a local R2 bucket, in-memory state, 4 tests).
