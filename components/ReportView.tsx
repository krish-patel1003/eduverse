"use client";

// Per-aspect assessment report: an overall ring + rank and sorted aspect bars.
export interface ReportData {
  overall: number;
  rank: string;
  perAspect: { aspect: string; score: number }[];
  weakAspects: string[];
  summary: string;
}

export default function ReportView({ report }: { report: ReportData }) {
  return (
    <div className="report">
      <div className="report-top">
        <div className="report-ring" style={{ ["--p" as string]: report.overall }}>
          <span className="rr-num">{report.overall}%</span>
          <span className="rr-rank">{report.rank}</span>
        </div>
        <div className="report-summary">
          <p>{report.summary}</p>
          {report.weakAspects.length > 0 && <p className="muted">Focus areas: {report.weakAspects.join(", ")}</p>}
        </div>
      </div>
      <div className="report-aspects">
        {report.perAspect
          .slice()
          .sort((a, b) => a.score - b.score)
          .map((a) => {
            const cls = a.score >= 70 ? "good" : a.score >= 40 ? "mid" : "bad";
            return (
              <div key={a.aspect} className="ra-row">
                <span className="ra-name">{a.aspect}</span>
                <span className="ra-bar"><span className={cls} style={{ width: `${a.score}%` }} /></span>
                <span className="ra-score">{a.score}%</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
