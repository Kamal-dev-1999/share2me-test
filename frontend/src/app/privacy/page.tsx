import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Safe P2P File Sharing",
  description: "Read the Share2Me Privacy Policy. Learn about our secure, zero-knowledge peer-to-peer file sharing and text transfer architecture.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-[800px] mx-auto px-6 lg:px-8 pt-32 pb-24 animate-fade-in">
        <div className="bg-background-elevated rounded-[24px] border border-border p-8 sm:p-12 shadow-soft">
          <h1 className="text-3xl font-display font-bold text-text-primary mb-6">Privacy Policy</h1>
          <div className="text-text-secondary space-y-6 text-[15px] leading-relaxed">
            <p>
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            
            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">1. Zero-Knowledge Architecture</h2>
              <p>
                Share2Me is built on a strict zero-knowledge architecture. All file and text transfers are end-to-end encrypted directly in your browser using AES-GCM-256 before being sent over the network. Our servers only facilitate the initial WebRTC connection (signaling) and route encrypted chunks. We never possess the decryption keys, meaning we cannot read, view, or access your data under any circumstances.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">2. Data We Do Not Collect</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>We do not store your files or text on any server or cloud database.</li>
                <li>We do not log the content of your transfers.</li>
                <li>We do not require user accounts, emails, or personal identification.</li>
                <li>We do not track your transfer history.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">3. Ephemeral Server Logs</h2>
              <p>
                For the purpose of maintaining service stability and preventing abuse, our signaling servers temporarily hold connection metadata (such as the 6-digit OTC code and IP addresses) strictly for the duration of the active transfer. Once the browser session is closed or the transfer completes, this metadata is instantly purged from memory.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-3">4. Local Browser Storage</h2>
              <p>
                Share2Me may use local browser APIs (like Web Workers or temporary buffers) to encrypt, decrypt, and piece together data chunks during an active transfer. This data resides solely on your device and is discarded when you close the browser tab.
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
