---
name: onepassword-secret-refs
description: "Safe 1Password workflows for Claude/Codex when the user explicitly asks for Developer Environments, op:// secret references, or env-file rewrites."
metadata:
  short-description: 1Password MCP/op secret refs without raw values
---

# 1Password Secret References

Use this skill only when the user explicitly asks to work with 1Password,
`op://` secret references, 1Password Developer Environments, `op` CLI, or
secret-reference-backed env files. Do not activate for ordinary `.env` edits
unless 1Password or `op://` references are part of the request.

## Non-Negotiables

- Never ask the user to paste raw secret values.
- Never print, summarize, or store raw secret values.
- Never use `--reveal`.
- Prefer 1Password MCP for 1Password Developer Environments.
- If the MCP server is unavailable, insufficient for vault item inspection, or
  blocked by the local approval client, fall back to sanitized `op` CLI metadata
  commands and report that MCP was skipped for that part.
- Before listing vault/item/field metadata, confirm the user asked for a
  secret-reference inventory or that the metadata is required to edit the named
  target files.
- When reading 1Password item JSON, pipe through a filter that emits only the
  minimum metadata required for the requested edit. Prefer writing refs directly
  to the target file over displaying inventory rows in chat.
- In final/status reports, summarize counts and changed files. Do not repeat
  vault names, item names, field ids, section labels, account names, or item
  lists unless the user explicitly requested those exact metadata details.
- Keep tracked examples commit-safe. `.env.example` should contain placeholders,
  documentation, or secret references only; never real secret values.

## Agent Authentication (managed workstations)

On Benjamin's managed workstations every agent invocation of the 1Password CLI
resolves `op` from `PATH`, never the system binary by absolute path: the
user-local PATH shim loads exactly one automation credential (a service account
by default, or the local Connect server with `OP_AGENT_BACKEND=connect`),
exports `OP_BIOMETRIC_UNLOCK_ENABLED=false`, and exits 78 with one stderr line
when no agent credential exists. Desktop-app integration, `op signin`, and
desktop MCP approval loops are human paths and are never retried by agents.

Before any vault, item, or reference operation, verify the route without
printing credential or item data:

```bash
command -v op
op-doctor
```

`command -v op` must resolve to the user-local shim, not the system binary.
On any 1Password failure,
run `op-doctor` once and act on its count/type/mode-only output. Do not ask the
operator to unlock the desktop app, do not run `op signin`, and do not bypass
the shim. If the required secret operation still cannot proceed, report the
failing doctor line and stop.

## Minimal Diagnosis

For an existing `op://`-backed env file, test the exact wrapper operation first
and suppress successful output:

```bash
op run --env-file=<path> -- true >/dev/null
```

If it succeeds, use that same lane-scoped wrapper for the real command. If it
fails, run `op-doctor` and use only its sanitized result. Never use `--reveal`,
shell tracing, environment dumps, or raw item JSON in transcripts; send
verification reads to `/dev/null` or reduce them to a boolean, count, or byte
count. Preserve `op://` references instead of resolving them into tracked
files.

Quota rule: the live service-account limit is 1,000 reads per hour per token,
and a name-based `op://` reference costs three reads (a UUID reference costs
one). A fan-out of N lanes over a template with R references can cost up to
N x R x 3 reads. Above roughly 600 reads per hour, launch lanes on the Connect
backend, which caches locally and is not quota'd (it covers `BEEP_SECRETS` but
not `BEEP_CI`), or convert the template to UUID references:

```bash
env OP_AGENT_BACKEND=connect op run --env-file=<path> -- <lane command>
```

## MCP Usage

The official `1password-mcp` is the desktop Environments MCP: it cannot return
secret values and is not a replacement for the service account or Connect. Use
it only when the user explicitly requests a Developer Environments workflow and
accepts the human desktop path. It is irrelevant to unattended agent secret
retrieval. Tools that read `OP_SERVICE_ACCOUNT_TOKEN` or `OP_CONNECT_*`
themselves instead of calling `op` are launched as
`op-agent-auth exec -- <trusted-command>`.

## Secret-Reference Lookup

To find refs for fields in a user-named vault/item, emit only the requested
reference metadata. Prefer redirecting to a local scratch file and reporting
only the number of refs found:

```bash
op item get "<item>" \
  --vault "<vault>" \
  --format json \
  | jq -r '
      .fields[]
      | select(.reference != null)
      | [
          (.section.label // ""),
          (.label // ""),
          (.id // ""),
          .reference
        ]
      | @tsv
    '
```

If item lookup by title is ambiguous and the user asked you to resolve it,
display only the minimum disambiguation needed. Prefer counts first:

```bash
op item list --vault "<vault>" --format json \
  | jq -r '[.[] | select(.title == "<item>")] | length'
```

Do not run commands that output unfiltered item JSON into chat or tool results.
Do not paste inventory tables into the final answer unless the user explicitly
requested inventory display.

## `.env` And `.env.example`

When redesigning env files:

- Inventory required variables from scripts, package configs, tests, and docs.
- Group variables by subsystem with short comments only where useful.
- Use empty values or placeholder refs in `.env.example`.
- Use actual `op://...` references in ignored `.env` files only when the user
  requested that file edit.
- Prefer stable field names over duplicate aliases unless the code requires both.
- If runtime tooling expects plaintext values, document the wrapper command:

```bash
op run --env-file=.env -- <command>
```

## Safe Closeout

Report:

- Which backend the shim used (`op-agent-auth status`: service account or
  Connect) and whether `op-doctor` passed; on failure, the single failing
  doctor line, never a desktop sign-in status.
- Whether the desktop Environments MCP was used or skipped.
- Which files changed.
- How many secret references were written or displayed.
- Any remaining operator action, such as rotating the service account or
  granting a vault to the Connect server. Never list "unlock 1Password
  desktop" as an agent remediation.
