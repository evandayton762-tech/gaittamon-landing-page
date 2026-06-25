"use client"

import Image from "next/image"

// Fixed top navigation bar — always on top, never scrolls away.
export function TopNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-3 sm:px-10">
      {/* Logo */}
      <a href="/" aria-label="Gaittamon home">
        <Image
          src="/gaittamon-logo.png"
          alt="Gaittamon"
          width={160}
          height={72}
          priority
          className="h-16 w-auto object-contain drop-shadow-[0_0_18px_rgba(255,180,0,0.75)] sm:h-20"
        />
      </a>

      {/* Desktop nav */}
      <nav
        aria-label="Main navigation"
        className="hidden items-center sm:flex"
      >
        {/* Links separated by cyan dividers */}
        {[
          { label: "How to Play", href: "#how-to-play" },
          { label: "Cards",       href: "#cards" },
          { label: "Lore",        href: "#lore" },
        ].map((link, i) => (
          <span key={link.href} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="mx-5 h-4 w-px bg-cyan-glow/40"
              />
            )}
            <a
              href={link.href}
              className="font-mono text-xs uppercase tracking-[0.22em] text-foreground/60 transition-colors hover:text-cyan-glow"
            >
              {link.label}
            </a>
          </span>
        ))}

        {/* Cyan divider before Discord */}
        <span aria-hidden="true" className="mx-5 h-4 w-px bg-cyan-glow/40" />

        {/* Discord */}
        <a
          href="https://discord.gg/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.22em] text-foreground/60 transition-colors hover:text-[#5865F2]"
          aria-label="Join our Discord"
        >
          <svg
            aria-hidden="true"
            width="15"
            height="11"
            viewBox="0 0 24 18"
            fill="currentColor"
          >
            <path d="M20.317 1.492A19.82 19.82 0 0 0 15.582.06a.074.074 0 0 0-.079.037c-.34.603-.719 1.388-.984 2.007a18.273 18.273 0 0 0-5.032 0 12.645 12.645 0 0 0-.998-2.007.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 1.492a.07.07 0 0 0-.032.027C.533 6.093-.32 10.555.099 14.962a.083.083 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.027c.462-.63.874-1.295 1.226-1.993a.076.076 0 0 0-.041-.106 13.105 13.105 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.443a.061.061 0 0 0-.031-.03zM8.02 12.278c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Discord
        </a>

        {/* Play CTA — bigger, gold-accented */}
        <a
          href="#play"
          className="ml-8 rounded-full border-2 border-[#ffd700]/80 bg-[#ffd700]/10 px-7 py-2.5 font-mono text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd700] shadow-[0_0_22px_rgba(255,215,0,0.4)] transition-all hover:bg-[#ffd700]/20 hover:shadow-[0_0_32px_rgba(255,215,0,0.6)]"
        >
          Play
        </a>
      </nav>

      {/* Mobile: just the Play button */}
      <a
        href="#play"
        className="flex sm:hidden rounded-full border-2 border-[#ffd700]/80 bg-[#ffd700]/10 px-5 py-2 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[#ffd700] shadow-[0_0_22px_rgba(255,215,0,0.4)]"
      >
        Play
      </a>
    </header>
  )
}
