#!/usr/bin/env python3
"""Capture pinned cleaner composition, lazy steps, dispatch and callback state."""
import argparse
import hashlib
import importlib.metadata
import itertools
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
OPERATION_SHA = 'ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(['git', '-C', str(root), *parts], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == 'cpython'
    assert os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    assert sys.hash_info.width == 64 and sys.hash_info.algorithm == 'siphash13'
    sys.path.insert(0, str(root))
    from eyecite import clean
    import lxml.html
    from lxml import etree
    versions = {name: importlib.metadata.version(name) for name in ['eyecite', 'reporters-db', 'courts-db', 'lxml']}
    assert versions == {'eyecite': '2.7.6', 'reporters-db': '3.2.53', 'courts-db': '0.10.22', 'lxml': '5.1.0'}
    assert etree.LIBXML_VERSION == etree.LIBXML_COMPILED_VERSION == (2, 12, 3)
    repo = Path(__file__).resolve().parents[3]
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    canonical = lambda value: json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')
    source_path = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json'
    assert sha(source_path) == OPERATION_SHA
    official = [row for row in json.loads(source_path.read_bytes())['cases'] if row['operation'] == 'clean_text']
    assert len(official) == 12
    originals = dict(clean.cleaners_lookup)
    names = list(originals)
    assert names == ['html', 'inline_whitespace', 'all_whitespace', 'underscores', 'xml']
    builtin_codes = {value.__code__: name for name, value in originals.items()}
    artifacts = {}
    rows = []

    def intern(value):
        digest = hashlib.sha256(canonical(value)).hexdigest()
        assert digest not in artifacts or artifacts[digest] == value
        artifacts[digest] = value
        return digest

    def observe(name, family, configure, official_row=None):
        events, objects, frames = [], [], {}
        def slot(value):
            for index, existing in enumerate(objects):
                if value is existing: return index
            objects.append(value)
            return len(objects) - 1
        class MarkedText(str): pass
        class HostValue: pass
        def present(value):
            if isinstance(value, str):
                return {'kind': 'text', 'text': intern(value), 'subtype': 'marked' if isinstance(value, MarkedText) else 'plain'}
            if value is None: return {'kind': 'none'}
            if type(value) is bool: return {'kind': 'bool', 'value': value}
            if type(value) is int: return {'kind': 'int', 'value': str(value)}
            if type(value) is bytes: return {'kind': 'bytes', 'hex': value.hex()}
            if type(value) is list: return {'kind': 'list', 'slot': slot(value), 'items': [present(item) for item in value]}
            if isinstance(value, HostValue): return {'kind': 'host', 'slot': slot(value)}
            if isinstance(value, Callback): return {'kind': 'callback', 'name': value.name}
            if isinstance(value, Step): return {'kind': 'step', 'mode': value.mode}
            for key, function in originals.items():
                if value is function: return {'kind': 'builtin-function', 'name': key}
            raise AssertionError('unclassified controlled value type: ' + type(value).__qualname__)
        def error_value(error):
            return {'kind': 'failure', 'pythonType': type(error).__module__ + '.' + type(error).__qualname__, 'message': intern(str(error)), 'arguments': [present(value) for value in error.args]}
        class Callback:
            def __init__(self, callback_name, body): self.name, self.body, self.count = callback_name, body, 0
            def __call__(self, value):
                self.count += 1
                events.append({'kind': 'callback-enter', 'name': self.name, 'call': self.count, 'value': present(value)})
                try: result = self.body(value)
                except Exception as error:
                    events.append({'kind': 'callback-raise', 'name': self.name, 'failure': error_value(error)})
                    raise
                events.append({'kind': 'callback-return', 'name': self.name, 'value': present(result)})
                return result
        class Answer:
            def __init__(self, truth): self.truth = truth
            def __bool__(self):
                events.append({'kind': 'equality-bool', 'result': self.truth})
                return self.truth
        class Step:
            def __init__(self, mode): self.mode, self.hash_calls = mode, 0
            def __repr__(self): return '<ControlledCleanerStep>'
            def __hash__(self):
                self.hash_calls += 1
                events.append({'kind': 'step-hash', 'mode': self.mode, 'call': self.hash_calls})
                if self.mode == 'hash-raises': raise ValueError('hash-stopped')
                if self.mode == 'delete-second-hash' and self.hash_calls == 2: del clean.cleaners_lookup['html']
                key = 'underscores' if self.mode == 'switch-hash' and self.hash_calls > 1 else 'missing' if self.mode == 'miss' else 'html'
                result = hash(key)
                events.append({'kind': 'step-hash-return', 'raw': str(result)})
                return result
            def __eq__(self, other):
                events.append({'kind': 'step-equality', 'mode': self.mode, 'other': present(other)})
                if self.mode == 'equality-raises': raise ValueError('equality-stopped')
                if self.mode == 'delete-during-equality': clean.cleaners_lookup.pop('html', None)
                if self.mode == 'false-equality': return Answer(False)
                if self.mode == 'true-equality': return Answer(True)
                return True
            def __call__(self, value):
                events.append({'kind': 'step-call', 'mode': self.mode, 'value': present(value)})
                return 'CALLBACK'
        class Unhashable(Callback):
            __hash__ = None
        class CallableText(str):
            def __call__(self, value):
                events.append({'kind': 'callable-text-called'})
                return 'CALLBACK'
        def describe_step(value):
            if isinstance(value, CallableText): return {'kind': 'callable-text', 'text': intern(value)}
            return present(value)
        def lazy(values, failure_at=None, generator=False):
            def iterate():
                events.append({'kind': 'iterator-enter'})
                index = 0
                while index < len(values):
                    if index == failure_at:
                        events.append({'kind': 'iterator-raise', 'index': index})
                        raise ValueError('iterator-stopped')
                    value = values[index]
                    events.append({'kind': 'iterator-yield', 'index': index, 'value': describe_step(value)})
                    yield value
                    index += 1
                events.append({'kind': 'iterator-complete'})
            if generator: return iterate()
            class LazySteps:
                def __iter__(self): return iterate()
            return LazySteps()
        def raise_marker(value): raise ValueError('callback-stopped')
        environment = {'Callback': Callback, 'Step': Step, 'Unhashable': Unhashable, 'CallableText': CallableText, 'MarkedText': MarkedText, 'HostValue': HostValue, 'lazy': lazy, 'raise': raise_marker, 'events': events}
        clean.cleaners_lookup.clear()
        clean.cleaners_lookup.update(originals)
        text, steps, descriptor, repeat = configure(environment)
        initial = present(text)
        def diagnostics():
            return [{'domain': item.domain_name, 'type': item.type_name, 'level': item.level_name, 'resourceLimit': item.type_name in ['ERR_NAME_TOO_LONG', 'ERR_NO_MEMORY', 'XPATH_MEMORY_ERROR'] or item.message.startswith('Excessive depth in document:') or 'Huge input lookup' in item.message} for item in lxml.html.html_parser.error_log]
        def trace(frame, event, arg):
            if event == 'call' and frame.f_code in builtin_codes:
                function_name = builtin_codes[frame.f_code]
                frames[frame] = {'name': function_name, 'failure': None}
                value = frame.f_locals['html_content' if function_name == 'html' else 'text']
                events.append({'kind': 'builtin-enter', 'name': function_name, 'value': present(value)})
                return trace
            if frame not in frames: return None
            state = frames[frame]
            if event == 'exception':
                state['failure'] = error_value(arg[1])
                events.append({'kind': 'builtin-raise', 'name': state['name'], 'failure': state['failure']})
            elif event == 'return':
                if state['failure'] is None: events.append({'kind': 'builtin-return', 'name': state['name'], 'value': present(arg)})
                if state['name'] == 'html':
                    rejected = state['failure'] is not None and state['failure']['pythonType'] == 'builtins.ValueError'
                    events.append({'kind': 'html-diagnostics', 'items': [] if rejected else diagnostics()})
                del frames[frame]
            return trace
        outcomes = []
        prior_trace = sys.gettrace()
        try:
            assert prior_trace is None
            sys.settrace(trace)
            for index in range(repeat):
                events.append({'kind': 'run-enter', 'index': index})
                try:
                    result = clean.clean_text(text, steps)
                    outcome = {'kind': 'success', 'value': present(result), 'sameAsInput': result is text}
                except Exception as error: outcome = error_value(error)
                outcomes.append(outcome)
                events.append({'kind': 'run-complete', 'index': index, 'outcome': outcome})
            if official_row is not None:
                expected = json.loads(official_row['payload'])['outcome']
                observed = outcomes[0]
                assert observed['kind'] == expected['kind']
                if observed['kind'] == 'success': assert artifacts[observed['value']['text']] == expected['value']
                else: assert observed['pythonType'] == expected['pythonType'] and artifacts[observed['message']] == expected['message']
            lookup = [{'key': describe_step(key), 'value': present(value)} for key, value in clean.cleaners_lookup.items()]
        finally:
            sys.settrace(prior_trace)
            clean.cleaners_lookup.clear()
            clean.cleaners_lookup.update(originals)
        assert not frames
        row = {'name': name, 'family': family, 'input': initial, 'steps': descriptor, 'runs': outcomes, 'events': events, 'lookupAfter': lookup}
        if official_row is not None: row['officialId'] = official_row['id']
        rows.append(row)

    texts = ['', '  A\t B___\nC_ ', '<p> A__</p><p>B\tC</p>', "<?xml version='1' encoding='UTF-8'?><p>A___</p>", '\ufeff😀\u200b__ A\r\nB', '<div class="star-pagination">HIDE<b>CHILD</b>TAIL</div><script>X</script> END', '\ud800__A\t\udfff']
    sequences = [list(sequence) for size in range(4) for sequence in itertools.product(names, repeat=size)]
    for text_index, text in enumerate(texts):
        for sequence_index, sequence in enumerate(sequences):
            observe(f'named:{text_index}:{sequence_index}', 'named', lambda _, text=text, sequence=sequence: (text, list(sequence), {'kind': 'list', 'names': sequence}, 1))
    for index, row in enumerate(official):
        value = json.loads(row['payload'])['input']
        observe(f'official:{index}', 'official', lambda _, value=value: (value['text'], value['steps'], {'kind': 'list', 'names': value['steps']}, 1), row)

    def scene(name):
        def configure(e):
            Callback, Step = e['Callback'], e['Step']
            text = '<b> A___\tB </b>'
            suffix = Callback('suffix', lambda value: value + '!')
            identity = Callback('identity', lambda value: value)
            steps, repeat = [identity], 1
            if name == 'repeated-callback': steps = [suffix, suffix]
            elif name == 'callback-raises': steps = [Callback('raise', e['raise']), suffix]
            elif name in ['return-none', 'none-to-text', 'none-to-builtin']:
                steps = [Callback('none', lambda _: None)]
                if name == 'none-to-text': steps.append(Callback('restore', lambda _: 'RESTORED'))
                if name == 'none-to-builtin': steps.append('inline_whitespace')
            elif name in ['return-int', 'int-to-text', 'int-to-builtin']:
                steps = [Callback('int', lambda _: 7)]
                if name == 'int-to-text': steps.append(Callback('restore', lambda _: 'RESTORED'))
                if name == 'int-to-builtin': steps.append('underscores')
            elif name in ['return-bytes', 'bytes-to-text', 'bytes-to-builtin']:
                steps = [Callback('bytes', lambda _: b'A__B')]
                if name == 'bytes-to-text': steps.append(Callback('decode', lambda value: value.decode('ascii')))
                if name == 'bytes-to-builtin': steps.append('all_whitespace')
            elif name in ['return-host', 'host-to-text']:
                host = e['HostValue']()
                steps = [Callback('host', lambda _: host)]
                if name == 'host-to-text':
                    def consume(value):
                        assert value is host
                        return 'SAME-HOST'
                    steps.append(Callback('consume', consume))
            elif name == 'live-list-value':
                value = ['A']
                def mutate(incoming):
                    assert incoming is value
                    incoming.append('B')
                    return incoming
                steps = [Callback('list', lambda _: value), Callback('mutate', mutate), Callback('join', lambda value: ''.join(value))]
            elif name == 'return-text-subclass': steps = [Callback('marked', lambda _: e['MarkedText']('MARKED'))]
            elif name == 'empty-text-subclass': text, steps = e['MarkedText']('MARKED'), []
            elif name == 'subclass-to-builtin': text, steps = e['MarkedText']('A__B'), ['underscores']
            elif name == 'builtin-function-step': steps = [clean.html, suffix]
            elif name == 'callable-text-key': steps = [e['CallableText']('html')]
            elif name == 'unknown-stops': steps = ['invalid', suffix]
            elif name == 'unhashable-stops': steps = [[], suffix]
            elif name == 'unhashable-callable': steps = [e['Unhashable']('uncalled', lambda _: 'WRONG')]
            elif name == 'integer-step': steps = [1, suffix]
            elif name == 'bytes-step': steps = [b'html', suffix]
            elif name == 'steps-none': steps = None
            elif name == 'steps-string': steps = 'html'
            elif name == 'steps-empty-string': steps = ''
            elif name in ['lazy-sequence', 'generator-sequence', 'reused-generator', 'iterator-raises', 'iterator-raises-first']:
                steps = e['lazy']([suffix, 'html', suffix], failure_at=1 if name == 'iterator-raises' else 0 if name == 'iterator-raises-first' else None, generator=name in ['generator-sequence', 'reused-generator'])
                if name == 'reused-generator': repeat = 2
            elif name == 'live-step-append':
                values = []
                def append(value):
                    values.append(suffix)
                    return value
                values.append(Callback('append-step', append))
                steps = e['lazy'](values)
            elif name == 'live-step-remove':
                values = []
                def remove(value):
                    del values[1]
                    return value
                values.extend([Callback('remove-step', remove), suffix, 'html'])
                steps = e['lazy'](values)
            elif name in ['registry-replace', 'registry-delete', 'registry-add', 'registry-noncallable', 'registry-function-key']:
                replacement = Callback('registered', lambda value: value + ':REGISTERED')
                def update(value):
                    if name == 'registry-replace': clean.cleaners_lookup['html'] = replacement
                    elif name == 'registry-delete': del clean.cleaners_lookup['html']
                    elif name == 'registry-add': clean.cleaners_lookup['added'] = replacement
                    elif name == 'registry-noncallable': clean.cleaners_lookup['html'] = 7
                    else: clean.cleaners_lookup[clean.html] = replacement
                    return value
                steps = [Callback('update-registry', update), 'added' if name == 'registry-add' else clean.html if name == 'registry-function-key' else 'html']
            elif name == 'reentrant': steps = [Callback('nested', lambda value: clean.clean_text(value, ['html', suffix])), suffix]
            elif name == 'state-across-runs':
                suffix.body = lambda value: value + str(suffix.count)
                steps, repeat = [suffix], 2
            elif name == 'resource-before-callback': text, steps = '<div>' * 256 + 'VISIBLE' + '</div>' * 256, ['html', suffix]
            elif name.startswith('dispatch:'):
                mode = name.split(':', 1)[1]
                steps = [Step(mode)]
                if mode == 'delete-second-hash': repeat = 2
            else: raise AssertionError('unknown scene: ' + name)
            descriptor = {'kind': 'controlled', 'scene': name, 'repeat': repeat}
            return text, steps, descriptor, repeat
        observe(name, 'custom', configure)

    scenes = ['repeated-callback', 'callback-raises', 'return-none', 'none-to-text', 'none-to-builtin', 'return-int', 'int-to-text', 'int-to-builtin', 'return-bytes', 'bytes-to-text', 'bytes-to-builtin', 'return-host', 'host-to-text', 'live-list-value', 'return-text-subclass', 'empty-text-subclass', 'subclass-to-builtin', 'builtin-function-step', 'callable-text-key', 'unknown-stops', 'unhashable-stops', 'unhashable-callable', 'integer-step', 'bytes-step', 'steps-none', 'steps-string', 'steps-empty-string', 'lazy-sequence', 'generator-sequence', 'reused-generator', 'iterator-raises', 'iterator-raises-first', 'live-step-append', 'live-step-remove', 'registry-replace', 'registry-delete', 'registry-add', 'registry-noncallable', 'registry-function-key', 'reentrant', 'state-across-runs', 'resource-before-callback']
    scenes += ['dispatch:' + mode for mode in ['match', 'miss', 'switch-hash', 'hash-raises', 'equality-raises', 'true-equality', 'false-equality', 'delete-during-equality', 'delete-second-hash']]
    for name in scenes: scene(name)
    assert not git('status', '--porcelain') and list(clean.cleaners_lookup) == names
    report = {'schemaVersion': 'citation-cleaner-pipeline/v1', 'scope': 'source observations; composed target and host-value/iteration/registry contracts remain open', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'pythonHashSeed': '0', 'hashWidth': 64, 'hashAlgorithm': 'siphash13', 'license': 'BSD-2-Clause', 'producerSha256': sha(Path(__file__)), 'sources': {'clean.py': sha(root / 'eyecite/clean.py'), 'tests/test_UtilsTest.py': sha(root / 'tests/test_UtilsTest.py')}, 'licenseSha256': sha(root / 'LICENSE'), 'lockSha256': sha(root / 'uv.lock'), 'operationCorpusSha256': OPERATION_SHA, 'versions': versions, 'libxmlRuntime': list(etree.LIBXML_VERSION), 'libxmlCompiled': list(etree.LIBXML_COMPILED_VERSION), 'builtinNames': names, 'namedTextCount': len(texts), 'namedSequenceCount': len(sequences), 'customScenes': scenes, 'artifacts': [{'sha256': digest, 'value': artifacts[digest]} for digest in sorted(artifacts)], 'cases': rows}
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(rows)} source cleaner cases / {len(scenes)} custom scenes / {len(artifacts)} immutable strings')


if __name__ == '__main__': main()
