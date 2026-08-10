"use client";

import { use, useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import type { Certificate } from "@/lib/types";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
    fetch(`/api/cert/${id}`)
      .then((r) => r.json())
      .then((d) => setCert(d.certificate ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  function copy() {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  }

  if (loading)
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow"><p className="muted">Loading certificate…</p></div>
      </div>
    );

  if (!cert)
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow"><div className="err">Certificate not found.</div></div>
      </div>
    );

  const issued = new Date(cert.issuedAt);
  // LinkedIn "Add to profile" prefill.
  const linkedIn =
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME` +
    `&name=${encodeURIComponent(cert.courseTitle)}` +
    `&organizationName=${encodeURIComponent("EduVerse")}` +
    `&issueYear=${issued.getFullYear()}&issueMonth=${issued.getMonth() + 1}` +
    `&certId=${encodeURIComponent(cert.id)}` +
    (url ? `&certUrl=${encodeURIComponent(url)}` : "");

  return (
    <div className="shell">
      <AppNav />
      <div className="page cert-page">
        <div className="certificate" id="certificate">
          <div className="cert-frame">
            <div className="cert-top">
              <span className="cert-brand">EduVerse</span>
              <span className="cert-kind">Certificate of Completion</span>
            </div>
            <div className="cert-seal">🎓</div>
            <p className="cert-preamble">This certifies that</p>
            <h1 className="cert-name">{cert.learnerName}</h1>
            <p className="cert-preamble">has successfully completed the certification course</p>
            <h2 className="cert-course">{cert.courseTitle}</h2>
            <div className="cert-meta">
              <div>
                <span className="cm-label">Exam score</span>
                <span className="cm-value">{cert.score}%</span>
              </div>
              <div>
                <span className="cm-label">Issued</span>
                <span className="cm-value">{fmtDate(cert.issuedAt)}</span>
              </div>
              <div>
                <span className="cm-label">Credential ID</span>
                <span className="cm-value mono">{cert.id.replace(/^cert_/, "").slice(0, 12)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cert-actions">
          <a className="send big" href={linkedIn} target="_blank" rel="noreferrer">Add to LinkedIn</a>
          <button className="ghost-btn" onClick={copy}>{copied ? "Link copied ✓" : "Copy link"}</button>
          <button className="ghost-btn" onClick={() => window.print()}>Download / Print</button>
        </div>
        <p className="cert-verify muted">
          Anyone with this link can verify the credential. Credential ID <b>{cert.id.replace(/^cert_/, "").slice(0, 12)}</b>.
        </p>
      </div>
    </div>
  );
}
