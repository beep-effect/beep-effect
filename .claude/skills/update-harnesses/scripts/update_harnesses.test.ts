import { afterEach, expect, test } from "bun:test";
import * as Fs from "node:fs";
import * as Os from "node:os";
import {
  HOSTS,
  HARNESSES,
  CLI,
  DESKTOP,
  canonical,
  plan,
  parseRecords,
  rowsFromRecords,
  missingRows,
  markLatest,
  markT3Published,
  parseElectronFeed,
  repinProfile,
  vettedDebs,
  muxArgv,
  render,
} from "./update_harnesses.ts";
const dirs: string[] = [];
const temp = () => {
  const dir = Fs.mkdtempSync(`${Os.tmpdir()}/harness-test-`);
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) Fs.rmSync(dir, { recursive: true, force: true });
});
const row = (harness: string, status = "installed", before = "-", note = "") => ({
  host: "dankstation",
  harness,
  status,
  before,
  after: "-",
  method: "-",
  path: "-",
  note,
});
test("recorded host eligibility and ordering", () => {
  const matrix = plan(Object.keys(HOSTS), HARNESSES);
  expect(matrix.dankstation).toContain("kimi-desktop");
  expect(matrix.dankstation).toContain("cursor-desktop");
  expect(matrix["grok-bot"]).toContain("chatgpt-desktop");
  expect(matrix["grok-bot"]).not.toContain("cursor-desktop");
  for (const h of ["beep-worker", "dankserver", "tbk-worker", "tom-pc-1-wsl"])
    expect(matrix[h]).toEqual(["t3code", ...CLI]);
  expect(plan(["beep-worker"], ["muse", "t3code", "codex"])).toEqual({ "beep-worker": ["t3code", "codex", "muse"] });
  expect(plan(["tbk-worker"], ["kimi-desktop"])).toEqual({ "tbk-worker": [] });
});
test("recorded aliases and canonical fleet routes", () => {
  for (const [alias, expected] of [
    ["ChatGPT", "chatgpt-desktop"],
    ["claude-code", "claude"],
    ["grok-bot-vm", "grok-bot"],
    ["tom-pc-1", "tom-pc-1-wsl"],
  ])
    expect(canonical(alias ?? "", expected !== undefined && expected in HOSTS ? Object.keys(HOSTS) : HARNESSES)).toBe(
      expected
    );
  expect(canonical("vscode", HARNESSES)).toBeUndefined();
  expect(HOSTS["tom-pc-1-wsl"]?.wrapper).toBe("ssh-tom-pc-1-wsl");
  expect(HOSTS["tom-pc-1-wsl"]?.down).toContain("T3AgentWSL");
  expect(HOSTS["grok-bot"]?.down).toContain("Grok Bot app");
  for (const host of Object.values(HOSTS))
    expect([host.wrapper, ...(host.admin ?? []), host.down].join(" ")).not.toMatch(
      /\d+\.\d+\.\d+\.\d+|\.ts\.net|tail[0-9a-f]{6}/
    );
});
test("recorded host records, empty fields and notes", () => {
  const records = parseRecords(
    "noise\n@@HOST\tbox\tworker\tUbuntu\t1\n@@INSTALL\tcodex\t1\tnpm\t1\t0.167.0\t/h/.nvm/bin/codex\n@@INSTALL\tcodex\t0\tnpm\t0\t0.117.0\t/usr/local/bin/codex\r\n@@RESULT\tkimi\tabsent\t-\t-\t-\t-\tnot installed\n@@APPARMOR\t1\t/sdk\t/cli\n"
  );
  expect(records.length).toBe(5);
  const parsed = rowsFromRecords("dankserver", records, "status");
  expect(parsed.pins).toEqual({ drift: true, sdk: "/sdk", cli: "/cli" });
  expect(parsed.rows.filter((r) => r.harness === "codex")[1]?.note).toContain("not writable");
  expect(parsed.rows.some((r) => r.status === "absent")).toBe(true);
  const noted = rowsFromRecords(
    "tom-pc-1-wsl",
    parseRecords(
      "@@RESULT\tmuse\tcurrent\t1.4.14\t1.4.14\tmuse\t/m\t-\n@@RESULT\tclaude\tupdated\t2.1.1\t2.1.2\tnative\t/c\t-\n@@NOTE\tmuse\tno schema_version\n"
    ),
    "update"
  );
  expect(noted.rows.map((r) => r.note)).toEqual(["no schema_version", ""]);
  expect(render(noted.rows)).not.toContain("-;");
});
test("recorded updates, missing rows and active-version comparison", () => {
  const rows = rowsFromRecords(
    "beep-worker",
    parseRecords("@@INSTALL\tclaude\t1\tnative\t1\t2.1.1\t/p\n@@RESULT\tclaude\tupdated\t2.1.1\t2.1.2\tnative\t/p\t\n"),
    "update"
  ).rows;
  expect(rows.map((r) => [r.status, r.before, r.after])).toEqual([["updated", "2.1.1", "2.1.2"]]);
  expect(
    missingRows("tbk-worker", ["claude", "grok", "muse"], rows, "host agent exit 255").map((r) => [r.harness, r.status])
  ).toEqual([
    ["grok", "failed"],
    ["muse", "failed"],
  ]);
  const installs = [
    row("claude", "installed", "2.1.319", "active"),
    row("claude", "installed", "2.1.100", "shadowed"),
    row("codex", "installed", "0.167.0", "active"),
    row("grok", "installed", "1.0.1", "active"),
  ];
  markLatest(installs, { claude: "2.1.321", codex: "0.167.0" });
  expect(installs.map((r) => [r.status, r.after])).toEqual([
    ["pending", "2.1.321"],
    ["installed", "-"],
    ["current", "-"],
    ["installed", "-"],
  ]);
  const t3 = [row("t3code", "installed", "old")];
  markT3Published(t3, "new");
  expect(t3[0]?.status).toBe("pending");
  expect(t3[0]?.after).toBe("new");
});
test("recorded electron feed and trusted Debian URI filtering", () => {
  expect(
    parseElectronFeed(
      "version: 1.3.2\nfiles:\n  - url: binaries/1.3.2/a.deb\n    sha512: DEB==\n    size: 11\n  - url: binaries/1.3.2/KimiCode-1.3.2-linux-x86_64.AppImage\n    sha512: APP==\n    size: 22\n"
    )
  ).toEqual({
    version: "1.3.2",
    url: "binaries/1.3.2/KimiCode-1.3.2-linux-x86_64.AppImage",
    sha512: "APP==",
    size: 22,
  });
  expect(parseElectronFeed("version: 1\nfiles: []\n")).toBeUndefined();
  const sha = "a".repeat(64),
    url = "http://deb.debian.org/debian/pool/main/g/gtk_1_amd64.deb";
  expect(
    vettedDebs(
      [
        `@@URI ${url} before.deb ${sha}`,
        "@@ADMIN start",
        `@@URI ${url} gtk_1_amd64.deb ${sha}`,
        `@@URI file:///etc/shadow shadow.deb ${sha}`,
        `@@URI https://evil.example/a.deb a.deb ${sha}`,
        `@@URI ${url} ../x.deb ${sha}`,
        `@@URI ${url} x.deb nothex`,
      ].join("\n")
    )
  ).toEqual([{ url, name: "gtk_1_amd64.deb", sha256: sha }]);
});
test("sandbox repins only named profiles; mux cannot authenticate", () => {
  const original =
    "profile beep-cursor-sdk-sandbox /old/sdk flags=(unconfined) {\n}\nprofile beep-cursor-cli-sandbox /old/cli flags=(unconfined) {\n}\nprofile another /other {\n}\n";
  expect(repinProfile(original, "/new/sdk", "/new/cli")).toBe(
    original.replace("/old/sdk", "/new/sdk").replace("/old/cli", "/new/cli")
  );
  const args = muxArgv("dankserver");
  expect(args).toContain("ControlMaster=no");
  expect(args).toContain("BatchMode=yes");
  expect(args.at(-1)?.endsWith(".invalid")).toBe(true);
  expect(args.join(" ")).not.toContain(HOSTS.dankserver?.wrapper ?? "missing");
});
function exe(path: string, body: string) {
  const index = path.lastIndexOf("/");
  Fs.mkdirSync(path.slice(0, index), { recursive: true });
  Fs.writeFileSync(path, body, { mode: 0o755 });
}
function agent(home: string, mode: string, harnesses: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const result = Bun.spawnSync(["bash", new URL("harness_host.sh", import.meta.url).pathname, mode, ...harnesses], {
    env: { HOME: home, PATH: `${home}/bin:/usr/bin:/bin`, HARNESS_SKIP_MISE: "1", ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  return parseRecords(result.stdout.toString());
}
test("host classifier preserves native/npm updates and unknown-method skips", () => {
  const home = temp(),
    prefix = `${home}/.nvm/versions/node/v24.0.0`;
  exe(
    `${home}/.local/share/claude/versions/1`,
    '#!/bin/sh\nif [ "$1" = update ]; then echo 1.0.1 > "$HOME/claude.v"; else echo "$(cat "$HOME/claude.v" 2>/dev/null || echo 1.0.0) (Claude Code)"; fi\n'
  );
  Fs.mkdirSync(`${home}/.local/bin`, { recursive: true });
  Fs.symlinkSync(`${home}/.local/share/claude/versions/1`, `${home}/.local/bin/claude`);
  exe(
    `${prefix}/lib/node_modules/@openai/codex/bin/codex.js`,
    '#!/bin/sh\necho "codex-cli $(cat "$HOME/codex.v" 2>/dev/null || echo 0.1.0)"\n'
  );
  Fs.mkdirSync(`${prefix}/bin`, { recursive: true });
  Fs.symlinkSync(`${prefix}/lib/node_modules/@openai/codex/bin/codex.js`, `${prefix}/bin/codex`);
  exe(`${prefix}/bin/npm`, '#!/bin/sh\necho "$@" > "$HOME/npm.args"; echo 0.2.0 > "$HOME/codex.v"\n');
  exe(`${home}/bin/kimi`, "#!/bin/sh\necho 9.9.9\n");
  const records = agent(home, "update", ["claude", "codex", "kimi", "muse"], {
    PATH: `${home}/bin:${prefix}/bin:/usr/bin:/bin`,
  });
  const result = (h: string) => records.find((r) => r[0] === "@@RESULT" && r[1] === h);
  expect(result("claude")?.slice(2, 5)).toEqual(["updated", "1.0.0", "1.0.1"]);
  expect(result("codex")?.slice(2, 6)).toEqual(["updated", "0.1.0", "0.2.0", "npm"]);
  expect(Fs.readFileSync(`${home}/npm.args`, "utf8")).toContain("@openai/codex@latest");
  expect(result("kimi")?.[2]).toBe("skipped");
  expect(result("muse")?.[2]).toBe("absent");
});
test("stale node installs remain unchanged and skip update", () => {
  const home = temp(),
    prefix = `${home}/.nvm/versions/node/v20.0.0`;
  exe(`${prefix}/lib/node_modules/@xai-official/grok/bin/grok`, "#!/bin/sh\necho 'grok 1.0.1'\n");
  Fs.mkdirSync(`${prefix}/bin`, { recursive: true });
  Fs.symlinkSync(`${prefix}/lib/node_modules/@xai-official/grok/bin/grok`, `${prefix}/bin/grok`);
  expect(
    agent(home, "status", ["grok"])
      .find((r) => r[0] === "@@INSTALL")
      ?.slice(2, 5)
  ).toEqual(["stale", "npm", "1"]);
  expect(agent(home, "update", ["grok"]).find((r) => r[0] === "@@RESULT")?.[2]).toBe("skipped");
});
test("empty and error versions preserve protocol column alignment", () => {
  const home = temp();
  exe(`${home}/.local/share/claude/versions/9`, '#!/bin/sh\ncase "$1" in update) touch "$HOME/updated";; esac\n');
  Fs.mkdirSync(`${home}/.local/bin`, { recursive: true });
  Fs.symlinkSync(`${home}/.local/share/claude/versions/9`, `${home}/.local/bin/claude`);
  const result = agent(home, "update", ["claude"]).find((r) => r[0] === "@@RESULT");
  expect(result?.slice(2, 7)).toEqual(["failed", "-", "-", "native", `${home}/.local/bin/claude`]);
  expect(result?.[7]).toBe("version unreadable after update");
  expect(Fs.existsSync(`${home}/updated`)).toBe(true);
  exe(`${home}/.grok/bin/grok`, "#!/bin/sh\necho 'mise ERROR not provided by node@24.22.1' >&2; exit 1\n");
  Fs.symlinkSync(`${home}/.grok/bin/grok`, `${home}/.local/bin/grok`);
  expect(agent(home, "status", ["grok"]).find((r) => r[0] === "@@INSTALL")?.[5]).toBe("-");
});
test("Muse config is reported without mutation and Junie migration stays bounded", () => {
  const home = temp();
  exe(`${home}/.local/bin/muse`, "#!/bin/sh\n# muse-code/channels launcher\necho 1.4.14\n");
  Fs.mkdirSync(`${home}/.config/muse`, { recursive: true });
  const settings = `${home}/.config/muse/settings.json`,
    before = '{"provider": "meta", "model": "muse-wonder-1.0"}\n';
  Fs.writeFileSync(settings, before);
  const env = { PATH: `${home}/.local/bin:/usr/bin:/bin` };
  expect(agent(home, "status", ["muse"], env).filter((r) => r[0] === "@@NOTE")[0]?.[2]).toContain("schema_version");
  expect(Fs.readFileSync(settings, "utf8")).toBe(before);
  Fs.writeFileSync(settings, '{"schema_version": 1, "provider": "meta"}\n');
  expect(agent(home, "status", ["muse"], env).some((r) => r[0] === "@@NOTE")).toBe(false);
  exe(`${home}/.npm-global/bin/junie`, "#!/bin/bash\necho 'Junie version: 1468.30'\n");
  expect(agent(home, "update", ["junie"]).find((r) => r[0] === "@@RESULT")?.[7]).toContain("migrate by hand");
  Fs.rmSync(`${home}/.npm-global`, { recursive: true });
  exe(`${home}/.local/bin/junie`, "#!/bin/bash\necho 'Junie version: 1468.30'\n");
  expect(
    agent(home, "update", ["junie"], { ...env, HARNESS_JUNIE_MIGRATE: "0" })
      .find((r) => r[0] === "@@RESULT")
      ?.slice(2, 6)
  ).toEqual(["skipped", "1468.30", "-", "junie-legacy"]);
});
test("complete plan output matches the recorded Python CLI without side effects", () => {
  const home = temp();
  const child = Bun.spawnSync([process.execPath, new URL("update_harnesses.ts", import.meta.url).pathname, "plan"], {
    env: { ...process.env, HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(child.exitCode).toBe(0);
  expect(child.stdout.toString()).toBe(Fs.readFileSync(new URL("plan.fixture.txt", import.meta.url), "utf8"));
  expect(child.stderr.length).toBe(0);
  expect(Fs.existsSync(`${home}/.local`)).toBe(false);
  expect(Fs.existsSync(`${home}/.ssh`)).toBe(false);
});
test("standalone update CLI handles an absent synthetic harness and emits its receipt", () => {
  const home = temp();
  const child = Bun.spawnSync(
    [
      process.execPath,
      new URL("update_harnesses.ts", import.meta.url).pathname,
      "update",
      "--host",
      "dankstation",
      "--harness",
      "muse",
    ],
    { env: { HOME: home, PATH: "/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe" }
  );
  expect(child.exitCode).toBe(0);
  expect(child.stdout.toString()).toContain("absent");
  expect(child.stdout.toString()).toContain("receipt:");
  expect(child.stderr.toString()).toBe("");
  const files = Fs.readdirSync(`${home}/.local/state/beep/update-harnesses`);
  expect(files.filter((f) => f.endsWith(".json")).length).toBe(1);
  expect(files.filter((f) => f.endsWith(".log")).length).toBe(1);
});
