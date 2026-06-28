# Share2Me SEO Implementation Documentation

This document outlines the current Search Engine Optimization (SEO) strategies and code implementations active on the Share2Me Next.js application. Any future AI agents working on this project should read this before modifying the frontend to avoid breaking the SEO score.

## 1. Technical SEO Configuration
*   **Google Analytics:** 
    *   **Implementation:** Raw Google tags are hardcoded in `frontend/src/app/layout.tsx` using Next.js `<Script>` components.
    *   **Reason:** We avoided `@next/third-parties/google` and environment variables (`NEXT_PUBLIC_GA_ID`) because Next.js standalone static builds sometimes strip out environment variables inside Docker, causing the GA script to disappear. Hardcoding inside the `<head>` using Next.js `Script` prevents React hydration mismatch errors while guaranteeing tracking.
*   **Sitemap (`frontend/src/app/sitemap.ts`):**
    *   Dynamically generates a sitemap.xml that explicitly tells Google to crawl: `https://share2.me`, `/how-it-works`, `/about`, `/privacy`, and `/terms`.
*   **Robots.txt (`frontend/src/app/robots.ts`):**
    *   Instructs all user agents (`*`) to index the site and points them directly to the `sitemap.xml`.

## 2. Advanced Metadata & Schema
*   **`frontend/src/app/layout.tsx`:**
    *   **Metadata Object:** Contains a highly optimized object with `metadataBase`, `canonical` URLs, `keywords`, and `openGraph`/`twitter` cards for rich social sharing previews.
    *   **JSON-LD Structured Data:** Injects a hidden `<script type="application/ld+json">` tag directly into the `<head>`. This tells Google's AI that Share2Me is a `WebApplication` meant for "UtilitiesApplication", making it easier to parse in search results.

## 3. Semantic Content Strategy (Phase 2 SEO)
*   **`frontend/src/components/SeoContent.tsx`:**
    *   Because the main transfer workspace has very little indexable text, we injected this rich-text component at the bottom of `frontend/src/app/page.tsx` (just above the footer).
    *   It contains heavily optimized semantic HTML (`<h2>`, `<h3>`) and targets long-tail keywords like *"peer to peer file transfer"*, *"text sharing"*, and *"WebRTC"*.
    *   **Important Note:** When writing text inside React components, you *must* escape single quotes (e.g. `don&apos;t` instead of `don't`) or Vercel's strict `react/no-unescaped-entities` ESLint rule will fail the entire build.

## Summary
The root domain `https://share2.me` is heavily weighted. When building backlinks or submitting to directories (Product Hunt, Reddit, Hacker News), always use the root domain to centralize the Domain Authority.
