import Link from "next/link";
import { ArrowUpRight, CalendarDays, Code2, Lightbulb, PencilLine, Search, Workflow } from "lucide-react";

import { GraceMark } from "@/components/grace/logo";
import { HeroComposer } from "@/components/marketing/hero-composer";

/**
 * Public Grace home. The reference's centred composition, roomy spacing, and
 * quick-start rail are kept, but the surface uses Grace's black design system
 * rather than Arena's branding or light palette.
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
    title: "Understand an idea",
    body: "Make a difficult concept feel simple",
    prompt: "Explain why seasons change using one simple analogy.",
    icon: <Lightbulb size={17} strokeWidth={1.7} />,
  },
  {
    title: "Write something",
    body: "Find the words, then make them sharper",
    prompt: "Draft a friendly thank-you note to a teammate who helped me this week.",
    icon: <PencilLine size={17} strokeWidth={1.7} />,
  },
  {
    title: "Think it through",
    body: "Compare the options and choose a direction",
    prompt: "Help me compare two options with a clear pros-and-cons framework.",
    icon: <Workflow size={17} strokeWidth={1.7} />,
  },
  {
    title: "Build a small tool",
    body: "A script, a page, or a practical fix",
    prompt: "Sketch a small to-do list app with three useful core features.",
    icon: <Code2 size={17} strokeWidth={1.7} />,
  },
  {
    title: "Make sense of notes",
    body: "Pull the useful thread out of something long",
    prompt: "Show me a practical way to summarise a long article.",
    icon: <Search size={17} strokeWidth={1.7} />,
  },
  {
    title: "Plan the week",
    body: "Turn a messy list into a clear next step",
    prompt: "Help me plan a balanced week with work, exercise, and downtime.",
    icon: <CalendarDays size={17} strokeWidth={1.7} />,
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
  const accountHref = signedIn ? "/" : `/welcome?mode=${signupEnabled ? "signup" : "signin"}`;
  const accountLabel = signedIn ? "Open Grace" : signupEnabled ? "Create account" : "Sign in";
  const accountMode = signupEnabled ? "signup" : "signin";

  return (
    <div className="min-h-[100dvh] w-full bg-bg text-ink">
      <div className="flex min-h-[100dvh] flex-col">
        <header className="sticky top-0 z-30 border-b border-hairline/80 bg-bg/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 sm:h-16 sm:px-6">
            <Link href="/welcome" className="flex items-center gap-2.5 rounded-full py-1" aria-label={`${brandName} home`}>
              <span className="grid size-9 place-items-center rounded-full border border-hairline bg-control text-ink">
                <GraceMark className="h-[19px] w-[19px]" />
              </span>
              <span className="text-[14px] font-semibold uppercase leading-none tracking-[0.055em] text-ink sm:text-[15px]">
                {brandName}
              </span>
            </Link>

            <nav className="ml-4 hidden items-center gap-1 sm:flex" aria-label="Sections">
              <a
                href="#how"
                className="rounded-full px-3 py-2 text-[13px] text-sub transition-colors hover:bg-control hover:text-ink"
              >
                How it works
              </a>
              <a
                href="#plans"
                className="rounded-full px-3 py-2 text-[13px] text-sub transition-colors hover:bg-control hover:text-ink"
              >
                Plans
              </a>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {!signedIn && (
                <Link
                  href="/welcome?mode=signin"
                  className="hidden rounded-full px-3 py-2 text-[13px] text-sub transition-colors hover:bg-control hover:text-ink sm:block"
                >
                  Sign in
                </Link>
              )}
              <Link
                href={accountHref}
                className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-bg transition-opacity hover:opacity-85"
              >
                {accountLabel}
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {announcement && (
            <div className="border-t border-hairline bg-accent-soft/70">
              <div className="mx-auto flex w-full max-w-[1120px] items-center justify-center gap-2 px-4 py-2 text-center text-[12.5px] leading-5 text-ink sm:text-[13px]">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span className="min-w-0">{announcement.text}</span>
                {announcement.href && (
                  <a
                    href={announcement.href}
                    className="shrink-0 font-semibold text-accent-text underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                  >
                    More
                  </a>
                )}
              </div>
            </div>
          )}
        </header>

        <main className="flex flex-1 flex-col">
          <section className="mx-auto w-full max-w-[800px] px-4 pb-7 pt-12 sm:px-6 sm:pt-[76px]" aria-labelledby="welcome-title">
            <div className="animate-fade-up flex flex-col items-center">
              <span className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-hairline bg-control px-3.5 py-2 text-center text-[12px] leading-4 text-sub sm:text-[12.5px]">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span className="truncate">{tagline}</span>
              </span>

              <h1
                id="welcome-title"
                className="max-w-[19ch] text-center text-[40px] font-medium leading-[1.08] tracking-[-0.045em] text-ink sm:text-[56px] sm:leading-[1.04]"
              >
                Where should we <span className="text-sub">start?</span>
              </h1>
              <p className="mt-4 max-w-[48ch] text-center text-[14px] leading-[22px] text-sub sm:mt-5 sm:text-[15px] sm:leading-6">
                Bring a question, a rough draft, or a problem you have not quite untangled yet.
              </p>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[800px] px-4 pb-5 sm:px-6" aria-label="Start a chat">
            <div className="animate-fade-up" style={{ animationDelay: "70ms" }}>
              <HeroComposer chatEnabled={chatEnabled} signedIn={signedIn} signupEnabled={signupEnabled} />
            </div>
          </section>

          <section className="mx-auto w-full max-w-[800px] px-4 pb-14 sm:px-6" aria-label="Things to try">
            <div
              className="animate-fade-up no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0"
              style={{ animationDelay: "130ms" }}
            >
              {STARTERS.map((starter) => {
                const prompt = encodeURIComponent(starter.prompt);
                const href = signedIn
                  ? `/?prompt=${prompt}`
                  : `/welcome?mode=${accountMode}&prompt=${prompt}`;

                return (
                  <Link
                    key={starter.title}
                    href={href}
                    className="press group flex min-w-[238px] shrink-0 items-center gap-3 rounded-[16px] border border-hairline bg-control p-3 text-left transition-colors hover:border-hairline-strong hover:bg-surface sm:min-w-0 sm:shrink sm:p-3.5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[11px] border border-hairline bg-bg text-sub transition-colors group-hover:text-ink">
                      {starter.icon}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[12.5px] font-medium leading-[18px] text-ink">{starter.title}</span>
                      <span className="truncate text-[11px] leading-[16px] text-muted">{starter.body}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[11px] leading-4 text-muted">
              {signedIn ? "Pick a starting point or write your own." : "Your question stays with you when you sign in."}
            </p>
          </section>

          <section id="how" className="scroll-mt-16 border-t border-hairline bg-[#070708]">
            <div className="mx-auto w-full max-w-[800px] px-4 py-12 sm:px-6 sm:py-16">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-text">A simpler way to work</p>
              <h2 className="mt-3 max-w-[20ch] text-[29px] font-medium leading-[1.15] tracking-[-0.035em] text-ink sm:text-[36px]">
                One place to think things through.
              </h2>
              <p className="mt-3 max-w-[54ch] text-[14px] leading-[23px] text-sub sm:text-[15px] sm:leading-6">
                Start with what is on your mind. Grace keeps the experience focused, gives you room to choose how much depth you need, and keeps your work close at hand.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Step
                  n="01"
                  title="Say what you need"
                  body="Ask, paste, or bring a file into the conversation. Start wherever the work is."
                />
                <Step
                  n="02"
                  title="Choose the depth"
                  body="Move from a quick response to careful, step-by-step thinking when it matters."
                />
                <Step
                  n="03"
                  title="Keep your place"
                  body="Conversations, notes, and projects stay together, ready when you return."
                />
              </div>
            </div>
          </section>

          <section id="plans" className="scroll-mt-16 border-t border-hairline">
            <div className="mx-auto w-full max-w-[800px] px-4 py-12 sm:px-6 sm:py-16">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-text">Access</p>
              <h2 className="mt-3 text-[29px] font-medium leading-[1.15] tracking-[-0.035em] text-ink sm:text-[36px]">
                A simple place to begin.
              </h2>
              <p className="mt-3 max-w-[54ch] text-[14px] leading-[23px] text-sub sm:text-[15px] sm:leading-6">
                Begin with a monthly allowance. The owner can grant expanded membership when your work calls for more.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-hairline bg-control p-5 sm:p-6">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Free</p>
                  <p className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.04em] text-ink">₹0</p>
                  <p className="mt-3 text-[13px] leading-[21px] text-sub">
                    The full chat with a monthly allowance for everyday work.
                  </p>
                  <Link
                    href={accountHref}
                    className="press mt-5 inline-flex h-10 w-full items-center justify-center rounded-full border border-hairline-strong text-[13px] font-medium text-ink transition-colors hover:bg-surface"
                  >
                    {accountLabel}
                  </Link>
                </div>

                <div className="rounded-[20px] border border-hairline bg-surface p-5 sm:p-6">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-accent-text">Apex</p>
                  <p className="mt-3 text-[29px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[32px]">
                    By invitation
                  </p>
                  <p className="mt-3 text-[13px] leading-[21px] text-sub">
                    More room for sustained work, Grace Code, and projects. Membership is managed privately by the owner.
                  </p>
                  <Link
                    href={accountHref}
                    className="press mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] font-semibold text-bg transition-opacity hover:opacity-85"
                  >
                    {signedIn ? "Open Grace" : "Sign in"}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-hairline">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="grid size-6 place-items-center rounded-full border border-hairline bg-control text-ink">
                <GraceMark className="h-3.5 w-3.5" />
              </span>
              <span>© {brandName}. Built by Ritam Das.</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-sub">
              <span>{footerNote}</span>
              <Link href="/welcome?mode=signin" className="hover:text-ink">
                Sign in
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
    <div className="rounded-[16px] border border-hairline bg-control/60 p-4">
      <p className="text-[11px] font-semibold tabular-nums tracking-[0.12em] text-muted">{n}</p>
      <p className="mt-2 text-[14px] font-medium text-ink">{title}</p>
      <p className="mt-1.5 text-[12.5px] leading-[20px] text-sub">{body}</p>
    </div>
  );
}
