from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

directory = Path(__file__).resolve().parent
font_path = Path(r'C:\Windows\Fonts\arialbd.ttf')
for size in (16, 48, 128):
    scale = 4
    canvas = Image.new('RGBA', (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    edge = size * scale
    draw.rounded_rectangle((0, 0, edge - 1, edge - 1), radius=edge // 5, fill='#0b1110')
    draw.rectangle((edge * .73, edge * .12, edge * .88, edge * .27), fill='#00b927')
    font = ImageFont.truetype(str(font_path), int(edge * .64))
    draw.text((edge * .17, edge * .10), 'G', font=font, fill='#f1f6f3', stroke_width=0)
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(directory / f'icon-{size}.png')
