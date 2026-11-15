"""Encode the latest owned Playwriter takes into GIFs and static PNG alternatives."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
FRAMES = ROOT / '.artifacts/change-37/frames'
OUTPUT = ROOT / 'docs/media'
NAMES = ('writing', 'fragment-editing', 'math-boards')


def run(arguments):
    return subprocess.run(arguments, check=True, capture_output=True, text=True).stdout


def encode():
    OUTPUT.mkdir(exist_ok=True)
    assets = []
    selected = []
    for name in NAMES:
        takes = [p for p in (FRAMES / name).glob('take-*/frames.json')]
        if not takes:
            raise SystemExit(f'No finished take for {name}; record it with Playwriter first.')
        source = max(takes, key=lambda p: int(p.parent.name.split('-')[1]))
        take = json.loads(source.read_text())
        selected.append((name, source, take))
    commits = {take.get('applicationCommit', '') for _, _, take in selected}
    if len(commits) != 1 or not re.fullmatch(r'[0-9a-f]{40}', next(iter(commits))):
        raise SystemExit('Finished takes must record the same verified capture applicationCommit.')
    application_commit = next(iter(commits))
    for name, source, take in selected:
        frames = take['frames']
        total = sum(frame['weight'] for frame in frames)
        listing = source.parent / 'encode.txt'
        lines = []
        for frame in frames:
            file = Path(frame['file']).resolve()
            if not file.is_relative_to(FRAMES.resolve()) or "'" in str(file):
                raise SystemExit('Only owned frame paths are supported.')
            lines.extend([f"file '{file}'", f"duration {frame['weight'] / total * take['seconds']:.8f}"])
        lines.append(f"file '{Path(frames[-1]['file']).resolve()}'")
        listing.write_text('\n'.join(lines) + '\n')
        gif = OUTPUT / f'{name}.gif'
        poster = OUTPUT / f'{name}.png'
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '1',
             '-f', 'concat', '-safe', '0', '-i', str(listing), '-filter_complex',
             '[0:v]fps=10,scale=960:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=0[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle[v]',
             '-map', '[v]', '-loop', '0', str(gif)])
        source_poster = Path(take['poster']).resolve()
        if not source_poster.is_relative_to(FRAMES.resolve()):
            raise SystemExit('Only owned poster paths are supported.')
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source_poster),
             '-vf', 'scale=960:-2:flags=lanczos', '-frames:v', '1', str(poster)])
        probe = json.loads(run(['ffprobe', '-v', 'error', '-show_entries',
                               'stream=width,height,nb_frames:format=duration,size', '-of', 'json', str(gif)]))
        stream = probe['streams'][0]
        duration = float(probe['format']['duration'])
        if gif.stat().st_size > 3 * 1024 * 1024 or not 8 <= duration <= 12.2:
            raise SystemExit(f'{name}: GIF exceeds its size/duration budget.')
        if (stream['width'], stream['height']) != (960, 600):
            raise SystemExit(f'{name}: unexpected dimensions.')
        assets.append({
            'name': name, 'gif': gif.name, 'poster': poster.name,
            'width': stream['width'], 'height': stream['height'],
            'seconds': duration, 'frames': int(stream['nb_frames']),
            'sourceFrames': len(frames), 'bytes': gif.stat().st_size,
            'sha256': hashlib.sha256(gif.read_bytes()).hexdigest(),
            'posterSha256': hashlib.sha256(poster.read_bytes()).hexdigest(),
        })
    manifest = {
        'applicationCommit': application_commit,
        'capture': 'Production Pages build in Windows Chrome through Playwriter; authored demo notes and scripted mouse input. Playback is paced for explanation, not a physical-pen or latency measurement.',
        'source': ['scripts/media/capture.mjs', 'scripts/media/handwriting.mjs', 'scripts/media/encode.py'],
        'assets': assets,
    }
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(assets, indent=2))


if __name__ == '__main__':
    encode()
