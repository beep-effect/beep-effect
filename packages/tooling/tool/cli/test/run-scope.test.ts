import {
  detectRunScopeSupport,
  enterRunScope,
  readRunScopeOwnerRoot,
  readRunScopeTelemetry,
  runScopeCleanupHint,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";

const writeExecutable = Effect.fn("RunScopeTest.writeExecutable")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});

const withTempDirectory = <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({ prefix: "run-scope-test-" });
    }),
    use,
    (root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(root, { force: true, recursive: true });
      })
  );

const configured = (values: Readonly<Record<string, string>>) =>
  provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(values)));

describe("run scope", () => {
  it.effect("reports disabled without probing when BEEP_RUN_SCOPES is 0", () =>
    detectRunScopeSupport().pipe(
      configured({ BEEP_RUN_SCOPES: "0" }),
      Effect.tap((support) => Effect.sync(() => expect(support).toBe("disabled"))),
      provideScopedLayer(NodeServices.layer)
    )
  );

  it.effect("falls back to unsupported when the busctl probe exits non-zero", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(path.join(root, "busctl"), "#!/bin/sh\nexit 19\n");
        const support = yield* detectRunScopeSupport().pipe(configured({ PATH: root }));
        expect(support).toBe("unsupported");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports active when the busctl probe succeeds", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(path.join(root, "busctl"), "#!/bin/sh\nexit 0\n");
        const support = yield* detectRunScopeSupport().pipe(configured({ PATH: root }));
        expect(support).toBe("active");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("starts a safe transient scope that adopts the current pid", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const capturePath = path.join(root, "busctl.argv");
        yield* writeExecutable(
          path.join(root, "busctl"),
          `#!/bin/sh\nprintf '%s\\n' "$@" >> '${capturePath}'\nfor argument do\n  [ "$argument" = "GetUnitByPID" ] && printf 'o "/org/freedesktop/systemd1/unit/agent_2drun_2dticket_2dwith_2dspaces_2escope"\\n'\ndone\nexit 0\n`
        );

        const record = yield* enterRunScope("ticket with spaces", root).pipe(configured({ PATH: root }));
        expect(record.support).toBe("active");
        expect(record.unitName).toMatch(/^agent-run-[a-zA-Z0-9:_.-]+\.scope$/u);
        expect(record.unitName).toBe("agent-run-ticket-with-spaces.scope");

        const captured = yield* fs.readFileString(capturePath);
        expect(captured).toContain(
          `StartTransientUnit\nssa(sv)a(sa(sv))\n${record.unitName}\nfail\n4\nDescription\ns\nbeep-yeet-lease nonce=ticket with spaces root=${root}\nSlice\ns\nagent-runs.slice\nPIDs\nau\n1\n${process.pid}\nCollectMode\ns\ninactive-or-failed\n0\n`
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("retains a failed support record when StartTransientUnit fails", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(
          path.join(root, "busctl"),
          '#!/bin/sh\nfor argument do\n  [ "$argument" = "StartTransientUnit" ] && exit 23\ndone\nexit 0\n'
        );
        const record = yield* enterRunScope("d0a7b0dc", root).pipe(configured({ PATH: root }));
        expect(record.support).toBe("failed");
        expect(O.getOrElse(O.fromUndefinedOr(record.warning), () => "")).toContain("23");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("records a failed scope when the accepted start job does not adopt this process", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(
          path.join(root, "busctl"),
          '#!/bin/sh\nfor argument do\n  [ "$argument" = "GetUnitByPID" ] && printf \'o "/org/freedesktop/systemd1/unit/session_2d4_2escope"\\n\'\ndone\nexit 0\n'
        );
        const record = yield* enterRunScope("d0a7b0dc", root).pipe(configured({ PATH: root }));
        expect(record.support).toBe("failed");
        expect(O.getOrElse(O.fromUndefinedOr(record.warning), () => "")).toContain("did not adopt");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("records a failed scope when busctl disappears after the support probe", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fakePath = path.join(root, "busctl");
        yield* writeExecutable(
          fakePath,
          `#!/bin/sh\nfor argument do\n  [ "$argument" = "GetUnitByPID" ] && { /bin/rm -- '${fakePath}'; exit 0; }\ndone\nexit 0\n`
        );
        const record = yield* enterRunScope("d0a7b0dc", root).pipe(configured({ PATH: root }));
        expect(record.support).toBe("failed");
        expect(O.getOrElse(O.fromUndefinedOr(record.warning), () => "")).toContain(
          "Could not start the transient systemd run scope."
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("parses systemctl telemetry values", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(
          path.join(root, "systemctl"),
          "#!/bin/sh\nprintf 'TasksCurrent=7\\nMemoryPeak=4096\\n'\n"
        );
        const telemetry = yield* readRunScopeTelemetry("agent-run-d0a7b0dc.scope").pipe(configured({ PATH: root }));
        expect(telemetry.memoryPeakBytes).toBe(4096);
        expect(telemetry.tasksCurrent).toBe(7);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("keeps telemetry names aligned when a property is omitted", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(path.join(root, "systemctl"), "#!/bin/sh\nprintf 'TasksCurrent=7\\n'\n");
        const telemetry = yield* readRunScopeTelemetry("agent-run-d0a7b0dc.scope").pipe(configured({ PATH: root }));
        expect(telemetry.memoryPeakBytes).toBeUndefined();
        expect(telemetry.tasksCurrent).toBe(7);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("treats unset systemctl telemetry as absent", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(
          path.join(root, "systemctl"),
          "#!/bin/sh\nprintf 'MemoryPeak=[not set]\\nTasksCurrent=[not set]\\n'\n"
        );
        const telemetry = yield* readRunScopeTelemetry("agent-run-d0a7b0dc.scope").pipe(configured({ PATH: root }));
        expect(telemetry.memoryPeakBytes).toBeUndefined();
        expect(telemetry.tasksCurrent).toBeUndefined();
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("treats a failing systemctl show as absent telemetry", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(path.join(root, "systemctl"), "#!/bin/sh\nexit 5\n");
        const telemetry = yield* readRunScopeTelemetry("agent-run-d0a7b0dc.scope").pipe(configured({ PATH: root }));
        expect(telemetry.memoryPeakBytes).toBeUndefined();
        expect(telemetry.tasksCurrent).toBeUndefined();
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reads the owning admission root from the scope description", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(
          path.join(root, "systemctl"),
          "#!/bin/sh\nprintf 'Id=agent-run-d0a7b0dc.scope\\nDescription=beep-yeet-lease nonce=d0a7b0dc root=/run/user/1000/beep/admit\\n'\n"
        );
        const owner = yield* readRunScopeOwnerRoot("agent-run-d0a7b0dc.scope").pipe(configured({ PATH: root }));
        expect(O.getOrNull(owner)).toBe("/run/user/1000/beep/admit");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("treats scopes without an ownership description as unowned", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(path.join(root, "systemctl"), "#!/bin/sh\nprintf 'Description=session-4.scope\\n'\n");
        const owner = yield* readRunScopeOwnerRoot("session-4.scope").pipe(configured({ PATH: root }));
        expect(O.isNone(owner)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("treats a failing systemctl show as an unknown owner", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* writeExecutable(path.join(root, "systemctl"), "#!/bin/sh\nexit 5\n");
        const owner = yield* readRunScopeOwnerRoot("agent-run-d0a7b0dc.scope").pipe(configured({ PATH: root }));
        expect(O.isNone(owner)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it("describes scope cleanup ownership in the operator hint", () => {
    const hint = runScopeCleanupHint("agent-run-d0a7b0dc.scope");
    expect(hint).toContain("agent-run-d0a7b0dc.scope");
    expect(hint).toContain("scheduler reap --apply");
  });
});
