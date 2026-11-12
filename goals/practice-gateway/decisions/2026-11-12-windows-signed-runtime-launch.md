---
title: "Windows bundles ship a signed runtime and a script; Linux keeps the compiled executable"
date: 2026-11-12
lane: "fix/mcpb-windows-signed-runtime"
reversal: "In mcpbTargetSpec (@beep/mcpb-kit), return mcpbCompiledLaunch from the windows-x64 branch to compile Windows again (packaging then refuses the unsigned executable until it is signed), or add a Linux McpbRuntimePin and return a runtime-script launch from the linux-x64 branch to move Linux to the same layout."
---

Smart App Control on the attorney PC blocked the unsigned `bun build --compile` executable `practice-kg-mcp.exe` on 2026-10-20, 2026-10-22 and 2026-11-12 (CodeIntegrity event 3077, status `0xc0e90002`). It has no per-file exception, and the cloud-reputation verdict that let the same file run for two weeks changed without the file changing.

Decision, taken in `@beep/mcpb-kit` (`mcpbTargetSpec`):

- `windows-x64` ships a `runtime-script` launch: the official Bun runtime `bun.exe` (signed by its publisher) from the release archive pinned in `mcpbWindowsRuntime`, plus the script bundle `<app>.js` and the files the entrypoint imports as files. The manifest runs `${__dirname}/bun.exe --no-env-file ${__dirname}/<app>.js`.
- `linux-x64` keeps the `compiled` launch. Smart App Control is Windows-only, the compiled-host smoke (`apps/practice-kg-mcp/src/smoke.ts`) runs the Linux executable, and a second layout change would buy nothing there.
- Packaging refuses any unsigned `.exe`, `.dll` or `.node` in a Windows bundle except DuckDB's `duckdb.node`, which is unsigned upstream and passes on reputation only.

This applies to both bundles the kit builds: practice-kg-mcp (released as 0.5.2) and the practice gateway. No signing service is bought or set up; D11 in `explorations/harness-the-harness/DECISIONS.md` carries the note. `practice-setup.exe` is still an unsigned compiled executable and is not covered by this decision.

The cost of the split is that the Linux smoke no longer runs the layout Windows ships. The Windows layout was proven on the attorney PC on 2026-11-12 (self-check and an MCP initialize plus tools/list handshake under Smart App Control). The script bundle from the 0.5.2 Windows archive passed the same self-check, handshake and one tool call under Bun 1.4.4 on Linux. Each new bundle is stage-tested on the PC before it is installed.
