import Link from "next/link";
import Image from "next/image";
import { TopNav } from "@/components/TopNav";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-body selection:bg-primary/30 selection:text-primary">
      <TopNav />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center flex flex-col items-center gap-8">
          <Image
            src="/animations/404-error.svg"
            alt="404 - Page Not Found"
            width={300}
            height={300}
            className="w-full max-w-[300px] h-auto object-contain mx-auto"
            priority
          />
          
          <div className="space-y-3">
            <h1 className="text-h2 font-display font-bold text-text-primary">
              Page Not Found
            </h1>
            <p className="text-text-secondary text-[15px] leading-relaxed max-w-[320px] mx-auto">
              Oops! We couldn&apos;t find the page you were looking for. It might have been moved or deleted.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center h-[48px] px-8 bg-primary text-background font-bold rounded-xl hover:-translate-y-0.5 transition-transform shadow-glow w-full sm:w-auto"
          >
            Return Home
          </Link>
        </div>
      </main>

      <footer className="w-full border-t border-border bg-background py-6 mt-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
              <span className="text-text-primary font-display font-bold">Share2Me</span>
            </div>
            
            <div className="text-[13px] text-text-tertiary">
              © 2026 Share2Me. All rights reserved.
            </div>

            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
