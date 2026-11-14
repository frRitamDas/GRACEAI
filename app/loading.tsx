import { GraceMark } from "@/components/grace/logo";

/**
 * Route-level loading screen.
 *
 * Server pages here read the session, so the first paint of a navigation can
 * take a beat. A quiet skeleton that matches the app shell is better than a
 * spinner in the middle of nowhere: it does not flash, and the eye already
 * knows where the content will land.
 */
export default function Loading() {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg">
      {/* rail skeleton */}
      <div className="hidden w-[264px] shrink-0 flex-col gap-2 border-r border-hairline bg-panel p-3 lg:flex xl:w-[280px]">
        <div className="flex items-center gap-2 pb-1">
          <span className="grid h-7 w-7 place-items-center rounded-[8px] border border-white/[0.08] bg-white/[0.04]">
            <GraceMark className="h-[17px] w-[17px]" />
          </span>
          <span className="skeleton h-2.5 w-14 rounded-full" />
        </div>
        <span className="skeleton h-8 w-full rounded-[8px]" />
        <span className="skeleton h-7 w-full rounded-[7px]" />
        <div className="mt-3 space-y-2 px-1">
          <span className="skeleton block h-2 w-16 rounded-full opacity-60" />
          {[64, 78, 52, 70, 58].map((width, index) => (
            <span
              key={index}
              className="skeleton block h-2.5 rounded-full"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>

      <div className="canvas-wash flex min-w-0 flex-1 flex-col">
        <div className="flex h-[56px] shrink-0 items-center gap-2 border-b border-hairline px-4">
          <span className="skeleton h-6 w-24 rounded-full" />
          <span className="ml-auto skeleton h-6 w-20 rounded-full" />
        </div>

        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <GraceMark className="h-7 w-7 opacity-80" />
            <p className="text-[13px] text-muted">Opening Grace…</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[760px] px-3 pb-4 sm:px-4">
          <span className="skeleton block h-[104px] w-full rounded-[22px]" />
        </div>
      </div>
    </div>
  );
}
