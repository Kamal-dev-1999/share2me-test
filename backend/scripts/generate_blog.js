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

// Public base URL for the S3 bucket — images are served from here
const S3_PUBLIC_BASE =
  process.env.S3_PUBLIC_BASE_URL ||
  `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com`;

// Gemini Imagen models in priority order — both accessible on the free tier
const IMAGE_MODELS = [
  'imagen-3.0-generate-002',
  'imagen-3.0-fast-generate-001',
];

// Gemini text-generation candidate models in priority order
const TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
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
 * Generate an image using Gemini Imagen API.
 * Returns base64-encoded PNG bytes string, or null on failure (blog still saves without image).
 *
 * @param {string} promptText - Descriptive editorial image prompt from blog JSON
 * @param {'1:1'|'4:3'|'16:9'|'9:16'|'3:4'} aspectRatio
 */
async function generateGeminiImage(promptText, aspectRatio = '16:9') {
  // Sanitize prompt — remove forbidden style words and quotes
  const cleanPrompt = promptText
    .replace(/['"]/g, '')
    .replace(/\b(abstract|cyberpunk|glowing neon|futuristic glowing|hologram|neon laser|laser beams|matrix code)\b/gi, '')
    .trim();

  const styledPrompt = `${cleanPrompt}, editorial technology photography, natural soft studio lighting, sharp focus, 35mm lens, high-end tech publication aesthetic, clean professional composition`;

  for (const model of IMAGE_MODELS) {
    try {
      console.log(`Generating image using ${model} (aspectRatio: ${aspectRatio})...`);
      const response = await ai.models.generateImages({
        model,
        prompt: styledPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio,
          outputMimeType: 'image/png',
        },
      });

      const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
      if (imageBytes) {
        console.log(`Successfully generated image using ${model}`);
        return imageBytes; // base64 string
      }
      console.warn(`[Gemini Image] ${model} returned empty image data.`);
    } catch (err) {
      console.warn(`[Gemini Image] Model ${model} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500)); // brief back-off before next model
    }
  }

  console.error('[Gemini Image] All image models failed — skipping image for this slot.');
  return null;
}

/**
 * Upload a base64 PNG image buffer to S3 and return its public URL.
 *
 * @param {string} base64Data - base64-encoded PNG
 * @param {string} s3Key      - e.g. "images/2026-10-18-cover-abc123.png"
 * @returns {Promise<string>} Public URL of the uploaded image
 */
async function uploadImageToS3(base64Data, s3Key) {
  const imageBuffer = Buffer.from(base64Data, 'base64');
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: imageBuffer,
    ContentType: 'image/png',
  }));
  const publicUrl = `${S3_PUBLIC_BASE}/${s3Key}`;
  console.log(`Uploaded image → ${publicUrl}`);
  return publicUrl;
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

    // ── Step 3: Generate & upload cover image via Gemini Imagen ───────────────
    const coverPrompt = blogData.coverImagePrompt || `${blogData.title} in a modern tech workspace setting`;
    const coverImageBytes = await generateGeminiImage(coverPrompt, '16:9');
    if (coverImageBytes) {
      const coverKey = `images/${dateStr}-cover-${uniqueId}.png`;
      const coverUrl = await uploadImageToS3(coverImageBytes, coverKey);
      // Prepend cover image markdown to intro (same pattern as before)
      blogData.intro = `![Cover](${coverUrl})\n\n${(blogData.intro || '').replace(/^!\[.*?\]\(.*?\)\n*/, '').trim()}`;
    }

    // ── Step 4: Generate & upload section images via Gemini Imagen ────────────
    if (Array.isArray(blogData.sections)) {
      for (let i = 0; i < blogData.sections.length; i++) {
        const section = blogData.sections[i];
        if (!section.imagePrompt) continue;

        const sectionImageBytes = await generateGeminiImage(section.imagePrompt, '4:3');
        if (sectionImageBytes) {
          const sectionKey = `images/${dateStr}-section${i}-${uniqueId}.png`;
          const sectionUrl = await uploadImageToS3(sectionImageBytes, sectionKey);
          section.content = `![${section.heading}](${sectionUrl})\n\n${(section.content || '').replace(/^!\[.*?\]\(.*?\)\n*/, '').trim()}`;
        }
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
        'image-engine': 'gemini-imagen',
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
