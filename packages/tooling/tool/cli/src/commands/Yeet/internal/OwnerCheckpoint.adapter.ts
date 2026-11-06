/**
 * Unregistered authenticated-client reader for the offline owner checkpoint.
 * No command, endpoint, App credential, publisher or ruleset is activated here.
 * @packageDocumentation
 * @since 0.0.0
 */
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { GithubRest } from "../../../internal/github/index.ts";
import { MergeGateRead, readAuthenticatedMergeGate } from "./MergeGate.ts";
import {
  OwnerCheckpointError,
  OwnerCheckpointHead,
  OwnerCheckpointSnapshot,
  projectOwnerCheckpointClassicStatus,
  projectOwnerCheckpointSelfCheck,
} from "./OwnerCheckpoint.schemas.ts";
import { qualifyOwnerCheckpointSnapshot } from "./OwnerCheckpoint.ts";
import type { GithubPullRequestRecord } from "../../../internal/github/GithubRest.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { OwnerCheckpointBinding, OwnerCheckpointPolicy } from "./OwnerCheckpoint.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/OwnerCheckpoint.adapter");
const NativeCheck = S.Struct({
  id: S.Int.check(S.isGreaterThan(0)),
  name: S.NonEmptyString,
  status: S.String,
  conclusion: S.NullOr(S.String),
  head_sha: OwnerCheckpointHead,
  external_id: S.NullOr(S.String),
  app: S.Struct({ id: S.Int.check(S.isGreaterThan(0)) }),
}).pipe(
  $I.annoteSchema("NativeCheck", {
    description: "Selected authenticated exact-head check metadata; output is discarded.",
  })
);
const refuse = (reason: OwnerCheckpointError["reason"]) => OwnerCheckpointError.make({ reason });
const readFailure = () => refuse("evidence");
const MAX_NATIVE_ROWS = 2000;
const NativePullBase = S.Struct({
  base: S.Struct({ ref: S.NonEmptyString, repo: S.Struct({ full_name: S.NonEmptyString }) }),
});
const NativeBaseRef = S.Struct({ object: S.Struct({ type: S.tag("commit"), sha: OwnerCheckpointHead }) });

const NativeRequiredContext = S.Struct({
  context: S.NonEmptyString,
  integration_id: S.Int.check(S.isGreaterThan(0)).pipe(S.NullOr, S.optionalKey),
}).pipe($I.annoteSchema("NativeRequiredContext", { description: "Native required context with its App constraint." }));
const NativeRule = S.Struct({
  type: S.String,
  parameters: S.Struct({ required_status_checks: NativeRequiredContext.pipe(S.Array, S.optionalKey) }).pipe(
    S.optionalKey
  ),
}).pipe(
  $I.annoteSchema("NativeRule", { description: "Native required context and optional integration App binding." })
);
const NativeChecks = S.Array(NativeCheck);
const decodeNativeChecks = S.decodeUnknownEffect(NativeChecks);
const NativeRules = S.Array(NativeRule);
const decodeNativeRules = S.decodeUnknownEffect(NativeRules);
const collectNativeRows = Effect.fnUntraced(function* <Value, Error, Requirements>(
  stream: Stream.Stream<Value, Error, Requirements>
): Effect.fn.Return<ReadonlyArray<Value>, OwnerCheckpointError, Requirements> {
  const rows = yield* stream.pipe(Stream.take(MAX_NATIVE_ROWS + 1), Stream.runCollect, Effect.mapError(readFailure));
  if (rows.length > MAX_NATIVE_ROWS) return yield* refuse("evidence");
  return rows;
});
const assertApplicationCheck = Effect.fnUntraced(function* (
  checks: ReadonlyArray<typeof NativeCheck.Type>,
  name: string,
  app: number,
  selfCheckId: number,
  policy: OwnerCheckpointPolicy
) {
  const matching = A.filter(checks, (run) => run.name === name && run.app.id === app);
  const latest = A.reduce(matching, O.none<typeof NativeCheck.Type>(), (found, row) =>
    O.exists(found, (old) => old.id >= row.id) ? found : O.some(row)
  );
  if (O.isNone(latest)) return yield* refuse("gate");
  const own = latest.value.id === selfCheckId && name === policy.context && app === policy.applicationId;
  if (!own && (latest.value.status !== "completed" || latest.value.conclusion !== "success"))
    return yield* refuse("gate");
});
const assertContextApplications = Effect.fnUntraced(function* (
  checks: ReadonlyArray<typeof NativeCheck.Type>,
  required: ReadonlyArray<typeof NativeRequiredContext.Type>,
  name: string,
  selfCheckId: number,
  policy: OwnerCheckpointPolicy
) {
  const constraints = A.filter(required, (rule) => rule.context === name);
  const apps = A.dedupe(A.getSomes(A.map(constraints, (rule) => O.fromNullishOr(rule.integration_id))));
  if (name === policy.context && A.some(apps, (app) => app !== policy.applicationId)) return yield* refuse("gate");
  if (apps.length > 1) return yield* refuse("gate");
  for (const app of apps) yield* assertApplicationCheck(checks, name, app, selfCheckId, policy);
});
const assertRequiredApplications = Effect.fnUntraced(function* (
  read: MergeGateRead,
  checks: ReadonlyArray<typeof NativeCheck.Type>,
  rules: ReadonlyArray<typeof NativeRule.Type>,
  selfCheckId: number,
  policy: OwnerCheckpointPolicy
) {
  if (
    A.some(
      rules,
      (rule) => rule.type === "required_status_checks" && rule.parameters?.required_status_checks === undefined
    )
  )
    return yield* refuse("evidence");
  const required = A.flatMap(rules, (rule) =>
    rule.type === "required_status_checks" ? (rule.parameters?.required_status_checks ?? []) : []
  );
  const names = A.dedupe(A.map(required, (check) => check.context));
  if (
    !O.exists(
      read.requiredContexts,
      (contexts) => contexts.length === names.length && A.every(names, (name) => A.contains(contexts, name))
    )
  )
    return yield* refuse("evidence");
  for (const name of names) yield* assertContextApplications(checks, required, name, selfCheckId, policy);
});

const assertCurrentPull = Effect.fnUntraced(function* (pull: GithubPullRequestRecord, binding: OwnerCheckpointBinding) {
  if (pull.headSha !== binding.head || pull.number !== binding.prNumber || pull.state !== "open" || pull.merged)
    return yield* refuse("binding");
});
const assertSamePull = Effect.fnUntraced(function* (before: GithubPullRequestRecord, after: GithubPullRequestRecord) {
  if (after.number !== before.number || after.headSha !== before.headSha || after.baseRef !== before.baseRef)
    return yield* refuse("binding");
  if (after.state !== "open" || after.merged || after.draft !== before.draft) return yield* refuse("binding");
});
const assertCheckCensus = Effect.fnUntraced(function* (
  read: MergeGateRead,
  checks: ReadonlyArray<typeof NativeCheck.Type>,
  binding: OwnerCheckpointBinding
) {
  if (A.dedupe(A.map(checks, (row) => row.id)).length !== checks.length) return yield* refuse("evidence");
  const consistent = A.every(
    checks,
    (native) =>
      native.head_sha === binding.head &&
      A.some(
        read.checkRuns,
        (run) =>
          run.id === native.id &&
          run.name === native.name &&
          run.status === native.status &&
          run.conclusion === native.conclusion
      )
  );
  if (checks.length !== read.checkRuns.length || !consistent) return yield* refuse("evidence");
});
const assertSupportedContexts = Effect.fnUntraced(function* (
  read: MergeGateRead,
  statuses: OwnerCheckpointSnapshot["statuses"]
) {
  if (
    O.exists(read.requiredContexts, (names) =>
      A.some(
        names,
        (name) =>
          !A.some(read.checkRuns, (run) => run.name === name) && A.some(statuses, (status) => status.context === name)
      )
    )
  )
    return yield* refuse("gate");
});

/**
 * Read a strict exact-head snapshot through the retained GitHub client services.
 *
 * **Details**
 * The eventual isolated authority must supply these services and authenticate
 * the owner separately. A caller-created binding or client layer establishes no
 * trusted owner. Pagination completes naturally below the finite item ceiling;
 * reaching the overflow item refuses instead of treating truncation as complete.
 * A second PR read detects head/base/state movement. No native writes occur.
 *
 * **Example** (Inspect the unregistered reader)
 * ```ts
 * import { readOwnerCheckpointSnapshot } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof readOwnerCheckpointSnapshot) // "function"
 * ```
 * @param context - Installed authority checkout context, never a PR-controlled configuration.
 * @param binding - Exact registry binding supplied by the authenticated authority.
 * @param selfCheckId - Native own-check identity from the durable registry/outbox.
 * @param policy - Fixed App and bounded freshness policy.
 * @param expectedExternalId - Persisted check correlation from the authority registry, never caller evidence.
 * @returns A fully qualified finite snapshot or typed refusal.
 * @category parsing
 * @since 0.0.0
 */
export const readOwnerCheckpointSnapshot = Effect.fn("OwnerCheckpoint.readNativeSnapshot")(
  function* (
    context: RepoRunContext,
    binding: OwnerCheckpointBinding,
    selfCheckId: number,
    policy: OwnerCheckpointPolicy,
    expectedExternalId: string
  ) {
    const started = yield* DateTime.now;
    const client = yield* GitHubClient;
    const rest = yield* GithubRest;
    const repository = yield* Repo;
    if (`${repository.owner}/${repository.repo}` !== binding.repository) return yield* refuse("binding");
    const before = yield* rest.pullRequest(binding.prNumber).pipe(Effect.mapError(readFailure));
    yield* assertCurrentPull(before, binding);
    const readBase = Effect.fnUntraced(function* () {
      const pull = yield* client
        .requestDecoded(
          "GET /repos/{owner}/{repo}/pulls/{pull_number}",
          { owner: repository.owner, repo: repository.repo, pull_number: binding.prNumber },
          NativePullBase
        )
        .pipe(Effect.mapError(readFailure));
      if (pull.base.repo.full_name !== binding.repository || pull.base.ref !== before.baseRef)
        return yield* refuse("binding");
      const ref = yield* client
        .requestDecoded(
          "GET /repos/{owner}/{repo}/git/ref/{ref}",
          { owner: repository.owner, repo: repository.repo, ref: `heads/${pull.base.ref}` },
          NativeBaseRef
        )
        .pipe(Effect.mapError(readFailure));
      return { repository: pull.base.repo.full_name, ref: pull.base.ref, sha: ref.object.sha };
    });
    const base = yield* readBase();
    const read = yield* readAuthenticatedMergeGate(context, binding.prNumber).pipe(Effect.mapError(readFailure));
    const at = { owner: repository.owner, repo: repository.repo, ref: binding.head };
    const checkRows = yield* client
      .paginateStream("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", at)
      .pipe(collectNativeRows);
    const checks = yield* decodeNativeChecks(checkRows).pipe(Effect.mapError(readFailure));
    yield* assertCheckCensus(read, checks, binding);
    const ruleRows = yield* client
      .paginateStream("GET /repos/{owner}/{repo}/rules/branches/{branch}", {
        owner: repository.owner,
        repo: repository.repo,
        branch: base.ref,
      })
      .pipe(collectNativeRows);
    const rules = yield* decodeNativeRules(ruleRows).pipe(Effect.mapError(readFailure));
    yield* assertRequiredApplications(read, checks, rules, selfCheckId, policy);
    const own = A.findFirst(checks, (row) => row.id === selfCheckId);
    if (O.isNone(own) || own.value.external_id !== expectedExternalId) return yield* refuse("evidence");
    const selfCheck = yield* projectOwnerCheckpointSelfCheck(own.value);
    const statusRows = yield* client
      .paginateStream("GET /repos/{owner}/{repo}/commits/{ref}/statuses", at)
      .pipe(collectNativeRows);
    const statuses = yield* Effect.forEach(statusRows, projectOwnerCheckpointClassicStatus);
    if (A.dedupe(A.map(statuses, (row) => row.id)).length !== statuses.length) return yield* refuse("evidence");
    // The retained merge gate models required check runs. Status-only names stay
    // explicitly unsupported until that pure contract is extended and qualified.
    yield* assertSupportedContexts(read, statuses);
    const afterBase = yield* readBase();
    if (base.sha !== afterBase.sha) return yield* refuse("binding");
    if (O.exists(read.baseRuns, (runs) => runs.baseTip.sha !== base.sha)) return yield* refuse("binding");
    const after = yield* rest.pullRequest(binding.prNumber).pipe(Effect.mapError(readFailure));
    yield* assertSamePull(before, after);
    const snapshot = OwnerCheckpointSnapshot.make({
      repository: binding.repository,
      base,
      state: "open",
      read: MergeGateRead.make({ ...read, readAt: yield* DateTime.now }),
      selfCheck,
      statuses,
    });
    const now = yield* DateTime.now;
    const duration = DateTime.toEpochMillis(now) - DateTime.toEpochMillis(started);
    if (duration < 0 || duration > policy.maxAgeMillis) return yield* refuse("freshness");
    yield* qualifyOwnerCheckpointSnapshot(binding, snapshot, policy, now);
    return snapshot;
  },
  Effect.timeoutOrElse({ duration: "20 seconds", orElse: () => Effect.fail(refuse("evidence")) })
);
