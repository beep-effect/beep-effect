#!/usr/bin/env python3
"""Observe actual default return branches without repeating native key operations."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import runpy
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    sys.path.insert(0, str(root))
    import eyecite
    import eyecite.resolve as resolver
    import eyecite.models as models
    original = eyecite.resolve_citations
    source = root / 'eyecite/resolve.py'
    tree = ast.parse(source.read_text())
    id_returns = [node.lineno for function in tree.body if isinstance(function, ast.FunctionDef) and function.name == '_resolve_id_citation' for node in ast.walk(function) if isinstance(node, ast.Return) and isinstance(node.value, ast.Constant) and node.value.value is None]
    id_returns.sort()
    assert len(id_returns) == 2
    callbacks = {'_resolve_shortcase_citation': 'short_citation', '_resolve_supra_citation': 'supra_citation', '_resolve_reference_citation': 'reference_citation', '_resolve_id_citation': 'id_citation'}
    helpers = {'_filter_by_matching_antecedent', '_filter_by_matching_plaintiff_or_defendant_or_resolved_names'}
    runs = []
    builtin_len = len
    def observed(citations):
        indices = {id(cite): index for index, cite in enumerate(citations)}
        def member(value):
            if isinstance(value, models.Resource): value = value.citation
            return indices.get(id(value))
        def normalized(groups):
            return [[indices[id(cite)] for cite in group] for group in groups.values()]
        def hooks(frame, event, trace):
            if event == 'call' and frame.f_code.co_filename == str(root / 'eyecite/models.py') and frame.f_code.co_name in ('__hash__', '__eq__'):
                trace.append({'method': frame.f_code.co_qualname, 'self': member(frame.f_locals.get('self')), 'other': member(frame.f_locals.get('other'))})
        baseline_trace = []
        def baseline(frame, event, arg):
            hooks(frame, event, baseline_trace)
            return baseline
        sys.settrace(baseline)
        try:
            base = {'status': 'value', 'groups': normalized(original(citations))}
        except (KeyError, ValueError, AttributeError) as error:
            base = {'status': 'error', 'kind': type(error).__name__}
        finally:
            sys.settrace(None)
        decisions = {i: {'index': i, 'status': 'Unresolved', 'reason': 'unsupported-citation'} for i, cite in enumerate(citations) if type(cite) is models.UnknownCitation}
        counts = {}
        candidate_rows = {}
        failed = set()
        trace = []
        def observed_len(value):
            count = builtin_len(value)
            caller = sys._getframe(1)
            if caller.f_code.co_filename == str(source) and caller.f_code.co_name == '_resolve_shortcase_citation' and isinstance(value, set):
                counts[id(caller)] = count
            return count
        def observer(frame, event, arg):
            hooks(frame, event, trace)
            if frame.f_code.co_filename != str(source): return observer
            name = frame.f_code.co_name
            if event == 'exception': failed.add(id(frame))
            if event != 'return' or id(frame) in failed: return observer
            if name in helpers:
                parent = frame.f_back
                if parent.f_code.co_name in callbacks:
                    cite = parent.f_locals[callbacks[parent.f_code.co_name]]
                    matches = frame.f_locals['matches']
                    candidate_rows[indices[id(cite)]] = [member(value) for value in matches]
            if name in callbacks:
                index = indices[id(frame.f_locals[callbacks[name]])]
                if arg is not None:
                    decisions[index] = {'index': index, 'status': 'Resolved'}
                elif name == '_resolve_id_citation':
                    reason = {id_returns[0]: 'no-previous-authority', id_returns[1]: 'invalid-pin-cite'}[frame.f_lineno]
                    decisions[index] = {'index': index, 'status': 'Unresolved', 'reason': reason}
                else:
                    if index in candidate_rows:
                        candidates = candidate_rows[index]
                        count = builtin_len(candidates)
                    elif name == '_resolve_shortcase_citation':
                        count = counts[id(frame)]
                        candidates = [member(resource) for _, resource in frame.f_locals['candidates']]
                    else:
                        decisions[index] = {'index': index, 'status': 'Unresolved', 'reason': 'missing-antecedent'}
                        return observer
                    decisions[index] = {'index': index, 'status': 'Ambiguous', 'distinctCount': count} if count > 1 else {'index': index, 'status': 'Unresolved', 'reason': 'no-matching-authority'}
                    if count > 1 and candidates: decisions[index]['candidateIndices'] = candidates
            return observer
        resolver.len = observed_len
        sys.settrace(observer)
        try:
            result = original(citations)
            outcome = {'status': 'value', 'groups': normalized(result)}
        except (KeyError, ValueError, AttributeError) as error:
            outcome = {'status': 'error', 'kind': type(error).__name__}
            result = None
        finally:
            sys.settrace(None)
            del resolver.len
        assert base == outcome and baseline_trace == trace
        if outcome['status'] == 'value':
            for index, cite in enumerate(citations):
                if isinstance(cite, models.FullCitation): decisions[index] = {'index': index, 'status': 'Resolved'}
            assert sorted(decisions) == list(range(builtin_len(citations)))
        runs.append({'decisions': [decisions[i] for i in sorted(decisions)] if outcome['status'] == 'value' else [], 'outcome': outcome, 'nativeTrace': trace})
        if outcome['status'] == 'error':
            raise {'KeyError': KeyError, 'ValueError': ValueError, 'AttributeError': AttributeError}[outcome['kind']]('observed source error')
        return result
    eyecite.resolve_citations = observed
    producer = Path(__file__).with_name('probe-default-resolution.py')
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / 'contexts.json'
        sys.argv = [str(producer), '--oracle-root', str(root), '--output', str(output)]
        runpy.run_path(str(producer), run_name='__main__')
        contexts = json.loads(output.read_bytes())
    assert len(runs) == len(contexts['cases']) == 46
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    report = {'schemaVersion': 'citation-default-observations/v1', 'oracleCommit': contexts['oracleCommit'], 'oracleTree': contexts['oracleTree'], 'producerSha256': sha(Path(__file__)), 'contextProducerSha256': sha(producer), 'contextFixtureSha256': sha(Path(__file__).resolve().parents[3] / 'packages/law-practice/use-cases/test/fixtures/eyecite/default-resolution-cases.json'), 'sources': {'resolve.py': sha(source), 'models.py': sha(root / 'eyecite/models.py')}, 'licenseSha256': contexts['licenseSha256'], 'lockSha256': contexts['lockSha256'], 'python': '3.11.15', 'pythonHashSeed': '0', 'cases': [{'name': context['name'], **run} for context, run in zip(contexts['cases'], runs)]}
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(runs)} default branch histories; native traces equal baseline')


if __name__ == '__main__': main()
