"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Slim top bar for switching between the platform's surfaces.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/course/new", label: "New course" },
  { href: "/chat", label: "Quick chat" },
  { href: "/profile", label: "Profile" },
];

export default function AppNav() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        EduVerse
      </Link>
      <div className="nav-links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link ${isActive(l.href) ? "active" : ""}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
