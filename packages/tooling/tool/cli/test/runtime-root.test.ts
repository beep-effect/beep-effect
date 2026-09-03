import { userInfo } from "node:os";
import {
  admissionRootFor,
  canonicalRuntimeRootForTesting,
  perUserRuntimeRoot,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
} from "@beep/repo-cli/test/RepoRun";
import { proofCoordinatorLockPath } from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Path } from "effect";

const uid = userInfo().uid;
const canonicalRoot = canonicalRuntimeRootForTesting(process.platform, userInfo().homedir);
const canonical = RuntimeRootChoice.make({ kind: "canonical", root: canonicalRoot });

const resolveWith = (environment: Readonly<Record<string, string>>) =>
  perUserRuntimeRoot().pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment))
  );

describe("per-user runtime root", () => {
  it("uses a stable user-writable Windows base without consulting TEMP", () => {
    expect(canonicalRuntimeRootForTesting("win32", "C:\\Users\\alice")).toBe("C:\\Users\\alice\\.beep\\runtime");
    expect(canonicalRuntimeRootForTesting("linux", "/home/alice")).toBe("/home/alice/.beep/runtime");
    expect(canonicalRuntimeRootForTesting("darwin", "/Users/alice/")).toBe("/Users/alice/.beep/runtime");
  });

  it.effect("uses one invariant host root across launcher environment variants", () =>
    Effect.gen(function* () {
      const configured = yield* resolveWith({ XDG_RUNTIME_DIR: "/configured/runtime", TMPDIR: "/custom/tmp" });
      const relative = yield* resolveWith({ XDG_RUNTIME_DIR: "relative/runtime" });
      const empty = yield* resolveWith({ XDG_RUNTIME_DIR: "", TMPDIR: "" });
      const scrubbed = yield* resolveWith({});
      expect(configured).toStrictEqual(canonical);
      expect(relative).toStrictEqual(canonical);
      expect(empty).toStrictEqual(canonical);
      expect(scrubbed).toStrictEqual(configured);
    })
  );

  it.effect("does not require a fallible filesystem probe", () =>
    Effect.gen(function* () {
      expect(yield* perUserRuntimeRoot()).toStrictEqual(canonical);
    })
  );

  it.effect("accepts an explicit isolated test override", () =>
    Effect.gen(function* () {
      const override = RuntimeRootChoice.make({ kind: "test-override", root: "/isolated/runtime" });
      const choice = yield* perUserRuntimeRoot().pipe(provideRuntimeRootForTesting(override));
      expect(choice).toStrictEqual(override);
    })
  );

  it.effect("keeps the admission and proof-lock leaves where they always lived", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const configured = RuntimeRootChoice.make({ kind: "test-override", root: "/configured/runtime" });
      expect(admissionRootFor(path, configured)).toBe("/configured/runtime/beep/admit");
      expect(admissionRootFor(path, canonical)).toBe(path.join(canonicalRoot, `beep-admit-uid-${uid}`));

      const lock = yield* proofCoordinatorLockPath("https://github.com/acme/repo.git").pipe(
        provideRuntimeRootForTesting(configured),
        provideScopedLayer(FileSystem.layerNoop({}))
      );
      expect(lock.startsWith("/configured/runtime/beep-yeet-proof-locks-")).toBe(true);
      expect(lock).not.toContain("/beep/admit/");
    }).pipe(provideScopedLayer(NodePath.layer))
  );
});
