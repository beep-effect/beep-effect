---
name: auth-environments
description: >
  Sign Claude Code in to a chosen Claude subscription on every linked T3 fleet
  host (grok-bot, beep-worker, dankserver, tbk-worker, tom-pc-1-wsl). Use when a
  Claude account hits its weekly limit, when `bun run beep accounts` shows the
  fleet's account used up, or on `/auth-environments`. Opens each host's OAuth
  page and a masked KDE code dialog together and verifies the admitted account.
compatibility: KDE Plasma with kdialog and Python 3 on the workstation; the canonical fleet SSH wrappers in ~/.local/bin.
metadata:
  status: active
---

# Auth environments

Moves the Claude Code login on the fleet hosts to an account with quota left.
Claude only: it is the one provider with several subscriptions. The script does
the SSH, OAuth and code handoff. You pick the account and watch the result.

## 1. Pick the account

```sh
bun run beep accounts                                           # weekly headroom per Claude account
python3 .claude/skills/auth-environments/scripts/auth_env.py status
```

`status` lists the account each host is signed in to now. Choose the account
with the most weekly headroom; if it is not obvious, ask the operator with
`AskUserQuestion`. Leave the local DankStation login alone unless the operator
asks: a local switch is plain `claude auth login`.

**The browser decides the account.** The OAuth page admits whichever claude.ai
account the default browser is signed in to; `--email` is only a hint. Before
the login run, tell the operator which account the browser must hold. If it
holds a different one, they either switch it or pick that account instead.

## 2. Log in

```sh
python3 .claude/skills/auth-environments/scripts/auth_env.py login --email <account>
```

Run it in the foreground with a long timeout (about 25 minutes); it serializes
hosts. Name the hosts or pass `--force` to limit or repeat the run. For each
host it:

1. opens a 1-hour SSH ControlMaster (`~/.ssh/cm-auth-<host>`) through the
   host's canonical wrapper. YubiKey hosts need one touch per hour, and the
   script says when. Initializes the dankserver agent if it is missing;
2. skips a host already on the account;
3. starts `claude auth login --claudeai` in a remote PTY and, the moment the
   URL appears, opens the browser tab **and** the masked KDE dialog together
   (plasma-sensitive-entry pipe helper). The operator authorizes and pastes the
   code into the dialog, and the code goes only to the remote PTY;
4. reopens both after a rejected code (three attempts in all) and stops on
   cancel or timeout;
5. re-reads `claude auth status` and prints a summary, flagging any host that
   landed on a different account than requested.

Announce before the run: "a browser tab and a KDE dialog will open per host;
touch the YubiKey when it blinks". Never ask for the code in chat.

## 3. After

- A host flagged `expected <account>` signed in with the browser's account.
  Fix the browser session and rerun with `--force <host>`.
- Running Claude sessions on a host may hold the old token. New T3 threads
  and turns pick up the new login.
- Logins last about 30 days (`loginExpiresAt`); expect to rerun this skill.
- Add a newly linked host to `HOSTS` in the script with its canonical wrapper.
  Never put IPs, tailnet names or environment ids here: the repository is
  public. The routes are in
  [remote-development-agents](../remote-development-agents/references/hosts.md).

## Verification

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s .claude/skills/auth-environments/scripts -p 'test_*.py'
```
