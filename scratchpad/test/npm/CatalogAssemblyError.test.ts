// CatalogAssemblyError.message renders the cause's message after the summary,
// because the cause is where the actionable detail lives (effected#842). Each
// case below is a cause shape `@effected/workspaces` really produces: the
// resolution ladder's not-installed and ambiguous messages, a pnpmfile's
// ERR_MODULE_NOT_FOUND, a throwing hook, a hook throwing a bare string, and a
// transport failure that is itself an assembly error (recognized by type, not
// by its text containing the summary).

import { assert, describe, it } from "@effect/vitest";
import { CatalogAssemblyError } from "../../effected/npm/index.ts";

const NAME = "@effected/pnpm-plugin-effect";
const SUMMARY = `Failed to assemble catalogs from hooks ${NAME}`;

describe("CatalogAssemblyError.message", () => {
	it("appends the ladder's not-installed message, remediation included", () => {
		const detail =
			`config dependency ${NAME}@0.11.1 is not installed: node_modules/.pnpm-config/${NAME} holds version 0.11.2, ` +
			`and no store copy of ${NAME}@0.11.1 was found (searched /store/v11). ` +
			`Run \`pnpm add --config ${NAME}@0.11.1\` in a throwaway workspace to populate the store, then retry.`;
		const error = new CatalogAssemblyError({
			source: "hooks",
			path: NAME,
			cause: new Error(detail),
			reason: "notInstalled",
		});
		assert.strictEqual(error.message, `${SUMMARY}: ${detail}`);
		assert.include(error.message, `pnpm add --config ${NAME}@0.11.1`);
	});

	it("appends the ladder's ambiguous message", () => {
		const detail = `config dependency ${NAME}@0.11.1 is ambiguous: the pnpm store at /store/v11 holds 2 copies`;
		const error = new CatalogAssemblyError({
			source: "hooks",
			path: NAME,
			cause: new Error(detail),
			reason: "ambiguous",
		});
		assert.strictEqual(error.message, `${SUMMARY}: ${detail}`);
	});

	it("appends a pnpmfile's ERR_MODULE_NOT_FOUND", () => {
		const cause = Object.assign(new Error("Cannot find package 'missing-dep' imported from /x/pnpmfile.mjs"), {
			code: "ERR_MODULE_NOT_FOUND",
		});
		const error = new CatalogAssemblyError({ source: "hooks", path: NAME, cause });
		assert.strictEqual(error.message, `${SUMMARY}: Cannot find package 'missing-dep' imported from /x/pnpmfile.mjs`);
	});

	it("appends a throwing hook's message", () => {
		const error = new CatalogAssemblyError({ source: "hooks", path: NAME, cause: new TypeError("boom") });
		assert.strictEqual(error.message, `${SUMMARY}: boom`);
	});

	it("appends a hook's thrown string", () => {
		const error = new CatalogAssemblyError({ source: "hooks", path: NAME, cause: "hook said no" });
		assert.strictEqual(error.message, `${SUMMARY}: hook said no`);
	});

	it("renders the summary alone when the cause carries no message", () => {
		for (const cause of [{ code: "EIO" }, undefined, 42, new Error(""), "  "]) {
			const error = new CatalogAssemblyError({ source: "manifest", path: "pnpm-workspace.yaml", cause });
			assert.strictEqual(error.message, "Failed to assemble catalogs from manifest pnpm-workspace.yaml");
		}
	});

	it("does not print the summary twice when the cause already carries it", () => {
		const inner = new CatalogAssemblyError({ source: "hooks", path: NAME, cause: new Error("boom") });
		const outer = new CatalogAssemblyError({ source: "hooks", path: NAME, cause: inner });
		assert.strictEqual(outer.message, `${SUMMARY}: boom`);
	});

	it("renders a nested assembly error's own message, whatever its source and path", () => {
		const inner = new CatalogAssemblyError({ source: "manifest", path: "pnpm-workspace.yaml", cause: "unreadable" });
		const outer = new CatalogAssemblyError({ source: "hooks", path: NAME, cause: inner });
		assert.strictEqual(outer.message, "Failed to assemble catalogs from manifest pnpm-workspace.yaml: unreadable");
	});

	it("keeps the prefix when a cause's text merely contains the summary", () => {
		const detail = `${SUMMARY}: quoted by a hook`;
		const error = new CatalogAssemblyError({ source: "hooks", path: NAME, cause: new Error(detail) });
		assert.strictEqual(error.message, `${SUMMARY}: ${detail}`);
	});

	it("reason is optional and absent by default", () => {
		const error = new CatalogAssemblyError({ source: "catalog", path: "default", cause: new Error("x") });
		assert.isUndefined(error.reason);
	});
});
