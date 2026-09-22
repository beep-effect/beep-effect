# Lane 12-u3-effect-guidance — Effect's own guidance and documentation gaps

**Owns:** what Effect's documentation says and where it is wrong or missing. It records whether
docs mention `instructions`, strictness, `isError`, and titles; API and runtime facts belong to
10-u1 and 11-u2.

**Question:** Where does Effect show how to build a 2026-07-28 server (prose, JSDoc examples,
migration notes, changesets, tests used as executable docs), and where is that guidance missing,
stale, or contradicted by the code?

**Primary sources:** `effect:packages/effect/MCP.md`, `migration/v3-to-v4.md`,
`migration/annotations/effect__ai__Mcp*.yaml`, JSDoc `**Example**` blocks on exports in
`unstable/ai/{McpServer,McpSchema,McpProtocol,Tool,Toolkit}.ts`, `.changeset/*.md`,
`.changeset/pre/*mcp*.md`, `effect:packages/effect/test/unstable/ai/McpServer/**`, and
`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts`.

**Report sections:**
1. Contradictions first: statements in `MCP.md`, `migration/v3-to-v4.md`, and JSDoc that
   contradict `a7a71921de` code or tests (for example protocol pins, import paths, handler
   requirements), each with the contradicting `path:line`.
2. Usage evidence map for: stdio server on `v2026_07_28`; `layerHttp` server; handler reading
   `McpRequestContext`; MRTR elicitation; `subscriptions/listen`; non-object structured output;
   strict tool; declared failure in error and return modes; resources and prompts with titles;
   server `instructions`. For each, cite where Effect demonstrates it (JSDoc example, test name and
   line ranges, typetest), however many spans that takes. When no demonstration exists, record a
   doc-gap note (not a missing capability).
3. Upstream docs PR outline: section-by-section proposal for an `MCP.md` update, for the optional
   lane from the `beep-effect/effect` fork.
