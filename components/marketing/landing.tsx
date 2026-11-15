import Link from "next/link";

import { GraceMark } from "@/components/grace/logo";
import { HeroComposer } from "@/components/marketing/hero-composer";

/**
 * The public page.
 *
 * Layout follows the reference that was measured, not a generic SaaS landing
 * page: a centred column 800px wide, a serif headline over a highlighter word,
 * a single card of six things to try, and one composer directly beneath it. The
 * "Get started" label and every model name are gone — a guest types what they
 * want and lands in the product.
 *
 * Everything here is server-rendered copy; the only client islands are the
 * composer and the account dialog, so the page is readable before any JS runs.
 */

type LandingProps = {
  brandName: string;
  tagline: string;
  signupEnabled: boolean;
  chatEnabled: boolean;
  announcement: { id: string; text: string; href: string } | null;
  footerNote: string;
  signedIn: boolean;
};

const STARTERS = [
  {
    title: "Explain something",
    body: "A concept, a document, or a piece of code",
    prompt: "Explain ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
        <path d="M12 3v3M5.6 5.6l2.1 2.1M18.4 5.6l-2.1 2.1M3 12h3M18 12h3" strokeLinecap="round" />
        <path d="M12 8a4 4 0 0 0-4 4c0 2 1.7 2.7 1.7 4.5h4.6C14.3 14.7 16 14 16 12a4 4 0 0 0-4-4Z" strokeLinejoin="round" />
        <path d="M10 20h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Draft and revise",
    body: "Write it, then tighten it until it reads well",
    prompt: "Draft ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
        <path d="M4 20h16M6 16.5 16.2 6.3a2.1 2.1 0 0 1 3 3L9 19.5H5.5l.5-3Z" strokeLinejoin="round" />
        <path d="M14.5 8l2 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Work through a problem",
    body: "Lay out the options and argue for one",
    prompt: "Help me think through ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
        <path d="M4 6h7M4 12h5M4 18h9" strokeLinecap="round" />
        <path d="M16.5 6.5 20 12l-3.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="12" r="1.6" />
      </svg>
    ),
  },
  {
    title: "Build something small",
    body: "A script, a page, or a fix — end to end",
    prompt: "Build ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
        <path d="m9 8-4 4 4 4M15 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Search and summarise",
    body: "Pull the useful part out of something long",
    prompt: "Summarise ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.2-4.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Plan the next week",
    body: "Turn a messy list into something doable",
    prompt: "Plan ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path d="M4 10h16M9 3v4M15 3v4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Landing({
  brandName,
  tagline,
  signupEnabled,
  chatEnabled,
  announcement,
  footerNote,
  signedIn,
}: LandingProps) {
  const startHref = signedIn ? "/" : "/welcome?mode=signin";

  return (
    <div data-theme="paper" className="min-h-[100dvh] w-full bg-bg text-ink">
      <div className="flex min-h-[100dvh] flex-col">
        {/* ---------------------------------------------------------------- nav */}
        <header className="sticky top-0 z-30 border-b border-hairline/70 bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 sm:h-16 sm:px-6">
            <Link href="/welcome" className="flex items-center gap-2.5 rounded-[8px] py-1">
              <span className="grid size-8 place-items-center rounded-[9px] bg-[#252523] text-[#FCFAF8]">
                <GraceMark className="h-[19px] w-[19px]" />
              </span>
              <span className="font-display text-[19px] leading-none tracking-[-0.02em] text-ink">
                {brandName}
              </span>
            </Link>

            <nav className="ml-4 hidden items-center gap-1 sm:flex" aria-label="Sections">
              <a
                href="#how"
                className="rounded-[6px] px-2.5 py-1.5 text-[13.5px] text-sub transition-colors hover:bg-surface-raised hover:text-ink"
              >
                How it works
              </a>
              <a
                href="#pricing"
                className="rounded-[6px] px-2.5 py-1.5 text-[13.5px] text-sub transition-colors hover:bg-surface-raised hover:text-ink"
              >
                Plans
              </a>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/welcome?mode=signin"
                className="hidden rounded-[4px] px-2.5 py-1.5 text-[13.5px] text-ink transition-colors hover:bg-surface-raised sm:block"
              >
                Log in
              </Link>
              <Link
                href={startHref}
                className="rounded-[4px] bg-[#252523] px-3 py-1.5 text-[13.5px] font-medium text-[#FCFAF8] transition-colors hover:bg-[#3b3b38]"
              >
                {signedIn ? "Open Grace" : signupEnabled ? "Create account" : "Sign in"}
              </Link>
            </div>
          </div>

          {announcement && (
            <div className="border-t border-hairline bg-[#F4C406]/16">
              <div className="mx-auto flex w-full max-w-[1120px] items-center justify-center gap-2 px-4 py-1.5 text-center text-[12.5px] text-ink">
                <span className="min-w-0">{announcement.text}</span>
                {announcement.href && (
                  <a href={announcement.href} className="shrink-0 font-medium underline decoration-1 underline-offset-2">
                    More
                  </a>
                )}
              </div>
            </div>
          )}
        </header>

        {/* --------------------------------------------------------------- hero */}
        <main className="flex flex-1 flex-col">
          <section className="mx-auto w-full max-w-[800px] px-4 pb-2 pt-10 sm:px-6 sm:pt-16">
            <div className="paper-rise flex flex-col items-center">
              <span className="mb-5 flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-[12px] text-sub">
                <span className="size-1.5 rounded-full bg-[#F4C406]" aria-hidden="true" />
                {tagline}
              </span>

              <h1 className="paper-header text-center">
                <span className="block sm:inline">Where should </span>
                <span className="block sm:inline">
                  we <span className="paper-highlight">start</span>?
                </span>
              </h1>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[800px] px-4 pb-6 sm:px-6" aria-label="Start a chat">
            <div className="paper-rise" style={{ animationDelay: "80ms" }}>
              <HeroComposer chatEnabled={chatEnabled} signedIn={signedIn} signupEnabled={signupEnabled} />
            </div>
          </section>

          {/* Six things to try. A grid on anything wider than a phone; a
              horizontal rail on phones, which is what the reference does so
              six cards never stack into a wall. */}
          <section className="mx-auto w-full max-w-[800px] px-4 pb-14 sm:px-6" aria-label="Things to try">
            {/* A rail on phones, a 3×2 grid from `sm` up — the same switch the
                reference makes, so six cards never become a wall on a phone. */}
            <div
              className="paper-rise no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0"
              style={{ animationDelay: "140ms" }}
            >
              {STARTERS.map((starter) => (
                <Link
                  key={starter.title}
                  href={signedIn ? "/?prompt=" + encodeURIComponent(starter.prompt) : "/welcome?mode=signin"}
                  className="paper-lift group flex min-w-[232px] shrink-0 items-center gap-2.5 rounded-[14px] border border-hairline bg-surface p-2.5 text-left sm:min-w-0 sm:shrink"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-hairline bg-surface-raised text-sub transition-colors group-hover:bg-surface">
                    {starter.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[12px] leading-4 text-ink">{starter.title}</span>
                    <span className="truncate text-[10px] leading-3 text-sub">{starter.body}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* ---------------------------------------------------------- how it works */}
          <section id="how" className="border-t border-hairline bg-surface/60">
            <div className="mx-auto w-full max-w-[800px] px-4 py-12 sm:px-6 sm:py-16">
              <h2 className="font-display text-[30px] leading-[1.15] tracking-[-0.02em] text-ink sm:text-[36px]">
                One input. <span className="text-sub">No model menus.</span>
              </h2>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-[24px] text-sub">
                Grace decides how to answer, so you never have to know which engine is behind a
                question. Tell it what to do; set how hard it should think.
              </p>

              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                <Step
                  n="01"
                  title="Say what you need"
                  body="Chat, paste, attach a file, or point Grace at a repository. One box for all of it."
                />
                <Step
                  n="02"
                  title="Set the effort"
                  body="Five levels, from an instant answer to deep work. Slide it once and stop worrying about it."
                />
                <Step
                  n="03"
                  title="Keep what matters"
                  body="Conversations, notes and projects stay put. Grace remembers the facts you save."
                />
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------- plans */}
          <section id="pricing" className="border-t border-hairline">
            <div className="mx-auto w-full max-w-[800px] px-4 py-12 sm:px-6 sm:py-16">
              <h2 className="font-display text-[30px] leading-[1.15] tracking-[-0.02em] text-ink sm:text-[36px]">
                Simple to start
              </h2>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-[24px] text-sub">
                Create an account and Grace opens with a monthly allowance. Membership is granted by
                the owner when you need more.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[14px] border border-hairline bg-surface p-5">
                  <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">Free</p>
                  <p className="mt-2 font-display text-[34px] leading-none text-ink">₹0</p>
                  <p className="mt-2 text-[13.5px] leading-[21px] text-sub">
                    The full chat, at every effort level, with a monthly credit allowance.
                  </p>
                  <Link
                    href={startHref}
                    className="mt-5 block rounded-[4px] border border-[#E3DED8] py-2 text-center text-[13.5px] text-[#1D1D1B] transition-colors hover:bg-surface-raised"
                  >
                    {signedIn ? "Open Grace" : "Create an account"}
                  </Link>
                </div>

                <div className="rounded-[14px] border border-[#252523] bg-[#252523] p-5 text-[#FCFAF8]">
                  <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#FCFAF8]/60">
                    Apex
                  </p>
                  <p className="mt-2 font-display text-[34px] leading-none">By invitation</p>
                  <p className="mt-2 text-[13.5px] leading-[21px] text-[#FCFAF8]/70">
                    Unlimited work, Grace Code and projects. The owner grants it from the console in
                    one click.
                  </p>
                  <a
                    href="mailto:ritam73592@gmail.com?subject=Grace%20Apex%20access"
                    className="mt-5 block rounded-[4px] bg-[#FCFAF8] py-2 text-center text-[13.5px] font-medium text-[#252523] transition-opacity hover:opacity-90"
                  >
                    Request access
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-hairline">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="grid size-5 place-items-center rounded-[6px] bg-[#252523] text-[#FCFAF8]">
                <GraceMark className="h-3 w-3" />
              </span>
              <span>
                © {brandName}. Built by Ritam Das.
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10.5px] tracking-[0.02em] text-sub">
              <span>{footerNote}</span>
              <Link href="/welcome?mode=signin" className="hover:text-ink">
                Log in
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <p className="font-display text-[15px] tracking-[0.04em] text-muted">{n}</p>
      <p className="mt-1.5 text-[15px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[13.5px] leading-[21px] text-sub">{body}</p>
    </div>
  );
}
