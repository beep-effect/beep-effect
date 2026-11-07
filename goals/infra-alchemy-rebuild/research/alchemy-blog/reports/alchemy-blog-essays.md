# Alchemy blog essays — capability catalog

Catalog of five official Alchemy essays. Every claim below is taken from the named post (or from a GitHub URL that post itself links). Neighboring titles in each page footer are navigation chrome only; their bodies were not fetched and are not treated as features of these essays.

Sources:

- [Benchmarking Cloudflare Containers vs AWS MicroVMs](https://alchemy.run/blog/2026-07-01-microvm-cold-starts/) (2026-07-01)
- [Looping the Generation of IaC and SDKs](https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/) (2026-07-02)
- [A Test Runner for Agents](https://alchemy.run/blog/2026-07-22-a-test-runner-for-agents/) (2026-07-22)
- [Optimizing Alchemy's CI Workflows](https://alchemy.run/blog/2026-09-24-optimizing-ci/) (2026-09-24)
- [Hillclimbing distilled](https://alchemy.run/blog/2026-10-24-optimizing-distilled/) (2026-10-24)

Empty catalog cells mean the essay does not mention that kind of thing. They are not evidence that Alchemy lacks it.

## 1. Per-post catalog

### 2026-07-01 — Benchmarking Cloudflare Containers vs AWS MicroVMs

Source: <https://alchemy.run/blog/2026-07-01-microvm-cold-starts/>

| Field | What the post says |
| --- | --- |
| Date | 2026-07-01 (`datetime="2026-07-01T00:00:00.000Z"`). |
| Version | Not named. Footer chrome links a 2026-06-27 post titled "2.0.0-beta.59 - One Namespace, One Binding" and the 2026-07-02 essay. Those titles are not this essay's release. |
| New or changed resources | `AWS.Lambda.MicrovmImage` subclass (`EffectfulBun`), built with `EffectfulBun.make({ main, runtime: "bun" }, program)`. `Cloudflare.Container` wrapping the same Effect program. `Cloudflare.Worker("MicrovmBenchWorker", …)`. Image base `public.ecr.aws/lambda/microvms:al2023-minimal`. Cloudflare side also uses a plain `oven/bun` image and a public Docker Hub echo image. |
| Provider package | Not named as an npm package. APIs shown are `AWS.Lambda.*` and `Cloudflare.Worker` / `Cloudflare.Container`. Benchmark app: <https://github.com/alchemy-run/alchemy/tree/main/benchmark/container>. |
| CLI command | `bun bench` reruns the benchmark from the repo. |
| State store | Not discussed. |
| Testing feature | 700 cold boots, 16 variants. Hosts expose `/boot` and return `readyMs`. One untimed warm-up boot. MicroVM samples are sequential launch → ready → terminate. Containers: 10 rounds × 10 simultaneous boots. Opencode readiness is health `{"healthy":true}` plus `POST /session`. Results are CSV rows; plots are generated from them. Full matrix (Python image, Node baselines, remaining Worker-driven rows) is in the benchmark directory, not inlined. |
| Effect concept | Bindings. `AWS.Lambda.RunMicrovm(EffectfulBun)`, `AWS.Lambda.CreateAuthToken(EffectfulBun)`, `AWS.Lambda.TerminateMicrovm(EffectfulBun)`, `AWS.Lambda.connectMicrovm(EffectfulBun, { endpoint, authToken })`. Binding the image exposes `hello` as a typed method; RPC, auth headers, and serialization are generated. The class is both the image declaration and the typed client. Same Effect program deploys as a Container or a MicroVM; the same binding call works from a Lambda or a Worker. Sinks, phases, telemetry, and resource references are not discussed. |
| Breaking change | None stated. |
| Migration note | None stated. Desired follow-on, not shipped here: OIDC from the Worker straight into the Role, so the long-lived key can go away. |
| Tips and tricks | Snapshot restore is what building a MicroVM image means; it is not a separate setting. AWS runs the entrypoint, waits for init, then Firecracker-snapshots memory and disk, so startup is paid at build time and boot time is about 2–4.5s regardless of workload ([AWS launch post](https://aws.amazon.com/blogs/aws/run-isolated-sandboxes-with-full-lifecycle-control-aws-lambda-introduces-microvms/), linked from the essay). `RunMicrovm` quota is 5 TPS with a burst of 5 ([Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html#microvms-quotas)); launching 5 at once mixed throttling into boot time and invented a 1–2s tail. The 5 TPS cap is a soft quota, raised on request, not a capacity ceiling. Opencode container used Cloudflare `standard-1` (4 GiB) against the MicroVM's 1 GiB, so the gap is the snapshot, not starvation. On a Lambda host the binding adds `lambda:RunMicrovm` for that image ARN to the execution role and uses the role credentials already in the environment. On a Worker it creates, once per Worker: an IAM User whose only permission is `sts:AssumeRole`, an AccessKey bound as a Worker secret, and an IAM Role that trusts only that user and accumulates the MicroVM permissions. Runtime does one `AssumeRole`; session credentials are cached, refreshed near expiry, and shared across every binding on the Worker (once per isolate, not once per request). Worker → MicroVM was within noise of Lambda → MicroVM. Effect-on-Bun cost on AWS was 0.2s at the median (2.9s vs 2.7s); the Node pair was a rounding error at the median. The Effect image on Cloudflare cost nothing measurable. A Durable Object can sit in front of all container network traffic and inject API credentials into outbound requests so code inside the container never sees the key. |

Measured boots (the essay's tables):

| Variant | p50 | p95 | max |
| --- | ---: | ---: | ---: |
| Cloudflare Container — opencode, via Worker | 10.5s | 15.6s | 58.6s |
| AWS MicroVM — opencode, via Lambda | 3.4s | 4.1s | 4.5s |
| AWS MicroVM — opencode, via Worker | 3.6s | 4.0s | 4.2s |
| Cloudflare Container — hello world, via Worker | 1.7s | 23.9s | 47.3s |
| AWS MicroVM — hello world, via Lambda | 2.7s | 3.2s | 3.7s |
| AWS MicroVM — hello world, via Worker | 3.1s | 3.8s | 5.4s |
| Cloudflare Container, plain Bun | 1.7s | 23.9s | 47.3s |
| Cloudflare Container, Effect image | 2.3s | 24.0s | 46.7s |
| Cloudflare Container, public echo image | 2.6s | 24.4s | 26.1s |
| AWS MicroVM, plain Bun | 2.7s | 3.2s | 3.7s |
| AWS MicroVM, Effect image, Bun | 2.9s | 4.4s | 4.8s |
| AWS MicroVM, Effect image, Node | 3.2s | 3.7s | 16.6s |
| AWS MicroVM booted from a Cloudflare Worker | 2.7s | 3.7s | 4.1s |

Qualifications the essay itself makes: not one of 49 successful opencode MicroVM boots exceeded 4.5s; the Node Effect-image row still has a 16.6s max. Fastest opencode container was 4.4s and about two-thirds exceeded 10s. Hello-world containers: about one boot in ten over 10s, worst near 50s. CDF: 73–90% of container boots finish by 3s; the remaining 10–27% can take 10s or much longer. Containers can win the median for tiny images. MicroVMs win the tail, and the median once startup matters. Workload was [opencode](https://opencode.ai), about 100 MB.

Binding shape the essay shows (Worker host, no AWS config in the file):

```ts
const run = yield* AWS.Lambda.RunMicrovm(EffectfulBun);
const auth = yield* AWS.Lambda.CreateAuthToken(EffectfulBun);
const terminate = yield* AWS.Lambda.TerminateMicrovm(EffectfulBun);
const vm = yield* run({});
const { authToken } = yield* auth({
  microvmIdentifier: vm.microvmId,
  expirationInMinutes: 5,
  allowedPorts: [{ port: 8080 }],
});
const sandbox = yield* AWS.Lambda.connectMicrovm(EffectfulBun, {
  endpoint: vm.endpoint,
  authToken,
});
const greeting = yield* sandbox.hello("bench");
yield* terminate({ microvmIdentifier: vm.microvmId });
```

Image class:

```ts
export class EffectfulBun extends AWS.Lambda.MicrovmImage<
  EffectfulBun,
  { hello: (message: string) => Effect.Effect<string> }
>()("MicrovmEffectfulBun") {}

export default EffectfulBun.make(
  { main: import.meta.filename, runtime: "bun" },
  Effect.gen(function* () {
    return {
      fetch: Effect.succeed(HttpServerResponse.text("ok")),
      hello: (message) => Effect.succeed(`hello, ${message}!`),
    };
  }),
);
```

### 2026-07-02 — Looping the Generation of IaC and SDKs

Source: <https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/>

| Field | What the post says |
| --- | --- |
| Date | 2026-07-02. |
| Version | Shipped in [2.0.0-beta.56](https://alchemy.run/blog/2026-06-17-beta-56). The patch-corpus counts are "by beta.56". The beta.56 post body was not fetched. |
| New or changed resources | Cloudflare provider grew from 22 resources to 230 between 2026-06-11 and 2026-06-17. The essay's worked examples are Turnstile `getWidget` and R2 `listBucketDomainCustoms`. It does not list the other 228 resource names. Most of the wave landed in [PR #601](https://github.com/alchemy-run/alchemy/pull/601): 101,178 lines, 542 files, open 22 hours. PR description, in full: "Using Fable to generate all missing cloudflare resources". |
| Provider package | Alchemy resources sit on [distilled](https://github.com/alchemy-run/distilled), an Effect-native SDK generated from Cloudflare's official TypeScript SDK. At this date: 114 services, 2,092 operations. Patch files live at `submodules/distilled/packages/cloudflare/patches/<service>/<operation>.json`. Provider reference linked: <https://alchemy.run/providers/cloudflare> (page not fetched). |
| CLI command | `bun scripts/generate.ts --service turnstile` regenerates one service after a patch. |
| State store | Not discussed. |
| Testing feature | 288 test files, roughly 700 tests, from that one run. Each test deploys, verifies out of band by querying the API through distilled (never trusts the deploy's own success report), mutates, verifies again, destroys, and proves the resource disappeared. The loop continues through reconcile, read, diff, delete, and list until the resource passes against the live API. Vitest resolves distilled from TypeScript source, so a regenerated service is visible on the next run without a compile step. Cycle time is the test's runtime. |
| Effect concept | Typed lifecycle errors. `Effect.catchTag("WidgetNotFound", …)` for an idempotent delete (already-gone read returns `undefined`). `Effect.retry` with `while: (e) => e._tag === "NoSuchBucket"` and `Schedule.exponential("100 millis")` combined with `Schedule.recurs(5)` for R2's lag after a fresh bucket create. Rule: an unmatched error is never caught inside resource code; it becomes an SDK patch and a regeneration, because the resource does not typecheck until the SDK names the error. Sinks, phases, telemetry, bindings, and resource references are not discussed. "Reconcile, read, diff, delete, and list" are the lifecycle steps the tests walk, not an Effect phase API. |
| Breaking change | None stated. |
| Migration note | None stated. Patches live in distilled, not Alchemy, so other distilled Turnstile callers get `WidgetNotFound` too. |
| Tips and tricks | Do not match message substrings or guess status codes inside resource code; that is where generated code usually goes wrong. Deletes tolerate already-gone. Creates absorb losing a race. Reads ride out eventual consistency. Spec drift the live tests caught: Turnstile `getWidget` returns code `10404` (and the patch also maps `10407`) which the spec does not declare; `Forbidden` is HTTP 403. Snippets returns 400 rather than 404 for a missing snippet, so that matcher reads the message. Queues consumers accept `http_pull`, absent from the spec enum. Account settings come back null where the schema says they cannot. About twelve agents ran at once, one distilled service each; only the `turnstile` owner writes `patches/turnstile/`, so agents do not race the generator. Distilled is a git submodule inside Alchemy's Bun workspace: one working tree patches the SDK and the resource; a wave lands as two PRs (Alchemy and distilled). |

Patch corpus by beta.56: 1,087 patched operations, 52% of the SDK, 94 of 114 services.

| Patch detail | Count |
| --- | ---: |
| Patches declaring typed errors | 1,070 |
| Patches fixing a response schema | 173 |
| Patches fixing a request schema | 26 |
| Distinct error tags introduced | 425 |
| Matchers on Cloudflare error `code` | 1,367 |
| Matchers on HTTP `status` | 994 |
| Matchers needing `message.includes` | 377 |
| Matchers needing a regex | 0 |

Lifecycle tags named: `Forbidden`, `WorkerNotFound`, `NoSuchBucket`, `WidgetNotFound`. After regeneration: `export type GetWidgetError = DefaultErrors | WidgetNotFound | Forbidden`.

Turnstile patch the essay shows (`submodules/distilled/packages/cloudflare/patches/turnstile/getWidget.json`):

```json
{
  "errors": {
    "WidgetNotFound": [{ "code": 10404 }, { "code": 10407 }],
    "Forbidden": [{ "status": 403 }]
  }
}
```

What is next, as of this essay only: scale the loop to every provider; goals are 100% IaC coverage and SDK types that match real API behavior. Order stated: AWS, then Railway, then GCP, then Azure. This essay does not claim that AWS coverage has shipped.

### 2026-07-22 — A Test Runner for Agents

Source: <https://alchemy.run/blog/2026-07-22-a-test-runner-for-agents/>

| Field | What the post says |
| --- | --- |
| Date | 2026-07-22. |
| Version | Not named. Footer chrome links "2.0.0-beta.65 - SageMaker HyperPod" (2026-07-27) and "2.0.0-beta.64 - Full AWS Coverage" (2026-07-22). Those bodies were not fetched. Same-day title "Full AWS Coverage" is not evidence, from this essay, of which AWS resources exist. |
| New or changed resources | None. Test files named only as runner examples: `Subdomain.test.ts`, `Rpc.test.ts`, `Route.test.ts`, `Workflow.test.ts`, `CronEventSource.test.ts`, `AccountSetting.test.ts`, `DurableObjectNamespace.test.ts`, `HttpApi.test.ts`, `WaitUntil.test.ts`, `Worker.test.ts`, all under `test/Cloudflare/Workers`. Slow-test examples, not resources introduced here: provisioning an EKS cluster, waiting on an eventually consistent API, pushing a queue message and polling until it comes out. |
| Provider package | Runner package [alchemy-test](https://github.com/alchemy-run/alchemy/tree/main/packages/alchemy-test), [PR #848](https://github.com/alchemy-run/alchemy/pull/848). It exists to test resources built on [distilled](https://github.com/alchemy-run/distilled) (described here as the generated AWS and Cloudflare SDK, hundreds of service modules). |
| CLI command | `bun run test test/Cloudflare/Workers -t "cron"`. Also `--concurrency` (bounds files in flight) and `--tui`. Vitest-style positional paths, `-t` name filters, timeouts, retries. A test opts into a whole-process lock with `{ exclusive: true }`. |
| State store | Not discussed. |
| Testing feature | This is the testing essay. Suite is 4,000+ live tests that create and destroy real cloud resources. `alchemy-test` imports every test file once, then runs files and tests concurrently as Effect fibers in one Bun process (not forks). Each test gets a buffering `Logger` and `Console`; logs are attributed by construction and do not interleave. Console prints one line per test; failures inline the error and captured output while the run continues; passes stay silent. If nothing finishes for 10 seconds, it prints a timestamp and the still-running tests with elapsed times. End of run repeats failures and points at a per-run log: `.alchemy/log/test/<timestamp>-pid<pid>.log`, with line count and size. The sample is `.alchemy/log/test/2026-07-16T23-42-38-pid92186.log` (1,055 lines, 118 KB) for "1 failed \| 171 passed \| 1 skipped (31 files, 89.3s)". The log is color-free, includes passing tests' captured output, is written as the run proceeds, and is unique per run so two terminals do not clobber each other. `--tui` is a k9s-style tree: collapsible files and tests, type-to-filter, live tail on Enter (including a deploy three minutes into `beforeAll`). Hotkeys: `j`/`k`, `ctrl-d`/`ctrl-u`, `/` filter, `p`/`f`/`n`/`s` toggle passing/failing/pending/skipped, `r` retry selected test or file, `R` retry all failures, `x` kill a running test, `y` copy the failure plus captured output to the clipboard. Sample TUI: 159 passed, 0 failed, 7 running, 5 pending, at 53.4s. Implementation: a harness, a scheduler, and two reporters over an event stream. It only targets Effect. Migration off Vitest was a codemod because the CLI matches. |
| Effect concept | Fibers on the Effect runtime instead of worker forks. Buffering `Logger` and `Console` services so log attribution is exact. Sinks, phases, bindings, telemetry, and resource references are not discussed. |
| Breaking change | None stated for Alchemy users. Internally they left Vitest. |
| Migration note | Vitest-compatible CLI, so the switch was a codemod. Reasons Vitest did not fit: workers do not share a module graph, so distilled's hundreds of service modules reload per worker; `singleFork` plus `isolate: false` forces sequential tests and Vite still reevaluates source per test ([Vitest `singleFork` docs](https://vitest.dev/config/#pooloptions-forks-singlefork)); Bun `worker_threads` segfault under Vitest's tinypool, which pinned them to `pool: "forks"`; Node would still pay per-worker imports and cannot run distilled's TypeScript natively. Loading distilled TS in Vitest needed a Rolldown plugin or a `.ts` → `.js` compile before every run. `bun test` loads TypeScript natively but runs files one at a time; a directory that should take two minutes in parallel would take about an hour sequentially. |
| Tips and tricks | Do not `tail` a parallel run to save context; agents did that and lost the one error that mattered. Read the one-line summary, then grep the timestamped log (its size is printed so the agent knows whether to read or search). Own the runner if agents misread output: change the output, do not wait on a plugin API. `{ exclusive: true }` for tests that mutate global state. `--concurrency` is the knob for how many files run at once. The runner feeds the agent fleet described in the [2026-07-02 essay](https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/). |

Illustrated failure (so the output contract is concrete): `Route.test.ts` expected `alchemy-test-2.us/v2/*`, got `alchemy-test-2.us/api/*`, at `test/Cloudflare/Workers/Route.test.ts:87:22`, with captured lines "Plan: 1 to replace", "[route] deleting", "[route] created". Other timings in the sample: workers.dev subdomain 3.2s, RPC envelope 1ms, workflow completion 51.9s, Durable Object websocket-hibernation still running at 12.3s, `HttpApi` `afterAll` still running at 18.6s, `WaitUntil` waiting for a worker slot.

### 2026-09-24 — Optimizing Alchemy's CI Workflows

Source: <https://alchemy.run/blog/2026-09-24-optimizing-ci/>

| Field | What the post says |
| --- | --- |
| Date | 2026-09-24, 16:00 UTC. |
| Version | Not named. Footer chrome links "2.0.0-beta.80 - GCP, Neon & Secret Providers" (2026-09-29) and "2.0.0-beta.78 - Git Hosting, Stripe & Worker Previews" (2026-09-17). Bodies not fetched. |
| New or changed resources | No cloud resource API. Repo shape: almost 100 packages, 86 of them distilled SDKs ([distilled.cloud](https://distilled.cloud)), plus a docs site. Workflows: routine checks, preview-package publishing, tests for a local Cloudflare runtime, and npm releases. |
| Provider package | `@alchemy.run/pkg` ([PR #1516](https://github.com/alchemy-run/alchemy/pull/1516)), their pkg.pr.new-style publisher, hosted on Cloudflare using Alchemy. Not described as a general provider others install. |
| CLI command | `pnpm publish` in the GitHub-hosted publish job. No Alchemy CLI flag in this essay. |
| State store | Not discussed. |
| Testing feature | `cloudflare-tools` tests used to run on every PR; [PR #1362](https://github.com/alchemy-run/alchemy/pull/1362) scopes them to PRs that change the related packages. Same PR cancels older runs in the same concurrency group when a new push arrives. A bug that deleted stable preview Workers was fixed, so wiping the test account no longer forces a full asset upload. |
| Effect concept | Not discussed. The only Effect-adjacent fact is operational: Bun later than `1.3.13` has an `AsyncLocalStorage` bug that breaks their test runner ([oven-sh/bun#32693](https://github.com/oven-sh/bun/issues/32693)); the fix was still open, so the runtime pin stays at 1.3.13. |
| Breaking change | None stated for Alchemy users. |
| Migration note | Alchemy's own repo moved the package manager from Bun to pnpm ([PR #1214](https://github.com/alchemy-run/alchemy/pull/1214)). Bun stays the runtime. This is their monorepo's migration, not a user migration guide. |
| Tips and tricks | Blacksmith runners ([PR #1162](https://github.com/alchemy-run/alchemy/pull/1162), [blacksmith.sh](https://blacksmith.sh/?ref=alchemy.run)): `check` 7.8 → 4.8 min (−38%), `cloudflare-tools` 16.2 → 5.3 min (−67%), `pr-package` 5.0 → 3.2 min (−36%). Those figures are a short window of runs immediately after the switch; later CI work ate the comparison set. Sample release workflow: build on `blacksmith-8vcpu-ubuntu-2404` (build, pack, upload tarballs); publish on `ubuntu-latest` with `permissions: id-token: write` and `pnpm publish`. npm trusted publishing, at the time of writing, only allows GitHub-hosted runners, GitLab.com, and CircleCI cloud ([npm docs](https://docs.npmjs.com/trusted-publishers/), [their note on the gap](https://x.com/samgoodwin89/status/2085278917825552412)), so the split is required. All other CI is on Blacksmith, including Linux, macOS, and Windows, which let them stop splitting workloads to survive slow GitHub runners. Bun package-manager failures they list: lockfile drift when `package.json` deps are edited by hand; random CI install failures; publishing breaks with `workspace:` and `catalog:`; `publishConfig` overrides ignored; no dedupe until Bun 1.4; tarball-URL deps do not dedupe, which is why they needed `pkg.alchemy.run`. Docs: Astro 7.2 experimental incremental builds ([announcement](https://astro.build/blog/astro-720/), [flag docs](https://docs.astro.build/en/reference/experimental-flags/incremental-build/)), Starlight patched to support them, cache persisted across CI ([PR #1128](https://github.com/alchemy-run/alchemy/pull/1128), [PR #1136](https://github.com/alchemy-run/alchemy/pull/1136)). Bigger win: one docs page per service instead of one per resource ([PR #1767](https://github.com/alchemy-run/alchemy/pull/1767), [PR #1774](https://github.com/alchemy-run/alchemy/pull/1774)). PR website previews used to be a new Worker each time; they are now versions of one stable preview Worker so assets already uploaded from `main` are reused ([PR #1267](https://github.com/alchemy-run/alchemy/pull/1267)). PR deploys still require the `deploy-website` tag and do not work on fork PRs yet. `@alchemy.run/pkg` (like [pkg.pr.new](https://github.com/stackblitz-labs/pkg.pr.new), which they outgrew): fork PRs publish with no secrets because each publish is verified against the GitHub Actions run that built it ([PR #1681](https://github.com/alchemy-run/alchemy/pull/1681)); previews can publish only affected packages ([PR #1727](https://github.com/alchemy-run/alchemy/pull/1727)); previews stay up while the PR is open ([PR #1511](https://github.com/alchemy-run/alchemy/pull/1511)). |

Docs-site numbers:

| Measure | Before | After |
| --- | ---: | ---: |
| Reference pages | 4,368 | 406 |
| Cold build | 162 s | 39 s |
| Output size | 3.64 GB | 438 MB |
| Website CI run, median | 8.0 min | 4.1 min |

The old site had 4k+ pages, each with an OG image, and a full build-and-deploy could take up to 25 minutes. Warm incremental builds restore most pages and almost all OG images.

### 2026-10-24 — Hillclimbing distilled

Source: <https://alchemy.run/blog/2026-10-24-optimizing-distilled/>

| Field | What the post says |
| --- | --- |
| Date | 2026-10-24, 16:00 UTC. |
| Version | Breaking changes shipped in `@distilled.cloud/*` `1.0.0-rc.16`. Chart annotations also name `1.0.0-rc.13` (commit "chore(release): 1.0.0-rc.13") and an Effect bump to `4.0.0-rc.117` ([distilled PR context in the chart: upgrade Effect, #637](https://alchemy.run/blog/2026-10-24-optimizing-distilled/)). Footer chrome links "2.0.0-beta.85 - Effect 4.1, Domain Replay & DynamoDB State" (2026-11-01) and "2.0.0-beta.84 - Monorepo, Domain & Faster Distilled" (2026-10-22). Those bodies were not fetched. The DynamoDB-state title is not a description of a state store. |
| New or changed resources | No Alchemy resource API. Distilled covers 88 providers. Chart commit titles (annotations on the benchmark graphs, not a resource list): Notion SDK added ([#855](https://alchemy.run/blog/2026-10-24-optimizing-distilled/)); `feat(aws/auto-scaling): type InvalidIamInstanceProfile on create/updateAutoScalingGroup` ([#764](https://alchemy.run/blog/2026-10-24-optimizing-distilled/)); GCP HTTP 501 on Agent Engine sandboxes and `workerPools.list` ([#656](https://alchemy.run/blog/2026-10-24-optimizing-distilled/)); Workers preview conflict and Deadline `UpdateQueue` conflict ([#683](https://alchemy.run/blog/2026-10-24-optimizing-distilled/)). Those are error-typing commits visible on the chart, not evidence of an EC2 autoscaling-group resource or a runner fleet. |
| Provider package | `@distilled.cloud/*` at `1.0.0-rc.16`. New or called out: `@distilled.cloud/core/schema-lite` (`Struct`, `Array`, `optional`, `Union`, `suspend`, and the rest of the dozen node kinds generated code already calls); `@distilled.cloud/aws4signer` (SigV4 extracted so Cloudflare R2 signing does not pull the rest of the AWS SDK); `@distilled.cloud/core` replacements for a few `effect/Config`, `Schedule`, and `Stream.flatMap` uses. Generated files switched `import * as S from "@distilled.cloud/core/schema"` to `@distilled.cloud/core/schema-lite`. `lib/` is bundled, minified, generated output. Lazy loading uses `../_bundle/lazy.js` plus `services.full/<service>.js` and the `distilled-lazy` export condition. |
| CLI command | `pnpm bench -- --experiment "schema-free generated code"` names an experiment run (off the commit timeline, drawn as a flat dashed line). Alchemy CLI: `alchemy deploy --fast-distilled`, or `ALCHEMY_FAST_DISTILLED=1`. The flag selects the `distilled-lazy` condition. It applies under Node. Under Bun it does nothing. Equivalent manual form: `node --conditions=distilled-lazy`. Alchemy's CLI leaves meta tree shaking off by default. |
| State store | Not discussed. |
| Testing feature | Benchmark: 98 programs (one credentials layer plus one operation, every SDK and every wire protocol), medians, each measure in normal mode and strict response-validation mode. Effect `HttpClient` is replaced with a fake that returns a canned `Response` immediately, so cloud RTT is not in the number. Dashboard in the distilled repo, one point per commit; benchmarks also run on distilled PRs. 123 commits, 84 benchmark runs, 38 of them experiments. Experiments tried: lazy error classes, splitting SDKs into a few files, rewriting the AWS call path, Node-only service stubs, replacing Effect Schema. Schema bake-off used Stripe shapes after dedupe, plus real shapes from EC2, S3, DynamoDB, Stripe, and Cloudflare Workers. SigV4 checked 33,798 cases across 24 AWS services; requests and results matched. schema-lite checked by encoding 1,516 requests and decoding 426 responses through both implementations; bytes matched. A test checks the strict validator accepts and rejects the same values as Effect Schema. Shipped sources are Latin-1 only, enforced by a test. Cold-start numbers (import + client setup + first call, fresh process) come from a separate local harness that is not part of the benchmark suite yet. |
| Effect concept | Bindings: a binding makes HTTP calls through distilled, so every Worker or Lambda with a binding bundles distilled. Services: `HttpClient.HttpClient` swapped via `Layer.succeed`; `Protocol`; a replaceable `Crypto` service (sync `node:crypto` where Node exists, WebCrypto otherwise, or your own). `ConfigProvider` and `Schedule` supplied by the user still work after the core replacements. Strict mode: `program.pipe(Effect.provide(ResponseValidation.strict))`. A typed `ParseError` carries the path of the bad field. `ParseError.cause` is a `SchemaMismatch` with a path (breaking change). `Effect.catchTag`, `_tag`, `instanceof`, and the TypeScript error unions still work. Telemetry: about 0.9 ms of distilled's ~1.5 ms slower first Cloudflare call, versus the official SDK's thin `fetch` wrapper, is the tracing span Effect opens on every request. Call path used to be an `Effect.gen` with a `yield*` per step (protocol, client, encode, execute, decode), encode and decode themselves generators; now the first call compiles a schema plan and later calls build and decode the request in plain JavaScript, leaving the HTTP request as the only effect. Schema references: partition refinement (Moore) so recursive shapes dedupe; `suspend` remains; a recursive shape is a named reference to another generated shape. Effect Schema's ahead-of-time compiler could not compile through recursive shapes and emitted 4.6 MB of code for EC2; JIT mode doubled first-use memory. Sinks and phases are not discussed. Resource references (Alchemy `Ref`-style) are not discussed. |
| Breaking change | In `@distilled.cloud/*` `1.0.0-rc.16`: (1) schema values are no longer exported — use `op.input` and `op.output`; (2) error constructors no longer validate their fields — `ParseError.cause` is a `SchemaMismatch` with a path; (3) `SigV4.SigningKeyCache` is now a plain store; (4) `lib/` is bundled, minified, generated output. |
| Migration note | Generated code changed one import, to `@distilled.cloud/core/schema-lite`. Protocols (REST and AWS's six wire protocols) still walk `_tag`, `propertySignatures`, and `annotations`; lite nodes have those fields, plus an `encoding` field of the same shape Effect uses for timestamps and base64. `instanceof`, `_tag`, `Effect.catchTag`, and the TypeScript error types are unchanged. Meta tree shaking is opt-in and a no-op under Bun. An earlier descriptor-only attempt, [distilled PR #671](https://github.com/alchemy-run/distilled/pull/671), could not validate responses and broke strict mode; it was not the thing that shipped. The only way they see to get AWS import memory under the remaining ~10 MB is to export fewer names, which they call an API change they have not made. |
| Tips and tricks | Do not import from the `effect` barrel in Node. `import { Effect, Predicate } from "effect"` loaded every Effect module: 3.3 MB and 36 ms on every SDK import. Import `effect/Effect` and `effect/Predicate`. The Effect language service has `importFromBarrel`; generated code does not run it. One `/*@__PURE__*/` does not cover calls in its arguments; the generator now marks nested calls too. That dropped an EC2 `describeRegions` bundle from 137 KB to 75 KB (it had been keeping 1,695 schemas). Rolldown 1.2.5 and 1.2.6 failed to drop a rarely used Effect Schema class in `HttpClient`, leaving ~15 KB gzip in every HTTP program; 1.2.7 fixed it; the chart's cliff is the move through Rolldown 1.2.8, after which they dropped their own `HttpClientErrorSchema` patch. One character outside Latin-1 makes V8 store the whole module as two bytes per character. Escaping three characters in S3 cut that module from 2,240 KB to 1,570 KB. Stripe named shapes 12,529 → 2,720; import memory 9.9 MB → 0.86 MB. Sync `node:crypto` signing: S3 `listBuckets` 352 µs → 149 µs, DynamoDB `listTables` 218 → 103, STS `getCallerIdentity` 282 → 125; then prepare keys once and skip URL parsing on the canonical request, and S3 `listBuckets` is 19.4 µs. Sync hashing blocks the event loop for a few microseconds; a huge request body is where that starts to matter, which is why `Crypto` is swappable. Effect Schema was ~37 KB gzip in every bundle even when validation was off, and built thousands of schema objects at import. General schema libraries lost their bake-off because distilled does not need transformations, refinements, defaults, branding, async checks, unrestricted self-reference, or rich error reports. Strict mode's compiler loads only if strict mode is on; each lite node compiles once into a checker. Official SDKs do not check responses; the essay's reason to keep strict mode is providers changing APIs without warning ("cough Cloudflare cough"): the HTTP call still succeeds and bad data lands far from the cause. Meta tree shaking: operations (and error classes) are built on first call; descriptions are data, not code; the loader is an interpreter over schema-lite. It does not `eval` or `new Function`, and V8 does not compile bytes read from disk. Stubs load only under the `distilled-lazy` condition; bundlers and ordinary Node resolution still get the full module. Fly.io `machines` stub is the concrete example: 99 `o` placeholders, index at byte 55605, index length 7533. A traced `getMachine` → `listMachines` → `getMachine` read 13,629 of 63,178 bytes, 7,533 of them the index. V8 itself costs about 4.8 KB per loaded module and about 325 bytes per named export; 438 AWS modules plus tens of thousands of exports are ~10 MB before distilled code runs. Agent process they describe: main thread hillclimbs the worst dashboard number with small commits and writes down wild ideas; subagents take one idea each in a worktree and benchmark it as a named experiment; only experiments that beat the baseline without other regressions merge. Before the schema rewrite they were already at 17.3 → 10.7 µs added latency and 2.10 → 0.84 MB import memory, while the bundle had only moved 57.0 → 54.0 KB. Memory is why they care: the resource factory runs many agents that typecheck, import every provider, and run live tests, and on their machines memory runs out before CPU, so halving the heap roughly doubles concurrent agents. |

Headline medians over the 98 programs (earlier → later):

| Measure | Earlier | Later | Change |
| --- | ---: | ---: | --- |
| One-call bundle, gzip | 57.1 KB | 38.3 KB | −33% |
| Added call latency | 19.5 µs | 4.0 µs | −79% |
| Import memory | 2.15 MB | 0.57 MB | −74% |
| Importing all of AWS | 227 MB | 13.9 MB | 16× less |

The hero tiles on the same page are a different comparison (distilled vs official SDKs, three calls: AWS SDK v3, `workers.scripts.list`, `@google-cloud/storage` `getBuckets`). They are not the same ratios as the per-operation tables. Hero, as printed: bundle 2.6× / 2.2× / 6.0× smaller; added latency 5.8× / 5.1× / 108.9× faster; import memory 3.3× / 23.5× / 7.5× less; cold start 2.0× / 3.0× / 1.2× faster. Cold start there is "import plus the first call in a fresh process, bundled as deployed."

Per-operation bundle, gzip KB, official / distilled / distilled strict. The essay's ratio column compares the official SDK with strict distilled:

| Operation | Official | Distilled | Strict | Stated ratio |
| --- | ---: | ---: | ---: | --- |
| S3 `ListBuckets` | 157.0 | 61.0 | 62.3 | 2.5× smaller |
| DynamoDB | 144.8 | 53.8 | 55.2 | 2.6× smaller |
| KMS | 134.1 | 53.2 | 54.5 | 2.5× smaller |
| STS | 130.1 | 55.2 | 56.6 | 2.3× smaller |
| EC2 | 265.2 | 55.1 | 56.5 | 4.7× smaller |
| Lambda | 141.3 | 55.0 | 56.4 | 2.5× smaller |
| Cloudflare Workers | 124.5 | 55.8 | 57.4 | 2.2× smaller |
| GCP Storage | 239.1 | 39.7 | 41.3 | 5.8× smaller |

Added latency, p50 microseconds, same order. The ratio uses the slower of distilled's two modes. The essay says differences of a microsecond or two, including Cloudflare's strict bar (1.0 µs vs 3.0 µs normal), are run-to-run noise. Body text: strict distilled is still 5 to 96 times faster per call than official SDKs that validate nothing. The 108.9× figure is the hero tile, not this table. GCP's official bar is truncated to fit the chart.

| Operation | Official | Distilled | Strict | Stated ratio |
| --- | ---: | ---: | ---: | --- |
| S3 `ListBuckets` | 140.2 | 19.4 | 22.0 | 6.4× faster |
| DynamoDB | 87.3 | 14.3 | 15.5 | 5.6× faster |
| KMS | 83.0 | 14.4 | 16.4 | 5.1× faster |
| STS | 93.2 | 16.1 | 16.6 | 5.6× faster |
| EC2 | 97.3 | 16.1 | 18.4 | 5.3× faster |
| Lambda | 79.3 | 15.3 | 16.1 | 4.9× faster |
| Cloudflare Workers | 15.5 | 3.0 | 1.0 | 5.1× faster |
| GCP Storage | 673.9 | 6.2 | 7.0 | 96× faster |

Cold start, bundled the way Alchemy deploys to Lambda and Workers: distilled 2.0× faster than official on AWS, 3.0× on Cloudflare, 1.2× on GCP. Unbundled `node_modules` (CLI shape): distilled slower on AWS (107.5 ms vs 42.8 ms) and GCP (96.0 ms vs 67.2 ms), faster on Cloudflare (94.3 ms vs 156.2 ms), because Node spends about 77 ms loading Effect's ~150 modules, which a bundle turns into one file.

Schema bake-off, Stripe after dedupe (zod/mini and TypeBox rows are before dedupe, as labeled):

| Option | Import memory | First-use memory | µs / validation | 1-op bundle, gzip |
| --- | ---: | ---: | ---: | ---: |
| Effect Schema, lazy | 0.86 MB | 11.3 MB | 24 | 27.5 KB |
| valibot | 20 MB | 0.2 MB | 25 | 6.0 KB |
| zod/mini, before dedupe | 114 MB | 0.7 MB | 40 | 9.3 KB |
| TypeBox, before dedupe | 14 MB | 1.9 MB | 206 | 27.9 KB |
| schema-lite | 2.3 MB | 0.17 MB | 13 | 4.6 KB |

Import-everything, with `distilled-lazy`:

| Provider | Services | Earlier | Later | Reduction |
| --- | ---: | ---: | ---: | --- |
| AWS | 438 | 227 MB | 13.9 MB | 16× less |
| GCP | 318 | 111 MB | 9.4 MB | 12× less |
| Azure | 224 | 112 MB | 8.0 MB | 14× less |
| Cloudflare | 129 | 76 MB | 3.2 MB | 24× less |

Import time: AWS 1.61 s → 0.14 s; Cloudflare 0.63 s → 0.05 s. Summed across providers: 924 MB → 94 MB. An intermediate sentence says importing every AWS service still used 35 MB before the lazy-loading experiment; the shipped "later" number is 13.9 MB. AWS operation count given for the lazy-loading motivation: about 19,500. EC2 alone has hundreds of operations.

Dedupe examples under the figure: Stripe 12,529 → 2,720; Cloudflare Workers 2,643 → 491; EC2 3,851 → 2,553.

## 2. Timeline of capabilities

Only what these five essays state. A later essay does not retroactively ship a feature into an earlier one.

| Date | Capability these essays actually establish |
| --- | --- |
| 2026-06-11 .. 2026-06-17, shipped as Alchemy 2.0.0-beta.56 (told on 2026-07-02) | Cloudflare provider 22 → 230 resources. Distilled Cloudflare SDK: 114 services, 2,092 operations, JSON patches per operation. By beta.56: 1,087 patched operations, 425 error tags. Typed lifecycle: `catchTag` for already-gone, `Effect.retry` + exponential schedule for R2 `NoSuchBucket`. Live tests that confirm every step against the API, not the deploy report. Generator: `bun scripts/generate.ts --service <name>`. Agents: one service owner per patch directory. |
| 2026-07-01 | `AWS.Lambda.MicrovmImage` and `Cloudflare.Container` as two targets of one Effect program. Bindings `RunMicrovm`, `CreateAuthToken`, `TerminateMicrovm`, `connectMicrovm`, with generated RPC. Worker-side IAM bridge: User limited to `sts:AssumeRole`, AccessKey as a Worker secret, Role that trusts that user, session credentials cached per isolate. `lambda:RunMicrovm` added to a Lambda execution role when the host is Lambda. Firecracker snapshot is the image build, not a flag. Durable Object network interception in front of a container, used to inject credentials. Measured: MicroVM opencode p50 3.4–3.6s, max 4.5s on the successful opencode set; container opencode p50 10.5s, max 58.6s. |
| 2026-07-02 (same factory essay, "what's next") | Stated intent only: AWS next, then Railway, GCP, Azure, toward 100% IaC coverage. Not a shipped capability. |
| 2026-07-22 | `alchemy-test`: one Bun process, Effect fibers, `--concurrency`, `{ exclusive: true }`, Vitest-compatible CLI, agent-readable output, 10s stall line, per-run log under `.alchemy/log/test/`, `--tui` with retry/kill/clipboard. Suite size stated as 4,000+ live tests. Distilled described as the generated AWS and Cloudflare SDK. EKS, queues, and eventual consistency appear as examples of why tests are slow, not as new resources. |
| 2026-09-24 | Alchemy's own CI, not a user-facing provider. pnpm for the package manager; Bun 1.3.13 pinned as the runtime because of the AsyncLocalStorage bug. Blacksmith for everything except npm trusted publishing, which stays on `ubuntu-latest` with `id-token: write`. Docs: incremental Astro builds, one reference page per service (4,368 → 406). PR site previews are versions of one stable preview Worker; `deploy-website` tag; no fork PRs. Concurrency cancellation. Cloudflare tooling tests path-filtered. `@alchemy.run/pkg` on Cloudflare: secretless fork publishes verified against the GitHub Actions run, affected-package publishes, previews live for the open PR. |
| 2026-10-24, `@distilled.cloud/*` 1.0.0-rc.16 | 88 providers. schema-lite replaces Effect Schema in generated code. Strict response validation via `ResponseValidation.strict`, opt-in, compiler not loaded otherwise. `@distilled.cloud/aws4signer` for R2/S3 SigV4 without the rest of the AWS SDK. Swappable `Crypto`. First-call schema plan; later calls are plain JS plus the HTTP effect. `distilled-lazy` / `alchemy deploy --fast-distilled` (Node only). Import-all memory: AWS 438 services 227 → 13.9 MB, Cloudflare 129 services 76 → 3.2 MB, GCP 318 → 9.4 MB, Azure 224 → 8.0 MB. Breaking: no exported schema values (`op.input` / `op.output`); error constructors do not validate; `SigningKeyCache` is a plain store; `lib/` is bundled minified output. |

Explicitly not on this timeline, because none of the five essays describe them: an S3 `BucketState` (or any other state store), sinks, phases, Alchemy resource references, a GitHub repository-settings resource, a Vercel provider, `@distilled.cloud/vercel`, Docker over SSH, AWS Budgets, an EC2 autoscaling runner fleet, and OIDC from a Worker to an IAM Role (named on 2026-07-01 as future work). The 2026-10-24 footer title mentioning DynamoDB state, and the 2026-07-02 footer title mentioning Docker and MicroVMs, are other posts.

## 3. What matters for this monorepo

Target stack this section is scored against: Cloudflare Workers and R2; AWS EC2 autoscaling runner fleet, Lambda, S3, IAM, KMS, and budgets; GitHub repository settings; a custom Vercel provider over `@distilled.cloud/vercel`; Docker over SSH; an AWS S3 `BucketState` store.

### Use what these essays already show

**Workers and R2.** The 2026-07-02 essay is the one that shows R2 lifecycle code: `r2.listBucketDomainCustoms` retried on `NoSuchBucket` with a 100 ms exponential schedule capped at 5 recurrences, because the R2 endpoint lags a fresh bucket create. `WorkerNotFound` is one of the lifecycle tags the patch corpus exists to name. The Cloudflare provider at beta.56 is 230 resources on distilled (114 services, 2,092 operations), with patches for real error codes rather than spec text. The 2026-07-22 runner examples are Worker tests: routes, workflows, cron, Durable Object namespaces (including websocket hibernation), `HttpApi`, `waitUntil`, `Worker`, account settings, workers.dev subdomain. The 2026-10-24 essay is why a Worker bundle should take `@distilled.cloud/aws4signer` for R2 SigV4 instead of the AWS SDK: R2 speaks the S3 API and needs SigV4, and the signer was extracted so that call does not pull the rest of AWS. Same essay: Cloudflare Workers one-call bundle 55.8 KB gzip distilled vs 124.5 KB official (57.4 KB strict, stated 2.2×); added latency 3.0 µs vs 15.5 µs official; importing all 129 Cloudflare services 76 MB → 3.2 MB and 0.63 s → 0.05 s with lazy loading; bundled cold start 3.0× the official SDK. Strict mode is aimed at exactly the failure mode they attribute to Cloudflare: the HTTP call succeeds, the body does not match the spec, and the bug shows up far away. Turn it on with `Effect.provide(ResponseValidation.strict)`.

**Lambda as a host, and IAM as the bridge, not as a catalog.** The 2026-07-01 essay is the IAM design for "a Worker calls AWS". It does not document a general IAM provider. What it does document, and what a Worker that starts Lambdas or MicroVMs should copy rather than reinvent: an IAM User that can only `sts:AssumeRole`, an AccessKey stored as a Worker secret, a Role that trusts only that user and is where permissions accumulate, `AssumeRole` once per isolate, session credentials cached and refreshed near expiry and shared by every binding. On a Lambda host, do not build that bridge; the binding adds `lambda:RunMicrovm` for the image ARN onto the execution role and uses the credentials already in the environment. OIDC federation from the Worker to the Role is what they say they want and do not claim to have shipped. The 2026-10-24 numbers for Lambda, STS, and IAM-adjacent signing: Lambda one-call bundle 55.0 / 56.4 KB strict vs 141.3 official; STS 55.2 / 56.6 vs 130.1; STS `getCallerIdentity` signing dropped from 282 µs to 125 µs on the sync-hash step alone. KMS appears only as a bundle and latency row (134.1 KB official vs 53.2 / 54.5 strict; 83.0 µs vs 14.4 / 16.4), not as a key or grant resource.

**S3 as an API, not as a state backend.** S3 `ListBuckets` is a benchmark row (157.0 KB official vs 61.0 / 62.3 strict; 140.2 µs vs 19.4 / 22.0) and the signing case study (352 µs → 19.4 µs). The Latin-1 footgun was found in the S3 module. None of that is a state store. `@distilled.cloud/aws4signer` is the shared piece between S3 and R2.

**MicroVM vs Container, if the monorepo runs agent or CI sandboxes.** For anything a person watches, the 2026-07-01 measurements say MicroVMs: opencode p50 3.4s via Lambda and 3.6s via Worker, max 4.5s on the 49 successful opencode MicroVM boots, against container p50 10.5s and max 58.6s. Hello-world containers still win the median (1.7s) and lose the tail (p95 23.9s, max 47.3s). The Node Effect image on MicroVMs is the exception inside the "consistent" platform: p50 3.2s but max 16.6s. Pick Containers anyway when the sandbox runs untrusted or agent-generated code against credentialed APIs, because the Durable Object can intercept container HTTP and inject credentials so the guest never sees the key. MicroVMs cannot do that natively. Same program either way: `AWS.Lambda.MicrovmImage` or `Cloudflare.Container`. Quota: do not fan out `RunMicrovm` past 5 TPS / burst 5 without a quota raise, or the throttle looks like a boot-time tail.

**CI shape, if the monorepo's pain is the same as theirs.** The 2026-09-24 essay is about Alchemy's repo, but the mechanisms transfer. Path-filter the Cloudflare live tests. Cancel the previous run in the concurrency group when agents push again. Do not delete the stable preview Worker while wiping a test account. PR previews of a Worker should be versions of one Worker so unchanged assets stay uploaded. npm trusted publishing still forces a GitHub-hosted publish job (`ubuntu-latest`, `id-token: write`) even if builds run elsewhere; they split build (`blacksmith-8vcpu-ubuntu-2404`) from `pnpm publish`. Pin Bun carefully: past 1.3.13, `AsyncLocalStorage` broke their Effect test runner. pnpm replaced Bun as the package manager because of `workspace:` / `catalog:` publish breakage, ignored `publishConfig`, lockfile drift on hand-edited deps, and tarball URL deps that do not dedupe. `@alchemy.run/pkg` is their replacement for pkg.pr.new, hosted on Cloudflare with Alchemy: verify a fork publish against the GitHub Actions run instead of giving the fork secrets, publish only affected packages, keep the preview for the life of the PR.

**Test runner, if agents will run the live suite.** `alchemy-test` is the thing they built because Vitest reloads distilled per worker and `bun test` is single-file. One process, fibers, `--concurrency`, `{ exclusive: true }` when a test touches global state, failures printed inline with captured logs, a 10s "still running" line, and a timestamped log at `.alchemy/log/test/`. The 2026-07-02 test shape is the one to copy for any resource they do not already cover: deploy, read it back through the SDK, mutate, read again, destroy, read until it is gone. Do not catch an unknown error in the resource; patch the SDK and regenerate (`bun scripts/generate.ts --service …`).

**Distilled footprint on the CLI and on deploys.** `alchemy deploy --fast-distilled` (or `ALCHEMY_FAST_DISTILLED=1`) is the opt-in for the unbundled CLI under Node. It does nothing under Bun. Bundled Workers and Lambdas already get the small path; the essay's unbundled CLI numbers are the warning: distilled is slower cold on AWS (107.5 ms vs 42.8 ms official) until something bundles Effect's ~150 modules or the lazy condition is on. Direct `effect/<Module>` imports, not the barrel. Nested `/*@__PURE__*/` if generating schemas. Latin-1 source only, or V8 doubles the module. `1.0.0-rc.16` consumers must switch exported schemas to `op.input` and `op.output`, stop expecting error constructors to validate, and treat `SigV4.SigningKeyCache` as a plain store.

### Do not treat these essays as coverage

**EC2 autoscaling runner fleet.** Not described. The only Auto Scaling string is a chart commit title on 2026-10-24: distilled typed `InvalidIamInstanceProfile` on `create`/`updateAutoScalingGroup`. That is an SDK error tag, not an Alchemy autoscaling group, launch template, or runner-fleet resource, and it is not a how-to.

**AWS Budgets.** Not mentioned in any of the five essays.

**GitHub repository settings.** Not a resource. The 2026-09-24 essay uses GitHub Actions as CI: concurrency cancellation, OIDC trusted publishing, and verifying a preview publish against the Actions run. It does not set repo settings, branch protection, environments, or secrets through Alchemy.

**Custom Vercel provider and `@distilled.cloud/vercel`.** Neither name appears. "88 providers" on 2026-10-24 does not include a Vercel line. Nothing here says whether a hand-written provider over a distilled Vercel package is the intended extension point. The factory essay's rule (no unmatched errors inside resource code; patch the SDK instead) is the only provider-authoring constraint these posts give, and it was stated for generated Cloudflare resources.

**Docker over SSH.** Not mentioned. Dockerfiles in the 2026-07-01 essay are MicroVM and container image definitions (`public.ecr.aws/lambda/microvms:al2023-minimal`, `oven/bun`, Docker Hub echo). They are not a Docker-over-SSH provider.

**S3 `BucketState`.** Not mentioned. No state store of any kind is specified. The 2026-11-01 footer title "Domain Replay & DynamoDB State" is another post and was not read; it is not evidence for an S3 state backend, and it names DynamoDB rather than S3 anyway.

**Sinks, phases, telemetry as Alchemy features, resource references.** Bindings are real and specified (2026-07-01, and "bindings bundle distilled" on 2026-10-24). Telemetry appears only as a cost: Effect's tracing span is ~0.9 ms of the first Cloudflare call. Sinks, phases, and Alchemy resource references are absent. Schema "references" on 2026-10-24 are recursive spec shapes (`suspend`, partition refinement), not infra references.

## 4. Do not roll your own

Things these essays say Alchemy or distilled already provides. Build past them only where the "not in these essays" list above applies.

1. **Two deploy targets for one Effect program.** `AWS.Lambda.MicrovmImage` and `Cloudflare.Container`, with the class as both the infra declaration and the typed client. RPC, auth headers, and serialization for methods like `hello` are generated. Source: [2026-07-01](https://alchemy.run/blog/2026-07-01-microvm-cold-starts/).

2. **MicroVM lifecycle bindings.** `RunMicrovm`, `CreateAuthToken` (`expirationInMinutes`, `allowedPorts`), `connectMicrovm` (`endpoint`, `authToken`), `TerminateMicrovm`. Same calls from a Lambda or a Worker. Source: [2026-07-01](https://alchemy.run/blog/2026-07-01-microvm-cold-starts/).

3. **The Worker-to-AWS credential bridge.** IAM User limited to `sts:AssumeRole`, AccessKey as a Worker secret, Role trusted only by that user, permissions accumulated on the Role, `AssumeRole` cached per isolate and shared across bindings. On Lambda, the execution role plus a generated `lambda:RunMicrovm` grant instead. Do not invent a second static-key design. OIDC is not in the box yet. Source: [2026-07-01](https://alchemy.run/blog/2026-07-01-microvm-cold-starts/).

4. **Credential injection in front of a container.** A Durable Object sees the container's HTTP and can add API credentials so guest code never holds the key. Source: [2026-07-01](https://alchemy.run/blog/2026-07-01-microvm-cold-starts/).

5. **Firecracker snapshot builds.** Building an `AWS.Lambda.MicrovmImage` runs the entrypoint and snapshots memory and disk. There is no extra snapshot resource to write. Source: [2026-07-01](https://alchemy.run/blog/2026-07-01-microvm-cold-starts/).

6. **Cloudflare resource lifecycles on a patched SDK, not on the spec.** 230 resources as of beta.56, distilled operations with JSON error and schema patches, typed tags such as `NoSuchBucket`, `WorkerNotFound`, `WidgetNotFound`, `Forbidden`. Idempotent delete via `catchTag`. Eventual consistency via `Effect.retry` and `Schedule`, including the R2 custom-domain list after bucket create. Source: [2026-07-02](https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/).

7. **The patch-and-regenerate rule.** Unknown errors are not handled in resource code. Add the patch, run `bun scripts/generate.ts --service <name>`, let `catchTag` start typechecking. One owner per `patches/<service>/` directory. Source: [2026-07-02](https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/).

8. **Live tests that do not trust the deploy report.** Deploy, query through distilled, mutate, query, destroy, watch it disappear. Source: [2026-07-02](https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/). The runner those tests need is `alchemy-test`: one Bun process, Effect fibers, `--concurrency`, `{ exclusive: true }`, Vitest-compatible `bun run test <path> -t <name>`, inline failures, 10s stall report, `.alchemy/log/test/<timestamp>-pid<pid>.log`, `--tui`. Source: [2026-07-22](https://alchemy.run/blog/2026-07-22-a-test-runner-for-agents/).

9. **R2 SigV4 without the AWS SDK.** `@distilled.cloud/aws4signer`. Sync `node:crypto` through the `Crypto` service on Node, WebCrypto where Node is absent, replaceable if a large body must not block the event loop. Source: [2026-10-24](https://alchemy.run/blog/2026-10-24-optimizing-distilled/).

10. **Strict response checks.** `ResponseValidation.strict`, typed `ParseError` with a path, validator loaded only when the layer is provided, checked against Effect Schema's accept/reject behavior. Source: [2026-10-24](https://alchemy.run/blog/2026-10-24-optimizing-distilled/).

11. **schema-lite and the rc.16 call shape.** Generated schemas are plain AST objects from `@distilled.cloud/core/schema-lite`. Read inputs and outputs as `op.input` and `op.output`. Do not import schema values, do not expect error constructors to validate, do not depend on the old `SigningKeyCache` class. `catchTag` / `_tag` / `instanceof` stay. Source: [2026-10-24](https://alchemy.run/blog/2026-10-24-optimizing-distilled/).

12. **Lazy distilled for the unbundled CLI.** `alchemy deploy --fast-distilled` or `ALCHEMY_FAST_DISTILLED=1` under Node (`distilled-lazy`). No `eval`. No effect under Bun. Bundlers keep the normal full module. Source: [2026-10-24](https://alchemy.run/blog/2026-10-24-optimizing-distilled/).

13. **Import and tree-shaking rules for anything that embeds distilled.** `effect/<Module>` direct imports, not `from "effect"`. Nested `/*@__PURE__*/` on generated schema calls. Latin-1 source only. User-supplied `ConfigProvider` and `Schedule` still work. Source: [2026-10-24](https://alchemy.run/blog/2026-10-24-optimizing-distilled/).

14. **Their CI gadgets, if the temptation is to rebuild them.** Path-filtered Cloudflare live tests, concurrency cancellation of stale pushes, one stable preview Worker with per-PR versions, `deploy-website` as the manual gate, and `@alchemy.run/pkg` for installable PR packages (secretless fork publishes checked against the Actions run, affected packages only, preview kept while the PR is open). npm trusted publishing still needs a GitHub-hosted job. Source: [2026-09-24](https://alchemy.run/blog/2026-09-24-optimizing-ci/).

Not on this list, because these essays do not provide them: S3-backed state, EC2 autoscaling fleets, Budgets, GitHub repo settings, Vercel, Docker over SSH, Worker-to-IAM OIDC, sinks, phases, and Alchemy resource references.
