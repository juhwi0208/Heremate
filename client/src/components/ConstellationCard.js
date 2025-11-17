// client/src/components/ConstellationCard.js
import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from './ui/card';

function drawConstellation(canvas, constellation) {
  if (!canvas || !constellation) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const nodes = Array.isArray(constellation.nodes)
    ? constellation.nodes
    : [];
  const edges = Array.isArray(constellation.edges)
    ? constellation.edges
    : [];

  const hasXY =
    nodes.length &&
    typeof nodes[0].x === 'number' &&
    typeof nodes[0].y === 'number';

  const getPos = (n, idx) => {
    if (hasXY) {
      return { x: n.x * w, y: n.y * h };
    }
    // x,y가 없으면 id 기반 pseudo-random 배치 (기존 방식 살짝 응용)
    const id = n.id ?? idx;
    const seed = (id * 9301 + 49297) % 233280;
    const angle = (seed / 233280) * Math.PI * 2;
    const radius = 0.25 * Math.min(w, h) + ((n.weight || 0.5) * 0.25 * Math.min(w, h));
    const cx = w / 2 + Math.cos(angle) * radius;
    const cy = h / 2 + Math.sin(angle) * radius;
    return { x: cx, y: cy };
  };

  const positions = nodes.map(getPos);

  // 선(엣지)
  ctx.save();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(148,163,184,0.7)';
  edges.forEach((e) => {
    const fromIdx = e.from;
    const toIdx = e.to;
    const a = positions[fromIdx];
    const b = positions[toIdx];
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  ctx.restore();

  // 별(노드) + glow
  ctx.save();
  ctx.fillStyle = '#e5f2ff';
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.shadowBlur = 14;

  nodes.forEach((n, idx) => {
    const { x, y } = positions[idx];
    const base = 2.2 + (n.weight || 0) * 3;
    const r = base;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

export default function ConstellationCard({ constellation, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => drawConstellation(canvas, constellation);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constellation]);

  const score = Math.round(constellation?.score || 0);
  const level = constellation?.level || 1;

  return (
    <Card
      className={`relative overflow-hidden rounded-2xl border-0 bg-transparent shadow-none ${className}`}
    >
      <CardContent className="p-0 h-full">
        <div
          className="relative h-full min-h-[220px] w-full overflow-hidden rounded-2xl bg-cover bg-center"
          style={{
            // ✅ 로컬 배경 이미지 사용
            backgroundImage:
              'url(/assets/jeremy-thomas-E0AHdsENmDg-unsplash.jpg)',
          }}
        >
          {/* 별자리 캔버스 */}
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* 살짝 어두운 그라데이션 (검은 박스 X) */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/55 via-transparent to-black/35" />

          {/* 텍스트 오버레이 */}
          <div className="absolute inset-0 flex flex-col justify-between p-6 text-white">
            <div className="text-sm text-zinc-200">나의 별자리</div>
            <div>
              <div className="text-2xl font-semibold">
                Lv.{level} · {score}점
              </div>
              <div className="mt-1 text-xs text-zinc-300">
                아름다운 별자리가 만들어졌어요 ✨
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
