import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Check } from "lucide-react";
import { Link } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TIERS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    description: "Perfect for single-venue operators getting started with voice AI.",
    features: [
      "1 venue",
      "2 agents",
      "500 voice minutes/mo",
      "Email support",
    ],
    cta: "Get Started",
    plan: "starter",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mo",
    description: "For growing venues that need unlimited agents and deep integrations.",
    features: [
      "3 venues",
      "Unlimited agents",
      "2,000 voice minutes/mo",
      "Priority support",
      "Square & Toast integration",
    ],
    cta: "Get Started",
    plan: "pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For multi-venue groups and hospitality brands at scale.",
    features: [
      "Unlimited venues",
      "Unlimited agents",
      "Unlimited voice minutes",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    plan: "enterprise",
    highlighted: false,
  },
];

const FAQS = [
  {
    question: "Can I switch plans later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    question: "What happens if I exceed my voice minutes?",
    answer:
      "We'll notify you when you reach 80% of your limit. Additional minutes are billed at $0.08/min for Starter and $0.05/min for Pro.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. You can sign up and explore the platform with a free trial — no credit card required.",
  },
  {
    question: "What POS systems do you integrate with?",
    answer:
      "We currently support Square and Toast POS integrations. More integrations are on our roadmap.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes — every new account gets a 14-day free trial on the Pro plan so you can experience the full platform before committing.",
  },
  {
    question: "How does Enterprise pricing work?",
    answer:
      "Enterprise pricing is based on the number of venues, expected voice volume, and custom integration requirements. Contact our sales team for a tailored quote.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Navbar />

      <main className="pt-32 pb-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h1 data-testid="text-pricing-title" className="text-5xl md:text-6xl font-medium tracking-tight text-glow">
            Simple, transparent pricing
          </h1>
          <p data-testid="text-pricing-subtitle" className="text-white/50 text-lg mt-4 font-light">
            Start free, scale as you grow. No hidden fees.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              data-testid={`card-pricing-${tier.plan}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                tier.highlighted
                  ? "border-white/30 bg-white/[0.06]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {tier.highlighted && (
                <span
                  data-testid="badge-most-popular"
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-semibold px-4 py-1 rounded-full"
                >
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <h3 data-testid={`text-tier-name-${tier.plan}`} className="text-lg font-semibold mb-1">
                  {tier.name}
                </h3>
                <p className="text-white/40 text-sm font-light">{tier.description}</p>
              </div>

              <div className="mb-8">
                <span data-testid={`text-tier-price-${tier.plan}`} className="text-4xl font-semibold tracking-tight">
                  {tier.price}
                </span>
                {tier.period && <span className="text-white/40 text-sm">{tier.period}</span>}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-white/70">
                    <Check size={16} className="text-white/50 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.plan === "enterprise" ? "#" : `/register?plan=${tier.plan}`}
                data-testid={`button-cta-${tier.plan}`}
                className={`block text-center rounded-full py-3 text-sm font-medium transition-all duration-300 ${
                  tier.highlighted
                    ? "bg-white text-black hover:bg-white/90"
                    : "border border-white/20 text-white hover:bg-white hover:text-black"
                }`}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="max-w-2xl mx-auto mt-24"
        >
          <h2 data-testid="text-faq-title" className="text-2xl font-semibold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-white/10">
                <AccordionTrigger
                  data-testid={`button-faq-${i}`}
                  className="text-white/80 hover:text-white hover:no-underline text-left"
                >
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent data-testid={`text-faq-answer-${i}`} className="text-white/50">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </main>

      <footer className="border-t border-white/10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center text-xs text-white/40 gap-4">
        <div>© 2026 BevPro Inc. — The hospitality intelligence platform.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
}
