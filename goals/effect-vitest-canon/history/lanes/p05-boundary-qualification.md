# P0.5 boundary qualification

Status: complete. Read-only qualification; no source/config/manifest or git changes.
Scope: this report and new private `p05-boundary-qualification-astra*` files only.
Live permission profile: unrestricted filesystem, approval never; no managed-profile mismatch.
Source of truth: `~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem`.

## Evidence

- Report created before investigation. Existing workspace resolver matrix will be treated as established evidence, not repeated.
- Existing promotion evidence confirms source aliases bypass the null block; this qualification does not dispute or rerun that workspace matrix.
- Control manifest has exact source/publish ConformanceLedger facade entries plus matching null deep blocks; retained ConformanceLedger dist files exist.
- Additional binding clause: `standards/architecture/GLOSSARY.md:307` says “only canonical subpaths are public.” This governs consumer imports; it does not say every development resolver must make private files unreachable.
- `standards/architecture/08-testing.md:201–204` expressly permits infrastructure test-kits across slices and requires no product promotion record; repo-cli-only test aliases are not automatically a test-kit mandate.
- Private evidence: `~/.cache/beep/effect-vitest-canon/p05-boundary-qualification-astra-8dkqnjnx/`; 32 initial inputs hashed. Active Memory source excluded from the read-only control.
- Isolated source consumer links the actual package, with only its own small tsconfig in ancestry; Node v24.20.0 and Bun 1.4.2 resolve the facade and reject all six deep role/index variants (extensionless, `.ts`, `.js`) through both CJS and ESM resolver APIs.
- Publish fixture copies the complete actual `publishConfig.exports` map into effective `exports` and copies existing ConformanceLedger dist files byte-for-byte; the same checks pass. This is metadata/resolver proof, not a build, pack, publication, or execution proof.
- Public lookalike `ConformanceLedger.ts` is not the declared facade. Node ESM returns a nonexistent wildcard target (checked with `existsSync`); this is not successful public resolution. Bun and Node CJS reject it.
- Graft plus live import readback found nine actual ConformanceLedger imports, all using the explicit public facade, and no current MemoryFileSystem package imports. JSDoc examples use the facade; the sole deep-looking Graft hit is expected error text, not an import.

## Binding requirement and scope decision

**Conclusion (a): full promotion can meet binding requirements with explicit source/publish exports, isolated consumer proofs, a curated module surface, canonical consumers, and an honest inherited workspace-alias limitation.** No cited binding clause makes global alias/law/Vitest enforcement repair a prerequisite to D8. This is a scope interpretation, not a waiver or a claim that workspace private-import enforcement passes.

| Binding authority | Brief exact clause | Consequence here |
| --- | --- | --- |
| `standards/ARCHITECTURE.md:402–405` | “wildcard exports may remain during migration for compatibility”; “explicit subpaths are the only canonical boundary contract” | Retain the inherited wildcard; make the new named facade canonical. |
| `standards/architecture/DECISIONS.md:426–428` | “not a requirement to publish placeholder exports”; “they are transitional only” | No invented `/public` or `/test` facade just to imitate another family. |
| `standards/ARCHITECTURE.md:696` | “`*.test-kit.ts`, optional `fixtures/`, `layers/`, `index.ts`” | Use earned test-kit roles and the facade. |
| `standards/ARCHITECTURE.md:708–711` | “`@beep/repo-cli` exposes package root and explicit”; “deep role files are private” | The source-only CLI test-alias prescription names repo-cli, not all test-kits. |
| `standards/architecture/GLOSSARY.md:307` | “any consumer outside the owning package: only canonical subpaths are public” | An actual external private-role import is a violation even if an alias resolves it. |
| `standards/architecture/08-testing.md:201–204` | “infrastructure that any slice may import without promotion”; “need no promotion record” | In-memory test infrastructure belongs in test-kit; no shared-product promotion gate. |
| `standards/ARCHITECTURE.md:1914–1916,1934` | “mechanisms that must obey it”; “Target doctrine with transitional roots allowed” | The alias limitation is real downstream enforcement debt, not a public export. |
| `standards/ARCHITECTURE.md:1947,1954–1958` | “should not trigger broad manual sweeps”; “do not require whole-package or whole-family migration by default” | Clean this module's exports, facade, consumers and adjacent proof; do not infer a global rewrite requirement. |

The additional schema-specific role/export doctrine (`standards/architecture/07-non-slice-families.md:298–305`) names `@beep/schema`; it is not a stronger test-kit resolver mandate. The Effect-library organization pattern describes upstream layout, not a contradictory global resolver gate. Architecture packet rationale (`standards/architecture/README.md:19–27,40–49`) preserves the same transitional distinction.

The earlier promotion report's **observed bypass is valid**; its conclusion that global blocking integration must precede promotion is not established by these laws. This report does not alter that receipt or relabel its unfinished promotion/package gates as passed. Root retains the integration/scope decision. The existing user requirement to ask before global Vitest configuration changes remains applicable if Root later chooses that separate work; this qualification requests no new approval.

## Isolated qualification

`BQ` below denotes `~/.cache/beep/effect-vitest-canon/p05-boundary-qualification-astra-8dkqnjnx`.
Source fixture: `$BQ/source-consumer/node_modules/@beep/test-utils` links the actual package. Both consumers have a private ESM package marker and explicit small tsconfig with empty `paths`, no `extends`; ancestry inspection finds only that fixture config, no workspace config.
Publish fixture: `$BQ/publish-package/package.json` substitutes the **entire unmodified captured** `publishConfig.exports` as effective `exports`; 16 retained ConformanceLedger dist files are copied and hash/content checked. No other publish metadata is inferred or repaired.

Exact control maps (`packages/tooling/test-kit/test-utils/package.json:17–20,82–85` at capture):

```text
source:  "./ConformanceLedger": "./src/ConformanceLedger/index.ts"
publish: "./ConformanceLedger": "./dist/ConformanceLedger/index.js"
both:    "./ConformanceLedger/*": null
wildcard source: "./*": "./src/*.ts"; publish: "./*": "./dist/*.js"
both:    "./internal/*": null
```

| Isolated route | Public facade, CJS + ESM | Six private variants, CJS + ESM |
| --- | --- | --- |
| Actual source package / Node 24.20.0 | 2/2 existing `src/ConformanceLedger/index.ts` targets | 12/12 rejected, `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| Actual source package / Bun 1.4.2 | 2/2 same existing source target | 12/12 rejected, CJS `MODULE_NOT_FOUND`, ESM `ERR_MODULE_NOT_FOUND` |
| Exact publish-map fixture / Node | 2/2 existing `dist/ConformanceLedger/index.js` targets | 12/12 rejected, `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| Exact publish-map fixture / Bun | 2/2 same existing dist target | 12/12 rejected, respective CJS/ESM not-found codes |

The six private variants are `ConformanceLedger/{ConformanceLedger.test-kit,index}` each extensionless, `.ts`, and `.js`. An additional public-name lookalike `ConformanceLedger.ts` is not the declared facade: Node ESM yields a nonexistent `*.ts.ts`/`*.ts.js` target; existence is explicitly checked, so that is not counted as a passing public import. Other routes reject it.
Separate private fault controls remove **only** `./ConformanceLedger/*: null` from copied metadata. All four Node/Bun source/publish combinations then resolve the existing extensionless private role through both APIs. This verifies null-block effect despite Bun's generic error codes. Actual package metadata and exact-map fixtures remain intact.

There are 64 main resolver observations plus eight fault-control resolutions. Source isolation removes the already-established workspace bypass. These results do not execute package code, typecheck its public types, run Vitest, build/pack/publish an artifact, or qualify package-root exports; they qualify the named control boundary only.

## Consumer and tooling interpretation

- Live import readback after Graft found nine ConformanceLedger imports through the explicit facade (eight foundation tests plus the package's own test), no private imports, and no MemoryFileSystem package imports at that inventory time. Examples: `packages/foundation/modeling/html/test/ConformanceLedger.test.ts:1`, `packages/tooling/test-kit/test-utils/test/ConformanceLedger.test.ts:7`. The latter's line 333 is error-message data, not a deep import. This is a scoped current-consumer inventory, not a whole-repo dynamic-import audit or a scan of the active writer's eventual result.
- Source alias `tsconfig.json:70` and generated Vitest alias `vitest.aliases.generated.json:26` map `@beep/test-utils/*` to `src/*`. `TsconfigSync.plan.ts:517–529,580–590` omits absent/null targets but retains the positive wildcard; `TsconfigAliasTargets.ts:219–227` maps a non-relative target to absence. `vitest.shared.ts:82–106` consumes generated aliases. These aliases **do not enforce the null block**.
- `Laws/EffectImports.ts:533–545` likewise treats positive wildcard coverage as sufficient without null precedence. Its surrounding mapping pass iterates foundation root exports (`:580–589`); it is not evidence of a general test-kit deep-import validation gate. No law scan or Vitest private-import run was performed or claimed.
- A hypothetical reachable private path does not establish an actual violating consumer. Any new external Memory private-role import would violate the public-boundary contract and must be corrected locally even if local compilation succeeds.

## What scoped MemoryFileSystem acceptance must still demonstrate

1. Exact source `./MemoryFileSystem -> ./src/MemoryFileSystem/index.ts` and publish `./MemoryFileSystem -> ./dist/MemoryFileSystem/index.js`, with `./MemoryFileSystem/*: null` in both maps; explicit canonical aliases generated through the existing mechanism where required, without claiming wildcard privacy.
2. Curated facade exports the intended runtime `make`/`layer` and only deliberately required public types, not implementation state/role barrels or deferred seed/fault/inspect APIs. Tests and examples use `@beep/test-utils/MemoryFileSystem`; any internal relative imports remain inside the package.
3. Once authored, exact-module source and built/publish consumer proofs: public facade resolves and its expected API actually imports/runs in the appropriate supported harness; private role/index spellings reject under isolated export resolution; no newly introduced external private consumers. Retained-control metadata proof cannot stand in for the new module's build/runtime proof.
4. Original D8 Node/Bun/Memory conformance, promoted regression/type/lint/docgen/architecture and full package proof still apply. Root owns integration/publication. The alias limitation must be reported explicitly; no failing mandatory command may be relabeled passed.

## Commands, integrity and handoff

All probes used non-login shells; observed pins are Bun 1.4.2, Node v24.20.0, Effect and `@effect/vitest` 4.0.0-rc.112. No install/network, source/config edit, package-verify, law/alias generator write, git, inbox, secret, agent, or publication operation occurred.
Exact setup/verification commands were `python "$BQ/setup-consumers.py"`, `python "$BQ/setup-counterfactual.py"`, and `python "$BQ/verify-results.py" > "$BQ/verification.log"`; all exited 0.
For each of `source-consumer`, `publish-consumer`, `source-without-null-consumer`, `publish-without-null-consumer`, cwd was `$BQ/<consumer>` and commands were `node probe.mjs > "$BQ/<matching-mode>-node.json"` and `bun probe.mjs > "$BQ/<matching-mode>-bun.json"`; all eight exited 0. Probe exits capture execution; `verify-results.py` additionally asserts every expected resolution/rejection, exact target/map, dist copy, pin and config ancestry.
Read-only discovery encountered absent `.patterns/effect-laws.md` and a guessed promotion-contract filename; existing architecture/packet authority was read instead. No files were created to mask those absent names.
Hash receipts: `$BQ/inputs.before.json`, `inputs.after.json`, `integrity.json`. **72/73 original inputs are unchanged**, including all prior lane evidence and retained control source/dist. The active writer concurrently changed only captured test-utils `package.json`: it added the four Memory source/publish facade/null entries listed in `concurrent-metadata-delta.json`. All pre-existing export entries and all other package metadata remain equal; no captured control changed, and this lane did not write that manifest.
The before/after package snapshots and complete map assertions are retained. The new Memory entries themselves are observed metadata, not qualified implementation. No pending packet phase, exception inventory or existing report was changed.
Status: complete read-only boundary qualification; option (a) is supported, with new-module acceptance still Root/source-lane work.
