"""Boundary controls for immutable automated reference-review summaries."""
import copy
import importlib.util
import json
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('automated_reference', HERE / 'summarize-automated-reference.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class AutomatedReferenceBoundary(unittest.TestCase):
    def setUp(self):
        history = HERE.parent / 'history' / 'autonomous-review-v1'
        self.a = json.loads((history / 'reference-A-round2.json').read_text())
        self.b = json.loads((history / 'reference-B-round2.json').read_text())

    def test_fixed_denominator_and_uncertainty(self):
        result = review.summarize(self.a, self.b)
        self.assertEqual(result['claimDenominator'], 50)
        self.assertEqual(result['automatedConsensusCounts'], {'agree': 33, 'revise': 3, 'uncertain': 14})
        self.assertEqual(result['unresolvedConventionCount'], 1)
        self.assertFalse(result['referenceLabelsChanged'])
        self.assertFalse(result['actualAttorneyAgreementRecorded'])

    def test_reject_authority_round_and_bundle_changes(self):
        for key, value in [('reviewAuthority', 'attorney'), ('actualAttorneyAgreementRecorded', True),
                           ('round', 4), ('inputBundleDigest', 'wrong')]:
            bad = copy.deepcopy(self.a)
            bad[key] = value
            with self.assertRaises(ValueError):
                review.summarize(bad, self.b)
        bad = copy.deepcopy(self.b)
        bad['reviewerRole'] = self.a['reviewerRole']
        with self.assertRaises(ValueError):
            review.summarize(self.a, bad)

    def test_reject_missing_duplicate_or_fabricated_evidence(self):
        for mutation in ['missing', 'duplicate', 'quote']:
            bad = copy.deepcopy(self.a)
            rows = bad['decisions']
            if mutation == 'missing':
                rows.pop()
            elif mutation == 'duplicate':
                rows.append(copy.deepcopy(rows[0]))
            else:
                rows[0]['evidence'][0]['quote'] = 'fabricated source evidence xyz-92731'
            with self.assertRaises(ValueError):
                review.summarize(bad, self.b)


if __name__ == '__main__':
    unittest.main()
