"""Exercise the actual AST-loading contract of the five selection siblings.

These are helper compatibility checks, not fresh native Cargo, log, or base-ref
observations. The historical feature reports retain their original source pins.
"""

import ast
import contextlib
from pathlib import Path
import sys
import tempfile
import time
import unittest


RESEARCH = Path(__file__).resolve().parent
DRIVER = RESEARCH / "native-selection-controls.py"
SIBLINGS = (
    "native-base-ref-controls.py",
    "native-cargo-controls.py",
    "native-cargo-applicability.py",
    "native-log-presentation-controls.py",
    "native-log-cache-controls.py",
)


@contextlib.contextmanager
def sibling_invoke(name):
    """Run the real sibling prelude through its extracted invoke assignment."""
    source = RESEARCH / name
    tree = ast.parse(source.read_bytes())
    assignment = next(
        index
        for index, node in enumerate(tree.body)
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "invoke" for target in node.targets)
    )
    with tempfile.TemporaryDirectory(prefix="selection-sibling-") as temporary:
        root = Path(temporary)
        namespace = {"__file__": str(source), "__name__": "selection_sibling_probe"}
        original_arguments = sys.argv
        try:
            sys.argv = [str(source), "--output", str(root / "fresh-report")]
            exec(
                compile(ast.Module(body=tree.body[: assignment + 1], type_ignores=[]), str(source), "exec"),
                namespace,
            )
        finally:
            sys.argv = original_arguments
        invoke = namespace["invoke"]
        environment = {"PATH": "/usr/bin:/bin", "HOME": str(root)}
        yield invoke, root, environment


class SelectionInvokeCompatibility(unittest.TestCase):
    def test_all_actual_sibling_loaders_capture_exit_and_streams(self):
        for name in SIBLINGS:
            with self.subTest(driver=name), sibling_invoke(name) as (invoke, root, environment):
                result = invoke(
                    ["/usr/bin/python3", "-c", "import os; os.write(1,b'out'); os.write(2,b'err'); raise SystemExit(7)"],
                    root,
                    environment,
                )
                self.assertEqual(result, (7, b"out", b"err"))

    def test_cargo_applicability_keeps_its_eight_mib_adaptation(self):
        for name in SIBLINGS:
            with self.subTest(driver=name), sibling_invoke(name) as (invoke, root, environment):
                command = ["/usr/bin/python3", "-c", "import os; os.write(1,b'x'*(1024*1024+1))"]
                if name == "native-cargo-applicability.py":
                    code, stdout, stderr = invoke(command, root, environment)
                    self.assertEqual((code, len(stdout), stderr), (0, 1024 * 1024 + 1, b""))
                else:
                    with self.assertRaisesRegex(AssertionError, "Native output exceeded one MiB"):
                        invoke(command, root, environment)

    def test_all_siblings_keep_the_stderr_bound(self):
        for name in SIBLINGS:
            with self.subTest(driver=name), sibling_invoke(name) as (invoke, root, environment):
                with self.assertRaisesRegex(AssertionError, "Native output exceeded one MiB"):
                    invoke(["/usr/bin/python3", "-c", "import os; os.write(2,b'x'*(1024*1024+1))"], root, environment)

    def test_all_siblings_stop_their_owned_process_on_timeout(self):
        for name in SIBLINGS:
            with self.subTest(driver=name), sibling_invoke(name) as (invoke, root, environment):
                invoke.__globals__["deadline"] = time.monotonic() + 0.5
                marker = root / "child.pid"
                program = "import os,time; open(" + repr(str(marker)) + ",'x').write(str(os.getpid())); time.sleep(30)"
                with self.assertRaisesRegex(AssertionError, "Owned selection process group exceeded its deadline"):
                    invoke(["/usr/bin/python3", "-c", program], root, environment)
                self.assertTrue(marker.exists())
                self.assertFalse((Path("/proc") / marker.read_text()).exists())

    def test_all_siblings_refuse_an_expired_observation(self):
        for name in SIBLINGS:
            with self.subTest(driver=name), sibling_invoke(name) as (invoke, root, environment):
                invoke.__globals__["deadline"] = time.monotonic() - 1
                with self.assertRaisesRegex(AssertionError, "three-minute budget"):
                    invoke(["/usr/bin/true"], root, environment)

    def test_current_selection_uses_its_streaming_helper(self):
        tree = ast.parse(DRIVER.read_bytes())
        calls = [node.func.id for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)]
        self.assertEqual(calls.count("invoke_bounded"), 4)
        self.assertNotIn("invoke", calls)


if __name__ == "__main__":
    unittest.main()
