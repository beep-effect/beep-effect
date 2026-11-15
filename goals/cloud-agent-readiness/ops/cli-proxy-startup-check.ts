#!/usr/bin/env bun
/**
 * Bound worker proxy startup until its remote catalog and required routes exist.
 *
 * No inference, authentication refresh, or secret output. Installed with the
 * adjacent user-service drop-in. A failed check lets systemd retry startup.
 *
 * Usage: bun cli-proxy-startup-check.ts network|registered
 * Exit codes: 0 check passed, 1 timed out after 45 s, 2 bad arguments.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CATALOGS = [
  "https://raw.githubusercontent.com/router-for-me/models/refs/heads/main/models.json",
  "https://models.router-for.me/models.json",
];
const REQUIRED = ["gpt-6.1-sol", "grok-4.7", "claude-fable-5-1", "muse-wonder-1.0"];

type Mode = "network" | "registered";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const entries = (data: unknown, key: string): ReadonlyArray<unknown> => {
  const list = isRecord(data) ? data[key] : undefined;
  return Array.isArray(list) ? list : [];
};

const idOf = (entry: unknown): unknown => (isRecord(entry) ? entry.id : undefined);

// A non-2xx status, a timeout, a network failure or malformed JSON all reject, like urllib's errors.
const fetchJson = async (url: string, headers: Record<string, string> = {}): Promise<unknown> => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const check = async (mode: Mode): Promise<boolean> => {
  if (mode === "network") {
    for (const url of CATALOGS) {
      try {
        const data = await fetchJson(url);
        if (entries(data, "meta").some((entry) => idOf(entry) === "muse-wonder-1.0")) {
          return true;
        }
      } catch {
        // Try the next catalog source.
      }
    }
    return false;
  }
  const token = readFileSync(join(homedir(), ".cli-proxy-api/client-token"), "utf8").trim();
  const data = await fetchJson("http://127.0.0.1:8317/v1/models", { Authorization: `Bearer ${token}` });
  const ids = new Set(entries(data, "data").map(idOf));
  return REQUIRED.every((id) => ids.has(id));
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const main = async (argv: ReadonlyArray<string>): Promise<number> => {
  const mode = argv[0];
  if (argv.length !== 1 || (mode !== "network" && mode !== "registered")) {
    return 2;
  }
  const deadline = performance.now() + 45_000;
  while (performance.now() < deadline) {
    try {
      if (await check(mode)) {
        process.stdout.write(`CLIProxyAPI startup check passed: ${mode}\n`);
        return 0;
      }
    } catch {
      // A missing token, an unreachable proxy or malformed JSON retries until the deadline.
    }
    await sleep(2000);
  }
  process.stderr.write(`CLIProxyAPI startup check timed out: ${mode}\n`);
  return 1;
};

process.exitCode = await main(process.argv.slice(2));
