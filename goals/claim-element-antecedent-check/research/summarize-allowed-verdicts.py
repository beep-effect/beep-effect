"""Validate an actual review export and summarize claim-level erroneous alerts.

No export -> no adjudicated estimate. Never accepts resolved-only denominators.
Usage: python3 .../summarize-allowed-verdicts.py PACKET_JSON VERDICTS_JSON
       [--human-attorney-ref R1]

The confirmation option is permitted only after an actual task submission
explicitly confirms attorney review of that exact export. It cannot authenticate
a person. Without it, all adjudicated point estimates/intervals stay null.
Output is a derived summary; source files are read-only. Synthetic controls must
remain labelled synthetic and must never be stored as human adjudication.
"""
import argparse
import hashlib
import json
import math
import pathlib
import re


def wilson_interval(positive, count):
    if type(count) is not int or count <= 0 or type(positive) is not int or not 0 <= positive <= count:
        raise ValueError('Interval counts must be integers with 0 <= positives <= count and count > 0.')
    rate = positive / count
    z = 1.959963984540054
    denominator = 1 + z*z/count
    center = (rate + z*z/(2*count)) / denominator
    half = z * math.sqrt(rate*(1-rate)/count + z*z/(4*count*count)) / denominator
    return [max(0.0, center-half), min(1.0, center+half)]


def validate_packet_coverage(packet):
    count = packet['sampleCount']
    if type(count) is not int or count <= 0 or len(packet['claims']) != count:
        raise ValueError('Sample denominator must be positive and match the claim list.')
    claims = {c['claimId']: c for c in packet['claims']}
    if len(claims) != count or any(not isinstance(k, str) or not k for k in claims):
        raise ValueError('Claim identities must be unique nonempty strings.')
    questions = {q['id']: q for q in packet['questions']}
    if len(questions) != len(packet['questions']) or any(not isinstance(k, str) or not k for k in questions):
        raise ValueError('Question identities must be unique nonempty strings.')
    owned = []
    for claim in claims.values():
        if claim['status'] not in ['checked', 'input-failed', 'undecomposed']:
            raise ValueError('Unsupported claim status.')
        ids = claim['questions']
        if len(ids) != len(set(ids)):
            raise ValueError('A claim cannot repeat a question.')
        if (claim['status'] == 'checked') != bool(ids):
            raise ValueError('Checked claims need questions; unchecked claims cannot supply verdict questions.')
        kinds = []
        for qid in ids:
            if qid not in questions or questions[qid]['claimId'] != claim['claimId']:
                raise ValueError('A question must belong to exactly its declared claim.')
            kind = questions[qid]['type']
            if kind not in ['finding', 'no-emitted-findings']:
                raise ValueError('Unsupported review question type.')
            kinds.append(kind)
            owned.append(qid)
        if 'no-emitted-findings' in kinds and len(ids) != 1:
            raise ValueError('No-finding confirmation cannot be mixed with finding questions.')
    if len(owned) != len(questions) or set(owned) != set(questions):
        raise ValueError('Every question must be owned exactly once; orphan questions are invalid.')
    return questions


def summarize(packet, export, *, human_attorney_ref=None):
    if packet['schemaVersion'] != 'claim-allowed-attorney-packet/v1':
        raise ValueError('Unsupported packet schema.')
    if export['schemaVersion'] != 'claim-allowed-attorney-verdicts/v1':
        raise ValueError('Unsupported verdict schema.')
    for field in ['bundleDigest', 'sampleSha256', 'implementationDigest', 'resultsSha256']:
        if packet[field] != export[field]:
            raise ValueError('Review export is bound to a different ' + field)
    by_id = validate_packet_coverage(packet)
    if type(export.get('complete')) is not bool:
        raise ValueError('The export completion flag must be a boolean.')
    confirmed = human_attorney_ref is not None
    if confirmed:
        if not re.fullmatch(r'R[1-9][0-9]{0,3}', human_attorney_ref):
            raise ValueError('Use an anonymous attorney reference such as R1; never a personal name.')
        if (export.get('reviewSource', 'human-input') != 'human-input' or
                bool(export.get('synthetic')) or bool(export.get('preview'))):
            raise ValueError('Synthetic or preview exports cannot supply actual attorney adjudication.')
        if export.get('reviewerRole', 'attorney') != 'attorney':
            raise ValueError('A non-attorney export cannot supply attorney adjudication.')
    answers = {}
    for row in export['verdicts']:
        if row['id'] not in by_id or row['id'] in answers:
            raise ValueError('Unknown or duplicate verdict id.')
        if row['verdict'] not in ['right', 'wrong', 'uncertain']:
            raise ValueError('Invalid verdict.')
        if not isinstance(row.get('reason'), str):
            raise ValueError('A verdict reason must be text.')
        if row['verdict'] != 'right' and not row['reason'].strip():
            raise ValueError('Wrong or uncertain verdict requires a reason.')
        answers[row['id']] = row
    # A claimed complete export cannot silently omit questions. Partial exports
    # remain admissible and explicit; input failures never become clean claims.
    if export.get('complete') and len(answers) != len(by_id):
        raise ValueError('Export claims completion but omits questions.')
    positive, negative, unknown = [], [], []
    for claim in packet['claims']:
        if claim['status'] != 'checked':
            unknown.append(claim['claimId'])
            continue
        questions = [by_id[qid] for qid in claim['questions']]
        if any(q['type'] == 'finding' and answers.get(q['id'], {}).get('verdict') == 'wrong' for q in questions):
            positive.append(claim['claimId'])
        elif questions and all(answers.get(q['id'], {}).get('verdict') == 'right' for q in questions):
            negative.append(claim['claimId'])
        else:
            unknown.append(claim['claimId'])
    n = packet['sampleCount']
    if len(positive) + len(negative) + len(unknown) != n:
        raise ValueError('Sample denominator does not match packet claims.')
    rate = None
    interval = None
    if not unknown and confirmed:
        rate = len(positive) / n
        interval = wilson_interval(len(positive), n)
    return {'schemaVersion': 'claim-allowed-adjudicated-summary/v2',
            'actualAttorneyAdjudicationRecorded': confirmed and bool(answers),
            'reviewerRef': human_attorney_ref,
            'authorityStatus': 'task-submission-confirmed-human-attorney' if confirmed else 'human-attorney-source-unconfirmed',
            'provenanceLimit': 'This validates supplied answers and an explicit task-submission confirmation; it does not authenticate a person or turn preview data into human review.',
            'metricStatus': 'human-source-unconfirmed' if not confirmed else ('unresolved-sample-outcomes' if unknown else 'adjudicated-complete-sample'),
            'bundleDigest': packet['bundleDigest'], 'implementationDigest': packet['implementationDigest'],
            'sampleCount': n, 'answeredQuestions': len(answers), 'questionCount': len(by_id),
            'claimsWithConfirmedErroneousFinding': positive,
            'claimsWithoutErroneousEmittedFinding': negative, 'unresolvedClaims': unknown,
            'sampleErroneousAlertFractionBounds': [len(positive)/n, (len(positive)+len(unknown))/n],
            'boundsAreConfidenceInterval': False,
            'claimLevelErroneousAlertRate': rate, 'wilson95BinomialApproximation': interval,
            'estimand': 'Claim-level erroneous emitted advisory alert rate on the frozen allowed sample; not finding precision or a clean-claim specificity estimate.',
            'intervalCaveat': 'Wilson binomial approximation for simple random sampling without replacement; no finite-population correction. Unresolved claims suppress the point estimate and interval.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('packet')
    parser.add_argument('verdicts')
    parser.add_argument('--human-attorney-ref', metavar='R1', help='Use only after explicit confirmation in the actual task submission that an attorney personally supplied these verdicts. Never use for synthetic/preview data.')
    args = parser.parse_args()
    packet_bytes = pathlib.Path(args.packet).read_bytes()
    export_bytes = pathlib.Path(args.verdicts).read_bytes()
    packet, export = json.loads(packet_bytes), json.loads(export_bytes)
    payload = {k: v for k, v in packet.items() if k != 'bundleDigest'}
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if digest != packet['bundleDigest']:
        raise ValueError('Packet content no longer matches its bundle digest.')
    result = summarize(packet, export, human_attorney_ref=args.human_attorney_ref)
    result['sourceExportSha256'] = hashlib.sha256(export_bytes).hexdigest()
    result['packetFileSha256'] = hashlib.sha256(packet_bytes).hexdigest()
    print(json.dumps(result, indent=2))
