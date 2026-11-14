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
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[960px] flex-col px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-control text-[#C9C9CC]">
            <GraceMark className="h-6 w-6" />
          </span>
          <span className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">Grace 3</span>
        </div>
        <a
          href="#start"
          className="h-11 rounded-full border border-hairline bg-control px-4 text-[15px] font-semibold leading-[44px] text-ink transition-colors duration-150 hover:border-[#3A3A3F] hover:text-ink"
        >
          Start
        </a>
      </header>

      <main className="grid flex-1 items-start gap-10 pt-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:pt-12">
        <div>
          <h1 className="animate-fade-up max-w-[16ch] font-display text-[40px] font-semibold leading-[44px] tracking-[-0.032em] text-ink sm:text-[56px] sm:leading-[60px]">
            Ask Grace. Keep it clear.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-[27px] text-sub">
            A quiet AI workspace with frontier models behind one input. Choose how hard Grace
            should think, from instant answers to deep work, and see exactly what each answer
            costs.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Point title="Effort you set" body="Instant, Quick, Balanced, Deep, Ultra. One slider, no guesswork." />
            <Point title="Models you choose" body="Claude, GPT, Gemini, Kimi, Llama and more, overridable per chat." />
            <Point title="Credits you see" body="Every answer shows its cost and what is left this month." />
          </div>

          <section className="mt-10" aria-labelledby="providers-heading">
            <h2 id="providers-heading" className="text-[13px] font-semibold tracking-[0.01em] text-muted">
              {byProvider.some((p) => p.configured) ? "Provider access" : "Providers, once keys are added"}
            </h2>
            {!byProvider.some((p) => p.configured) && (
              <p className="mt-2 text-[13px] leading-5 text-sub">
                No provider key is set yet. Grace works once an OpenRouter, Groq or Google AI
                Studio key is added.
              </p>
            )}
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {byProvider.map((provider) => (
                <li key={provider.id} className="rounded-[20px] border border-hairline bg-surface p-4">
                  <p className="flex items-center justify-between gap-2 text-[16px] font-bold text-ink">
                    {provider.label}
                    <span
                      className={`h-2 w-2 rounded-full ${provider.configured ? "bg-accent" : "bg-[#3A3A3F]"}`}
                      aria-label={provider.configured ? "Connected" : "Key needed"}
                    />
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-sub">
                    {provider.count} frontier {provider.count === 1 ? "model" : "models"}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {provider.models.map((model) => (
                      <li key={model.id} className="truncate text-[13px] text-muted">
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
          <p className="mt-4 text-center text-[13px] leading-5 text-muted">
            Grace can make mistakes. Check anything important.
          </p>
        </div>
      </main>
    </div>
  );
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[20px] border border-hairline bg-surface p-4">
      <p className="text-[16px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-[14px] leading-5 text-sub">{body}</p>
    </div>
  );
}
