# Onboarding distribution research (2026-10-14)

Primary-source answers for units B1 (onboarding skill) and B2 (bootstrapper).
Every claim below cites the page it came from; anything not found in a
primary source is marked UNVERIFIED and goes to the VM proof.

## 1. Where can an onboarding skill reach Claude Desktop?

| Vehicle | Desktop chat | Claude Code | Extra install by the lawyer | Source |
| --- | --- | --- | --- | --- |
| Tools of an installed `.mcpb` | yes | yes (MCP server) | none beyond the `.mcpb` | [MCPB guide](https://claude.com/docs/connectors/building/mcpb.md) |
| MCP prompts served by the `.mcpb` | supported by Claude's client | yes, as `/server:prompt (MCP)` | none | [Build an MCP server for Claude](https://claude.com/docs/connectors/building/index.md), [Claude Code MCP](https://code.claude.com/docs/en/mcp) |
| `prompts` declared in `manifest.json` | hosts may validate runtime prompts against it | n/a | none | [MCPB manifest spec](https://raw.githubusercontent.com/modelcontextprotocol/mcpb/main/MANIFEST.md) |
| Plugin skill (`.claude-plugin/plugin.json` + `skills/`) | yes, after upload under Customize > Plugins | yes (`--plugin-dir`, marketplace, or account sync) | upload a `.zip`/`.plugin`, or add a marketplace | [Plugins overview](https://claude.com/docs/plugins/overview.md) |
| Plugin with a local stdio server | no: "works in Claude Code and in a Cowork session ... not in chat" | yes | as above | [Plugins overview](https://claude.com/docs/plugins/overview.md) |

Findings:

- The MCPB manifest spec has a `prompts` array (`name`, `description`,
  `arguments`, `text`) and `prompts_generated`; it has no field for skills.
  Current `manifest_version` is `0.3`.
- Claude's MCP client supports "Tools, prompts, and resources"; it does not
  support resource subscriptions, sampling, or "advanced or draft
  capabilities" ([Build an MCP server for Claude](https://claude.com/docs/connectors/building/index.md)).
  Elicitation is not listed either way: still UNVERIFIED for Desktop.
- Where Desktop chat shows MCP prompts (the "+" menu) is documented only by
  third parties ([nsoftware](https://www.nsoftware.com/kb/articles/MCPSDK-connecting-with-claude));
  UNVERIFIED in a primary source. Whether Desktop chat injects a server's
  `instructions` into context is UNVERIFIED.
- The local-server help article mentions only tools under the "+" button's
  "Connectors" option, no prompts or skills
  ([Getting started with local MCP servers](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop.md)).
- Plugins are account-scoped: one upload in Desktop syncs to Claude Code on
  the same account; Team/Enterprise Owners can install plugins by default or
  as required ([Plugins overview](https://claude.com/docs/plugins/overview.md)).

Consequence for B1: the only vehicle that reaches Desktop chat with nothing
installed beyond the gateway is the gateway itself. Tools are the one
surface the model is guaranteed to see, so the skill body must be reachable
through a read-only gateway tool; an MCP prompt adds a lawyer-visible entry
point; the plugin skill serves Claude Code and firms that upload plugins.

## 2. Installing Claude Desktop without the lawyer

- winget package `Anthropic.Claude` (manifest 2.9939.4, released
  2026-09-28) lists two installer kinds per architecture: an MSIX
  (`PackageFamilyName: Claude_pzs8sxrjxfjjc`) and a per-user EXE
  (`Scope: user`, `InstallerSwitches.Silent: --silent`,
  `ProductCode: AnthropicClaude`), each with a SHA-256. It also declares the
  `claude` protocol
  ([winget-pkgs manifest](https://github.com/microsoft/winget-pkgs/blob/master/manifests/a/Anthropic/Claude/2.9939.4/Anthropic.Claude.installer.yaml)).
- The x64 EXE: `https://downloads.claude.ai/releases/win32/x64/2.9939.4/Claude-a166d8a7c640e65ad825ebfb99d74ccbb9c8940d.exe`,
  SHA-256 `B233F34379ED8E9CED2C765D29AECFD35ED4D773BCF12CF5A7BB588825170590`
  (same manifest).
- MSIX deployment: documented redirect URLs
  `https://claude.ai/api/desktop/win32/x64/msix/latest/redirect` (and
  `arm64`), `Add-AppxPackage` per user or `Add-AppxProvisionedPackage`
  machine-wide. An MSIX install registers the Cowork service and needs
  administrator rights; per-user MSIX without admin fails with
  `0x80073D28`. For users without admin rights Anthropic points to Claude
  Setup, which offers to install without Cowork
  ([Deploy Claude Desktop for Windows](https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows)).
- Intune guide: the same MSIX URLs, detection by package family
  `Claude_pzs8sxrjxfjjc`, and "Only choose **User** if the targeted users are
  local administrators"
  ([Claude Intune README](https://downloads.claude.ai/releases/enterprise/intune/Claude-Intune-README.md)).
- Machine policy lives under `HKLM:\SOFTWARE\Policies\Claude`
  (`isDesktopExtensionEnabled`, `isLocalDevMcpEnabled`, ...); a firm policy
  of `false` disables extensions entirely
  ([Enterprise configuration](https://support.claude.com/en/articles/12622667-enterprise-configuration)).

Consequence for B2: the per-user EXE with `--silent` needs no admin prompt
and is the right route for a lawyer without IT. Pin the URL and SHA-256 from
the winget manifest and verify the hash before running; Claude auto-updates
after the first install. Detect both install kinds: the per-user EXE (the
`AnthropicClaude` uninstall key the gateway already probes, and
`%LOCALAPPDATA%\AnthropicClaude\claude.exe`) and the MSIX package family.

## 3. Installing the `.mcpb` without the double-click UI

- Users install by double-click, drag-and-drop, or Settings > Extensions >
  Advanced settings > Install Extension; "Each of these install methods opens
  an installation UI where the user reviews extension details and
  permissions" ([MCPB guide](https://claude.com/docs/connectors/building/mcpb.md)).
- The MCPB README: "open the file with Claude for macOS and Windows to show
  an installation dialog"
  ([MCPB README](https://raw.githubusercontent.com/modelcontextprotocol/mcpb/main/README.md)).
- An extension can be installed only while signed in to claude.ai
  ([Add a connector that isn't in the directory](https://claude.com/docs/connectors/custom/add-unlisted.md)).
- Team/Enterprise organizations can upload custom extensions for one-click
  install and deploy through software management; no documented silent
  per-user install path exists. The on-disk extension directory is not
  documented anywhere we found.

Consequence for B2: the bootstrapper opens the `.mcpb` with the shell (the
documented "open the file" route) after the lawyer signs in, and the lawyer
clicks Install in Claude's own dialog. Writing Claude's internal extension
state directly is rejected: undocumented, and an MSIX install virtualizes
`%APPDATA%`. Whether the EXE install registers the `.mcpb` file association
is UNVERIFIED (the winget manifest lists only the `claude` protocol); the VM
proof checks it, and the fallback instruction is drag-and-drop onto
Settings > Extensions.

## 4. Opening Claude with a first message

- `claude://claude.ai/new?q=<url-encoded text>` opens a new chat in Claude
  Desktop with the prompt field prefilled "so you can review and send it";
  values must be URL-encoded; `q` is truncated at about 14,000 characters; if
  the app is not running, Windows launches it first. `claude://code/new`
  opens Claude Code in Desktop the same way
  ([Open Claude Desktop with a link](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)).
- Claude Code's terminal link is a different scheme, `claude-cli://open?q=`
  ([Claude Code deep links](https://code.claude.com/docs/en/deep-links)).

Consequence for B2: the handoff opens `claude://claude.ai/new?q=` with a
short plain-language first message; the lawyer presses send (a prefilled
prompt is not sent automatically). That press is the handoff's only click.

## Open items for the VM proof

1. `.mcpb` file association after the per-user EXE install.
2. Whether Desktop chat surfaces the gateway's MCP prompt and its
   `instructions`; whether elicitation reaches the lawyer.
3. The `claude://` link from a non-elevated console process on a fresh
   profile, before and after sign-in.
4. The pinned EXE's `--silent` exit code and install time on the VM.
