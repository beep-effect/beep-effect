/**
 * The change-event constant table (launch sitting Rulings 8 and 12a).
 *
 * **Details**
 *
 * One typed row per entry of
 * `explorations/beep-ci-operational-ontology/research/control-interventions.yaml`:
 * its id, `landedAt`, `mergeCommit` and the series its first
 * ADOPTION-QUALIFIED caveat partitions. The lab never parses the YAML (the P2
 * precedent: typed constants asserted against pinned bytes); the reading
 * fails typed when the ledger's bytes stop hashing to
 * {@link changeEventLedgerSha256}. iv-870, iv-929 and iv-1006 predate the
 * tier wording and are local.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256Hex } from "@beep/schema/Sha256";
import { DateTime } from "effect";
import { ChangeEventRow } from "./Schemas.ts";
import type * as A from "effect/Array";
import type { ChangeEventId, ChangeEventSeries, GitCommitSha } from "./Schemas.ts";

/**
 * SHA-256 of the change-event ledger bytes the constant table restates.
 *
 * **Example** (Read the pinned ledger digest)
 *
 * ```ts
 * import { changeEventLedgerSha256 } from "@/kpi/ChangeEvents"
 *
 * console.log(changeEventLedgerSha256.slice(0, 12)) // "f520b302424f"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const changeEventLedgerSha256: Sha256Hex = Sha256Hex.make(
  "f520b302424f871804c050d9698dcb8e10f19c081fd3dc48a9a19932308d724d"
);

const local: A.NonEmptyReadonlyArray<ChangeEventSeries> = ["local"];
const hosted: A.NonEmptyReadonlyArray<ChangeEventSeries> = ["hosted"];
const both: A.NonEmptyReadonlyArray<ChangeEventSeries> = ["local", "hosted"];

const row = (
  id: ChangeEventId,
  landedAt: string,
  mergeCommit: GitCommitSha,
  tiers: A.NonEmptyReadonlyArray<ChangeEventSeries>
): ChangeEventRow => ChangeEventRow.make({ id, landedAt: DateTime.makeUnsafe(landedAt), mergeCommit, tiers });

/**
 * All 44 change-event rows, in ledger order.
 *
 * **Example** (Find the #1427 row's series)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { changeEventTable } from "@/kpi/ChangeEvents"
 *
 * const row = A.findFirst(changeEventTable, (entry) => entry.id === "iv-1427-push-first-publish")
 * console.log(row._tag) // "Some"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const changeEventTable: A.NonEmptyReadonlyArray<ChangeEventRow> = [
  row("iv-870-weighted-admission", "2026-08-27T19:52:03Z", "debbbb51f77ae10015788dec0b819f12b96c3552", local),
  row("iv-929-origin-lock-retirement", "2026-08-31T08:20:46Z", "e76c4db079e62155b1c03e8b77a8b210cac6e1d2", local),
  row("iv-1006-wave-order", "2026-09-04T05:34:17Z", "d7a08b513b67a97f2554689c8d701addce132d8a", local),
  row("iv-874-publish-before-admission", "2026-08-30T02:39:33Z", "d324544d3a3b333b8ef1f9eb225df2d065b70338", local),
  row("iv-871-docgen-direct-package-check", "2026-08-30T08:34:57Z", "4b8f3c4f600bcec006a892c93e2de77adff13664", both),
  row("iv-891-per-user-runtime-root", "2026-08-30T09:20:21Z", "187f72069e8dcb1bb1b7cdf6536b467e1604d38c", local),
  row("iv-894-invariant-runtime-root", "2026-08-30T10:23:55Z", "894393a934f1e9491d005dde72bec8de68061114", local),
  row("iv-953-turbo-remote-read-isolation", "2026-09-03T08:28:17Z", "484e24c2e984be3d6383ba6d86c493265fecb4f0", local),
  row("iv-982-hosted-lint-unit-shards", "2026-09-03T19:35:51Z", "9ee1e38ee98d89c66131abf2f38b442b3147ef7c", hosted),
  row(
    "iv-1007-deprecated-apis-tooling-shards",
    "2026-09-04T03:09:20Z",
    "770a3dce10a741ddfe062a37a8830d618d0d5eb9",
    both
  ),
  row("iv-1019-proof-reuse-key-narrowed", "2026-09-09T00:51:25Z", "52fcc8d1353db9481ef9edb6cc9619500f95568d", local),
  row("iv-1022-proof-reuse-key-full-env", "2026-09-09T02:41:53Z", "ed66cbce8f17111458f8b4801ec417d9adafaabd", local),
  row("iv-1021-fallow-health-lane", "2026-09-09T03:33:07Z", "74efb548f16aa2c37f14cb3ea8b71ef47d2315ab", local),
  row(
    "iv-1029-package-scripts-policy-checks",
    "2026-09-09T08:00:35Z",
    "f36be8586798aa1e9107a8cb6fc5a6cea133b2eb",
    both
  ),
  row("iv-1050-heavy-pool-on-demand", "2026-09-09T09:13:51Z", "de84d4218e935d1dae6519a9d537ba9468b18eff", hosted),
  row("iv-1053-check-typechecks-tests", "2026-09-09T11:50:17Z", "c12c6ae651a3facc3f6e6a5190fd84670ef8a014", both),
  row("iv-1049-quality-lanes-pr1", "2026-09-09T12:04:17Z", "bed30c6adf3beed7de8538209fbdc84d26a3b8ce", local),
  row(
    "iv-1054-storybook-config-typecheck-lanes",
    "2026-09-09T13:46:50Z",
    "d68f1a11dd41579660a6c72f3d3e060d6b61352d",
    local
  ),
  row(
    "iv-1061-docgen-full-proof-metadata-check",
    "2026-09-09T17:45:48Z",
    "5bd8c7f4b6c6d9393d0dcff62b1eacb9ae06a0dd",
    both
  ),
  row("iv-1064-heavy-build-dispatch", "2026-09-09T18:53:05Z", "c5b5a6c1e2d970dd424dbe5ae940cecc5292511e", hosted),
  row("iv-1079-policy-lint-on-turbo", "2026-09-10T06:49:51Z", "117583a01b45902776f94b64901977b3f8836a2e", local),
  row(
    "iv-1080-api-docs-docgen-config-removed",
    "2026-09-10T07:48:11Z",
    "43a625dacd5f934e26e5eccfac20c244d8171faf",
    both
  ),
  row("iv-1067-effect-vitest-cheap-gate", "2026-09-10T22:38:37Z", "955528adb46b8f62d311f5e06db2acfa9642aa08", local),
  row("iv-1068-cache-policy-gate", "2026-09-10T22:38:53Z", "2086a0a090c1ed441cc5099defda4acbd53a2ee0", local),
  row(
    "iv-1098-effect-vitest-in-lint-policy",
    "2026-09-12T05:45:35Z",
    "dde5a31837e48d961509cbe03d26497c89a5277a",
    local
  ),
  row("iv-1112-coverage-fixture-owners", "2026-09-12T12:57:03Z", "441b31f668fc4949307b9f7dae299a5d8350e6aa", both),
  row("iv-1102-turbo-policy-plan", "2026-09-12T23:26:03Z", "e08b24b0042c0c1bbd274de49407e8bade354575", both),
  row("iv-1141-heavy-pool-containment", "2026-09-16T00:18:38Z", "2abd88d290f8c8eb4dbce81271d311b6f19d2ce1", hosted),
  row("iv-1146-turbo-input-isolation", "2026-09-16T08:01:40Z", "678cf4198280d2f1effde89c1ac094f4f7abd90d", local),
  row("iv-1155-heavy-admission-gate", "2026-09-16T13:15:22Z", "d7e8c46f4da1e91972c42ec6520715f2d4a7cc4f", hosted),
  row("iv-1165-heavy-skip-satisfied", "2026-09-16T16:08:36Z", "1e5d570bfe55f26f52243dd9615cd2691ce7ab3a", hosted),
  row("iv-1182-identity-lint-inputs", "2026-09-22T08:54:47Z", "f25286554f3d0335aeaaeb316a4fce481537cbb4", local),
  row("iv-1195-repo-cli-vitest-shards", "2026-09-22T12:49:42Z", "7a2bb50a2b883bf43895978d41c87b1da397c556", hosted),
  row(
    "iv-1221-fallow-hash-exclusion-shared-cache",
    "2026-09-25T06:08:47Z",
    "5c768538e434336885d324cbf56d04fc2684959b",
    local
  ),
  row("iv-1232-shared-turbo-cache-dir", "2026-09-25T11:57:07Z", "41d6c9eb97e266d0ecf9607ef1998a009e8aed01", local),
  row(
    "iv-1233-pilot-dependency-lint-uncached",
    "2026-09-25T16:09:11Z",
    "df5b20d19e7df024ddef42b14b84b6619ada4687",
    both
  ),
  row("iv-1269-cache-policy-seed", "2026-09-25T21:46:53Z", "b2a654bc4347d33862d815368e7ca56a9c86da28", local),
  row("iv-1364-spot-pool-spread", "2026-10-01T12:05:00Z", "a69b1956eed9949b314c64b93f2d3d3eabf11283", hosted),
  row("iv-1381-app-env-out-of-build-hash", "2026-10-01T16:16:58Z", "43585c73b41323db538160fa5584431eb5316379", local),
  row("iv-1380-shadcn-lint-lane", "2026-10-01T20:15:16Z", "736f6f7b0c210b4861c12c1b614958b1751b8f78", local),
  row("iv-1384-rerun-runner-loss", "2026-10-01T20:15:29Z", "f05e1a698d4116ec29adec33111c1195228c5c97", hosted),
  row("iv-1389-deprecated-apis-tool-shards", "2026-10-02T18:58:02Z", "28b28fa551a4aa30c3cfd5b5a3a899a739328aa2", both),
  row("iv-1427-push-first-publish", "2026-10-06T01:36:13Z", "01d8c18f314661a7957ef6420b2180ffb29804d1", local),
  row("iv-1422-spot-pool-drop-r6a", "2026-10-06T02:22:00Z", "721d1239b193b8ce3899fd5243e00fca0bd5a378", hosted),
];
