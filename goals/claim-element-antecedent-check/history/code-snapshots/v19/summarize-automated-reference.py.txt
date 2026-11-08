"""Consensus overlay for two independent frozen-reference audits; no gold edits."""
import argparse
import collections
import hashlib
import json
import pathlib

ROOT = pathlib.Path('goals/claim-element-antecedent-check')
BASE = pathlib.Path('packages/law-practice/domain/test/fixtures/claim-element/positive')


def load_main():
    raw = (ROOT/'history/attorney-review/index.html').read_text()
    return json.loads(raw.split('<script id="dataset" type="application/json">')[1].split('</script>')[0])


def decisions(review):
    return review.get('decisions', review.get('claimDecisions', []))


def normalize_conventions(review):
    if 'conventionDecisions' in review:
        rows = review['conventionDecisions']
    else:
        rows = review['additionalHeadDecisions']+[review['additionalGranularityDecision'], review['addendumDecision']]
    output = {}
    for row in rows:
        if 'granularity' in row.get('id', '') or row.get('outcome') in ['connecting-text', 'relationship-text', 'separate-term']:
            key = 'reciprocal-language'
        elif row.get('anchor', {}).get('quote') == 'each edge' or 'addendum' in row.get('id', ''):
            key = 'each-edge-addendum'
        else:
            key = row['id']
        if key in output:
            raise ValueError('Duplicate convention question.')
        output[key] = dict(row, normalizedOutcome='connecting-text' if row['outcome']=='relationship-text' else row['outcome'])
    return output


def validate(review, main):
    if (review.get('reviewAuthority') != 'automated' or review.get('model') != 'gpt-6.1-sol' or
            review.get('effort') != 'medium' or review.get('actualAttorneyAgreementRecorded') is not False or
            review.get('actualAttorneyAdjudicationRecorded') is not False):
        raise ValueError('Wrong automated review authority/model provenance.')
    if type(review.get('round')) is not int or not 1 <= review['round'] <= 3:
        raise ValueError('Reference review exceeds the bounded protocol.')
    bundle = review.get('inputBundleDigest', review.get('inputBundle', {}).get('annotationBundleDigest'))
    if bundle != main['bundleDigest']:
        raise ValueError('Reference review is bound to the wrong frozen bundle.')
    expected = {f"{f['familyId']}:{c['claimNumber']}" for f in main['families'] for c in f['claims']}
    rows = decisions(review)
    mapping = {r['id']:r for r in rows}
    if len(mapping)!=len(rows) or set(mapping)!=expected:
        raise ValueError('Missing/duplicate/out-of-sample reference verdicts.')
    checks = 0
    for row in rows:
        if row['outcome'] not in ['agree','revise','uncertain'] or type(row.get('confidence')) not in [int,float] or not 0<=row['confidence']<=1:
            raise ValueError('Invalid source-review judgment.')
        texts={c['claimNumber']:c['claimText'] for c in json.loads((BASE/row['familyId']/'claims.json').read_text())['claims']}
        evidence=row.get('evidence',[])
        if not evidence:
            raise ValueError('Reference review must cite source evidence.')
        for item in evidence:
            quote=item.get('anchor',item).get('quote')
            numbers=item.get('sourceClaimNumbers',[item.get('claimNumber',row['claimNumber'])])
            if not quote or not any(quote in texts[n] for n in numbers if n in texts):
                raise ValueError('Unverified source quotation: '+row['id'])
            checks+=1
    conventions=normalize_conventions(review)
    expected_conventions={q['id'] for q in main['additionalHeadQuestions']}|{'reciprocal-language','each-edge-addendum'}
    if set(conventions)!=expected_conventions:
        raise ValueError('Convention review coverage differs from the original eight questions.')
    for row in conventions.values():
        if row['normalizedOutcome'] not in ['apply-proposed-head','keep-current-head','connecting-text','separate-term','uncertain'] or not 0<=row['confidence']<=1:
            raise ValueError('Invalid convention judgment.')
    return mapping, conventions, checks


def summarize(a,b):
    main=load_main()
    if a.get('reviewerRole') == b.get('reviewerRole'):
        raise ValueError('Independent reference reviewers must have distinct roles.')
    aa,ac,aq=validate(a,main);bb,bc,bq=validate(b,main)
    rows=[]
    for key in sorted(aa):
        x,y=aa[key],bb[key];accepted=x['outcome']==y['outcome'] and min(x['confidence'],y['confidence'])>=.95
        rows.append({'id':key,'outcome':x['outcome'] if accepted else 'uncertain','reviewerAOutcome':x['outcome'],'reviewerBOutcome':y['outcome'],'bothConfidenceAtLeast095':min(x['confidence'],y['confidence'])>=.95})
    conventions=[]
    for key in sorted(ac):
        x,y=ac[key],bc[key];accepted=x['normalizedOutcome']==y['normalizedOutcome'] and min(x['confidence'],y['confidence'])>=.95
        conventions.append({'id':key,'outcome':x['normalizedOutcome'] if accepted else 'uncertain','reviewerAOutcome':x['normalizedOutcome'],'reviewerBOutcome':y['normalizedOutcome'],'sourceIds':[x.get('id'),y.get('id')]})
    counts=collections.Counter(r['outcome'] for r in rows)
    return {'schemaVersion':'claim-automated-reference-summary/v1','reviewAuthority':'automated','actualAttorneyAgreementRecorded':False,
            'actualAttorneyAdjudicationRecorded':False,'referenceLabelsChanged':False,'annotationBundleDigest':main['bundleDigest'],
            'claimDenominator':len(rows),'automatedConsensusCounts':dict(counts),'automatedReferenceAgreementFraction':counts['agree']/len(rows),
            'verifiedSourceEvidenceQuotes':aq+bq,'claims':rows,'conventions':conventions,'unresolvedConventionCount':sum(x['outcome']=='uncertain' for x in conventions),
            'limitations':['Frozen references remain provisional. Proposed corrections are overlays, not baseline mutation.',
                           'Self-assessed confidence is uncalibrated; same-model independent sessions share error risks.',
                           'Bounded unresolved outcomes remain explicit; no attorney agreement or legal validation is implied.']}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('review_a');parser.add_argument('review_b');args=parser.parse_args()
    raw_a,raw_b=pathlib.Path(args.review_a).read_bytes(),pathlib.Path(args.review_b).read_bytes();out=summarize(json.loads(raw_a),json.loads(raw_b))
    out.update(reviewerASha256=hashlib.sha256(raw_a).hexdigest(),reviewerBSha256=hashlib.sha256(raw_b).hexdigest())
    print(json.dumps(out,indent=2))
