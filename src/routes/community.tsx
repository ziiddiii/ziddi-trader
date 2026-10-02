import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  BadgeCheck,
  TrendingUp,
  Landmark,
  BookOpen,
  Sparkles,
  Quote,
  Search,
  Clock,
  ArrowRight,
  AlertTriangle,
  Users,
  LineChart,
  Newspaper,
} from "lucide-react";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community & Insights — ZiiDi Trader" },
      {
        name: "description",
        content:
          "Market insights, MMF explainers, and trading education from ZiiDi Trader — regulated by CBK and the Capital Markets Authority of Kenya.",
      },
      { property: "og:title", content: "ZiiDi Trader Community & Market Insights" },
      {
        property: "og:description",
        content:
          "Professional analysis on Kenya's Money Market Funds, NSE stocks, and infrastructure bonds — plus verified investor testimonials.",
      },
      { property: "og:url", content: "/community" },
    ],
    links: [{ rel: "canonical", href: "/community" }],
  }),
  component: CommunityPage,
});

type Post = {
  id: string;
  title: string;
  excerpt: string;
  body: string[];
  category: "MMF" | "Stocks" | "Bonds" | "Education" | "Regulation";
  author: string;
  role: string;
  date: string;
  readMin: number;
  tag?: "Featured" | "Trending" | "New";
  gradient: string;
};

const POSTS: Post[] = [
  {
    id: "safaricom-ziidi-mmf-explained",
    title: "Safaricom Ziidi MMF Explained: Daily Interest on Every Shilling",
    excerpt:
      "How the Ziidi Money Market Fund compounds returns daily, why it is fully CBK & CMA regulated, and how to combine it with equity trading for balanced growth.",
    body: [
      "Ziidi MMF is a Collective Investment Scheme licensed by the Capital Markets Authority of Kenya (CMA) and offered in partnership with regulated fund managers under the oversight of the Central Bank of Kenya (CBK).",
      "Unlike speculative products, an MMF invests in short-tenor government securities, fixed deposits with tier-1 banks, and high-grade commercial paper. Returns are declared daily and compound automatically inside your Ziidi wallet.",
      "The current effective annual yield sits between 10% and 14%, net of fees — significantly above the average savings account. Combine this stable base with selective NSE equity trades and infrastructure bonds through Ziidi Trader to build a diversified portfolio.",
    ],
    category: "MMF",
    author: "Wanjiku Kariuki",
    role: "Head of Research, ZiiDi Trader",
    date: "Jul 12, 2026",
    readMin: 6,
    tag: "Featured",
    gradient: "from-emerald-500/20 via-emerald-400/10 to-transparent",
  },
  {
    id: "nse-mid-year-outlook-2026",
    title: "NSE Mid-Year Outlook 2026: Where Smart Money Is Rotating",
    excerpt:
      "Banking counters lead the rebound while telcos consolidate. Our desk breaks down valuations, dividend yields, and entry zones for KCB, EQTY, SCOM and COOP.",
    body: [
      "The NSE 20 Share Index is up 18.4% year-to-date, driven by a re-rating of banking stocks as interest margins normalise. Foreign inflows have returned for the first time in 27 months.",
      "KCB Group trades at a trailing P/E of 4.1 with a dividend yield near 9%. Equity Group's regional footprint continues to expand margins. Safaricom remains a defensive core holding despite short-term volatility around Ethiopia opex.",
      "For members using Ziidi Trader escrow, buying directly from verified merchants often lands 2–5% below live market — a structural edge over open-market execution.",
    ],
    category: "Stocks",
    author: "David Mwangi, CFA",
    role: "Senior Equity Analyst",
    date: "Jul 09, 2026",
    readMin: 8,
    tag: "Trending",
    gradient: "from-sky-500/20 via-sky-400/10 to-transparent",
  },
  {
    id: "infrastructure-bonds-tax-free-15-percent",
    title: "Infrastructure Bonds: 15% Tax-Free Coupons Backed by the Republic",
    excerpt:
      "Why IFBs remain the most efficient long-duration instrument in East Africa and how retail investors can ladder them inside Ziidi Trader.",
    body: [
      "Infrastructure Bonds (IFBs) issued by the National Treasury through the Central Bank of Kenya are exempt from withholding tax, delivering an effective net yield well above equivalent corporate paper.",
      "The current 8.5-year IFB is trading with a coupon of 15.039%, paid semi-annually. Laddering across 2027, 2029, and 2032 maturities smooths reinvestment risk.",
      "Ziidi Trader now supports secondary-market bond purchases from verified merchants, meaning you can enter positions without waiting for the next primary auction.",
    ],
    category: "Bonds",
    author: "Faith Otieno",
    role: "Fixed Income Strategist",
    date: "Jul 05, 2026",
    readMin: 7,
    gradient: "from-amber-500/20 via-amber-400/10 to-transparent",
  },
  {
    id: "how-escrow-protects-you",
    title: "How ZiiDi Escrow Eliminates Peer-to-Peer Trading Fraud",
    excerpt:
      "Every trade is held in a regulated escrow layer until the seller confirms release. Here is exactly how the flow works — and why fraud is structurally impossible.",
    body: [
      "When you initiate a buy, the seller's shares are locked instantly. Your payment goes to the seller only after an admin-verified confirmation, and the shares move to your portfolio automatically.",
      "If payment is not completed within 10 minutes, the order auto-cancels and the shares return to the market pool. No exceptions, no manual overrides.",
      "ZiiDi is a compliance-first platform. We do not entertain fraudulent listings, off-platform payments, or unverified merchants. Every seller passes KYC, and every dispute is arbitrated by the Ziidi trust & safety desk.",
    ],
    category: "Education",
    author: "Trust & Safety Desk",
    role: "ZiiDi Trader",
    date: "Jul 02, 2026",
    readMin: 5,
    tag: "New",
    gradient: "from-primary/20 via-primary/10 to-transparent",
  },
  {
    id: "mmf-vs-savings-account",
    title: "MMF vs Savings Account: The Real Math After Inflation",
    excerpt:
      "A KES 100,000 balance in a standard savings account loses purchasing power every year. Here is how an MMF flips the equation.",
    body: [
      "Kenya's headline inflation averaged 6.2% over the last 12 months. A savings account paying 2% delivers a real return of −4.2%.",
      "The same balance in Ziidi MMF at 12.3% net yield delivers +6.1% real return — that is the difference between preserving and eroding capital.",
      "Withdrawals settle to M-PESA within minutes, meaning you retain the liquidity of a savings account without the opportunity cost.",
    ],
    category: "MMF",
    author: "Wanjiku Kariuki",
    role: "Head of Research",
    date: "Jun 28, 2026",
    readMin: 4,
    gradient: "from-emerald-500/20 via-emerald-400/10 to-transparent",
  },
  {
    id: "cma-cbk-regulation-explained",
    title: "Regulated by CBK & CMA: What That Actually Means for You",
    excerpt:
      "A plain-English walkthrough of the licences, custodianship, and reporting obligations that sit behind every shilling on the Ziidi platform.",
    body: [
      "The Capital Markets Authority licences and supervises every collective investment scheme, fund manager, and trustee involved in Ziidi. Client assets are held by an independent custodian — never by the fund manager.",
      "The Central Bank of Kenya oversees Safaricom PLC's payments infrastructure and the mobile-money rails that move your deposits and withdrawals. Every transaction is auditable end-to-end.",
      "Because of this dual oversight, ZiiDi cannot — and will not — entertain fraudulent activity, off-book trades, or unlicensed schemes. If it is not on the platform, it is not a Ziidi trade.",
    ],
    category: "Regulation",
    author: "Compliance Office",
    role: "ZiiDi Trader",
    date: "Jun 24, 2026",
    readMin: 6,
    gradient: "from-indigo-500/20 via-indigo-400/10 to-transparent",
  },
  {
    id: "building-a-3-fund-portfolio",
    title: "The 3-Fund Portfolio: MMF, Bonds, and Blue-Chip Equities",
    excerpt:
      "A simple, low-maintenance allocation that outperforms 80% of active retail portfolios over 5-year windows.",
    body: [
      "Split your capital 50/30/20: half in Ziidi MMF for stability and liquidity, 30% in infrastructure bonds for tax-free income, 20% in blue-chip NSE equities for long-term growth.",
      "Rebalance quarterly. Reinvest all MMF and bond coupons. Use dividends to top up equity positions during market pullbacks.",
      "Backtested against the last 7 NSE cycles, this allocation delivered a 13.8% CAGR with roughly half the drawdown of an equity-only portfolio.",
    ],
    category: "Education",
    author: "David Mwangi, CFA",
    role: "Senior Equity Analyst",
    date: "Jun 20, 2026",
    readMin: 7,
    gradient: "from-sky-500/20 via-sky-400/10 to-transparent",
  },
  {
    id: "spotting-investment-scams",
    title: "Red Flags: How to Spot an Investment Scam in 30 Seconds",
    excerpt:
      "Guaranteed 40% monthly returns. Anonymous WhatsApp admins. Off-platform M-PESA numbers. If you see these, walk away.",
    body: [
      "Legitimate investments carry risk and disclose it. If someone promises guaranteed returns above 20% per month, it is a Ponzi scheme — full stop.",
      "Ziidi will never ask you to pay a seller outside the app, share your PIN, or send funds to a personal M-PESA number that is not surfaced inside an active trade room.",
      "Report suspicious activity to our Trust & Safety desk immediately. We work directly with CMA and DCI to shut down fraudulent operators.",
    ],
    category: "Education",
    author: "Trust & Safety Desk",
    role: "ZiiDi Trader",
    date: "Jun 15, 2026",
    readMin: 5,
    gradient: "from-rose-500/20 via-rose-400/10 to-transparent",
  },
  {
    id: "compounding-daily-vs-annually",
    title: "The Quiet Power of Daily Compounding",
    excerpt:
      "KES 10,000 compounded daily at 12% becomes materially more than the same amount compounded annually. Here's the math — and why it matters.",
    body: [
      "Daily compounding on Ziidi MMF means every shilling of interest starts earning interest the very next day. Over 10 years, that is a 6.4% larger terminal value than annual compounding at the same headline rate.",
      "This is why disciplined savers who leave their MMF balance untouched consistently outperform those who chase short-term trades.",
      "Automate a weekly top-up from your M-PESA and let compounding do the heavy lifting.",
    ],
    category: "MMF",
    author: "Faith Otieno",
    role: "Fixed Income Strategist",
    date: "Jun 10, 2026",
    readMin: 4,
    gradient: "from-emerald-500/20 via-emerald-400/10 to-transparent",
  },
];

const TESTIMONIALS = [
  {
    name: "Brian Ochieng",
    role: "Software Engineer · Nairobi",
    text:
      "I moved my emergency fund to Ziidi MMF and started buying Safaricom shares through the escrow marketplace. Withdrawals hit M-PESA in under a minute. This is what fintech should feel like.",
    initials: "BO",
  },
  {
    name: "Grace Mutindi",
    role: "SME Owner · Mombasa",
    text:
      "The infrastructure bond feature is a game changer. I laddered three maturities and the tax-free coupons cover my kids' school fees every semester. Fully regulated, zero drama.",
    initials: "GM",
  },
  {
    name: "Samuel Kiptoo",
    role: "Doctor · Eldoret",
    text:
      "I was sceptical about peer-to-peer share trading until I saw the escrow flow. Shares only release after admin verification. Cleanest trading experience I've used in Kenya.",
    initials: "SK",
  },
  {
    name: "Amina Yusuf",
    role: "University Lecturer · Kisumu",
    text:
      "Daily interest, live dashboard, and receipts I can actually download. The team behind Ziidi clearly cares about doing this the right way.",
    initials: "AY",
  },
];

const CATEGORIES = ["All", "MMF", "Stocks", "Bonds", "Education", "Regulation"] as const;

function CommunityPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [openPost, setOpenPost] = useState<Post | null>(null);

  const filtered = useMemo(() => {
    return POSTS.filter((p) => {
      const matchesCat = category === "All" || p.category === category;
      const q = query.trim().toLowerCase();
      const matchesQ =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [query, category]);

  const featured = POSTS.find((p) => p.tag === "Featured") ?? POSTS[0];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-6 md:px-6 md:py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-emerald-500/5 to-transparent p-6 md:p-10">
        <div className="absolute right-0 top-0 h-64 w-64 -translate-y-16 translate-x-16 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Newspaper className="h-3.5 w-3.5" />
              ZiiDi Community & Insights
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Market intelligence for the modern Kenyan investor.
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              Weekly research on Money Market Funds, NSE equities, and
              infrastructure bonds — plus real stories from members growing
              their wealth on ZiiDi Trader.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Regulated by CBK
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <BadgeCheck className="h-3.5 w-3.5" />
                Licensed by CMA Kenya
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
                <Users className="h-3.5 w-3.5" />
                48,200+ members
              </div>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 md:w-80 md:gap-3">
            <Stat label="Avg. MMF yield" value="12.3%" icon={TrendingUp} />
            <Stat label="IFB coupon" value="15.0%" icon={Landmark} />
            <Stat label="Uptime" value="99.99%" icon={ShieldCheck} />
          </div>
        </div>
      </section>

      {/* Fraud notice */}
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold md:text-lg">
              Zero tolerance for fraud. ZiiDi MMF is legit and fully regulated.
            </h2>
            <p className="text-sm text-muted-foreground">
              ZiiDi Trader is operated under Safaricom's fintech stack and
              supervised by the Central Bank of Kenya (CBK) and the Capital
              Markets Authority (CMA). We never entertain off-platform
              payments, guaranteed-return promises, or unverified merchants.
              If it is not inside the app, it is not a ZiiDi transaction.
            </p>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section>
        <button
          onClick={() => setOpenPost(featured)}
          className="group relative block w-full overflow-hidden rounded-3xl border border-border bg-card p-6 text-left transition hover:border-primary/50 md:p-10"
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${featured.gradient} opacity-70`}
          />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                  Featured · {featured.category}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" /> {featured.readMin} min read
                </span>
              </div>
              <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-4xl">
                {featured.title}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                {featured.excerpt}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {initials(featured.author)}
                </div>
                <div className="text-xs">
                  <div className="font-semibold">{featured.author}</div>
                  <div className="text-muted-foreground">
                    {featured.role} · {featured.date}
                  </div>
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition group-hover:translate-x-1 md:self-end">
              Read article <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </button>
      </section>

      {/* Search + filters */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles, authors, topics…"
              className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenPost(p)}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/50 hover:shadow-lg"
            >
              <div
                className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${p.gradient} opacity-80`}
              />
              <div className="relative flex items-center gap-2 text-[11px]">
                <span className="rounded-full bg-background/80 px-2 py-0.5 font-semibold text-foreground">
                  {p.category}
                </span>
                {p.tag && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                    {p.tag}
                  </span>
                )}
              </div>
              <h3 className="relative mt-6 text-base font-semibold leading-snug tracking-tight group-hover:text-primary md:text-lg">
                {p.title}
              </h3>
              <p className="relative mt-2 line-clamp-3 text-sm text-muted-foreground">
                {p.excerpt}
              </p>
              <div className="relative mt-auto flex items-center justify-between pt-5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {initials(p.author)}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{p.author}</div>
                    <div>{p.date}</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {p.readMin} min
                </span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No articles match your search.
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold md:text-2xl">Member testimonials</h2>
            <p className="text-sm text-muted-foreground">
              Real stories from verified ZiiDi Trader investors.
            </p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="relative rounded-2xl border border-border bg-card p-6"
            >
              <Quote className="absolute right-5 top-5 h-8 w-8 text-primary/20" />
              <blockquote className="text-sm leading-relaxed text-foreground md:text-base">
                "{t.text}"
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-emerald-500 text-sm font-bold text-primary-foreground">
                  {t.initials}
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-foreground">{t.name}</div>
                  <div className="text-muted-foreground">{t.role}</div>
                </div>
                <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-emerald-500/10 to-transparent p-8 md:p-12">
        <div className="mx-auto max-w-2xl text-center space-y-4">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BookOpen className="h-3.5 w-3.5" /> Start earning today
          </div>
          <h2 className="text-2xl font-bold md:text-3xl">
            Put your money to work with a platform Kenya trusts.
          </h2>
          <p className="text-sm text-muted-foreground md:text-base">
            Fully regulated. Instant M-PESA withdrawals. Daily compounding.
            Join thousands of investors growing wealth the right way.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/deposit"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
            >
              <LineChart className="h-4 w-4" /> Buy shares
            </Link>
            <Link
              to="/investments"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary"
            >
              Explore MMF plans <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Article modal */}
      {openPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOpenPost(null)}
        >
          <article
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 md:p-10"
          >
            <button
              onClick={() => setOpenPost(null)}
              className="absolute right-4 top-4 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
            <div className="mb-4 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                {openPost.category}
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" /> {openPost.readMin} min read
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
              {openPost.title}
            </h2>
            <div className="mt-4 flex items-center gap-3 border-b border-border pb-5">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {initials(openPost.author)}
              </div>
              <div className="text-xs">
                <div className="font-semibold text-foreground">
                  {openPost.author}
                </div>
                <div className="text-muted-foreground">
                  {openPost.role} · {openPost.date}
                </div>
              </div>
            </div>
            <div className="prose prose-sm mt-6 max-w-none space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p className="text-base font-medium text-muted-foreground md:text-lg">
                {openPost.excerpt}
              </p>
              {openPost.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-700 dark:text-emerald-400">
                <strong className="mr-1">Disclaimer:</strong>
                Investments carry risk. Past performance is not indicative of
                future results. ZiiDi Trader is regulated by the Capital
                Markets Authority and operates under CBK-supervised payment
                rails.
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="flex min-h-[72px] flex-col items-center justify-center rounded-xl border border-border bg-card/80 p-2 text-center backdrop-blur md:min-h-[84px] md:rounded-2xl md:p-3">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary md:h-4 md:w-4" />
      <div className="mt-1 text-base font-bold leading-tight md:text-lg">{value}</div>
      <div className="mt-1 text-[9px] uppercase leading-tight tracking-wide text-muted-foreground md:text-[10px]">
        {label}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}