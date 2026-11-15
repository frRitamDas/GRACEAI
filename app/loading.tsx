/**
 * Route-level loading screen.
 *
 * Server pages read the session, so a navigation can take a beat. This is the
 * shell's own silhouette — sidebar, header, composer — so the first paint lands
 * where the content will, and nothing shifts when it arrives.
 */
export default function Loading() {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg">
      <div className="hidden w-[264px] shrink-0 flex-col gap-2 border-r border-hairline p-3 md:flex">
        <div className="flex items-center gap-2 pb-2">
          <span className="skeleton h-9 w-9 rounded-[10px]" />
          <span className="skeleton h-2.5 w-14 rounded-full" />
        </div>
        <span className="skeleton h-9 w-full rounded-[9px]" />
        <span className="skeleton h-9 w-full rounded-[9px]" />
        <div className="mt-4 space-y-1.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="skeleton block h-9 w-full rounded-[9px] opacity-70" />
          ))}
        </div>
        <div className="mt-auto space-y-1.5">
          <span className="skeleton h-9 w-full rounded-[9px]" />
          <span className="skeleton h-10 w-full rounded-[9px]" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 px-4">
          <span className="skeleton h-10 w-10 rounded-full" />
          <span className="skeleton h-6 w-20 rounded-full" />
          <span className="skeleton ml-auto h-10 w-10 rounded-full" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="skeleton h-7 w-[280px] max-w-[70%] rounded-full" />
        </div>
        <div className="mx-auto w-full max-w-[760px] px-4 pb-4">
          <span className="skeleton block h-[68px] w-full rounded-[24px]" />
          <span className="skeleton mx-auto mt-3 block h-3 w-40 rounded-full opacity-60" />
        </div>
      </div>
    </div>
  );
}
