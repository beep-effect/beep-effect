# Parent disposition, 2026-10-06

The eleven proposed closures are accepted with their original fixing source
SHAs retained. Eight source commits have verified #1365 squash correspondence;
three are ancestors directly. The landed witness supplements attribution and
does not relabel a pre-squash source commit as an ancestor. The historical
resource rows change only status/reason/fixSha. Native subjects remain intact,
and the doctest runtime-control qualification remains open.

# Resource landed provenance

**All eight nonancestor source repairs have verified squash correspondence in landed main.** The other three source commits are direct ancestors. No unresolved source counterexample was found. No rows were closed or tracked files edited.

Pinned HEAD `ba4fe3389462a57445a22610dfc31d45566f2898` includes main `56689307a4f5e40b272826820487ddc90e8d15df`. The final HEAD read matches. All eleven current source hashes match the prior audit and remained stable through this comparison.

GitHub REST confirms [PR #1365](https://github.com/beep-effect/beep-effect/pull/1365) merged 2026-10-01T14:06:11Z: head `959a770707549f4f9991590339f4eaf66307aa25`, squash `7efb5d520196518dc67d18dbbad3472ec42e2b74`. All eight nonancestor source commits are in the PR commit list and ancestors of its exact head. The squash is an ancestor of both pinned main and HEAD. The selected file bytes in the PR head equal the squash bytes.

Keep original `actualFixSha` attribution; attach the landed squash witness for nonancestors. An ancestry-only guard still correctly rejects those source SHAs. Parent must explicitly accept validated squash correspondence; this report does not bypass the guard or authorize an unqualified closure.

| Historical ID | Actual source SHA | Landed SHA | Correspondence |
| --- | --- | --- | --- |
| `L-RES-02:packages/tooling/tool/cli/test/allowlist-check.test.ts:27` | `4203a309f11930eb60e971931718b73b54efc653` | `4203a309f11930eb60e971931718b73b54efc653` | direct-ancestor |
| `L-RES-02:packages/tooling/tool/cli/test/create-package-lab.test.ts:96` | `e5eda0f280337cf3bf077e22b7a9bbfa9c87dbae` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |
| `L-RES-02:packages/tooling/tool/cli/test/create-package.test.ts:343` | `e5eda0f280337cf3bf077e22b7a9bbfa9c87dbae` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |
| `L-RES-02:packages/tooling/tool/cli/test/docgen.test.ts:206` | `f309935aded4bdba9dbbe0a624aae69145710a90` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |
| `L-RES-02:packages/tooling/tool/cli/test/doctest-lane.test.ts:13` | `e08b24b0042c0c1bbd274de49407e8bade354575` | `e08b24b0042c0c1bbd274de49407e8bade354575` | direct-ancestor |
| `L-RES-02:packages/tooling/tool/cli/test/goals-packet-core.test.ts:828` | `bbf8459571d5151f6e05e8564a04205f3039c70b` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |
| `L-RES-02:packages/tooling/tool/cli/test/jsdoc-inventory-detector-fixes.test.ts:107` | `37e76036e5486d84ede6931c2c371b0e68968e04` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |
| `L-RES-02:packages/tooling/tool/cli/test/person-match-model-store.test.ts:24` | `37e76036e5486d84ede6931c2c371b0e68968e04` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |
| `L-RES-02:packages/tooling/tool/cli/test/support/CommandTest.ts:32` | `4203a309f11930eb60e971931718b73b54efc653` | `4203a309f11930eb60e971931718b73b54efc653` | direct-ancestor |
| `L-RES-02:packages/tooling/tool/cli/test/sync-data-to-ts.test.ts:239` | `81f4119e9c09f6514f49505f23cd33328c9bba42` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |
| `L-RES-02:packages/tooling/tool/cli/test/tsconfig-sync.test.ts:45` | `058e59a4745980a99975e3a9124bef29cb5a1c5f` | `7efb5d520196518dc67d18dbbad3472ec42e2b74` | verified-squash-correspondence |

## Identity evidence

Two nonancestor files (goals-packet-core and model-store) are byte-identical across the repair commit, PR head, squash, main and current source. The other six have exact constructor AST identity across those revisions. All eight additionally have identical resource-ownership calls/helper references and test-title sequences from source to landed. No closure is inferred from matching filenames or missing symbols. The source-parent and squash-parent bytes plus both inspected repair diffs are hashed and their ownership changes retained in JSON.

- `allowlist-check.test.ts`: Whole file byte-identical from source4203 through landed/PR head/main/current; six scoped roots persist. It predates #1365.
- `create-package-lab.test.ts`: Exact temporaryRepository subtree and all resource/cwd/helper call/reference signatures match. Source/landed whole-file differences only retire UnknownFromJsonString codecs; setup still follows shared directory/cwd ownership.
- `create-package.test.ts`: Exact temporaryRepository subtree and resource/helper call coverage match. Whole-file differences only retire UnknownFromJsonString codecs; .git remains after shared acquisition.
- `docgen.test.ts`: Exact temporaryRepository subtree and resource/helper call coverage match. Both old constructors removed by source and landed patches; current single constructor has scoped directory then cwd bracket then .git. Source/landed differences only retire UnknownFromJsonString codecs. Later28b28fa adds barrel/re-export fixture assertions and writes in an already-owned case; constructor and ownership signatures unchanged.
- `doctest-lane.test.ts`: Source is a genuine ancestor; source/landed diffs only add vitest/config augmentation and update resolveConfig result access from vitestConfig to test, including child eval text. Ownership-call/reference sequence and titles unchanged. Dedicated cancellation-control proof remains absent as previously qualified.
- `goals-packet-core.test.ts`: Whole file byte-identical from source through PR head/squash/main/current; all six roots scoped. Source and landed diffs both replace six unscoped roots and remove four success-only root removals.
- `jsdoc-inventory-detector-fixes.test.ts`: Exact acquireFixtureRepo subtree and resource call sequence match: bracket removal with orDie before manifest/tsdoc/package writes. Remaining whole-file differences replace the retired Unknown JSON codec with Schema/flow/Result.
- `person-match-model-store.test.ts`: Whole file byte-identical source/PR head/squash/main/current; exact temporaryRoot subtree retains immediate acquisition and removal.orDie rather than ignore.
- `support/CommandTest.ts`: Whole file byte-identical from source4203 through PR head/squash/main/current. Shared temporaryWorkingDirectory installs directory removal before cwd mutation; LIFO restores cwd before root removal. Shared dependency of four selected callers is present without requiring a new helper.
- `sync-data-to-ts.test.ts`: Exact temporaryRepository and registeredTarget subtrees plus resource/helper call coverage match. Source/landed whole-file diff only updates two generated codec expectation strings; native archive scoped root also persists.
- `tsconfig-sync.test.ts`: Exact temporaryRepository subtree and resource/helper coverage match. Whole-file differences retire Unknown codec and remove two retired Yaml test-kit alias expectations; directory/cwd/.git ordering unchanged.

The single later selected-file change is docgen at `28b28fa551a4aa30c3cfd5b5a3a899a739328aa2` (#1389). Its barrel fixture writes/assertions stay within the existing owned test scope. Exact constructor AST and ownership-call signatures are unchanged through main and HEAD. Other selected files have no later file changes after the squash.

## Source hashes

| File | Source repair blob SHA-256 | Squash blob SHA-256 | Current source SHA-256 |
| --- | --- | --- | --- |
| `allowlist-check.test.ts` | `708ae6dc56d9cd761d852c2788a74b70a2ea93bab54ea483fbb096402b45d9f6` | `708ae6dc56d9cd761d852c2788a74b70a2ea93bab54ea483fbb096402b45d9f6` | `708ae6dc56d9cd761d852c2788a74b70a2ea93bab54ea483fbb096402b45d9f6` |
| `create-package-lab.test.ts` | `bbcebd17c51c904d0345689ab0e070e7d750d2cb6b2243ec82df3967ec7d37d0` | `4796142ad176212795465ec8d7bbce3382d6a0801dfca73715916829d09e990c` | `4796142ad176212795465ec8d7bbce3382d6a0801dfca73715916829d09e990c` |
| `create-package.test.ts` | `6724e5f9c70bea696da6f041edf11ffe3c464f07b84f08dd827bd08958773606` | `7f65ba4721253369a4326688bd7e474ef45b15b997d08e8b013d2c50590c688a` | `7f65ba4721253369a4326688bd7e474ef45b15b997d08e8b013d2c50590c688a` |
| `docgen.test.ts` | `febc686dc1c54fa328754f9762116781ebd35061d87a747365e627e6d5d389d9` | `9265a4d8f155c4cdad45678aa19b7be7aa6e7e8fb6eef804002f79d4da43d9d7` | `f2adf813dfc419c3f1e0260c0904d46f6195f643366d13d0434a612d15ed1f19` |
| `doctest-lane.test.ts` | `4cbb1dd40917d943c4f3ddb08b7479934ea6d9f988f09cbd714a0ec8cba59cb4` | `a0cfc5b457465fc97d27dad8d97336a8de6d99dd73c5eee561352e16a12d4d30` | `a0cfc5b457465fc97d27dad8d97336a8de6d99dd73c5eee561352e16a12d4d30` |
| `goals-packet-core.test.ts` | `330b3a8145391d967faf7fb37ba087beb69fc1da4030fc9602ed2399fb60023c` | `330b3a8145391d967faf7fb37ba087beb69fc1da4030fc9602ed2399fb60023c` | `330b3a8145391d967faf7fb37ba087beb69fc1da4030fc9602ed2399fb60023c` |
| `jsdoc-inventory-detector-fixes.test.ts` | `03519242943de29f1042a22a6da628e3c53c672f662e9306df2014761bb6874e` | `540eb3562be0a8892e97416f0638dd72d2e8407695ec79c70405b2c622807e72` | `540eb3562be0a8892e97416f0638dd72d2e8407695ec79c70405b2c622807e72` |
| `person-match-model-store.test.ts` | `78a32aa09d24c9dedfbf791d44308747d0d8911edad69d6f1662e1267f04650a` | `78a32aa09d24c9dedfbf791d44308747d0d8911edad69d6f1662e1267f04650a` | `78a32aa09d24c9dedfbf791d44308747d0d8911edad69d6f1662e1267f04650a` |
| `support/CommandTest.ts` | `64fc6b05f721ef249ddc20d66afb800cc32d2cd7941fa4d7b12b4ee84370fbb1` | `64fc6b05f721ef249ddc20d66afb800cc32d2cd7941fa4d7b12b4ee84370fbb1` | `64fc6b05f721ef249ddc20d66afb800cc32d2cd7941fa4d7b12b4ee84370fbb1` |
| `sync-data-to-ts.test.ts` | `61211643d81ad915b125f2a2d6682057587f0f279ab7601cbf185e22c6f2d997` | `100ee4fe5943584511117c6e60226cc749ae2fbc968035215acef1835da85064` | `100ee4fe5943584511117c6e60226cc749ae2fbc968035215acef1835da85064` |
| `tsconfig-sync.test.ts` | `9a70c2a54837d4f097c8a923e82783336e84bfa30035b080ecf72b7ad0646eed` | `6fa582dfe69ea546e87851a59656e036a2e1be4f79ce76332b711b0d5067a28f` | `6fa582dfe69ea546e87851a59656e036a2e1be4f79ce76332b711b0d5067a28f` |

The JSON records timestamps and source-parent, squash-parent, PR-head, main and current blob hashes; exact helper subtree text/AST hashes; caller and test-title coverage; bounded known-file history; source/landed patch excerpts; final source stability reads; and exact command arguments. AST identity uses TypeScript syntax kinds and terminal token text, excluding only coordinates/trivia.

Commands: read-only `git merge-base --is-ancestor`, `git show <sha>:<exact-file>`, `git show <source-or-squash> -- <exact-file>`, bounded `git log <squash>..<HEAD> -- <exact-file>`, and `gh api repos/{owner}/{repo}/pulls/1365` plus its paginated commits endpoint. GraphQL was rate-limited; canonical REST succeeded. An initial guessed repository REST namespace returned 404 and was corrected.

## Proof limits

Original repair receipts remain the runtime evidence and keep their recorded versions/source attribution. No runtime tests or package checks were run here. Static correspondence does not prove a new current-runtime result. The doctest row still lacks a selected dedicated cancellation-control receipt; its upstream ownership repair and ordinary package receipt retain the prior qualification. No source counterexample remains unresolved, but that proof limitation remains.

Graft saved approximately 1,020 tokens (one targeted call). Previous reports and all no-findings/fixed ledger rows remain untouched.

Private full-evidence JSON SHA-256: `b8904ece4737ed1d03943e925710fc91a2806703f79dcfb408fcdb16e44e2ca5`.
