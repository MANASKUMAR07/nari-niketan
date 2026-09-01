import os

admin_html_path = r"C:\Users\manas\OneDrive\Desktop\NARI NIKETAN\admin\index.html"
admin_js_path   = r"C:\Users\manas\OneDrive\Desktop\NARI NIKETAN\js\admin-advanced.js"

# 1. Update admin/index.html
with open(admin_html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Add html2pdf script
if 'html2pdf' not in html:
    html = html.replace('<script src="../js/nari-ops-engine.js', '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>\n<script src="../js/nari-ops-engine.js')

# Add export modal if not present
export_modal_markup = """<!-- Operations Export Modal -->
<div class="modal-overlay hidden" id="modal-ops-export">
  <div class="modal-card" style="max-width:480px;background:#1A0815;border:1.5px solid rgba(212,175,55,0.4);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.7);">
    <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(212,175,55,0.2);padding:1rem 1.25rem;">
      <h3 style="font-family:'Playfair Display',serif;color:#FFE082;margin:0;font-size:1.15rem;">&#x1F4E5; Export Operations Audit Report</h3>
      <button class="btn btn-ghost btn-sm" onclick="NariAdminMonitor.closeExportModal()" style="font-size:1rem;padding:2px 8px;">&times;</button>
    </div>
    <div class="modal-body" style="padding:1.25rem;display:flex;flex-direction:column;gap:0.85rem;">
      <p style="font-size:0.84rem;color:#ECE0E6;margin:0;">
        Select a format to download the complete website operations, security, responsiveness and QA audit report:
      </p>
      
      <button class="btn btn-primary" onclick="NariAdminMonitor.exportPDF()" style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;background:linear-gradient(135deg, #8B1A4A, #5C0E30);border:1px solid #D4AF37;">
        <span style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.35rem;">&#x1F4C4;</span>
          <span style="text-align:left;">
            <strong style="display:block;font-size:0.92rem;color:#FFE082;">PDF Document (.pdf)</strong>
            <small style="color:#ECE0E6;font-size:0.72rem;">Executive summary, 12-pillar scorecard &amp; viewport tables</small>
          </span>
        </span>
        <span style="color:#FFE082;font-weight:700;">&rarr;</span>
      </button>

      <button class="btn btn-outline" onclick="NariAdminMonitor.exportJSON()" style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;">
        <span style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.35rem;">&#x1F4CB;</span>
          <span style="text-align:left;">
            <strong style="display:block;font-size:0.92rem;color:#fff;">JSON Machine Payload (.json)</strong>
            <small style="color:var(--text-dim);font-size:0.72rem;">Full structured diagnostic dataset for APIs &amp; CI</small>
          </span>
        </span>
        <span>&rarr;</span>
      </button>

      <button class="btn btn-outline" onclick="NariAdminMonitor.exportCSV()" style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;">
        <span style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.35rem;">&#x1F4CA;</span>
          <span style="text-align:left;">
            <strong style="display:block;font-size:0.92rem;color:#fff;">CSV Spreadsheet (.csv)</strong>
            <small style="color:var(--text-dim);font-size:0.72rem;">Active incidents list formatted for Excel / Google Sheets</small>
          </span>
        </span>
        <span>&rarr;</span>
      </button>
    </div>
    <div class="modal-footer" style="border-top:1px solid rgba(212,175,55,0.2);padding:0.85rem 1.25rem;display:flex;justify-content:flex-end;">
      <button class="btn btn-outline" onclick="NariAdminMonitor.closeExportModal()">Close</button>
    </div>
  </div>
</div>
"""

if 'id="modal-ops-export"' not in html:
    html = html.replace('<!-- Confirm Dialog -->', export_modal_markup + '\n<!-- Confirm Dialog -->')

with open(admin_html_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Updated admin/index.html with html2pdf script and Export Modal markup!")
