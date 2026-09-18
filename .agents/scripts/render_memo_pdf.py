from pathlib import Path
import fitz

pdf_path = Path("attached_assets/LandLinq_Deal_Memo_-_White-Label_Example_(Meridian_Capital)_1789758900651.pdf")
output_dir = Path(".agents/outputs/memo-pages")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
print(f"pages={document.page_count}")
for page_number, page in enumerate(document, start=1):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    output_path = output_dir / f"page-{page_number:02d}.png"
    pixmap.save(output_path)
    print(output_path)