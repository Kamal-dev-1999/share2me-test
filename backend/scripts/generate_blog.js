require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

// Initialize Google Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BLOGS_BUCKET || 'share2me-auto-blogs-prod';

/**
 * Generate a dynamic prompt for the LLM
 */
const getPrompt = () => `
You are a highly acclaimed technical journalist writing for a premier technology blog. 
Write a comprehensive, engaging, and in-depth blog article about a trending technology topic (e.g., AI advancements, WebRTC, End-to-End Encryption, WebAssembly, edge computing, etc.).

You MUST output ONLY valid JSON matching this exact structure, with no markdown code blocks around it:
{
  "title": "A catchy, professional title",
  "category": "Technology, WebRTC, AI, etc.",
  "readTime": "X min read",
  "date": "Month DD, YYYY",
  "intro": "A compelling introduction. Include a markdown image tag at the top of the intro using the Pollinations AI format: ![Cover](https://image.pollinations.ai/prompt/{URL_ENCODED_DETAILED_PROMPT}?width=1200&height=600&nologo=true)",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Deep dive content for this section. You MUST include another markdown image tag somewhere in at least two of the sections.",
      "bullets": ["Optional array of bullet points", "Keep them concise"]
    }
  ],
  "conclusion": "A strong concluding paragraph."
}

Ensure the output is raw, valid JSON.
`;

async function generateAndUploadBlog() {
  try {
    console.log("Generating blog content using Gemini...");
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: getPrompt(),
    });
    
    let content = response.text;
    if (!content) throw new Error("Generated content is empty.");

    // Strip markdown formatting if AI wraps it in ```json
    content = content.replace(/^```json\n?/, '').replace(/```$/, '').trim();

    // Parse to ensure it's valid JSON
    const blogData = JSON.parse(content);
    
    const titleSlug = blogData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dateStr = new Date().toISOString().split('T')[0];
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const fileName = `${dateStr}-${titleSlug}-${uniqueId}.json`;

    console.log(`Uploading blog "${fileName}" to S3...`);
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `blogs/${fileName}`,
      Body: JSON.stringify(blogData, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'generated-by': 'gemini-3.6-flash',
        'date': new Date().toISOString()
      }
    });

    await s3.send(putCommand);
    console.log(`Successfully uploaded blog to s3://${BUCKET_NAME}/blogs/${fileName}`);
    
  } catch (error) {
    console.error("Error generating or uploading blog:", error);
    process.exit(1);
  }
}

generateAndUploadBlog();
