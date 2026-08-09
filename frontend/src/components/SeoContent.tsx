"use client";
import { Shield, Zap, Lock, HardDrive, Wifi, Smartphone, type LucideIcon } from "lucide-react";

export function SeoContent() {
  return (
    <section className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 text-on-surface">
      <div className="flex flex-col gap-10 md:gap-14">

        {/* Main SEO Header — compact, sentence case */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-on-surface leading-tight">
            The secure, zero-cloud way to share large files and text online
          </h2>
          <p className="mt-3 text-[14px] md:text-[15px] text-on-surface-variant leading-relaxed">
            Share2Me is a next-generation peer-to-peer file and text sharing platform that connects
            devices directly in the browser. Using WebRTC, your data travels straight from your
            browser to the receiver&apos;s — no cloud storage, no sign-ups, no size limits.
          </p>
        </div>

        {/* Feature grid — clean cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          <FeatureCard
            icon={Zap}
            title="No file size limits"
            body="Files travel directly between browsers, so there are no size caps or bandwidth throttling — send a 20 GB video as easily as a photo."
          />
          <FeatureCard
            icon={Lock}
            title="End-to-end encrypted"
            body="Every session is secured with AES-GCM-256. Keys are derived locally via ECDH exchange, so no server can decrypt your traffic."
          />
          <FeatureCard
            icon={Shield}
            title="No accounts, ever"
            body="No sign-ups, no passwords. Just generate a 6-digit one-time code, share it with the receiver, and start transferring."
          />
        </div>

        {/* Deep dive */}
        <div className="card-brutalist p-6 md:p-10">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <h2 className="text-[22px] md:text-[26px] font-semibold text-on-surface tracking-tight">
                How peer-to-peer transfer actually works
              </h2>
              <div className="mt-4 space-y-3 text-[14px] text-on-surface-variant leading-relaxed">
                <p>
                  Traditional file-sharing sites force you to upload sensitive data to their cloud
                  first, then have the recipient download it back. That wastes time, compromises
                  privacy, and imposes strict size limits.
                </p>
                <p>
                  Share2Me uses <strong className="text-on-surface font-semibold">WebRTC</strong>.
                  When you enter a 6-digit code, our signaling server introduces the two devices to
                  each other — then steps out. A direct, encrypted tunnel does the rest.
                </p>
              </div>
              <ul className="mt-5 space-y-2.5">
                <BulletRow label="Fastest speeds" body="Files move at your local network's maximum bandwidth." />
                <BulletRow label="Cross-platform" body="Send from iPhone to PC, Android to Mac, or any modern browser." />
                <BulletRow label="Text and code" body="Share clipboard text, links, and passwords the same way." />
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={Wifi} label="Local WiFi sync" />
              <MiniStat icon={HardDrive} label="No server storage" />
              <MiniStat icon={Smartphone} label="Works on every browser" wide />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon, title, body,
}: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="card-brutalist p-6">
      <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-on-surface" strokeWidth={1.75} />
      </div>
      <h3 className="text-[15px] font-semibold text-on-surface mb-1.5">{title}</h3>
      <p className="text-[13px] text-on-surface-variant leading-relaxed">{body}</p>
    </div>
  );
}

function BulletRow({ label, body }: { label: string; body: string }) {
  return (
    <li className="flex gap-3 text-[13px]">
      <span className="mt-1.5 w-1 h-1 rounded-full bg-on-surface flex-none" />
      <span className="text-on-surface-variant leading-relaxed">
        <strong className="text-on-surface font-semibold">{label}.</strong> {body}
      </span>
    </li>
  );
}

function MiniStat({
  icon: Icon, label, wide = false,
}: { icon: LucideIcon; label: string; wide?: boolean }) {
  return (
    <div className={`card-analytics p-4 flex flex-col items-center gap-2 text-center ${wide ? "col-span-2" : ""}`}>
      <Icon className="w-6 h-6 text-on-surface" strokeWidth={1.75} />
      <span className="text-[13px] font-medium text-on-surface">{label}</span>
    </div>
  );
}
