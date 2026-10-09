# H1 catalog and compatibility holds

## OSV exceptions

Wave 1 prepared on 2026-10-09 from packet head `3dbf109066` after merging
`origin/main` (`d1e8350670`) and the packet branch per Mechanics step 0.
The three 2026-10-16 exceptions are renewed only to 2026-10-30. No manifest
or lockfile change remains. Renewal is a temporary accepted risk, not a claim
that the packages were patched. Hosted Security passed at `18fdc60e50a82ba49b22d290b3035a4702a774ed`,
[run 37955008259 / job 113903184755](https://github.com/beep-effect/beep-effect/actions/runs/37955008259/job/113903184755).
A final report/main-sync push requires a new exact-head hosted result.

| Package / advisory | Consumer and owner | Attempt to remove or force fixed version | Exit condition | Last checked / evidence command |
| --- | --- | --- | --- | --- |
| braces 3.0.3 / GHSA-vfj7-8cjw-p6xm | `@beep/storybook`: shadcn -> fast-glob -> micromatch | npm latest remains 3.0.3; no fixed npm release. Removing the dependency path would remove live shadcn tooling, outside H1's locked retirements. | Published fixed braces version passes install, Storybook tooling and OSV, or the shadcn path is removed. Recheck before 2026-10-30. | 2026-10-09; `bun pm why braces`; GET npm registry braces; POST OSV query npm/braces@3.0.3 returned GHSA-vfj7-8cjw-p6xm. |
| http-cache-semantics 4.2.0 / GHSA-ch52-4w7c-c8xp | `@beep/infra`: Pulumi -> npm tooling -> make-fetch-happen | Trial root override 4.3.0, `bun install`, OSV query clean; behavioral proof below failed, so override and lockfile were restored. Pulumi remains live. | A fixed release passes private-cache/max-stale proof, install and OSV, or the Pulumi/npm install dependency path is removed. Recheck before 2026-10-30. | 2026-10-09; `bun pm why http-cache-semantics`; GET npm registry; POST OSV query npm/http-cache-semantics@4.3.0 returned no advisories; `node` behavioral proof exited 1. |
| sprintf-js 1.0.3 / GHSA-hp3w-g68c-fv3c | `@beep/doc-text`: mammoth -> argparse; `@beep/repo-docgen`: markdown-toc -> remarkable -> argparse | npm latest 1.1.3 is also affected. Both parents retain argparse 1.0.10. Removing the paths would remove live document conversion/docgen. | Published fixed sprintf-js passes document/docgen consumers and OSV, or both argparse paths are removed. Recheck before 2026-10-30. | 2026-10-09; `bun pm why sprintf-js`; GET npm registry; POST OSV query npm/sprintf-js@1.0.3 returned GHSA-hp3w-g68c-fv3c. |

Source advisories and upstream issues:
[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[braces issue](https://github.com/micromatch/braces/issues/70),
[HTTP-cache advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp),
[HTTP-cache issue](https://github.com/kornelski/http-cache-semantics/issues/56),
[sprintf advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c),
[sprintf issue](https://github.com/alexei/sprintf.js/issues/237).

HTTP cache behavioral proof, run against the installed trial 4.3.0:

```js
const CachePolicy = require("http-cache-semantics");
const assert = require("node:assert/strict");
const request = {
  url: "https://registry.example/package",
  method: "GET",
  headers: { host: "registry.example" }
};
const policy = new CachePolicy(request, {
  status: 200,
  headers: {
    "cache-control": "private, max-age=3600",
    "set-cookie": "synthetic=1"
  }
});
const result = policy.evaluateRequest({
  ...request,
  headers: { ...request.headers, "cache-control": "max-stale=999999" }
});
assert.equal(result.response, undefined);
```

Output: `storable=false cached-response=true`; assertion failed because
`result.response` included the synthetic cookie. This exercises the advisory's
security-zeroed entry reuse; it does not claim that make-fetch-happen stores
private responses. Renewal retains the tooling-only boundary already reviewed.
OSV's version range excludes 4.3.0, but that alone does not establish repair.

Repository source search over packages, apps, infra and scripts found no direct
sprintf-js, argparse or HTTP cache imports. Installed argparse's formatter uses
sprintf at its usage, description and help-template sites (lines 325, 559,
744). The reviewed mammoth/remarkable CLI templates remain package-authored
constants, not document-provided format strings.

`bun install` regenerated only the trial override, HTTP cache package version,
and workspace bin ordering; after reverting the trial, `bun install
--ignore-scripts` restored 4.2.0 and `git restore -- bun.lock` discarded only the
incidental bin ordering. `git diff -- package.json bun.lock` is empty.

## Consumer check

Preparation census at `18fdc60e50`: tracked `*package.json` files parsed for
all four dependency fields; root overrides checked separately; import/require
search over packages, apps, scratchpad, infra and scripts; literal searches in
CreatePackage, PackageShell, RootCatalog, syncpack, scripts, Turbo and workflows.
Command per row: `git ls-files '*package.json'` plus manifest field lookup;
`rg -l '<import/require pattern for PACKAGE>' packages apps scratchpad infra scripts`;
`rg -l -F PACKAGE <generator/config/script paths>`. Results below are a preview;
rerun the full census at the post-A catalog wave head before removing anything.

| Candidate | Manifest / override result | Import result | Generator/config/script result | Disposition |
| --- | --- | --- | --- | --- |


| `@google-cloud/pubsub` | `scratchpad/package.json:dependencies` | `scratchpad/effect-ontology/Service/PubSubClient.ts`, `scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts` | none | retain: effect-ontology retirement exit |
| `@google-cloud/storage` | `scratchpad/package.json:dependencies` | `scratchpad/effect-ontology/Service/Storage.ts` | none | retain: effect-ontology retirement exit |
| `@xenova/transformers` | `scratchpad/package.json:dependencies` | `scratchpad/effect-ontology/Service/NomicNlp.ts` | none | retain: effect-ontology retirement exit |
| `@zip.js/zip.js` | `scratchpad/package.json:dependencies` | none | none | remove in catalog wave |
| `ajv` | none | none | none | remove in catalog wave |
| `exifreader` | `scratchpad/package.json:dependencies` | none | none | remove in catalog wave |
| `file-type` | `scratchpad/package.json:dependencies` | none | none | remove in catalog wave |
| `gl-bench` | none | none | none | remove in catalog wave |
| `gray-matter` | `scratchpad/package.json:dependencies` | none | none | remove in catalog wave |
| `mdast-util-find-and-replace` | none | none | none | remove in catalog wave |
| `mediabunny` | `scratchpad/package.json:dependencies` | none | none | remove in catalog wave |
| `music-metadata` | `scratchpad/package.json:dependencies` | none | none | remove in catalog wave |
| `officeparser` | `scratchpad/package.json:dependencies` | none | none | remove in catalog wave |
| `rehype-stringify` | none | none | none | remove in catalog wave |
| `remark-gfm` | none | none | none | remove in catalog wave |
| `typedoc` | none | none | none | remove in catalog wave |
| `pdfjs-dist` | `scratchpad/package.json:dependencies`; root override | none | none | derived 17th removal with officeparser |

## Removals

No catalog or scratchpad removal in OSV wave 1. Security proof after lockfile
regeneration belongs to the catalog wave.

## Detection gap

Installed Fallow is 3.32.0. `fallow config-schema` has only
`ignoreCatalogReferences` for unresolved catalog references; `ignoreDependencies`
covers unused/unlisted dependencies, not catalog entries. `fallow explain
unused-catalog-entries` documents workspace and pnpm override consumers, without
Bun root override consumers or a per-entry ignore for this rule. The default
option (a) cannot be supported from this configuration surface. Option (b)'s
schema/service/implementation and paired fixtures remain for the catalog wave;
no detector code or config was changed in OSV wave 1.

## Hold register

Pending the catalog/register wave; this receipt's OSV rows already carry all
required exception metadata.

## Compatibility proofs

HTTP cache trial above failed; renewed. Other met exits run in their own PR
following the catalog/register wave (R74).

## Syncpack

Pending catalog/register wave. Leave Knip retirement to lane A.

## Tsgo ratchet

Deferred under SPEC Decision Log row **H1 tsgo ratchet deferral**. Owner:
`rsc-h1-catalog`; target: seven `@effect/tsgo-*` pins, 0.47.2 -> 0.51.1 in
lockstep, as a separate PR after the hold-exit merges. Reason: R73/R74/R76
merge ordering is not yet met. Reversal: resume H1 after those merges, remove
the deferral and run `beep quality tsgo-rules`; do not fold the bump into OSV.

## Gates and scope

No workspace package source or manifest was edited in the retained OSV wave;
package-verify has no edited package target. Read
`standards/coverage.regression-baseline.jsonc`: coverage rows are package-owned;
no touched source file belongs to a measured row, so a scoped coverage run is
not applicable. No baseline change or unrelated formatting change is included.
Parity commands run through `beep-heavy`; results will be recorded in the
lane handoff. Local security replay approximates hosted OSV and is reported
separately from exact-head hosted Security.

Local admitted parity at implementation head `18fdc60e50`:

| Command | Result | Evidence |
| --- | --- | --- |
| `bun run beep quality test-tsgo` | pass | 330 files in one selected package; 148 packages covered by check scripts were skipped by the command. |
| `bun run beep docgen local --base origin/main` | pass | No package-local docgen inputs changed; official noop plan. |
| `bun run beep ci lane jsdoc-ratchet` | pass | Fresh inventory: 21 tracked totals; no increases; non-generated zero-legacy findings 0. |
| `CI=true bun run beep knowledge refs --check` | fail, inherited | Two gated host-path observations: build-pipeline RESEARCH.md:194 on main; packet SPEC.md:374 on the packet branch. Owning baseline repair: lane C. |
| `bun run beep quality fallow audit --check --base origin/main --out .beep/rsc-h1/fallow-audit.json` | pass | Envelope exit 0, zero findings. |
| `bun run beep quality fallow health --out .beep/rsc-h1/fallow-health.json` | pass | Envelope status ok, exit 0. |
| `bun run beep ci lane security` | pass | ONNX proof and OSV v2.3.3 container: 3,417 packages, three reviewed ignored artifacts, no issues. |
| Coverage baseline read | pass / no measured source touched | Package-owned rows; no source edits or baseline changes. |

Local logs are regenerable, ignored evidence in `.beep/rsc-h1/`. Yeet cheap
gates and head-install preflight passed before the first push; PR #1562 was
created and labelled ready-for-heavy. Detached monitor submission initially
failed without the user bus; re-submission succeeded with that bus, job
`f8d5ad78-1177-409e-b399-2baea41d1ddf` (45-minute bound). Post-proof main merge
adds only the nightly research packet and ledger; it changes no package source,
manifest, lockfile or OSV configuration. Local results above remain attributed
to their actual implementation head; latest hosted gates must prove the new
published head. The lane is blocked on the inherited knowledge-reference
repair and the post-OSV/A merge order, not reported as the full H1 completion.
