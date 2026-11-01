"""Synthetic reference-review controls; never actual attorney evidence."""
import copy
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('reference_review', pathlib.Path(__file__).with_name('validate-reference-review.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReferenceReviewBoundary(unittest.TestCase):
    def setUp(self):
        self.data = {'preview': False, 'sourceSelectionDigest': 'synthetic', 'bundleDigest': 'synthetic',
                     'families': [{'familyId': 'a', 'annotationSha256': 'a', 'canonicalClaimsSha256': 'b',
                                   'claims': [{'claimNumber': 1}, {'claimNumber': 2}]},
                                  {'familyId': 'b', 'annotationSha256': 'c', 'canonicalClaimsSha256': 'd',
                                   'claims': [{'claimNumber': 1}]}],
                     'additionalHeadQuestions': [{'id': 'h1', 'familyId': 'a', 'claimNumber': 1, 'annotationSha256': 'a'}],
                     'extra': {'familyId': 'a', 'claimNumber': 1, 'anchor': {'quote': 'each other'}, 'annotationSha256': 'a'}}
        self.export = {'schemaVersion': 'claim-reference-attorney-verdicts/v1', 'reviewSource': 'human-input',
                       'status': 'partial', 'reviewerRole': 'attorney', 'reviewerRef': 'R1',
                       'sourceSelectionDigest': 'synthetic', 'annotationBundleDigest': 'synthetic',
                       'familyVersions': [{k: f[k] for k in ['familyId', 'annotationSha256', 'canonicalClaimsSha256']}
                                          for f in self.data['families']], 'decisions': []}

    def fill(self):
        self.export.update(status='review-complete',
                           decisions=[{'familyId': f, 'claimNumber': n, 'outcome': o}
                                      for f, n, o in [('a', 1, 'agree'), ('a', 2, 'revise'), ('b', 1, 'uncertain')]],
                           additionalHeadDecisions=[dict(self.data['additionalHeadQuestions'][0], outcome='keep-current-head')],
                           additionalGranularityDecision=dict(self.data['extra'], outcome='connecting-text'))

    def test_empty_and_partial_keep_full_denominator(self):
        out = module.validate_main(self.data, self.export)
        self.assertEqual(out['claimDenominator'], 3)
        self.assertEqual(out['responsePendingCount'], 3)
        self.assertIsNone(out['agreementFraction'])
        self.export['decisions'] = [{'familyId': 'a', 'claimNumber': 1, 'outcome': 'agree'}]
        out = module.validate_main(self.data, self.export, human_attorney_ref='R1')
        self.assertEqual(out['sampleAgreementFractionBoundsFromResponses'], [1/3, 1])
        self.assertIsNone(out['agreementFraction'])

    def test_complete_without_task_confirmation_is_not_actual_agreement(self):
        self.fill()
        out = module.validate_main(self.data, self.export)
        self.assertFalse(out['actualAttorneyAgreementRecorded'])
        self.assertFalse(out['conventionQuestionsResolved'])
        self.assertIsNone(out['agreementFraction'])

    def test_confirmed_synthetic_control_keeps_uncertainty_in_denominator(self):
        self.fill()
        out = module.validate_main(self.data, self.export, human_attorney_ref='R1')
        self.assertEqual(out['agreementFraction'], 1/3)
        self.assertEqual(out['responseUncertainCount'], 1)
        self.assertEqual(out['claimDenominator'], 3)

    def test_convention_questions_do_not_change_main_agreement_denominator(self):
        self.fill()
        self.export['status'] = 'partial'
        self.export['additionalHeadDecisions'] = []
        out = module.validate_main(self.data, self.export, human_attorney_ref='R1')
        self.assertEqual(out['agreementFraction'], 1/3)
        self.assertFalse(out['originalPacketQuestionsAllAnswered'])
        self.assertEqual(out['headQuestionOutcomes']['pending'], 1)

    def test_duplicate_unknown_and_false_completion_are_rejected(self):
        self.fill()
        for mutate in [lambda e: e['decisions'].append(copy.deepcopy(e['decisions'][0])),
                       lambda e: e['decisions'][0].update(familyId='unknown'),
                       lambda e: e['decisions'][0].update(outcome='unknown'),
                       lambda e: e.update(decisions=[]),
                       lambda e: e.update(sourceSelectionDigest='other'),
                       lambda e: e.update(familyVersions=[]),
                       lambda e: e['additionalHeadDecisions'][0].update(annotationSha256='other'),
                       lambda e: e['additionalGranularityDecision'].update(anchor={'quote': 'other'})]:
            with self.subTest(mutate=mutate):
                export = copy.deepcopy(self.export)
                mutate(export)
                with self.assertRaises(ValueError):
                    module.validate_main(self.data, export)

    def test_preview_and_role_mismatch_cannot_supply_attorney_agreement(self):
        self.fill()
        for marker in [{'reviewSource': 'interface-preview'}, {'reviewerRole': 'non-attorney'},
                       {'reviewerRef': 'R2'}, {'synthetic': True}]:
            with self.assertRaises(ValueError):
                module.validate_main(self.data, dict(self.export, **marker), human_attorney_ref='R1')
        data = dict(self.data, preview=True)
        with self.assertRaises(ValueError):
            module.validate_main(data, self.export, human_attorney_ref='R1')

    def test_addendum_remains_separate_and_unconfirmed_by_default(self):
        data = {'sourceSelectionDigest': 'synthetic', 'annotationSha256': 'a', 'canonicalClaimsSha256': 'b',
                'item': {'familyId': 'a', 'claimNumber': 1}, 'bundleDigest': 'synthetic'}
        export = {k: data[k] for k in ['sourceSelectionDigest', 'annotationSha256', 'canonicalClaimsSha256', 'item']}
        export.update(schemaVersion='claim-reference-attorney-addendum-verdict/v1', reviewSource='human-input',
                      status='review-complete', reviewerRole='attorney', reviewerRef='R1',
                      annotationBundleDigest='synthetic', outcome='uncertain')
        out = module.validate_addendum(data, export)
        self.assertIsNone(out['adjudicatedOutcome'])
        self.assertTrue(out['separateFromMainAgreementDenominator'])
        out = module.validate_addendum(data, export, human_attorney_ref='R1')
        self.assertEqual(out['adjudicatedOutcome'], 'uncertain')
        self.assertNotIn('agreementFraction', out)
        export['item'] = {'familyId': 'other', 'claimNumber': 1}
        with self.assertRaises(ValueError):
            module.validate_addendum(data, export)


if __name__ == '__main__':
    unittest.main()
