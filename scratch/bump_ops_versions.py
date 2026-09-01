import os

admin_html_path = r"C:\Users\manas\OneDrive\Desktop\NARI NIKETAN\admin\index.html"

with open(admin_html_path, "r", encoding="utf-8") as f:
    content = f.read()

# Ensure version bumps are present
content = content.replace('admin-advanced.js?v=4.6', 'admin-advanced.js?v=5.0')
content = content.replace('nari-ops-center.css?v=2.0', 'nari-ops-center.css?v=2.1')
content = content.replace('nari-ops-engine.js?v=2.0', 'nari-ops-engine.js?v=2.1')

with open(admin_html_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Bumped version to v=5.0 in admin/index.html")
