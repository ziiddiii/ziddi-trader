import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { InstallAppButton } from "@/components/install-app-button";
import { EntryBanner } from "@/components/entry-banner";
import {
  TrendingUp,
  ShieldCheck,
  LineChart,
  Wallet,
  ArrowRight,
  Check,
  Sparkles,
  Lock,
  Users,
  ChevronDown,
  Twitter,
  Facebook,
  Instagram,
  Mail,
  Phone,
} from "lucide-react";

const BRAND = "oklch(62% .18 145)";

function ZiidiLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex flex-col leading-none ${className}`}
      aria-label="ZiiDi Trader — powered by M-PESA"
    >
      <span className="flex items-center gap-1.5">
        <span
          className="rounded-md px-2 py-1 text-lg font-black tracking-tight text-white sm:text-xl"
          style={{ backgroundColor: BRAND }}
        >
          ZiiDi
        </span>
        <span
          className="text-lg font-black tracking-tight sm:text-xl"
          style={{ color: BRAND }}
        >
          Trader
        </span>
      </span>
      <span
        className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] sm:text-[10px]"
        style={{ color: BRAND }}
      >
        powered by M‑PESA
      </span>
    </span>
  );
}

function LiveStreamSection() {
  const [playing, setPlaying] = useState(false);
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white"
          style={{ backgroundColor: BRAND }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Live now
        </div>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          ZiiDi MMF market briefing — live
        </h2>
        <p className="mt-3 text-slate-600">
          Tune in to today's live market update and hear directly from our analysts.
        </p>
      </div>
      <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-xl shadow-emerald-900/10">
        <div className="relative aspect-video w-full">
          {playing ? (
            <iframe
              src="https://www.youtube.com/embed/vEPQH5nr20s?autoplay=1&rel=0"
              title="ZiiDi Trader live stream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play ZiiDi Trader live market briefing"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-white"
            >
              <span
                className="grid h-16 w-16 place-items-center rounded-full text-2xl"
                style={{ backgroundColor: BRAND }}
              >
                ▶
              </span>
              <span className="text-sm font-semibold">Tap to play live briefing</span>
              <span className="text-[11px] text-slate-400">Loads only when you tap — saves data</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const SITE_URL = "https://www.ziiditraders.online";

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      // Daraja is configured with the website URL itself as the callback.
      POST: async ({ request }) => {
        const { handleStkCallback } = await import("@/lib/mpesa-callback.server");
        return handleStkCallback(request);
      },
    },
  },
  head: () => ({
    meta: [
      { title: "ZiiDi Trader — Enabling Investing for Everyone" },
      {
        name: "description",
        content:
          "Buy and sell shares on the Nairobi Securities Exchange, track your portfolio and grow your wealth — all from your ZiiDi Trader wallet, powered by M-PESA.",
      },
      { property: "og:title", content: "ZiiDi Trader — Enabling Investing for Everyone" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Hassle-free, seamless and secure share trading powered by M-PESA.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(structuredData),
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    tag: "Invest with ease",
    title: "Buy & sell NSE shares in a few taps",
    body:
      "Discover an effortless way to trade shares on the Nairobi Securities Exchange — connect directly with verified sellers and settle instantly from your phone.",
    bullets: ["Live market prices", "1‑on‑1 chat with sellers", "Instant M‑PESA settlement"],
    art: <ArtBuyPanel />,
  },
  {
    tag: "Customize your portfolio",
    title: "Diversify across the stocks that match your goals",
    body:
      "Approve trades on the move and stay in control of every position. Watch every share bought move straight to your portfolio, ready to be resold at the right moment.",
    bullets: ["Real‑time portfolio value", "Green‑market resell signals", "One tap to cash out"],
    art: <ArtPortfolio />,
  },
  {
    tag: "Bank‑grade security",
    title: "Enhanced security for your funds",
    body:
      "Every login, deposit and withdrawal is protected end‑to‑end. Admin‑approved settlements make sure shares only change hands after payment is confirmed.",
    bullets: ["End‑to‑end encryption", "Admin escrow release", "M‑PESA verified payouts"],
    art: <ArtSecurity />,
  },
  {
    tag: "Grow your wealth",
    title: "A single view of everything you own",
    body:
      "Monitor performance and compound returns over time. Live candle charts show when the market is low to buy and when it turns green to sell for profit.",
    bullets: ["Live candlestick charts", "Profit & loss tracking", "Wealth insights"],
    art: <ArtGrowth />,
  },
];

export const FAQS = [
  {
    q: "What is ZiiDi Trader?",
    a: "ZiiDi Trader is a platform, powered by Safaricom M‑PESA, that lets everyday investors buy and sell shares on the Nairobi Securities Exchange from a single, simple wallet.",
  },
  {
    q: "What are the benefits of ZiiDi Trader?",
    a: "Simplified interface, easy and secure M‑PESA payments, customisable approval levels, and e‑value recycling between your investments and your wallet.",
  },
  {
    q: "Which services are available under ZiiDi Trader?",
    a: "Share purchase, share resale, portfolio tracking, M‑PESA settlement, bank withdrawals and organisation auto‑settlements.",
  },
  {
    q: "How do I sign up?",
    a: "Tap Sign Up, verify your details, and you can start buying shares from listed sellers immediately — no deposit required to begin.",
  },
  {
    q: "Who do I contact for support?",
    a: "Email info@ziiditrader.trading or call our support line on +254 714 011 507. On social you can reach us at @SafaricomPLC and @Safaricom_Care.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "ZiiDi Trader",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.ico`,
      sameAs: [
        "https://twitter.com/SafaricomPLC",
        "https://facebook.com/Safaricom",
      ],
    },
    {
      "@type": "WebSite",
      name: "ZiiDi Trader",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/community?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  ],
};

function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TopNav />
      <Hero />
      <EntryBanner />
      <TrustBar />
      <LiveStreamSection />
      <ToolsSection />
      <StatsBand />
      <CtaBand />
      <FaqSection />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center" aria-label="ZiiDi Trader home">
          <ZiidiLogo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link to="/stories" className="text-sm font-medium text-slate-700 hover:text-emerald-700">Stories & Media</Link>
          <a href="#benefits" className="text-sm font-medium text-slate-700 hover:text-emerald-700">
            Benefits
          </a>
          <a href="#faqs" className="text-sm font-medium text-slate-700 hover:text-emerald-700">
            FAQs
          </a>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("ziidi:open-support"))}
            className="rounded-full border-2 border-emerald-600 px-4 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Trader Support
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/stories" className="text-xs font-semibold text-emerald-700 md:hidden">Stories</Link>
          <Link to="/auth" search={{ mode: "signin" }} className="hidden rounded-full border-2 border-emerald-600 px-4 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 sm:inline-flex">Sign In</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">Sign Up</Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Nairobi Securities Exchange
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Grow your money the{" "}
            <span style={{ color: BRAND }}>ZiiDi MMF</span> way — save,
            invest, prosper.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            The ZiiDi Money Market Fund puts your idle M‑PESA to work — competitive daily returns,
            zero hidden fees and instant liquidity whenever you need it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
            >
              Open a Trading Account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-600 bg-white px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Sign In
            </Link>
            <InstallAppButton className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800" />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-600">
            <TrustPill icon={ShieldCheck} label="Bank‑grade security" />
            <TrustPill icon={Wallet} label="Instant M‑PESA payouts" />
            <TrustPill icon={Users} label="10k+ active investors" />
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-emerald-200/50 via-white to-emerald-100/40 blur-2xl" />
          <HeroDashboardMock />
        </div>
      </div>
    </section>
  );
}

function TrustPill({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function TrustBar() {
  const items = [
    { label: "Safaricom", ticker: "SC" },
    { label: "Equity", ticker: "EQ" },
    { label: "KCB", ticker: "KC" },
    { label: "Absa", ticker: "AB" },
    { label: "BAT", ticker: "BT" },
    { label: "Co-op Bank", ticker: "CB" },
    { label: "EABL", ticker: "EA" },
    { label: "NCBA", ticker: "NC" },
  ];
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
          Trusted markets
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {items.map((s) => (
            <div key={s.label} className="flex items-center gap-2" title={s.label}>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-md bg-white text-[10px] font-black text-emerald-700 shadow-sm ring-1 ring-slate-200"
              >
                {s.ticker}
              </span>
              <span className="text-sm font-semibold text-slate-700">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolsSection() {
  return (
    <section id="benefits" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Why ZiiDi Trader
        </div>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Tools to empower your wealth to the next level
        </h2>
        <p className="mt-4 text-slate-600">
          Everything you need to buy, hold and sell — on one clean, mobile‑first workspace.
        </p>
      </div>

      <div className="mt-16 space-y-24">
        {FEATURES.map((f, i) => (
          <FeatureRow key={f.title} feature={f} reverse={i % 2 === 1} index={i} />
        ))}
      </div>
    </section>
  );
}

function FeatureRow({
  feature,
  reverse,
  index,
}: {
  feature: (typeof FEATURES)[number];
  reverse: boolean;
  index: number;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
          0{index + 1} · {feature.tag}
        </div>
        <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          {feature.title}
        </h3>
        <p className="mt-3 text-slate-600">{feature.body}</p>
        <ul className="mt-5 space-y-2">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3 w-3" />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <Link
          to="/auth"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-emerald-100 to-emerald-50 blur-xl" />
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-emerald-900/5">
            {feature.art}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsBand() {
  const stats = [
    { v: "10k+", l: "Active investors" },
    { v: "KSH 2B+", l: "Traded volume" },
    { v: "60+", l: "Listed stocks" },
    { v: "99.9%", l: "Uptime" },
  ];
  return (
    <section className="bg-emerald-600 py-14 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-3xl font-black sm:text-4xl">{s.v}</div>
            <div className="mt-1 text-sm font-medium text-emerald-50/90">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-8 py-14 text-slate-900 sm:px-14 sm:py-20">
        <div
          aria-hidden
          className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-300/40 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-4 text-slate-600">
            Sign up now to start investing with ease on ZiiDi Trader. No deposit required — buy shares
            directly from verified sellers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
            >
              Sign Up <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-600 px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faqs" className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
          FAQ
        </div>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Frequently Asked Questions
        </h2>
      </div>
      <div className="mt-10 space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm open:border-emerald-200 open:bg-emerald-50/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-slate-900">
              {f.q}
              <ChevronDown className="h-5 w-5 shrink-0 text-emerald-600 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <ZiidiLogo />
            <p className="mt-4 max-w-sm text-sm text-slate-500">
              A Safaricom platform enabling everyday investors to buy, hold and sell shares on the
              Nairobi Securities Exchange.
            </p>
            <div className="mt-5 flex gap-3">
              <SocialIcon icon={Twitter} />
              <SocialIcon icon={Facebook} />
              <SocialIcon icon={Instagram} />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Product</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#benefits" className="hover:text-emerald-700">Benefits</a></li>
              <li><Link to="/deposit" className="hover:text-emerald-700">Buy shares</Link></li>
              <li><Link to="/portfolio" className="hover:text-emerald-700">Portfolio</Link></li>
              <li><Link to="/withdraw" className="hover:text-emerald-700">Withdraw</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Support</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-600" /> info@ziiditrader.trading</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-600" /> 0722000000</li>
              <li><a href="#faqs" className="hover:text-emerald-700">FAQs</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row">
          <div>© {new Date().getFullYear()} ZiiDi Trader. All rights reserved.</div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-emerald-700">Privacy</a>
            <a href="#" className="hover:text-emerald-700">Terms</a>
            <a href="#" className="hover:text-emerald-700">Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon: Icon }: { icon: typeof Twitter }) {
  return (
    <a
      href="#"
      className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-500 hover:border-emerald-600 hover:text-emerald-700"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

/* -------- Decorative SVG art (inline, no external assets) -------- */

function HeroDashboardMock() {
  return (
    <div className="relative mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-emerald-900/10">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </div>
        <div className="text-xs font-semibold text-slate-500">Investment balance</div>
      </div>
      <div className="mt-4 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white">
        <div className="text-xs opacity-80">Portfolio value</div>
        <div className="mt-1 text-3xl font-black tracking-tight">KSH 148,320.55</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
          <TrendingUp className="h-3 w-3" /> +4.82% today
        </div>
      </div>
      <div className="mt-4">
        <MiniChart />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { s: "SAFCOM", p: "18.20", c: "+0.85%" },
          { s: "EQTY", p: "46.75", c: "-0.32%" },
          { s: "KCB", p: "38.90", c: "+1.10%" },
        ].map((t) => (
          <div key={t.s} className="rounded-lg border border-slate-100 p-2 text-center">
            <div className="text-[10px] font-bold text-slate-500">{t.s}</div>
            <div className="text-sm font-black text-slate-900">{t.p}</div>
            <div
              className={`text-[10px] font-semibold ${
                t.c.startsWith("+") ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {t.c}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniChart() {
  return (
    <svg viewBox="0 0 300 90" className="h-24 w-full">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 70 L30 60 L60 65 L90 45 L120 50 L150 30 L180 38 L210 22 L240 28 L270 15 L300 20 L300 90 L0 90 Z"
        fill="url(#g)"
      />
      <path
        d="M0 70 L30 60 L60 65 L90 45 L120 50 L150 30 L180 38 L210 22 L240 28 L270 15 L300 20"
        fill="none"
        stroke="#059669"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArtBuyPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold">Buy ABSA</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">LIVE</span>
      </div>
      <div className="mt-3 text-3xl font-black text-slate-900">KSH 30,000</div>
      <div className="text-xs text-slate-500">Estimated shares: 1,106</div>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs">
        <span className="font-semibold text-emerald-700">Sell at KSH 45,000</span>
        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-emerald-700 ring-1 ring-emerald-200">
          Very Minimal risk
        </span>
      </div>
      <div className="mt-4">
        <Candles />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600">
          Back
        </button>
        <button className="rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white">
          Continue
        </button>
      </div>
    </div>
  );
}

function Candles() {
  const data = [
    [30, 60, 20, 50], [40, 55, 30, 45], [45, 65, 35, 55], [50, 70, 40, 60],
    [55, 75, 45, 65], [60, 80, 50, 70], [55, 78, 48, 72], [65, 85, 55, 78],
    [70, 88, 60, 80], [75, 90, 65, 85],
  ];
  return (
    <svg viewBox="0 0 200 100" className="h-24 w-full">
      {data.map((d, i) => {
        const x = 10 + i * 18;
        const [o, h, l, c] = d;
        const up = c >= o;
        const color = up ? "#10b981" : "#ef4444";
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={100 - h} y2={100 - l} stroke={color} strokeWidth="1.5" />
            <rect
              x={x - 4}
              y={100 - Math.max(o, c)}
              width="8"
              height={Math.max(2, Math.abs(c - o))}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

function ArtPortfolio() {
  const rows = [
    { s: "SAFCOM", qty: 320, p: "18.20", c: "+2.1%" },
    { s: "EQTY", qty: 140, p: "46.75", c: "+1.4%" },
    { s: "KCB", qty: 90, p: "38.90", c: "+0.9%" },
    { s: "BAT", qty: 20, p: "522.34", c: "-0.5%" },
  ];
  return (
    <div className="rounded-xl bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-900">My portfolio</div>
        <div className="text-xs font-semibold text-emerald-600">+KSH 4,120 today</div>
      </div>
      <MiniChart />
      <div className="mt-2 divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.s} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-bold text-slate-900">{r.s}</div>
              <div className="text-[11px] text-slate-500">{r.qty} shares</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-slate-900">KSH {r.p}</div>
              <div
                className={`text-[11px] font-semibold ${
                  r.c.startsWith("+") ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {r.c}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtSecurity() {
  return (
    <div className="grid place-items-center rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-10 text-slate-900">
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-emerald-300/30 blur-2xl" />
        <div className="relative grid h-28 w-28 place-items-center rounded-3xl bg-white shadow-lg shadow-emerald-900/10 ring-1 ring-emerald-100">
          <Lock className="h-12 w-12 text-emerald-600" />
        </div>
      </div>
      <div className="mt-6 text-center">
        <div className="text-lg font-black text-slate-900">End‑to‑end encrypted</div>
        <div className="mt-1 text-xs text-slate-600">
          M‑PESA verified · Admin escrow · Every session protected
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1">SOC 2</span>
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1">ISO 27001</span>
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1">PCI DSS</span>
      </div>
    </div>
  );
}

function ArtGrowth() {
  return (
    <div className="rounded-xl bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Net worth
          </div>
          <div className="mt-1 text-3xl font-black text-slate-900">KSH 214,900</div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
          <TrendingUp className="h-3 w-3" /> +18.4%
        </div>
      </div>
      <svg viewBox="0 0 300 130" className="mt-4 h-36 w-full">
        <defs>
          <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 110 C40 100 60 90 90 80 S150 60 180 50 S250 25 300 15 L300 130 L0 130 Z"
          fill="url(#g2)"
        />
        <path
          d="M0 110 C40 100 60 90 90 80 S150 60 180 50 S250 25 300 15"
          fill="none"
          stroke="#059669"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {[0, 60, 120, 180, 240, 300].map((x) => (
          <line key={x} x1={x} x2={x} y1="0" y2="130" stroke="#f1f5f9" strokeWidth="1" />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px] font-semibold text-slate-500">
        <div>JAN</div><div>APR</div><div>JUL</div><div>OCT</div>
      </div>
    </div>
  );
}

/* Silence unused warning for LineChart import if tree-shaken. */
void LineChart;