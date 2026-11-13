import { afterEach, expect, test } from "bun:test";
import * as Fs from "node:fs";
import * as Os from "node:os";
import { spawn } from "node:child_process";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as BunServices from "@effect/platform-bun/BunServices";
import { prompt, privatePipe, runOwned } from "./prompt.ts";
import { classify } from "./ssh-askpass.ts";
import { install, START, END, RULE } from "./install.ts";

const directories: string[] = [];
function temp() {
  const dir = Fs.mkdtempSync(`${Os.tmpdir()}/plasma-test-`);
  directories.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of directories.splice(0)) Fs.rmSync(dir, { recursive: true, force: true });
});
function fifo() {
  const pipe = privatePipe();
  if (!pipe) throw new Error("test FIFO unavailable");
  return pipe;
}
const selected = { PATH: "/usr/bin:/bin", DISPLAY: ":synthetic", DBUS_SESSION_BUS_ADDRESS: "unix:path=/synthetic" };
function envWithDialog() {
  const dir = temp();
  Fs.writeFileSync(`${dir}/kdialog`, "#!/bin/sh\nexit 1\n", { mode: 0o700 });
  return { ...selected, PATH: `${dir}:/usr/bin:/bin` };
}

for (const [name, status, bytes, expected] of [
  ["success", 0, "synthetic-answer\n", 0],
  ["cancel", 1, "discard-this\n", 1],
  ["empty", 0, "\n", 2],
  ["multiline", 0, "first\nsecond\n", 2],
  ["NUL", 0, "nul\0\n", 2],
  ["CR", 0, "cr\r\n", 2],
] satisfies [string, number, string, number][]) {
  test(`recorded Python pair: ${name}`, async () => {
    const { reader, writer } = fifo();
    try {
      const result = await Effect.runPromise(
        prompt(writer, "Synthetic action", "Synthetic field", 60, envWithDialog(), () =>
          Effect.succeed({ status, output: Buffer.from(bytes) })
        ).pipe(Effect.provide(BunServices.layer))
      );
      expect(result).toBe(expected);
      Fs.closeSync(writer);
      const answer = Fs.readFileSync(reader);
      expect(answer.toString()).toBe(expected === 0 ? "synthetic-answer" : "");
    } finally {
      Fs.closeSync(reader);
      try {
        Fs.closeSync(writer);
      } catch {}
    }
  });
}
test("standard descriptors, duplicate stdout and regular files are refused", async () => {
  const sink = Fs.openSync("/dev/null", "w");
  try {
    for (const fd of [0, 1, 2, sink])
      expect(await Effect.runPromise(prompt(fd, "title", "label").pipe(Effect.provide(BunServices.layer)))).toBe(2);
  } finally {
    Fs.closeSync(sink);
  }
});
test("session discovery refuses missing or mixed metadata and preserves a selected session", async () => {
  for (const mode of ["missing", "mixed", "selected"]) {
    const { reader, writer } = fifo();
    const calls: string[][] = [];
    const env = envWithDialog();
    if (mode !== "selected") Reflect.deleteProperty(env, "DBUS_SESSION_BUS_ADDRESS");
    try {
      const result = await Effect.runPromise(
        prompt(writer, "title", "label", 60, env, (args, childEnv) => {
          calls.push([...args]);
          if (args[0] === "systemctl")
            return Effect.succeed({
              status: 0,
              output: Buffer.from(
                mode === "mixed" ? "DISPLAY=:other\nDBUS_SESSION_BUS_ADDRESS=unix:path=/other\n" : ""
              ),
            });
          expect(childEnv.DISPLAY).toBe(":synthetic");
          return Effect.succeed({ status: 1, output: Buffer.alloc(0) });
        }).pipe(Effect.provide(BunServices.layer))
      );
      expect(result).toBe(mode === "selected" ? 1 : 2);
      expect(calls.length).toBe(1);
    } finally {
      Fs.closeSync(reader);
      Fs.closeSync(writer);
    }
  }
});
test("timeout reaps owned dialog and descendants", async () => {
  const dir = temp();
  const program = ["sh", "-c", `echo $$ > '${dir}/pid'; sleep 30 & wait`];
  const result = await Effect.runPromise(
    runOwned(program, selected, 0.1).pipe(Effect.provide(BunServices.layer), Effect.result)
  );
  expect(result._tag).toBe("Failure");
  const pid = Number(Fs.readFileSync(`${dir}/pid`, "utf8"));
  expect(() => process.kill(pid, 0)).toThrow();
});
test("cancellation reaps owned dialog", async () => {
  const dir = temp();
  const fiber = Effect.runFork(
    runOwned(["sh", "-c", `echo $$ > '${dir}/pid'; sleep 30 & wait`], selected, 60).pipe(
      Effect.provide(BunServices.layer)
    )
  );
  while (!Fs.existsSync(`${dir}/pid`)) await Bun.sleep(10);
  await Effect.runPromise(Fiber.interrupt(fiber));
  expect(() => process.kill(Number(Fs.readFileSync(`${dir}/pid`, "utf8")), 0)).toThrow();
});
const expected = "(operator@host-alias.example.invalid) Verification code:";
const context = {
  PLASMA_AUTH_TITLE: "Synthetic host: connect",
  PLASMA_AUTH_LABEL: "Synthetic OTP to SSH",
  PLASMA_AUTH_SSH_PROMPT: expected,
};
test("askpass callback classification preserves identity and notification boundaries", () => {
  expect(classify({ SSH_ASKPASS_PROMPT: "none" }, [])).toBe("notification");
  expect(classify({ SSH_ASKPASS_PROMPT: "confirm" }, [])).toBe("confirmation");
  expect(classify(context, [expected + " \t"])).toBe("text");
  for (const challenge of [
    "Enter PIN for authenticator:",
    "Enter passphrase for key:",
    "Password:",
    "Verification code: ",
    expected.replace("operator@", "other@"),
    expected.replace("host-alias", "other"),
    expected + "\n",
  ])
    expect(classify(context, [challenge])).toBe("refused");
  expect(classify({}, [])).toBe("refused");
});
test("direct askpass execution refuses with no output", async () => {
  const child = Bun.spawn([process.execPath, new URL("ssh-askpass.ts", import.meta.url).pathname], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await child.exited).toBe(2);
  expect(await new Response(child.stdout).text()).toBe("");
  expect(await new Response(child.stderr).text()).toBe("");
});
test("real helper only delivers through inherited FIFO", async () => {
  const env = envWithDialog();
  Fs.writeFileSync(`${env.PATH.split(":")[0]}/kdialog`, "#!/bin/sh\nprintf 'synthetic-answer\\n'\n", { mode: 0o700 });
  const { reader, writer } = fifo();
  const child = spawn(
    process.execPath,
    [new URL("prompt.ts", import.meta.url).pathname, "--write-fd", "3", "--title", "Synthetic", "--label", "Synthetic"],
    { env, stdio: ["ignore", "pipe", "pipe", writer] }
  );
  Fs.closeSync(writer);
  const received = new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    Fs.createReadStream("", { fd: reader })
      .on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout?.on("data", (b) => stdout.push(b));
  child.stderr?.on("data", (b) => stderr.push(b));
  const status = await new Promise((resolve) => child.once("exit", resolve));
  expect(status).toBe(0);
  expect((await received).toString()).toBe("synthetic-answer");
  expect(Buffer.concat([...stdout, ...stderr]).length).toBe(0);
});
test("install is idempotent, preserves mode and refuses competing or reversed targets", async () => {
  for (const scenario of ["ok", "competing", "reversed", "symlink"]) {
    const home = temp(),
      source = temp();
    Fs.mkdirSync(`${home}/.codex`);
    const original =
      scenario === "reversed" ? `${END}\nExisting instructions.\n${START}\n` : "Existing instructions.\n";
    Fs.writeFileSync(`${home}/.codex/AGENTS.md`, original, { mode: 0o640 });
    if (scenario === "competing") Fs.mkdirSync(`${home}/.claude/skills/plasma-sensitive-entry`, { recursive: true });
    if (scenario === "symlink") {
      Fs.renameSync(`${home}/.codex/AGENTS.md`, `${home}/original`);
      Fs.symlinkSync(`${home}/original`, `${home}/.codex/AGENTS.md`);
    }
    const apply = () => Effect.runPromise(install(home, source).pipe(Effect.provide(BunServices.layer)));
    expect(await apply()).toBe(scenario === "ok");
    if (scenario === "ok") {
      const first = Fs.readFileSync(`${home}/.codex/AGENTS.md`, "utf8");
      expect(first).toContain(RULE);
      expect(await apply()).toBe(true);
      expect(Fs.readFileSync(`${home}/.codex/AGENTS.md`, "utf8")).toBe(first);
      expect(Fs.statSync(`${home}/.codex/AGENTS.md`).mode & 0o777).toBe(0o640);
    } else {
      expect(Fs.readFileSync(`${home}/.codex/AGENTS.md`, "utf8")).toBe(original);
      expect(Fs.existsSync(`${home}/.agents`)).toBe(false);
    }
  }
});
test("adapter cancellation reaps the helper and its owned dialog", async () => {
  const { requestCode } = await import("./transport.ts");
  const env = envWithDialog(),
    dir = env.PATH.split(":")[0] ?? "";
  Fs.writeFileSync(`${dir}/kdialog`, `#!/bin/sh\necho $$ > '${dir}/pid'\nsleep 30 & wait\n`, { mode: 0o700 });
  const fiber = Effect.runFork(requestCode("Synthetic", "Synthetic", 60, env));
  const deadline = performance.now() + 2000;
  while (!Fs.existsSync(`${dir}/pid`) && performance.now() < deadline) await Bun.sleep(10);
  expect(Fs.existsSync(`${dir}/pid`)).toBe(true);
  await Effect.runPromise(Fiber.interrupt(fiber));
  const pid = Number(Fs.readFileSync(`${dir}/pid`, "utf8"));
  // The parent helper's signal boundary must have time to reap its process group.
  const end = performance.now() + 1000;
  while (performance.now() < end) {
    try {
      process.kill(pid, 0);
      await Bun.sleep(10);
    } catch {
      break;
    }
  }
  expect(() => process.kill(pid, 0)).toThrow();
});
for (const scenario of ["success", "mismatch", "cancel", "interrupt"]) {
  test(`synthetic SSH parent lifecycle: ${scenario}`, async () => {
    const env = envWithDialog(),
      dir = env.PATH.split(":")[0] ?? "";
    Fs.writeFileSync(
      `${dir}/kdialog`,
      scenario === "success"
        ? "#!/bin/sh\nprintf 'synthetic-otp\\n'\n"
        : scenario === "cancel"
          ? "#!/bin/sh\nexit 1\n"
          : `#!/bin/sh\necho $$ > '${dir}/pid'\nsleep 30 & wait\n`,
      { mode: 0o700 }
    );
    const adapter = new URL("ssh-askpass.ts", import.meta.url).pathname;
    const parent = `${dir}/ssh-parent.ts`;
    Fs.writeFileSync(
      parent,
      `import * as fs from 'node:fs';\nfs.writeFileSync('/proc/self/comm','ssh');let stopped=false;process.on('SIGTERM',()=>{stopped=true;});const child=Bun.spawn([process.execPath,${JSON.stringify(adapter)},${JSON.stringify(scenario === "mismatch" ? "Password:" : expected + " ")}],{stdout:'pipe',stderr:'pipe'});${scenario === "interrupt" ? `const end=performance.now()+2000;while(!fs.existsSync(${JSON.stringify(`${dir}/pid`)})&&performance.now()<end)await Bun.sleep(10);child.kill('SIGTERM');` : ""}const status=await child.exited;const out=await new Response(child.stdout).text();const err=await new Response(child.stderr).text();console.log(JSON.stringify({status,stopped,delivered:out==='synthetic-otp\\n',silent:out===''&&err===''}));\n`
    );
    const child = Bun.spawn([process.execPath, parent], {
      env: { ...env, ...context },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await child.exited).toBe(0);
    const summary: unknown = JSON.parse(await new Response(child.stdout).text());
    expect(summary).toEqual(
      scenario === "success"
        ? { status: 0, stopped: false, delivered: true, silent: false }
        : { status: scenario === "mismatch" ? 2 : 1, stopped: true, delivered: false, silent: true }
    );
    expect(await new Response(child.stderr).text()).toBe("");
    if (scenario === "interrupt") {
      const pid = Number(Fs.readFileSync(`${dir}/pid`, "utf8"));
      expect(() => process.kill(pid, 0)).toThrow();
    }
  });
}
