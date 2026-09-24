# MCP Stateless Kit and Drivers Plan

## Status

Status: `in-progress` (P1 started 2026-09-22 with PR 1; graduated 2026-09-22).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Done in the exploration (ten lanes, Gate B, Gate C; rc.117 on `main`). | `explorations/effect-mcp-2026-07-28/RESEARCH.md` and `research/verification/README.md`. |
| P1 Implement | in-progress | Four PRs below; PR 1 published 2026-09-22 from lane `mcp-stateless-kit` (branch `feat/mcp-stateless-kit-pr1`). | Acceptance criteria met per PR. |
| P2 Verify | pending | package-verify per package, conformance per host, capture record. | Green or blockers documented. |
| P3 Yeet: PR to mergeable | pending | `bun run beep yeet publish --start-pr-early --monitor --pr` per PR; goal slug in each commit. | `mergeStateStatus` CLEAN; zero unresolved threads. |
| P4 Close | pending | Reflection and status flip in the final PR. | Reflection exists; `bun run beep goals set-status mcp-stateless-kit-and-drivers completed-retained`. |

## PR train

1. **PR 1 — kit rebase, client, conformance port.** `sanitizedToolkit` on rc.117 `registerToolkit`
   (exclude `McpRequestContext`, `outputSchema`, strict decode, `omitRequestServices`,
   `Stream.runLast`); dual-read `McpServerClient` / `McpRequestContext` (the 2025 session-id read
   stays until Goal B); `McpCaller.ts` JSDoc to transport facts plus the dispatch-anchor
   `Context.Reference`; named error translator (D-projection); protocol-list helper;
   `withTopLevelObjectInputSchema` decision from installed source; `@beep/mcp-kit/client`
   (`client.ts` barrel + explicit `./client` export, `client.node.ts` stdio helper, kit-owned 2026
   RpcGroup, `_meta` keys); conformance runner ported from `.repos/effect` (precondition:
   `bash scripts/setup-effect-ref.sh`; inventory in lane 11-u2 §10); README consumer table naming
   every importer; coverage ratchet. Hosts untouched and green on 2025. Also: the sql-pg native `PgClient`
   call-site census (inherited from the retired S0) as a `history/` note.
2. **PR 2 — m365, uspto.** Pin through the helper, `instructions`, prompt titles, JSDoc,
   conformance; m365's stdio conversation test moves to the kit client (framing canary); uspto's
   array `structuredContent` proven.
3. **PR 3 — gov-legal, practice-kg.** Same shape; practice-kg smoke and `.mcpb` packaging.
4. **PR 4 — capture and nlp-mcp.** Build nlp-mcp 2026-only in the lane, launch it from Claude
   Code via `.mcp.json` (and Codex if cheap), record the first stdio frame verbatim under
   `history/`. Flip if a daily CLI sends `server/discover` first; else record the hold
   (exception ledger + `MAP.md` re-entry gate) and close the goal.
5. **Optional G8 lane** — fork PR for the stdio `data.supported` shape and `MCP.md` gaps.

## P4 Closeout Checklist

- [ ] Reflection at `history/reflections/<date>-<agent>.md`; `bun run beep lint reflection-artifacts`.
- [ ] `bun run beep goals set-status mcp-stateless-kit-and-drivers completed-retained` in the final PR.
- [ ] `goals/ontology-sidecar-stateless-identity` unblocked after PR 1 merges (note it in its README).
- [ ] Exploration README Trail updated; Atlas regenerated.

## PR 1 Decisions (2026-09-22, measured against the installed rc.117)

- `withTopLevelObjectInputSchema` is **kept**, re-shaped: rc.117 inlines a top-level `$ref`
  (Effect#8326) but an empty parameter class still renders as `{ not: { type: "null" } }` with
  no `type`, which `McpSchema.ToolJson` rejects and upstream `registerToolkit` dies on. The kit
  patches the root after the inlining; `ref_tool` now registers with an object root and no
  `$ref`.
- Invalid arguments: at the kit adapter they are JSON-RPC `InvalidParams` (D-projection,
  proven through `server.callTool`); on the `2026-07-28` wire rc.117's adapter projects a tool
  validation failure as `isError: true` with a scrubbed message and reserves `-32602` for
  malformed `arguments` (upstream ToolsTest "distinguishes malformed requests from tool
  validation errors by protocol revision"). The conformance port asserts the upstream wire
  shape.
- Declared failures drop `structuredContent` (it must conform to the advertised
  `outputSchema`); the encoded failure travels in `content[].text`. `api_key_required` follows the
  same rule (review round 2): a non-error result whose envelope is in `content[].text` only,
  since the tool's `outputSchema` describes its success value. The
  one host test that asserted the old shape (`gov-legal-mcp` "returns only the package-local
  sanitized failure envelope") now decodes the envelope from `content[].text`; host sources
  are untouched in PR 1.
- `Mcp-Name` is sent as the literal routing name; rc.117's Base64 wrapper for non-token names
  is internal. Every in-repo tool name is a token; resource URIs are header-safe.
- The conformance runner is a source-only test kit (`src/test/Conformance.test-kit.ts`,
  `@beep/mcp-kit/test/Conformance`) following the `@beep/repo-cli/test/*` precedent; the
  alias is registered in `TsconfigSync.schemas.ts` and mirrored into
  `vitest.aliases.generated.json`.
- Client protocol layers must be built into the caller's scope (`Layer.build` +
  `Effect.provideContext`), never `Effect.provide`d around `connect` alone: the NDJSON router
  fiber lives in the layer scope and a closed scope silently drops every later response.

## Execution Notes

- Validate every Effect API against `node_modules/effect/dist/unstable/ai/**`; the frozen research
  predates Effect#8326. The npm package ships no tests: the conformance sources come from the
  reference clone (`.repos/effect`).
- Record Goal B's start checkpoint ("PR 1 merged") in this README so Goal B can overlap PR 2–4.
- Never add `v2025_06_18` back to a flipped host; a red host is fixed or held, not mixed.
- Effect-clone citations in packet prose use the `effect:` prefix; never inside shell commands.

## Verification Commands

```sh
bun run beep quality package-verify @beep/mcp-kit
rg -n '"./client"' packages/foundation/capability/mcp-kit/package.json
rg -n 'v2025_06_18' packages/drivers/m365-mcp packages/drivers/uspto-mcp packages/drivers/gov-legal-mcp packages/law-practice/server apps/practice-kg-mcp
test "$(wc -m < goals/mcp-stateless-kit-and-drivers/GOAL.md)" -le 4000
jq . goals/mcp-stateless-kit-and-drivers/ops/manifest.json
git diff --check -- goals/mcp-stateless-kit-and-drivers
```
