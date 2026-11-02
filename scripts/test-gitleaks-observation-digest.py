#!/usr/bin/env python3
"""Boundary contract for the immutable observation-proof digest exception.

Run with Python 3.11+ and the CI-pinned Gitleaks 8.30.1 available on PATH:
    python3 scripts/test-gitleaks-observation-digest.py

Every scan uses a disposable directory with synthetic inputs, the repository's
actual scanner configuration, and redacted JSON findings. No Git history, ignore
fingerprints, or operator credentials participate.
"""

import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import tomllib
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
CONFIG = REPO_ROOT / ".gitleaks.toml"
RECEIPT = (
    "goals/agent-observability-foundation/ops/history/"
    "integrated-package-proof-20261102.json"
)
SOURCE_KEY = "packages/tooling/library/ai-metrics/test/" + "CredentialBank.test.ts"
PUBLIC_DIGEST = "ca09bb72ba118d3a521f469c5e4c4898f0904421a180b9d83fdea1ab93ce0793"
# Deliberately generated from a public, deterministic test label, never a key.
SYNTHETIC_VALUE = base64.b64encode(
    hashlib.sha256(b"public observation scanner boundary fixture").digest()
).decode("ascii")
SYNTHETIC_GITHUB_VALUE = "ghp_" + "7Hh2vK9mR4sT6wY8zB3dF5jL1nP0qXcVUaEe"


def digest_line(key=SOURCE_KEY, value=PUBLIC_DIGEST):
    return f'    {json.dumps(key)}: {json.dumps(value)},'


def document(*lines):
    return "{\n" + "\n".join(lines) + '\n    "fixture": true\n}\n'


class ObservationDigestAllowlistTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scanner = shutil.which("gitleaks")
        if cls.scanner is None:
            raise RuntimeError("Gitleaks 8.30.1 must be available on PATH")

    def scan(self, path, content):
        with tempfile.TemporaryDirectory(prefix="beep-gitleaks-boundary-") as temp:
            root = Path(temp)
            source = root / "source"
            target = source / path
            target.parent.mkdir(parents=True)
            target.write_text(content, encoding="utf-8")
            report = root / "report.json"
            result = subprocess.run(
                [
                    self.scanner,
                    "dir",
                    ".",
                    "--config",
                    str(CONFIG),
                    "--report-format",
                    "json",
                    "--report-path",
                    str(report),
                    "--redact",
                    "--no-banner",
                ],
                cwd=source,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            # Do not echo scanner output or findings on failure.
            self.assertIn(result.returncode, (0, 1), "Gitleaks did not complete a scan")
            self.assertTrue(report.is_file(), "Gitleaks did not create a JSON report")
            findings = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(result.returncode, 1 if findings else 0)
            return [finding["RuleID"] for finding in findings]

    def test_exception_pins_rule_path_and_complete_line(self):
        config = tomllib.loads(CONFIG.read_text(encoding="utf-8"))
        matches = [
            item
            for item in config["allowlists"]
            if any("integrated" in path for path in item.get("paths", []))
        ]
        self.assertEqual(len(matches), 1)
        exception = matches[0]
        self.assertEqual(exception["targetRules"], ["generic-api-key"])
        self.assertEqual(exception["condition"], "AND")
        self.assertEqual(exception["regexTarget"], "line")
        self.assertEqual(len(exception["paths"]), 1)
        self.assertEqual(len(exception["regexes"]), 1)
        path_pattern = exception["paths"][0]
        line_pattern = exception["regexes"][0]
        for path in (RECEIPT, "/repo/" + RECEIPT):
            self.assertIsNotNone(re.fullmatch(path_pattern, path))
        for path in ("other/" + RECEIPT, RECEIPT + ".bak", RECEIPT.replace("20261102", "20261103")):
            self.assertIsNone(re.fullmatch(path_pattern, path))
        self.assertIsNotNone(re.fullmatch(line_pattern, digest_line()))
        self.assertIsNone(re.fullmatch(line_pattern, digest_line() + ' "api_key": "extra",'))

    def test_known_public_digest_is_allowed_at_only_the_receipt_path(self):
        self.assertEqual(self.scan(RECEIPT, document(digest_line())), [])
        self.assertIn(
            "generic-api-key",
            self.scan("outside/receipt.json", document(digest_line())),
        )

    def test_changed_digest_key_and_synthetic_token_remain_detected(self):
        cases = (
            digest_line(value="d" + PUBLIC_DIGEST[1:]),
            digest_line(key=SOURCE_KEY.replace(".test.ts", ".changed.test.ts")),
            digest_line(value=SYNTHETIC_VALUE),
        )
        for index, line in enumerate(cases):
            with self.subTest(case=index):
                self.assertIn("generic-api-key", self.scan(RECEIPT, document(line)))

    def test_other_detector_on_same_line_and_other_line_remains_detected(self):
        other = f'    "github_token": "{SYNTHETIC_GITHUB_VALUE}",'
        for index, lines in enumerate(((digest_line() + other,), (digest_line(), other))):
            with self.subTest(case=index):
                self.assertIn("github-pat", self.scan(RECEIPT, document(*lines)))


if __name__ == "__main__":
    unittest.main()
