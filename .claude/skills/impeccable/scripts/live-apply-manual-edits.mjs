#!/usr/bin/env node
/**
 * Trusted operator client for applying, rolling back, or discarding staged browser copy edits.
 *
 * The inspected page can stage edits, but it cannot read the operator-only
 * commit capability. This CLI reads that capability from the host environment
 * and submits it directly to the loopback live server without printing it.
 *
 * Usage:
 *   node live-apply-manual-edits.mjs [--page-url=/path] [--repair|--rollback|--discard] [--async]
 */

import { readLiveServerInfo } from "./lib/impeccable-paths.mjs";

function argumentValue(args, name) {
  const prefix = name + "=";
  for (const argument of args) {
    if (argument === name) return true;
    if (argument.startsWith(prefix)) return argument.slice(prefix.length);
  }
  return null;
}

function fail(message, details) {
  console.error(JSON.stringify({ ok: false, error: message, ...(details ? { details } : {}) }));
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "Usage: node live-apply-manual-edits.mjs [--page-url=<url>] [--repair|--rollback|--discard] [--async]"
  );
  process.exit(0);
}

const selectedActions = ["--repair", "--rollback", "--discard"].filter((argument) => args.includes(argument));
if (selectedActions.length > 1) {
  fail("conflicting_actions", "Choose only one of --repair, --rollback, or --discard.");
}

const capability = String(process.env.IMPECCABLE_LIVE_COMMIT_CAPABILITY || "").trim();
if (!capability) {
  fail(
    "operator_capability_missing",
    "Set IMPECCABLE_LIVE_COMMIT_CAPABILITY in both the live-server and trusted operator environments."
  );
}

const server = readLiveServerInfo(process.cwd())?.info;
if (!server || !Number.isInteger(server.port) || typeof server.token !== "string" || !server.token) {
  fail("live_server_unavailable", "Start live-server.mjs from this project before applying staged edits.");
}

let action = "apply";
if (args.includes("--rollback")) action = "rollback";
else if (args.includes("--discard")) action = "discard";
const endpoint =
  action === "rollback"
    ? "/manual-edit-repair-decision"
    : action === "discard"
      ? "/manual-edit-discard"
      : "/manual-edit-commit";
const requestUrl = new URL(`http://127.0.0.1:${server.port}${endpoint}`);
requestUrl.searchParams.set("token", server.token);
const pageUrl = argumentValue(args, "--page-url");
if (typeof pageUrl === "string" && pageUrl) requestUrl.searchParams.set("pageUrl", pageUrl);
if (args.includes("--repair")) requestUrl.searchParams.set("repair", "1");
if (args.includes("--async")) requestUrl.searchParams.set("async", "1");

const requestBody =
  action === "rollback"
    ? JSON.stringify({ action: "rollback", token: server.token, ...(pageUrl ? { pageUrl } : {}) })
    : undefined;

let response;
try {
  response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "x-impeccable-commit-capability": capability,
      ...(requestBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(requestBody ? { body: requestBody } : {}),
  });
} catch (error) {
  fail("live_server_request_failed", error instanceof Error ? error.message : String(error));
}

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  fail(payload.error || `http_${response.status}`, payload.message || "The live server rejected the trusted request.");
}

console.log(JSON.stringify({ ok: true, ...payload }));
