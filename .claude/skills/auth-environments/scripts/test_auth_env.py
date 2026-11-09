"""Offline checks for auth_env.py; no SSH, browser or dialog is started."""
import importlib.util
import os
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("auth_env", HERE / "auth_env.py")
auth_env = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auth_env)

SAMPLE = (
    "Opening browser to sign in…\r\n"
    "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true"
    "&client_id=x&state=y&login_hint=a%40example.invalid\r\n"
    "Paste code here if prompted > "
)


class AuthEnvTest(unittest.TestCase):
    def test_url_found_in_cli_output(self):
        m = auth_env.URL_RE.search(auth_env.ANSI.sub("", SAMPLE))
        self.assertIsNotNone(m)
        self.assertTrue(m.group(0).startswith("https://claude.com/cai/oauth/authorize?"))
        self.assertNotIn("Paste", m.group(0))

    def test_prompt_and_outcomes(self):
        self.assertIsNotNone(auth_env.PROMPT_RE.search(SAMPLE))
        self.assertIsNotNone(auth_env.OK_RE.search("Login successful."))
        self.assertIsNotNone(auth_env.BAD_RE.search("OAuth error: invalid_grant"))
        self.assertIsNone(auth_env.OK_RE.search(SAMPLE))

    def test_helper_resolves_to_sibling_skill(self):
        self.assertTrue(os.path.isfile(auth_env.HELPER))

    def test_hosts_use_wrappers_only(self):
        for host, (wrapper, _, _) in auth_env.HOSTS.items():
            self.assertTrue(wrapper.startswith("ssh-"), host)
            argv = auth_env.ssh_argv(host)
            self.assertIn(f"ControlPath={Path('~/.ssh').expanduser()}/cm-auth-{host}", argv)

    def test_login_command_quotes_email(self):
        cmd = auth_env.login_command("a'b;touch x@example.invalid")
        self.assertTrue(cmd.startswith(auth_env.REMOTE_PATH + " claude auth login"))
        self.assertTrue(cmd.endswith("""--email 'a'"'"'b;touch x@example.invalid'"""))


if __name__ == "__main__":
    unittest.main()
