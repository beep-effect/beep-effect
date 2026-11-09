"""Unit tests for update_harnesses.py and the harness_host.sh classifier.

PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover \
  -s .claude/skills/update-harnesses/scripts -p 'test_*.py'
"""
import os
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import update_harnesses as uh  # noqa: E402

HOST_SCRIPT = Path(__file__).resolve().parent / "harness_host.sh"


class Selection(unittest.TestCase):
    def test_desktop_apps_only_on_their_hosts(self):
        m = uh.plan(list(uh.HOSTS), list(uh.HARNESSES))
        self.assertIn("kimi-desktop", m["dankstation"])
        self.assertIn("cursor-desktop", m["dankstation"])
        self.assertIn("chatgpt-desktop", m["grok-bot"])
        self.assertIn("claude-desktop", m["grok-bot"])
        self.assertNotIn("cursor-desktop", m["grok-bot"])
        for host in ("beep-worker", "dankserver", "tbk-worker"):
            self.assertFalse(set(uh.DESKTOP) & set(m[host]), host)
            self.assertEqual(m[host], ["t3code", *uh.CLI])

    def test_aliases(self):
        self.assertEqual(uh.canonical("ChatGPT", uh.HARNESSES), "chatgpt-desktop")
        self.assertEqual(uh.canonical("claude-code", uh.HARNESSES), "claude")
        self.assertEqual(uh.canonical("grok-bot-vm", uh.HOSTS), "grok-bot")
        with self.assertRaises(SystemExit):
            uh.canonical("vscode", uh.HARNESSES)

    def test_filter_keeps_order(self):
        m = uh.plan(["beep-worker"], ["muse", "t3code", "codex"])
        self.assertEqual(m["beep-worker"], ["t3code", "codex", "muse"])
        self.assertEqual(uh.plan(["tbk-worker"], ["kimi-desktop"]), {"tbk-worker": []})

    def test_hosts_carry_no_addresses(self):
        for host in uh.HOSTS.values():
            for part in (host.wrapper or "", *(host.admin or ())):
                self.assertNotRegex(part, r"\d+\.\d+\.\d+\.\d+|\.ts\.net|tail[0-9a-f]{6}")


class Parsing(unittest.TestCase):
    def test_records_and_rows(self):
        out = "\n".join([
            "noise",
            "@@HOST\tbox\tworker\tUbuntu\t1",
            "@@INSTALL\tcodex\t1\tnpm\t1\t0.167.0\t/h/.nvm/bin/codex",
            "@@INSTALL\tcodex\t0\tnpm\t0\t0.117.0\t/usr/local/bin/codex\r",
            "@@RESULT\tkimi\tabsent\t-\t-\t-\t-\tnot installed",
            "@@APPARMOR\t1\t/sdk\t/cli",
        ])
        recs = uh.parse_records(out)
        self.assertEqual(len(recs), 5)
        rows, aa = uh.rows_from_records("dankserver", recs, "status")
        self.assertEqual(aa, {"drift": True, "sdk": "/sdk", "cli": "/cli"})
        codex = [r for r in rows if r.harness == "codex"]
        self.assertEqual(len(codex), 2)
        self.assertIn("not writable", codex[1].note)
        self.assertTrue(any(r.status == "absent" for r in rows))

    def test_update_mode_uses_results_only(self):
        recs = uh.parse_records("@@INSTALL\tclaude\t1\tnative\t1\t2.1.1\t/p\n"
                                "@@RESULT\tclaude\tupdated\t2.1.1\t2.1.2\tnative\t/p\t\n")
        rows, _ = uh.rows_from_records("beep-worker", recs, "update")
        self.assertEqual([(r.status, r.before, r.after) for r in rows], [("updated", "2.1.1", "2.1.2")])

    def test_electron_feed(self):
        feed = textwrap.dedent("""\
            version: 1.3.2
            files:
              - url: binaries/1.3.2/KimiCode-1.3.2-linux-amd64.deb
                sha512: DEB==
                size: 11
              - url: binaries/1.3.2/KimiCode-1.3.2-linux-x86_64.AppImage
                sha512: APP==
                size: 22
                blockMapSize: 3
            path: binaries/1.3.2/KimiCode-1.3.2-linux-x86_64.AppImage
            """)
        f = uh.parse_electron_feed(feed)
        self.assertEqual(f, {"version": "1.3.2", "url": "binaries/1.3.2/KimiCode-1.3.2-linux-x86_64.AppImage",
                             "sha512": "APP==", "size": 22})
        with self.assertRaises(ValueError):
            uh.parse_electron_feed("version: 1\nfiles: []\n")

    def test_missing_rows_cover_silent_failures(self):
        rows = [uh.Row("tbk-worker", "codex", "updated")]
        miss = uh.missing_rows("tbk-worker", ["codex", "grok", "muse"], rows, "host agent exit 255")
        self.assertEqual([(r.harness, r.status) for r in miss], [("grok", "failed"), ("muse", "failed")])

    def test_mark_latest_only_touches_active_rows(self):
        rows = [uh.Row("h", "claude", "installed", "2.1.319", note="active"),
                uh.Row("h", "claude", "installed", "2.1.100", note="shadowed"),
                uh.Row("h", "codex", "installed", "0.167.0", note="active"),
                uh.Row("h", "grok", "installed", "1.0.1", note="active")]
        uh.mark_latest(rows, {"claude": "2.1.321", "codex": "0.167.0"})
        self.assertEqual([(r.status, r.after) for r in rows],
                         [("pending", "2.1.321"), ("installed", "-"), ("current", "-"), ("installed", "-")])

    def test_mark_t3_published(self):
        rows = [uh.Row("dankstation", "t3code", "installed", "0.1.7-fork.2"),
                uh.Row("dankserver", "t3code", "installed", "0.1.7-fork.1"),
                uh.Row("dankserver", "codex", "installed", "0.1.7-fork.1")]
        uh.mark_t3_published(rows, "0.1.7-fork.2")
        self.assertEqual([(r.status, r.after) for r in rows],
                         [("current", "-"), ("pending", "0.1.7-fork.2"), ("installed", "-")])
        stay = [uh.Row("tbk-worker", "t3code", "installed", "0.1.7-fork.1")]
        uh.mark_t3_published(stay, "-")
        self.assertEqual(stay[0].status, "installed")

    def test_vetted_debs_rejects_untrusted_records(self):
        sha = "a" * 64
        out = "\n".join([
            f"@@URI http://deb.debian.org/debian/pool/main/x/x_1_amd64.deb x_1_amd64.deb {sha}",  # before start
            "@@ADMIN start",
            f"@@URI http://deb.debian.org/debian/pool/main/g/gtk_1_amd64.deb gtk_1_amd64.deb {sha}",
            f"@@URI file:///etc/shadow shadow.deb {sha}",
            f"@@URI https://evil.example/pool/a.deb a.deb {sha}",
            f"@@URI http://deb.debian.org/debian/pool/main/x/x.deb ../x.deb {sha}",
            "@@URI http://deb.debian.org/debian/pool/main/x/y.deb y.deb nothex",
        ])
        self.assertEqual(uh.vetted_debs(out), [{"url": "http://deb.debian.org/debian/pool/main/g/gtk_1_amd64.deb",
                                                "name": "gtk_1_amd64.deb", "sha256": sha}])

    def test_mux_argv_cannot_authenticate(self):
        argv = uh.mux_argv("dankserver")
        self.assertIn("ControlMaster=no", argv)
        self.assertTrue(argv[-1].endswith(".invalid"))
        self.assertNotIn(uh.HOSTS["dankserver"].wrapper, " ".join(argv))

    def test_repin_profile(self):
        prof = textwrap.dedent("""\
            abi <abi/4.0>,
            profile beep-cursor-sdk-sandbox /h/.t3/runtime/versions/OLD/x/cursorsandbox flags=(unconfined) {
              userns,
            }
            profile beep-cursor-cli-sandbox /h/.local/share/cursor-agent/versions/OLD/cursorsandbox flags=(unconfined) {
              userns,
            }
            """)
        new = uh.repin_profile(prof, "/h/.t3/runtime/versions/NEW/x/cursorsandbox", "-")
        self.assertIn("profile beep-cursor-sdk-sandbox /h/.t3/runtime/versions/NEW/x/cursorsandbox flags=(unconfined) {", new)
        self.assertIn("cursor-agent/versions/OLD/cursorsandbox", new)  # "-" keeps the old pin
        self.assertEqual(new.count("\n"), prof.count("\n"))

    def test_render_marks_transitions(self):
        out = uh.render([uh.Row("tbk-worker", "grok", "updated", "1.0.77", "1.0.80", "native", "/g"),
                         uh.Row("dankstation", "claude", "current", "2.1.321", "2.1.321", "native")])
        lines = out.splitlines()
        self.assertTrue(lines[1].startswith("dankstation"))
        self.assertIn("1.0.77 -> 1.0.80", out)


def _exe(path: Path, body: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body)
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


class HostAgent(unittest.TestCase):
    """Run harness_host.sh against a fake HOME so classification is tested for real."""

    def run_agent(self, home: Path, *args, env_extra=None):
        env = {"HOME": str(home), "PATH": "/usr/bin:/bin", "LANG": "C"} | (env_extra or {})
        res = subprocess.run(["bash", str(HOST_SCRIPT), *args], env=env, capture_output=True,
                             text=True, timeout=120)
        return uh.parse_records(res.stdout), res

    def test_classifies_and_updates(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            bin_ = home / ".local/bin"
            # native claude with a fake self-updater that bumps its version
            claude = home / ".local/share/claude/versions/1.0.0"
            _exe(claude, '#!/bin/sh\nd=$(dirname "$0")\n'
                         'case "$1" in --version) cat "$d/.v" 2>/dev/null || echo "1.0.0 (Claude Code)";; '
                         'update) echo "1.0.1 (Claude Code)" > "$d/.v";; esac\n')
            bin_.mkdir(parents=True)
            (bin_ / "claude").symlink_to(claude)
            # npm-installed codex whose npm records the requested spec
            prefix = home / ".nvm/versions/node/v24.0.0"
            codex_js = prefix / "lib/node_modules/@openai/codex/bin/codex.js"
            _exe(codex_js, '#!/bin/sh\necho "codex-cli $(cat "$HOME/codex.v" 2>/dev/null || echo 0.1.0)"\n')
            (prefix / "bin").mkdir(parents=True)
            (prefix / "bin/codex").symlink_to(codex_js)
            _exe(prefix / "bin/npm", '#!/bin/sh\necho "$@" > "$HOME/npm.args"; echo 0.2.0 > "$HOME/codex.v"\n')
            # an unknown-method kimi outside ~/.kimi-code
            _exe(bin_ / "kimi", "#!/bin/sh\necho 9.9.9\n")
            env = {"PATH": f"{bin_}:{prefix / 'bin'}:/usr/bin:/bin"}
            recs, res = self.run_agent(home, "update", "claude", "codex", "kimi", "muse", env_extra=env)
            by = {(r[0], r[1]): r for r in recs if r[0] == "@@RESULT"}
            self.assertEqual(by[("@@RESULT", "claude")][2:5], ["updated", "1.0.0", "1.0.1"], res.stderr)
            self.assertEqual(by[("@@RESULT", "codex")][2:6], ["updated", "0.1.0", "0.2.0", "npm"], res.stderr)
            self.assertIn("@openai/codex@latest", (home / "npm.args").read_text())
            self.assertIn(f"--prefix {prefix}", (home / "npm.args").read_text())
            self.assertEqual(by[("@@RESULT", "kimi")][2], "skipped")
            self.assertEqual(by[("@@RESULT", "muse")][2], "absent")

    def test_status_changes_nothing_and_flags_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            stale = home / ".nvm/versions/node/v20.0.0"
            js = stale / "lib/node_modules/@xai-official/grok/bin/grok"
            _exe(js, "#!/bin/sh\necho 'grok 1.0.1'\n")
            (stale / "bin").mkdir(parents=True)
            (stale / "bin/grok").symlink_to(js)
            before = sorted(p.as_posix() for p in home.rglob("*"))
            recs, _ = self.run_agent(home, "status", "grok")
            inst = [r for r in recs if r[0] == "@@INSTALL"]
            self.assertEqual(inst[0][2:5], ["stale", "npm", "1"])
            self.assertEqual(sorted(p.as_posix() for p in home.rglob("*")), before)
            recs, _ = self.run_agent(home, "update", "grok")
            res = [r for r in recs if r[0] == "@@RESULT"]
            self.assertEqual(res[0][2], "skipped")

    def test_empty_version_keeps_fields_aligned(self):
        """An install whose --version prints nothing must not shift path/real (TAB-IFS bug)."""
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            claude = home / ".local/share/claude/versions/9"
            _exe(claude, '#!/bin/sh\ncase "$1" in update) touch "$HOME/updated";; esac\n')
            (home / ".local/bin").mkdir(parents=True)
            (home / ".local/bin/claude").symlink_to(claude)
            recs, res = self.run_agent(home, "update", "claude")
            r = [x for x in recs if x[0] == "@@RESULT"][0]
            self.assertEqual(r[2:7], ["failed", "-", "-", "native", str(home / ".local/bin/claude")], res.stderr)
            self.assertEqual(r[7], "version unreadable after update")
            self.assertTrue((home / "updated").exists())

    def test_version_ignores_error_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            _exe(home / ".grok/bin/grok", "#!/bin/sh\necho 'mise ERROR not provided by node@24.22.1' >&2; exit 1\n")
            (home / ".local/bin").mkdir(parents=True)
            (home / ".local/bin/grok").symlink_to(home / ".grok/bin/grok")
            recs, _ = self.run_agent(home, "status", "grok")
            self.assertEqual([x for x in recs if x[0] == "@@INSTALL"][0][5], "-")

    def test_junie_migrates_only_its_own_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            _exe(home / ".npm-global/bin/junie", "#!/bin/bash\necho 'Junie version: 1468.30'\n")
            recs, _ = self.run_agent(home, "update", "junie")
            r = [x for x in recs if x[0] == "@@RESULT"][0]
            self.assertEqual(r[2], "skipped")
            self.assertIn("migrate by hand", r[7])

    def test_junie_migration_can_be_disabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            _exe(home / ".local/bin/junie", "#!/bin/bash\necho 'Junie version: 1468.30'\n")
            recs, _ = self.run_agent(home, "update", "junie", env_extra={
                "PATH": f"{home / '.local/bin'}:/usr/bin:/bin", "HARNESS_JUNIE_MIGRATE": "0"})
            res = [r for r in recs if r[0] == "@@RESULT"][0]
            self.assertEqual(res[2:6], ["skipped", "1468.30", "-", "junie-legacy"])
            self.assertTrue((home / ".local/bin/junie").exists())


if __name__ == "__main__":
    unittest.main()
