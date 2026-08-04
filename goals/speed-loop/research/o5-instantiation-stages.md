# Instantiation stages 3–5: implementation plan

Date: 2026-08-04  
Branch inspected: `chore/improve-speed-of-things`  
Repository state: read-only; the pre-existing untracked `.gitleaks.base.toml` was not touched.

## Executive verdict

The intended order remains correct—HTML operation boundary, then Markdown import boundary, then agent/ontology demand scoping—but two exit assumptions in the census need correction before implementation:

1. **Stage 3 is not implementation-ready as written.** The exported HTML operations already have explicit parameter/return signatures, and an additional explicit encoder boundary does not remove the union cost. A controlled `Html.serialize.ts` probe changed 11,726,929 to 11,723,953 instantiations (−2,976, −0.03%); it remains 3.72M over the ≤8M exit. `Html.policy.ts` with the same cap is 11,692,044, also far over budget. Do not open an annotation-only PR.
2. **Stage 4's existing subpath is useful but insufficient.** Changing one import to `@beep/html/Html.policy` cuts `Md.safe.ts` by 3,062,245 instantiations (−21.8%), from 14,035,789 to 10,973,544, but misses the ≤6M exit by 4.97M because the policy module is itself a hot operation lump.
3. **Stage 5 contains one proved large win and two dependency-order wins.** Direct leaf imports cut `BlockRepair.ts` from the census's 15,215,430 to 2,012,361 (−86.8%, comfortably below budget). The immediately available narrower paths barely move `Session.atoms.ts` (−1.2%) and `Chat.rpc.ts` (−2.4%); those two require new leaf entry points and the stage-4 HTML chain to land first.

Recommendation: do not combine stages. Land the stage-4 one-line import as an honest partial win, land the independently proved BlockRepair leaf-boundary PR, then do a protocol-boundary PR for agents/ontology. Keep stage 3 as a short falsifiable spike until a candidate demonstrates ≤8M; do not merge an annotation-only change.

## Measurement method and results

Every probe used the census form: an overlay extending the owning package config with `"include": []`, one absolute `"files"` entry, and `composite`, `incremental`, and emit disabled. Runs were sequential through `node_modules/.bin/tsgo -p ... --extendedDiagnostics` under `/usr/bin/time -v`. Temporary variants changed imports only (plus the stage-3 encoder signature) and preserved sibling-module resolution. The committed method and budgets are at `goals/quality-speedup/research/instantiation-census.md:4-10` and `goals/quality-speedup/research/instantiation-census.md:105-122`.

The post-stage-1 barrel floor used for marginals is 1.62–1.63M (`goals/quality-speedup/research/instantiation-census.md:133-149`). Check-time comparisons against the old census are not used: stage 1 deliberately removed the old ~17s MimeType relation cost. Instantiations are the decision metric here.

| Probe | Instantiations | Marginal vs 1,624,030 | Check | Peak RSS | Result | tsgo version |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `Html.serialize.ts`, current | 11,726,929 | 10,102,899 | 3.850s | 3,826,804 KiB | baseline | `Version 7.0.2+effect-tsgo.0.24.3` |
| `Html.serialize.ts`, explicit `encodeUnknownResult` boundary returning `unknown` | 11,723,953 | 10,099,923 | 2.926s | 3,741,844 KiB | −2,976; no material win; >8M | `Version 7.0.2+effect-tsgo.0.24.3` |
| `Html.policy.ts`, same explicit boundary | 11,692,044 | 10,068,014 | 2.866s | 3,742,188 KiB | candidate itself >8M; reject | `Version 7.0.2+effect-tsgo.0.24.3` |
| `Md.safe.ts`, current | 14,035,789 | 12,411,759 | 2.875s | 2,822,568 KiB | baseline | `Version 7.0.2+effect-tsgo.0.24.3` |
| `Md.safe.ts`, `@beep/html/Html.policy` | 10,973,544 | 9,349,514 | 2.875s | 2,547,732 KiB | −3,062,245 (−21.8%); >6M | `Version 7.0.2+effect-tsgo.0.24.3` |
| `Session.atoms.ts`, `@beep/agents-client/Chat.atoms` | 15,471,116 | 13,847,086 | 3.626s | 3,927,952 KiB | census-relative −187,481 (−1.2%); >8M | `Version 7.0.2+effect-tsgo.0.24.3` |
| `Chat.rpc.ts`, workspace Thread leaf paths | 14,415,679 | 12,791,649 | 3.209s | 3,267,596 KiB | census-relative −350,727 (−2.4%); >8M | `Version 7.0.2+effect-tsgo.0.24.3` |
| `BlockRepair.ts`, AssistantTurn contract/error leaves | 2,012,361 | 388,331 | 0.523s | 851,656 KiB | census-relative −13,203,069 (−86.8%); passes | `Version 7.0.2+effect-tsgo.0.24.3` |

For the three “census-relative” rows, the baselines are the committed 15,658,597 / 14,766,406 / 15,215,430 measurements, each recorded with the same tsgo version at `goals/quality-speedup/research/data/census-perfile.tsv:7`, `:9`, and `:10`. They are not paired wall-time comparisons.

An additional rejected stage-3 variant exposed `HtmlRoot.Encoded` in the explicit result type. It measured 11,726,939 (`Html.serialize`) and 11,692,051 (`Html.policy`), both with `Version 7.0.2+effect-tsgo.0.24.3`; preserving the encoded union is exactly what must not escape.

## Stage 3 — HTML derived operations

### What the files already do

`Html.serialize.ts` already puts explicit signatures on all public operations that cross the generated element union:

- `serialize: (HtmlRoot.Type) => Effect<UntrustedHtml, HtmlSerializeError>` at `packages/foundation/modeling/html/src/Html.serialize.ts:574-575`;
- `serializeConformant: (ConformantHtml) => Effect<UntrustedHtml, HtmlSerializeError>` at `packages/foundation/modeling/html/src/Html.serialize.ts:597-599`;
- `serializeSafe: (SafeHtmlAst) => Effect<SafeHtml, HtmlSerializeError>` at `packages/foundation/modeling/html/src/Html.serialize.ts:645-646`;
- both string getters have explicit return types at `packages/foundation/modeling/html/src/Html.serialize.ts:663` and `packages/foundation/modeling/html/src/Html.serialize.ts:694-699`.

`Html.policy.ts` is likewise already annotated:

- `inspectSafeHtml` returns `ReadonlyArray<HtmlPolicyIssue>` at `packages/foundation/modeling/html/src/Html.policy.ts:768-776`;
- `enforceSafeHtml` has its full Effect signature at `packages/foundation/modeling/html/src/Html.policy.ts:797-804`;
- `safeHtmlAstConformant` and `safeHtmlAstRoot` have explicit outputs at `packages/foundation/modeling/html/src/Html.policy.ts:823-832` and `packages/foundation/modeling/html/src/Html.policy.ts:851`.

The remaining expensive operation is the schema encoder over `HtmlRoot`: `S.encodeResult(HtmlRoot)` at `Html.serialize.ts:540-550` and `Html.policy.ts:768-776`. The runtime immediately narrows its result with `isRuntimeNode`, so the cheapest plausible annotation was:

```ts
const encodeHtmlRoot: (
  root: HtmlRoot.Type
) => Result.Result<unknown, S.SchemaError> = S.encodeUnknownResult(HtmlRoot)
```

Replacing each inline encoder with that operation was behavior-preserving and probe-valid, but the table shows it is effectively neutral. The compiler still instantiates the schema operation while checking the assignment. The original “add explicit operation signatures” lever is therefore already exhausted.

### Precise next edit—gated spike, not a promised PR

Do **not** annotate more exported functions. The next candidate must avoid compiling a typed `HtmlRoot` encoder in each operation module, not merely hide its return type. A bounded spike should:

1. add one internal adapter owned beside the generated model, with a deliberately non-union public signature such as `(value: unknown) => Result.Result<unknown, S.SchemaError>`;
2. make both operation files call that adapter and retain their existing `isRuntimeNode` checks;
3. prove schema parity for representative document, fragment, text-mode, foreign-node, and invalid-root cases before accepting any type erasure;
4. measure both files and delete the spike unless each is ≤8M absolute.

This may require a generator-emitted declaration/body boundary; a normal source-level assignment to `S.encodeUnknownResult(HtmlRoot)` has now been falsified. If no adapter shape beats 8M, stage 3's next legal lever is an architecture decision, not an opportunistic file split.

### Work size and expected win

- Spike: 0.5–1 day, two operation call sites plus parity tests and two census probes.
- Implementation if the spike passes: 1–2 days including generated output/check wiring and docgen.
- Evidence-backed expected win from annotations: **approximately zero**, not the census's proposed ~6M per file.
- Required win for acceptance from today's measurements: at least 3.73M from each file.

### Risks and no-gos

- Erasing the schema boundary can weaken compile-time encoder input/output guarantees; runtime parity tests are mandatory.
- `SafeHtmlAst` and `SafeHtml` are issuer-proven opaque values (`Html.policy.ts:432-494`, `Html.serialize.ts:88-158`); the spike must not make them structurally constructible.
- Root barrel examples rely on the current stable contracts (`packages/foundation/modeling/html/src/index.ts:242-280`); preserve those exports.
- Do not retry `withCodecStatics` removal, `$I.annoteSchema` removal, or generic file splitting. The census records +41%, ≤2.4%, and redistribution-without-reduction respectively at `goals/quality-speedup/research/instantiation-census.md:100-103`.
- Do not widen or regenerate the element union as part of this work; `Html.model.ts` is explicitly not the target.

## Stage 4 — Markdown safe-schema import

### Precise edit that can land now

Change only `packages/foundation/modeling/md/src/Md.safe.ts:14`:

```diff
-import { SafeImageUrlAttribute, SafeUrlAttribute } from "@beep/html";
+import { SafeImageUrlAttribute, SafeUrlAttribute } from "@beep/html/Html.policy";
```

Both names are declared in the policy module (`packages/foundation/modeling/html/src/Html.policy.ts:246-322`). The development and publish export maps already expose `./Html.policy` (`packages/foundation/modeling/html/package.json:39-52`, `packages/foundation/modeling/html/package.json:62-74`), so no package-surface edit is required.

### What it wins and what it does not

The controlled probe proves a 3,062,245-instantiation reduction in `Md.safe.ts`, and it prevents Markdown from loading the serializer namespace/root-barrel side. It does **not** meet the ≤6M exit because both requested schemas live in the 11.69M policy operation module.

The stage should therefore be reported as a partial lever-1 win. After stage 3 is resolved, remeasure before adding another surface. If the policy module remains >8M, the only demand-scoped follow-up worth considering is a **leaf URL-policy module**, not a generic split:

- move the URL predicates and the two schemas/types at `Html.policy.ts:207-322` to `Html.url-policy.ts`;
- have `Html.policy.ts` import/re-export them for compatibility;
- add `./Html.url-policy` to both development and publish maps next to the existing entries at `package.json:39-50` and `package.json:65-76`;
- point `Md.safe.ts` to that leaf.

This carve-out is justified only for consumer demand: it lets Markdown avoid the AST policy operations. It is not claimed to reduce the sum of HTML's own modules, and must not be sold as refactoring away the HTML lump.

### Work size and risks

- Existing-subpath PR: 1 line plus one per-file probe and package tests; under half a day.
- Leaf URL-policy fallback: 0.5–1 day, two export-map edits, compatibility re-export, URL-policy tests, docgen examples, and per-file/package probes.
- Public surface is additive for the leaf fallback, but moving declarations can change inferred schema identities or generated docs; compare annotations and parity.
- The root HTML barrel deliberately advertises specialist subpaths (`packages/foundation/modeling/html/src/index.ts:1-7`) and also namespace-exports the full policy/serializer (`index.ts:235-280`); do not remove those in this stage.

## Stage 5 — agents/ontology demand scoping

The phrase “what the barrels re-export” must be implemented as **leaf import/entry-point isolation**. Replacing `export *` with `export { A, B } from "./Hot.ts"` still asks TypeScript to load and check `Hot.ts` and does not lower that file's own census number.

### 5A. `BlockRepair.ts` — ready and independently valuable

The hot dependency is visible at `packages/agents/server/src/AssistantTurn/BlockRepair.ts:8-20`: it imports one `IndexedBlock` contract from the entire `@beep/agents-use-cases/public` barrel and one `BlockRepairFailed` from the entire `server` barrel. Those barrels fan through `public.ts` and `server.ts` (`packages/agents/use-cases/src/public.ts:20-52`, `packages/agents/use-cases/src/server.ts:20-63`).

Precise edits:

1. Add package entry points `./AssistantTurn.contracts` and `./AssistantTurn.repair-errors` to `packages/agents/use-cases/package.json:31-37` (and add a publish map if/when this private package gains one), targeting:
   - `src/processes/AssistantTurn/AssistantTurn.contracts.ts`;
   - `src/processes/AssistantTurn/AssistantTurn.repair-errors.ts`.
2. In `BlockRepair.ts:9-10`, import `IndexedBlock` and `BlockRepairFailed` from those two leaves.
3. Apply the same leaves to `AnthropicTurnKernel.ts:40-41`; its direct runtime import of BlockRepair at `AnthropicTurnKernel.ts:38` remains correct.
4. Add `./BlockRepair` to `@beep/agents-server`'s development and publish export maps beside the existing AssistantTurn entries (`packages/agents/server/package.json:34-42`, `packages/agents/server/package.json:55-63`).
5. Migrate BlockRepair-specific tests to that leaf. Then remove `export * from "./BlockRepair.ts"` from `packages/agents/server/src/AssistantTurn/index.ts:51-78` only if the team accepts the private-package surface break; otherwise keep it for compatibility and understand that `/AssistantTurn` consumers still pay the module.

The probe used equivalent direct leaves and measured 2,012,361 instantiations / 851,656 KiB RSS, versus 15,215,430 / 5,101,128 KiB in the census. It clears both ≤8M and <4GB goals with wide margin.

Consumer census: real import declarations from `/AssistantTurn` use ten names; BlockRepair contributes only `IssueReport`, `makeRepairInvalidBlocks`, `PatchOpSummary`, and `ReplacePatchOpSummary` outside its own implementation. Scan-state consumers should not load repair. The production kernel already imports repair relatively, so separating the package entry point does not change its runtime composition.

Size: 1 day including package maps, imports, tests, JSDoc links/examples, docgen, and proof.

### 5B. `Session.atoms.ts` — new protocol leaf required

`Session.atoms.ts` imports only `chatProtocolLayerAtom` and `HttpChatProtocolLive` from the agents-client root (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:8`). The root re-exports four large client areas (`packages/agents/client/src/index.ts:27-78`), and the existing `Chat.atoms` path is public (`packages/agents/client/package.json:34-42`). Switching to that existing path saves only 187,481 instantiations, so it is not enough.

The reason is that the writable protocol atom lives inside `Chat.atoms.ts`, which imports `ChatRpcs`, `SafeDocument`, and the full chat state graph (`packages/agents/client/src/Chat.atoms.ts:14-31`), even though the protocol itself is only `Atom.make(HttpChatProtocolLive)` at `Chat.atoms.ts:53-88`.

Precise edits:

1. Create `packages/agents/client/src/Chat.protocol.ts` containing only the `HttpChatProtocolLive` re-export/import and `chatProtocolLayerAtom` declaration now at `Chat.atoms.ts:53-88`.
2. Make `Chat.atoms.ts` import/re-export those names from `Chat.protocol.ts`; keep `ChatClient` and all chat state in `Chat.atoms.ts`.
3. Add `./Chat.protocol` to both agents-client export maps at `packages/agents/client/package.json:34-42` and `:52-63`.
4. Change `Session.atoms.ts:8` and the desktop shell's direct agents import at `apps/professional-desktop/src/App.tsx:21` to `@beep/agents-client/Chat.protocol`.
5. Create a matching lightweight `Session.protocol.ts` in ontology-client for the aliases currently declared at `Session.atoms.ts:75-103`; make `Session.atoms.ts` import/re-export them.
6. Replace ontology-client root's `export *` at `packages/ontology/client/src/index.ts:24-30` with explicit protocol exports from `Session.protocol.ts`. Keep the full workbench API on the existing `/aggregates/Session` path (`packages/ontology/client/package.json:35-39`), which is where ontology UI and tests already import it.
7. Point `apps/professional-desktop/src/App.tsx:28` at the lightweight root or explicit protocol leaf; both are acceptable once the root no longer re-exports all 86 Session symbols.

Current consumer census: the ontology root has two real imported names (exactly the protocol pair); `/aggregates/Session` has 63 real imported names across ontology UI/tests, while `Session.atoms.ts` declares 86 exports. Therefore the root can be narrowed without changing any current root consumer, but the aggregate subpath must remain broad until the large file is decomposed by cohesive state areas for maintainability—not as a typeperf claim.

Expected win: the existing-path probe establishes only a 0.19M floor. The protocol extraction should remove the entire Chat/Md/RPC branch from Session's import graph; require a fresh `Session.atoms.ts` probe ≤8M before calling the PR complete. Size: 1–2 days. Main risks are initialization order (`Atom.runtime.addGlobalLayer` remains in `Chat.atoms.ts:45-51`), atom identity (the writable atom must be defined once), and desktop transport replacement timing documented at `Chat.atoms.ts:61-88`.

### 5C. `Chat.rpc.ts` — inherit stage 4, then narrow workspace and package surfaces

`Chat.rpc.ts` already imports `SafeDocument` through its Markdown subpath at `packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts:12-20`; therefore its dominant HTML cost is inherited inside `Md.safe.ts`, not caused by the agents barrel. Its broad workspace imports are:

- `Thread` from the domain root at `Chat.rpc.ts:15`, despite an existing `@beep/workspace-domain/entities/Thread` export (`packages/workspace/domain/package.json:31-43`);
- a `Thread` namespace from workspace-use-cases public at `Chat.rpc.ts:16`, despite `@beep/workspace-use-cases/aggregates/Thread` (`packages/workspace/use-cases/package.json:34-43`).

Precise edits after stage 4:

```ts
import { Thread } from "@beep/workspace-domain/entities/Thread"
import { ThreadTimeline } from "@beep/workspace-use-cases/aggregates/Thread"
```

and change `success: ThreadUseCases.ThreadTimeline` at `Chat.rpc.ts:93-97` to `success: ThreadTimeline`.

That exact variant saves only 350,727 instantiations today, so it is cleanup, not the main exit lever. Remeasure after stage 4. If still >8M, add a `./Chat` entry point to agents-use-cases and migrate chat consumers (`ChatRpcs`, `ChatActionError`, `TurnRequestStatus`, and the one real `SendMessageRpc` consumer) away from `/public`. The current chain is `public.ts:38-52` → `Chat/index.ts:23-37` → `Chat.rpc.ts`.

`Chat.rpc.ts` declares eight runtime exports plus the `TurnRequestStatus` type (`Chat.rpc.ts:41-244`). Real import declarations outside the declaring file use only `ChatRpcs`, `TurnRequestStatus`, and `SendMessageRpc`; the five individual RPC declarations are currently reached only through `ChatRpcs` plus JSDoc examples. Do not remove them from the RPC group, but they need not all remain flattened through the general `/public` barrel.

Size: half a day for workspace leaves; 1–2 days if introducing/migrating a Chat entry point. Risks: RPC group identity and request-name parity, desktop sidecar imports, package export maps, and numerous JSDoc examples that currently teach `/public` (`Chat/index.ts:25-37`, `public.ts:38-52`).

## Sequencing and PR shape

1. **Stage 3 spike (no PR unless green):** test one generated/internal non-union encoder boundary. Acceptance: both HTML files ≤8M, parity green, public exports unchanged. Delete the spike if it misses.
2. **Stage 4 PR:** land the one-line `Md.safe.ts` import immediately as a measured 3.06M partial reduction. If stage 3 still cannot make policy cheap, open a separate URL-policy-leaf PR rather than hiding it in this one.
3. **Stage 5A PR — BlockRepair leaves:** this is independent, proved, and should not wait on speculative HTML work. Acceptance: BlockRepair ≤8M and RSS <4GB; expected ~2.0M / 0.85GB.
4. **Stage 5B PR — protocol leaves:** agents-client `Chat.protocol` + ontology-client `Session.protocol` + root consumer migration. Acceptance: Session ≤8M, atom identity test, desktop transport test.
5. **Stage 5C PR — Chat/workspace leaves:** land after stage 4 so the measurement attributes inherited HTML removal correctly. Add a Chat entry point only if the direct imports plus inherited stage-4 change still miss ≤8M.

Do not combine stages 3–5 in one PR. They have different falsification points and rollback risks. Stage 5 should itself be three PRs: BlockRepair is a proved dependency-boundary fix; protocol extraction has state/initialization risk; Chat is primarily an inherited HTML result. Each PR should commit its before/after per-file row with the exact tsgo version and rerun the owning package proof.

## Verification checklist

- Re-derive the current `@beep/schema` floor if Effect or schema moves; report marginals and absolutes.
- Run per-file probes sequentially with `include: []` plus one `files` entry; record tsgo version on every row.
- Require the stage table's absolute exits: HTML ≤8M each, Md ≤6M, each stage-5 hot file ≤8M and <4GB RSS.
- Mirror every new export in development and publish maps where a publish map exists.
- Update all JSDoc examples/import links and run bounded `bun run docgen:local`; the current barrels contain many executable-looking examples.
- Run owning package checks/tests, schema-parity tests, and desktop chat/transport tests for agents changes.
- Preserve opaque proof issuance and RPC/Atom identities; typeperf is not permission to weaken runtime boundaries.
- Do not revisit the settled `withCodecStatics`, annotation-removal, or generic split experiments.
