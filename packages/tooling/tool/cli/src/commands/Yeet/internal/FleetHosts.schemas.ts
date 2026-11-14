/**
 * Schema-first models for reading fleet hosts' attempt journals read-only
 * (certainty-scorecard PERIL-11 slice 3, SPEC D18).
 *
 * `yeet economics --fleet-hosts` reads the hosts listed in
 * `<state>/beep/fleet/<repo-key>/hosts.json`, each over its existing
 * workstation SSH wrapper, and folds their journals locally. Only the counts
 * per host ({@link FleetHostReadReceipt}) reach the report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { HostLabel } from "../../../internal/github/GithubLedger.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/FleetHosts.schemas");

/**
 * The existing ordinary workstation SSH wrappers a fleet-host read may use.
 *
 * **Details**
 *
 * These are the routes `.claude/skills/remote-development-agents/references/hosts.md`
 * names as each host's ordinary connection. The domain is closed: a
 * `hosts.json` naming any other command, an administrative wrapper or a raw
 * `ssh` does not decode, so the read can never open a new route.
 *
 * **Example** (Recognise a route)
 *
 * ```ts
 * import { FleetHostRoute } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FleetHostRoute.is["ssh-tbk-worker"]("ssh-tbk-worker")) // true
 * console.log(FleetHostRoute.literals.includes("ssh")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetHostRoute = LiteralKit([
  "ssh-beep-worker-yubi",
  "ssh-tbk-worker",
  "ssh-dankserver-worker",
  "ssh-tom-pc-1-wsl",
  "ssh-grok-bot",
]).pipe(
  $I.annoteSchema("FleetHostRoute", {
    description: "An existing ordinary workstation SSH wrapper a read-only fleet-host journal read may use.",
  })
);

/**
 * An existing workstation SSH wrapper; see {@link FleetHostRoute}.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetHostRoute = typeof FleetHostRoute.Type;

// Every segment starts with a letter, digit or `_`: never `-` or `+` (which `find` would read as an
// expression), never `.` (so no `.`, `..` or hidden segment).
const HOME_RELATIVE_ROOT = /^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/u;

/**
 * A directory on a fleet host, relative to that host's home directory.
 *
 * **Details**
 *
 * A remote command starts in the login's home directory, so a root such as
 * `projects` names a remote directory without any home path. Segments are
 * letters, digits, `.`, `_` and `-`, and each starts with a letter, digit or
 * `_`. So a root can neither leave the home directory, name a hidden
 * directory, carry a shell metacharacter, nor start with `-` or `+`, which
 * `find` would read as the start of its expression (`-delete`, `-fprint`).
 * The host's own attempt-journal store, a hidden directory, is read through
 * {@link FleetHostEntry}'s `store` flag instead.
 *
 * **Example** (Check roots)
 *
 * ```ts
 * import { FleetHostRoot } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const isRoot = S.is(FleetHostRoot)
 * console.log(isRoot("projects/beep-effect-worktrees")) // true
 * console.log(isRoot("-delete")) // false
 * console.log(isRoot(".local/state")) // false
 * console.log(isRoot("/srv/journals")) // false
 * console.log(isRoot("projects/../secrets")) // false
 * console.log(isRoot("projects;rm")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetHostRoot = S.String.check(
  S.isPattern(HOME_RELATIVE_ROOT, {
    identifier: "FleetHostRootPattern",
    title: "Fleet host root",
    description: "A home-relative directory of plain segments, each starting with a letter, digit or underscore.",
    message:
      "must be a home-relative path of letters, digits, '.', '_' and '-' segments, each starting with a letter, digit or '_' (no leading '-', '+' or '.')",
  })
).pipe(
  S.brand("FleetHostRoot"),
  $I.annoteSchema("FleetHostRoot", { description: "A directory on a fleet host, relative to its home directory." })
);

/**
 * A home-relative fleet host directory; see {@link FleetHostRoot}.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetHostRoot = typeof FleetHostRoot.Type;

/**
 * One fleet host whose attempt journals economics may read.
 *
 * **Details**
 *
 * `roots` are searched for `<checkout>/.beep/yeet/runs/<runId>/attempts.ndjson`
 * (a live checkout) and `<partition>/runs/<runId>/attempts.ndjson` (the host's
 * own attempt-journal store), at most eight levels deep, never through a
 * symbolic link. `store` (default `false`) also reads the host's own store at
 * the fixed `.local/state/beep/yeet/attempts`; a host without one then reads
 * `partial`.
 *
 * **Example** (A worker host)
 *
 * ```ts
 * import { FleetHostEntry } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const host = S.decodeUnknownSync(FleetHostEntry)({
 *   host: "tbk-worker",
 *   route: "ssh-tbk-worker",
 *   roots: ["projects"],
 *   store: true,
 * })
 * console.log(host.store) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHostEntry extends S.Opaque<FleetHostEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    host: HostLabel,
    route: FleetHostRoute,
    roots: S.NonEmptyArray(FleetHostRoot),
    store: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(false)),
      S.withConstructorDefault(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("FleetHostEntry", {
      description:
        "A fleet host's label, its existing SSH wrapper, the home-relative roots holding its journals, and whether to read its own store.",
    })
  )
) {}

const hasDistinctHosts = (hosts: ReadonlyArray<FleetHostEntry>): boolean =>
  A.length(A.dedupe(A.map(hosts, (entry) => entry.host))) === A.length(hosts);

/**
 * The authored `hosts.json` document: the fleet hosts economics may read.
 *
 * **Details**
 *
 * Host labels are distinct, so no host is read, or counted, twice.
 *
 * **Example** (One host)
 *
 * ```ts
 * import { FleetHostsDocument } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const document = S.decodeUnknownSync(FleetHostsDocument)({
 *   schemaVersion: "fleet-hosts/v1",
 *   hosts: [{ host: "dankserver", route: "ssh-dankserver-worker", roots: ["YeeBois/projects"] }],
 * })
 * console.log(document.hosts[0]?.route) // "ssh-dankserver-worker"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHostsDocument extends S.Opaque<FleetHostsDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("fleet-hosts/v1"),
    hosts: S.Array(FleetHostEntry).check(
      S.makeFilter(
        hasDistinctHosts,
        $I.annote("FleetHostsDistinct", {
          title: "Distinct fleet hosts",
          description: "Every host label appears once.",
          message: "Expected each host label at most once",
        })
      )
    ),
  }).pipe(
    $I.annoteSchema("FleetHostsDocument", {
      description: "The authored hosts.json: the fleet hosts whose attempt journals economics may read.",
    })
  )
) {}

/**
 * How one fleet host's read ended.
 *
 * **Details**
 *
 * - `read`: the read command exited 0.
 * - `partial`: it exited 1, which `find` returns when a root is missing or
 *   unreadable; whatever it printed is still folded.
 * - `unreachable`: no journal was read; `unreachableReason` says why.
 *
 * **Example** (Recognise an unreachable host)
 *
 * ```ts
 * import { FleetHostReadStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FleetHostReadStatus.is.unreachable("unreachable")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetHostReadStatus = LiteralKit(["read", "partial", "unreachable"]).pipe(
  $I.annoteSchema("FleetHostReadStatus", {
    description: "How a fleet host's read ended: read, partial (a root was missing) or unreachable.",
  })
);

/**
 * How one fleet host's read ended; see {@link FleetHostReadStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetHostReadStatus = typeof FleetHostReadStatus.Type;

/**
 * Why a fleet host read nothing.
 *
 * **Details**
 *
 * - `timeout`: the wrapper did not finish in time (a YubiKey touch not given,
 *   a sleeping host).
 * - `connection-failed`: `ssh` exited 255.
 * - `route-failed`: the wrapper exited with any other status, such as its own
 *   78 when its key agent or host key is unavailable.
 * - `spawn-failed`: the wrapper could not be started (not installed).
 * - `output-truncated`: the output passed the read bound, so nothing is folded.
 * - `refused-command`: the shell refused a command that is not the read-only
 *   journal read; nothing ran.
 *
 * **Example** (Recognise a timeout)
 *
 * ```ts
 * import { FleetHostUnreachableReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FleetHostUnreachableReason.is.timeout("timeout")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetHostUnreachableReason = LiteralKit([
  "timeout",
  "connection-failed",
  "route-failed",
  "spawn-failed",
  "output-truncated",
  "refused-command",
]).pipe(
  $I.annoteSchema("FleetHostUnreachableReason", {
    description:
      "Why a fleet host read nothing: timeout, connection, route, spawn or output-bound failure, or a refused command.",
  })
);

/**
 * Why a fleet host read nothing; see {@link FleetHostUnreachableReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetHostUnreachableReason = typeof FleetHostUnreachableReason.Type;

/**
 * The aggregate record of one fleet host's read, as the economics report
 * carries it.
 *
 * **Details**
 *
 * Counts only: `journals` and `attempts` are what the host contributed after
 * deduplication, `skippedFiles` are listed files whose path is not a run
 * journal. No row, path or error text from the host is kept.
 *
 * **Example** (An unreachable host)
 *
 * ```ts
 * import { FleetHostReadReceipt } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const receipt = FleetHostReadReceipt.make({
 *   host: "dankserver",
 *   route: "ssh-dankserver-worker",
 *   status: "unreachable",
 *   unreachableReason: O.some("timeout"),
 *   exitCode: O.none(),
 *   journals: 0,
 *   attempts: 0,
 *   skippedFiles: 0,
 * })
 * console.log(receipt.status) // "unreachable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHostReadReceipt extends S.Opaque<FleetHostReadReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    host: HostLabel,
    route: FleetHostRoute,
    status: FleetHostReadStatus,
    unreachableReason: S.OptionFromNullOr(FleetHostUnreachableReason),
    exitCode: S.OptionFromNullOr(S.Finite),
    journals: S.Finite,
    attempts: S.Finite,
    skippedFiles: S.Finite,
  }).pipe(
    $I.annoteSchema("FleetHostReadReceipt", {
      description:
        "One fleet host's read as aggregates: route, status, why it was unreachable, and journal, attempt and skipped-file counts.",
    })
  )
) {}
