from pathlib import Path
from PIL import Image

directory = Path(__file__).resolve().parent
with Image.open(directory.parent / 'branding' / 'BetterGitHub.png') as source:
    for size in (16, 48, 128):
        source.resize((size, size), Image.Resampling.LANCZOS).save(directory / f'icon-{size}.png')
