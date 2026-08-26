"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";

interface Standard { code: string; grade: string; domain: string; cluster: string; skill: string }
interface Cluster { cluster: string; standards: Standard[] }
interface Domain { domain: string; clusters: Cluster[] }
interface Data {
  grade: string;
  grades: string[];
  domains: Domain[];
  stats: { total: number; grades: number };
  attribution: string;
}

const label = (g: string) => (g === "K" ? "Kindergarten" : `Grade ${g}`);

export default function CurriculumPage() {
  const [grade, setGrade] = useState("4");
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Standard[] | null>(null);

  const load = useCallback((g: string) => {
    fetch(`/api/standards?grade=${g}`).then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  useEffect(() => { load(grade); }, [grade, load]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/standards?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!data) {
    return <div className="shell"><AppNav /><div className="page"><p className="muted">Loading…</p></div></div>;
  }

  const shown = results ?? null;

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>Curriculum</h1>
          <p>
            {data.stats.total} skills across {data.stats.grades} grades, following the US Common Core sequence.
            Pick any skill to have the tutor teach it.
          </p>
        </header>

        <input
          className="cur-search"
          placeholder="Search skills, e.g. long division, fractions, 4.NBT"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {!shown && (
          <div className="cur-grades">
            {data.grades.map((g) => (
              <button key={g} className={`cur-grade ${g === grade ? "on" : ""}`} onClick={() => setGrade(g)}>
                {g === "K" ? "K" : g}
              </button>
            ))}
          </div>
        )}

        {shown ? (
          <section className="hub-section">
            <h2>{shown.length} match{shown.length === 1 ? "" : "es"}</h2>
            {shown.map((s) => (
              <StandardRow key={s.code} s={s} showGrade />
            ))}
            {shown.length === 0 && <p className="muted">Nothing matched. Try a different word.</p>}
          </section>
        ) : (
          data.domains.map((d) => (
            <section key={d.domain} className="cur-domain">
              <h2>{d.domain}</h2>
              {d.clusters.map((c) => (
                <div key={c.cluster} className="cur-cluster">
                  <div className="cur-cluster-name">{c.cluster}</div>
                  {c.standards.map((s) => (
                    <StandardRow key={s.code} s={s} />
                  ))}
                </div>
              ))}
            </section>
          ))
        )}

        <p className="muted cur-attrib">{data.attribution}</p>
      </div>
    </div>
  );
}

function StandardRow({ s, showGrade }: { s: Standard; showGrade?: boolean }) {
  return (
    <div className="cur-row">
      <span className="cur-code">{s.code}</span>
      <span className="cur-skill">
        {s.skill}
        {showGrade && <span className="cur-grade-tag">{label(s.grade)}</span>}
      </span>
      <Link
        className="ghost-btn sm"
        href={`/onboarding?topic=${encodeURIComponent(s.skill)}&code=${encodeURIComponent(s.code)}&grade=${encodeURIComponent(s.grade)}`}
      >
        Teach me this
      </Link>
    </div>
  );
}
