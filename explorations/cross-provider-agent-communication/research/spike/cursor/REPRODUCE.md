# Cursor reproduction boundaries

The captured route is blocked by a subscription/plan response. Do not repeat
model calls to troubleshoot it or switch model/credential routes. No new paid
endpoint or purchase is authorized by these files.

Sources are synthetic-only disposable fixtures, not production adapters. Copy
them from this directory into a fresh owned cache before running:

```sh
mkdir -p "$HOME/.cache/beep"
task_cursor_cache="$(mktemp -d "$HOME/.cache/beep/cursor-spike.XXXXXX")"
export BEEP_SPIKE_ROOT="$task_cursor_cache"
mkdir -p "$task_cursor_cache/workspace"
chmod 700 "$task_cursor_cache"
cp probes/*.py "$task_cursor_cache/"
timeout 50s python3 "$task_cursor_cache/probe.py"
```

Packaged sources were hardened after the captured run; only syntax and static checks
were repeated. `BEEP_SPIKE_ROOT` is mandatory, must resolve strictly below
`~/.cache/beep`, and cannot be the original captured Cursor cache directory.
Source imports resolve beside the script; workspace and receipts use the selected
root. Keep the same root only for explicitly paired lifecycle/recovery steps.

Default `probe.py` performs initialize only, with no model prompt. The exact
owned child command is:

```text
cursor-agent --model claude-opus-5-5 --mode ask --sandbox enabled \
  --workspace <owned-cache>/workspace acp
```

`session.py` creates a disposable session without prompting. It supplies
`mcpServers: []` but this is not proof that global plugins/hooks/settings are
disabled. Existing subscription authentication is inherited without copying
credentials. The observed CLI ignores `--mode ask` during session/new; the
exchange runner explicitly sets ask mode and checks the exact model pin first.
All client reverse tool/permission operations are rejected.

Rerun the model suite only after the captured access barrier is resolved on the
approved existing route; new paid services remain a separate operator decision.
Its explicit entry point is:

```sh
timeout 600s python3 "$task_cursor_cache/probe.py" --authorized-model-probes
```

The suite has a 540-second internal bound, at most five idle, five busy queue,
five cancellation and one successful-resume echo cases. Each RPC has a timeout.
It stops at the first failed idle receipt. Prompts contain only synthetic nonce
echoes or bounded numbered output; no tools/files/subagents are requested.
`resume_only.py` loads only the identity previously created by these fixtures,
after stopping its owned original process. This is not live app attachment.

The current evidence has one denied idle attempt, no successful echo, no busy
or cancellation samples, and a failed no-prompt restart/load attempt.

Raw output and runtime IDs are written to cache files marked private with mode
600; do not copy them into the packet. Future result files must be sanitized
before publication, including UUIDs, account/session identifiers and absolute
home paths. Only sanitized capture receipts are included here.
