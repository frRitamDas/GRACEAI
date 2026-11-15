import { AuthPanel } from "@/components/marketing/auth-panel";
import { GraceMark } from "@/components/grace/logo";
import { EFFORT_LEVELS, MODELS, PROVIDERS, type ProviderId } from "@/lib/ai/catalog";

/**
 * Welcome page. Same design language as the app: pure black, one accent,
 * rounded everything, short sentences. It shows the real catalog so the
 * promise on the page matches what the product does.
 */
export function Landing({ providers }: { providers: { label: string; configured: boolean }[] }) {
  const byProvider = (["openrouter", "groq", "google"] as ProviderId[]).map((id) => ({
    id,
    label: PROVIDERS[id].label,
    models: MODELS.filter((m) => m.provider === id).slice(0, 3),
    count: MODELS.filter((m) => m.provider === id).length,
    configured: providers.find((p) => p.label === PROVIDERS[id].label)?.configured ?? false,
  }));

  return (
    <div className="canvas-wash mx-auto flex min-h-[100dvh] w-full flex-col pb-16">
      <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[8px] border border-white/[0.08] bg-white/[0.04]">
            <GraceMark className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">Grace</span>
        </div>
        <a
          href="#start"
          className="press flex h-8 items-center rounded-[7px] bg-ink px-3 text-[12.5px] font-semibold text-black"
        >
          Start
        </a>
      </header>

      <div className="mx-auto w-full max-w-[1040px]">
      <main className="grid flex-1 items-start gap-10 px-4 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:pt-14">
        <div>
          <h1 className="animate-fade-up max-w-[15ch] text-[34px] font-semibold leading-[38px] tracking-[-0.035em] text-ink sm:text-[52px] sm:leading-[54px]">
            Ask Grace. Keep it clear.
          </h1>
          <p className="mt-4 max-w-[44ch] text-[14.5px] leading-[23px] text-sub">
            A quiet AI workspace with frontier models behind one input. Choose how hard Grace
            should think, from instant answers to deep work, and see exactly what each answer
            costs.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <Point title="Effort you set" body="Instant, Quick, Balanced, Deep, Ultra. One slider, no guesswork." />
            <Point title="Models you choose" body="Claude, GPT, Gemini, Kimi, Llama and more, overridable per chat." />
            <Point title="Credits you see" body="Every answer shows its cost and what is left this month." />
          </div>

          <section className="mt-8" aria-labelledby="providers-heading">
            <h2 id="providers-heading" className="text-[13px] font-semibold tracking-[0.01em] text-muted">
              {byProvider.some((p) => p.configured) ? "Provider access" : "Providers, once keys are added"}
            </h2>
            {!byProvider.some((p) => p.configured) && (
              <p className="mt-2 text-[13px] leading-5 text-sub">
                No provider key is set yet. Grace works once an OpenRouter, Groq or Google AI
                Studio key is added.
              </p>
            )}
            <ul className="mt-2.5 grid gap-2 sm:grid-cols-3">
              {byProvider.map((provider) => (
                <li key={provider.id} className="rounded-[12px] border border-hairline bg-surface p-3">
                  <p className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-ink">
                    {provider.label}
                    <span
                      className={`h-2 w-2 rounded-full ${provider.configured ? "bg-accent" : "bg-hairline-strong"}`}
                      aria-label={provider.configured ? "Connected" : "Key needed"}
                    />
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted">
                    {provider.count} {provider.count === 1 ? "model" : "models"}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {provider.models.map((model) => (
                      <li key={model.id} className="truncate text-[11.5px] text-sub">
                        {model.name}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="effort-heading">
            <h2 id="effort-heading" className="text-[13px] font-semibold tracking-[0.01em] text-muted">
              Effort levels
            </h2>
            <ol className="mt-3 flex flex-wrap gap-2">
              {EFFORT_LEVELS.map((level) => {
                const [first, ...rest] = level.name.split(" ");
                return (
                  <li
                    key={level.id}
                    className="rounded-full border border-hairline bg-surface px-3.5 py-2 text-[15px] font-bold"
                  >
                    <span className="text-accent">{first}</span>{" "}
                    <span className="text-ink">{rest.join(" ")}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div id="start" className="lg:sticky lg:top-8">
          <AuthPanel />
          <p className="mt-3 text-center text-[11px] leading-4 text-muted">
            Grace can make mistakes. Check anything important.
          </p>
        </div>
      </main>
      </div>
    </div>
  );
}

/** One promise, stated plainly: a small heading and the sentence that backs it. */
function Point({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[12px] border border-hairline bg-surface p-3">
      <p className="text-[12.5px] font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[11.5px] leading-[17px] text-muted">{body}</p>
    </div>
  );
}
