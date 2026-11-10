/**
 * Schemas and data for the private home path law.
 *
 * **Details**
 *
 * The repository is public, so a tracked text file must not record a real
 * account's absolute home directory (`/home/<user>/`, `/Users/<user>/`,
 * `C:\Users\<user>\`); recorded paths use the `~`-relative form instead. A home
 * path passes only when its user is a placeholder from
 * {@link PlaceholderHomeUser} or an app route segment from
 * {@link HomeRouteSegment}, when a fleet account row in
 * {@link privateHomePathScopedUsers} names the file, or when the file is a
 * sealed archive listed in {@link privateHomePathExemptions} with its exact
 * expected count.
 *
 * **Gotchas**
 *
 * The law, its data and its tests never spell a real account: exemption rows
 * hold a count, not the matched text, and tests assemble rejected paths at
 * runtime. A new placeholder name in a fixture needs a vocabulary entry here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/PrivateHomePaths.model");

/**
 * Rule that produced a private home path finding.
 *
 * **Details**
 *
 * `private-home-path` marks a home directory whose user is not a placeholder.
 * `exemption-count-mismatch` marks every home path of an exempt archive whose
 * count no longer equals the row's expected count, including a stale row whose
 * file no longer records any.
 *
 * **Example** (Identify a private home path finding)
 *
 * ```ts
 * import { PrivateHomePathRule } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * console.log(PrivateHomePathRule.is["private-home-path"]("private-home-path")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrivateHomePathRule = LiteralKit(["private-home-path", "exemption-count-mismatch"]).pipe(
  $I.annoteSchema("PrivateHomePathRule", {
    description: "Rule that produced a private home path finding.",
  })
);

/**
 * Type-level member of {@link PrivateHomePathRule}.
 *
 * @category models
 * @since 0.0.0
 */
export type PrivateHomePathRule = typeof PrivateHomePathRule.Type;

/**
 * Home directory user names that tracked text may record.
 *
 * **Details**
 *
 * Fixture, documentation and example users (`ada`, `alice`, `dev`, `example`,
 * `fixture`, `u`, the non-ASCII `üser`), documentation placeholders (`USER`,
 * `USERNAME`, `username`, `your-user`, `YOUR_USER`), the shared Windows and
 * macOS profiles (`Public`, `Default`, `All` of `All Users`, `Shared`) and the
 * well-known accounts of hosted runners, images, containers and VMs
 * (`runner`, `RUNNER`, `runneradmin`, `ec2-user`, `ubuntu`, `pi`, `ci`,
 * `git`, `node`, `nodejs`, `vscode`, `codespace`, `linuxbrew`, `user`, and
 * `app`, the conventional container account of `WORKDIR /home/app`). These
 * pass in every file. Matching is exact and case-sensitive.
 *
 * **Gotchas**
 *
 * Role words such as `me`, `op`, `operator`, `server`, `deploy` and `dev`
 * stay global: tests and docs use them as stand-in users, and none is the
 * login of a repo-owned host. Accounts of repo-owned fleet hosts are not
 * listed here; they pass only in the files a
 * {@link privateHomePathScopedUsers} row names, so a new document cannot map
 * the fleet's account layout.
 *
 * **Example** (Check a placeholder user)
 *
 * ```ts
 * import { PlaceholderHomeUser } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * console.log(PlaceholderHomeUser.is.ada("ada")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlaceholderHomeUser = LiteralKit([
  "a",
  "Ada",
  "ada",
  "alice",
  "All",
  "another",
  "app",
  "attorney",
  "beep-private",
  "bob",
  "ci",
  "codespace",
  "consumer",
  "Default",
  "deploy",
  "dev",
  "docs",
  "ec2-user",
  "example",
  "fixture",
  "Fixtureuser",
  "fleetowner",
  "git",
  "h",
  "lawyer",
  "linuxbrew",
  "me",
  "nobody",
  "node",
  "nodejs",
  "op",
  "operator",
  "pi",
  "private-owner",
  "probe",
  "Public",
  "reviewer",
  "RUNNER",
  "runner",
  "runner-layout",
  "runneradmin",
  "server",
  "Shared",
  "someone",
  "synthetic",
  "Test",
  "test",
  "test-operator",
  "u",
  "ubuntu",
  "USER",
  "user",
  "USERNAME",
  "username",
  "vscode",
  "x",
  "you",
  "your-user",
  "YOUR_USER",
  "üser",
]).pipe(
  $I.annoteSchema("PlaceholderHomeUser", {
    description: "Home directory user name that tracked text may record: a placeholder or service account.",
  })
);

/**
 * Type-level member of {@link PlaceholderHomeUser}.
 *
 * @category models
 * @since 0.0.0
 */
export type PlaceholderHomeUser = typeof PlaceholderHomeUser.Type;

/**
 * App route segments that follow a `/home` route and are never a login.
 *
 * **Details**
 *
 * Web apps commonly nest pages under a `/home` route
 * (`router.push("/home/settings")`, `[Home](/home/dashboard)`). A home path
 * whose user segment is one of these page names is a route, not a home
 * directory, and passes in every file. Matching is exact and case-sensitive.
 *
 * **Gotchas**
 *
 * The list names pages, not people: a new route that the law reports gets an
 * entry here, never a real account name.
 *
 * **Example** (Check a route segment)
 *
 * ```ts
 * import { HomeRouteSegment } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * console.log(HomeRouteSegment.is.settings("settings")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HomeRouteSegment = LiteralKit([
  "about",
  "account",
  "activity",
  "dashboard",
  "explore",
  "feed",
  "index",
  "login",
  "logout",
  "notifications",
  "overview",
  "profile",
  "search",
  "settings",
  "signin",
  "signup",
  "welcome",
]).pipe(
  $I.annoteSchema("HomeRouteSegment", {
    description: "App page name that follows a /home route; such a path is a route, not a home directory.",
  })
);

/**
 * Type-level member of {@link HomeRouteSegment}.
 *
 * @category models
 * @since 0.0.0
 */
export type HomeRouteSegment = typeof HomeRouteSegment.Type;

/**
 * A fleet account allowed in an exact set of files.
 *
 * **Details**
 *
 * The account's home path passes only in the listed repository-relative
 * files; anywhere else it is a finding.
 *
 * **Example** (Scope a fleet account to one fixture)
 *
 * ```ts
 * import { PrivateHomePathScopedUser } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * const row = PrivateHomePathScopedUser.make({
 *   user: "worker",
 *   files: ["packages/x/test/Worker.test.ts"],
 *   reason: "fixture provider home on the worker host",
 * })
 *
 * console.log(row.files.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrivateHomePathScopedUser extends S.Opaque<PrivateHomePathScopedUser, { readonly brand: unique symbol }>()(
  S.Struct({
    user: S.String,
    files: S.Array(S.String),
    reason: S.String,
  }).pipe(
    $I.annoteSchema("PrivateHomePathScopedUser", {
      description: "A repo-owned fleet account whose home path may appear only in the listed files.",
    })
  )
) {}

/**
 * Fleet accounts allowed only in the files that already record them.
 *
 * **Example** (List the scoped fleet accounts)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { privateHomePathScopedUsers } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * console.log(A.map(privateHomePathScopedUsers, (row) => row.user)) // [ "beep", "box" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const privateHomePathScopedUsers: ReadonlyArray<PrivateHomePathScopedUser> = [
  PrivateHomePathScopedUser.make({
    user: "beep",
    files: [
      "packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.values.ts",
      "packages/agents/domain/test/ProviderInstance.test.ts",
      "packages/agents/tables/src/entities/ProviderInstance/ProviderInstance.converters.ts",
    ],
    reason: "provider-instance home path examples and their test",
  }),
  PrivateHomePathScopedUser.make({
    user: "box",
    files: ["goals/cloud-agent-readiness/history/2026-10-14-reviewer-host-access.md"],
    reason: "reviewer host access record",
  }),
];

/**
 * One sealed archive allowed to keep a fixed number of recorded home paths.
 *
 * **Details**
 *
 * `count` is the exact number of non-placeholder home paths the file records.
 * A different count, higher or lower, fails the law, so a new leak in the file
 * or a stale row both surface. The row holds no matched text, so the law never
 * spells the account it exempts.
 *
 * **Example** (Describe an exemption)
 *
 * ```ts
 * import { PrivateHomePathExemption } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * const row = PrivateHomePathExemption.make({
 *   file: "goals/x/history/evidence/capture.ts.txt",
 *   count: 1,
 *   reason: "byte-for-byte capture pinned by artifact-hashes.json",
 * })
 *
 * console.log(row.count) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrivateHomePathExemption extends S.Opaque<PrivateHomePathExemption, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    count: S.Int.check(S.isGreaterThan(0)),
    reason: S.String,
  }).pipe(
    $I.annoteSchema("PrivateHomePathExemption", {
      description: "One sealed archive allowed to keep an exact number of recorded home paths, with the seal named.",
    })
  )
) {}

const CITATION_EVIDENCE = "goals/citation-extraction-engine/history/evidence";
const CLAIM_CHECK_RESEARCH = "goals/claim-check-performance/research";
const OPENCLAW_SPIKE_4_CONFIGS = "goals/openclaw-workstation-agent/history/p0/spike-4-upgrade-rollback/configs";
const OPENCLAW_CONFIG_PREFIX_REASON =
  "archived config; 16-hex sha256 prefix pinned by logs/v2-setup.log:13-14 and v3-adjudication-of-v2.md:120";
const RUNTIME_FREEZE_REASON =
  "runtime freeze self-sealed by implementationDigest; freeze-runtime-closure.py verify compares bunExecutablePath with the executing bun";

/**
 * Sealed archives whose recorded home paths stay.
 *
 * **Details**
 *
 * Each file's bytes are pinned by a digest that no repository command
 * regenerates: a captured source or transcript listed in an `artifact-hashes`
 * or re-grounding artifact manifest, a runtime freeze bound by its own
 * `implementationDigest` and by later freezes, or an archived config whose
 * sha256 prefix a run log and its adjudication record. Editing one breaks its
 * seal, so the row keeps the recorded paths and the law fails if the count
 * changes.
 *
 * **Example** (Count the sealed archives)
 *
 * ```ts
 * import { privateHomePathExemptions } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * console.log(privateHomePathExemptions.length) // 15
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const privateHomePathExemptions: ReadonlyArray<PrivateHomePathExemption> = A.map(
  [
    [
      `${CITATION_EVIDENCE}/2026-11-08-six-form-adapter/effect-boundary-audit.md.txt`,
      4,
      "captured source retained byte-for-byte; sha256 pinned by six-form-adapter/artifact-hashes.json",
    ],
    [
      `${CITATION_EVIDENCE}/2026-11-08-six-form-adapter/typed-prototype.ts.txt`,
      1,
      "executed capture source; sha256 pinned by six-form-adapter/artifact-hashes.json",
    ],
    [
      `${CITATION_EVIDENCE}/2026-11-08-six-form-selection/capture.ts.txt`,
      1,
      "archived capture source; sha256 pinned by six-form-selection/artifact-hashes.json",
    ],
    [
      `${CITATION_EVIDENCE}/2026-11-08-six-form-smoke/screen.ts.txt`,
      1,
      "copied capture source; sha256 pinned by 2026-11-08-re-grounding-artifacts.json",
    ],
    [
      "goals/citation-extraction-engine/history/research/2026-11-08-re-grounding/grok-first-pass.txt",
      3,
      "raw model transcript; sha256 pinned by 2026-11-08-re-grounding-artifacts.json",
    ],
    [
      `${CLAIM_CHECK_RESEARCH}/composition-candidate-measurement-001.json`,
      3,
      "historical measurement pinned by composition-candidate-review-locations-001.json, which supplies the ~ aliases",
    ],
    [`${CLAIM_CHECK_RESEARCH}/implementation-runtime-coverage-001.json`, 2, RUNTIME_FREEZE_REASON],
    [
      `${CLAIM_CHECK_RESEARCH}/implementation-runtime-integrated-policy-001.json`,
      3,
      `${RUNTIME_FREEZE_REASON}; sha256 pinned by the accepted-main metadata chain`,
    ],
    [`${CLAIM_CHECK_RESEARCH}/implementation-runtime-nominal-001.json`, 1, RUNTIME_FREEZE_REASON],
    [`${CLAIM_CHECK_RESEARCH}/implementation-runtime-owner-integrated-003.json`, 1, RUNTIME_FREEZE_REASON],
    [
      `${CLAIM_CHECK_RESEARCH}/implementation-runtime-parent-001.json`,
      1,
      `${RUNTIME_FREEZE_REASON}; baseline of implementation-runtime-coverage-001.json`,
    ],
    [
      `${CLAIM_CHECK_RESEARCH}/implementation-runtime-policy-work-002.json`,
      2,
      `${RUNTIME_FREEZE_REASON}; baseline of implementation-runtime-integrated-policy-001.json`,
    ],
    [
      `${CLAIM_CHECK_RESEARCH}/implementation-runtime-predicates-001.json`,
      1,
      `${RUNTIME_FREEZE_REASON}; baseline of the integrated-policy and policy-work freezes`,
    ],
    [`${OPENCLAW_SPIKE_4_CONFIGS}/gen-A.openclaw.json`, 1, OPENCLAW_CONFIG_PREFIX_REASON],
    [`${OPENCLAW_SPIKE_4_CONFIGS}/gen-B.openclaw.json`, 1, OPENCLAW_CONFIG_PREFIX_REASON],
  ] as const,
  ([file, count, reason]) => PrivateHomePathExemption.make({ file, count, reason })
);

/**
 * One home path that tracked text must not record.
 *
 * **Example** (Construct a finding)
 *
 * ```ts
 * import { PrivateHomePathFinding } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * const finding = PrivateHomePathFinding.make({
 *   file: "docs/example.md",
 *   line: 3,
 *   column: 9,
 *   match: "/home/<user>",
 *   rule: "private-home-path",
 *   suggestion: "record the path as ~/...",
 * })
 *
 * console.log(finding.line) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrivateHomePathFinding extends S.Opaque<PrivateHomePathFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    line: S.Int,
    column: S.Int,
    match: S.String,
    rule: PrivateHomePathRule,
    suggestion: S.String,
  }).pipe(
    $I.annoteSchema("PrivateHomePathFinding", {
      description: "One absolute home path that a git-tracked text file must not record, with its position.",
    })
  )
) {}

/**
 * Runtime options for the private home path law.
 *
 * **Details**
 *
 * `exemptions` defaults to {@link privateHomePathExemptions}; tests pass their
 * own rows for a scratch repository.
 *
 * **Example** (Configure a strict scan)
 *
 * ```ts
 * import { PrivateHomePathsOptions } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * const options = PrivateHomePathsOptions.make({ cwd: process.cwd(), strictCheck: true })
 *
 * console.log([options.strictCheck, options.exemptions.length]) // [ true, 15 ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrivateHomePathsOptions extends S.Opaque<PrivateHomePathsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    exemptions: S.Array(PrivateHomePathExemption).pipe(
      S.withConstructorDefault(Effect.succeed(privateHomePathExemptions)),
      S.withDecodingDefaultKey(Effect.succeed(privateHomePathExemptions))
    ),
  }).pipe(
    $I.annoteSchema("PrivateHomePathsOptions", {
      description: "Runtime options for the private home path law.",
    })
  )
) {}

/**
 * Result of one private home path law run.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { PrivateHomePathsSummary } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model"
 *
 * const summary = PrivateHomePathsSummary.make({
 *   scannedFiles: 10,
 *   skippedBinaryFiles: 1,
 *   exemptFiles: 2,
 *   strictFailure: false,
 * })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrivateHomePathsSummary extends S.Opaque<PrivateHomePathsSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    scannedFiles: S.Int,
    skippedBinaryFiles: S.Int,
    exemptFiles: S.Int,
    strictFailure: S.Boolean,
    findings: ArrayKeyDefaultEmpty(PrivateHomePathFinding),
  }).pipe(
    $I.annoteSchema("PrivateHomePathsSummary", {
      description: "Result of one private home path law run over the git-tracked text files.",
    })
  )
) {}
