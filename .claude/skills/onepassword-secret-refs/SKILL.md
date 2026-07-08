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

## Minimal Diagnosis

Before retrying a failed MCP auth loop, check only the narrow state needed for
the current operation. Suppress successful command output so account metadata
does not enter the transcript:

```bash
op --version
op whoami >/dev/null
```

Interpretation:

- If `op whoami >/dev/null` fails, ask the user to unlock/sign in through
  1Password desktop, then retry the narrow operation.
- If MCP auth reports caller approval or desktop-app problems, stop repeating
  the same MCP auth call. Use the sanitized CLI fallback only when it satisfies
  the requested task without exposing raw values or broad metadata.

## MCP Usage

For Developer Environment tasks, authenticate once with the 1Password MCP server
and then use its environment tools. If auth fails, do not loop. Record the
sanitized failure and use the CLI fallback only when the task can be completed
without raw secret values.

The current agent 1Password MCP tools may not expose general vault item/field
inspection. For vault item secret references, use the `op` fallback below only
after the user has named the intended vault/item or explicitly requested an
inventory.

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

- Whether MCP was used successfully or skipped.
- Whether `op` was signed in.
- Which files changed.
- How many secret references were written or displayed.
- Any remaining user action, such as unlocking 1Password desktop.
