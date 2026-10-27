// src/components/ReliabilityBadge.jsx
import React from 'react';

export function ReliabilityBadge({ score = 100, totalRides = 0 }) {
  if (totalRides === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
        Nouveau membre
      </span>
    );
  }

  const colorClass =
    score >= 90
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : score >= 75
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-red-100 text-red-800 border-red-200';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
      <span>✓ {score}% ponctuel</span>
      <span className="opacity-75 font-normal">({totalRides} trajets)</span>
    </span>
  );
}
