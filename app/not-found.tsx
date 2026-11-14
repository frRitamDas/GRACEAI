import Link from "next/link";

import { GraceMark } from "@/components/grace/logo";

/** 404 with the app's own voice: say what happened, offer the door. */
export default function NotFound() {
  return (
    <main className="canvas-wash flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-[14px] border border-hairline bg-surface">
        <GraceMark className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        That page is not here
      </h1>
      <p className="mt-2 max-w-[24rem] text-[14px] leading-[22px] text-sub">
        The link may be old, or the page may have moved. Your chats are still where you left them.
      </p>
      <Link
        href="/"
        className="press mt-5 flex h-10 items-center rounded-full bg-ink px-5 text-[13.5px] font-semibold text-black"
      >
        Back to Grace
      </Link>
    </main>
  );
}
