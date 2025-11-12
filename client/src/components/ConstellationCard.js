// client/src/components/ConstellationCard.js
import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

function drawGraph(canvas, nodes = [], edges = []) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // 랜덤 but 안정적 배치
  const seeded = nodes.map((n, i) => {
    const seed = (n.id * 9301 + 49297) % 233280;
    const a = (seed / 233280) * Math.PI * 2;
    const r = 60 + (1 - (n.weight || 0)) * 70;
    const cx = W/2 + Math.cos(a) * r;
    const cy = H/2 + Math.sin(a) * r;
    return { ...n, x: cx, y: cy };
  });

  // 엣지
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  seeded.forEach(n => {
    edges.filter(e => e.target === n.id || e.source === n.id).forEach(e => {
      const a = seeded.find(x => x.id === e.source);
      const b = seeded.find(x => x.id === e.target);
      if (!a || !b) return;
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
  });

  // 노드
  seeded.forEach(n => {
    const radius = 5 + (n.weight || 0) * 8;
    ctx.beginPath();
    ctx.fillStyle = '#60A5FA';
    ctx.globalAlpha = 0.9;
    ctx.arc(n.x, n.y, radius, 0, Math.PI*2);
    ctx.fill();
  });

  // 중심
  ctx.beginPath();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#10B981';
  ctx.arc(W/2, H/2, 6, 0, Math.PI*2);
  ctx.fill();
}

export default function ConstellationCard({ constellation }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    cvs.width = cvs.clientWidth * 2;
    cvs.height = 220 * 2;
    drawGraph(cvs, constellation?.nodes || [], constellation?.edges || []);
  }, [constellation]);

  const score = Math.round(constellation?.score || 0);
  const level = constellation?.level || 1;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          나의 별자리
          <span className="ml-2 text-sm text-zinc-500">Lv.{level} · {score}점</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl bg-zinc-50 border h-[220px] overflow-hidden">
          <canvas ref={ref} className="w-full h-[220px]" />
        </div>
        <div className="text-sm text-zinc-600">아름다운 별자리가 만들어졌어요 ✦</div>
      </CardContent>
    </Card>
  );
}
