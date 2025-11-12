// client/src/components/TrustBadge.js
import React from 'react';
import { Badge } from './ui/badge';

function toneToColor(tone) {
  switch (tone) {
    case 'warm': return 'bg-yellow-200 text-yellow-900 border-yellow-300';
    case 'cool': return 'bg-blue-200 text-blue-900 border-blue-300';
    default: return 'bg-zinc-200 text-zinc-800 border-zinc-300';
  }
}
function scoreToLabel(score = 0) {
  if (score >= 85) return '오로라';
  if (score >= 70) return '별빛';
  if (score >= 55) return '노을빛';
  if (score >= 35) return '산들빛';
  return '잔빛';
}
export default function TrustBadge({ aura }) {
  if (!aura) return null;
  const label = scoreToLabel(aura.score);
  return (
    <div className="flex items-center gap-2">
      <Badge className={`${toneToColor(aura.tone)} border px-2 py-1 rounded-full`}>
        {`아우라 ${label}`}
      </Badge>
      <span className="text-sm text-zinc-500">{Math.round(aura.score)}점</span>
    </div>
  );
}
