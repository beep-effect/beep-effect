/**
 * Checkout-local published-PR ownership lease for hook takeover and fencing.
 *
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, PosInt } from "@beep/schema";
import { Console, DateTime, Effect, FileSystem, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runToExit } from "../../../internal/process/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { parseProcStatStartTime } from "../../Worktree/Fleet.service.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { currentCommitSha } from "./GitExec.ts";
import { runGhPullRequestView, runGhPullRequestViewForNumber } from "./PullRequest.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/PrLease");

const YeetPrLeaseTakeoverMode = LiteralKit(["resume-owner", "fresh-worktree"]).pipe(
  $I.annoteSchema("YeetPrLeaseTakeoverMode", { description: "How a dead published-PR owner was recovered." })
);

const YeetPrLeaseStatus = LiteralKit(["active", "claiming", "retired"]);

class YeetPrLease extends S.Class<YeetPrLease>($I`YeetPrLease`)(
  {
    schemaVersion: S.Literal("yeet-pr-lease/v1"),
    generationId: S.String,
    sessionId: S.String,
    pid: PosInt,
    procStart: S.String,
    checkoutRoot: S.String,
    branch: S.String,
    headSha: S.String,
    prNumber: PosInt,
    acquiredAt: S.String,
    refreshedAt: S.String,
    status: S.optionalKey(YeetPrLeaseStatus),
    retiredAt: S.optionalKey(S.String),
    retireReason: S.optionalKey(S.String),
    takeoverOf: S.optionalKey(S.String),
    takeoverReason: S.optionalKey(S.String),
    takeoverMode: S.optionalKey(YeetPrLeaseTakeoverMode),
    takeoverWorktree: S.optionalKey(S.String),
    claimWorkloadProcessGroupId: S.optionalKey(PosInt),
    claimWorkloadProcStart: S.optionalKey(S.String),
    claimWorkloadWorktree: S.optionalKey(S.String),
    claimWorkloadBranch: S.optionalKey(S.String),
  },
  $I.annote("YeetPrLease", {
    description: "Published-PR ownership generation refreshed by agent hooks and fenced after takeover.",
  })
) {}

const YeetPrLeaseJson = JsonStringCodec(YeetPrLease);

class PublishedPrLeaseReceipt extends S.Class<PublishedPrLeaseReceipt>($I`PublishedPrLeaseReceipt`)(
  {
    generationId: S.String,
    headSha: S.String,
    prNumber: PosInt,
  },
  $I.annote("PublishedPrLeaseReceipt", {
    description: "Exact ownership generation established by a published-PR lease write.",
  })
) {}

class PrLeaseTransitionContendedError extends S.TaggedError<PrLeaseTransitionContendedError>(
  $I`PrLeaseTransitionContendedError`
)(
  "PrLeaseTransitionContendedError",
  {
    expectedGeneration: S.String,
    message: S.String,
  },
  $I.annoteError<PrLeaseTransitionContendedError>("PrLeaseTransitionContendedError", {
    description: "A PR lease transition lost its expected generation during a compare-and-swap update.",
  })
) {}

const leaseStatus = (lease: YeetPrLease): typeof YeetPrLeaseStatus.Type => lease.status ?? "active";
const defaultMutexWaitSeconds = 2;
const receiptRetirementMutexWaitSeconds = 5;

const readLease = Effect.fn("PrLease.read")(function* (leasePath: string) {
  const fs = yield* FileSystem.FileSystem;
  if (
    !(yield* fs
      .exists(leasePath)
      .pipe(Effect.mapError(YeetCommandError.new(`Failed to inspect the published-PR lease at ${leasePath}.`))))
  ) {
    return O.none<YeetPrLease>();
  }
  const text = yield* fs
    .readFileString(leasePath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read the published-PR lease at ${leasePath}.`)));
  return O.some(
    yield* YeetPrLeaseJson.decode(text).pipe(
      Effect.mapError(YeetCommandError.new(`Invalid published-PR lease at ${leasePath}; transition failed closed.`))
    )
  );
});

const replaceLeaseGenerationUnderMutex = Effect.fn("PrLease.replaceGenerationUnderMutex")(function* (
  inbox: string,
  expectedGeneration: O.Option<string>,
  allowedStatuses: ReadonlyArray<typeof YeetPrLeaseStatus.Type>,
  temporary: string,
  leasePath: string,
  checkoutRoot: string,
  expectedHeadSha: string,
  mutexWaitSeconds = defaultMutexWaitSeconds
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const expectedKind = O.isSome(expectedGeneration) ? "generation" : "absent";
  const expected = O.getOrElse(expectedGeneration, () => "");
  const script = `
set -eu
expected_kind="$1"
expected_generation="$2"
allowed_statuses="$3"
temporary="$4"
lease="$5"
checkout_root="$6"
expected_head="$7"
if [ -n "$expected_head" ]; then
  observed_head="$(git -C "$checkout_root" rev-parse HEAD 2>/dev/null)" || exit 74
  [ "$observed_head" = "$expected_head" ] || exit 75
fi
if [ "$expected_kind" = "absent" ]; then
  [ ! -e "$lease" ] || exit 73
else
  observed_generation="$(jq -r 'select(.schemaVersion == "yeet-pr-lease/v1") | .generationId // empty' "$lease" 2>/dev/null || true)"
  observed_status="$(jq -r 'select(.schemaVersion == "yeet-pr-lease/v1") | (.status // "active")' "$lease" 2>/dev/null || true)"
  [ "$observed_generation" = "$expected_generation" ] || exit 73
  case ",$allowed_statuses," in
    *",$observed_status,"*) ;;
    *) exit 73 ;;
  esac
fi
mv -- "$temporary" "$lease"
`;
  const exitCode = yield* runToExit({
    command: "flock",
    args: [
      "-w",
      String(mutexWaitSeconds),
      path.join(inbox, "hook-mutex.lock"),
      "sh",
      "-c",
      script,
      "yeet-pr-lease-cas",
      expectedKind,
      expected,
      A.join(allowedStatuses, ","),
      temporary,
      leasePath,
      checkoutRoot,
      expectedHeadSha,
    ],
    cwd: inbox,
    stdio: "ignore",
  }).pipe(
    Effect.mapError(YeetCommandError.new("Failed to lock the published-PR lease.")),
    Effect.ensuring(fs.remove(temporary).pipe(Effect.ignore))
  );
  if (exitCode === 73) {
    return yield* PrLeaseTransitionContendedError.make({
      expectedGeneration: O.getOrElse(expectedGeneration, () => "<absent>"),
      message: `Published-PR lease changed before its ${expectedKind} transition could commit.`,
    });
  }
  if (exitCode === 74) {
    return yield* YeetCommandError.make({
      message: `Could not verify checkout HEAD before transitioning the PR ownership lease at ${leasePath}.`,
      exitCode,
    });
  }
  if (exitCode === 75) {
    return yield* YeetCommandError.make({
      message: `Checkout HEAD changed before the PR ownership lease transition for ${expectedHeadSha} could commit.`,
      exitCode,
    });
  }
  if (exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `Failed to atomically transition the PR ownership lease at ${leasePath}.`,
      exitCode,
    });
  }
});

/**
 * Test-only seam for exercising the real mutex-protected generation/status CAS.
 *
 * @internal
 * @category testing
 */
export const replacePublishedPrLeaseGenerationForTesting = replaceLeaseGenerationUnderMutex;

const persistLeaseTransition = Effect.fn("PrLease.persistTransition")(function* (
  inbox: string,
  leasePath: string,
  lease: YeetPrLease,
  expectedGeneration: O.Option<string>,
  allowedStatuses: ReadonlyArray<typeof YeetPrLeaseStatus.Type>,
  temporaryPrefix: string,
  checkoutRoot: string,
  expectedHeadSha: string,
  mutexWaitSeconds = defaultMutexWaitSeconds
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* YeetPrLeaseJson.encode(lease).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode a published-PR lease transition."))
  );
  const temporary = path.join(inbox, `.${temporaryPrefix}-${randomUUID()}.tmp`);
  yield* fs
    .writeFileString(temporary, `${text}\n`, { mode: 0o600 })
    .pipe(Effect.mapError(YeetCommandError.new("Failed to persist a published-PR lease transition.")));
  yield* replaceLeaseGenerationUnderMutex(
    inbox,
    expectedGeneration,
    allowedStatuses,
    temporary,
    leasePath,
    checkoutRoot,
    expectedHeadSha,
    mutexWaitSeconds
  );
});

const processStartTime = Effect.fn("PrLease.processStartTime")(function* (pid: number) {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs
    .readFileString(`/proc/${pid}/stat`)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read published-PR owner process ${pid}.`)));
  const procStart = parseProcStatStartTime(stat);
  if (O.isSome(procStart)) return procStart.value;
  return yield* YeetCommandError.make({
    message: `Could not parse the exact published-PR owner generation for pid ${pid}; ownership publication failed closed.`,
  });
});

const parentPidFromStatus = (status: string): O.Option<number> =>
  pipe(
    Str.split(/\r?\n/)(status),
    O.liftPredicate((lines) => lines.length > 0),
    O.flatMap((lines) => O.fromUndefinedOr(lines.find(Str.startsWith("PPid:")))),
    O.map(Str.replace("PPid:", "")),
    O.map(Str.trim),
    O.flatMap((value) => {
      const pid = Number(value);
      return Number.isInteger(pid) && pid > 0 ? O.some(pid) : O.none();
    })
  );

const agentOwnerProcess = Effect.fn("PrLease.agentOwnerProcess")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const fallbackPid = process.ppid;
  let pid = fallbackPid;
  for (let depth = 0; depth < 12 && pid > 1; depth += 1) {
    const [cmdline, status] = yield* Effect.all([
      fs.readFileString(`/proc/${pid}/cmdline`).pipe(Effect.option),
      fs.readFileString(`/proc/${pid}/status`).pipe(Effect.option),
    ]);
    const command = pipe(
      cmdline,
      O.getOrElse(() => ""),
      Str.replaceAll("\0", " ")
    );
    if (Str.includes("codex")(command) || Str.includes("claude")(command)) {
      return { pid, procStart: yield* processStartTime(pid) } as const;
    }
    const parent = pipe(status, O.flatMap(parentPidFromStatus));
    if (O.isNone(parent) || parent.value === pid) break;
    pid = parent.value;
  }
  return { pid: fallbackPid, procStart: yield* processStartTime(fallbackPid) } as const;
});

const agentSessionId = (pid: number, procStart: string): string => {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  if (Bun.env.BEEP_AGENT_SESSION_ID !== undefined) return Bun.env.BEEP_AGENT_SESSION_ID;
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  if (Bun.env.CLAUDE_SESSION_ID !== undefined) return `claude:${Bun.env.CLAUDE_SESSION_ID}`;
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  if (Bun.env.CODEX_SESSION_ID !== undefined) return `codex:${Bun.env.CODEX_SESSION_ID}`;
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  if (Bun.env.CODEX_THREAD_ID !== undefined) return `codex:${Bun.env.CODEX_THREAD_ID}`;
  return `yeet:${pid}:${procStart}`;
};

const leaseOwnerProcessIsAlive = Effect.fn("PrLease.ownerProcessIsAlive")(function* (lease: YeetPrLease) {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs.readFileString(`/proc/${lease.pid}/stat`).pipe(Effect.option);
  return O.exists(stat, (contents) => O.contains(parseProcStatStartTime(contents), lease.procStart));
});

/**
 * Write the ownership lease after Yeet has ensured an open PR for the published branch.
 *
 * @category persistence
 */
export const writePublishedPrLease = Effect.fn("PrLease.writePublished")(function* (context: RepoRunContext) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inbox = path.join(context.repoRoot, ".beep", "inbox");
  const leasePath = path.join(inbox, "pr-lease.json");
  yield* fs.makeDirectory(inbox, { recursive: true, mode: 0o700 });
  const observed = yield* readLease(leasePath);
  const pullRequest = yield* runGhPullRequestView(context);
  const owner = yield* agentOwnerProcess();
  const pid = PosInt.make(owner.pid);
  const procStart = owner.procStart;
  const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const lease = YeetPrLease.make({
    schemaVersion: "yeet-pr-lease/v1",
    generationId: randomUUID(),
    sessionId: agentSessionId(pid, procStart),
    pid,
    procStart,
    checkoutRoot: context.repoRoot,
    branch: context.branch,
    headSha: yield* currentCommitSha(context),
    prNumber: PosInt.make(pullRequest.number),
    acquiredAt: now,
    refreshedAt: now,
    status: "active",
  });
  const expectedGeneration = yield* O.match(observed, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: Effect.fn("PrLease.resolveExistingGeneration")(function* (current) {
      const currentStatus = leaseStatus(current);
      if (currentStatus === "retired") return O.some(current.generationId);
      if (currentStatus !== "active") {
        return yield* YeetCommandError.make({
          message: `Refusing to publish over ${currentStatus} PR ownership generation ${current.generationId}.`,
        });
      }
      if (current.prNumber !== lease.prNumber) {
        const prior = yield* runGhPullRequestViewForNumber(context, current.prNumber);
        if (!A.contains(["MERGED", "CLOSED"], prior.state)) {
          return yield* YeetCommandError.make({
            message: `Refusing to publish PR #${lease.prNumber} while ownership generation ${current.generationId} still belongs to open PR #${current.prNumber}.`,
          });
        }
        yield* Console.log(
          `[yeet] replacing terminal ${Str.toLowerCase(prior.state)} PR #${current.prNumber} ownership generation ${current.generationId}`
        );
        return O.some(current.generationId);
      }
      const sameOwner = current.pid === lease.pid && Str.Equivalence(current.procStart, lease.procStart);
      if (sameOwner) return O.some(current.generationId);
      if (!(yield* leaseOwnerProcessIsAlive(current))) {
        yield* Console.log(
          `[yeet] replacing abandoned PR #${current.prNumber} ownership generation ${current.generationId}`
        );
        return O.some(current.generationId);
      }
      return yield* YeetCommandError.make({
        message: `Refusing to publish over active PR ownership generation ${current.generationId} owned by another exact process.`,
      });
    }),
  });
  const allowedStatuses = pipe(
    observed,
    O.filter((current) => leaseStatus(current) === "retired"),
    O.match({ onNone: () => ["active"] as const, onSome: () => ["retired"] as const })
  );
  yield* persistLeaseTransition(
    inbox,
    leasePath,
    lease,
    expectedGeneration,
    allowedStatuses,
    "pr-lease",
    context.repoRoot,
    lease.headSha
  ).pipe(
    Effect.catchTag("PrLeaseTransitionContendedError", (error) =>
      YeetCommandError.make({
        message: `PR ownership publication lost its generation race (${error.expectedGeneration}); the newer lease was preserved.`,
      })
    )
  );
  return PublishedPrLeaseReceipt.make({
    generationId: lease.generationId,
    headSha: lease.headSha,
    prNumber: lease.prNumber,
  });
});

const retirePublishedPrLeaseAtPath = Effect.fn("PrLease.retireAtPath")(function* (
  checkoutRoot: string,
  inbox: string,
  leasePath: string,
  targetPrNumber: PosInt,
  targetHeadSha: string,
  reason: string,
  expectedGeneration: O.Option<string> = O.none(),
  verifyCheckoutHead = true,
  mutexWaitSeconds = defaultMutexWaitSeconds
) {
  const transition = Effect.gen(function* () {
    const current = yield* readLease(leasePath);
    if (O.isNone(current)) {
      return yield* YeetCommandError.make({
        message: `Published-PR lease disappeared while retiring PR #${targetPrNumber} at ${targetHeadSha}.`,
      });
    }
    if (O.isSome(expectedGeneration) && !Str.Equivalence(current.value.generationId, expectedGeneration.value)) {
      return { changed: false, generationId: expectedGeneration.value, preservedNewer: true } as const;
    }
    if (current.value.prNumber !== targetPrNumber || !Str.Equivalence(current.value.headSha, targetHeadSha)) {
      return yield* YeetCommandError.make({
        message: `Refusing to retire generation ${current.value.generationId}: it belongs to a newer PR or head.`,
      });
    }
    const currentStatus = leaseStatus(current.value);
    if (currentStatus === "retired") {
      return { changed: false, generationId: current.value.generationId, preservedNewer: false } as const;
    }
    if (currentStatus === "claiming") {
      return yield* YeetCommandError.make({
        message: `Refusing to retire claiming generation ${current.value.generationId}; its exact takeover workload must be recovered before terminal retirement.`,
      });
    }
    const retiredAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    const retired = YeetPrLease.make({
      ...current.value,
      status: "retired",
      retiredAt,
      retireReason: reason,
      refreshedAt: retiredAt,
    });
    yield* persistLeaseTransition(
      inbox,
      leasePath,
      retired,
      O.some(current.value.generationId),
      ["active"],
      "pr-lease-retired",
      checkoutRoot,
      verifyCheckoutHead === true ? targetHeadSha : "",
      mutexWaitSeconds
    );
    return { changed: true, generationId: current.value.generationId, preservedNewer: false } as const;
  });
  const result = yield* transition.pipe(
    Effect.retry({ times: 3, while: P.isTagged("PrLeaseTransitionContendedError") }),
    Effect.catchTag("PrLeaseTransitionContendedError", (error) =>
      YeetCommandError.make({
        message: `Could not retire the current PR ownership generation after repeated contention (${error.expectedGeneration}).`,
      })
    )
  );
  yield* Console.log(
    result.preservedNewer
      ? `[yeet] preserved newer published-PR lease while retiring generation ${result.generationId}: ${reason}`
      : result.changed
        ? `[yeet] retired published-PR lease generation ${result.generationId}: ${reason}`
        : `[yeet] published-PR lease generation ${result.generationId} was already retired: ${reason}`
  );
});

/**
 * Test-only seam for the real generation/status retirement CAS.
 *
 * @internal
 * @category testing
 */
export const retirePublishedPrLeaseAtPathForTesting = retirePublishedPrLeaseAtPath;

const retirePublishedPrLeaseForContext = Effect.fn("PrLease.retireForContext")(function* (
  context: RepoRunContext,
  prNumber: PosInt,
  headSha: string,
  reason: string,
  expectedGeneration: O.Option<string>,
  verifyCheckoutHead: boolean,
  mutexWaitSeconds = defaultMutexWaitSeconds
) {
  const path = yield* Path.Path;
  const inbox = path.join(context.repoRoot, ".beep", "inbox");
  yield* retirePublishedPrLeaseAtPath(
    context.repoRoot,
    inbox,
    path.join(inbox, "pr-lease.json"),
    prNumber,
    headSha,
    reason,
    expectedGeneration,
    verifyCheckoutHead,
    mutexWaitSeconds
  );
});

/**
 * Retire the currently observed published-PR lease without touching a newer generation.
 *
 * @category persistence
 */
export const retirePublishedPrLease = Effect.fn("PrLease.retirePublished")(function* (
  context: RepoRunContext,
  prNumber: number,
  headSha: string,
  reason: string
) {
  yield* retirePublishedPrLeaseForContext(context, PosInt.make(prNumber), headSha, reason, O.none(), true);
});

/**
 * Retire the exact lease generation established by an earlier write.
 *
 * The generation receipt is the compare-and-swap fence, so this failure path
 * needs neither a fresh GitHub lookup nor a checkout HEAD lookup and preserves
 * any concurrent replacement generation.
 *
 * @category persistence
 */
export const retirePublishedPrLeaseReceipt = Effect.fn("PrLease.retirePublishedReceipt")(function* (
  context: RepoRunContext,
  receipt: PublishedPrLeaseReceipt,
  reason: string
) {
  yield* retirePublishedPrLeaseForContext(
    context,
    receipt.prNumber,
    receipt.headSha,
    reason,
    O.some(receipt.generationId),
    false,
    receiptRetirementMutexWaitSeconds
  );
});
