// Runs the AI metrics host steps exactly as rendered, through a local bash in
// which `ssh` evaluates the remote program in place and `docker`, `ss`,
// `curl`, `tailscale` and `systemctl` are exported shell functions answering
// from FAKE_* variables. Nothing reaches a host or a Docker engine.

import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig";
import {
  renderHealthCommand,
  renderPreflightCommand,
  renderRetireComposeCommand,
} from "@beep/infra-hosts/AiMetricsStack";
import { MemoryFileSystem } from "@beep/memfs";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const Platform = NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.merge(MemoryFileSystem.layer, NodePath.layer)));

const decodeConfig = S.decodeUnknownEffect(AiMetricsHostConfig);

const configBody = {
  sshDestination: "metrics-host",
  phoenix: { image: "arizephoenix/phoenix:15.5.0" },
  tailnet: { fqdn: "metrics-host.example.ts.net" },
  legacyCompose: { configRoot: "/srv/ai-metrics" },
  secretRefs: { hashSalt: "op://vault/ai-metrics/hash-salt", rawArchiveKey: "op://vault/ai-metrics/raw-archive-key" },
};

const fakeHost = A.join(
  [
    'ssh() { while [ "$1" != "--" ]; do shift; done; shift 2; eval "$1"; }',
    "docker() {",
    '  case "$1" in',
    "    version|logs) return 0 ;;",
    '    volume) printf "%s" "${FAKE_VOLUME_PROJECT-}" ;;',
    '    container) printf "%s" "${FAKE_CONTAINER_PROJECT-}" ;;',
    '    ps) [ -n "${FAKE_PORT_HOLDER-}" ] && printf "%s\\n" "${FAKE_PORT_HOLDER}"; return 0 ;;',
    "    inspect) printf healthy ;;",
    '    port) printf "%s\\n" "${FAKE_PUBLISHED-}" ;;',
    "  esac",
    "}",
    'ss() { printf "%s" "${FAKE_SS-}"; }',
    "curl() { return 0; }",
    "systemctl() { return 0; }",
    'tailscale() { [ "$1 $2" = "serve status" ] && printf "127.0.0.1:6006\\n"; return 0; }',
    "export -f ssh docker ss curl systemctl tailscale",
  ],
  "\n"
);

const runStep = Effect.fn("AiMetricsScriptsTest.runStep")(function* (command: string, fakes: Record<string, string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make("/bin/bash", ["--noprofile", "--norc", "-c", `${fakeHost}\n${command}`], {
      env: { ...fakes, HOME: "/nonexistent-home" },
      extendEnv: true,
    })
  );
  const [stderr, exitCode] = yield* Effect.all(
    [handle.stderr.pipe(Stream.decodeText(), Stream.mkString), handle.exitCode],
    {
      concurrency: "unbounded",
    }
  );
  return { exitCode, stderr };
});

describe("AI metrics host step scripts", () => {
  it.layer(Platform, { timeout: "30 seconds" })((it) => {
    it.effect("RetireCompose passes when no Compose container is left", () =>
      Effect.gen(function* () {
        const config = yield* decodeConfig(configBody);
        const result = yield* runStep(renderRetireComposeCommand(config), { FAKE_CONTAINER_PROJECT: "" });
        expect(result).toEqual({ exitCode: 0, stderr: "" });
      })
    );

    it.effect("RetireCompose refuses a surviving container of the expected Compose project", () =>
      Effect.gen(function* () {
        const config = yield* decodeConfig(configBody);
        const result = yield* runStep(renderRetireComposeCommand(config), {
          FAKE_CONTAINER_PROJECT: "beep-ai-metrics-dankserver",
        });
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('of project "beep-ai-metrics-dankserver" survived compose down');
      })
    );

    it.effect("RetireCompose refuses a container of another Compose project, naming both", () =>
      Effect.gen(function* () {
        const config = yield* decodeConfig(configBody);
        const result = yield* runStep(renderRetireComposeCommand(config), { FAKE_CONTAINER_PROJECT: "other-project" });
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
          'belongs to Compose project "other-project", expected "beep-ai-metrics-dankserver"'
        );
      })
    );

    it.effect("RetireCompose follows a configured Compose project", () =>
      Effect.gen(function* () {
        const renamed = yield* decodeConfig({
          sshDestination: "metrics-host",
          phoenix: { image: "arizephoenix/phoenix:15.5.0" },
          tailnet: { fqdn: "metrics-host.example.ts.net" },
          legacyCompose: { configRoot: "/srv/ai-metrics", composeProject: "other-project" },
          secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" },
        });
        const command = renderRetireComposeCommand(renamed);
        expect(command).toContain("other-project_phoenix_data");
        const result = yield* runStep(command, { FAKE_CONTAINER_PROJECT: "beep-ai-metrics-dankserver" });
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('expected "other-project"');
      })
    );

    it.effect("prod Preflight refuses a data volume of another Compose project", () =>
      Effect.gen(function* () {
        const config = yield* decodeConfig(configBody);
        const command = renderPreflightCommand({ config, containerName: "beep-ai-metrics-phoenix", kind: "prod" });
        const matching = yield* runStep(command, { FAKE_VOLUME_PROJECT: "beep-ai-metrics-dankserver" });
        expect(matching.exitCode).toBe(0);
        const differing = yield* runStep(command, { FAKE_VOLUME_PROJECT: "other-project" });
        expect(differing.exitCode).toBe(1);
        expect(differing.stderr).toContain(
          'carries Compose project "other-project", expected "beep-ai-metrics-dankserver"'
        );
      })
    );

    it.effect("rehearsal Preflight refuses a port another stage's container holds, naming it", () =>
      Effect.gen(function* () {
        const config = yield* decodeConfig(configBody);
        const command = renderPreflightCommand({
          config,
          containerName: "beep-ai-metrics-phoenix-dev_operator",
          kind: "rehearsal",
        });
        const occupied = yield* runStep(command, { FAKE_PORT_HOLDER: "beep-ai-metrics-phoenix-live_operator" });
        expect(occupied.exitCode).toBe(1);
        expect(occupied.stderr).toContain(
          "rehearsal port 16006 is held by container beep-ai-metrics-phoenix-live_operator"
        );
        const own = yield* runStep(command, { FAKE_PORT_HOLDER: "beep-ai-metrics-phoenix-dev_operator" });
        expect(own.exitCode).toBe(0);
        const free = yield* runStep(command, {});
        expect(free.exitCode).toBe(0);
      })
    );

    it.effect("rehearsal Preflight refuses a port a process outside Docker holds", () =>
      Effect.gen(function* () {
        const config = yield* decodeConfig(configBody);
        const command = renderPreflightCommand({
          config,
          containerName: "beep-ai-metrics-phoenix-dev_operator",
          kind: "rehearsal",
        });
        const result = yield* runStep(command, { FAKE_SS: "LISTEN 0 4096 127.0.0.1:16006 0.0.0.0:*" });
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("held by a process outside Docker");
      })
    );

    it.effect("Health refuses a port that is not published by this stage's container", () =>
      Effect.gen(function* () {
        const config = yield* decodeConfig(configBody);
        const command = renderHealthCommand({
          config,
          containerName: "beep-ai-metrics-phoenix-dev_operator",
          hostPort: 16006,
          kind: "rehearsal",
        });
        const own = yield* runStep(command, { FAKE_PUBLISHED: "127.0.0.1:16006" });
        expect(own.exitCode).toBe(0);
        const other = yield* runStep(command, { FAKE_PUBLISHED: "127.0.0.1:16007" });
        expect(other.exitCode).toBe(1);
        expect(other.stderr).toContain("is not published by container beep-ai-metrics-phoenix-dev_operator");
      })
    );
  });
});
