import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { ReferenceFixture, referenceFixtureLayer, workspace, writeExecutable } from "./refs-test-utils.ts";

describe("reference refresh timer", () => {
  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "renders the complete service and calendar without ordering or environment files",
    (it) => {
      it.effect(
        "renders the complete service and calendar without ordering or environment files",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          const units = yield* workspace.use((service) =>
            service.renderTimerUnits(f.home, f.root, "*-*-* 03:30:00", "/opt/bun runtime/bun")
          );
          expect(units[0]?.text).toBe(
            A.join(
              [
                "[Unit]",
                "Description=beep reference workspace refresh",
                "",
                "[Service]",
                "Type=oneshot",
                `WorkingDirectory=${f.owner}`,
                "Environment=PATH=%h/.local/share/mise/shims:%h/.local/bin:%h/.bun/bin:/usr/local/bin:/usr/bin:/bin",
                "Environment=CI=true",
                'ExecStartPre=/usr/bin/env -i "HOME=%h" "PATH=%h/.local/share/mise/shims:%h/.local/bin:%h/.bun/bin:/usr/local/bin:/usr/bin:/bin" CI=true "/opt/bun runtime/bun" install --frozen-lockfile --ignore-scripts',
                `ExecStart="/opt/bun runtime/bun" run beep refs refresh --root "${f.root}"`,
                "TimeoutStartSec=12h",
                "TimeoutStopSec=90",
                "KillMode=mixed",
                "Nice=10",
                "Slice=background.slice",
                "",
              ],
              "\n"
            )
          );
          expect(units[1]?.text).toBe(
            A.join(
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
              ],
              "\n"
            )
          );
          expect(units[0]?.text).not.toMatch(/^(?:After|Wants|Requires|BindsTo|Requisite|EnvironmentFile)=/mu);
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
          expect(serviceText).not.toContain("--jobs");
          expect(yield* f.fs.readFileString(f.path.join(unitDir, "beep-refs-refresh.timer"))).toContain(
            "OnCalendar=*-*-* 04:20:00"
          );
          const removed = yield* workspace.use((service) => service.uninstallTimer(f.home));
          expect(removed).toHaveLength(2);
          expect(yield* f.fs.readDirectory(unitDir)).toEqual([]);
          expect(yield* f.fs.readFileString(f.path.join(f.home, "systemctl.log"))).toBe(
            A.join(
              [
                "--user daemon-reload",
                "--user enable --now beep-refs-refresh.timer",
                "--user daemon-reload",
                "--user enable --now beep-refs-refresh.timer",
                "--user disable --now beep-refs-refresh.timer",
                "--user daemon-reload",
                "",
              ],
              "\n"
            )
          );
          const missing = yield* workspace.use((service) => service.refreshTimer(f.home, O.none())).pipe(Effect.result);
          expect(missing._tag).toBe("Failure");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "re-renders units installed by the previous renderer without their ordering, env file, or jobs flag",
    (it) => {
      it.effect(
        "re-renders units installed by the previous renderer without their ordering, env file, or jobs flag",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          yield* writeExecutable(
            f.path.join(f.bin, "systemctl"),
            '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOME/systemctl.log"\n'
          );
          const unitDir = f.path.join(f.home, ".config/systemd/user");
          yield* f.fs.makeDirectory(unitDir, { recursive: true });
          yield* f.fs.writeFileString(
            f.path.join(unitDir, "beep-refs-refresh.service"),
            A.join(
              [
                "[Unit]",
                "After=legacy-ordering.service",
                "",
                "[Service]",
                `WorkingDirectory=${f.owner}`,
                `EnvironmentFile=${f.home}/.config/legacy/env`,
                `ExecStart="/old/bun" run beep refs refresh --root "${f.root}" --jobs 16`,
                "",
              ],
              "\n"
            )
          );
          yield* f.fs.writeFileString(
            f.path.join(unitDir, "beep-refs-refresh.timer"),
            "[Timer]\nOnCalendar=*-*-* 05:10:00\n"
          );
          yield* workspace.use((service) => service.refreshTimer(f.home, O.some("/pinned/bun")));
          const serviceText = yield* f.fs.readFileString(f.path.join(unitDir, "beep-refs-refresh.service"));
          expect(serviceText).toContain(`ExecStart="/pinned/bun" run beep refs refresh --root "${f.root}"\n`);
          expect(serviceText).toContain(`WorkingDirectory=${f.owner}`);
          expect(serviceText).not.toMatch(/^(?:After|EnvironmentFile)=/mu);
          expect(serviceText).not.toContain("--jobs");
          expect(yield* f.fs.readFileString(f.path.join(unitDir, "beep-refs-refresh.timer"))).toContain(
            "OnCalendar=*-*-* 05:10:00"
          );
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })("refuses unit injection before writing", (it) => {
    it.effect(
      "refuses unit injection before writing",
      Effect.fnUntraced(function* () {
        const f = yield* ReferenceFixture;
        for (const unsafe of ["/bad\npath", "/bad%h", '/bad"path', "/bad$HOME"]) {
          const result = yield* workspace
            .use((service) => service.renderTimerUnits(f.home, unsafe, "*-*-* 03:30:00", "/bin/bun"))
            .pipe(Effect.result);
          expect(result._tag).toBe("Failure");
        }
        const injected = yield* workspace
          .use((service) => service.installTimer(f.home, "/bad\npath", "*-*-* 03:30:00", "/bin/bun"))
          .pipe(Effect.result);
        expect(injected._tag).toBe("Failure");
        expect(yield* f.fs.exists(f.path.join(f.home, ".config/systemd"))).toBe(false);
      })
    );
  });

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "fails uninstall with systemctl's output when disabling the timer fails",
    (it) => {
      it.effect(
        "fails uninstall with systemctl's output when disabling the timer fails",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          yield* writeExecutable(f.path.join(f.bin, "systemctl"), '#!/bin/sh\nprintf "unit busy\\n"\nexit 3\n');
          const unitDir = f.path.join(f.home, ".config/systemd/user");
          yield* f.fs.makeDirectory(unitDir, { recursive: true });
          yield* f.fs.writeFileString(f.path.join(unitDir, "beep-refs-refresh.timer"), "[Timer]\n");
          const error = yield* workspace.use((service) => service.uninstallTimer(f.home)).pipe(Effect.flip);
          expect(error.message).toBe("systemctl exited 3: unit busy");
          expect(yield* f.fs.readDirectory(unitDir)).toEqual(["beep-refs-refresh.timer"]);
        })
      );
    }
  );
});
