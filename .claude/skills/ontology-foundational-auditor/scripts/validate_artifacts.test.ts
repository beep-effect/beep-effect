import { expect, test } from "bun:test";
import * as Crypto from "node:crypto";
import * as Fs from "node:fs";
import * as Os from "node:os";
import fixtures from "./parity-fixtures.json";

const script = new URL("validate_artifacts.ts", import.meta.url).pathname;
for (const fixture of fixtures) {
  test(`Python oracle: ${fixture.args.join(" ")}`, () => {
    const result = Bun.spawnSync([process.execPath, "--no-env-file", script, ...fixture.args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(fixture.status);
    const dirty = " - .: the working tree has TRACKED modifications but the manifest asserts dirty: false\n";
    let stdout = result.stdout.toString();
    if ("normalization" in fixture && stdout.includes(dirty))
      stdout = stdout
        .replace(dirty, "")
        .replace(/VIOLATIONS \((\d+)\):/, (_all, n: string) => `VIOLATIONS (${Number(n) - 1}):`);
    expect(Crypto.createHash("sha256").update(stdout).digest("hex")).toBe(fixture.stdoutSha256);
    expect(Crypto.createHash("sha256").update(result.stderr).digest("hex")).toBe(fixture.stderrSha256);
  }, 30000);
}
test("CLI usage and strict run-id rotation parser", () => {
  const run = (...args: string[]) =>
    Bun.spawnSync([process.execPath, script, ...args], { stdout: "pipe", stderr: "pipe" });
  expect(run().exitCode).toBe(2);
  expect(run("--print-run-id").stderr.toString()).toBe("usage: --print-run-id <ontology-root>\n");
  expect(run("missing", "--repo").stderr.toString()).toBe("usage: --repo requires a repository path\n");
  const dir = Fs.mkdtempSync(`${Os.tmpdir()}/validator-run-id-`);
  try {
    Fs.mkdirSync(`${dir}/work`);
    Fs.writeFileSync(`${dir}/work/run-manifest.yaml`, "run_id: !!str orun-2026-08-29T00:00:00Z\r\n");
    expect(run("--print-run-id", dir).stdout.toString()).toBe("orun-2026-08-29T00:00:00Z\n");
  } finally {
    Fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("trusted TypeScript adapters execute inside the existing sandbox", () => {
  const dir = Fs.mkdtempSync(`${Os.tmpdir()}/ontology-adapter-`);
  const repo = Fs.mkdtempSync(`${Os.tmpdir()}/ontology-repo-`);
  Fs.chmodSync(dir, 0o700);
  const adapter = `${dir}/adapter-synthetic.ts`;
  Fs.writeFileSync(
    adapter,
    'import * as fs from "node:fs";\nconst args=process.argv.slice(2);if(args[0]==="--self-check"){if(!fs.existsSync(args[1]+"/fixture.txt"))process.exit(1);console.log("SELF-CHECK PASS");}else{fs.writeFileSync(args[args.indexOf("--out")+1]+"/synthetic.yaml","id: synthetic\\n");console.log("OBSERVE PASS");}\n',
    { mode: 0o600 }
  );
  Fs.mkdirSync(`${repo}/golden`);
  Fs.writeFileSync(`${repo}/golden/fixture.txt`, "synthetic");
  const runner = new URL("run_adapter_sandbox.sh", import.meta.url).pathname;
  try {
    const self = Bun.spawnSync(["bash", runner, adapter, repo, "self-check", `${repo}/golden`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(self.exitCode).toBe(0);
    expect(self.stdout.toString()).toBe("SELF-CHECK PASS\n");
    const observe = Bun.spawnSync(["bash", runner, adapter, repo, "observe", `${repo}/output`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(observe.exitCode).toBe(0);
    expect(observe.stdout.toString()).toBe("OBSERVE PASS\n");
    expect(Fs.readFileSync(`${repo}/output/synthetic.yaml`, "utf8")).toBe("id: synthetic\n");
    const refused = Bun.spawnSync(["bash", runner, `${repo}/golden/fixture.txt`, repo, "observe", `${repo}/output`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(refused.exitCode).toBe(65);
  } finally {
    Fs.rmSync(dir, { recursive: true, force: true });
    Fs.rmSync(repo, { recursive: true, force: true });
  }
});
test("Python Unicode ordering, path ordering and decimal parsing remain compatible", async () => {
  const { rt } = await import("./validate_artifacts.ts");
  expect(rt.invoke(rt.builtin("sorted"), ["😀", "\ue000"])).toEqual(["\ue000", "😀"]);
  expect(rt.invoke(rt.builtin("int"), "٠١")).toBe(1);
  expect(rt.invoke(rt.builtin("int"), "１_２")).toBe(12);
  expect(rt.invoke(rt.builtin("int"), 1.9)).toBe(1);
  expect(() => rt.invoke(rt.builtin("yload"), Buffer.from([0xff]))).toThrow();
  const paths = [rt.invoke(rt.builtin("Path"), "a.yaml"), rt.invoke(rt.builtin("Path"), "a/file")];
  const sorted = rt.iter(rt.invoke(rt.builtin("sorted"), paths)).map((value) => rt.invoke(rt.builtin("str"), value));
  expect(sorted).toEqual(["a/file", "a.yaml"]);
});
test("recorded YAML scalar types preserve exact integer and float checks", async () => {
  const { rt } = await import("./validate_artifacts.ts");
  const { default: scalars } = await import("./scalar-fixtures.json");
  for (const fixture of scalars) {
    const value = rt.invoke(rt.builtin("yload"), fixture.source);
    expect(rt.attr(rt.invoke(rt.builtin("type"), value), "__name__")).toBe(fixture.type);
    expect(rt.invoke(rt.builtin("str"), value)).toBe(fixture.text);
  }
});
test("Python whitespace, escaped regex literals and recursive aliases stay bounded", async () => {
  const { rt } = await import("./validate_artifacts.ts");
  expect(rt.method("\x1c \x85", "strip")).toBe("");
  expect(rt.method("\ufeff", "strip")).toBe("\ufeff");
  expect(rt.method(rt.builtin("re"), "fullmatch", "\\s+", "\x1c\x85")).not.toBeNull();
  expect(rt.method(rt.builtin("re"), "fullmatch", "\\S+", "\ufeff")).not.toBeNull();
  const literal = rt.method(rt.builtin("re"), "escape", "foo\\Z");
  expect(rt.method(rt.builtin("re"), "search", literal, "foo\\Z")).not.toBeNull();
  const recursive = rt.invoke(rt.builtin("yload"), "&self [*self]");
  expect(rt.invoke(rt.builtin("str"), recursive)).toBe("[[...]]");
  expect(() => rt.invoke(rt.builtin("yload"), "base: &base {a: 1}\ncopy: {<<: *base}\n")).toThrow();
  expect(() => rt.invoke(rt.builtin("yload"), "!!unknown x")).toThrow();
  expect(() => rt.invoke(rt.builtin("yload"), "!!unknown [x]")).toThrow();
  expect(() => rt.invoke(rt.builtin("yload"), "anchor: &a {x: 1}\n? *a\n: 2\n")).toThrow();
});
