import { PrRepository, PrSessionRecord } from "@beep/repo-cli/test/Yeet";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { DateTime, Layer } from "effect";
import * as O from "effect/Option";
import type { PrProvenanceHarness, PrProvenanceNameSource, PrProvenanceRole } from "@beep/repo-cli/test/Yeet";

export const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);
export const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });
type MakeRecordOptions = {
  readonly harness?: PrProvenanceHarness;
  readonly role?: PrProvenanceRole;
  readonly sessionId?: string;
  readonly sessionName?: string;
  readonly nameSource?: PrProvenanceNameSource;
  readonly recordedAt?: string;
  readonly pr?: number;
  readonly branch?: string;
  readonly hostHarness?: PrProvenanceHarness;
  readonly hostSessionId?: string;
  readonly sessionHome?: string;
  readonly entrypoint?: "claude-desktop" | "cli" | "sdk-cli" | "codex-exec" | "codex-tui" | "unknown";
  readonly model?: string;
  readonly clonePath?: string;
  readonly checkoutPath?: string;
  readonly worktreePath?: string;
  readonly workspace?: string;
  readonly sessionWorkspace?: string;
  readonly headSha?: string;
  readonly runId?: string;
  readonly prUrl?: string;
  readonly repository?: PrRepository;
};
const recordDefaults = {
  branch: "feat/yeet-pr-resume-footer",
  checkoutPath: "/private/workspace",
  clonePath: "/private/clone",
  harness: "claude-code",
  headSha: "abcdef123456",
  model: "unknown",
  nameSource: "unknown",
  pr: 42,
  recordedAt: "2026-09-03T12:00:00Z",
  repository,
  role: "created",
  runId: "fixture-run",
  sessionHome: "/private/workspace",
  sessionId: "session-local-only",
  workspace: "beep-effect10",
  worktreePath: "/private/worktree",
} satisfies MakeRecordOptions;

export const makeRecord = (options: MakeRecordOptions = {}) => {
  const resolved = { ...recordDefaults, ...options };
  return PrSessionRecord.make({
    schemaVersion: 1,
    repository: resolved.repository,
    prNumber: O.some(resolved.pr),
    prUrl: O.some(options.prUrl ?? `https://github.com/beep-effect/beep-effect/pull/${resolved.pr}`),
    branch: resolved.branch,
    harness: resolved.harness,
    hostHarness: O.fromUndefinedOr(options.hostHarness),
    sessionId: O.some(resolved.sessionId),
    hostSessionId: O.fromUndefinedOr(options.hostSessionId),
    sessionHome: O.some(resolved.sessionHome),
    sessionHomeSource: "transcript",
    entrypoint: options.entrypoint ?? (resolved.harness === "codex" ? "codex-exec" : "claude-desktop"),
    sessionName: O.fromUndefinedOr(options.sessionName),
    nameSource: resolved.nameSource,
    model: resolved.model,
    clonePath: resolved.clonePath,
    checkoutPath: resolved.checkoutPath,
    worktreePath: O.some(resolved.worktreePath),
    workspace: resolved.workspace,
    sessionWorkspace: O.fromUndefinedOr(options.sessionWorkspace),
    childSession: false,
    headSha: resolved.headSha,
    runId: resolved.runId,
    role: resolved.role,
    recordedAt: DateTime.makeUnsafe(resolved.recordedAt),
  });
};
