# Practice KG MCP install and refresh

Use the Windows x64 `.mcpb` and the separately supplied
`practice-kg-bundle/` folder. The MCPB contains only the read-only query host;
the corpus builder and candidate-claims batch are deliberately not shipped.

## Install in Claude Desktop

1. Copy `practice-kg-bundle/` to a stable local folder. Keep the directory
   intact: it contains `bundle.manifest.json`, `kg.pglite/`, and
   `practice.duckdb`.
2. In Claude Desktop, open **Settings → Extensions**, choose the option to
   install an extension, and select `practice-kg-mcp-windows-x64.mcpb`.
3. For **Practice KG data bundle**, select the copied
   `practice-kg-bundle/` folder. This required field becomes `BUNDLE_DIR`.
4. For **Practice corpus root**, optionally select the root of the existing
   SSD corpus. This field becomes `PRACTICE_KG_CORPUS_ROOT` and enables
   click-through to source documents and email bodies. Leave it empty for
   pointer-only results.
5. Enable the extension and restart Claude Desktop if it does not appear
   immediately.

The executable is unsigned. If Windows SmartScreen shows **Windows protected
your PC**, select **More info → Run anyway** after confirming the file came
from the expected handoff. A hardened company policy may require an
administrator instead.

## Refresh

Refresh always means full replacement; never merge database files. Close
Claude Desktop, rename the current `practice-kg-bundle/` to
`practice-kg-bundle.bak/`, copy the new folder into its place, reopen Claude
Desktop, and call `kg_provenance` with no arguments to confirm the new bundle
version. Delete the backup only after the gauntlet passes.

## Optional USPTO companion

`uspto-mcp.exe` is a separate public-data server and is the only process here
allowed network egress. Add it manually to Claude Desktop's MCP configuration
only when USPTO access is wanted:

```json
{
  "mcpServers": {
    "beep-uspto": {
      "command": "C:\\MCP\\uspto-mcp.exe",
      "env": {
        "USPTO_API_KEY": "set-this-only-when-opting-in"
      }
    }
  }
}
```

Omit this stanza when no key is available. Do not put the key in the practice
KG extension or its data folder.

## AC-5 zero-egress observation

Run the five questions in
[`acceptance-gauntlet.md`](./acceptance-gauntlet.md) while observing only the
`practice-kg-mcp` process:

- Windows: open **Resource Monitor → Network**, filter to
  `practice-kg-mcp.exe`, and expect zero entries throughout all five questions.
- Linux workstation: sample `ss -tnp` for the process ID during the run, or
  launch the host under `bwrap --unshare-net` and confirm identical answers.

Record the observation with the gauntlet results. Any connection attempt from
`practice-kg-mcp` fails AC-5. Do not count the separate `uspto-mcp` PID, whose
opt-in purpose is public USPTO network access.
