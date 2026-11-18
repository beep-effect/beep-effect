#!/usr/bin/env bun
/**
 * Exercise SSH notification wrappers without a network, device, agent, or notification.
 *
 * Usage: bun ssh-touch-reuse-check.ts <wrapper.sh> [<wrapper.sh> ...]
 * Prints one PASS line per wrapper; the first failed assertion prints
 * `AssertionError: <message>` to stderr and exits 1.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import type { Server } from "node:net";

class AssertionError extends Error {}

function assert(condition: boolean, message = ""): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

// The mock ssh: answers -G with the effective ControlPath, -O check with the live-master state, and
// records every other invocation. It runs LocalCommand only for a fresh connection, as OpenSSH does.
const MOCK_SSH = `#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
let destination = null;
let remote = [];
let configuration = false;
let operation = null;
let controlPath = "none";
let localCommand = null;
let permitLocalCommand = false;
let index = 0;
while (index < args.length) {
  const argument = args[index];
  if (["-F", "-S", "-O", "-o", "-i"].includes(argument)) {
    const value = args[index + 1];
    if (argument === "-S") controlPath = value;
    else if (argument === "-O") operation = value;
    else if (argument === "-o" && value.startsWith("ControlPath=")) controlPath = value.slice(value.indexOf("=") + 1);
    else if (argument === "-o" && value.startsWith("LocalCommand=")) localCommand = value.slice(value.indexOf("=") + 1);
    else if (argument === "-o" && value === "PermitLocalCommand=yes") permitLocalCommand = true;
    index += 2;
  } else if (argument === "-G") { configuration = true; index += 1; }
  else if (argument.startsWith("-")) index += 1;
  else if (destination === null) { destination = argument; index += 1; }
  else { remote = args.slice(index); break; }
}
const live = controlPath === process.env.MOCK_SOCKET && process.env.MOCK_REUSE === "true";
if (configuration) {
  process.stdout.write("controlpath " + controlPath + "\\n");
} else if (operation !== null) {
  process.exit(operation === "check" && live ? 0 : 255);
} else {
  if (!live && permitLocalCommand && localCommand) {
    const result = spawnSync("bash", ["-c", localCommand], { stdio: "inherit", timeout: 5000 });
    if (result.status !== 0) process.exit(1);
  }
  appendFileSync(process.env.MOCK_CALLS, JSON.stringify({ argv: args, remote }) + "\\n");
}
`;

const MOCK_KEY_LISTING = '#!/bin/sh\nprintf "%s\\n" "256 $MOCK_KEY_FINGERPRINT fixture (ED25519-SK)"\n';

const MOCK_ALERT = `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
appendFileSync(process.env.MOCK_EVENTS, JSON.stringify(process.argv.slice(2)) + "\\n");
`;

type Case = readonly [
  reuse: "true" | "false",
  arguments: ReadonlyArray<string>,
  expectedStarts: number,
  expectedRemote: ReadonlyArray<string>,
  expectedReuse: boolean,
];

type Invocation = { readonly argv: ReadonlyArray<string>; readonly remote: ReadonlyArray<string> };

// Python's repr of a list of strings, kept so failure messages read as before.
const pyRepr = (items: ReadonlyArray<string>): string =>
  `[${items.map((item) => (item.includes("'") && !item.includes('"') ? `"${item}"` : `'${item.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`)).join(", ")}]`;

const writeExecutable = (path: string, content: string) => {
  writeFileSync(path, content);
  chmodSync(path, 0o700);
};

const jsonLines = <T>(path: string): ReadonlyArray<T> =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as T);

const listen = (path: string) =>
  new Promise<Server>((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(path, () => done(server));
  });

const checkWrapper = async (parent: string, wrapper: string) => {
  const name = basename(wrapper);
  const home = mkdtempSync(join(parent, "tmp"));
  const handles: Array<Server> = [];
  try {
    const binary = join(home, "bin");
    mkdirSync(binary);
    mkdirSync(join(home, ".ssh"));
    const alerts = join(home, ".local/bin");
    mkdirSync(alerts, { recursive: true });
    const events = join(home, "events");
    const calls = join(home, "calls");
    writeExecutable(join(binary, "ssh"), MOCK_SSH);
    for (const tool of ["ssh-add", "ssh-keygen"]) {
      writeExecutable(join(binary, tool), MOCK_KEY_LISTING);
    }
    writeExecutable(join(alerts, "yubikey-touch-alert"), MOCK_ALERT);
    for (const suffix of ["dankserver", "tbk-worker"]) {
      const keySuffix = suffix === "tbk-worker" ? suffix.replaceAll("-", "_") : suffix;
      writeFileSync(join(home, ".ssh", `id_ed25519_sk_${keySuffix}`), "inert fixture");
      writeFileSync(join(home, ".ssh", `id_ed25519_sk_${keySuffix}.pub`), "inert fixture");
      handles.push(await listen(join(home, ".ssh", `agent-${suffix}.sock`)));
    }
    const socket = join(home, "control socket");
    const environment: Record<string, string | undefined> = {
      ...process.env,
      HOME: home,
      PATH: `${binary}${delimiter}${process.env.PATH ?? ""}`,
      MOCK_KEY_FINGERPRINT: name.includes("ubuntu")
        ? "SHA256:bVUwE95rPZDRHE6byIIJdOkfc90OHj1dFC1sc1Rz1HA"
        : "SHA256:/MMPLM/N77AYZ6fGapAV83I/ALH9IyF5h2xmVwpgnPU",
      MOCK_SOCKET: socket,
      MOCK_CALLS: calls,
      MOCK_EVENTS: events,
    };
    const cases: Array<Case> = [
      ["true", ["-o", `ControlPath=${socket}`, "echo", "fixture"], 0, ["echo", "fixture"], true],
      ["true", ["echo", "fixture"], 1, ["echo", "fixture"], false],
      ["false", ["-S", socket, "echo", "fixture"], 1, ["echo", "fixture"], false],
      ["false", ["echo", "fixture"], 1, ["echo", "fixture"], false],
      ["false", ["-G"], 0, [], false],
      ["false", ["echo", "-G"], 1, ["echo", "-G"], false],
      ["false", ["echo", "-O", "check"], 1, ["echo", "-O", "check"], false],
      ["false", ["-o", "ConnectTimeout=1", "-G"], 0, [], false],
    ];
    if (["ssh-beep-worker-yubi", "ssh-tbk-worker", "ssh-tbk-ubuntu"].includes(name.replace(/\.sh$/, ""))) {
      cases.push(
        ["true", ["--admin", "-o", `ControlPath=${socket}`, "echo", "fixture"], 1, ["echo", "fixture"], true],
        ["true", ["--admin", "-o", `ControlPath=${socket}`, "echo", "-G"], 1, ["echo", "-G"], true],
        ["false", ["--admin", "echo", "fixture"], 2, ["echo", "fixture"], false],
        ["true", ["--admin", "-o", `ControlPath=${socket}`, "-G"], 0, [], false],
        ["false", ["--admin", "-G"], 0, [], false]
      );
    }
    for (const [reuse, args, expectedStarts, expectedRemote, expectedReuse] of cases) {
      writeFileSync(events, "");
      writeFileSync(calls, "");
      const result = spawnSync("bash", [resolve(wrapper), ...args], {
        env: { ...environment, MOCK_REUSE: reuse },
        encoding: "utf8",
        timeout: 15_000,
      });
      if (result.error !== undefined) {
        throw result.error;
      }
      assert(result.status === 0, `${name}: wrapper failed`);
      const starts = jsonLines<ReadonlyArray<string>>(events).filter((event) => event[0] === "start");
      assert(starts.length === expectedStarts, `${name}: incorrect alerts for ${pyRepr(args)}`);
      const recorded = jsonLines<Invocation>(calls);
      assert(recorded.length === (expectedRemote.length > 0 ? 1 : 0), `${name}: incorrect final invocation count`);
      const invocation = recorded[0];
      if (expectedRemote.length > 0 && invocation !== undefined) {
        assert(JSON.stringify(invocation.remote) === JSON.stringify(expectedRemote), `${name}: remote command changed`);
        assert(invocation.argv.includes("ProxyCommand=false") === expectedReuse);
        if (expectedReuse) {
          assert(invocation.argv.includes("ControlMaster=no"));
          assert(invocation.argv.includes(socket));
          if (args[0] === "--admin") {
            const message = starts[0]?.[2] ?? "";
            assert(message.includes("sudo") && !message.includes("waiting"));
          }
        }
      }
    }
    process.stdout.write(
      `PASS: ${name}: ordinary reuse quiet; fresh auth announced; admin sudo heads-up retained; queries quiet; no fallback dial\n`
    );
  } finally {
    await Promise.all(handles.map((handle) => new Promise((done) => handle.close(done))));
    rmSync(home, { recursive: true, force: true });
  }
};

const main = async (wrappers: ReadonlyArray<string>) => {
  const parent = join(homedir(), ".cache/beep/ssh-touch-check");
  mkdirSync(parent, { recursive: true });
  for (const wrapper of wrappers) {
    await checkWrapper(parent, wrapper);
  }
};

try {
  await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(error instanceof AssertionError ? `AssertionError: ${error.message}\n` : `${String(error)}\n`);
  process.exitCode = 1;
}
