// client/src/components/ConstellationCard.js
import React, { useEffect, useRef } from "react";

function drawConstellation(canvas, constellation) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, w, h);

  const nodes = Array.isArray(constellation?.nodes) ? constellation.nodes : [];
  const edges = Array.isArray(constellation?.edges) ? constellation.edges : [];

  if (!nodes.length) return;

  const hasXY =
    typeof nodes[0].x === "number" && typeof nodes[0].y === "number";

  const getPos = (node, index) => {
    if (hasXY) {
      return { x: node.x * w, y: node.y * h };
    }
    // 좌표가 없으면 원형으로 대충 배치
    const angle = (index / nodes.length) * Math.PI * 2;
    const radius = Math.min(w, h) * 0.35;
    return {
      x: w / 2 + Math.cos(angle) * radius,
      y: h / 2 + Math.sin(angle) * radius,
    };
  };

  const positions = nodes.map(getPos);

  // 선(엣지)
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.7)";
  ctx.lineWidth = 0.8;
  edges.forEach((e) => {
    const a = positions[e.from];
    const b = positions[e.to];
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  ctx.restore();

  // 별(노드)
  ctx.save();
  ctx.fillStyle = "#e5f2ff";
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 10;
  nodes.forEach((n, i) => {
    const { x, y } = positions[i];
    const r = 1.6 + (n.weight || 0) * 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
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
    const handle = () => drawConstellation(canvas, constellation);
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [constellation]);

  const score = Math.round(constellation?.score || 0);
  const level = constellation?.level || 1;

  // 🔹 compact 모드: 낮고 넓게
  const sizeClass = compact ? "h-[140px] w-full" : "h-[220px] w-full";
  const titleSize = compact ? "text-base" : "text-2xl";
  const descSize = compact ? "text-[10px]" : "text-xs";
  const labelSize = compact ? "text-[11px]" : "text-sm";
  const paddingClass = compact ? "px-4 py-3" : "p-6";

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] bg-cover bg-center ${sizeClass} ${className}`}
      style={{
        // ✅ 흰 카드 없이 우주 배경 바로 사용
        backgroundImage:
          "url(/assets/jeremy-thomas-E0AHdsENmDg-unsplash.jpg)",
      }}
    >
      {/* 별자리 캔버스 */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 어두운 그라데이션 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/35" />

      {/* 텍스트 */}
      <div
        className={`absolute inset-0 flex flex-col justify-between ${paddingClass} text-white`}
      >
        <div className={`${labelSize} text-zinc-200`}>나의 별자리</div>
        <div>
          <div className={`${titleSize} font-semibold`}>
            Lv.{level} · {score}점
          </div>
          <div className={`mt-1 ${descSize} text-zinc-300`}>
            아름다운 별자리가 만들어졌어요 ✨
          </div>
        </div>
      </div>
    </div>
  );
}
