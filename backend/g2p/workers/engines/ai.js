const { GoogleGenAI } = require('@google/genai');
const pdfParse = require('pdf-parse');
const { marked } = require('marked');
const puppeteer = require('./puppeteer');

/**
 * Summarizes or translates a PDF document using Gemini 1.5 Flash
 * @param {Buffer} inputBuffer 
 * @param {string} action 'summarize' | 'translate'
 * @param {object} config { targetLanguage?: string }
 * @param {function} emitProgress 
 * @returns {Buffer} outputBuffer (Text file)
 */
function getMimeType(buffer) {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  return 'application/pdf';
}

async function processAi(inputBuffer, action, config, emitProgress) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing from environment');

  const ai = new GoogleGenAI({ apiKey });
  let markdownOutput = '';

  if (action === 'ocr') {
    emitProgress(20, "Checking document for native text...");
    let extractedText = '';
    try {
      const data = await pdfParse(inputBuffer);
      extractedText = data.text || '';
    } catch (e) {
      // Probably an image or corrupt PDF
    }

    if (extractedText.trim().length > 50) {
      emitProgress(50, "Native text found! Skipping AI OCR to save credits...");
      markdownOutput = extractedText;
    } else {
      emitProgress(50, "No text found. Running Gemini Vision OCR...");
      const mimeType = getMimeType(inputBuffer);
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            "Extract and transcribe all text from this document perfectly. Preserve the layout as best as you can using Markdown. Do not summarize or add conversational text.",
            { inlineData: { data: inputBuffer.toString("base64"), mimeType } }
          ]
        });
        markdownOutput = response.text;
      } catch (err) {
        throw new Error('Gemini OCR failed: ' + err.message);
      }
    }
  } else if (action === 'markdown') {
    emitProgress(20, "Extracting native PDF markdown...");
    try {
      const { convert } = await import('@pdf2md/core');
      const result = await convert(new Uint8Array(inputBuffer));
      if (result.markdown && result.markdown.trim().length > 50) {
        emitProgress(100, "Markdown extraction complete! (Native)");
        return Buffer.from(result.markdown, 'utf-8');
      }
    } catch(e) {
      console.error("Native pdf2md failed, falling back to AI", e);
    }
    
    emitProgress(50, "No selectable text found. Running AI Markdown extraction...");
    const mimeType = getMimeType(inputBuffer);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          "Extract all text, tables, and content from this document and format it strictly as GitHub Flavored Markdown. Preserve headings, lists, and structure perfectly. Do not add any conversational text.",
          { inlineData: { data: inputBuffer.toString("base64"), mimeType } }
        ]
      });
      emitProgress(100, "Markdown extraction complete! (AI)");
      return Buffer.from(response.text, 'utf-8');
    } catch (err) {
      throw new Error('Gemini Markdown extraction failed: ' + err.message);
    }
  } else {
    emitProgress(20, "Extracting text from PDF...");
    let text = '';
    try {
      const data = await pdfParse(inputBuffer);
      text = data.text || '';
    } catch (e) {
      throw new Error('Failed to read PDF. Ensure it is a valid document.');
    }

    if (text.trim().length === 0) {
      throw new Error('No text found in PDF to process. Try the OCR tool first!');
    }

    emitProgress(50, "Analyzing content with Gemini Flash...");

    let prompt = '';
    if (action === 'summarize') {
      prompt = `Please provide a concise, well-structured summary of the following document text:\n\n${text.substring(0, 100000)}`;
    } else if (action === 'translate') {
      const lang = config.targetLanguage || 'English';
      prompt = `Translate the following text to ${lang}. Preserve the original formatting as much as possible:\n\n${text.substring(0, 100000)}`;
    } else {
      throw new Error(`Unknown AI action: ${action}`);
    }

    emitProgress(70, `Generating ${action}...`);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      markdownOutput = response.text;
    } catch (err) {
      throw new Error('Gemini API failed: ' + err.message);
    }
  }

  emitProgress(80, "Formatting document to PDF...");
  const htmlContent = marked.parse(markdownOutput);

    // Create a beautifully styled HTML template with watermark and logo
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: #1A1A1A;
            margin: 0;
            padding: 40px;
            position: relative;
          }
          /* Watermark background */
          body::before {
            content: 'Share2Me';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: 800;
            color: rgba(0, 0, 0, 0.04);
            z-index: -1;
            pointer-events: none;
            white-space: nowrap;
          }
          .header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #FBC02D;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: 800;
            color: #1A1A1A;
            letter-spacing: -1px;
            background: #FBC02D;
            padding: 4px 12px;
            border-radius: 4px;
            margin-right: 15px;
          }
          .title {
            font-size: 24px;
            font-weight: 600;
            color: #666;
          }
          h1, h2, h3 {
            color: #1A1A1A;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          h1 { font-size: 2.2em; border-bottom: 1px solid #eaeaea; padding-bottom: 0.3em; }
          h2 { font-size: 1.8em; }
          p { margin-bottom: 1em; }
          ul, ol { margin-bottom: 1.5em; padding-left: 20px; }
          li { margin-bottom: 0.5em; }
          strong { color: #000; font-weight: 600; }
          blockquote {
            border-left: 4px solid #FBC02D;
            margin: 1.5em 0;
            padding: 0.5em 20px;
            color: #555;
            background: #fffdf5;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Share2Me</div>
          <div class="title">AI ${action === 'summarize' ? 'Summary' : 'Translation'} Report</div>
        </div>
        <div class="content">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;

    emitProgress(90, "Rendering PDF...");
    const pdfBuffer = await puppeteer.processHtmlToPdf(Buffer.from(styledHtml, 'utf-8'), (pct, msg) => {
      // Scale puppeteer's 0-100 progress into our remaining 90-100 range if needed, or just let it update
    });

    return pdfBuffer;
}

module.exports = {
  processAi
};
