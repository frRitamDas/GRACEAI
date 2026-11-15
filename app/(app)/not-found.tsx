import Link from "next/link";

/** A wrong URL inside the app still gets the shell and a way back. */
export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[15px] font-semibold text-ink">That page does not exist.</p>
      <p className="max-w-[36ch] text-[13px] leading-5 text-sub">
        The link may be old, or the thing it pointed at was deleted.
      </p>
      <Link
        href="/"
        className="press mt-1 h-9 rounded-full bg-ink px-4 text-[12.5px] font-semibold leading-9 text-black"
      >
        Back to chat
      </Link>
    </div>
  );
}
