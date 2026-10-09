/**
 * Test data loader for the official yaml-test-suite.
 *
 * Reads raw fixture files from the vendored corpus at
 * `__test__/fixtures/yaml-test-suite/` (pinned to data-2022-01-17 — see
 * VENDORED.md there).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** Root directory of the yaml-test-suite data checkout. */
export const SUITE_DIR = resolve(import.meta.dirname, "../../fixtures/yaml-test-suite");

/** A single yaml-test-suite test case. */
export interface TestCase {
	/** 4-character test ID (e.g., "229Q"). */
	id: string;
	/** Human-readable test name from the `===` file. */
	name: string;
	/** Raw YAML input from `in.yaml`. */
	yaml: string;
	/** Expected parse event stream from `test.event`. */
	events: string;
	/** Parsed expected JSON output (if `in.json` exists). */
	json?: unknown;
	/** Expected re-serialized YAML (if `out.yaml` exists). */
	outYaml?: string | undefined;
	/** True if the `error` file is present (YAML should be rejected). */
	isError: boolean;
	/** True if `in.json` contains multiple top-level JSON values (multi-document stream). */
	isMultiDocument: boolean;
}

/** Result of parsing a JSON fixture file. */
interface ParsedJson {
	/** The parsed value: single value for single-doc, array for multi-doc. */
	value: unknown;
	/** True if the file contained multiple top-level JSON values. */
	isMultiDocument: boolean;
}

/**
 * Parse a JSON file that may contain multiple top-level JSON values
 * (one per YAML document in multi-document streams).
 * Returns a single value if there's only one, or an array of values for multi-doc.
 */
function parseMultiJson(text: string): ParsedJson {
	const values: unknown[] = [];
	let i = 0;
	const src = text.trim();

	while (i < src.length) {
		// Skip whitespace between values
		while (i < src.length && /\s/.test(src[i] as string)) i++;
		if (i >= src.length) break;

		const ch = src[i];
		if (ch === "{" || ch === "[") {
			// Track brace/bracket depth to find the end of the value
			let depth = 0;
			let inString = false;
			let isEscaped = false;
			const start = i;
			for (; i < src.length; i++) {
				if (isEscaped) {
					isEscaped = false;
					continue;
				}
				const c = src[i];
				if (c === "\\" && inString) {
					isEscaped = true;
					continue;
				}
				if (c === '"') {
					inString = !inString;
					continue;
				}
				if (inString) continue;
				if (c === "{" || c === "[") depth++;
				else if (c === "}" || c === "]") {
					depth--;
					if (depth === 0) {
						i++;
						values.push(JSON.parse(src.slice(start, i)));
						break;
					}
				}
			}
		} else {
			// Bare scalar (string, number, boolean, null) — parse to end of token
			const start = i;
			if (ch === '"') {
				// Quoted string
				i++;
				while (i < src.length) {
					if (src[i] === "\\" && i + 1 < src.length) {
						i += 2;
					} else if (src[i] === '"') {
						i++;
						break;
					} else {
						i++;
					}
				}
			} else {
				// Unquoted: number, true, false, null
				while (i < src.length && !/\s/.test(src[i] as string)) i++;
			}
			values.push(JSON.parse(src.slice(start, i)));
		}
	}

	const isMultiDocument = values.length > 1;
	return {
		value: isMultiDocument ? values : values[0],
		isMultiDocument,
	};
}

/**
 * Load a single test case from a directory that contains `in.yaml`, `===`, etc.
 */
function loadFromDir(dir: string, id: string): TestCase | null {
	const inYamlPath = join(dir, "in.yaml");
	if (!existsSync(inYamlPath)) return null;

	const yaml = readFileSync(inYamlPath, "utf-8");
	const name = existsSync(join(dir, "===")) ? readFileSync(join(dir, "==="), "utf-8").trim() : id;
	const events = existsSync(join(dir, "test.event")) ? readFileSync(join(dir, "test.event"), "utf-8") : "";
	const isError = existsSync(join(dir, "error"));

	let json: unknown;
	let isMultiDocument = false;
	const jsonPath = join(dir, "in.json");
	if (existsSync(jsonPath)) {
		const parsed = parseMultiJson(readFileSync(jsonPath, "utf-8"));
		json = parsed.value;
		isMultiDocument = parsed.isMultiDocument;
	}

	let outYaml: string | undefined;
	const outPath = join(dir, "out.yaml");
	if (existsSync(outPath)) {
		outYaml = readFileSync(outPath, "utf-8");
	}

	return { id, name, yaml, events, json, outYaml, isError, isMultiDocument };
}

/**
 * Load all test cases from the yaml-test-suite data directory.
 *
 * Handles both flat test directories (e.g., `229Q/in.yaml`) and
 * multi-case directories with numbered subdirectories (e.g., `3RLN/00/`, `3RLN/01/`).
 */
export function loadAllTestCases(): TestCase[] {
	if (!existsSync(SUITE_DIR)) {
		throw new Error(`yaml-test-suite not found at ${SUITE_DIR}.`);
	}

	const cases: TestCase[] = [];
	const entries = readdirSync(SUITE_DIR, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const dir = join(SUITE_DIR, entry.name);

		// Try loading directly from this directory (flat test)
		const flat = loadFromDir(dir, entry.name);
		if (flat) {
			cases.push(flat);
			continue;
		}

		// Otherwise check for numbered subdirectories (multi-case test)
		const subEntries = readdirSync(dir, { withFileTypes: true });
		for (const sub of subEntries) {
			if (!sub.isDirectory()) continue;
			const subDir = join(dir, sub.name);
			const subCase = loadFromDir(subDir, `${entry.name}/${sub.name}`);
			if (subCase) {
				cases.push(subCase);
			}
		}
	}

	return cases.sort((a, b) => a.id.localeCompare(b.id));
}
