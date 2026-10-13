const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('⚡ Generating OhmScript Syntax Guide PDF...');

  const mdPath = path.resolve(__dirname, '../docs/OHMSCRIPT_SYNTAX_GUIDE.md');
  const tempHtmlPath = path.resolve(__dirname, '../docs/temp_body.html');
  const fullHtmlPath = path.resolve(__dirname, '../docs/styled_guide.html');
  const projectPdfPath = path.resolve(__dirname, '../docs/OHMSCRIPT_SYNTAX_GUIDE.pdf');
  const downloadsPdfPath = path.resolve('/Users/abhinavsahu/Downloads/OHMSCRIPT_SYNTAX_GUIDE.pdf');

  // 1. Convert Markdown to HTML via marked CLI
  execSync(`npx -y marked -i "${mdPath}" --gfm > "${tempHtmlPath}"`, { stdio: 'inherit' });

  const bodyHtml = fs.readFileSync(tempHtmlPath, 'utf8');

  // 2. Wrap in high-quality printable document HTML
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OhmScript DSL: Complete Syntax Guide Book</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11.5px;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    .header-banner {
      background: linear-gradient(135deg, #090d16 0%, #0f172a 100%);
      color: #ffffff;
      padding: 24px 28px;
      border-radius: 10px;
      margin-bottom: 24px;
      border: 1px solid #1e293b;
    }

    .header-banner h1 {
      margin: 0 0 6px 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #38bdf8;
      border-bottom: none;
      padding-bottom: 0;
    }

    .header-banner .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 12px;
      font-weight: 500;
    }

    .header-banner .meta-tags {
      display: flex;
      gap: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
    }

    .header-banner .tag {
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
    }

    h1, h2, h3, h4, h5 {
      color: #0f172a;
      font-weight: 700;
      page-break-after: avoid;
      break-after: avoid;
    }

    h1 {
      font-size: 20px;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    h2 {
      font-size: 15px;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 22px;
      margin-bottom: 10px;
      color: #0369a1;
    }

    h3 {
      font-size: 13px;
      margin-top: 16px;
      margin-bottom: 6px;
      color: #0284c7;
    }

    h4 {
      font-size: 12px;
      margin-top: 12px;
      margin-bottom: 4px;
      color: #334155;
    }

    p {
      margin-top: 0;
      margin-bottom: 8px;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 10px;
      padding-left: 20px;
    }

    li {
      margin-bottom: 3px;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }

    /* Code Blocks */
    pre {
      background: #0f172a;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      line-height: 1.45;
      padding: 12px 14px;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid #1e293b;
      margin: 10px 0 14px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    pre code {
      background: transparent !important;
      color: inherit !important;
      padding: 0 !important;
      border: none !important;
      font-size: inherit;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1.5px 4.5px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin: 12px 0 16px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    th {
      background: #1e293b;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #cbd5e1;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    td {
      padding: 6px 9px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Blockquotes */
    blockquote {
      margin: 10px 0;
      padding: 8px 14px;
      background: #f0f9ff;
      border-left: 3.5px solid #0284c7;
      color: #0369a1;
      font-size: 11px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 9.5px;
      color: #64748b;
      text-align: center;
      font-family: ui-monospace, monospace;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>⚡ OhmScript DSL: The Complete Syntax Guide</h1>
    <div class="subtitle">Ohmic Electronic Circuit Workbench &amp; Physical SPICE Simulation Engine</div>
    <div class="meta-tags">
      <span class="tag">SPECIFICATION v2.0</span>
      <span class="tag">34 HARDWARE COMPONENTS</span>
      <span class="tag">PHYSICS ENGINE</span>
      <span class="tag">CAD SPEC</span>
    </div>
  </div>

  ${bodyHtml}

  <div class="footer">
    Ohmic Electronic Circuit Workbench • OhmScript Hardware Description Language v2.0 • Generated for Device Archive
  </div>
</body>
</html>`;

  fs.writeFileSync(fullHtmlPath, fullHtml, 'utf8');
  console.log(`✓ Generated styled HTML: ${fullHtmlPath}`);

  // 3. Invoke Google Chrome Headless to print to PDF
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeCmd = `"${chromePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${projectPdfPath}" "${fullHtmlPath}"`;

  console.log('🖨️ Running Chrome headless PDF engine...');
  execSync(chromeCmd, { stdio: 'inherit' });

  // 4. Copy to user's main Downloads directory
  fs.copyFileSync(projectPdfPath, downloadsPdfPath);

  // 5. Clean up temporary files
  if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);

  const stats = fs.statSync(projectPdfPath);
  console.log(`\n🎉 PDF Successfully Generated!`);
  console.log(`📁 Project PDF: ${projectPdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log(`📥 Downloads Folder: ${downloadsPdfPath}`);
}

main().catch((err) => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
