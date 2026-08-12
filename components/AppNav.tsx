"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Slim top bar for switching between the platform's surfaces.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/adaptive", label: "Adaptive Tutor" },
  { href: "/course/new", label: "New course" },
  { href: "/chat", label: "Quick chat" },
  { href: "/profile", label: "Profile" },
];

export default function AppNav() {
  const path = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setEmail(d.user?.email ?? null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [path]);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setEmail(null);
    router.push("/login");
  }

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
      <div className="nav-auth">
        {loaded && (email ? (
          <>
            <span className="nav-email" title={email}>{email}</span>
            <button className="nav-link nav-btn" onClick={logout}>Log out</button>
          </>
        ) : (
          <Link href="/login" className={`nav-link ${isActive("/login") ? "active" : ""}`}>Log in</Link>
        ))}
      </div>
    </nav>
  );
}
