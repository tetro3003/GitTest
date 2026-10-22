import type { ChainFamily } from "@/lib/beta/types";

/** Small source marks for connection tiles. */
export function FigmaMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 57" className={className} aria-hidden>
      <path fill="#1abcfe" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
      <path fill="#0acf83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
      <path fill="#ff7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
      <path fill="#f24e1e" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
      <path fill="#a259ff" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
    </svg>
  );
}

export function ChainMark({ family, className = "size-5" }: { family: ChainFamily; className?: string }) {
  if (family === "evm")
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#8a92ff" d="M12 2 5 12.2 12 16l7-3.8z" />
        <path fill="#5b6cff" d="M12 17.4 5 13.6 12 22l7-8.4z" />
      </svg>
    );
  if (family === "solana")
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <defs>
          <linearGradient id="sol" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#9945ff" />
            <stop offset="1" stopColor="#14f195" />
          </linearGradient>
        </defs>
        <path fill="url(#sol)" d="M6 6h14l-2 2.6H4zm-2 4.7h14l2 2.6H6zm2 4.7h14l-2 2.6H4z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#ff2d3c" d="M3 4l15.5 3.2L21 10 11 21zm2.6 1.5 5.3 12.8 1.1-8.6zm7.6 4.6-1.1 8.2 7.1-8zm.5-1.2 5.6.6-2.3-1.8zm-6.5-3.2 6 5.6.4-2.8z" />
    </svg>
  );
}

const MARKS: Record<string, { bg: string; fg: string; text: string }> = {
  gmail: { bg: "linear-gradient(135deg,#ea4335,#fbbc04 55%,#34a853)", fg: "#fff", text: "M" },
  wise: { bg: "#9fe870", fg: "#163300", text: "W" },
  bank: { bg: "linear-gradient(135deg,#00a3e0,#0057a8)", fg: "#fff", text: "TBC" },
  tbc: { bg: "linear-gradient(135deg,#00a3e0,#0057a8)", fg: "#fff", text: "TBC" },
  bog: { bg: "linear-gradient(135deg,#ff7a00,#f04e23)", fg: "#fff", text: "BOG" },
  canva: { bg: "linear-gradient(135deg,#00c4cc,#7d2ae8)", fg: "#fff", text: "C" },
  webflow: { bg: "#146ef5", fg: "#fff", text: "W" },
  miro: { bg: "#ffd02f", fg: "#050038", text: "M" },
  dribbble: { bg: "#ea4c89", fg: "#fff", text: "D" },
};

/** Simple coloured monogram for a source (not the company's logo). */
export function SourceMark({ provider, className = "size-12" }: { provider: keyof typeof MARKS | string; className?: string }) {
  const m = MARKS[provider];
  if (!m) return null;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl font-display font-extrabold shadow-sm ring-1 ring-black/5 ${m.text.length > 1 ? "text-[11px]" : "text-lg"} ${className}`} style={{ background: m.bg, color: m.fg }} aria-hidden>
      {m.text}
    </span>
  );
}
