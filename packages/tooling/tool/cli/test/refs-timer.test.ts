import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import { ReferenceFixture, referenceFixtureLayer, workspace, writeExecutable } from "./refs-test-utils.ts";

describe("reference refresh timer", () => {
  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "renders the complete service and calendar without optional environment files",
    (it) => {
      it.effect(
        "renders the complete service and calendar without optional environment files",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          const units = yield* workspace.use((service) =>
            service.renderTimerUnits(f.home, f.root, "*-*-* 03:30:00", "/opt/bun runtime/bun")
          );
          expect(units[0]?.text).toBe(
            [
              "[Unit]",
              "Description=beep reference workspace refresh",
              "",
              "[Service]",
              "Type=oneshot",
              `WorkingDirectory=${f.owner}`,
              "Environment=PATH=%h/.local/share/mise/shims:%h/.local/bin:%h/.bun/bin:/usr/local/bin:/usr/bin:/bin",
              "Environment=CI=true",
              `EnvironmentFile=${f.home}/.config/beep-graft/env`,
              'ExecStartPre=/usr/bin/env -i "HOME=%h" "PATH=%h/.local/share/mise/shims:%h/.local/bin:%h/.bun/bin:/usr/local/bin:/usr/bin:/bin" CI=true "/opt/bun runtime/bun" install --frozen-lockfile --ignore-scripts',
              `ExecStart="/opt/bun runtime/bun" run beep refs refresh --root "${f.root}" --jobs 16`,
              "TimeoutStartSec=12h",
              "TimeoutStopSec=90",
              "KillMode=mixed",
              "Nice=10",
              "Slice=background.slice",
              "",
            ].join("\n")
          );
          expect(units[1]?.text).toBe(
            [
              "[Unit]",
              "Description=Timer for beep reference workspace refresh",
              "",
              "[Timer]",
              "OnCalendar=*-*-* 03:30:00",
              "Persistent=true",
              "RandomizedDelaySec=600",
              "",
              "[Install]",
              "WantedBy=timers.target",
              "",
            ].join("\n")
          );
          expect(yield* f.fs.exists(f.path.join(f.home, ".config"))).toBe(false);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "installs, re-renders recorded values with the mise shim, and uninstalls using fake systemctl",
    (it) => {
      it.effect(
        "installs, re-renders recorded values with the mise shim, and uninstalls using fake systemctl",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          yield* writeExecutable(
            f.path.join(f.bin, "systemctl"),
            '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOME/systemctl.log"\n'
          );
          yield* f.fs.makeDirectory(f.path.join(f.home, ".config/beep-graft"), { recursive: true });
          yield* f.fs.writeFileString(f.path.join(f.home, ".config/beep-graft/env"), "DO_NOT_TRACK=1\n");
          const shim = f.path.join(f.home, ".local/share/mise/shims/bun");
          yield* f.fs.makeDirectory(f.path.dirname(shim), { recursive: true });
          yield* writeExecutable(shim, "#!/bin/sh\nexit 0\n");
          yield* workspace.use((service) => service.installTimer(f.home, f.root, "*-*-* 04:20:00", "/old/bun"));
          yield* workspace.use((service) => service.refreshTimer(f.home, O.none()));
          const unitDir = f.path.join(f.home, ".config/systemd/user");
          const serviceText = yield* f.fs.readFileString(f.path.join(unitDir, "beep-refs-refresh.service"));
          expect(serviceText).toContain(`ExecStart="${shim}"`);
          expect(serviceText).toContain(`WorkingDirectory=${f.owner}`);
          expect(serviceText).toContain(`--root "${f.root}"`);
          expect(yield* f.fs.readFileString(f.path.join(unitDir, "beep-refs-refresh.timer"))).toContain(
            "OnCalendar=*-*-* 04:20:00"
          );
          const removed = yield* workspace.use((service) => service.uninstallTimer(f.home));
          expect(removed).toHaveLength(2);
          expect(yield* f.fs.readDirectory(unitDir)).toEqual([]);
          expect(yield* f.fs.readFileString(f.path.join(f.home, "systemctl.log"))).toBe(
            [
              "--user daemon-reload",
              "--user enable --now beep-refs-refresh.timer",
              "--user daemon-reload",
              "--user enable --now beep-refs-refresh.timer",
              "--user disable --now beep-refs-refresh.timer",
              "--user daemon-reload",
              "",
            ].join("\n")
          );
          const missing = yield* workspace.use((service) => service.refreshTimer(f.home, O.none())).pipe(Effect.result);
          expect(missing._tag).toBe("Failure");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "refuses unit injection and a missing environment file before writing",
    (it) => {
      it.effect(
        "refuses unit injection and a missing environment file before writing",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          for (const unsafe of ["/bad\npath", "/bad%h", '/bad"path', "/bad$HOME"]) {
            const result = yield* workspace
              .use((service) => service.renderTimerUnits(f.home, unsafe, "*-*-* 03:30:00", "/bin/bun"))
              .pipe(Effect.result);
            expect(result._tag).toBe("Failure");
          }
          const missing = yield* workspace
            .use((service) => service.installTimer(f.home, f.root, "*-*-* 03:30:00", "/bin/bun"))
            .pipe(Effect.result);
          expect(missing._tag).toBe("Failure");
          expect(yield* f.fs.exists(f.path.join(f.home, ".config/systemd"))).toBe(false);
        })
      );
    }
  );
});
