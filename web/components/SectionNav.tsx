"use client";

const SECTIONS = [
  ["Vault", "vault-title"],
  ["Guardian", "guardian-title"],
  ["Rules", "rules-title"],
  ["Controls", "controls-title"],
] as const;

/** Phones only: the floating pill (DESIGN.md, Navigation) that jumps between the dashboard's sections. */
export function SectionNav() {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-4 z-10 mx-auto flex w-max max-w-[calc(100%-2rem)] items-center rounded-full border border-hairline bg-surface-glass px-4 backdrop-blur-md md:hidden"
    >
      {SECTIONS.map(([label, id], i) => (
        <a
          key={id}
          href={`#${id}`}
          className={`flex min-h-11 items-center px-2 font-mono text-sm uppercase text-ink-default transition-colors duration-300 ease-reactive hover:text-white ${
            i > 0 ? "border-l border-hairline" : ""
          }`}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
