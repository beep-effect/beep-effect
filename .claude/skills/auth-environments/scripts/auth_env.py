#!/usr/bin/env python3
"""Sign Claude Code in to an account on every linked T3 fleet host.

Usage:
  auth_env.py status [HOST ...]
  auth_env.py login --email EMAIL [--force] [HOST ...]

HOST defaults to every host in HOSTS. Each host is reached through its
canonical workstation SSH wrapper with a per-host ControlMaster
(~/.ssh/cm-auth-<host>, 1 h), so each YubiKey host needs one touch per hour.

`login` runs `claude auth login --claudeai` on the host in a PTY. As soon as
the OAuth URL appears it opens the URL in the browser AND the masked KDE code
dialog at the same time (plasma-sensitive-entry pipe helper), while it keeps
draining the remote output. The code goes straight to the remote PTY; remote
output after the code is suppressed. The account is then verified with
`claude auth status`. Only sanitized status is printed.

The OAuth page signs in whichever claude.ai account the browser holds; the
email is only a hint. Verification reports the account actually admitted.
"""
import argparse
import json
import os
import pty
import re
import select
import signal
import subprocess
import sys
import time
from pathlib import Path

BIN = os.path.expanduser("~/.local/bin")
HELPER = str(Path(__file__).resolve().parents[2] / "plasma-sensitive-entry" / "scripts" / "prompt.py")
REMOTE_PATH = "env PATH=$HOME/.local/bin:$HOME/.bun/bin:/usr/local/bin:$PATH"

# label -> (wrapper, needs YubiKey touch, init command run first if its agent is missing)
HOSTS = {
    "grok-bot": ("ssh-grok-bot", False, None),
    "beep-worker": ("ssh-beep-worker-yubi", True, "dankserver-agent"),
    "dankserver": ("ssh-dankserver-worker", True, "dankserver-agent"),
    "tbk-worker": ("ssh-tbk-worker", True, None),
    "tom-pc-1-wsl": ("ssh-tom-pc-1-wsl", True, None),
}

URL_RE = re.compile(r"https://(?:[a-z0-9.-]+\.)?(?:claude\.(?:ai|com)|anthropic\.com)/\S*oauth/authorize\S+")
OK_RE = re.compile(r"[Ll]ogin successful|[Ll]ogged in as|[Ss]uccessfully (?:logged|authenticated|signed)")
BAD_RE = re.compile(r"[Ii]nvalid (?:code|grant)|[Aa]uthentication failed|OAuth error|[Ee]rror:")
PROMPT_RE = re.compile(r"[Pp]aste code")
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\r")


def log(host, msg):
    print(f"[{host}] {msg}", flush=True)


def ssh_argv(host):
    wrapper, _, _ = HOSTS[host]
    cp = os.path.expanduser(f"~/.ssh/cm-auth-{host}")
    return [os.path.join(BIN, wrapper), "-o", "ControlMaster=auto", "-o", "ControlPersist=1h",
            "-o", f"ControlPath={cp}"]


def ensure_agent(host):
    if HOSTS[host][2] == "dankserver-agent" and not os.path.exists(
            os.path.expanduser("~/.ssh/agent-dankserver.sock")):
        subprocess.run([os.path.join(BIN, "ssh-dankserver-yubi"), "-G"], stdin=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)


def gui_env():
    runtime = f"/run/user/{os.geteuid()}"
    env = os.environ | {"XDG_RUNTIME_DIR": runtime,
                        "DBUS_SESSION_BUS_ADDRESS": f"unix:path={runtime}/bus"}
    subprocess.run(["busctl", "--user", "status"], env=env, stdin=subprocess.DEVNULL,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, check=True)
    return env


def open_master(host):
    """Open the per-host master once; its forked process must not hold our pipes."""
    ensure_agent(host)
    cp = os.path.expanduser(f"~/.ssh/cm-auth-{host}")
    if os.path.exists(cp):
        return
    if HOSTS[host][1]:
        log(host, "touch the YubiKey now")
    subprocess.run(ssh_argv(host) + ["-fN"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=120)


def status(host):
    """Return (email or None, loggedIn) using claude auth status."""
    open_master(host)
    try:
        out = subprocess.run(ssh_argv(host) + [f"{REMOTE_PATH} claude auth status"],
                             stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=120).stdout
        data = json.loads(out[out.index("{"):out.rindex("}") + 1])
        return data.get("email"), bool(data.get("loggedIn"))
    except Exception:
        return None, False


class CodeDialog:
    """Masked KDE dialog writing to a private pipe; read the answer without blocking."""

    def __init__(self, title, label, timeout=300):
        self.r, w = os.pipe()
        self.buf = bytearray()
        self.proc = subprocess.Popen(
            [sys.executable, HELPER, "--write-fd", str(w), "--title", title, "--label", label,
             "--timeout", str(timeout)],
            pass_fds=(w,), env=gui_env(), stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.close(w)
        self.eof = False

    def pump(self):
        if not self.eof:
            ready, _, _ = select.select([self.r], [], [], 0)
            if ready:
                chunk = os.read(self.r, 4096)
                if chunk:
                    self.buf += chunk
                    if len(self.buf) > 4096:
                        self.buf[:] = b""
                        self.proc.terminate()
                else:
                    self.eof = True

    def result(self):
        """None while pending; (code|None, rc) when finished."""
        self.pump()
        if not self.eof or self.proc.poll() is None:
            return None
        rc = self.proc.returncode
        code = bytes(self.buf) if rc == 0 and self.buf else None
        self.buf[:] = b""
        if code is not None and any(b < 0x20 or b == 0x7f for b in code):
            code, rc = None, 2
        return code, rc

    def close(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(5)
        try:
            os.close(self.r)
        except OSError:
            pass


def drain(fd, keep):
    ready, _, _ = select.select([fd], [], [], 0.2)
    if not ready:
        return True
    try:
        chunk = os.read(fd, 4096)
    except OSError:
        return False
    if not chunk:
        return False
    keep.append(ANSI.sub("", chunk.decode("utf-8", "replace")))
    return True


def login(host, email):
    open_master(host)
    master, slave = pty.openpty()
    proc = subprocess.Popen(
        ssh_argv(host) + ["-tt", f"{REMOTE_PATH} claude auth login --claudeai --email {email}"],
        stdin=slave, stdout=slave, stderr=slave, start_new_session=True, close_fds=True)
    os.close(slave)
    dialog = None
    try:
        seen, deadline, url = [], time.monotonic() + 120, None
        while time.monotonic() < deadline and not url:
            if not drain(master, seen):
                break
            m = URL_RE.search("".join(seen))
            if m:
                url = m.group(0).rstrip(").,'\"")
        if not url:
            log(host, "no OAuth URL within 120 s")
            return False
        env = gui_env()
        for attempt in range(1, 4):
            # browser and dialog open together
            subprocess.Popen(["xdg-open", url], env=env, stdin=subprocess.DEVNULL,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            dialog = CodeDialog(f"{host}: Claude Code sign-in",
                                f"Paste the authorization code from the browser; it goes only to "
                                f"`claude auth login` on {host}")
            log(host, f"browser + KDE code dialog opened (attempt {attempt})")
            res = None
            while res is None:
                if not drain(master, seen):  # keep the remote PTY drained meanwhile
                    log(host, "remote login exited before the code arrived")
                    return False
                seen[:] = seen[-20:]
                res = dialog.result()
            code, rc = res
            dialog.close()
            dialog = None
            if code is None:
                log(host, {1: "cancelled", 3: "timed out"}.get(rc, "dialog unavailable"))
                return False
            seen.clear()
            os.write(master, code + b"\n")
            del code
            end = time.monotonic() + 120
            verdict = None
            while time.monotonic() < end and verdict is None:
                if not drain(master, seen):
                    verdict = "eof"
                text = "".join(seen)
                if OK_RE.search(text):
                    verdict = "ok"
                elif BAD_RE.search(text) or PROMPT_RE.search(text):
                    verdict = "bad"
            seen.clear()
            if verdict == "ok":
                log(host, "login successful")
                return True
            if verdict == "bad":
                log(host, "code rejected; reopening")
                continue
            log(host, f"no confirmation ({verdict or 'timeout'})")
            return False
        return False
    finally:
        if dialog:
            dialog.close()
        try:
            if proc.poll() is None:
                os.killpg(proc.pid, signal.SIGTERM)
                try:
                    proc.wait(10)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.wait(5)
        except ProcessLookupError:
            pass
        os.close(master)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["status", "login"])
    ap.add_argument("hosts", nargs="*")
    ap.add_argument("--email")
    ap.add_argument("--force", action="store_true", help="log in even if already on --email")
    a = ap.parse_args()
    hosts = a.hosts or list(HOSTS)
    unknown = [h for h in hosts if h not in HOSTS]
    if unknown:
        sys.exit(f"unknown host(s): {', '.join(unknown)}; known: {', '.join(HOSTS)}")
    if a.action == "login" and not a.email:
        sys.exit("login needs --email")
    summary = {}
    for host in hosts:  # serialized: one YubiKey request at a time
        before, ok = status(host)
        log(host, f"currently {before or 'unknown'}{'' if ok else ' (not logged in)'}")
        if a.action == "status":
            summary[host] = before or "unknown"
            continue
        if before == a.email and not a.force:
            summary[host] = f"{before} (unchanged)"
            continue
        login(host, a.email)
        after, _ = status(host)
        mark = "" if after == a.email else f"  <-- expected {a.email}"
        summary[host] = f"{after or 'unknown'}{mark}"
    print("\nsummary:")
    for host, line in summary.items():
        print(f"  {host:14} {line}")


if __name__ == "__main__":
    main()
