"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, Save, Send, Sparkles, Check, AlertCircle,
  Globe, RefreshCw, X, ChevronDown, ChevronUp, Code, Eye
} from "lucide-react";

import { MonacoHtmlEditor } from "@/components/admin/MonacoHtmlEditor";
import { SandboxedPreview } from "@/components/admin/SandboxedPreview";
import { SeoCheckPanel, SeoValidationResult } from "@/components/admin/SeoCheckPanel";

function BlogEditorContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const blogId = searchParams?.get("id") || "";

  // Blog Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [author, setAuthor] = useState("Share2Me Team");
  const [featuredImage, setFeaturedImage] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [category, setCategory] = useState("Technology");
  const [tags, setTags] = useState("WebRTC, P2P, Security");
  const [htmlContent, setHtmlContent] = useState("");

  // Target Destination Checklist
  const [targets, setTargets] = useState<{ share2me: boolean; share2me_in: boolean }>({
    share2me: true,
    share2me_in: true,
  });

  // UI state
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [seoResult, setSeoResult] = useState<SeoValidationResult | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishingProgress, setPublishingProgress] = useState<any[]>([]);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load existing blog if editing
  useEffect(() => {
    if (blogId && session?.user?.email) {
      setLoading(true);
      fetch(`/api/admin/blogs/${blogId}`, {
        headers: { "X-Admin-Email": session.user.email },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.blog) {
            const b = data.blog;
            setTitle(b.title || "");
            setSlug(b.slug || "");
            setMetaDescription(b.meta_description || "");
            setKeywords(Array.isArray(b.keywords) ? b.keywords.join(", ") : b.keywords || "");
            setAuthor(b.author || "Share2Me Team");
            setFeaturedImage(b.featured_image || "");
            setCanonicalUrl(b.canonical_url || "");
            setCategory(b.category || "Technology");
            setTags(Array.isArray(b.tags) ? b.tags.join(", ") : b.tags || "");
            setHtmlContent(b.html_content || "");
          }
        })
        .catch((err) => console.error("Error fetching blog:", err))
        .finally(() => setLoading(false));
    }
  }, [blogId, session]);

  // Auto-generate slug from title if empty
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!blogId && (!slug || slug.startsWith("draft-"))) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .trim();
      setSlug(generated);
    }
  };

  // Smart Auto-Extraction of SEO Metadata from HTML Code
  const autoExtractMetadataFromHtml = (code: string = htmlContent) => {
    if (!code || !code.trim()) return;

    // 1. Extract Title: from <title>, <h1>, or og:title
    let extractedTitle = "";
    const titleMatch = code.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ||
                       code.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                       code.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (titleMatch && titleMatch[1]) {
      extractedTitle = titleMatch[1].replace(/<[^>]+>/g, "").trim();
    }

    if (extractedTitle && (!title || title === "Untitled Draft" || title.trim() === "")) {
      setTitle(extractedTitle);
      if (!slug || slug.startsWith("draft-") || slug.trim() === "") {
        const generatedSlug = extractedTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .trim();
        setSlug(generatedSlug);
      }
    }

    // 2. Extract Meta Description: from meta description, og:description, or first <p>
    const descMatch = code.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                      code.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      code.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (descMatch && descMatch[1] && (!metaDescription || metaDescription.trim() === "")) {
      const cleanDesc = descMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 160);
      setMetaDescription(cleanDesc);
    }

    // 3. Extract Canonical URL: from <link rel="canonical"> or og:url
    const canonicalMatch = code.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) ||
                           code.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
    if (canonicalMatch && canonicalMatch[1] && (!canonicalUrl || canonicalUrl.trim() === "")) {
      setCanonicalUrl(canonicalMatch[1].trim());
    }

    // 4. Extract Featured Image: from og:image or first <img> tag src
    const imgMatch = code.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                      code.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1] && (!featuredImage || featuredImage.trim() === "")) {
      setFeaturedImage(imgMatch[1].trim());
    }

    // 5. Extract Author: from <meta name="author">
    const authorMatch = code.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i);
    if (authorMatch && authorMatch[1] && (!author || author === "Share2Me Team")) {
      setAuthor(authorMatch[1].trim());
    }

    // 6. Extract Keywords: from <meta name="keywords">
    const kwMatch = code.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
    if (kwMatch && kwMatch[1] && (!keywords || keywords.trim() === "")) {
      setKeywords(kwMatch[1].trim());
    }
  };

  const handleHtmlChange = (newCode: string) => {
    setHtmlContent(newCode);
    autoExtractMetadataFromHtml(newCode);
  };

  // Instant Local Client-Side SEO Validation Engine (0ms Latency)
  const runLocalSeoValidation = (
    currentTitle: string,
    currentSlug: string,
    currentHtml: string,
    currentMetaDesc: string,
    currentCanonical: string,
    currentImage: string
  ) => {
    const errors: { id: string; message: string }[] = [];
    const warnings: { id: string; message: string }[] = [];

    const t = (currentTitle || "").trim();
    const s = (currentSlug || "").trim();
    const h = (currentHtml || "").trim();
    const m = (currentMetaDesc || "").trim();
    const c = (currentCanonical || "").trim();
    const img = (currentImage || "").trim();

    // 1. Errors
    if (!t) {
      errors.push({ id: "title_missing", message: "Blog Title is required." });
    }

    if (!s) {
      errors.push({ id: "slug_missing", message: "Blog Slug is required." });
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) {
      errors.push({
        id: "slug_invalid",
        message: 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. "how-webrtc-works").',
      });
    }

    if (!h) {
      errors.push({ id: "html_empty", message: "HTML content cannot be empty." });
    }

    const h1Match = h.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
    if (h1Match.length > 1) {
      errors.push({
        id: "multiple_h1",
        message: `Found ${h1Match.length} <h1> tags. Every page must have exactly ONE <h1> tag for SEO.`,
      });
    }

    // 2. Warnings
    if (t.length > 60) {
      warnings.push({
        id: "title_length",
        message: `Title is ${t.length} characters long. Recommended length is under 60 characters for search snippets.`,
      });
    }

    if (!m) {
      warnings.push({ id: "meta_desc_missing", message: "Meta description is missing." });
    } else if (m.length > 160) {
      warnings.push({
        id: "meta_desc_length",
        message: `Meta description is ${m.length} characters long. Recommended length is 120-160 characters.`,
      });
    }

    if (h1Match.length === 0) {
      warnings.push({ id: "h1_missing", message: "No <h1> tag found in HTML content or title." });
    }

    if (!c) {
      warnings.push({
        id: "canonical_missing",
        message: "Canonical URL is missing. Adding a canonical URL prevents duplicate content penalties.",
      });
    }

    if (!img) {
      warnings.push({
        id: "featured_image_missing",
        message: "Featured Image URL is missing. Adding a social preview image increases CTR.",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    };
  };

  // Real-time SEO Validation Effect
  useEffect(() => {
    // 1. Instantly calculate local validation for zero-latency UI updates
    const localVal = runLocalSeoValidation(
      title,
      slug,
      htmlContent,
      metaDescription,
      canonicalUrl,
      featuredImage
    );
    setSeoResult(localVal);

    // 2. Secondary server validation if session email is present
    const email = session?.user?.email;
    if (!email) return;

    fetch("/api/admin/blogs/validate-seo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Email": email,
      },
      body: JSON.stringify({
        title,
        slug,
        metaDescription,
        canonicalUrl,
        featuredImage,
        category,
        htmlContent,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((res) => {
        if (res && Array.isArray(res.errors)) setSeoResult(res);
      })
      .catch(() => {});
  }, [title, slug, metaDescription, canonicalUrl, featuredImage, category, htmlContent, session]);

  // 1-Click Complete Auto-Fix for All SEO Errors & Warnings
  const handleAutoFixAllSeo = () => {
    // Fix Title & Slug
    let newTitle = title.trim();
    if (!newTitle || newTitle === "Untitled Draft") {
      const h1Match = htmlContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      newTitle = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : "Share2Me Peer-to-Peer File Transfer Guide";
    }

    let newSlug = slug.trim();
    if (!newSlug || newSlug.startsWith("draft-") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
      newSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .trim();
    }

    // Fix HTML Content
    let newHtml = htmlContent.trim();
    if (!newHtml) {
      newHtml = `<h1>${newTitle}</h1>\n<p>Welcome to Share2Me! Transfer unlimited files peer-to-peer directly between browsers with zero cloud storage limits.</p>`;
    } else if (!/<h1[^>]*>[\s\S]*?<\/h1>/i.test(newHtml)) {
      newHtml = `<h1>${newTitle}</h1>\n` + newHtml;
    }

    const newMetaDesc = metaDescription.trim() || "Learn how to transfer files peer-to-peer securely in your browser with Share2Me without cloud uploads.";
    const newCanonical = canonicalUrl.trim() || `https://share2.me/blog/${newSlug || "article"}`;
    const newImage = featuredImage.trim() || "https://share2.me/og-image.png";

    // Batch update state
    setTitle(newTitle);
    setSlug(newSlug);
    setHtmlContent(newHtml);
    setMetaDescription(newMetaDesc);
    setCanonicalUrl(newCanonical);
    setFeaturedImage(newImage);

    // INSTANTLY update SEO result locally
    // INSTANTLY update SEO result locally
    const fixedResult = runLocalSeoValidation(
      newTitle,
      newSlug,
      newHtml,
      newMetaDesc,
      newCanonical,
      newImage
    );
    setSeoResult(fixedResult);
  };

  const getPayload = () => ({
    id: blogId || undefined,
    title,
    slug,
    metaDescription,
    keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
    author,
    featuredImage,
    canonicalUrl,
    category,
    tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
    htmlContent,
  });

  // Save Draft Handler
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/blogs/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": session?.user?.email || "",
        },
        body: JSON.stringify(getPayload()),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save draft.");

      if (data.blog && !blogId) {
        router.push(`/admin/blogs/editor?id=${data.blog.id}`);
      }
      alert("Draft saved successfully!");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  // Initiate Publishing Modal
  const handleOpenPublishModal = () => {
    if (!targets.share2me && !targets.share2me_in) {
      alert("Please select at least one publishing destination (share2.me or share2me.in).");
      return;
    }

    // Automatically fix any blocking SEO errors so publish process is smooth
    if (seoResult && !seoResult.isValid) {
      handleAutoFixAllSeo();
    }

    setPublishSuccess(false);
    setPublishingProgress([]);
    setPublishModalOpen(true);
  };

  // Confirm and Execute Multi-Site Publishing
  const handleConfirmPublish = async () => {
    let selectedDestinations = Object.entries(targets)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);

    // Default to both destinations if none selected
    if (selectedDestinations.length === 0) {
      selectedDestinations = ["share2me", "share2me_in"];
    }

    setPublishingProgress([
      { step: "Preparing blog metadata & HTML payload...", status: "active" },
    ]);

    try {
      const res = await fetch("/api/admin/blogs/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": session?.user?.email || "",
        },
        body: JSON.stringify({
          destinations: selectedDestinations,
          blogData: getPayload(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Publishing failed.");
      }

      setPublishingProgress((prev) => [
        ...prev.map((p) => ({ ...p, status: "completed" })),
        { step: "Validating HTML & creating version revision...", status: "completed" },
        ...selectedDestinations.map((dest) => ({
          step: `Published to ${dest === "share2me_in" ? "share2me.in" : "share2.me"}`,
          status: "completed",
        })),
      ]);

      setPublishSuccess(true);
    } catch (err: any) {
      setPublishingProgress((prev) => [
        ...prev.map((p) => ({ ...p, status: "completed" })),
        { step: `Error: ${err.message}`, status: "failed" },
      ]);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[#64748b] text-sm font-medium flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
        <span>Loading Editor Workspace...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto font-sans">
      
      {/* ── Header & Action Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/blogs"
            className="p-3 rounded-full bg-white border border-slate-200/80 text-[#0f1015] hover:bg-[#0f1015] hover:text-white transition-colors shadow-xs"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#0f1015] flex items-center gap-3 tracking-tight">
              <span>{blogId ? "Edit Blog Article" : "Create New Blog"}</span>
              <span className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-3.5 py-1 rounded-full font-mono font-bold">
                {blogId ? "ID: " + blogId.slice(0, 8) : "Draft"}
              </span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="px-6 py-3.5 rounded-full bg-white/90 border border-slate-200/80 hover:bg-white text-[#0f1015] font-extrabold text-xs transition-all shadow-sm"
          >
            <Save className="w-4 h-4 inline mr-1.5" />
            <span>{savingDraft ? "Saving..." : "Save Draft"}</span>
          </button>

          <button
            onClick={handleOpenPublishModal}
            className="px-7 py-3.5 rounded-full bg-[#0f1015] text-white font-extrabold text-xs hover:bg-[#1f232c] transition-all flex items-center gap-2 shadow-xl hover:scale-[1.02]"
          >
            <Send className="w-4 h-4 text-[#fcd535]" />
            <span>Publish Blog</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl text-rose-700 text-xs font-extrabold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Title & Slug Card (Glassmorphism) ───────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-7 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-[#64748b] uppercase tracking-wider">
              Blog Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. How to Transfer Files Peer-to-Peer in the Browser"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full bg-white/90 border border-slate-200/80 focus:border-[#0f1015] rounded-full px-6 py-4 text-sm text-[#0f1015] outline-none transition-colors font-extrabold shadow-xs"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-extrabold text-[#64748b] uppercase tracking-wider">
              Blog Slug <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center bg-white/90 border border-slate-200/80 rounded-full px-6 focus-within:border-[#0f1015] transition-colors shadow-xs">
              <span className="text-xs text-[#64748b] select-none font-mono font-bold">/blog/</span>
              <input
                type="text"
                placeholder="how-to-transfer-files-p2p"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-transparent border-0 py-4 text-sm text-[#0f1015] outline-none font-mono font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SEO Metadata Collapsible Accordion ───────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] overflow-hidden shadow-sm">
        <button
          onClick={() => setMetaExpanded(!metaExpanded)}
          className="w-full h-16 px-7 bg-white/90 flex items-center justify-between text-xs font-extrabold text-[#64748b] hover:text-[#0f1015] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="text-base font-extrabold text-[#0f1015]">SEO & Metadata Options</span>
          </div>
          {metaExpanded ? <ChevronUp className="w-5 h-5 text-[#0f1015]" /> : <ChevronDown className="w-5 h-5 text-[#0f1015]" />}
        </button>

        {metaExpanded && (
          <div className="p-7 space-y-5 border-t border-slate-200/80">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[#64748b] uppercase">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs text-[#0f1015] outline-none font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[#64748b] uppercase">Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs text-[#0f1015] outline-none font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[#64748b] uppercase">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs text-[#0f1015] outline-none font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-[#64748b] uppercase">Meta Description</label>
              <textarea
                rows={2}
                placeholder="Meta description for Google search snippets (120-160 chars recommended)..."
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full bg-white/90 border border-slate-200/80 rounded-2xl p-4 text-xs text-[#0f1015] outline-none font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[#64748b] uppercase">Canonical URL</label>
                <input
                  type="text"
                  placeholder="https://share2.me/blog/your-slug"
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs text-[#0f1015] outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[#64748b] uppercase">Featured Image URL</label>
                <input
                  type="text"
                  placeholder="https://share2.me/og-image.png"
                  value={featuredImage}
                  onChange={(e) => setFeaturedImage(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs text-[#0f1015] outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TOP SECTION: HTML CODE EDITOR (FULL WIDTH) ───────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#0f1015] uppercase tracking-wider">
            <Code className="w-5 h-5 text-purple-600" />
            <span>Step 1: HTML Code Input & Editor</span>
          </div>

          <button
            onClick={() => autoExtractMetadataFromHtml(htmlContent)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-100 border border-purple-200 text-purple-800 font-extrabold text-xs hover:bg-purple-200 transition-all shadow-xs"
            title="Auto-extract Title, Meta Description, Canonical URL, Featured Image & Author from HTML code"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Auto-Extract SEO Metadata</span>
          </button>
        </div>

        <MonacoHtmlEditor
          value={htmlContent}
          onChange={handleHtmlChange}
          height="480px"
        />
      </div>

      {/* ── BOTTOM SECTION: LIVE WEBSITE PREVIEW (FULL WIDTH BELOW EDITOR) ─ */}
      <div className="space-y-3 pt-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#0f1015] uppercase tracking-wider">
            <Eye className="w-5 h-5 text-emerald-600" />
            <span>Step 2: Live Website Viewport & UI Preview</span>
          </div>
          <span className="text-xs text-[#64748b] font-medium">Renders real-time webpage layout below</span>
        </div>

        <SandboxedPreview
          htmlContent={htmlContent}
          title={title || "Blog Preview"}
          slug={slug || "my-blog-post"}
          height="750px"
        />
      </div>

      {/* ── SEO Auditor Panel ────────────────────────────────────────────── */}
      <SeoCheckPanel validation={seoResult} onAutoFix={handleAutoFixAllSeo} />

      {/* ── Publishing Destination Checklist ────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-7 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 text-xs font-extrabold text-[#0f1015] uppercase tracking-wider">
          <Globe className="w-4 h-4 text-purple-600" />
          <span>Publishing Destinations</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-8 text-sm">
          <label className="flex items-center gap-3 cursor-pointer text-[#0f1015] font-extrabold select-none">
            <input
              type="checkbox"
              checked={targets.share2me}
              onChange={(e) => setTargets({ ...targets, share2me: e.target.checked })}
              className="w-5 h-5 accent-[#0f1015] rounded-lg"
            />
            <span>share2.me (Main Site)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer text-[#0f1015] font-extrabold select-none">
            <input
              type="checkbox"
              checked={targets.share2me_in}
              onChange={(e) => setTargets({ ...targets, share2me_in: e.target.checked })}
              className="w-5 h-5 accent-[#0f1015] rounded-lg"
            />
            <span>share2me.in (India Portal)</span>
          </label>
        </div>
      </div>

      {/* ── Confirm & Multi-Site Publishing Modal (Portaled directly to document.body) ────────────────────────── */}
      {publishModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 h-screen w-screen top-0 left-0 right-0 bottom-0 overflow-y-auto">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-[40px] p-7 space-y-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
              <h3 className="text-xl font-extrabold text-[#0f1015] flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-600" />
                <span>Publish Blog Confirmation</span>
              </h3>
              <button
                onClick={() => setPublishModalOpen(false)}
                className="text-[#64748b] hover:text-[#0f1015] p-1.5 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="text-xs text-[#64748b] font-bold">Article Title</div>
                <div className="font-extrabold text-[#0f1015] text-base truncate">{title}</div>
                <div className="text-xs font-mono text-purple-600 font-bold">/{slug}</div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#64748b]">Selected Destinations</div>
                <div className="flex gap-2">
                  {targets.share2me && (
                    <span className="px-3.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-mono font-extrabold">
                      ✓ share2.me
                    </span>
                  )}
                  {targets.share2me_in && (
                    <span className="px-3.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-mono font-extrabold">
                      ✓ share2me.in
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Steps */}
              {publishingProgress.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/80">
                  <div className="text-xs font-bold text-[#0f1015]">Publishing Progress</div>
                  {publishingProgress.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-[#64748b]">
                      {p.status === "completed" ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : p.status === "failed" ? (
                        <X className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                      )}
                      <span className={p.status === "completed" ? "text-[#0f1015] font-bold" : ""}>{p.step}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* General Error Display */}
              {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 pt-4">
              {publishSuccess ? (
                <button
                  onClick={() => router.push("/admin/blogs")}
                  className="px-6 py-3 rounded-full bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 transition-all shadow-lg"
                >
                  Return to Blogs List
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setPublishModalOpen(false)}
                    className="px-6 py-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0f1015] font-extrabold text-xs transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleConfirmPublish}
                    className="px-7 py-3.5 rounded-full bg-[#0f1015] text-white font-extrabold text-xs hover:bg-[#1f232c] transition-all flex items-center gap-2 shadow-xl hover:scale-[1.02]"
                  >
                    <Send className="w-4 h-4 text-[#fcd535]" />
                    <span>Confirm Publish</span>
                  </button>
                </>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

export default function BlogEditorPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-[#64748b]">Loading Editor...</div>}>
      <BlogEditorContent />
    </Suspense>
  );
}
