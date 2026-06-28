import { TopNav } from "@/components/TopNav";
import Link from "next/link";

export const metadata = {
  title: "Terms and Conditions — User Service Agreement | Share2Me",
  description: "Read the Share2Me terms of service. Understand the agreement, usage conditions, and limitation of liability for using our serverless P2P transfer tools.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="w-full max-w-[800px] mx-auto px-6 lg:px-8 pt-32 pb-24 animate-fade-in">
        <div className="bg-background-elevated rounded-[24px] border border-border p-8 sm:p-12 shadow-soft">
          <h1 className="text-3xl font-display font-bold text-text-primary mb-6">Terms and Conditions</h1>
          <div className="text-text-secondary space-y-6 text-[15px] leading-relaxed">
            <p>
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            
            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Share2Me, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you are prohibited from using the service. Share2Me is provided &quot;as is&quot; without any warranties of any kind.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">2. Description of Service</h2>
              <p>
                Share2Me is a peer-to-peer file and text sharing utility. It enables direct browser-to-browser transfers without storing the transferred content on our servers. Because the service relies on WebRTC and your network environment, transfer speeds and connectivity may vary.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">3. Acceptable Use</h2>
              <p>
                You agree not to use Share2Me to:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Transfer illegal, copyrighted, or malicious material without authorization.</li>
                <li>Distribute malware, viruses, or any code of a destructive nature.</li>
                <li>Engage in any activity that could disable, overburden, or impair the proper working of the Share2Me signaling infrastructure.</li>
              </ul>
              <p className="mt-2">
                Because Share2Me is end-to-end encrypted, we cannot monitor the content of transfers. You are solely responsible for the legality and nature of the data you transmit.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">4. Limitation of Liability</h2>
              <p>
                In no event shall Share2Me, its developers, or affiliates be liable for any direct, indirect, incidental, special, or consequential damages arising out of or in any way connected with the use or inability to use the service. We are not responsible for any data loss, intercepted data on compromised local devices, or service interruptions.
              </p>
            </section>

            <div className="pt-8 border-t border-border mt-8">
              <Link href="/" className="text-primary hover:text-primary-hover font-medium transition-colors">
                ← Back to Share2Me
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
