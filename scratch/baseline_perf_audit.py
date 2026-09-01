import os
import re

ROOT = r"C:\Users\manas\OneDrive\Desktop\NARI NIKETAN"

pages = [
    "index.html", "shop.html", "product.html", "cart.html",
    "checkout.html", "seller/index.html", "admin/index.html"
]

print("=== 1. SCRIPT TAG AUDIT PER PAGE ===")
for p in pages:
    fpath = os.path.join(ROOT, p)
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
    scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', content, re.IGNORECASE)
    print(f"\n[{p}] ({len(content):,} bytes HTML, {len(scripts)} scripts):")
    for s in scripts:
        print(f"  • {s}")

print("\n=== 2. LOCAL IMAGE ASSET AUDIT ===")
img_dir = os.path.join(ROOT, "images")
total_img_size = 0
img_count = 0
large_imgs = []
if os.path.exists(img_dir):
    for root_dir, _, files in os.walk(img_dir):
        for file in files:
            fpath = os.path.join(root_dir, file)
            size = os.path.getsize(fpath)
            total_img_size += size
            img_count += 1
            ext = os.path.splitext(file)[1].lower()
            if size > 100 * 1024:
                large_imgs.append((os.path.relpath(fpath, ROOT), size, ext))

print(f"Total images found: {img_count} ({total_img_size / (1024*1024):.2f} MB)")
print(f"Images > 100KB: {len(large_imgs)}")
for path, size, ext in sorted(large_imgs, key=lambda x: x[1], reverse=True)[:15]:
    print(f"  • {path} : {size / 1024:.1f} KB ({ext})")

print("\n=== 3. JS FILE SIZES ===")
js_dir = os.path.join(ROOT, "js")
for f in sorted(os.listdir(js_dir)):
    if f.endswith(".js"):
        fpath = os.path.join(js_dir, f)
        print(f"  • js/{f}: {os.path.getsize(fpath)/1024:.1f} KB")

print("\n=== 4. CSS FILE SIZES ===")
css_dir = os.path.join(ROOT, "css")
for f in sorted(os.listdir(css_dir)):
    if f.endswith(".css"):
        fpath = os.path.join(css_dir, f)
        print(f"  • css/{f}: {os.path.getsize(fpath)/1024:.1f} KB")
