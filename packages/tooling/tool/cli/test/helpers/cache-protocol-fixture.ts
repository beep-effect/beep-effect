import * as A from "effect/Array";
import * as Str from "effect/String";

const digest = Str.repeat(64);
export const client = { version: "2.11.4", sha256: digest("a"), namespace: "protocol-stable" };
export const output = { sha256: digest("b"), bytes: 22 };
export const artifact = { sha256: digest("c"), bytes: 188 };
const cases = ["producer", "replay", "missing-tag", "invalid-tag", "corrupt-body", "wrong-key"];
export const input = {
  schemaVersion: "cache-protocol-observation/v1",
  authority: "synthetic-native-observation-only",
  channel: "stable",
  client,
  runs: A.map(cases, (name, index) => ({
    case: name,
    taskHash: "21a66d93ac9926e9",
    client,
    summary: digest(`${index + 1}`),
    outcome:
      name === "producer"
        ? { _tag: "Produced", output }
        : name === "replay"
          ? { _tag: "Replayed", output }
          : { _tag: "Rejected", exitCode: 42, restoredOutputs: 0 },
  })),
  exchanges: A.map(cases, (name, index) => ({
    case: name,
    taskHash: "21a66d93ac9926e9",
    requestId: `request-${index}`,
    method: name === "producer" ? "PUT" : "GET",
    role: name === "producer" ? "writer" : "reader",
    status: 200,
    tag: name === "missing-tag" ? "absent" : "present",
    artifact: name === "corrupt-body" ? { ...artifact, sha256: digest("d") } : artifact,
  })),
};
const transportCases = ["truncated-body", "unavailable", "throttled"];
export const executionInput = {
  schemaVersion: "cache-protocol-execution/v2",
  authority: "synthetic-native-observation-only",
  network: "private-loopback-nested-readers/v1",
  bunSha256: digest("e"),
  roots: A.map([...cases, ...transportCases], (name, index) => ({ case: name, sha256: digest(`${index + 1}`) })),
  observation: {
    ...input,
    exchanges: A.map(input.exchanges, (exchange, index) => ({ ...exchange, requestId: `wire-${index + 1}` })),
  },
  failures: A.map(transportCases, (name, index) => ({
    case: name,
    taskHash: "21a66d93ac9926e9",
    summary: digest(`${index + 7}`),
    exitCode: 42,
    restoredOutputs: 0,
  })),
  events: [
    ...A.map(input.exchanges, (exchange, index) => ({
      sequence: index + 1,
      scenario: {
        id: exchange.case,
        fault: A.contains(["producer", "replay", "wrong-key"], exchange.case) ? "none" : exchange.case,
      },
      operation: exchange.method === "PUT" ? "put" : "get",
      role: exchange.role,
      status: exchange.status,
      artifact: exchange.taskHash,
      digest: exchange.artifact.sha256,
      bytes: exchange.artifact.bytes,
      tagPresent: exchange.tag === "present",
    })),
    ...A.map(transportCases, (name, index) => ({
      sequence: index + 7,
      scenario: { id: name, fault: name },
      operation: "get",
      role: "reader",
      status: name === "unavailable" ? 503 : name === "throttled" ? 429 : 200,
      artifact: "21a66d93ac9926e9",
      digest: name === "truncated-body" ? digest("d") : null,
      bytes: name === "truncated-body" ? artifact.bytes - 1 : 0,
      tagPresent: name === "truncated-body",
    })),
  ],
};
