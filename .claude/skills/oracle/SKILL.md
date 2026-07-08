---
name: oracle
description: "Use the @steipete/oracle CLI to bundle a prompt plus the right files for ChatGPT review. Render/copy with Oracle, then submit through the user's Chrome session by default when safe: prefer the @Chrome plugin, then Computer Use in Chrome, then @Browser as a fallback. Use the latest Pro model with extended thinking when available."
---

# Oracle (CLI)

Oracle bundles your prompt plus selected files into one "one-shot" request so ChatGPT can answer with real repo context. Treat outputs as advisory and verify them against the codebase and tests.

Oracle is a **bundler first**. The default path is:

1. use Oracle to bundle and render the exact prompt plus attachments
2. copy that rendered bundle to the clipboard
3. submit the bundle through the user's Chrome ChatGPT session when the safety preflight passes
4. use the latest Pro model with extended thinking when available
5. watch for the final answer and bring the result back into the agent workflow

Manual paste remains the fallback when browser automation is unavailable, logged out, interrupted, or unsafe for the current context.

Do not use Oracle API mode for routine work. Do not use Oracle's native browser automation by default. Do not use remote browser-host flows.

## Default Workflow

Use this workflow for normal Oracle work:

```bash
oracle --render --copy -p "<task>" --file "<tight file set>"
```

Then:

1. Pick the minimum files that still contain the truth.
2. Run `oracle --dry-run summary --files-report ...` before rendering broad scopes.
3. Render and copy the bundle with `oracle --render --copy`.
4. Run the safety preflight below.
5. Submit through the browser path ladder.
6. Watch for the final answer, extract it, and verify it against local files and tests.

## Browser Submit Ladder

Use the user's Chrome session by default when the safety preflight passes:

1. Use the `@Chrome` plugin / Codex Chrome Extension if it is available.
2. If `@Chrome` is unavailable, use Computer Use to operate Google Chrome.
3. If Chrome cannot be operated, use the in-app `@Browser` plugin as a fallback.
4. If browser automation is unavailable or unsafe, render/copy only and ask the human to paste manually.

When using any browser path:

1. Open a new ChatGPT chat unless the user explicitly asked to use an existing thread.
2. Do not read, summarize, or interact with unrelated existing chats.
3. Verify ChatGPT is logged in by checking for the composer, not a login page.
4. Verify the visible account/workspace is the intended one when possible.
5. Do not switch accounts.
6. Stop if the page shows sensitive unrelated content.
7. Never handle passwords, OTPs, CAPTCHA, account recovery, or payment prompts.
8. Use the latest Pro model with extended thinking when available. As of May 11, 2026, that is GPT-5.5 Pro; if the UI label has changed, pick the newest visible Pro/extended-thinking mode rather than a stale hardcoded model name.
9. Paste the rendered Oracle bundle from the clipboard.
10. Submit and watch until generation has stopped and the send/stop control indicates completion.
11. Bring back the final answer plus any caveats, then verify locally before acting.

## Safety Preflight

Before submitting to ChatGPT, confirm all are true:

- The user explicitly asked to use Oracle/ChatGPT or approved sending this bundle.
- The exact file scope is known and narrow.
- `--dry-run summary --files-report` has been used for broad scopes.
- No secrets, credentials, customer data, personal documents, private logs, browser/search history, regulated data, private keys, or other sensitive data are included.
- The destination account/session is the user's intended ChatGPT session.
- The bundle was not generated from an ambiguous glob such as `.` or the repo root without review.

If any item is false or unknown, do not submit automatically. Render/copy only and ask the human to review or paste manually.

## Manual-Paste Fallback

Use this path when Chrome automation is unavailable, logged out, interrupted, or not appropriate for the current context.

1. Render and copy the bundle with `oracle --render --copy`.
2. Tell the human the bundle is on the clipboard.
3. Have the human paste and submit it in ChatGPT.
4. Continue only after the human provides the response back.

## Golden Path

1. Pick a tight file set with the minimum files that still contain the truth.
2. Preview broad scopes with `--dry-run` and `--files-report`.
3. Render and copy the bundle with `oracle --render --copy`.
4. Run the safety preflight.
5. Submit through the browser ladder when safe.
6. Watch for completion, extract the final result, and verify it before acting.

## Commands

- Show help:
  - `oracle --help`

- Check installed/upstream versions:
  - `oracle --version`
  - `npm view @steipete/oracle version dist-tags --json`
  - `npm list -g @steipete/oracle --depth=0`

- Update to the npm-supported latest release:
  - `npm install -g @steipete/oracle@latest`
  - Prefer the npm `latest` dist-tag over older/deprecated semver tags unless the user explicitly asks for a specific version.

- Preview without spending tokens:
  - `oracle --dry-run summary -p "<task>" --file "src/**" --file "!**/*.test.*"`
  - `oracle --dry-run full -p "<task>" --file "src/**"`

- Token and cost sanity:
  - `oracle --dry-run summary --files-report -p "<task>" --file "src/**"`

- Default run:
  - `oracle --render --copy -p "<task>" --file "src/**"`
  - `--copy` is a hidden alias for `--copy-markdown`
  - If `--copy` fails, use `--copy-markdown`

## Attaching Files (`--file`)

`--file` accepts files, directories, and globs. Pass it multiple times as needed.

`--file` is local-filesystem context only. Oracle does not directly attach GitHub repos via a GitHub connector, remote repo URL, or Codex connector state. If a repo only exists on GitHub, clone it locally or fetch the specific files you want to attach.

- Include:
  - `--file "src/**"`
  - `--file src/index.ts`
  - `--file docs --file README.md`

- Exclude:
  - `--file "src/**" --file "!src/**/*.test.ts" --file "!**/*.snap"`
  - `--file "src/**" --file "!.env" --file "!.env.*" --file "!**/*.pem" --file "!**/*.key" --file "!**/id_rsa*" --file "!**/*token*" --file "!**/*secret*" --file "!**/.aws/**" --file "!**/.ssh/**" --file "!**/logs/**"`

- Defaults from the current implementation:
  - Default-ignored dirs: `node_modules`, `dist`, `coverage`, `.git`, `.turbo`, `.next`, `build`, `tmp`
  - Honors `.gitignore` when expanding globs
  - Does not follow symlinks
  - Dotfiles are filtered unless you explicitly opt in with a pattern like `--file ".github/**"`
  - Files over 1 MB are rejected unless you raise `ORACLE_MAX_FILE_SIZE_BYTES` or `maxFileSizeBytes` in `~/.oracle/config.json`

## Budget and Observability

- Target: keep total input under about 196k tokens
- Use `--files-report` or `--dry-run json` to find token-heavy files before spending
- For hidden and advanced knobs: `oracle --help --verbose`

Run `oracle --dry-run summary --files-report ...` before rendering when attaching a directory or glob broader than about 10 files, using repo-root patterns, attaching generated docs/logs, including dotfiles, or expecting the bundle to exceed 100k tokens.

## Engine Policy

- Normal use is render-and-copy plus browser submit/watch through the ladder above
- Manual paste is the fallback
- Do not use `--engine api`
- Do not use `--models`, `--background`, Azure flags, or API follow-up flows for routine work
- Do not use remote browser host/client flows
- On macOS, prefer `oracle --render --copy`

### Oracle Native Browser Mode

Oracle's native browser mode is not the default for Codex work on this machine. Use it only when the user explicitly asks for it or Chrome automation cannot handle the workflow and the user approves the experimental path.

If using Oracle native browser mode for a long Pro run, the installed CLI supports auto-reattach flags:

```bash
oracle --engine browser \
  --browser-timeout 6m \
  --browser-auto-reattach-delay 30s \
  --browser-auto-reattach-interval 2m \
  --browser-auto-reattach-timeout 2m \
  -p "<task>" --file "src/**"
```

These flags apply to Oracle's own browser driver, not to the `@Chrome` plugin.

## Prompt Template

Oracle starts with zero project knowledge. Include:

- Project briefing: stack, build and test commands, platform constraints
- Where things live: key directories, entrypoints, config files, dependency boundaries
- Exact question, what you tried, and the error text verbatim
- Constraints: public API limits, performance budgets, do-not-change areas
- Desired output: patch plan, tests, risky assumptions, options with tradeoffs

### Exhaustive Prompt Pattern

When you expect a long investigation, make the prompt self-contained:

- Top: 6 to 30 sentences with the project briefing and current goal
- Middle: concrete repro steps, exact errors, and what you already tried
- Bottom: attach every context file needed to understand the issue from scratch

Oracle runs are one-shot. If you need the same context later, re-run with the same prompt and `--file` set.

## Safety

- Treat submitting an Oracle bundle to ChatGPT as transmitting the included prompt and file contents to a third party.
- If the user asks to run Oracle on a specific repo/file set, run the safety preflight before browser submission.
- Pause before submitting when the selected files or prompt include secrets, `.env` files, API keys, auth tokens, customer data, personal documents, private logs, medical/legal/financial data, browser/search history, or other sensitive data.
- Pause when the file scope is broad or ambiguous enough that you cannot tell whether sensitive data is included.
- Do not attach secrets by default such as `.env`, key files, or auth tokens.
- If a sensitive file is required for debugging, redact it first and attach the redacted copy.
- Clipboard caution: `--copy` places the full rendered bundle on the system clipboard. Avoid `--copy` for sensitive bundles; render to stdout or a temporary reviewed file instead. After use, clear the clipboard when feasible.
- Prefer just-enough context instead of dumping the whole repo
