"use client";
import { TopNav } from "@/components/TopNav";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, HelpCircle, Zap, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export default function PricingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "How does the 30-day free trial work?",
      a: "When you create a G2P Receive Portal, you get full access to receive files and clipboard text completely free for 30 days. No credit card is required to start the trial."
    },
    {
      q: "What happens after the 30 days are up?",
      a: "To keep your permanent inbox and custom Share Code active, you will need to upgrade to a Pro subscription ($4.99/month). If you choose not to subscribe, your portal will be temporarily paused, but your account remains safe."
    },
    {
      q: "Can I cancel my subscription anytime?",
      a: "Yes. You can cancel, upgrade, or downgrade your plan at any time directly through your billing settings dashboard via Stripe Customer Portal."
    },
    {
      q: "Is there a limit on file sizes during the trial?",
      a: "During the trial, you can receive files up to 2 GB per upload. Once you subscribe, the limits are entirely custom-tailored to your R2 bucket allocations."
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-sans selection:bg-primary/20">
      <div>
        <TopNav />
        
        <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
          {/* Back Button */}
          <div className="mb-6">
            <Link 
              href="/g2p" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-background-elevated border-2 border-primary hover:bg-primary/10 text-xs font-bold text-text-primary transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-primary" />
              <span>Back to G2P Portal</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary text-xs font-bold text-primary uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> 30-Day Free Trial
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
              Get Your Permanent <span className="text-primary">G2P Inbox</span>
            </h1>
            <p className="text-text-tertiary text-sm sm:text-base max-w-lg mx-auto">
              Receive large files and clipboard text from anyone directly into your personal dashboard. Free for 1 month, then just $4.99/mo.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            
            {/* Free Trial Tier Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background-card border-2 border-primary rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">30-Day Trial</h3>
                    <p className="text-xs text-text-tertiary mt-1">Try G2P risk-free</p>
                  </div>
                  <span className="px-3.5 py-1 rounded-lg bg-primary/10 border border-primary text-xs font-extrabold text-primary uppercase">
                    Active Plan
                  </span>
                </div>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-text-primary">$0</span>
                  <span className="text-sm text-text-tertiary">/ first month</span>
                </div>

                <ul className="space-y-4">
                  {[
                    "Create your unique Share Code",
                    "Receive files up to 2 GB",
                    "Customized display name profile",
                    "Full dashboard inbox access",
                    "No credit card required"
                  ].map((feat, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm text-text-secondary">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link 
                  href="/g2p"
                  className="w-full h-12 bg-primary/10 text-primary border-2 border-primary hover:bg-primary/20 font-bold rounded-xl flex items-center justify-center transition-all text-sm"
                >
                  Start Using G2P
                </Link>
              </div>
            </motion.div>

            {/* Pro Subscription Tier Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-background-card border-2 border-primary rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Highlight Tag */}
              <div className="absolute top-0 right-0 bg-primary text-background text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl border-l-2 border-b-2 border-primary">
                PRO PASS
              </div>

              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">Pro Lifetime</h3>
                    <p className="text-xs text-text-tertiary mt-1">Keep your portal permanently alive</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-text-primary">$4.99</span>
                  <span className="text-sm text-text-tertiary">/ month</span>
                </div>

                <ul className="space-y-4">
                  {[
                    "Everything in Free Trial",
                    "Keep your 6-char Code active forever",
                    "Unlimited concurrent file drops",
                    "Increased maximum file capacity",
                    "Customized QR codes & page branding",
                    "Priority secure bandwidth lanes"
                  ].map((feat, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm text-text-secondary">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => alert("Stripe checkout session will be configured here!")}
                  className="w-full h-12 bg-primary text-background border-2 border-primary hover:bg-primary-hover font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
                >
                  <Zap className="w-4 h-4 fill-current" /> Subscribe Now
                </button>
              </div>
            </motion.div>

          </div>

          {/* Security Banner */}
          <div className="max-w-4xl mx-auto mt-12 bg-background-elevated border-2 border-primary rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-sm font-bold text-text-primary">Secure Cryptographic Billing</h4>
              <p className="text-xs text-text-tertiary mt-0.5">
                All transactions are fully encrypted and processed directly by Stripe. Share2Me does not store your payment credentials.
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto mt-16 space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary text-center">Frequently Asked Questions</h2>
            
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className="border-2 border-primary rounded-xl overflow-hidden bg-background-card transition-all"
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-text-primary hover:text-primary transition-colors"
                  >
                    <span>{faq.q}</span>
                    <HelpCircle className={`w-4 h-4 text-primary transition-transform duration-200 ${activeFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {activeFaq === index && (
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-text-tertiary border-t border-primary/20 leading-relaxed bg-background/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
