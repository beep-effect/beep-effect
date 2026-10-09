# H1 catalog and compatibility holds

## OSV exceptions

Wave 1 prepared on 2026-10-09 from packet head `3dbf109066` after merging
`origin/main` (`d1e8350670`) and the packet branch per Mechanics step 0.
The three 2026-10-16 exceptions are renewed only to 2026-10-30. No manifest
or lockfile change remains. Renewal is a temporary accepted risk, not a claim
that the packages were patched. Hosted Security proof remains pending.

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

Pending the catalog/register wave after A's Knip removal (R73). The sixteen
candidate census will be rerun at that wave's current head.

## Removals

No catalog or scratchpad removal in OSV wave 1. Security proof after lockfile
regeneration belongs to the catalog wave.

## Detection gap

Pending Fallow per-entry ignore support verification (R75).

## Hold register

Pending the catalog/register wave; this receipt's OSV rows already carry all
required exception metadata.

## Compatibility proofs

HTTP cache trial above failed; renewed. Other met exits run in their own PR
following the catalog/register wave (R74).

## Syncpack

Pending catalog/register wave. Leave Knip retirement to lane A.

## Tsgo ratchet

Pending hold-exit merges (R76); no silent deferral and no bump in OSV wave.

## Gates and scope

No workspace package source or manifest was edited in the retained OSV wave;
package-verify has no edited package target. Read
`standards/coverage.regression-baseline.jsonc`: coverage rows are package-owned;
no touched source file belongs to a measured row, so a scoped coverage run is
not applicable. No baseline change or unrelated formatting change is included.
Parity commands run through `beep-heavy`; results will be recorded in the
lane handoff. Local security replay approximates hosted OSV and is reported
separately from exact-head hosted Security.
