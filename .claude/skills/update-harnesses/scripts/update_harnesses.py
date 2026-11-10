#!/usr/bin/env python3
"""Update the agent harnesses on every fleet host.

Usage:
  update_harnesses.py plan   [--host H]... [--harness X]...
  update_harnesses.py status [--host H]... [--harness X]...
  update_harnesses.py update [--host H]... [--harness X]... [--system-upgrade] [--no-junie-migrate]

`plan` prints the host x harness matrix and connects nowhere. `status` is read-only
everywhere (installed versions, install methods, pending desktop packages, sandbox pin
drift). `update` updates what this account can update and runs the few privileged steps
through each host's canonical YubiKey route, one touch at a time.

Remote hosts are reached through their canonical workstation SSH wrapper. Only the main
thread opens connections (a per-host ControlMaster, ~/.ssh/cm-harness-<host>, 2 h), one
touch at a time; worker threads ride the master and fail rather than authenticate. The
host-side work is harness_host.sh, piped over stdin. Every run writes a JSON receipt and
a full log under ~/.local/state/beep/update-harnesses/.
"""
from __future__ import annotations

import argparse
import base64
import dataclasses
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import threading
import urllib.parse
import urllib.request
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
HOST_SCRIPT = SCRIPTS / "harness_host.sh"
HOME = Path.home()
BIN = HOME / ".local/bin"
STATE = HOME / ".local/state/beep/update-harnesses"
CACHE = HOME / ".cache/beep/update-harnesses"
YUBI_SUDO = BIN / "yubi-sudo"


@dataclasses.dataclass(frozen=True)
class Host:
    label: str
    wrapper: str | None  # None: the hub itself, run locally
    touch: bool  # YubiKey touch to open the SSH master
    agent_init: str | None  # dedicated agent to start first when its socket is missing
    admin: tuple[str, ...] | None  # argv of the administrative route, for sudo steps
    admin_agent: str | None = None  # dedicated agent the admin route forwards, started first
    down: str = "SSH master failed (missed touch or host down)"  # note on unreachable rows


# Never put IPs, tailnet names or environment ids here: the repository is public.
# Routes: ../../remote-development-agents/references/hosts.md
HOSTS: dict[str, Host] = {
    "dankstation": Host("dankstation", None, False, None, None),
    "beep-worker": Host("beep-worker", "ssh-beep-worker-yubi", True, "dankserver-agent",
                        ("ssh-beep-worker-yubi", "--admin", "-tt"), admin_agent="dankserver-agent"),
    "dankserver": Host("dankserver", "ssh-dankserver-worker", True, "dankserver-agent", None),
    "tbk-worker": Host("tbk-worker", "ssh-tbk-worker", True, None, None),
    # The wrapper keeps its own dedicated agent (login and --admin forwarding alike).
    "tom-pc-1-wsl": Host("tom-pc-1-wsl", "ssh-tom-pc-1-wsl", True, None,
                         ("ssh-tom-pc-1-wsl", "--admin", "-tt"),
                         down="SSH master failed: missed touch, or the PC is off, its Windows user is "
                              "signed out or the T3AgentWSL keep-alive task is not running"),
    "grok-bot": Host("grok-bot", "ssh-grok-bot", False, None, ("ssh-grok-bot", "--admin", "-tt"),
                     admin_agent="dankserver-agent",
                     down="asleep or unreachable; open its computer view in the Grok Bot app"),
}
HUB = "dankstation"

CLI = ("claude", "codex", "grok", "kimi", "junie", "cursor-agent", "muse")
DESKTOP = ("chatgpt-desktop", "claude-desktop", "cursor-desktop", "kimi-desktop")
HARNESSES = ("t3code",) + CLI + DESKTOP
ONLY_ON = {
    "chatgpt-desktop": ("dankstation", "grok-bot"),
    "claude-desktop": ("dankstation", "grok-bot"),
    "cursor-desktop": ("dankstation",),
    "kimi-desktop": ("dankstation",),
}
ALIASES = {
    "t3": "t3code", "t3-code": "t3code", "claude-code": "claude", "codex-cli": "codex",
    "grok-build": "grok", "grok-cli": "grok", "kimi-code": "kimi", "kimi-cli": "kimi",
    "junie-cli": "junie", "agent": "cursor-agent", "cursor-cli": "cursor-agent",
    "muse-code": "muse", "meta-muse": "muse", "chatgpt": "chatgpt-desktop",
    "cursor": "cursor-desktop", "kimi-app": "kimi-desktop", "claude-app": "claude-desktop",
    "grok-bot-vm": "grok-bot", "hub": "dankstation", "local": "dankstation",
    "tom-pc-1": "tom-pc-1-wsl",
}
PACMAN = {"chatgpt-desktop": "chatgpt-bin", "claude-desktop": "claude-desktop",
          "cursor-desktop": "cursor-bin"}
DEB_NAMES = {"chatgpt-desktop": ("chatgpt",), "claude-desktop": ("claude-desktop", "claude")}
# npm packages whose `latest` tag is what the native self-updaters install too.
NPM_LATEST = {"claude": "@anthropic-ai/claude-code", "codex": "@openai/codex"}
DEBIAN_MIRRORS = {"deb.debian.org", "security.debian.org", "ftp.debian.org"}
DEB_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.+_~%-]*\.deb$")
KIMI_FEED = "https://code.kimi.com/kimi-code/desktop/latest-linux.yml"
KIMI_DIR = HOME / ".local/opt/kimi-code"
KIMI_APPIMAGE = KIMI_DIR / "KimiCode-linux-x86_64.AppImage"
KIMI_INSTALLED = KIMI_DIR / "latest-linux-installed.yml"
T3_OPT = HOME / ".local/opt/t3code"
APPARMOR = "/etc/apparmor.d/beep-cursor-sandbox"
SSH_KEEPALIVE = ["-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=4"]


@dataclasses.dataclass
class Row:
    host: str
    harness: str
    status: str  # updated current pending failed skipped absent unreachable installed
    before: str = "-"
    after: str = "-"
    method: str = "-"
    path: str = "-"
    note: str = ""


# ------------------------------------------------------------------ selection (pure)

def canonical(name: str, known) -> str:
    key = ALIASES.get(name.lower(), name.lower())
    if key not in known:
        raise SystemExit(f"unknown name {name!r}; expected one of {', '.join(known)}")
    return key


def plan(hosts: list[str], harnesses: list[str]) -> dict[str, list[str]]:
    """Harnesses to visit per host, in a fixed order (t3code first, desktop apps last)."""
    return {host: [h for h in HARNESSES if h in harnesses and host in ONLY_ON.get(h, HOSTS)]
            for host in hosts}


# ------------------------------------------------------------------ parsing (pure)

def parse_records(text: str) -> list[list[str]]:
    return [line.rstrip("\r").split("\t") for line in text.splitlines() if line.startswith("@@")]


def rows_from_records(host: str, records: list[list[str]], mode: str) -> tuple[list[Row], dict]:
    """Turn host-agent records into summary rows; also return the APPARMOR record if any.
    NOTE records (read-only config findings) are appended to that harness's rows."""
    results: list[Row] = []
    apparmor: dict = {}
    notes: dict[str, list[str]] = {}
    for rec in records:
        kind = rec[0]
        if kind == "@@INSTALL" and len(rec) >= 7 and mode == "status":
            _, h, active, method, writable, version, path = rec[:7]
            note = {"1": "active", "0": "shadowed", "stale": "under an unused node version"}.get(active, active)
            if writable != "1":
                note += ", not writable by this account"
            results.append(Row(host, h, "installed", version, "-", method, path, note))
        elif kind == "@@RESULT" and len(rec) >= 8:
            results.append(Row(host, rec[1], rec[2], rec[3], rec[4], rec[5], rec[6], rec[7]))
        elif kind == "@@APPARMOR" and len(rec) >= 4:
            apparmor = {"drift": rec[1] == "1", "sdk": rec[2], "cli": rec[3]}
        elif kind == "@@NOTE" and len(rec) >= 3:
            notes.setdefault(rec[1], []).append(rec[2])
    for r in results:  # read-only findings about a harness's config ride on its rows
        r.note = "; ".join(n for n in (r.note, *notes.get(r.harness, ())) if n)
    return results, apparmor


def missing_rows(host: str, requested: list[str], rows: list[Row], why: str) -> list[Row]:
    """A failed row for every requested harness the host agent said nothing about."""
    seen = {r.harness for r in rows}
    return [Row(host, h, "failed", note=why) for h in requested if h not in seen]


def mark_latest(rows: list[Row], latest: dict[str, str]):
    """status mode: compare active CLI installs with the npm `latest` tag where it is meaningful."""
    for r in rows:
        if r.status == "installed" and r.harness in latest and r.note.startswith("active"):
            if latest[r.harness] == r.before:
                r.status = "current"
            elif latest[r.harness] not in ("", "-"):
                r.status, r.after = "pending", latest[r.harness]


def mark_t3_published(rows: list[Row], published: str):
    """status mode: a T3 Code row is current when it runs the build the hub published,
    pending when it runs anything else. Without a readable publish manifest it stays installed."""
    if published in ("", "-"):
        return
    for r in rows:
        if r.harness == "t3code" and r.status == "installed":
            if r.before == published:
                r.status = "current"
            else:
                r.status, r.after = "pending", published


def parse_electron_feed(text: str) -> dict:
    """version / url / sha512 / size of the x86_64 AppImage in an electron-builder feed."""
    version = re.search(r"^version:\s*['\"]?([^'\"\s]+)", text, re.M)
    entry: dict = {}
    for block in re.split(r"^\s*-\s+(?=url:)", text, flags=re.M)[1:]:
        url = re.search(r"url:\s*(\S+)", block)
        if url and url.group(1).endswith(".AppImage"):
            sha = re.search(r"sha512:\s*(\S+)", block)
            size = re.search(r"size:\s*(\d+)", block)
            entry = {"url": url.group(1), "sha512": sha.group(1) if sha else None,
                     "size": int(size.group(1)) if size else None}
            break
    if not version or not entry.get("sha512"):
        raise ValueError("feed has no version or AppImage checksum")
    return {"version": version.group(1), **entry}


def repin_profile(text: str, sdk: str, cli: str) -> str:
    """Point the two version-pinned Cursor sandbox profiles at the current helper paths."""
    out = []
    for line in text.splitlines(keepends=True):
        m = re.match(r"^(\s*profile\s+(beep-cursor-(sdk|cli)-sandbox)\s+)(\S+)(.*)$", line, re.S)
        if m:
            new = sdk if m.group(3) == "sdk" else cli
            if new and new != "-":
                line = m.group(1) + new + m.group(5)
        out.append(line)
    return "".join(out)


def vetted_debs(admin_output: str) -> list[dict]:
    """Debian pool files the box asked for, accepted only from the script's own records
    (after "@@ADMIN start"), only from Debian mirrors, with a plain .deb name and a sha256."""
    started, out = False, []
    for line in admin_output.splitlines():
        if line.startswith("@@ADMIN start"):
            started = True
        elif started and line.startswith("@@URI "):
            parts = line.split()
            if len(parts) != 4:
                continue
            _, url, name, sha = parts
            u = urllib.parse.urlparse(url)
            if (u.scheme in ("http", "https") and u.hostname in DEBIAN_MIRRORS
                    and DEB_NAME.match(name) and re.fullmatch(r"[0-9a-f]{64}", sha)):
                out.append({"url": url, "name": name, "sha256": sha})
    return out


# ------------------------------------------------------------------ run context

class Run:
    def __init__(self, mode: str, args):
        self.mode = mode
        self.args = args
        self.stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        STATE.mkdir(parents=True, exist_ok=True)
        CACHE.mkdir(parents=True, exist_ok=True)
        self.log_path = STATE / f"{self.stamp}-{mode}.log"
        self.log_file = open(self.log_path, "a", buffering=1)
        self.rows: list[Row] = []
        self.lock = threading.Lock()

    def say(self, host: str, msg: str):
        with self.lock:
            print(f"[{host}] {msg}", flush=True)
            self.log_file.write(f"[{host}] {msg}\n")

    def log(self, text: str):
        with self.lock:
            self.log_file.write(text if text.endswith("\n") else text + "\n")

    def add(self, *rows: Row):
        with self.lock:
            self.rows.extend(rows)

    def sh(self, argv, *, timeout=900, input_bytes=None, env=None) -> subprocess.CompletedProcess:
        """Run a command, keep stdout, send stderr to the run log."""
        self.log(f"$ {shlex.join(str(a) for a in argv)[:2000]}")
        try:
            return subprocess.run([str(a) for a in argv], input=input_bytes,
                                  stdin=None if input_bytes is not None else subprocess.DEVNULL,
                                  stdout=subprocess.PIPE, stderr=self.log_file, timeout=timeout,
                                  env=env)
        except subprocess.TimeoutExpired as e:
            self.log(f"timeout after {timeout}s")
            return subprocess.CompletedProcess(argv, 124, e.stdout or b"", b"")


def guarded(run: Run, host: str, harnesses: list[str], fn, *args):
    """Thread body wrapper: an exception becomes failed rows, never a silent gap."""
    try:
        fn(*args)
    except Exception as e:  # noqa: BLE001
        run.say(host, f"internal error: {e!r}")
        run.add(*(Row(host, h, "failed", note=f"internal error: {e!r}") for h in harnesses))


# ------------------------------------------------------------------ SSH

def control_path(host: str) -> Path:
    return HOME / f".ssh/cm-harness-{host}"


def mux_argv(host: str) -> list[str]:
    """Ride the existing master only. With no master the bogus host name fails to resolve,
    so a worker thread can never start an authentication (and a YubiKey touch) on its own."""
    return ["ssh", "-F", "/dev/null", "-o", f"ControlPath={control_path(host)}", "-o", "ControlMaster=no",
            "-o", "BatchMode=yes", *SSH_KEEPALIVE, f"harness-{host}.invalid"]


def master_alive(host: str) -> bool:
    cp = control_path(host)
    return cp.exists() and subprocess.run(
        ["ssh", "-F", "/dev/null", "-o", f"ControlPath={cp}", "-O", "check", "harness.invalid"],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def ensure_dankserver_agent(run: Run):
    if not (HOME / ".ssh/agent-dankserver.sock").exists():
        run.sh([BIN / "ssh-dankserver-yubi", "-G"], timeout=60)


def open_master(run: Run, host: str) -> bool:
    """Main thread only. Up to three touch attempts per open; never two opens at once."""
    if master_alive(host):
        return True
    if HOSTS[host].agent_init == "dankserver-agent":
        ensure_dankserver_agent(run)
    argv = [BIN / HOSTS[host].wrapper, "-o", "ControlMaster=yes", "-o", "ControlPersist=2h",
            "-o", f"ControlPath={control_path(host)}", "-o", "ConnectTimeout=25", *SSH_KEEPALIVE, "-fN"]
    for attempt in range(1, 4):
        if HOSTS[host].touch:
            run.say(host, f"touch the YubiKey now (SSH, attempt {attempt}/3)")
        run.sh(argv, timeout=120)
        if master_alive(host):
            return True
        if not HOSTS[host].touch:
            break  # no touch involved: unreachable, not a missed touch
    return False


def host_agent(run: Run, host: str, mode: str, harnesses: list[str]) -> tuple[list[list[str]], int]:
    if HOSTS[host].wrapper is None:
        env = os.environ | ({"HARNESS_JUNIE_MIGRATE": "0"} if run.args.no_junie_migrate else {})
        res = run.sh(["bash", HOST_SCRIPT, mode, *harnesses], timeout=7200, env=env)
    else:
        env_prefix = "HARNESS_JUNIE_MIGRATE=0 " if run.args.no_junie_migrate else ""
        cmd = env_prefix + "bash -s -- " + shlex.join([mode, *harnesses])
        res = run.sh(mux_argv(host) + [cmd], timeout=7200, input_bytes=HOST_SCRIPT.read_bytes())
    out = res.stdout.decode(errors="replace")
    run.log(out)
    if res.returncode:
        run.say(host, f"host agent exited {res.returncode}; see {run.log_path}")
    return parse_records(out), res.returncode


def admin_run(run: Run, host: str, script: str, args: list[str]) -> tuple[int, str]:
    """Main thread only. A sudo script over the host's admin route (its own SSH login).
    sudo authenticates only through the forwarded YubiKey agent: askpass /bin/false refuses
    a password fallback. The SSH login is retried only if the script never started."""
    if HOSTS[host].admin_agent == "dankserver-agent":
        ensure_dankserver_agent(run)
    cmd = shlex.join(["bash", "-c", ADMIN_PRELUDE + script, "admin", *args])
    out = ""
    for attempt in range(1, 4):
        run.say(host, f"admin route: touch the YubiKey for SSH, then for sudo (attempt {attempt}/3)")
        res = run.sh([BIN / HOSTS[host].admin[0], *HOSTS[host].admin[1:], *SSH_KEEPALIVE, cmd], timeout=3600)
        out = res.stdout.decode(errors="replace").replace("\r", "")
        run.log(out)
        if "@@ADMIN start" in out or res.returncode not in (255, 124):
            return res.returncode, out
    return 255, out


ADMIN_PRELUDE = r"""set -uo pipefail
ok=0
for i in 1 2 3; do
  echo "sudo attempt $i/3: touch the YubiKey" >&2
  if SUDO_ASKPASS=/bin/false timeout 60 sudo -A -v; then ok=1; break; fi
done
((ok)) || { echo "@@ADMIN auth-failed"; exit 77; }
( while sleep 45; do sudo -n -v 2>/dev/null || exit 0; done ) & keep=$!
trap 'kill $keep 2>/dev/null' EXIT
echo "@@ADMIN start"
"""

APPARMOR_FIX = r"""b64=$1; dir=/var/backups/beep-apparmor; ts=$(date +%Y%m%dT%H%M%S); prof=/etc/apparmor.d/beep-cursor-sandbox
sudo -n install -d -m 700 "$dir" || exit 1
sudo -n cp -a "$prof" "$dir/beep-cursor-sandbox.$ts" || exit 1
printf '%s' "$b64" | base64 -d | sudo -n tee "$dir/beep-cursor-sandbox.new" >/dev/null || exit 1
sudo -n apparmor_parser -Q -K "$dir/beep-cursor-sandbox.new" || { echo "@@ADMIN parse-failed"; exit 1; }
sudo -n install -m 644 -o root -g root "$dir/beep-cursor-sandbox.new" "$prof" || exit 1
if ! sudo -n apparmor_parser -r "$prof"; then
  sudo -n install -m 644 -o root -g root "$dir/beep-cursor-sandbox.$ts" "$prof" && sudo -n apparmor_parser -r "$prof"
  echo "@@ADMIN reload-failed-restored"; exit 1
fi
echo "@@ADMIN ok backup=$dir/beep-cursor-sandbox.$ts"
"""

# args: <stamp> <name=sha256>... -- <package>...   (stamp "-" = no pushed files)
APT_UPGRADE = r"""shopt -s nullglob
stamp=$1; shift; files=()
while (($#)) && [[ $1 != -- ]]; do files+=("$1"); shift; done; shift
for f in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
  grep -qiE 'anthropic|claude|openai|oaistatic|chatgpt' "$f" || continue
  sudo -n apt-get update -o "Dir::Etc::sourcelist=$f" -o Dir::Etc::sourceparts=- \
    -o APT::Get::List-Cleanup=0 >&2 || echo "@@ADMIN list-update-failed $f"
done
if ((${#files[@]})); then
  # Root-owned staging; every file re-verified as root; install exactly these names.
  src="$HOME/.cache/beep-debs/$stamp"; dst="/var/cache/beep-debs/$stamp"; debs=()
  sudo -n install -d -m 700 "$dst" || exit 1
  for pair in "${files[@]}"; do
    name=${pair%%=*}; sha=${pair#*=}
    sudo -n install -m 644 -o root -g root "$src/$name" "$dst/$name" || exit 1
    printf '%s  %s\n' "$sha" "$dst/$name" | sudo -n sha256sum -c --quiet || { echo "@@ADMIN hash-mismatch $name"; exit 1; }
    debs+=("$dst/$name")
  done
  sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y "${debs[@]}" >&2 || echo "@@ADMIN pushed-debs-failed"
  rm -rf "$src"
fi
if sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade "$@" >&2; then
  echo "@@ADMIN apt-ok"
else
  echo "@@ADMIN apt-failed"
  sudo -n apt-get install -y --only-upgrade --print-uris -qq "$@" 2>/dev/null \
    | sed -n "s/^'\([^']*\)' \([^ ]*\) [0-9]* SHA256:\([0-9a-f]*\).*/@@URI \1 \2 \3/p"
fi
"""


# ------------------------------------------------------------------ hub-only harnesses

def read_text(path: Path) -> str:
    try:
        return path.read_text().strip()
    except OSError:
        return "-"


def published_t3() -> str:
    try:
        return json.loads((T3_OPT / "publish/latest.json").read_text())["version"]
    except (OSError, ValueError, KeyError):
        return "-"


def hub_t3(run: Run):
    before = read_text(T3_OPT / "source-version")
    if run.mode == "status":
        row = Row(HUB, "t3code", "installed", before, "-", "fork-sync", str(T3_OPT))
        mark_t3_published([row], published_t3())
        run.add(row)
        return
    run.say(HUB, "t3code: fork sync + build + publish (can take up to 90 min)")
    res = run.sh(["systemctl", "--user", "start", "t3code-source-update.service"], timeout=95 * 60)
    after = read_text(T3_OPT / "source-version")
    if res.returncode == 124:
        status, note = "pending", "sync still running; workers pull it within 30 min"
    elif res.returncode:
        status, note = "failed", "see ~/.local/state/t3code-sync/"
    elif after != before:
        status, note = "updated", "restart prompt posted if the app is open"
    else:
        status, note = "current", ""
    run.add(Row(HUB, "t3code", status, before, after, "fork-sync", str(T3_OPT), note))


def kimi_desktop(run: Run):
    installed = "-"
    if KIMI_INSTALLED.exists():
        m = re.search(r"^version:\s*(\S+)", KIMI_INSTALLED.read_text(), re.M)
        installed = m.group(1) if m else "-"
    if not KIMI_APPIMAGE.exists():
        run.add(Row(HUB, "kimi-desktop", "absent", note=f"no {KIMI_APPIMAGE}"))
        return
    try:
        feed_text = urllib.request.urlopen(KIMI_FEED, timeout=30).read().decode()
        feed = parse_electron_feed(feed_text)
    except Exception as e:  # noqa: BLE001 - network/feed errors are reported, not raised
        run.add(Row(HUB, "kimi-desktop", "failed", installed, note=f"feed: {e}"))
        return
    row = Row(HUB, "kimi-desktop", "current", installed, feed["version"], "appimage-feed", str(KIMI_APPIMAGE))
    if feed["version"] == installed:
        run.add(row)
        return
    if run.mode == "status":
        row.status = "pending"
        run.add(row)
        return
    url = urllib.parse.urljoin(KIMI_FEED, feed["url"])
    part = KIMI_DIR / f".KimiCode-{feed['version']}.AppImage.part"
    digest = hashlib.sha512()
    try:
        with urllib.request.urlopen(url, timeout=60) as src, open(part, "wb") as dst:
            while chunk := src.read(1 << 20):
                digest.update(chunk)
                dst.write(chunk)
        if base64.b64encode(digest.digest()).decode() != feed["sha512"] or \
                (feed["size"] and part.stat().st_size != feed["size"]):
            raise ValueError("checksum or size mismatch")
        part.chmod(0o755)
        os.replace(KIMI_APPIMAGE, KIMI_DIR / "KimiCode-linux-x86_64.AppImage.prev")
        os.replace(part, KIMI_APPIMAGE)
        KIMI_INSTALLED.write_text(feed_text)
    except Exception as e:  # noqa: BLE001
        part.unlink(missing_ok=True)
        run.add(Row(HUB, "kimi-desktop", "failed", installed, note=str(e)))
        return
    row.status = "updated"
    row.note = "restart Kimi Code to load it" if process_running(str(KIMI_APPIMAGE)) else ""
    run.add(row)


def process_running(needle: str) -> bool:
    for proc in Path("/proc").iterdir():
        if proc.name.isdigit():
            try:
                if needle in (proc / "cmdline").read_bytes().replace(b"\0", b" ").decode(errors="replace"):
                    return True
            except OSError:
                continue
    return False


def pacman_query(run: Run, pkgs) -> dict[str, str]:
    out = {}
    for line in run.sh(["pacman", "-Q", *pkgs], timeout=60).stdout.decode().splitlines():
        name, _, ver = line.partition(" ")
        out[name] = ver
    return out


def pacman_desktop(run: Run, harnesses: list[str]):
    """chatgpt-bin, claude-desktop, cursor-bin from the hub's pacman repos.

    Arch supports only whole-system upgrades, so a pending desktop package is installed
    only through `pacman -Syu`, and only when the operator passed --system-upgrade."""
    pkgs = {PACMAN[h]: h for h in harnesses if h in PACMAN}
    if not pkgs:
        return
    installed = pacman_query(run, pkgs)
    db = CACHE / "checkup-db"
    db.mkdir(parents=True, exist_ok=True)
    cu = run.sh(["checkupdates"], timeout=300, env=os.environ | {"CHECKUPDATES_DB": str(db)})
    if cu.returncode not in (0, 2):
        run.add(*(Row(HUB, h, "failed", installed.get(p, "-"), note="checkupdates failed") for p, h in pkgs.items()))
        return
    pending = {}
    for line in cu.stdout.decode().splitlines():
        m = re.match(r"^(\S+)\s+\S+\s+->\s+(\S+)", line)
        if m and m.group(1) in pkgs:
            pending[m.group(1)] = m.group(2)
    targets = [p for p in pending if p in installed]
    for pkg, h in pkgs.items():
        if pkg not in installed:
            run.add(Row(HUB, h, "absent", note=f"{pkg} not installed"))
        elif pkg not in pending:
            run.add(Row(HUB, h, "current", installed[pkg], installed[pkg], "pacman", pkg))
        elif run.mode == "status" or not run.args.system_upgrade:
            note = "" if run.mode == "status" else "Arch updates whole systems only: rerun with --system-upgrade (pacman -Syu)"
            run.add(Row(HUB, h, "pending", installed[pkg], pending[pkg], "pacman", pkg, note))
    if run.mode == "status" or not targets or not run.args.system_upgrade:
        return
    # sudo tickets are tty-scoped: authenticate and upgrade inside one PTY. Each attempt
    # gets 60 s; a fall-through to a password prompt is killed with it, never answered.
    runner = (f"ok=0; for i in 1 2 3; do echo \"sudo attempt $i/3\"; "
              f"timeout 60 {shlex.quote(str(YUBI_SUDO))} -v && {{ ok=1; break; }}; done; "
              f"[ $ok = 1 ] || exit 77; sudo -n pacman -Syu --noconfirm")
    run.say(HUB, f"pacman -Syu (pending: {' '.join(targets)}): touch the YubiKey now")
    # No timeout: killing pacman mid-transaction is worse than waiting for it.
    res = subprocess.run(["script", "-qec", runner, "/dev/null"], stdin=subprocess.DEVNULL,
                         stdout=run.log_file, stderr=run.log_file)
    after = pacman_query(run, targets)
    for p in targets:
        if res.returncode == 77:
            st, note = "failed", "YubiKey authentication failed three times"
        elif res.returncode:
            st, note = "failed", f"pacman exit {res.returncode}; check the system before retrying"
        else:
            st, note = ("updated" if after.get(p) != installed[p] else "current"), ""
        if st == "updated" and process_running(f"/usr/lib/{p.removesuffix('-bin')}"):
            note = "restart the app to load it"
        run.add(Row(HUB, pkgs[p], st, installed[p], after.get(p, "-"), "pacman", p, note))


# ------------------------------------------------------------------ grok-bot desktop debs

def dpkg_versions(run: Run, host: str, names: list[str]) -> dict[str, str] | None:
    fmt = "'${Package}\t${Version}\t${db:Status-Abbrev}\\n'"  # literal tabs; dpkg expands \n
    res = run.sh(mux_argv(host) + [f"dpkg-query -W -f {fmt} {shlex.join(names)} 2>/dev/null; true"], timeout=60)
    if res.returncode:
        return None
    out = {}
    for line in res.stdout.decode().splitlines():
        parts = line.split("\t")
        if len(parts) == 3 and parts[2].startswith("ii"):
            out[parts[0]] = parts[1]
    return out


def grok_bot_debs(run: Run, harnesses: list[str]):
    host = "grok-bot"
    wanted = [h for h in harnesses if h in DEB_NAMES]
    if not wanted:
        return
    present = dpkg_versions(run, host, sorted({n for h in wanted for n in DEB_NAMES[h]}))
    if present is None:
        run.add(*(Row(host, h, "unreachable", note="dpkg query failed (asleep?)") for h in wanted))
        return
    by_harness = {h: next((n for n in DEB_NAMES[h] if n in present), None) for h in wanted}
    for h, pkg in by_harness.items():
        if not pkg:
            run.add(Row(host, h, "absent", note="no Debian package installed"))
        elif run.mode == "status":
            run.add(Row(host, h, "installed", present[pkg], "-", "apt", pkg))
    pkgs = [p for p in by_harness.values() if p]
    if run.mode == "status" or not pkgs:
        return
    rc, out = admin_run(run, host, APT_UPGRADE, ["-", "--", *pkgs])
    if "@@ADMIN apt-failed" in out and (debs := vetted_debs(out)):
        # The box's egress proxy refuses Debian pool files: fetch them here, verify, push.
        run.say(host, f"apt needs {len(debs)} Debian pool file(s) the box cannot fetch; pushing from the hub")
        if push_debs(run, host, debs):
            rc, out = admin_run(run, host, APT_UPGRADE,
                                [run.stamp, *(f"{d['name']}={d['sha256']}" for d in debs), "--", *pkgs])
    after = dpkg_versions(run, host, pkgs) or {}
    ok = "@@ADMIN apt-ok" in out
    for h, pkg in by_harness.items():
        if not pkg:
            continue
        if ok:
            st = "updated" if after.get(pkg) != present[pkg] else "current"
            run.add(Row(host, h, st, present[pkg], after.get(pkg, "-"), "apt", pkg))
        else:
            note = "YubiKey authentication failed" if rc == 77 else "apt failed; see log (runbook: grok-bot section)"
            run.add(Row(host, h, "failed", present[pkg], after.get(pkg, "-"), "apt", pkg, note))


def push_debs(run: Run, host: str, debs: list[dict]) -> bool:
    stage = CACHE / f"grok-bot-debs-{run.stamp}"
    stage.mkdir(parents=True, exist_ok=True)
    try:
        for d in debs:
            with urllib.request.urlopen(d["url"], timeout=120) as src:
                data = src.read()
            if hashlib.sha256(data).hexdigest() != d["sha256"]:
                raise ValueError(f"sha256 mismatch for {d['name']}")
            (stage / d["name"]).write_bytes(data)
        tar = subprocess.run(["tar", "-C", str(stage), "-cf", "-", *(d["name"] for d in debs)],
                             stdout=subprocess.PIPE, check=True).stdout
        remote = f'd="$HOME/.cache/beep-debs/{run.stamp}" && mkdir -p "$d" && tar -C "$d" -xf -'
        return run.sh(mux_argv(host) + [remote], input_bytes=tar, timeout=1800).returncode == 0
    except Exception as e:  # noqa: BLE001
        run.say(host, f"deb push failed: {e}")
        return False


# ------------------------------------------------------------------ Cursor sandbox pins

def apparmor_fix(run: Run, host: str, rec: dict):
    if not rec or not rec.get("drift"):
        return
    row = Row(host, "cursor-sandbox", "pending", method="apparmor", path=APPARMOR)
    if run.mode == "status":
        row.note = "profile pins stale helper paths; update repins it"
        run.add(row)
        return
    if not HOSTS[host].admin:
        row.status, row.note = "skipped", "pins drifted; this host has no admin route here"
        run.add(row)
        return
    current = run.sh(mux_argv(host) + [f"cat {APPARMOR}"], timeout=60).stdout.decode()
    new = repin_profile(current, rec["sdk"], rec["cli"])
    if not current or new == current:
        row.status, row.note = "skipped", "could not compute new pins (helper missing?)"
        run.add(row)
        return
    rc, out = admin_run(run, host, APPARMOR_FIX, [base64.b64encode(new.encode()).decode()])
    check = run.sh(mux_argv(host) + ["env PATH=$HOME/.local/bin:$PATH timeout 60 cursor-agent sandbox run echo ok"],
                   timeout=90).stdout.decode()
    ok = "@@ADMIN ok" in out and check.strip().endswith("ok")
    row.status = "updated" if ok else "failed"
    row.note = ("repinned; restart T3 on the host when idle if Cursor turns still fail preflight" if ok
                else "YubiKey authentication failed" if rc == 77 else "repin or sandbox check failed; see log")
    run.add(row)


# ------------------------------------------------------------------ orchestration

def agent_phase(run: Run, host: str, harnesses: list[str], apparmor: dict):
    recs, rc = host_agent(run, host, run.mode, harnesses)
    rows, aa = rows_from_records(host, recs, run.mode)
    if host != HUB and "t3code" in harnesses and run.mode == "status":
        mark_t3_published(rows, published_t3())
    rows += missing_rows(host, harnesses, rows, f"host agent exit {rc}; no record (see log)")
    run.add(*rows)
    if aa:
        apparmor[host] = aa
    for r in rows:
        if r.status in ("updated", "failed"):
            run.say(host, f"{r.harness}: {r.status} {r.before} -> {r.after} {r.note}".rstrip())


def execute(run: Run, matrix: dict[str, list[str]]):
    apparmor: dict[str, dict] = {}
    threads: list[threading.Thread] = []

    def spawn(host, harnesses, fn, *a) -> threading.Thread:
        t = threading.Thread(target=guarded, args=(run, host, harnesses, fn, *a), daemon=True)
        t.start()
        threads.append(t)
        return t

    def join_all():
        for t in threads:
            t.join()
        threads.clear()

    hub = matrix.get(HUB, [])
    hub_t3_thread = spawn(HUB, ["t3code"], hub_t3, run) if "t3code" in hub else None
    if hub_t3_thread:
        threads.remove(hub_t3_thread)  # joined on its own, before the worker pulls
    if local := [h for h in hub if h in CLI]:
        spawn(HUB, local, agent_phase, run, HUB, local, apparmor)
    if "kimi-desktop" in hub:
        spawn(HUB, ["kimi-desktop"], kimi_desktop, run)
    # Touch-gated steps run on this thread only, one at a time.
    guarded(run, HUB, [h for h in hub if h in PACMAN], pacman_desktop, run, hub)

    remote = [h for h in matrix if h != HUB]
    reachable = []
    for host in remote:
        if open_master(run, host):
            reachable.append(host)
        else:
            run.add(*(Row(host, h, "unreachable", note=HOSTS[host].down) for h in matrix[host]))
    for host in reachable:
        if cli := [h for h in matrix[host] if h in CLI]:
            spawn(host, cli, agent_phase, run, host, cli, apparmor)
    join_all()

    # T3: workers pull only after the hub published (update mode). Masters may have aged
    # out during a long hub build; re-open them here, serially, before any thread uses them.
    if hub_t3_thread:
        hub_t3_thread.join()
    for host in reachable:
        if "t3code" in matrix[host]:
            if not open_master(run, host):
                run.add(Row(host, "t3code", "unreachable", note="SSH master lost during the hub build"))
                continue
            if run.mode == "update":
                run.say(host, "t3code: pulling the published fork build (restarts the host's T3 if it changes)")
            spawn(host, ["t3code"], agent_phase, run, host, ["t3code"], apparmor)
    join_all()

    # Admin routes last, serialized: each one is its own SSH login and sudo touch.
    for host, rec in apparmor.items():
        if {"cursor-agent", "t3code"} & set(matrix.get(host, [])):  # pins only move with these two
            if open_master(run, host):
                guarded(run, host, ["cursor-sandbox"], apparmor_fix, run, host, rec)
    if "grok-bot" in reachable:
        wanted = [h for h in matrix["grok-bot"] if h in DEB_NAMES]
        if wanted and open_master(run, "grok-bot"):
            guarded(run, "grok-bot", wanted, grok_bot_debs, run, matrix["grok-bot"])
        elif wanted:
            run.add(*(Row("grok-bot", h, "unreachable", note="went to sleep during the run") for h in wanted))

    if run.mode == "status":
        mark_latest(run.rows, npm_latest(run))


def npm_latest(run: Run) -> dict[str, str]:
    out = {}
    for harness, pkg in NPM_LATEST.items():
        res = run.sh(["npm", "view", pkg, "version"], timeout=60)
        out[harness] = res.stdout.decode().strip() if res.returncode == 0 else "-"
    return out


STATUS_ORDER = {"failed": 0, "unreachable": 1, "skipped": 2, "pending": 3, "updated": 4,
                "installed": 5, "current": 6, "absent": 7}


def render(rows: list[Row]) -> str:
    rows = sorted(rows, key=lambda r: (list(HOSTS).index(r.host) if r.host in HOSTS else 99,
                                       HARNESSES.index(r.harness) if r.harness in HARNESSES else 99,
                                       STATUS_ORDER.get(r.status, 9)))
    head = ("host", "harness", "status", "version", "method", "note")
    table = [head] + [(r.host, r.harness, r.status,
                       r.before if r.after in ("-", r.before) else f"{r.before} -> {r.after}",
                       r.method, (r.note + ("" if r.path in ("-", "") else f" [{r.path}]")).strip())
                      for r in rows]
    widths = [max(len(row[i]) for row in table) for i in range(5)]
    return "\n".join("  ".join(c.ljust(widths[i]) for i, c in enumerate(row[:5])) + "  " + row[5]
                     for row in table)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("mode", choices=("plan", "status", "update"))
    p.add_argument("--host", action="append", default=[], help="limit to these hosts (repeatable)")
    p.add_argument("--harness", action="append", default=[], help="limit to these harnesses (repeatable)")
    p.add_argument("--system-upgrade", action="store_true",
                   help="on the hub, install pending desktop packages through a full pacman -Syu")
    p.add_argument("--no-junie-migrate", action="store_true",
                   help="leave frozen npm/legacy Junie installs in place instead of moving them to the managed launcher")
    args = p.parse_args(argv)
    hosts = [canonical(h, HOSTS) for h in args.host] or list(HOSTS)
    harnesses = [canonical(h, HARNESSES) for h in args.harness] or list(HARNESSES)
    matrix = {h: hs for h, hs in plan(hosts, harnesses).items() if hs}

    if args.mode == "plan":
        for host, hs in matrix.items():
            print(f"{host:12} {' '.join(hs)}")
        return 0

    STATE.mkdir(parents=True, exist_ok=True)
    lock = open(STATE / "run.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("another update-harnesses run holds the lock; not starting a second one", file=sys.stderr)
        return 75
    run = Run(args.mode, args)
    touch_hosts = [h for h in matrix if HOSTS[h].touch and not master_alive(h)]
    if touch_hosts:
        print(f"YubiKey touches ahead, one at a time: SSH to {', '.join(touch_hosts)}", flush=True)
    execute(run, matrix)
    print()
    print(render(run.rows))
    receipt = STATE / f"{run.stamp}-{args.mode}.json"
    receipt.write_text(json.dumps({"mode": args.mode, "stamp": run.stamp, "matrix": matrix,
                                   "rows": [dataclasses.asdict(r) for r in run.rows]}, indent=2))
    print(f"\nreceipt: {receipt}\nlog: {run.log_path}")
    return 1 if any(r.status in ("failed", "unreachable") for r in run.rows) else 0


if __name__ == "__main__":
    sys.exit(main())
