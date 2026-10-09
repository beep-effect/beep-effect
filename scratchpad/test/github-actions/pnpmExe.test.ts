import { createHash } from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import { Option } from "effect";
import { isNodeScript, pnpmExeTarget, strongestSri } from "../../effected/github-actions/internal/pnpmExe.ts";

describe("internal/pnpmExe", () => {
	describe("pnpmExeTarget", () => {
		it("maps the runner spellings onto the @pnpm/exe.* target spellings", () => {
			assert.deepStrictEqual(pnpmExeTarget("Linux", "x64", false), Option.some("linux-x64"));
			assert.deepStrictEqual(pnpmExeTarget("Linux", "arm64", false), Option.some("linux-arm64"));
			assert.deepStrictEqual(pnpmExeTarget("macOS", "x64", false), Option.some("darwin-x64"));
			assert.deepStrictEqual(pnpmExeTarget("macOS", "arm64", false), Option.some("darwin-arm64"));
			assert.deepStrictEqual(pnpmExeTarget("Windows", "x64", false), Option.some("win32-x64"));
			assert.deepStrictEqual(pnpmExeTarget("Windows", "arm64", false), Option.some("win32-arm64"));
		});

		it("musl only distinguishes on linux, and only where pnpm ships a musl build", () => {
			assert.deepStrictEqual(pnpmExeTarget("Linux", "x64", true), Option.some("linux-x64-musl"));
			assert.deepStrictEqual(pnpmExeTarget("Linux", "arm64", true), Option.some("linux-arm64-musl"));
			// Ignored off linux — the host libc is a linux fact.
			assert.deepStrictEqual(pnpmExeTarget("macOS", "arm64", true), Option.some("darwin-arm64"));
			assert.deepStrictEqual(pnpmExeTarget("Windows", "x64", true), Option.some("win32-x64"));
			// A glibc-only arch has no musl twin, and the glibc binary cannot run
			// on musl, so it offers no candidate (the wrapper's own rule).
			assert.deepStrictEqual(pnpmExeTarget("Linux", "riscv64", false), Option.some("linux-riscv64"));
			assert.deepStrictEqual(pnpmExeTarget("Linux", "riscv64", true), Option.none());
		});

		it("answers None for a platform or arch pnpm publishes no binary for", () => {
			assert.deepStrictEqual(pnpmExeTarget("Solaris", "x64", false), Option.none());
			assert.deepStrictEqual(pnpmExeTarget("", "x64", false), Option.none());
			assert.deepStrictEqual(pnpmExeTarget("Linux", "ia32", false), Option.none());
			assert.deepStrictEqual(pnpmExeTarget("Windows", "riscv64", false), Option.none());
		});
	});

	describe("strongestSri", () => {
		const sri = (algorithm: string, input: string) =>
			`${algorithm}-${createHash(algorithm).update(input).digest("base64")}`;
		const hex = (algorithm: string, input: string) => createHash(algorithm).update(input).digest("hex");

		it("decodes a single sha512 entry to the pin's <algo>.<hex> spelling", () => {
			assert.deepStrictEqual(
				strongestSri(sri("sha512", "pnpm")),
				Option.some({ algorithm: "sha512", hex: hex("sha512", "pnpm") }),
			);
		});

		it("takes the strongest of several space-separated entries, regardless of order", () => {
			// sha256 listed FIRST: position must not win over strength.
			const listed = `${sri("sha256", "pnpm")} ${sri("sha512", "pnpm")}  ${sri("sha1", "pnpm")}`;
			assert.deepStrictEqual(strongestSri(listed), Option.some({ algorithm: "sha512", hex: hex("sha512", "pnpm") }));
			assert.deepStrictEqual(
				strongestSri(`${sri("sha1", "pnpm")} ${sri("sha384", "pnpm")}`),
				Option.some({ algorithm: "sha384", hex: hex("sha384", "pnpm") }),
			);
		});

		it("drops SRI options and ignores entries it cannot use", () => {
			assert.deepStrictEqual(
				strongestSri(`${sri("sha256", "pnpm")}?foo=bar`),
				Option.some({ algorithm: "sha256", hex: hex("sha256", "pnpm") }),
			);
			assert.deepStrictEqual(strongestSri(""), Option.none());
			assert.deepStrictEqual(strongestSri("md5-AAAA"), Option.none());
			assert.deepStrictEqual(strongestSri("sha512"), Option.none());
			assert.deepStrictEqual(strongestSri("sha512-not*base64!"), Option.none());
			// A usable entry beside an unusable one still answers.
			assert.deepStrictEqual(
				strongestSri(`md5-AAAA ${sri("sha256", "x")}`),
				Option.some({ algorithm: "sha256", hex: hex("sha256", "x") }),
			);
		});
	});

	describe("isNodeScript", () => {
		it("is decided by the extension alone", () => {
			assert.isTrue(isNodeScript("bin/pnpm.mjs"));
			assert.isTrue(isNodeScript("bin/tool.cjs"));
			assert.isTrue(isNodeScript("bin/npm-cli.js"));
			assert.isTrue(isNodeScript("bin/yarn.JS"));
			assert.isFalse(isNodeScript("pnpm"));
			assert.isFalse(isNodeScript("pnpm.exe"));
			assert.isFalse(isNodeScript("bin/pnpm.mjs.bak"));
			assert.isFalse(isNodeScript("bin/pnpm.json"));
		});
	});
});
