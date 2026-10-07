// Exercise the patched installed module with a fake transport; no model calls.
// GRAFT_CRUX_MODULE can point at a disposable patched module during development.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const binary = process.env.GRAFT_CRUX_MODULE
  ? undefined
  : execFileSync("which", ["graft"], { encoding: "utf8" }).trim();
const modulePath = process.env.GRAFT_CRUX_MODULE ?? join(dirname(realpathSync(binary)), "ai/crux.js");
const { ChatCruxSummarizer } = await import(pathToFileURL(modulePath).href);
const { enrichGraph } = await import(pathToFileURL(join(dirname(modulePath), "../graph/enrich.js")).href);

function fixture(count, respond) {
  const requests = [];
  const summarizer = new ChatCruxSummarizer({
    async create(request) {
      requests.push(request);
      const ids = [...request.messages[1].content.matchAll(/^- id=(.*?) \|/gm)].map((match) => match[1]);
      return (
        respond?.(ids, requests.length) ?? {
          text: "",
          stopReason: "tool_calls",
          toolCalls: [
            {
              name: "record_symbols",
              args: { symbols: ids.map((id) => ({ id, summary: `Purpose of ${id}`, crux_start: 0, crux_end: 0 })) },
            },
          ],
        }
      );
    },
  });
  const input = {
    path: "fixture.ts",
    source: "export const value = 1;\n",
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `fixture.ts#symbol${i}`,
      kind: "constant",
      startLine: 1,
      endLine: 1,
    })),
  };
  return { summarizer, input, requests };
}

test("dense files request at most 20 targets and retain every original id", async () => {
  const { summarizer, input, requests } = fixture(646);
  const result = await summarizer.describeFile(input);
  assert.equal(requests.length, 33);
  assert.deepEqual(
    result.map((entry) => entry.id),
    input.nodes.map((node) => node.id)
  );
  assert.ok(requests.every((request) => [...request.messages[1].content.matchAll(/^- id=/gm)].length <= 20));
  assert.ok(requests.every((request) => request.maxTokens === 8192));
  assert.equal(summarizer.lastMiss, null);
});

test("an empty target list makes no request and clears the miss", async () => {
  const { summarizer, input, requests } = fixture(0);
  summarizer.lastMiss = { kind: "unparseable", finishReason: "tool_calls" };
  assert.deepEqual(await summarizer.describeFile(input), []);
  assert.equal(requests.length, 0);
  assert.equal(summarizer.lastMiss, null);
});

test("later targets receive their own source with original file line numbers", async () => {
  const { summarizer, input, requests } = fixture(1);
  input.source = `${"// earlier source padding\n".repeat(2000)}export const finalTarget = 42;\n`;
  input.nodes[0].startLine = 2001;
  input.nodes[0].endLine = 2001;
  await summarizer.describeFile(input);
  assert.match(requests[0].messages[1].content, /2001\texport const finalTarget = 42;/);
  assert.doesNotMatch(requests[0].messages[1].content, /1\t\/\/ earlier/);
});

test("a long source line retains a bounded prefix instead of an empty excerpt", async () => {
  const { summarizer, input, requests } = fixture(1);
  input.source = `export const large = "${"x".repeat(30000)}";`;
  await summarizer.describeFile(input);
  assert.match(requests[0].messages[1].content, /1\texport const large =/);
  assert.ok(requests[0].messages[1].content.length < 19000);
});

test("a missed batch preserves successful batches and remains retryable", async () => {
  const { summarizer, input } = fixture(21, (ids) =>
    ids.length === 20
      ? {
          text: "",
          stopReason: "length",
          toolCalls: [],
        }
      : undefined
  );
  const result = await summarizer.describeFile(input);
  assert.deepEqual(
    result.map((entry) => entry.id),
    [input.nodes[20].id]
  );
  assert.deepEqual(summarizer.lastMiss, { kind: "truncated", finishReason: "length" });
});

test("a later transport throw retains completed batches and leaves the rest retryable", async () => {
  const failure = new Error("simulated transport failure");
  const { summarizer, input, requests } = fixture(41, (_, call) => {
    if (call > 1) throw failure;
  });
  const diagnostics = [];
  const originalError = console.error;
  let result;
  try {
    console.error = (message) => diagnostics.push(message);
    result = await summarizer.describeFile(input);
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(
    result.map((entry) => entry.id),
    input.nodes.slice(0, 20).map((node) => node.id)
  );
  assert.equal(requests.length, 2); // Stop before the third, unattempted batch.
  assert.match(diagnostics[0], /transport failed after 20 summaries; retaining partial results/);
  assert.equal(summarizer.lastMiss, null); // Transport errors have no provider finish reason.
  assert.equal(result.batchError, failure);
  assert.equal(Object.keys(result).includes("batchError"), false); // Metadata stays out of JSON/iteration.
  const missing = input.nodes.filter((node) => !result.some((entry) => entry.id === node.id));
  assert.equal(missing.length, 21);
  await assert.rejects(summarizer.describeFile({ ...input, nodes: missing }), (error) => error === failure);
});

test("a transport failure with no successful batch remains observable", async () => {
  const failure = new Error("simulated total failure");
  const { summarizer, input, requests } = fixture(21, () => {
    throw failure;
  });
  await assert.rejects(summarizer.describeFile(input), (error) => error === failure);
  assert.equal(requests.length, 1);
});

for (const cancellation of [
  Object.assign(new Error("cancelled"), { name: "AbortError" }),
  Object.assign(new Error("cancelled"), { code: "ABORT_ERR" }),
  new (class APIUserAbortError extends Error {})(),
]) {
  test(`cancellation ${cancellation.name}/${cancellation.code ?? cancellation.constructor.name} still rejects after a completed batch`, async () => {
    const { summarizer, input, requests } = fixture(21, (_, call) => {
      if (call === 2) throw cancellation;
    });
    await assert.rejects(summarizer.describeFile(input), (error) => error === cancellation);
    assert.equal(requests.length, 2);
  });
}

async function collectFixture(input, summarizer) {
  const nodes = input.nodes.map((node) => ({
    ...node,
    name: node.id,
    path: input.path,
    span: `L${node.startLine}-L${node.endLine}`,
    signature: null,
    exported: true,
    origin: "ast",
    body_hash: node.id,
    summary_state: "pending",
    summary: null,
    crux: null,
  }));
  const stats = await enrichGraph(nodes, new Map(), new Map([[input.path, input.source]]), {
    summarizer,
    concurrency: 1,
  });
  return { nodes, stats };
}

test("the collector retains both partial attempts and reports their unrecovered transport failure", async () => {
  const failure = new Error("simulated persistent partial failure");
  const { summarizer, input, requests } = fixture(61, (_, call) => {
    if (call % 2 === 0) throw failure;
  });
  const { nodes, stats } = await collectFixture(input, summarizer);
  assert.equal(requests.length, 4);
  assert.equal(stats.computed, 40);
  assert.equal(stats.pending, 21);
  assert.equal(stats.failedFiles, 1);
  assert.deepEqual(stats.errors, ["fixture.ts: simulated persistent partial failure"]);
  assert.equal(nodes.filter((node) => node.summary_state === "ready").length, 40);
  assert.equal(nodes.filter((node) => node.summary_state === "pending").length, 21);
});

test("the collector clears a transient transport failure only after every missing id recovers", async () => {
  const failure = new Error("simulated transient partial failure");
  const { summarizer, input, requests } = fixture(61, (_, call) => {
    if (call === 2) throw failure;
  });
  const { nodes, stats } = await collectFixture(input, summarizer);
  assert.equal(requests.length, 5);
  assert.equal(stats.computed, 61);
  assert.equal(stats.pending, 0);
  assert.equal(stats.failedFiles, 0);
  assert.deepEqual(stats.errors, []);
  assert.ok(nodes.every((node) => node.summary_state === "ready"));
});

test("blank retry summaries do not erase the original transport failure", async () => {
  const failure = new Error("simulated unrecovered partial failure");
  const { summarizer, input } = fixture(61, (ids, call) => {
    if (call === 2) throw failure;
    if (call > 2)
      return {
        text: "",
        stopReason: "tool_calls",
        toolCalls: [
          {
            name: "record_symbols",
            args: {
              symbols: ids.map((id) => ({
                id,
                summary: "",
                crux_start: 0,
                crux_end: 0,
              })),
            },
          },
        ],
      };
  });
  const { stats } = await collectFixture(input, summarizer);
  assert.equal(stats.computed, 20);
  assert.equal(stats.pending, 41);
  assert.equal(stats.failedFiles, 1);
  assert.deepEqual(stats.errors, ["fixture.ts: simulated unrecovered partial failure"]);
});
