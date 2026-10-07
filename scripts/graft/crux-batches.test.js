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
