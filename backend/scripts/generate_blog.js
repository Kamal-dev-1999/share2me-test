require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

// Initialize Google Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize AWS S3 Client
const s3Config = {
  region: process.env.AWS_REGION || 'ap-south-1',
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3 = new S3Client(s3Config);

const BUCKET_NAME = (process.env.S3_BLOGS_BUCKET || 'share2me-auto-blogs-prod')
  .replace(/[^a-z0-9-]/g, '');

// Pollinations API Key for unlimited FLUX generation
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || 'sk_syEQVBgQ6bK9U1UPM00z0UBoWypLQnwF';

// Gemini text-generation candidate models — verified live against the API (2026-10-18)
const TEXT_MODELS = [
  'gemini-3.8-flash',       // ✅ verified working
  'gemini-3.5-flash',       // ✅ verified working
  'gemini-3-flash-preview', // ✅ verified working
  'gemini-3.1-flash-lite',  // ✅ verified working (lightweight fallback)
];

/**
 * Fetch top headlines from Hacker News to determine current trending tech topics
 */
async function getTrendingTopics() {
  console.log("Fetching trending tech topics from Hacker News...");
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await res.json();
    const topIds = ids.slice(0, 15);
    const topics = [];
    for (const id of topIds) {
      const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      const item = await itemRes.json();
      if (item && item.title) topics.push(item.title);
    }
    return topics.join('; ');
  } catch (err) {
    console.error("Failed to fetch trending topics, using fallback.", err);
    return "AI advancements, WebRTC, End-to-End Encryption, WebAssembly, edge computing";
  }
}

/**
 * Generate a dynamic prompt for the LLM with strict art direction
 */
const getPrompt = (topics) => `
You are an award-winning technical journalist and creative director for a premier technology publication (like Wired, Ars Technica, or The Verge).
Review the following current trending headlines from the tech world:
"${topics}"

Select ONE of the most impactful core technology topics from these headlines and write a comprehensive, authoritative, and in-depth blog article about it.

ART DIRECTION FOR IMAGES (CRITICAL REQUIREMENTS):
1. You MUST generate a "coverImagePrompt" that describes a realistic, concrete, authentic physical scene directly portraying the subject of the article.
   - Example (Chrome extensions/security): "Editorial photograph of a designer laptop open on a modern birch desk showing a web browser interface with extension plugins, soft window daylight, 35mm photography"
   - Example (RISC-V/Python): "Macro close-up studio photograph of a modern silicon CPU microprocessor with copper traces mounted on a motherboard, clean industrial lighting, sharp depth of field"
   - Example (AI/LLM training): "A modern software engineer working on an ultrawide curved monitor in a minimalist sunlit office studio with machine learning code and training loss charts, professional photography"
   - Example (Apple/Mac): "Sleek aluminum laptop on a dark oak desk in a bright loft apartment with a terminal window executing code, warm ambient lamp light"
2. STRICTLY FORBIDDEN IN ALL IMAGE PROMPTS:
   - DO NOT use words like: 'abstract', 'cyberpunk', 'futuristic', 'glowing neon', 'hologram', 'laser beams', 'matrix code', 'digital eye', 'floating spheres', or 'sci-fi robot'.
   - Every image must look like a high-end, genuine editorial photo taken by a professional photographer.
3. In at least two sections, provide a relevant "imagePrompt" following the exact same photographic guidelines.

You MUST output ONLY valid JSON matching this exact structure, with no markdown code fences:
{
  "title": "A catchy, professional title",
  "category": "Web Browsers & Security, Artificial Intelligence, Hardware & Systems, etc.",
  "readTime": "X min read",
  "date": "Month DD, YYYY",
  "coverImagePrompt": "Detailed photographic description of the cover image matching the art direction rules above",
  "intro": "A compelling introduction (text only, do NOT include markdown image tags here).",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Deep dive content for this section.",
      "imagePrompt": "Optional photographic prompt for an illustrative image in this section",
      "bullets": ["Optional array of bullet points", "Keep them concise"]
    }
  ],
  "conclusion": "A strong concluding paragraph."
}

Ensure the output is raw, valid JSON.
`;

/**
 * Generate blog text content with retry across candidate Gemini text models
 */
async function generateContentWithRetry(prompt) {
  let lastError = null;

  for (const model of TEXT_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Generating content using model: ${model} (attempt ${attempt})...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        if (response && response.text) {
          console.log(`Successfully generated content using ${model}`);
          return { text: response.text, modelName: model };
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini Text] Model ${model} attempt ${attempt} failed: ${err.message}`);
        if (err.status === 503 || err.status === 429 || (err.message && err.message.includes('high demand'))) {
          await new Promise((r) => setTimeout(r, 2500 * attempt));
        } else {
          break; // Switch to next candidate model
        }
      }
    }
  }

  throw lastError || new Error("All candidate Gemini models failed to generate content.");
}

/**
 * Helper to generate and download an editorial image using Pollinations FLUX with the API key,
 * upload the resulting buffer to S3, and return the secure serving path.
 * Falls back to direct Pollinations URL if upload or download fails.
 */
async function generateAndUploadEditorialImage(promptText, s3Key, width = 1200, height = 630) {
  // Sanitize and append high-end editorial photo tokens
  const cleanPrompt = promptText
    .replace(/['"]/g, '')
    .replace(/\b(abstract|cyberpunk|glowing neon|futuristic glowing|hologram|neon laser|laser beams|matrix code)\b/gi, '')
    .trim();
  const styledPrompt = `${cleanPrompt}, editorial technology photography, natural soft studio lighting, sharp focus, 35mm lens, high-end tech publication aesthetic, clean professional composition`;
  const seed = Math.floor(Math.random() * 9000000) + 1000000;
  
  const pollinationsUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(styledPrompt)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;

  try {
    console.log(`Generating FLUX image via Pollinations (${width}x${height})...`);
    const headers = {};
    if (POLLINATIONS_API_KEY) {
      headers['Authorization'] = `Bearer ${POLLINATIONS_API_KEY}`;
    }

    const res = await fetch(pollinationsUrl, { headers });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `images/${s3Key}`,
        Body: buffer,
        ContentType: 'image/jpeg',
      }));
      console.log(`✅ Uploaded FLUX image to S3: images/${s3Key}`);
      // Return public path routed through backend Express endpoint
      return `/api/blogs/images/${s3Key}`;
    } else {
      console.warn(`[Pollinations] Response status ${res.status}, falling back to direct URL.`);
    }
  } catch (err) {
    console.warn(`[Image Pipeline] Error: ${err.message}, falling back to direct URL.`);
  }

  // Graceful fallback URL
  return `https://gen.pollinations.ai/image/${encodeURIComponent(styledPrompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
}

async function generateAndUploadBlog() {
  try {
    // ── Step 1: Fetch trending topics ────────────────────────────────────────
    const trendingTopics = await getTrendingTopics();

    // ── Step 2: Generate blog text via Gemini ────────────────────────────────
    console.log("Generating blog content using Gemini...");
    const { text: contentText, modelName } = await generateContentWithRetry(getPrompt(trendingTopics));

    let content = contentText;
    if (!content) throw new Error("Generated content is empty.");

    // Strip markdown code fences if the model wrapped the JSON
    content = content.replace(/^```json\n?/, '').replace(/```$/, '').trim();

    // Parse to ensure it's valid JSON
    const blogData = JSON.parse(content);

    const dateStr = new Date().toISOString().split('T')[0];
    const titleSlug = blogData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const uniqueId = crypto.randomBytes(4).toString('hex');

    // ── Step 3: Build & attach cover image ───────────────────────────────────
    console.log("Generating & attaching editorial cover image...");
    const coverPrompt = blogData.coverImagePrompt || `${blogData.title} in a modern tech workspace setting`;
    const coverKey = `${dateStr}-cover-${uniqueId}.jpg`;
    const coverUrl = await generateAndUploadEditorialImage(coverPrompt, coverKey, 1200, 630);
    blogData.intro = `![Cover](${coverUrl})\n\n${(blogData.intro || '').replace(/^!\[.*?\]\(.*?\)\n*/, '').trim()}`;

    // ── Step 4: Build & attach section images ────────────────────────────────
    if (Array.isArray(blogData.sections)) {
      for (let i = 0; i < blogData.sections.length; i++) {
        const section = blogData.sections[i];
        if (!section.imagePrompt) continue;

        const sectionKey = `${dateStr}-section${i}-${uniqueId}.jpg`;
        const sectionUrl = await generateAndUploadEditorialImage(section.imagePrompt, sectionKey, 1000, 500);
        section.content = `![${section.heading}](${sectionUrl})\n\n${(section.content || '').replace(/^!\[.*?\]\(.*?\)\n*/, '').trim()}`;
      }
    }

    // ── Step 5: Upload final blog JSON to S3 ─────────────────────────────────
    const fileName = `${dateStr}-${titleSlug}-${uniqueId}.json`;
    console.log(`Uploading blog "${fileName}" to S3...`);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `blogs/${fileName}`,
      Body: JSON.stringify(blogData, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'generated-by': modelName,
        'image-engine': 'pollinations-flux-s3',
        'date': new Date().toISOString(),
      },
    }));

    console.log(`✅ Successfully uploaded blog to s3://${BUCKET_NAME}/blogs/${fileName}`);

  } catch (error) {
    console.error("Error generating or uploading blog:", error);
    process.exit(1);
  }
}

generateAndUploadBlog();
