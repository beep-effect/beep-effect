# Prospective v5 literal prompt rendering prevention

Native local prevention follow-up, verified at `2026-09-09T06:53:37.927318+00:00`. The authorized mutable target was only the never-launched private `~/.cache/beep/boolean-creep/durable-sweep-v5.py`. New regression artifacts are confined to `~/.cache/beep/boolean-creep/regressions/r28-v5-literal-prompt/`. This receipt is the only new packet file from the follow-up. No controller, census, correction, model or service was launched.

Frozen source pins remain HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7` and origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. This work does not supply census coverage, a round verdict, canonical disposition, independent P3 approval or dry-round credit.

## Verified defect and minimal change

V5 previously copied its configured runner and replaced only the template path. That runner performed prompt substitution through Bash `${prompt//pattern/$value}`. With `patsub_replacement` enabled, the UI correction's intended `items.length===1 && indicator!==dot` became `items.length===1 {{LANE_EXTRA}}{{LANE_EXTRA}} indicator!==dot`. The offline regression reproduces that exact failure from the unchanged runner bytes.

V5 now has one pure `literal_prompt_runner` copy transformation and one changed call site. It verifies that the original template-path assignment and rendering block each occur exactly once, then replaces only those regions in the new private runner copy. An unexpected runner shape fails before that copy is written. The configured runner and all already-frozen copies remain unchanged.

The replacement rendering block passes all six values as quoted positional arguments to an embedded Python renderer. It reads the template as bytes and performs a single substitution pass with a callable replacement. Ampersands, backslashes, dollars, quotes, Unicode and newlines are data. Placeholder-like text inside an inserted value is preserved literally instead of being interpreted by a later substitution. The existing template trailing-LF convention is retained: remove the template's terminal LFs before substitution, then append one final LF; terminal newlines inside values remain intact.

The runtime preflight requires the template's placeholder set to be exactly `LANE`, `ROUND`, `SOURCE_SHA`, `AREAS`, `SEEDS` and `LANE_EXTRA`. It writes the rendered bytes, rereads the file, and requires exact byte equality before continuing. On success it logs only the rendered SHA-256 and byte count. A missing/unknown template placeholder or differing readback exits nonzero under the runner's existing `set -euo pipefail`, before its Grok invocation. Known placeholders may repeat, as they do in the existing template.

The controller's AST outside the added pure function and the intended copy call is unchanged. The generated runner's bytes before and after its rendering block are unchanged apart from the existing frozen-template path rewrite. This preserves corpus selection, generated exclusions, owner roots, max-turns rules, seed creation/filtering, extra owner instructions, model/default/resume arguments, provider routing, four-worker concurrency, provider-exhaustion behavior, validator invocation and execution-receipt logic. The rendered-prompt checksum is an additional private runner-log line; this patch does not claim to add that field to the existing execution receipt schema.

## Exact before/after provenance

| Artifact | SHA-256 |
| --- | --- |
| Private v5 before | `0426b31280895c4f7a063179066ead64fb61ac6257f189b51ecff114c81cf8cf` |
| Private v5 after | `0006c3aa7f8f207ce31633b31c74dd18ef0412a9cc9e3a61b45de7818f0f5760` |
| Private minimal unified diff, `durable-sweep-v5.patch` | `191238377425706dfd6ec0b4b8e78efc1cef596641a62e04daf50e887473dec1` |
| Unchanged configured runner / regression `runner.before.sh` | `17ad9e5af9f7849d2c057c2251719d799aff5de1bf3d52988a2765d4755e3796` |
| Unchanged template / regression `template.md` | `6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b` |
| Regression script, `test_literal_prompt.py` | `6a854909da42bd5e9d938901c052274cb835595b69fb6755869e1077895c235e` |
| Regression results, `regression-results.json` | `802183dd218db13fb657e711ad825fa09417c553dbda9f908df43c5a5f8ec84a` |
| Regression output, `regression.log` | `3a946e623851d6fbf1cdc01d45de11039c255bda19342ec633dc3e99bc1ae55c` |
| Frozen-artifact baseline, `frozen-artifacts.before.json` | `646334cfd3b1204341e76973f99dae174e13e4c356d5411e28955a2dc3491518` |
| Final private verification, `verification.json` | `45460620056a9cb9caa6afa92ab03311e2ea6f60eccd7d01823291413792757a` |

The private regression directory also retains exact `durable-sweep-v5.before.py` and `durable-sweep-v5.after.py` snapshots with the respective hashes above. Private paths are sanitized here; no session, machine or request identifiers are included.

## Executed local regression checks

Executed once, exit 0:

```sh
python3 ~/.cache/beep/boolean-creep/regressions/r28-v5-literal-prompt/test_literal_prompt.py
```

All 13 test methods passed, covering 18 render cases. The tests compile only the pure helper definition extracted from the v5 AST. They execute isolated rendering fragments and an inert post-preflight marker; they never execute a controller's top level or a generated runner's model invocation.

1. Reproduce the exact historical ampersand corruption with the old runner fragment.
2. Preserve the original UI expression literally with the corrected fragment.
3. Preserve ampersands, backslashes, dollar syntax, single/double quotes, Unicode and multiline values separately in every substitution.
4. Preserve special characters in all six values simultaneously.
5. Preserve shell command-substitution/backtick text as data; the probe file is never created.
6. Preserve inserted placeholder text without recursive expansion.
7. Preserve empty payloads and value newlines across zero, one, multiple and CRLF template endings.
8. Reject an unknown template placeholder before the post-preflight marker.
9. Reject a missing template placeholder before the post-preflight marker.
10. Inject corruption after writing and prove the readback gate fails before the marker.
11. Reject missing or duplicate runner transformation regions.
12. Verify the runner's surrounding bytes and `bash -n` syntax.
13. Verify the controller's remaining AST, including all scope, seed, prompt, route and concurrency logic, is unchanged.

Successful render cases compare exact output bytes against an independent token-by-token oracle and verify the emitted SHA-256/byte-count line. The readback-failure test deliberately modifies only its temporary fragment to simulate corruption; the production copy transformation is unchanged by that test. The full v5 file also passed Python compilation without execution.

## Preservation and limits

A before/after comparison checked 134 frozen artifacts with zero changes: the configured runner and pointer, existing private sweep controllers, the R28 public reports/receipts/map/summary, the R28 frozen primary/correction inputs, the current template, and both finalized execution/coverage audit files. Both source refs were rechecked and match the frozen pins. No source, tests, current packet operators, current designs, inventory, status, archives, Git index/refs or launched jobs were changed.

The finalized execution/coverage audit remains byte-identical: Markdown `767110abebdfc4e76995b8254262bdf4ea038872fcb0ff8f6af29006ac93b2c4`; JSON `b6b79bca83c2896492bf4eeb1b46769c3d03001feef00c6ecfc4f5b9b27ff42e`. Its UI rendering exception remains part of the historical evidence. This prospective v5 prevention does not rewrite that evidence or confer additional coverage/review credit.
