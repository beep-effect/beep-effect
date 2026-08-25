import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import {
  ThreadStoreConflict,
  ThreadStoreNotFound,
  ThreadStoreUnavailable,
} from "@beep/workspace-use-cases/aggregates/Thread/server";
import {
  WorkspaceVaultActionError,
  WorkspaceVaultRootInvalid,
  WorkspaceVaultStoreUnavailable,
} from "@beep/workspace-use-cases/public";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("workspace use-case tagged-error declared equivalence", () => {
  it("compares ThreadStoreNotFound by declared fields", () => {
    const same = S.toEquivalence(ThreadStoreNotFound);
    const first = ThreadStoreNotFound.make({ threadId: WorkspaceIdentity.ThreadId.make(1) });
    const second = ThreadStoreNotFound.make({ threadId: WorkspaceIdentity.ThreadId.make(1) });
    const different = ThreadStoreNotFound.make({ threadId: WorkspaceIdentity.ThreadId.make(2) });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ThreadStoreConflict by declared fields", () => {
    const same = S.toEquivalence(ThreadStoreConflict);
    const first = ThreadStoreConflict.make({
      threadId: WorkspaceIdentity.ThreadId.make(1),
      reason: "stale write",
    });
    const second = ThreadStoreConflict.make({
      threadId: WorkspaceIdentity.ThreadId.make(1),
      reason: "stale write",
    });
    const different = ThreadStoreConflict.make({
      threadId: WorkspaceIdentity.ThreadId.make(1),
      reason: "concurrent write",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ThreadStoreUnavailable by declared fields", () => {
    const same = S.toEquivalence(ThreadStoreUnavailable);
    const first = ThreadStoreUnavailable.make({ reason: "database unavailable" });
    const second = ThreadStoreUnavailable.make({ reason: "database unavailable" });
    const different = ThreadStoreUnavailable.make({ reason: "database timed out" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares WorkspaceVaultStoreUnavailable by declared fields", () => {
    const same = S.toEquivalence(WorkspaceVaultStoreUnavailable);
    const first = WorkspaceVaultStoreUnavailable.make({ reason: "vault unavailable" });
    const second = WorkspaceVaultStoreUnavailable.make({ reason: "vault unavailable" });
    const different = WorkspaceVaultStoreUnavailable.make({ reason: "vault timed out" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares WorkspaceVaultRootInvalid by declared fields", () => {
    const same = S.toEquivalence(WorkspaceVaultRootInvalid);
    const first = WorkspaceVaultRootInvalid.make({ path: "/vault", reason: "root is not writable" });
    const second = WorkspaceVaultRootInvalid.make({ path: "/vault", reason: "root is not writable" });
    const different = WorkspaceVaultRootInvalid.make({ path: "/other-vault", reason: "root is not writable" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares WorkspaceVaultActionError by declared fields", () => {
    const same = S.toEquivalence(WorkspaceVaultActionError);
    const first = WorkspaceVaultActionError.new("Vault action failed.");
    const second = WorkspaceVaultActionError.new("Vault action failed.");
    const different = WorkspaceVaultActionError.new("Vault action was rejected.");

    expectDeclaredEquivalence(same, first, second, different);
  });
});
