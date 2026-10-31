"""Build a version-bound, blank attorney review packet from an already frozen replay.

Usage: python3 .../build-allowed-review.py REPLAY_DIRECTORY NEW_PACKET_DIRECTORY
Never changes labels, predictions, existing packets or human verdicts.
"""
import collections
import hashlib
import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

packet = pathlib.Path('goals/claim-element-antecedent-check')
replay, output = map(pathlib.Path, sys.argv[1:])
assert not (output / 'packet.json').exists(), 'Existing review packet is immutable; choose a new directory.'
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
sampling_file = packet / 'research/allowed-adjudication-v1-freeze.json'
sampling = read(sampling_file)
manifest_file = packet / 'research/allowed-sampling.json'
assert sha(manifest_file) == sampling['manifestSha256']
results = read(replay / 'results.json')
assert results['implementationDigest'] == sampling['implementationDigest']
assert results['manifestSha256'] == sampling['manifestSha256']
runner = pathlib.Path('packages/law-practice/server/test/evaluation/allowed.main.ts')
assert sha(runner) == sampling['runnerSha256']
rows = {r['patentNumber']: r for r in results['sets']}
questions, claims, contexts = [], [], {}
for selected in sampling['selection']:
    patent = selected['patentNumber']
    number = selected['claimNumber']
    source = pathlib.Path('packages/law-practice/domain/test/fixtures/claim-element/allowed') / (patent + '.claims.xml')
    assert sha(source) == selected['claimsXmlSha256']
    native = [{'claimNumber': int(c.attrib['num']), 'sourceText': ' '.join(''.join(c.itertext()).split())}
              for c in ET.fromstring(source.read_bytes()).findall('claim')]
    contexts[patent] = native
    source_text = next(c['sourceText'] for c in native if c['claimNumber'] == number)
    row = rows[patent]
    claim_id = f'{patent}:{number}'
    claim = dict(selected, claimId=claim_id, sourceText=source_text, status=row['status'], questions=[])
    if row['status'] != 'checked':
        claim['failureMessage'] = row['failureMessage']
        claims.append(claim)
        continue
    prediction_file = replay / (patent + '.prediction.json')
    prediction = read(prediction_file)
    claim['predictionSha256'] = sha(prediction_file)
    canonical = next(c for c in prediction['claimSet']['claims'] if c['claimNumber'] == number)
    claim['canonicalText'] = canonical['claimText']
    failed = [c for c in prediction['report']['undecomposed'] if c.get('claimNumber') == number]
    if failed:
        claim['status'] = 'undecomposed'
        claims.append(claim)
        continue
    findings = [f for f in prediction['report']['findings'] if int(f['referring']['path'].split('.')[0]) == number]
    for index, finding in enumerate(findings):
        qid = f'{claim_id}:finding:{index}'
        question = {'id': qid, 'claimId': claim_id, 'type': 'finding', 'finding': finding}
        questions.append(question)
        claim['questions'].append(qid)
    if not findings:
        qid = f'{claim_id}:no-emitted-findings'
        questions.append({'id': qid, 'claimId': claim_id, 'type': 'no-emitted-findings'})
        claim['questions'].append(qid)
    claims.append(claim)
value = {'schemaVersion': 'claim-allowed-attorney-packet/v1', 'sampleSha256': sha(sampling_file),
         'manifestSha256': sampling['manifestSha256'], 'implementationDigest': sampling['implementationDigest'],
         'runnerSha256': sampling['runnerSha256'], 'resultsSha256': sha(replay / 'results.json'),
         'actualAttorneyAdjudicationRecorded': False, 'sampleCount': sampling['sampleCount'],
         'claims': claims, 'questions': questions, 'sourceContext': contexts}
value['bundleDigest'] = hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
output.mkdir(parents=True, exist_ok=True)
(output / 'packet.json').write_text(json.dumps(value, indent=2) + '\n')
template = (packet / 'research/allowed-review.template.html').read_text()
encoded = json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')
(output / 'index.html').write_text(template.replace('__REVIEW_DATA__', encoded))
print(json.dumps({'claims': len(claims), 'questions': len(questions),
                  'statuses': dict(collections.Counter(c['status'] for c in claims)),
                  'bundleDigest': value['bundleDigest']}, indent=2))
