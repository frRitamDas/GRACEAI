import type { SVGProps } from "react";

/**
 * The Grace mark, redrawn from the reference screenshots.
 *
 * Reading the reference at 6x: a wide, shallow light dome with a small rounded
 * knot at the crown arcs over a dark face; two white eyes sit inside the face;
 * two light hands cup the face from below and their inner edges meet in a V of
 * negative space.
 *
 * Built from stacked fills so the rim thickness stays even at every size:
 * dome + knot in the current color, the face punched out in near-black, then
 * eyes and hands.
 */
export function GraceMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className} {...props}>
      {/* dome, with a soft crown knot blended into the top */}
      <path
        d="M32 10.9c2.6 0 4.7 1.8 5.2 4.2C46.2 16.8 51.4 24.2 51.4 33.7c0 9.7-8.7 17.5-19.4 17.5s-19.4-7.8-19.4-17.5c0-9.5 5.2-16.9 14.2-18.6.5-2.4 2.6-4.2 5.2-4.2Z"
        fill="currentColor"
      />

      {/* face: dark oval inside the dome */}
      <ellipse cx="32" cy="35.2" rx="12.1" ry="12.6" fill="#0A0A0B" />

      {/* eyes */}
      <rect x="25.7" y="29.6" width="3.5" height="7.6" rx="1.75" fill="currentColor" />
      <rect x="34.8" y="29.6" width="3.5" height="7.6" rx="1.75" fill="currentColor" />

      {/* hands cupping the face; their inner tips curl in and leave a deep V */}
      <path
        d="M14.6 32.4c-2.6 3.1-3.3 7.3-1.2 11.1 2.2 4.3 7.2 7.5 12.6 9.1 3 .9 6.5-.4 7.6-3.2 1-2.5-.3-5.2-2.8-6.4-3.4-1.6-6.5-4-8.7-7-1.9-2.5-5-3.6-7.5-2.6Z"
        fill="currentColor"
      />
      <path
        d="M49.4 32.4c2.6 3.1 3.3 7.3 1.2 11.1-2.2 4.3-7.2 7.5-12.6 9.1-3 .9-6.5-.4-7.6-3.2-1-2.5.3-5.2 2.8-6.4 3.4-1.6 6.5-4 8.7-7 1.9-2.5 5-3.6 7.5-2.6Z"
        fill="currentColor"
      />
    </svg>
  );
}
