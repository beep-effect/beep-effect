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


class ReferenceOwnership(unittest.TestCase):
    def setUp(self):
        self.main = review.load_main()
        self.review = json.loads((review.ROOT / 'history/autonomous-review-v1/reference-A-round2.json').read_text())

    def test_original_receipt_still_covers_all_fifty_claims(self):
        rows, _, _ = review.validate(self.review, self.main)
        self.assertEqual(len(rows), 50)

    def test_copied_claim_cannot_keep_another_claims_id(self):
        rows = review.decisions(self.review)
        first_id = rows[0]['id']
        rows[0] = copy.deepcopy(rows[-1])
        rows[0]['id'] = first_id
        with self.assertRaisesRegex(ValueError, 'identity does not match'):
            review.validate(self.review, self.main)

    def test_wrong_family_and_noninteger_claim_number_are_rejected(self):
        for field, value in [('familyId', 'other-family'), ('claimNumber', True), ('claimNumber', '5')]:
            with self.subTest(field=field, value=value):
                bad = copy.deepcopy(self.review)
                review.decisions(bad)[0][field] = value
                with self.assertRaisesRegex(ValueError, 'identity does not match'):
                    review.validate(bad, self.main)



if __name__ == '__main__':
    unittest.main()
