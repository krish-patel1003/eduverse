"use client";

import type { ItemVisual } from "@/lib/visuals";

// Drawn deterministically from the spec, so the mathematics in the picture is
// always exactly right. Outlines use currentColor and fills use a fixed accent,
// which keeps the figures legible in both light and dark themes.

const ACCENT = "#6ea8fe";
const WARM = "#fbbf24";
const W = 420;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
// Round every COMPUTED coordinate. Long floats from trig/division serialize
// differently on the server and the client, which trips React hydration.
const r2 = (n: number) => Math.round(n * 100) / 100;

function FractionBar({ parts, shaded }: { parts: number; shaded: number }) {
  const h = 54;
  const pw = r2(W / parts);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="iv-svg" role="img" aria-label={`${shaded} of ${parts} parts shaded`}>
      {Array.from({ length: parts }, (_, i) => (
        <rect
          key={i}
          x={r2(i * pw)}
          y={1}
          width={pw}
          height={h - 2}
          fill={i < shaded ? ACCENT : "transparent"}
          fillOpacity={i < shaded ? 0.75 : 0}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

function NumberLine({ min, max, step, marks }: { min: number; max: number; step: number; marks: number[] }) {
  const h = 62;
  const padX = 26;
  const y = 30;
  const span = max - min;
  const x = (v: number) => r2(padX + ((v - min) / span) * (W - padX * 2));
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="iv-svg" role="img" aria-label={`Number line from ${min} to ${max}`}>
      <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="currentColor" strokeWidth={2} />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={x(t)} y1={y - 7} x2={x(t)} y2={y + 7} stroke="currentColor" strokeWidth={1.5} />
          <text x={x(t)} y={y + 24} textAnchor="middle" fontSize={12} fill="currentColor" opacity={0.75}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {marks.map((m, i) => (
        <circle key={i} cx={x(m)} cy={y} r={7} fill={WARM} stroke="currentColor" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function DotArray({ rows, cols }: { rows: number; cols: number }) {
  const gap = 30;
  const pad = 18;
  const w = pad * 2 + (cols - 1) * gap;
  const h = pad * 2 + (rows - 1) * gap;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="iv-svg small" role="img" aria-label={`${rows} rows of ${cols}`}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <circle key={`${r}-${c}`} cx={pad + c * gap} cy={pad + r * gap} r={9} fill={ACCENT} fillOpacity={0.8} stroke="currentColor" strokeWidth={1.2} />
        ))
      )}
    </svg>
  );
}

function Counters({ groups, per }: { groups: number; per: number }) {
  const cols = Math.min(per, 5);
  const rows = Math.ceil(per / cols);
  const gap = 22;
  const gw = gap * cols + 16;
  const gh = gap * rows + 16;
  const gapX = 14;
  const w = groups * gw + (groups - 1) * gapX;
  return (
    <svg viewBox={`0 0 ${w} ${gh}`} className="iv-svg small" role="img" aria-label={`${groups} groups of ${per}`}>
      {Array.from({ length: groups }, (_, g) => (
        <g key={g} transform={`translate(${g * (gw + gapX)} 0)`}>
          <rect x={0} y={0} width={gw} height={gh} rx={10} fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.6} />
          {Array.from({ length: per }, (_, i) => (
            <circle key={i} cx={16 + (i % cols) * gap} cy={16 + Math.floor(i / cols) * gap} r={7.5} fill={WARM} fillOpacity={0.85} stroke="currentColor" strokeWidth={1.1} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function BaseTen({ hundreds, tens, ones }: { hundreds: number; tens: number; ones: number }) {
  const u = 9; // one unit square
  const flat = u * 10;
  const gap = 12;
  const parts: React.ReactNode[] = [];
  let x = 0;
  for (let i = 0; i < hundreds; i++) {
    parts.push(
      <g key={`h${i}`} transform={`translate(${x} 0)`}>
        <rect width={flat} height={flat} fill={ACCENT} fillOpacity={0.5} stroke="currentColor" strokeWidth={1.4} />
        {Array.from({ length: 9 }, (_, k) => (
          <g key={k}>
            <line x1={u * (k + 1)} y1={0} x2={u * (k + 1)} y2={flat} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />
            <line x1={0} y1={u * (k + 1)} x2={flat} y2={u * (k + 1)} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />
          </g>
        ))}
      </g>
    );
    x += flat + gap;
  }
  for (let i = 0; i < tens; i++) {
    parts.push(
      <g key={`t${i}`} transform={`translate(${x} 0)`}>
        <rect width={u} height={flat} fill={ACCENT} fillOpacity={0.75} stroke="currentColor" strokeWidth={1.3} />
        {Array.from({ length: 9 }, (_, k) => (
          <line key={k} x1={0} y1={u * (k + 1)} x2={u} y2={u * (k + 1)} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />
        ))}
      </g>
    );
    x += u + 6;
  }
  if (ones) x += gap - 6;
  for (let i = 0; i < ones; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    parts.push(
      <rect key={`o${i}`} x={x + col * (u + 4)} y={row * (u + 4)} width={u} height={u} fill={WARM} fillOpacity={0.9} stroke="currentColor" strokeWidth={1.2} />
    );
  }
  const w = Math.max(x + (ones ? Math.min(ones, 5) * (u + 4) : 0), 40);
  return (
    <svg viewBox={`0 0 ${w} ${flat}`} className="iv-svg small" role="img" aria-label={`${hundreds} hundreds, ${tens} tens, ${ones} ones`}>
      {parts}
    </svg>
  );
}

function BarModel({ bars }: { bars: { label: string; value: number }[] }) {
  const rowH = 40;
  const gap = 12;
  const labelW = 84;
  const maxV = Math.max(...bars.map((b) => b.value));
  const trackW = W - labelW - 56;
  const h = bars.length * rowH + (bars.length - 1) * gap;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="iv-svg" role="img" aria-label="Comparison bar model">
      {bars.map((b, i) => {
        const y = i * (rowH + gap);
        const bw = r2(Math.max(6, (b.value / maxV) * trackW));
        return (
          <g key={i}>
            <text x={0} y={y + rowH / 2 + 4} fontSize={13} fill="currentColor">
              {b.label}
            </text>
            <rect x={labelW} y={y} width={bw} height={rowH} rx={4} fill={i === 0 ? ACCENT : WARM} fillOpacity={0.75} stroke="currentColor" strokeWidth={1.3} />
            <text x={labelW + bw + 8} y={y + rowH / 2 + 4} fontSize={12.5} fill="currentColor" opacity={0.8}>
              {fmt(b.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ShapeFig({ shape, width, height, radius, unit }: { shape: string; width: number; height: number; radius: number; unit: string }) {
  const u = unit ? ` ${unit}` : "";
  const pad = 34;
  if (shape === "circle") {
    const r = 70;
    const s = r * 2 + pad * 2;
    return (
      <svg viewBox={`0 0 ${s} ${s}`} className="iv-svg small" role="img" aria-label={`Circle with radius ${radius}${u}`}>
        <circle cx={s / 2} cy={s / 2} r={r} fill={ACCENT} fillOpacity={0.25} stroke="currentColor" strokeWidth={1.8} />
        <line x1={s / 2} y1={s / 2} x2={s / 2 + r} y2={s / 2} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" />
        <circle cx={s / 2} cy={s / 2} r={3} fill="currentColor" />
        <text x={s / 2 + r / 2} y={s / 2 - 8} textAnchor="middle" fontSize={13} fill="currentColor">
          {fmt(radius)}{u}
        </text>
      </svg>
    );
  }
  // Scale so the longer side is a fixed length; keeps the drawing proportional.
  const long = Math.max(width, height);
  const sc = 150 / long;
  const w = r2(width * sc);
  const h = r2(height * sc);
  // Extra right margin so the side dimension label is not clipped.
  const vw = w + pad * 2 + 30;
  const vh = h + pad * 2;
  if (shape === "triangle") {
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} className="iv-svg small" role="img" aria-label={`Triangle base ${width}${u}, height ${height}${u}`}>
        <polygon points={`${pad},${pad + h} ${pad + w},${pad + h} ${pad + w / 2},${pad}`} fill={ACCENT} fillOpacity={0.25} stroke="currentColor" strokeWidth={1.8} />
        <line x1={pad + w / 2} y1={pad} x2={pad + w / 2} y2={pad + h} stroke="currentColor" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.75} />
        <text x={pad + w / 2} y={pad + h + 20} textAnchor="middle" fontSize={13} fill="currentColor">{fmt(width)}{u}</text>
        <text x={pad + w / 2 + 8} y={pad + h / 2} fontSize={13} fill="currentColor">{fmt(height)}{u}</text>
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="iv-svg small" role="img" aria-label={`Rectangle ${width}${u} by ${height}${u}`}>
      <rect x={pad} y={pad} width={w} height={h} fill={ACCENT} fillOpacity={0.25} stroke="currentColor" strokeWidth={1.8} />
      <text x={pad + w / 2} y={pad + h + 20} textAnchor="middle" fontSize={13} fill="currentColor">{fmt(width)}{u}</text>
      <text x={pad + w + 8} y={pad + h / 2 + 4} fontSize={13} fill="currentColor">{fmt(height)}{u}</text>
    </svg>
  );
}

function Clock({ hour, minute }: { hour: number; minute: number }) {
  const s = 190;
  const c = s / 2;
  const r = 80;
  const minAng = (minute / 60) * 2 * Math.PI - Math.PI / 2;
  const hrAng = (((hour % 12) + minute / 60) / 12) * 2 * Math.PI - Math.PI / 2;
  return (
    <svg viewBox={`0 0 ${s} ${s}`} className="iv-svg small" role="img" aria-label="Clock face">
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={2.2} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
        return (
          <text key={i} x={r2(c + Math.cos(a) * (r - 16))} y={r2(c + Math.sin(a) * (r - 16) + 4.5)} textAnchor="middle" fontSize={12.5} fill="currentColor" opacity={0.8}>
            {i === 0 ? 12 : i}
          </text>
        );
      })}
      <line x1={c} y1={c} x2={r2(c + Math.cos(hrAng) * (r * 0.5))} y2={r2(c + Math.sin(hrAng) * (r * 0.5))} stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
      <line x1={c} y1={c} x2={r2(c + Math.cos(minAng) * (r * 0.75))} y2={r2(c + Math.sin(minAng) * (r * 0.75))} stroke={ACCENT} strokeWidth={3} strokeLinecap="round" />
      <circle cx={c} cy={c} r={4} fill="currentColor" />
    </svg>
  );
}

export default function ItemVisualFigure({ visual }: { visual: ItemVisual }) {
  const v = visual;
  let body: React.ReactNode = null;
  switch (v.kind) {
    case "fraction_bar":
      body = <FractionBar parts={v.parts ?? 4} shaded={v.shaded ?? 1} />;
      break;
    case "number_line":
      body = <NumberLine min={v.min ?? 0} max={v.max ?? 10} step={v.step ?? 1} marks={v.marks ?? []} />;
      break;
    case "array":
      body = <DotArray rows={v.rows ?? 3} cols={v.cols ?? 4} />;
      break;
    case "counters":
      body = <Counters groups={v.groups ?? 3} per={v.per ?? 4} />;
      break;
    case "base_ten":
      body = <BaseTen hundreds={v.hundreds ?? 0} tens={v.tens ?? 0} ones={v.ones ?? 0} />;
      break;
    case "bar_model":
      body = <BarModel bars={v.bars ?? []} />;
      break;
    case "shape":
      body = <ShapeFig shape={v.shape ?? "rect"} width={v.width ?? 6} height={v.height ?? 4} radius={v.radius ?? 5} unit={v.unit ?? ""} />;
      break;
    case "clock":
      body = <Clock hour={v.hour ?? 3} minute={v.minute ?? 0} />;
      break;
  }
  if (!body) return null;
  return (
    <figure className="item-visual">
      {body}
      {v.caption && <figcaption>{v.caption}</figcaption>}
    </figure>
  );
}
