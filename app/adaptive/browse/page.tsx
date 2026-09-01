"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNav from "@/components/AppNav";

interface Std { code: string; grade: string; domain: string; cluster: string; skill: string; subSkills: string[] }
interface Cluster { cluster: string; standards: Std[] }
interface Domain { domain: string; clusters: Cluster[] }
interface Data {
  grade: string;
  fromProfile: boolean;
  profileLevel?: string;
  domains: Domain[];
  expanded: number;
  totalStandards: number;
  complete: boolean;
}

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const label = (g: string) => (g === "K" ? "Kindergarten" : `Grade ${g}`);

export default function BrowseSkillsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [openStd, setOpenStd] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const router = useRouter();

  // Learning a whole topic skips the diagnostic: the curriculum already says
  // what the skills are and what order they go in, so there is nothing to find.
  async function learnTopic(domain: string) {
    if (!grade) return;
    setStarting(domain);
    try {
      const res = await fetch("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, domain }),
      });
      const d = await res.json();
      if (d?.path?.id) router.push(`/adaptive/path/${d.path.id}`);
      else setStarting(null);
    } catch {
      setStarting(null);
    }
  }

  const load = useCallback((g?: string) => {
    const q = g ? `?grade=${encodeURIComponent(g)}` : "";
    fetch(`/api/skills${q}`).then((r) => r.json()).then((d: Data) => {
      setData(d);
      setGrade(d.grade);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // First visit to a grade generates its skills; afterwards it is instant and
  // always identical.
  async function build() {
    if (!grade) return;
    setBuilding(true);
    try {
      await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade }),
      });
      load(grade);
    } finally {
      setBuilding(false);
    }
  }

  if (!data) {
    return <div className="shell"><AppNav /><div className="page"><p className="muted">Loading…</p></div></div>;
  }

  const skillCount = data.domains.reduce(
    (n, d) => n + d.clusters.reduce((m, c) => m + c.standards.reduce((k, s) => k + s.subSkills.length, 0), 0),
    0
  );

  return (
    <div className="shell">
      <AppNav />
      <div className="page">
        <header className="page-head">
          <h1>What to learn</h1>
          <p>
            {data.fromProfile && data.profileLevel
              ? `Skills for ${label(data.grade)}, taken from the profile. Pick anything to start.`
              : `Skills for ${label(data.grade)}. Pick anything to start.`}
          </p>
        </header>

        <div className="cur-grades">
          {GRADES.map((g) => (
            <button key={g} className={`cur-grade ${g === grade ? "on" : ""}`} onClick={() => load(g)}>
              {g}
            </button>
          ))}
        </div>

        {!data.complete ? (
          <div className="sk-build">
            <div>
              <b>{label(data.grade)} skills are not built yet</b>
              <span className="muted">
                {data.expanded} of {data.totalStandards} topics expanded. Building takes about a minute, once. After
                that the list never changes.
              </span>
            </div>
            <button className="send big" onClick={build} disabled={building}>
              {building ? "Building…" : "Build the skill list ▸"}
            </button>
          </div>
        ) : (
          <p className="muted sk-count">{skillCount} skills across {data.totalStandards} topics.</p>
        )}

        {data.domains.map((d) => (
          <section key={d.domain} className="cur-domain">
            <div className="dom-head">
              <h2>{d.domain}</h2>
              <button
                className="send"
                onClick={() => learnTopic(d.domain)}
                disabled={starting === d.domain}
                title="Work through this whole topic in order, no diagnostic"
              >
                {starting === d.domain ? "Starting…" : "Learn this topic ▸"}
              </button>
            </div>
            {d.clusters.map((c) => (
              <div key={c.cluster} className="cur-cluster">
                <div className="cur-cluster-name">{c.cluster}</div>
                {c.standards.map((s) => {
                  const open = openStd === s.code;
                  return (
                    <div key={s.code}>
                      <div className="cur-row">
                        <span className="cur-code">{s.code}</span>
                        <span className="cur-skill">{s.skill}</span>
                        {s.subSkills.length > 0 && (
                          <button className="ghost-btn sm" onClick={() => setOpenStd(open ? null : s.code)}>
                            {open ? "Hide" : `${s.subSkills.length} skills`}
                          </button>
                        )}
                      </div>
                      {open && (
                        <div className="sk-list">
                          {s.subSkills.map((sub) => (
                            <div key={sub} className="sk-row">
                              <span className="sk-name">{sub}</span>
                              <Link
                                className="ghost-btn sm"
                                href={`/onboarding?topic=${encodeURIComponent(sub)}&code=${encodeURIComponent(s.code)}&grade=${encodeURIComponent(s.grade)}`}
                              >
                                Learn this
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
