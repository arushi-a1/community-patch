/**
 * Original PATCH hero illustration: a small neighborhood of people connected by
 * "patch" stitches, passing everyday things to each other (adapter, umbrella,
 * helping hand). Warm palette, decorative (aria-hidden). Subtle float/draw
 * motion is applied via CSS and disabled under prefers-reduced-motion.
 */
export function CommunityScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      className={className}
      role="img"
      aria-label="Illustration of neighbors sharing things and helping each other"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EAF4EC" />
          <stop offset="1" stopColor="#FBF6EC" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F2C84B" />
          <stop offset="1" stopColor="#F2C84B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* backdrop */}
      <rect x="0" y="0" width="480" height="360" rx="24" fill="url(#sky)" />
      <circle cx="384" cy="86" r="70" fill="url(#sun)" opacity="0.7" />

      {/* rolling ground */}
      <path d="M0 268 Q120 236 240 262 T480 254 V360 H0 Z" fill="#E7F0DE" />
      <path d="M0 292 Q140 266 280 292 T480 286 V360 H0 Z" fill="#DCE9CF" />

      {/* little houses */}
      <g>
        <rect x="46" y="196" width="66" height="60" rx="6" fill="#FFFFFF" stroke="#E7E3DA" />
        <path d="M40 198 L79 166 L118 198 Z" fill="#E4694E" />
        <rect x="66" y="222" width="18" height="34" rx="3" fill="#D9E8CC" />
        <rect x="360" y="188" width="74" height="68" rx="6" fill="#FFFFFF" stroke="#E7E3DA" />
        <path d="M353 190 L397 156 L441 190 Z" fill="#3E72A8" />
        <rect x="372" y="204" width="20" height="20" rx="3" fill="#FBEFD6" />
        <rect x="402" y="204" width="20" height="20" rx="3" fill="#FBEFD6" />
      </g>

      {/* connecting "patch" stitches between neighbors */}
      <g stroke="#1E7A4D" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 9" opacity="0.65" className="patch-stitch">
        <path d="M150 196 C 196 150, 268 150, 312 190" fill="none" />
        <path d="M196 236 C 236 272, 292 272, 330 238" fill="none" />
      </g>

      {/* person A — offering an adapter */}
      <g>
        <circle cx="168" cy="196" r="20" fill="#27B06A" />
        <circle cx="168" cy="178" r="12" fill="#F6D9B8" />
        <rect x="150" y="190" width="36" height="30" rx="12" fill="#1E7A4D" />
        {/* adapter in hand */}
        <rect x="186" y="196" width="16" height="10" rx="2" fill="#2E2A26" />
        <rect x="200" y="199" width="8" height="4" rx="1" fill="#8FBF3F" />
      </g>

      {/* person B — reaching out */}
      <g>
        <circle cx="312" cy="196" r="20" fill="#D9893B" />
        <circle cx="312" cy="178" r="12" fill="#EFC49C" />
        <rect x="294" y="190" width="36" height="30" rx="12" fill="#B9712C" />
        <path d="M294 200 q-16 4 -22 -4" stroke="#EFC49C" strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>

      {/* person C — with umbrella, lower center */}
      <g>
        <circle cx="240" cy="246" r="18" fill="#3E72A8" />
        <circle cx="240" cy="230" r="11" fill="#F6D9B8" />
        <rect x="224" y="241" width="32" height="26" rx="11" fill="#2F5887" />
        <path d="M222 220 a18 10 0 0 1 36 0 Z" fill="#E4694E" />
        <line x1="240" y1="220" x2="240" y2="236" stroke="#8A5A33" strokeWidth="2.2" />
      </g>

      {/* floating hearts / sparks */}
      <g className="patch-float" fill="#27B06A">
        <path d="M240 150 c2-4 10-4 10 2 c0 5-10 10-10 10 c0 0-10-5-10-10 c0-6 8-6 10-2 Z" opacity="0.8" />
      </g>
      <g className="patch-float-slow" fill="#F2C84B">
        <circle cx="120" cy="150" r="4" />
        <circle cx="360" cy="138" r="5" />
      </g>
    </svg>
  );
}
