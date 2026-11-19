"""Package the trained word model and classroom examples from FSL-105."""

import csv
import json
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor

import imageio_ffmpeg
import numpy as np

from train_vocabulary import FEATURES, FRAMES, ROOT, SOURCE, digest
from train_vocabulary_full import predict_export
from train_words_expanded import without_depth


LESSONS = [
    ('greetings', 'greetings', 'More greetings', 'GREETING', 6),
    ('family', 'family', 'More family signs', 'FAMILY', 6),
    ('colors', 'food', 'Colors', 'COLOR', 5),
    ('food', 'food', 'More food signs', 'FOOD', 4),
    ('words', 'words', 'More everyday signs', 'SURVIVAL', 4),
    ('days', 'days', 'Days and time', 'DAYS', 5),
    ('months', 'months', 'Months of the year', 'CALENDAR', 6),
    ('people', 'people', 'People', 'RELATIONSHIPS', 5),
    ('drinks', 'drinks', 'Drinks and flavors', 'DRINK', 5),
]
ERRANDS = [
    ('help', 'Asking for help', ('again', 'please', 'problem', 'wait')),
    ('pay', 'Paying at a shop', ('card', 'cash', 'coin', 'receipt')),
    ('shop', 'More at the shop', ('how-many', 'how-much', 'discount', 'welcome')),
]
STARTERS = {f'vocabulary-{n}' for n in range(1, 7)} | {'numbers-11-20'}
DISPLAY_NAMES = {'5': 'I’m Fine', '68': 'Wheelchair Person', '70': 'Deafblind'}


def main():
    renderer = ROOT.parent / 'src' / 'renderer'
    catalog_file = renderer / 'vocabulary.json'
    catalog = [row for row in json.loads(catalog_file.read_text(encoding='utf-8')) if row['id'] in STARTERS]
    existing = {term['id'] for row in catalog for term in row['terms'] if 'id' in term}
    if len(catalog) != 7 or len(existing) != 30:
        raise ValueError('Run train_vocabulary.py to generate the starter lesson catalog first.')
    artifacts = ROOT / 'artifacts'
    report = json.loads((artifacts / 'fsl-words-v3-benchmark.json').read_text())
    word_path = SOURCE / 'fsl-words-v3.json'
    if digest(word_path) != report['model_sha256']:
        raise ValueError('The word model differs from its benchmark.')
    word_model = json.loads(word_path.read_text())
    passing = set(report['combined']['passing'])
    numbers = set(str(n) for n in range(20, 30))
    for row in catalog:
        for term in row['terms']:
            if term.get('id') and term['id'] not in numbers:
                term['camera'] = term['id'] in passing
    with (SOURCE / 'labels.csv').open(encoding='utf-8-sig', newline='') as stream:
        labels = list(csv.DictReader(stream))

    data = np.load(SOURCE / 'features-full-v2.npz')
    eligible = (data['splits'] == 'train') & (data['hands'] >= 2)
    paths, target, vectors = (data[key][eligible] for key in ('paths', 'labels', 'vectors'))
    if word_model['layout'] == 'xy':
        vectors = without_depth(vectors)
    probabilities = predict_export(word_model, vectors.reshape(-1, FRAMES * FEATURES))
    public = renderer / 'public' / 'vocabulary'

    additional = set(row['id'] for row in labels) - existing
    clips = {}
    for label in additional:
        matches = np.flatnonzero(target == label)
        scores = probabilities[matches, word_model['labels'].index(label)]
        clips[label] = str(paths[matches[scores.argmax()]])

    def write_video(item):
        label, path = item
        output = public / f'fsl-{label}.webm'
        temporary = public / f'fsl-{label}.partial.webm'
        if not output.is_file():
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', str(SOURCE / path),
                            '-an', '-c:v', 'libvpx-vp9', '-threads', '2', '-b:v', '170k', '-pix_fmt', 'yuv420p',
                            '-vf', 'scale=480:-2', str(temporary)], check=True)
            temporary.replace(output)

    for slug, category, title, group, size in LESSONS:
        selected = [row['id'] for row in labels if row['category'] == group and row['id'] in clips]
        for index in range(0, len(selected), size):
            part = index // size + 1
            title_text = f'{title} {part}' if len(selected) > size else title
            terms = [dict(id=label, term=DISPLAY_NAMES.get(label, report['labels'][label]),
                          camera=label in passing, source=clips[label]) for label in selected[index:index + size]]
            catalog.append(dict(id=f'vocabulary-{slug}-{part}', title=title_text, category=category, terms=terms))

    for slug, title, keys in ERRANDS:
        terms = [dict(id=key, term=report['labels'][key], camera=key in passing)
                 for key in ('txn-' + value for value in keys)]
        catalog.append(dict(id=f'vocabulary-errands-{slug}', title=title, category='errands', terms=terms))

    ids = [term['id'] for row in catalog for term in row['terms'] if 'id' in term]
    if len(ids) != 117 or len(set(ids)) != 117 or set(ids) != set(word_model['labels']):
        raise ValueError('A trained sign was duplicated or omitted from the classroom catalog.')
    with ThreadPoolExecutor(max_workers=4) as pool:
        for _ in pool.map(write_video, sorted(clips.items())):
            pass
    catalog_file.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
    shutil.copyfile(word_path, artifacts / 'fsl-words-v3.json')
    print(f'Prepared {len(clips)} additional demonstrations and {len(catalog)} lessons and drafts.')


if __name__ == '__main__':
    main()
