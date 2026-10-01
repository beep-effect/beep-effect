#!/usr/bin/env bash
# hook-pulse: appends exactly one privacy-safe `HookPulseV1` NDJSON row per
# Claude Code hook event to the clone-independent XDG evidence store
# (goals/coding-agent-effectiveness-evidence-loop, P1 sequence-break
# instrument). The binding contract is
# `packages/tooling/library/ai-metrics/src/hook-pulse.ts`; the conformance test
# `packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts` decodes
# this script's output with `HookPulseV1`, whose `HookPulseWaitReasonInvariant`
# filter fails the decode if the jq derivation below ever disagrees with the
# TypeScript `deriveWaitReason`. The schema, not this comment, is the oracle.
#
# Load-bearing decisions:
# - Kill switch first. The sentinel test runs before jq, before reading stdin,
#   and before any parsing, so a disarm takes effect within one syscall. The
#   hook fires on every tool call in every clone; a week-long always-on
#   instrument with no sub-second disarm is not acceptable.
# - Whitelist projection happens HERE (spike amendment 6). Raw payloads carry
#   `prompt`, `message`, `tool_input`, `tool_response`, `last_assistant_message`,
#   `background_tasks`, `session_crons`, `permission_suggestions`, and `error`
#   (PostToolUseFailure). The output object is built key-by-key from an explicit
#   whitelist and never by deleting keys from the input, so an unforeseen future
#   content-bearing key cannot leak.
# - Pseudonymization also happens HERE, for the same reason. `sessionId`, `cwd`,
#   and `transcriptPath` are private identifiers the instrument cannot simply
#   drop — wait attribution needs stable per-session and per-clone grouping — so
#   they are salted SHA-256 digests before the row exists, not after. `Sha256Hex`
#   on the schema side makes a raw value structurally unwritable rather than
#   merely discouraged.
# - `evidenceTier` is `derived`, never `observed`. `waitReason` is derived, so
#   under evidence-law 2 (weakest link) the row cannot outrank its weakest input;
#   the codec's `clampDerivedEvidenceTier` maps `observed` to `derived`, so
#   stamping `observed` here would make P4's replay-twice-diff determinism gate
#   fail on every row.
# - No `capture()`. jq's `capture()` returns an EMPTY STREAM on no-match, and an
#   empty stream inside object construction annihilates the whole object while
#   this fail-open script still exits 0 — the spike defect that silently dropped
#   every idle-wait row. `try`/`catch` does not help; there is no error to catch.
#   Every expression feeding the object construction is an if/else or `index(...)`
#   (which yields `null`, not empty), so none of them can be empty. The one
#   literal `empty` below is the top-level refusal path — it annihilates the row
#   on purpose, and the shell guards on an empty `$output`. `put` additionally
#   forces its value through `[v][0]`, so even a future empty-capable expression
#   degrades to `null` instead of silently deleting the whole row.
# - One row per file shard `hook-pulse-<UTC day>-<hashed sessionId>.ndjson`,
#   appended as a single `printf` under PIPE_BUF. Sharding per session makes interleaving
#   between concurrent sessions in sibling worktrees structurally impossible
#   rather than merely improbable; the single-write append is the second guard
#   for same-session concurrency (parallel subagent tool calls).
# Always exits 0 — the instrument must never block the agent.

# Precedence mirrors the P0 store rule (`--data-root` -> env -> XDG default) and
# must stay in lockstep with `agentEvidenceRoot` / `hookPulseLedgerDir` exported
# from `@beep/repo-ai-metrics`; the conformance test derives its expected
# location from those exports so the two halves cannot drift apart.
BEEP_AGENT_EVIDENCE_ROOT="${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/beep/agent-evidence}"
BEEP_HOOK_PULSE_DISARM_SENTINEL="${BEEP_HOOK_PULSE_DISARM_SENTINEL:-${BEEP_AGENT_EVIDENCE_ROOT}/hook-pulse.disarmed}"
if [ -e "${BEEP_HOOK_PULSE_DISARM_SENTINEL}" ]; then
  exit 0
fi

# HARD REQUIREMENT: this script must never write to stdout. `PermissionRequest`
# is a *decision* hook — the harness feeds hook stdout into the permission
# outcome, and a hook returning
# `{hookSpecificOutput: {hookEventName: "PermissionRequest", decision: {behavior: "allow"}}}`
# auto-approves the tool call. Only that exact JSON shape decides, so stray text
# cannot flip a permission today, but the failure mode is catastrophic in both
# directions: it would bypass permission gating AND destroy the experiment, since
# an auto-approved call produces no human wait and the instrument would record
# zeros. Closing fd 1 here makes the guarantee structural rather than a promise
# about every future edit. (`$(...)` below still captures jq's output correctly —
# command substitution installs its own pipe on fd 1.) This is deliberately
# unlike `law-pulse.sh`, which writes to stdout on purpose to inject context.
exec 1>/dev/null

set -euo pipefail

# Without jq the instrument degrades to silence rather than to noise or a block.
command -v jq >/dev/null 2>&1 || exit 0

# `BEEP_HOOK_PULSE_AGENT_KIND` lets an adapter that reuses this body (the Cursor
# adapter at `.cursor/hooks/hook-pulse.sh`) tag its rows. Only `HookPulseAgentKind`
# literals may reach the ledger: an inherited stray value would append a row that
# `HookPulseV1` cannot decode, so an unknown kind writes nothing and notifies no one.
agent_kind="${BEEP_HOOK_PULSE_AGENT_KIND:-claude-code}"
case "${agent_kind}" in
  claude-code|codex-cli|cursor-cli) ;;
  *) exit 0 ;;
esac

# Same degradation rule for the digest tool, and for a stronger reason: without
# it the writer cannot pseudonymize `sessionId`, `cwd`, and `transcriptPath`, and
# those are exactly the fields `Sha256Hex` exists to keep out of the ledger in
# the clear. Silence beats an undecodable row, and both beat a raw home
# directory on disk. Which tool is present is discovered, never assumed;
# openssl's `-r` normalizes its `SHA2-256(stdin)= <hex>` output to the
# `<hex> <name>` shape the other two already use, so one field extraction serves
# all three. The digest shape is still verified per call below, because a tool
# being on PATH is not proof of what it prints.
if command -v sha256sum >/dev/null 2>&1; then
  hash_stdin() { sha256sum; }
elif command -v shasum >/dev/null 2>&1; then
  hash_stdin() { shasum -a 256; }
elif command -v openssl >/dev/null 2>&1; then
  hash_stdin() { openssl dgst -sha256 -r; }
else
  exit 0
fi

# Mirrors `resolveAiMetricsHashSaltValue` from `@beep/repo-ai-metrics`: absent,
# empty, or whitespace-only falls back to `AI_METRICS_LOCAL_INSECURE_HASH_SALT`,
# so an unconfigured clone still produces digests the TypeScript half reproduces
# exactly rather than digests nobody can check. `${:-}` alone would accept `"   "`
# as a salt while TypeScript rejected it, so the whitespace case is not
# decoration — it is the one input on which the two halves could disagree while
# both looked correct. The second rung is the repo-wide ai-metrics salt, so a
# machine that already exports one groups hook rows under the same pseudonyms as
# the rest of the stack; the first rung salts this instrument on its own.
#
# Both halves walk this chain. `hookPulseHashSalt` in `hook-pulse.ts` resolves
# the same two variables in the same order — through `Config`, so the ambient
# `ConfigProvider` supplies them — and falls back to the same published
# constant, so a row this writer appends and a row the codec derives from the
# same raw event carry identical digests on every rung. That matters because
# every other ai-metrics producer (`source-discovery.ts`, `retention.ts`,
# `forwarder.ts` — which provisions `BEEP_AI_METRICS_HASH_SALT` from 1Password
# via `op read`) threads an operator salt, so honouring it here is what keeps
# hook rows in the same pseudonym namespace as the rest of the stack. The
# parity test in `hook-pulse-writer.test.ts` runs this script under an explicit
# test salt and recomputes its digests in TypeScript, so the agreement is
# checked rather than asserted. Rows that arrive already 64-hex still pass
# `privateReference` through untouched, so nothing is ever double-hashed.
# Rows written before the operator cutover are a separate namespace and are
# never re-migrated.
hash_salt="${BEEP_HOOK_PULSE_HASH_SALT:-${BEEP_AI_METRICS_HASH_SALT:-}}"
case "${hash_salt}" in
  *[![:space:]]*) ;;
  *) hash_salt="beep-ai-metrics-local-smoke-insecure-salt" ;;
esac

# THE NUL TRAP. Bash cannot carry a NUL in a variable and strips it from a
# heredoc, so building `${hash_salt}<NUL>${value}` as a shell value first hashes
# `salt+value` with no separator — a digest that is 64 lowercase hex characters,
# passes every shape check, decodes cleanly as `Sha256Hex`, and can never equal
# `hashPrivateIdentifier`. The separator survives only when `printf` writes it
# straight into the pipe, so the salted preimage must never exist as a shell
# value. `hashPrivateIdentifier` is the oracle, not this comment: the writer
# conformance test recomputes both digests in TypeScript and compares them.
#
# An empty input returns an empty digest rather than the digest of the empty
# string. That is what lets the jq program treat "absent" and "unhashable" as one
# case instead of writing a plausible-looking hash of nothing into an optional
# field.
sha256_private_identifier() {
  if [ -z "$1" ]; then
    return 0
  fi

  local digest
  digest="$(printf '%s\000%s' "${hash_salt}" "$1" | hash_stdin)" || return 1
  digest="${digest%% *}"
  # Verified, not assumed: whatever tool was discovered must have produced
  # exactly the `Sha256Hex` shape or nothing is written at all. This check is
  # also what makes the shard filename safe without a separate sanitizer — a
  # value that is only `[0-9a-f]` has no path separators to escape with.
  case "${digest}" in
    "" | *[!0-9a-f]*) return 1 ;;
  esac
  [ "${#digest}" -eq 64 ] || return 1

  printf '%s' "${digest}"
}

# The context-surface digest is deliberately UNSALTED, unlike the three private
# identifiers above: a surface key (`skill:yeet`, `hook:law-pulse.sh`,
# `mcp-server:notion`) names a public repo surface, not a person or a path, and
# the digest has to join across clones and with the TypeScript
# `contextSurfaceId(kind, name)`. The preimage is `printf '%s'` of the key with
# no trailing newline. Same discovered tool, same shape verification.
sha256_public_text() {
  if [ -z "$1" ]; then
    return 0
  fi

  local digest
  digest="$(printf '%s' "$1" | hash_stdin)" || return 1
  digest="${digest%% *}"
  case "${digest}" in
    "" | *[!0-9a-f]*) return 1 ;;
  esac
  [ "${#digest}" -eq 64 ] || return 1

  printf '%s' "${digest}"
}

# Millisecond precision is load-bearing: the spike measured `PreToolUse` and its
# `PermissionRequest` in the same second, and P4's two-hop join pairs each
# `PermissionRequest` with the nearest preceding unpaired `PreToolUse`. Fall back
# to second precision only where `%3N` is unsupported.
ts="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
case "${ts}" in
  *N*) ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)" ;;
esac

notifier_rev="${BEEP_HOOK_PULSE_NOTIFIER_REV:-desktop-ntfy-1}"
instrument_class="${BEEP_HOOK_PULSE_INSTRUMENT_CLASS:-production}"
# A misconfigured class would make every row undecodable, so fail back to the
# default rather than poisoning the ledger.
case "${instrument_class}" in
  production | spike | meta) ;;
  *) instrument_class="production" ;;
esac

payload="$(cat)"

# One extraction pass for the three private identifiers, NUL-delimited. A `cwd`
# or `transcript_path` containing a newline is legal on POSIX, and a
# line-delimited read would silently hash a truncated value while still
# producing a well-formed digest — the same failure class as the NUL trap, one
# layer earlier. Only the salted preimage is unsafe in a shell value; the raw
# identifiers themselves are ordinary strings. The `cwd` fallback lives here
# rather than in the main program so that exactly one expression decides what
# gets hashed. The fourth field is the raw event name, read only to gate the
# SessionStart harness walk below; it is never hashed or written from here.
identifier_program='
def as_string: if type == "string" then . else null end;
def as_present: as_string | if . == "" then null else . end;
def nul: [0] | implode;
((.session_id | as_present) // ""), nul,
((.cwd | as_string) // $fallbackCwd), nul,
((.transcript_path | as_present) // ""), nul,
((.hook_event_name | as_present) // ""), nul
'

# The trailing `nul` is what makes the last read succeed rather than hit EOF,
# and clobbering to `""` on a failed read is a safety property, not tidiness: a
# `read` that reaches EOF before its delimiter still assigns the partial data it
# consumed. So a jq build that could not emit the separator would otherwise leave
# the three values concatenated into the first variable and hash a string no
# reader can reproduce. Discarding the partial value instead turns any truncation
# of this stream into an empty digest, which the jq program below treats as a
# refusal. DO NOT relax these to `|| true`; that is exactly the substitution that
# converts a silent refusal into a silently wrong digest.
raw_session_id=""
raw_cwd=""
raw_transcript_path=""
raw_hook_event=""
{
  IFS= read -r -d '' raw_session_id || raw_session_id=""
  IFS= read -r -d '' raw_cwd || raw_cwd=""
  IFS= read -r -d '' raw_transcript_path || raw_transcript_path=""
  IFS= read -r -d '' raw_hook_event || raw_hook_event=""
} < <(jq -j --arg fallbackCwd "${PWD}" "${identifier_program}" <<<"${payload}" 2>/dev/null)

session_id_hash="$(sha256_private_identifier "${raw_session_id}")" || exit 0
cwd_hash="$(sha256_private_identifier "${raw_cwd}")" || exit 0
transcript_path_hash="$(sha256_private_identifier "${raw_transcript_path}")" || exit 0

# Context surface (goals/harness-evidence-ledger, D8): which repo surface a
# successful tool call touched, as an unsalted digest of `${kind}:${name}`. The
# TypeScript mirror is `hookPulseContextSurfaceKey` in `hook-pulse.ts`, and the
# writer conformance test compares both digests. Only `PostToolUse` owns
# `surface`, so every other event skips the extra jq pass and the root walk;
# the substring gate may false-positive (the program re-checks the event) but
# can never false-negative, since a PostToolUse payload always carries the
# quoted event name. The raw skill name or path lives only in these locals and
# the jq pass; the row receives the digest or nothing.
# The repo root is the nearest ancestor of `cwd` holding BOTH `AGENTS.md` and
# `.git`: `AGENTS.md` alone would stop at a nested app's own guide
# (`apps/*/AGENTS.md`) and misfile every root surface. Only an absolute `cwd`
# enters the walk (a relative one yields no surface in the jq program and the
# codec alike), and the loop stops once a strip makes no progress, so a segment
# without `/` can never spin forever. It sets `found_repo_root` (empty when
# nothing matches) instead of printing, so callers pay no subshell for it.
find_repo_root() {
  found_repo_root=""
  local probe next_probe
  case "$1" in
    /*) probe="$1" ;;
    *) probe="" ;;
  esac
  while [ -n "${probe}" ] && [ "${probe}" != "/" ]; do
    if [ -e "${probe}/AGENTS.md" ] && [ -e "${probe}/.git" ]; then
      found_repo_root="${probe}"
      return 0
    fi
    next_probe="${probe%/*}"
    [ "${next_probe}" = "${probe}" ] && return 0
    probe="${next_probe}"
  done
}

surface_hash=""
case "${payload}" in
  *'"PostToolUse"'*)
    # No match falls back to `cwd`, which is also the TypeScript codec's default.
    find_repo_root "${raw_cwd}"
    repo_root="${found_repo_root:-${raw_cwd}}"

    # Every branch yields a string, never `empty` (see the `capture()` note in the
    # header). `segments` is a lexical fold: `..` pops, `.` and `""` vanish.
    surface_program='
def as_string: if type == "string" then . else null end;
def as_present: as_string | if . == "" then null else . end;
def segments: split("/")
  | reduce .[] as $s ([];
      if $s == "" or $s == "." then .
      elif $s == ".." then .[:-1]
      else . + [$s]
      end);
def absolute($path):
  if ($path | startswith("/")) then $path
  elif ($cwd | startswith("/")) then $cwd + "/" + $path
  else null
  end;
def repo_relative($path):
  (absolute($path)) as $abs
  | ($root | segments) as $r
  | if $abs == null then null
    else ($abs | segments) as $a
    | if ($r | length) > 0 and ($a | length) > ($r | length) and $a[0:($r | length)] == $r
      then $a[($r | length):]
      else null
      end
    end;
def classify:
  if . == null then null
  elif length == 1 and (.[0] == "AGENTS.md" or .[0] == "CLAUDE.md") then "agents-md:AGENTS.md"
  elif length >= 4 and .[0] == ".claude" and .[1] == "skills" then "skill:" + .[2]
  elif length == 3 and .[0] == ".claude" and .[1] == "hooks" then "hook:" + .[2]
  elif length == 3 and .[0] == ".claude" and .[1] == "agents" then "agent-definition:" + .[2]
  elif length == 2 and .[0] == ".claude" and (.[1] | test("^settings(\\..+)?\\.json$")) then "settings:" + .[1]
  elif length == 2 and .[0] == ".patterns" then "pattern:" + .[1]
  else null
  end;
def file_tools: [ "Read", "Edit", "Write", "MultiEdit", "NotebookEdit" ];

(.hook_event_name | as_present) as $event
| (.tool_name | as_present) as $tool
| (if (.tool_input | type) == "object" then .tool_input else {} end) as $input
| (if $event != "PostToolUse" or $tool == null then null
   elif $tool == "Skill" then
     ((($input.skill | as_string) // "") | sub("^/+"; "")) as $name
     | if $name == "" then null else "skill:" + $name end
   elif ($tool | startswith("mcp__")) then
     ($tool[5:]) as $rest
     | ($rest | index("__")) as $i
     | if $i == null or $i == 0 then null else "mcp-server:" + $rest[0:$i] end
   elif (file_tools | index($tool)) != null then
     (($input.file_path | as_present)
      // ($input.notebook_path | as_present)
      // ($input.path | as_present)) as $path
     | if $path == null then null else (repo_relative($path) | classify) end
   else null
   end) as $key
# A newline in the key would be stripped by command substitution before
# hashing, minting a digest TypeScript cannot reproduce; refuse it on both sides.
| if $key == null or ($key | contains("\n")) then "" else $key end
'
    surface_key="$(jq -j --arg cwd "${raw_cwd}" --arg root "${repo_root}" "${surface_program}" <<<"${payload}" 2>/dev/null)" ||
      surface_key=""
    # A failed digest drops the surface, not the row: the event itself is still
    # evidence the ledger wants.
    surface_hash="$(sha256_public_text "${surface_key}")" || surface_hash=""
    ;;
esac

# Harness hash (goals/harness-evidence-ledger, D9): which harness regime this
# session started under, so `harness-ledger prune-proposals` can count only
# sessions under the current one. It is a MIRROR of `makeAiMetricsConfigSnapshot`
# (`config-snapshot.ts`) followed by `deriveHarnessHash` (`harness-ledger.ts`),
# and the writer conformance test compares the two over fixture roots. Only
# `SessionStart` owns the stamp, so every other event skips this block before
# spawning anything. The gate is the exact event name from the identifier pass,
# not a substring of the payload: a PreToolUse editing `settings.json` can carry
# the text "SessionStart" in its tool input, and must not pay for a repo walk.
#
# Parity beats coverage. A missing stamp only keeps a session out of the
# window; a wrong one silently corrupts evidence. So every case the shell
# cannot prove it hashes exactly as TypeScript does drops the stamp, never the
# row: no repo root, a missing tool (GNU `find -printf` included), any `find`
# error (unreadable directory, symlink loop), a path outside printable ASCII
# or holding a backslash (sort order and `sha256sum` escaping stop matching
# JS), 1000 or more collected files (the `maxFiles` budget), more than 8 MiB of
# included bytes (`maxTotalBytes`), and an awk that fails the decoder
# self-tests. Files over 512 KiB are skipped, exactly as TypeScript skips them. Depth is mirrored by `-maxdepth 8`
# (TypeScript collects a file at depth 8 but never reads a directory there),
# and `-L` mirrors `stat`, which follows symlinks such as `CLAUDE.md`.
#
# The walk: repo-root `AGENTS.md`/`CLAUDE.md` at any depth (the TypeScript root
# walk recurses with an agent-doc filter), plus every file under `.codex`,
# `.claude`, `.ai`, and `.aiassistant`. Excluded directory names are pruned by
# name, and a directory holding `.git` (a nested checkout such as
# `.claude/worktrees/*`) drops out with everything beneath it. `find` cannot
# prune on "has a .git child", so it reports each `.git` and awk drops the
# files under those roots afterwards.
#
# THE NUL TRAP again: the per-scope preimage joins `path<NUL>hash` lines, so
# the lines carry `\001` as a stand-in and `tr` swaps in the NUL inside the pipe.
# Paths are printable ASCII by then, so `\001` cannot collide with one.
harness_config_hash() (
  cd -- "$1" 2>/dev/null || exit 1
  for tool in find sort awk tr od sha256sum; do
    command -v "${tool}" >/dev/null 2>&1 || exit 1
  done
  export LC_ALL=C
  tab="$(printf '\t')"

  # `readFileString` decodes with `TextDecoder`, so TypeScript hashes the UTF-8
  # re-encoding of the decoded text, not the raw bytes. For valid UTF-8 without
  # a byte-order mark those are identical; `utf8_program` names every file for
  # which they may not be (invalid UTF-8 in the WHATWG sense, a NUL, or a
  # leading BOM), and `transcode_program` reproduces the decoder for those:
  # a leading BOM is dropped and each maximal invalid subpart becomes U+FFFD,
  # the WHATWG "UTF-8 decode" algorithm step for step. Both are written with
  # octal escapes and decimal bytes so any POSIX awk parses them, and both must
  # pass the self-tests below before this machine's awk is trusted with them.
  utf8_program='
FNR == 1 && /^\357\273\277/ { print FILENAME }
!/^([\001-\177]|[\302-\337][\200-\277]|\340[\240-\277][\200-\277]|[\341-\354\356\357][\200-\277][\200-\277]|\355[\200-\237][\200-\277]|\360[\220-\277][\200-\277][\200-\277]|[\361-\363][\200-\277][\200-\277][\200-\277]|\364[\200-\217][\200-\277][\200-\277])*$/ { print FILENAME }
'
  transcode_program='
{ for (f = 1; f <= NF; f++) byte[++n] = $f + 0 }
END {
  i = (n >= 3 && byte[1] == 239 && byte[2] == 187 && byte[3] == 191) ? 4 : 1
  need = 0; lower = 128; upper = 191
  while (i <= n) {
    b = byte[i]
    if (need == 0) {
      if (b < 128) { printf "%c", b; i++; continue }
      if (b >= 194 && b <= 223) need = 1
      else if (b >= 224 && b <= 239) { need = 2; if (b == 224) lower = 160; if (b == 237) upper = 159 }
      else if (b >= 240 && b <= 244) { need = 3; if (b == 240) lower = 144; if (b == 244) upper = 143 }
      else { printf "%c%c%c", 239, 191, 189; i++; continue }
      lead = i; seen = 0; i++; continue
    }
    if (b < lower || b > upper) {
      need = 0; lower = 128; upper = 191
      printf "%c%c%c", 239, 191, 189
      continue
    }
    lower = 128; upper = 191; seen++; i++
    if (seen == need) { for (j = lead; j < i; j++) printf "%c", byte[j]; need = 0 }
  }
  if (need != 0) printf "%c%c%c", 239, 191, 189
}
'
  # Self-tests. The validator must pass a clean multi-byte line and flag each of
  # eight defects (stray continuation, overlong, surrogate, past U+10FFFF,
  # truncated at EOF, NUL, leading BOM, invalid lead). The transcoder must hash
  # one input exercising every branch to the digest `TextDecoder` +
  # `TextEncoder` + SHA-256 produce for it under both Node and Bun.
  clean="$(awk "${utf8_program}" <(printf 'ok \303\251 \342\234\223 \360\237\230\200\n') 2>/dev/null)" || exit 1
  [ -z "${clean}" ] || exit 1
  flagged_fixtures="$(
    awk "${utf8_program}" \
      <(printf '\200\n') \
      <(printf '\300\257\n') \
      <(printf '\355\240\200\n') \
      <(printf '\364\220\200\200\n') \
      <(printf 'x\303') \
      <(printf 'a\000b\n') \
      <(printf '\357\273\277x\n') \
      <(printf '\377\n') 2>/dev/null | sort -u | awk 'END { print NR }'
  )" || exit 1
  [ "${flagged_fixtures}" = "8" ] || exit 1
  transcoded_fixture="$(
    printf '\357\273\277a\200\300\257\355\240\200\364\220\200\200\342\202b\360\237\230\200\000\377\n\340\200\303' |
      od -An -v -tu1 | awk "${transcode_program}" | sha256sum
  )" || exit 1
  [ "${transcoded_fixture%% *}" = "933e428115e320ec7b4232feee1cf28d403bf5e203227082c5b7a5b516259186" ] || exit 1

  excluded=(
    -name .beep -o -name .cache -o -name .git -o -name .idea -o -name .next -o -name .repos
    -o -name .turbo -o -name .venv -o -name build -o -name coverage -o -name dist -o -name ide
    -o -name logs -o -name node_modules -o -name outputs -o -name projects -o -name shell-snapshots
    -o -name statsig -o -name target -o -name todos
  )
  config_roots=()
  for config_root in .codex .claude .ai .aiassistant; do
    [ -e "${config_root}" ] && config_roots+=("${config_root}")
  done

  # One record per NUL-terminated line: `RG`/`CG` name a directory holding
  # `.git` in the root/config walk, `RF`/`CF` a collected file with its size.
  # Newlines inside names become `\001` so they fail the printable check.
  collect_program='
/[^ -~\t]/ || index($0, "\\") { bad = 1; next }
$1 == "RG" && NF == 2 { rg[$2] = 1; next }
$1 == "CG" && NF == 2 { cg[$2] = 1; next }
($1 == "RF" || $1 == "CF") && NF == 3 { n++; kind[n] = $1; size[n] = $2; path[n] = $3; next }
{ bad = 1 }
END {
  if (bad) exit 1
  kept = 0
  for (i = 1; i <= n; i++) {
    k = split(path[i], seg, "/")
    prefix = seg[1]
    nested = 0
    for (j = 2; j < k; j++) {
      prefix = prefix "/" seg[j]
      if ((kind[i] == "RF" && (prefix in rg)) || (kind[i] == "CF" && (prefix in cg))) { nested = 1; break }
    }
    if (nested) continue
    kept++
    rel = path[i]
    sub(/^\.\//, "", rel)
    print rel "\t" size[i]
  }
  if (kept >= 1000) exit 1
}
'
  collected="$(
    {
      find -L . -mindepth 1 -maxdepth 8 \
        -name .git ! -type l -printf 'RG\t%h\0' -prune -o \
        \( "${excluded[@]}" \) -prune -o \
        -type f \( -name AGENTS.md -o -name CLAUDE.md \) -printf 'RF\t%s\t%p\0' &&
        if [ "${#config_roots[@]}" -gt 0 ]; then
          find -L "${config_roots[@]}" -maxdepth 8 \
            -name .git ! -type l -printf 'CG\t%h\0' -prune -o \
            \( "${excluded[@]}" \) -prune -o \
            -type f -printf 'CF\t%s\t%p\0'
        fi
    } 2>/dev/null | tr '\n\000' '\001\n' | awk -F "${tab}" "${collect_program}"
  )" || exit 1

  # Sorted and deduplicated by path (the two walks overlap under `.claude`),
  # oversize files skipped, and the byte budget enforced over what remains.
  included="$(
    printf '%s\n' "${collected}" | sort -t "${tab}" -k1,1 -u | awk -F "${tab}" '
NF == 2 && $2 <= 524288 { total += $2; print $1 }
END { if (total > 8388608) exit 1 }
'
  )" || exit 1
  [ -n "${included}" ] || exit 1
  mapfile -t files <<<"${included}"
  files=("${files[@]/#/./}")

  digests="$(sha256sum -- "${files[@]}" 2>/dev/null)" || exit 1
  # Files whose raw bytes are not what TypeScript hashes get the transcoded
  # digest instead, keyed by path; the scope program prefers it.
  overrides=""
  needs_transcode="$(awk "${utf8_program}" "${files[@]}" 2>/dev/null | sort -u)" || exit 1
  if [ -n "${needs_transcode}" ]; then
    mapfile -t transcode_files <<<"${needs_transcode}"
    for file in "${transcode_files[@]}"; do
      digest="$(od -An -v -tu1 -- "${file}" | awk "${transcode_program}" | sha256sum)" || exit 1
      overrides+="${digest%% *}  ${file}"$'\n'
    done
  fi
  scope_program='
NR == FNR { if (length($0) > 66) override[substr($0, 67)] = substr($0, 1, 64); next }
{
  hash = substr($0, 1, 64)
  name = substr($0, 67)
  if (name in override) hash = override[name]
  if (hash !~ /^[0-9a-f]+$/ || length(hash) != 64 || substr($0, 65, 2) != "  ") exit 1
  rel = name
  sub(/^\.\//, "", rel)
  session = (rel == ".claude/settings.json" || rel == ".claude/settings.local.json" || rel == ".codex/config.toml" || rel == "AGENTS.md" || rel == "CLAUDE.md")
  if (session == want) print rel "\001" hash
}
'
  session_body="$(awk -v want=1 "${scope_program}" <(printf '%s\n' "${overrides}") <(printf '%s\n' "${digests}"))" || exit 1
  baseline_body="$(awk -v want=0 "${scope_program}" <(printf '%s\n' "${overrides}") <(printf '%s\n' "${digests}"))" || exit 1
  session_hash="$(printf 'ai-metrics-config-session-v1\n%s' "${session_body}" | tr '\001' '\000' | sha256sum)" || exit 1
  baseline_hash="$(printf 'ai-metrics-config-baseline-v1\n%s' "${baseline_body}" | tr '\001' '\000' | sha256sum)" || exit 1
  session_hash="${session_hash%% *}"
  baseline_hash="${baseline_hash%% *}"
  harness_hash="$(printf 'harness-hash-v1\n%s\n%s' "${session_hash}" "${baseline_hash}" | sha256sum)" || exit 1
  harness_hash="${harness_hash%% *}"
  for digest in "${session_hash}" "${baseline_hash}" "${harness_hash}"; do
    case "${digest}" in
      "" | *[!0-9a-f]*) exit 1 ;;
    esac
    [ "${#digest}" -eq 64 ] || exit 1
  done
  printf '%s' "${harness_hash}"
)

harness_hash=""
if [ "${raw_hook_event}" = "SessionStart" ]; then
  # Unlike `surface`, no fallback to `cwd`: a stamp over the wrong root would be
  # a wrong stamp, and no stamp is the safe failure.
  find_repo_root "${raw_cwd}"
  if [ -n "${found_repo_root}" ]; then
    harness_hash="$(harness_config_hash "${found_repo_root}")" || harness_hash=""
  fi
fi

jq_program='
def as_string: if type == "string" then . else null end;
def as_present: as_string | if . == "" then null else . end;
# Must be no weaker than the schema side: `NonNegNum` is `S.Finite` plus a
# non-negative check, and jq happily carries `1e400` through as `1E+400`, which
# parses back to `Infinity` and fails `S.Finite`. Writing that row would put an
# *undecodable* line in the ledger, which is worse than dropping the field —
# a poisoned shard breaks replay for every row it contains, not just this one.
def as_non_negative: if type == "number" and . >= 0 and . < infinite then . else null end;
def as_boolean: if type == "boolean" then . else null end;
# `v` is deliberately NOT a `$`-parameter. jq desugars `def f($a)` to
# `a as $a | body`, and that binding ITERATES its argument stream: an
# empty-capable argument makes the whole row vanish (jq still exits 0, the shell
# writes nothing), and a two-valued one emits two rows. `[v][0]` collapses the
# stream first — `[empty][0]` is `null`, `[a,b][0]` is `a`. This is the exact
# re-entry point of the spike defect the `capture()` note above describes.
# DO NOT "simplify" the null guard to `v // null` or `$value // ...`. The jq
# alternative operator treats `false` as absent, so `isInterrupt: false` would be
# silently erased and with it the "human hit escape" vs "tool errored"
# distinction the field exists to carry.
def put($key; v): ([v][0]) as $value | if $value == null then . else . + { ($key): $value } end;

# Hand-duplicating these lists against `HookPulseEvent` / `HookPulseNotificationType`
# is the one drift this script cannot detect on its own: a typo silently drops
# 100% of one event and every row it would have produced, while every example
# fixture for the other events stays green. `hook-pulse-writer.test.ts`
# reads both definitions back out of this file and asserts set equality with the
# schema `Options`, so the duplication is checked rather than merely intended.
def hook_events: [ "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure",
                   "Notification", "UserPromptSubmit", "Stop", "SessionEnd",
                   "PermissionDenied", "SessionStart" ];
def notification_types: [ "permission_prompt", "idle_prompt" ];

# The three private identifiers arrive pre-hashed and shape-verified, so nothing
# below can read a raw one: the raw keys are simply never referenced here. An
# empty argument means the shell could not hash it, which is deliberately the
# same case as the field being absent — an unhashable identifier must never
# degrade into a digest of the empty string.
($sessionIdHash | as_present) as $sessionId
| (.hook_event_name | as_present) as $hookEventName
| (if $hookEventName != null and (hook_events | index($hookEventName)) != null
   then $hookEventName
   else null
   end) as $hookEvent
| ($cwdHash | as_present) as $cwd
| (.tool_name | as_present) as $toolName
| (.tool_use_id | as_present) as $toolUseId
| (.prompt_id | as_present) as $promptId
| ($transcriptPathHash | as_present) as $transcriptPath
| ($surfaceHash | as_present) as $surface
| ($harnessHash | as_present) as $harness
| (.permission_mode | as_present) as $permissionMode
| (.notification_type | as_present) as $notificationTypeRaw
| (.duration_ms | as_non_negative) as $durationMs
| (.reason | as_present) as $reason
| (.is_interrupt | as_boolean) as $isInterrupt
| (if $notificationTypeRaw != null
     and (notification_types | index($notificationTypeRaw)) != null
   then $notificationTypeRaw
   else null
   end) as $notificationType
| (if $hookEvent == "PermissionRequest" then
     (if $toolName == null then "unknown"
      elif $toolName == "ExitPlanMode" then "plan-approval"
      else "tool-permission"
      end)
   elif $hookEvent == "Notification" then
     (if $notificationTypeRaw == "idle_prompt" then "idle-input" else "unknown" end)
   else "none"
   end) as $waitReason
| if $sessionId == null or $cwd == null or $hookEvent == null then
    empty
  else
    ({
       schemaVersion: "hook-pulse/v1",
       ts: $ts,
       sessionId: $sessionId,
       agentKind: $agentKind,
       hookEvent: $hookEvent,
       cwd: $cwd,
       notifierRev: $notifierRev,
       instrumentClass: $instrumentClass,
       evidenceTier: "derived",
       waitReason: $waitReason
     }
     | put("toolName"; $toolName)
     | put("toolUseId"; $toolUseId)
     | put("promptId"; $promptId)
     | put("transcriptPath"; $transcriptPath)
     | put("permissionMode"; $permissionMode)
     | put("notificationType"; (if $hookEvent == "Notification" then $notificationType else null end))
     | put("durationMs"; $durationMs)
     | put("sessionEndReason"; (if $hookEvent == "SessionEnd" then $reason else null end))
     | put("isInterrupt"; (if $hookEvent == "PostToolUseFailure" then $isInterrupt else null end))
     | put("surface"; (if $hookEvent == "PostToolUse" then $surface else null end))
     | put("harnessHash"; (if $hookEvent == "SessionStart" then $harness else null end))
    ) as $row
    # No filename sanitizer here any more, and none is needed: `$sessionId` is a
    # digest the shell already proved matches `^[0-9a-f]{64}$`, which contains no
    # path separator, no `..`, and no shell metacharacter. Keeping a `gsub` over
    # a value with that shape would be a no-op dressed as a guard, and the raw
    # session UUID it used to sanitize no longer reaches this program at all.
    | (($ts[0:10]) + "-" + $sessionId), $row
  end
'

# Two raw lines: the file shard key, then the canonical row.
output="$(
  jq -c -r \
    --arg ts "${ts}" \
    --arg agentKind "${agent_kind}" \
    --arg notifierRev "${notifier_rev}" \
    --arg instrumentClass "${instrument_class}" \
    --arg sessionIdHash "${session_id_hash}" \
    --arg cwdHash "${cwd_hash}" \
    --arg transcriptPathHash "${transcript_path_hash}" \
    --arg surfaceHash "${surface_hash}" \
    --arg harnessHash "${harness_hash}" \
    "${jq_program}" <<<"${payload}" 2>/dev/null
)" || exit 0

if [ -z "${output}" ]; then
  exit 0
fi

shard="${output%%$'\n'*}"
row="${output#*$'\n'}"
# A single-line or multi-document result means the projection did not produce
# exactly one row; write nothing rather than a partial or interleaved line.
if [ -z "${shard}" ] || [ -z "${row}" ] || [ "${shard}" = "${row}" ]; then
  exit 0
fi
case "${row}" in
  *$'\n'*) exit 0 ;;
esac

store="${BEEP_AGENT_EVIDENCE_ROOT}/hook-events"
if [ ! -d "${store}" ]; then
  mkdir -p "${store}" 2>/dev/null || exit 0
fi
printf '%s\n' "${row}" >>"${store}/hook-pulse-${shard}.ndjson" 2>/dev/null || exit 0

# A sharp notifier revision turns a durable PermissionRequest row into a
# content-free sequence-break worker. The worker is detached only after this
# append succeeds, so its exact-bracket replay can never race an unwritten
# request. `setsid -f` prevents the hook runner from waiting through reminder
# sleeps; both inherited streams are closed so this path cannot influence the
# permission decision or retain the hook protocol pipe.
if [ "${notifier_rev}" != "log-only-0" ]; then
  notification_fields="$(
    jq -r '
      if .hookEvent == "PermissionRequest" and (.toolName | type) == "string" then
        [
          .sessionId,
          .ts,
          .waitReason,
          (if .toolName == "AskUserQuestion" then "human-input"
           elif .toolName == "ExitPlanMode" then "plan-approval"
           else "tool-permission" end),
          .toolName
        ] | @tsv
      else empty end
    ' <<<"${row}" 2>/dev/null
  )" || notification_fields=""

  if [ -n "${notification_fields}" ] && command -v setsid >/dev/null 2>&1; then
    IFS=$'\t' read -r notification_session notification_ts notification_reason notification_target notification_tool \
      <<<"${notification_fields}"
    notifier_path="${BASH_SOURCE[0]%/*}/sequence-break-notifier.sh"
    if [ -x "${notifier_path}" ]; then
      # Local display/navigation context stays out of the evidence and ntfy
      # ledgers. Preserve the controlling terminal before setsid detaches us.
      notification_terminal=""
      if [ "${TERM_PROGRAM:-}" = "ghostty" ]; then
        if { exec 7>/dev/tty; } 2>/dev/null && [ -t 7 ]; then
          notification_terminal="ghostty"
        fi
      fi
      # A desktop host route is "self" only when the host's own session ID
      # equals this hook's session. A headless child (`claude -p`, `codex
      # exec`) inherits its launcher's IDs; it receives that host as an
      # explicitly labeled "parent" route instead of borrowing it as its own.
      notification_uri="${BEEP_SEQUENCE_BREAK_OPEN_URI:-}"
      notification_relation="self"
      codex_desktop_thread=""
      if [ "${CODEX_INTERNAL_ORIGINATOR_OVERRIDE:-}" = "Codex Desktop" ]; then
        codex_desktop_thread="${CODEX_THREAD_ID:-}"
      fi
      claude_desktop_session="${CLAUDE_CODE_HOST_SESSION_ID:-}"
      if [ -z "${notification_uri}" ]; then
        if [ -n "${codex_desktop_thread}" ] && [ "${codex_desktop_thread}" = "${raw_session_id}" ]; then
          notification_uri="codex://threads/${raw_session_id}"
        elif [ "${agent_kind}" = "claude-code" ] && [ -n "${claude_desktop_session}" ] &&
          [ -n "${CLAUDE_CODE_SESSION_ID:-}" ] && [ "${CLAUDE_CODE_SESSION_ID}" = "${raw_session_id}" ]; then
          notification_uri="claude://code/continue?session=${claude_desktop_session}"
        elif [ -n "${codex_desktop_thread}" ]; then
          notification_uri="codex://threads/${codex_desktop_thread}"
          notification_relation="parent"
        elif [ -n "${claude_desktop_session}" ]; then
          notification_uri="claude://code/continue?session=${claude_desktop_session}"
          notification_relation="parent"
        fi
      fi
      notifier_args=(
        "${agent_kind}"
        "${notification_session}"
        "${notification_ts}"
        "${notification_reason}"
        "${notification_target}"
        "${notification_tool}"
        "${notifier_rev}"
        "${raw_cwd}"
        "${notification_uri}"
        "${notification_terminal}"
        "${notification_relation}"
      )
      if [ "${BEEP_SEQUENCE_BREAK_FOREGROUND:-0}" = "1" ]; then
        # The foreground (diagnostic) worker never lingers to close its card;
        # only a detached worker may outlive the hook.
        BEEP_SEQUENCE_BREAK_CLOSE_WATCH_SECONDS=0 \
          "${notifier_path}" "${notifier_args[@]}" </dev/null >/dev/null 2>&1 || true
      else
        setsid -f -- "${notifier_path}" "${notifier_args[@]}" </dev/null >/dev/null 2>&1 || true
      fi
    fi
  fi
fi

exit 0
