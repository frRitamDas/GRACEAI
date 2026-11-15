import Link from "next/link";
import { connection } from "next/server";

import { GraceMark } from "@/components/grace/logo";

/** 404 with the app's own voice: say what happened, offer the door. */
export default async function NotFound() {
  // The root metadata is deployment-branded. A true 404 must opt into runtime
  // rendering too, otherwise Next tries to prerender it with runtime metadata.
  await connection();
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-6 text-center text-ink">
      <span className="grid size-12 place-items-center rounded-full border border-hairline bg-control">
        <GraceMark className="h-6 w-6 text-ink" />
      </span>
      <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
        That page is not here
      </h1>
      <p className="mt-2 max-w-[26rem] text-[14px] leading-[22px] text-sub">
        The link may be old, or the page may have moved. Your chats are still where you left them.
      </p>
      <Link
        href="/"
        className="press mt-5 flex h-10 items-center rounded-full bg-ink px-5 text-[13.5px] font-semibold text-bg"
      >
        Back to Grace
      </Link>
    </main>
  );
}
