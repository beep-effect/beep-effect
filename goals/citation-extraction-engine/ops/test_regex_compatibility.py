"""Controls for the maintainer compile survey; no family approval is implied."""
import importlib.util
import collections
import json
from pathlib import Path
import re
import unittest

SPEC = importlib.util.spec_from_file_location("regex_survey", Path(__file__).with_name("probe-regex-compatibility.py"))
SURVEY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SURVEY)


class CompatibilitySurveyControls(unittest.TestCase):
    def test_candidate_preserves_escaped_backslashes(self):
        self.assertEqual(SURVEY.translate_candidate(r"\\d", True)[0], r"\\d")
        self.assertNotIn("escape-d", SURVEY.translate_candidate(r"\\d", True)[1])

    def test_candidate_only_renames_groups_outside_classes(self):
        self.assertEqual(SURVEY.translate_candidate(r"[(?P<a>)](?P<b>x)", True)[0], r"[(?P<a>)](?<b>x)")

    def test_candidate_only_expands_quantifiers_outside_classes(self):
        self.assertEqual(SURVEY.translate_candidate(r"[{},3]x{,3}", True)[0], r"[{},3]x{0,3}")

    def test_literal_bracket_source_behavior_is_preserved(self):
        source = r"ch\[.,]"
        translated, features = SURVEY.translate_candidate(source, True)
        self.assertEqual(translated, r"ch\x5b.,\x5d")
        self.assertEqual(features["literal-unmatched-closing-bracket"], 1)
        self.assertIsNotNone(re.fullmatch(source, "ch[.,]"))
        self.assertIsNotNone(re.fullmatch(translated, "ch[.,]"))
        self.assertIsNone(re.fullmatch(source, "ch."))
        self.assertIsNone(re.fullmatch(translated, "ch."))

    def test_source_inventory_and_artifact_bindings_are_complete(self):
        entries, _ = SURVEY.source_entries()
        self.assertEqual(len(entries), 13610)
        self.assertEqual(len({identity for identity, _ in entries}), 13610)
        self.assertEqual(len({fields["regex"] for _, fields in entries}), 13258)

    def test_retained_report_source_bindings_and_complete_vectors(self):
        entries, sources = SURVEY.source_entries()
        report = json.loads((SURVEY.ROOT / "goals/citation-extraction-engine/history/evidence/regex-compile-survey.json").read_bytes())
        self.assertEqual(report["sources"], sources)
        self.assertEqual(report["oracleCommit"], SURVEY.PIN)
        self.assertEqual(report["oracleTree"], SURVEY.TREE)
        self.assertEqual(report["producerSha256"], SURVEY.sha(Path(SURVEY.__file__).read_bytes()))
        self.assertEqual(report["childSha256"], SURVEY.sha(SURVEY.CHILD.read_bytes()))
        self.assertEqual(report["instanceOrderSha256"], SURVEY.sha(SURVEY.canonical([identity for identity, _ in entries])))
        candidates = []
        features = collections.Counter()
        for _, fields in entries:
            baseline, _ = SURVEY.translate_candidate(fields["regex"], False)
            syntax, observed = SURVEY.translate_candidate(fields["regex"], True)
            candidates.append([baseline, syntax, fields["flags"]])
            features.update(observed.keys())
        self.assertEqual(report["candidateProjectionSha256"], SURVEY.sha(SURVEY.canonical(candidates)))
        self.assertEqual(report["featureInstanceCounts"], dict(features))
        self.assertEqual(len(report["runtimes"]), 2)
        for runtime in report["runtimes"]:
            self.assertEqual([stage["stage"] for stage in runtime["stages"]], ["named-groups-only", "lexical-syntax-candidate"])
            for stage in runtime["stages"]:
                vector = stage["vector"]
                self.assertEqual(len(vector), 13610)
                self.assertLessEqual(set(vector), {"C", "S"})
                self.assertEqual(stage["compiled"], vector.count("C"))
                self.assertEqual(stage["syntaxRejected"], vector.count("S"))
                self.assertEqual(stage["vectorSha256"], SURVEY.sha(vector.encode()))
            self.assertEqual(runtime["stages"][0]["compiled"], 2684)
            self.assertEqual(runtime["stages"][1]["compiled"], 13610)


if __name__ == "__main__":
    unittest.main()
