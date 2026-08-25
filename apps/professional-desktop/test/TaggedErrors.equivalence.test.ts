import { YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { YouTubeWatchOpenFailed } from "@/chat/ui/YouTubeWatchOpener";
import { ContradictionQaSeedError } from "@/contradiction/ContradictionQaSeed";
import { BrowserFileReadError, VaultDirectoryPickerInvocationError } from "@/intake/Intake.atoms";
import { VaultDirectoryPickError } from "@/intake/VaultDirectoryPicker.rpc";
import { CosmosWorkerInitializationError } from "@/spikes/CosmosSpike";
import { SidecarClosedError, SidecarClosedPayload, SidecarSendError } from "@/transport/TauriIpcSocket";

const sameYouTubeWatchOpenFailed = S.toEquivalence(YouTubeWatchOpenFailed);
const sameContradictionQaSeedError = S.toEquivalence(ContradictionQaSeedError);
const sameVaultDirectoryPickerInvocationError = S.toEquivalence(VaultDirectoryPickerInvocationError);
const sameBrowserFileReadError = S.toEquivalence(BrowserFileReadError);
const sameVaultDirectoryPickError = S.toEquivalence(VaultDirectoryPickError);
const sameCosmosWorkerInitializationError = S.toEquivalence(CosmosWorkerInitializationError);
const sameSidecarClosedError = S.toEquivalence(SidecarClosedError);
const sameSidecarSendError = S.toEquivalence(SidecarSendError);

describe("Professional Desktop tagged-error declared equivalence", () => {
  it("excludes YouTubeWatchOpenFailed cause from diagnostic identity", () => {
    const a = YouTubeWatchOpenFailed.make({
      request: YouTubeWatchRequest.make({ url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" }),
      cause: new Error("first"),
    });
    const b = YouTubeWatchOpenFailed.make({
      request: YouTubeWatchRequest.make({ url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" }),
      cause: new Error("second"),
    });
    const c = YouTubeWatchOpenFailed.make({
      request: YouTubeWatchRequest.make({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      cause: new Error("first"),
    });

    expect(sameYouTubeWatchOpenFailed(a, b)).toBe(true);
    expect(sameYouTubeWatchOpenFailed(a, c)).toBe(false);
  });

  it("compares ContradictionQaSeedError by declared fields", () => {
    const a = ContradictionQaSeedError.new("source-conflict", "The QA source differs.");
    const b = ContradictionQaSeedError.new("source-conflict", "The QA source differs.");
    const c = ContradictionQaSeedError.new("evidence-conflict", "The QA source differs.");

    expect(sameContradictionQaSeedError(a, b)).toBe(true);
    expect(sameContradictionQaSeedError(a, c)).toBe(false);
  });

  it("treats cause-only intake failures as equivalent across opaque causes", () => {
    const invocationA = VaultDirectoryPickerInvocationError.make({ cause: new Error("first") });
    const invocationB = VaultDirectoryPickerInvocationError.make({ cause: new Error("second") });
    const readA = BrowserFileReadError.make({ cause: new Error("first") });
    const readB = BrowserFileReadError.make({ cause: new Error("second") });

    expect(sameVaultDirectoryPickerInvocationError(invocationA, invocationB)).toBe(true);
    expect(sameBrowserFileReadError(readA, readB)).toBe(true);
  });

  it("compares VaultDirectoryPickError by declared fields", () => {
    const a = VaultDirectoryPickError.new("Native folder dialog unavailable.");
    const b = VaultDirectoryPickError.new("Native folder dialog unavailable.");
    const c = VaultDirectoryPickError.new("Native folder dialog rejected.");

    expect(sameVaultDirectoryPickError(a, b)).toBe(true);
    expect(sameVaultDirectoryPickError(a, c)).toBe(false);
  });

  it("excludes CosmosWorkerInitializationError cause from diagnostic identity", () => {
    const a = CosmosWorkerInitializationError.make({
      cause: new Error("first"),
      message: "The graph worker could not start.",
    });
    const b = CosmosWorkerInitializationError.make({
      cause: new Error("second"),
      message: "The graph worker could not start.",
    });
    const c = CosmosWorkerInitializationError.make({
      cause: new Error("first"),
      message: "The graph worker failed during setup.",
    });

    expect(sameCosmosWorkerInitializationError(a, b)).toBe(true);
    expect(sameCosmosWorkerInitializationError(a, c)).toBe(false);
  });

  it("compares SidecarClosedError by declared fields", () => {
    const a = SidecarClosedError.make({
      message: "sidecar terminated",
      payload: SidecarClosedPayload.make({ kind: "terminated" }),
    });
    const b = SidecarClosedError.make({
      message: "sidecar terminated",
      payload: SidecarClosedPayload.make({ kind: "terminated" }),
    });
    const c = SidecarClosedError.make({
      message: "sidecar terminated",
      payload: SidecarClosedPayload.make({ kind: "event-stream-closed" }),
    });

    expect(sameSidecarClosedError(a, b)).toBe(true);
    expect(sameSidecarClosedError(a, c)).toBe(false);
  });

  it("compares SidecarSendError by declared fields", () => {
    const a = SidecarSendError.make({ causeMessage: "stdin closed", message: "sidecar send failed" });
    const b = SidecarSendError.make({ causeMessage: "stdin closed", message: "sidecar send failed" });
    const c = SidecarSendError.make({ causeMessage: "broken pipe", message: "sidecar send failed" });

    expect(sameSidecarSendError(a, b)).toBe(true);
    expect(sameSidecarSendError(a, c)).toBe(false);
  });
});
