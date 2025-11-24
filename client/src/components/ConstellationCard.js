// client/src/components/ConstellationCard.js
import React, { useEffect, useRef } from "react";

function drawConstellation(canvas, nodes = []) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.clientWidth || 0;
  const h = rect.height || canvas.clientHeight || 0;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // ───────── 중앙 별(나) ─────────
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (!nodes.length) return;

  const baseR = Math.min(w, h) * 0.32;
  const spreadR = Math.min(w, h) * 0.08;

  // ───────── 메이트 위치 계산 ─────────
  const placed = nodes.map((n, idx) => {
    const idNum = Number(n.id) || idx + 1;
    const seed = (idNum * 9301 + 49297) % 233280;
    const angle = (seed / 233280) * Math.PI * 2;

    const weight = typeof n.weight === "number" ? n.weight : 0.5;
    const radius = baseR + (1 - weight) * spreadR;

    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    return {
      id: n.id,
      x,
      y,
      weight,
      trips: Number(n.trips || n.trips_count || 1),
    };
  });

  // ───────── 중앙 ↔ 메이트 흰 선 (동행 횟수에 따라 두께 증가) ─────────
  placed.forEach((p) => {
    const lineWidth = 0.8 + Math.min(p.trips, 6) * 0.7;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  });

  // ───────── 메이트 별(흰 점) ─────────
  placed.forEach((p) => {
    const r = 2.6 + (p.weight || 0.5) * 1.8;

    // 약한 글로우
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 실제 별
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export default function ConstellationCard({
  constellation,
  compact = false,
  className = "",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = () => {
      const nodes = Array.isArray(constellation?.nodes)
        ? constellation.nodes
        : [];
      drawConstellation(canvas, nodes);
    };

    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [constellation]);

  const score = Math.round(constellation?.score || 0);
  const level = constellation?.level || 1;
  const uniquePartners =
    constellation?.uniquePartners ??
    (Array.isArray(constellation?.nodes) ? constellation.nodes.length : 0);
  const trips = constellation?.trips ?? 0;

  // compact 모드 대비 사이즈/폰트
  const sizeClass = compact ? "h-[140px]" : "h-[220px]";
  const titleSize = compact ? "text-base" : "text-2xl";
  const descSize = compact ? "text-[10px]" : "text-xs";
  const labelSize = compact ? "text-[11px]" : "text-sm";
  const paddingClass = compact ? "px-4 py-3" : "p-6";

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] bg-cover bg-center w-full ${sizeClass} ${className}`}
      style={{
        // ✅ 회색 배경 위에 바로 우주 사진만
        backgroundImage:
          "url(/assets/jeremy-thomas-E0AHdsENmDg-unsplash.jpg)",
      }}
    >
      {/* 별자리 캔버스 */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 어두운 그라데이션 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/35" />

      {/* 텍스트 오버레이 */}
      <div
        className={`absolute inset-0 flex flex-col justify-between ${paddingClass} text-white`}
      >
        <div>
          <div className={`${labelSize} text-zinc-200`}>나의 별자리</div>
          <div className={`${titleSize} font-semibold`}>
            Lv.{level} · {score}점
          </div>
        </div>

        <div className="flex items-end justify-between text-[11px] md:text-xs text-zinc-100">
          <span>함께한 메이트 {uniquePartners}명</span>
          <span>완료한 동행 {trips}회</span>
        </div>
      </div>
    </div>
  );
}
