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
export const makeRecord = (
  options: {
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
  } = {}
) =>
  PrSessionRecord.make({
    schemaVersion: 1,
    repository,
    prNumber: O.some(options.pr ?? 42),
    prUrl: O.some(options.prUrl ?? `https://github.com/beep-effect/beep-effect/pull/${options.pr ?? 42}`),
    branch: options.branch ?? "feat/yeet-pr-resume-footer",
    harness: options.harness ?? "claude-code",
    hostHarness: O.fromUndefinedOr(options.hostHarness),
    sessionId: O.some(options.sessionId ?? "session-local-only"),
    hostSessionId: O.fromUndefinedOr(options.hostSessionId),
    sessionHome: O.some(options.sessionHome ?? "/private/workspace"),
    sessionHomeSource: "transcript",
    entrypoint: options.entrypoint ?? (options.harness === "codex" ? "codex-exec" : "claude-desktop"),
    sessionName: O.fromUndefinedOr(options.sessionName),
    nameSource: options.nameSource ?? "unknown",
    model: options.model ?? "unknown",
    clonePath: options.clonePath ?? "/private/clone",
    checkoutPath: options.checkoutPath ?? "/private/workspace",
    worktreePath: O.some(options.worktreePath ?? "/private/worktree"),
    workspace: options.workspace ?? "beep-effect10",
    sessionWorkspace: O.fromUndefinedOr(options.sessionWorkspace),
    childSession: false,
    headSha: options.headSha ?? "abcdef123456",
    runId: options.runId ?? "fixture-run",
    role: options.role ?? "created",
    recordedAt: DateTime.makeUnsafe(options.recordedAt ?? "2026-09-03T12:00:00Z"),
  });
