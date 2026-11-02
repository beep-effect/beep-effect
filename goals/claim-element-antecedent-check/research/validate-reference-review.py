"""Read-only validation of the immutable reference spot-check and addendum.

Examples:
  python3 .../validate-reference-review.py --audit-packets
  python3 .../validate-reference-review.py main actual-export.json
  python3 .../validate-reference-review.py addendum actual-export.json

Only after the actual task submission explicitly confirms that the named
anonymous attorney personally supplied this exact export, add
--human-attorney-ref R1. This assertion does not authenticate identity.
No input, annotation, verdict, packet or prior result is ever written.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import re

PACKET = pathlib.Path('goals/claim-element-antecedent-check/history/attorney-review')
FIXTURES = pathlib.Path('packages/law-practice/domain/test/fixtures/claim-element/positive')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def load_packet(kind):
    name, receipt_name = ('index.html', 'packet.json') if kind == 'main' else ('addendum.html', 'addendum.json')
    raw = (PACKET / name).read_bytes()
    receipt = json.loads((PACKET / receipt_name).read_bytes())
    if digest(raw) != receipt['htmlSha256']:
        raise ValueError('Immutable review HTML does not match its retained receipt.')
    text = raw.decode('utf-8')
    marker = '<script id="dataset" type="application/json">'
    if text.count(marker) != 1:
        raise ValueError('Expected exactly one source dataset in the review packet.')
    data = json.loads(text.split(marker)[1].split('</script>')[0])
    payload = {k: v for k, v in data.items() if k != 'bundleDigest'}
    actual = digest(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode())
    if data['bundleDigest'] != actual or actual != receipt['bundleDigest']:
        raise ValueError('Review dataset content does not match its bundle digest.')
    if data['sourceSelectionDigest'] != receipt['sourceSelectionDigest']:
        raise ValueError('Review source selection differs from its receipt.')
    versions = []
    if kind == 'main':
        versions = [{k: f[k] for k in ['familyId', 'annotationSha256', 'canonicalClaimsSha256']}
                    for f in data['families']]
        keys = [(f['familyId'], c['claimNumber']) for f in data['families'] for c in f['claims']]
        if (len(versions) != receipt['familyCount'] or len(keys) != 50 or len(set(keys)) != 50 or
                len(keys) != receipt['claimCount'] or versions != receipt['familyVersions'] or
                len(data['additionalHeadQuestions']) != receipt['headQuestionCount'] or
                len({q['id'] for q in data['additionalHeadQuestions']}) != receipt['headQuestionCount'] or
                receipt['granularityQuestionCount'] != 1 or data['preview']):
            raise ValueError('Reference sample counts, versions or preview status differ from the retained packet.')
        versions += [{'familyId': q['familyId'], 'annotationSha256': q['annotationSha256']}
                     for q in data['additionalHeadQuestions']]
        versions.append({k: data['extra'][k] for k in ['familyId', 'annotationSha256']})
    else:
        if data['item'] != receipt['item'] or data['annotationSha256'] != receipt['annotationSha256']:
            raise ValueError('Addendum source item differs from its receipt.')
        versions = [{'familyId': data['item']['familyId'], 'annotationSha256': data['annotationSha256'],
                     'canonicalClaimsSha256': data['canonicalClaimsSha256']}]
    reference_freeze = json.loads((PACKET.parents[1] / 'research/reference-freeze.json').read_bytes())
    source_freeze = json.loads((PACKET.parents[1] / 'research/positive-source-freeze.json').read_bytes())
    frozen_families = {f['familyId']: f for f in reference_freeze['families']}
    if data['sourceSelectionDigest'] != source_freeze['sourceSelectionDigest']:
        raise ValueError('Review packet is not bound to the current retained source selection.')
    if kind == 'main':
        sample = json.loads((PACKET.parents[1] / 'research/attorney-sample.json').read_bytes())
        sample_keys = [(f['familyId'], n) for f in sample['families'] for n in f['claimNumbers']]
        if keys != sample_keys or sample['sourceSelectionDigest'] != data['sourceSelectionDigest']:
            raise ValueError('Review packet differs from the preselected attorney sample.')
    for version in versions:
        if not re.fullmatch(r'[0-9]+-root-[0-9]+', version['familyId']):
            raise ValueError('Invalid public family identity.')
        if version['familyId'] not in frozen_families:
            raise ValueError('Reviewed family is outside the retained reference set.')
        frozen = frozen_families[version['familyId']]
        if version['annotationSha256'] != frozen['annotationSha256']:
            raise ValueError('Reviewed annotation differs from its reference freeze.')
        for key, frozen_key, filename in [('annotationSha256', 'annotationSha256', 'expected.json'), ('canonicalClaimsSha256', 'canonicalClaimsSha256', 'claims.json')]:
            expected = version.get(key, frozen[frozen_key])
            if expected != frozen[frozen_key] or digest((FIXTURES / version['familyId'] / filename).read_bytes()) != expected:
                raise ValueError('Current reference/source bytes differ from the reviewed version.')
    return data, receipt


def confirm_authority(export, human_attorney_ref):
    if export.get('status') not in ['partial', 'review-complete']:
        raise ValueError('Unsupported review completion status.')
    if export.get('reviewSource') not in ['human-input', 'interface-preview']:
        raise ValueError('Unsupported answer source.')
    if human_attorney_ref is None:
        return False
    if not re.fullmatch(r'R[1-9][0-9]{0,3}', human_attorney_ref):
        raise ValueError('Use an anonymous attorney reference such as R1, never a personal name.')
    if (export['reviewSource'] != 'human-input' or export.get('reviewerRole') != 'attorney' or
            export.get('reviewerRef') != human_attorney_ref or export.get('synthetic') or export.get('preview')):
        raise ValueError('Actual attorney assertion conflicts with export role, anonymous reference or preview/source metadata.')
    return True


def same_fields(row, expected, fields):
    if any(row.get(k) != expected[k] for k in fields):
        raise ValueError('Question source identity or version has changed.')


def outcome_of(row, allowed):
    outcome = row.get('outcome')
    if outcome not in [None, ''] and outcome not in allowed:
        raise ValueError('Unsupported review outcome.')
    return outcome if outcome else None


def validate_main(data, export, *, human_attorney_ref=None):
    if export.get('schemaVersion') != 'claim-reference-attorney-verdicts/v1':
        raise ValueError('Unsupported main reference-review export schema.')
    confirmed = confirm_authority(export, human_attorney_ref)
    if data.get('preview') and confirmed:
        raise ValueError('An interface-preview packet cannot supply attorney agreement.')
    if (export.get('sourceSelectionDigest') != data['sourceSelectionDigest'] or
            export.get('annotationBundleDigest') != data['bundleDigest']):
        raise ValueError('Wrong reference bundle or source selection.')
    versions = [{k: f[k] for k in ['familyId', 'annotationSha256', 'canonicalClaimsSha256']}
                for f in data['families']]
    if export.get('familyVersions') != versions:
        raise ValueError('Wrong family annotation/source versions.')
    expected = [(f['familyId'], c['claimNumber']) for f in data['families'] for c in f['claims']]
    if not expected or len(set(expected)) != len(expected):
        raise ValueError('Reference sample must have unique claim identities.')
    answers = {}
    for row in export.get('decisions', []):
        key = (row.get('familyId'), row.get('claimNumber'))
        if key not in expected or key in answers:
            raise ValueError('Duplicate or out-of-sample claim answer.')
        answers[key] = outcome_of(row, ['agree', 'revise', 'uncertain'])
    counts = collections.Counter(answers.get(key) for key in expected)
    pending = counts[None]
    heads = {q['id']: q for q in data['additionalHeadQuestions']}
    head_answers = {}
    for row in export.get('additionalHeadDecisions', []):
        key = row.get('id')
        if key not in heads or key in head_answers:
            raise ValueError('Duplicate or unknown head-question answer.')
        same_fields(row, heads[key], heads[key].keys())
        head_answers[key] = outcome_of(row, ['apply-proposed-head', 'keep-current-head', 'uncertain'])
    head_counts = collections.Counter(head_answers.get(key) for key in heads)
    extra = export.get('additionalGranularityDecision', {})
    extra_outcome = None
    if extra:
        same_fields(extra, data['extra'], ['familyId', 'claimNumber', 'anchor', 'annotationSha256'])
        extra_outcome = outcome_of(extra, ['connecting-text', 'separate-term', 'uncertain'])
    complete = not pending and not head_counts[None] and extra_outcome is not None
    if export['status'] == 'review-complete' and not complete:
        raise ValueError('Export claims completion but leaves sample or convention questions unanswered.')
    return {'schemaVersion': 'claim-reference-attorney-agreement-summary/v2',
            'annotationBundleDigest': data['bundleDigest'], 'sourceSelectionDigest': data['sourceSelectionDigest'],
            'actualAttorneyAgreementRecorded': confirmed and not pending,
            'authorityStatus': 'task-submission-confirmed-human-attorney' if confirmed else 'human-attorney-source-unconfirmed',
            'reviewerRef': human_attorney_ref, 'claimDenominator': len(expected),
            'responseAgreementCount': counts['agree'], 'responseRevisionCount': counts['revise'],
            'responseUncertainCount': counts['uncertain'], 'responsePendingCount': pending,
            'agreementFraction': counts['agree']/len(expected) if confirmed and not pending else None,
            'sampleAgreementFractionBoundsFromResponses': [counts['agree']/len(expected), (counts['agree']+pending)/len(expected)],
            'boundsAreConfidenceInterval': False,
            'boundsInterpretation': 'Missing-answer bounds for reported agree outcomes; explicit uncertain stays a separate answered category, not an affirmative agreement.',
            'headQuestionOutcomes': {str(k) if k is not None else 'pending': v for k, v in head_counts.items()},
            'granularityResponseOutcome': extra_outcome, 'originalPacketQuestionsAllAnswered': complete,
            'conventionQuestionsResolved': confirmed and complete and head_counts['uncertain'] == 0 and extra_outcome != 'uncertain',
            'familyResponseCounts': {f['familyId']: dict(collections.Counter(answers.get((f['familyId'], c['claimNumber'])) or 'pending'
                                             for c in f['claims'])) for f in data['families']},
            'interpretation': 'The fixed main-claim denominator is never reduced. Convention questions and the separate addendum do not change it. File validation does not authenticate reviewer identity. No annotation or prior evidence is written.'}


def validate_addendum(data, export, *, human_attorney_ref=None):
    if export.get('schemaVersion') != 'claim-reference-attorney-addendum-verdict/v1':
        raise ValueError('Unsupported addendum export schema.')
    confirmed = confirm_authority(export, human_attorney_ref)
    same_fields(export, data, ['sourceSelectionDigest', 'annotationSha256', 'canonicalClaimsSha256', 'item'])
    if export.get('annotationBundleDigest') != data['bundleDigest']:
        raise ValueError('Wrong addendum bundle.')
    outcome = outcome_of(export, ['apply-proposed-head', 'keep-current-head', 'uncertain'])
    if export['status'] == 'review-complete' and outcome is None:
        raise ValueError('Addendum claims completion without a decision.')
    return {'schemaVersion': 'claim-reference-attorney-addendum-validation/v2',
            'annotationBundleDigest': data['bundleDigest'], 'sourceSelectionDigest': data['sourceSelectionDigest'],
            'actualAttorneyDecisionRecorded': confirmed and outcome is not None, 'reviewerRef': human_attorney_ref,
            'responseOutcome': outcome, 'adjudicatedOutcome': outcome if confirmed else None,
            'separateFromMainAgreementDenominator': True,
            'interpretation': 'No annotation mutation; no addition to the original spot-check denominator. Uncertain remains an unresolved convention decision. File validation cannot authenticate a reviewer.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', nargs='?', choices=['main', 'addendum'])
    parser.add_argument('export', nargs='?')
    parser.add_argument('--audit-packets', action='store_true')
    parser.add_argument('--human-attorney-ref', metavar='R1')
    args = parser.parse_args()
    if args.audit_packets:
        if args.kind or args.export or args.human_attorney_ref:
            parser.error('Packet audit takes no export or attorney assertion.')
        data, receipt = load_packet('main')
        addendum, addendum_receipt = load_packet('addendum')
        print(json.dumps({'schemaVersion': 'claim-reference-review-packet-audit/v1',
                          'mainHtmlSha256': receipt['htmlSha256'], 'addendumHtmlSha256': addendum_receipt['htmlSha256'],
                          'mainBundleDigest': data['bundleDigest'], 'addendumBundleDigest': addendum['bundleDigest'],
                          'familyCount': receipt['familyCount'], 'claimDenominator': receipt['claimCount'],
                          'mainAdditionalHeadQuestions': receipt['headQuestionCount'], 'mainGranularityQuestions': 1,
                          'separateAddendumQuestions': 1, 'actualAttorneyAgreementRecorded': False,
                          'agreementFraction': None, 'basis': 'Read-only source/packet integrity audit; no answers supplied.'}, indent=2))
        return
    if not args.kind or not args.export:
        parser.error('Supply main/addendum and an actual export, or use --audit-packets.')
    data, receipt = load_packet(args.kind)
    raw = pathlib.Path(args.export).read_bytes()
    export = json.loads(raw)
    validator = validate_main if args.kind == 'main' else validate_addendum
    result = validator(data, export, human_attorney_ref=args.human_attorney_ref)
    result.update(sourceExportSha256=digest(raw), packetHtmlSha256=receipt['htmlSha256'])
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
