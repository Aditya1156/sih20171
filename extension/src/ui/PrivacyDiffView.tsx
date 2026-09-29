import React from 'react';

interface DiffEntry {
  elementId: string;
  field: string;
  original: string;
  redacted: string;
  piiType: string;
}

interface DiffData {
  entries: DiffEntry[];
  stats: {
    totalFields: number;
    redactedFields: number;
    piiTypesFound: string[];
  };
}

interface PrivacyDiffViewProps {
  diff: DiffData;
}

const typeColors: Record<string, string> = {
  EMAIL: 'bg-blue-100 text-blue-700',
  PHONE: 'bg-green-100 text-green-700',
  AADHAAR: 'bg-red-100 text-red-700',
  PAN: 'bg-orange-100 text-orange-700',
  CARD: 'bg-red-100 text-red-700',
  UPI: 'bg-purple-100 text-purple-700',
  IFSC: 'bg-teal-100 text-teal-700',
  PASSWORD: 'bg-gray-100 text-gray-700',
  NAME: 'bg-cyan-100 text-cyan-700',
};

export function PrivacyDiffView({ diff }: PrivacyDiffViewProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs mb-2">
        <span className="px-2 py-0.5 bg-gray-100 rounded font-medium">
          {diff.stats.totalFields} fields
        </span>
        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">
          {diff.stats.redactedFields} redacted
        </span>
      </div>

      <div className="flex gap-1 flex-wrap mb-2">
        {diff.stats.piiTypesFound.map((t) => (
          <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded ${typeColors[t] ?? 'bg-gray-100 text-gray-600'}`}>
            {t}
          </span>
        ))}
      </div>

      {diff.entries.map((entry, i) => (
        <div key={i} className="bg-white rounded border p-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 font-mono">{entry.elementId}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColors[entry.piiType] ?? 'bg-gray-100 text-gray-600'}`}>
              {entry.piiType}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="p-1.5 bg-red-50 rounded border border-red-200">
              <span className="text-[10px] text-red-400 block mb-0.5">Page sees</span>
              <span className="text-red-700 break-all">{entry.original}</span>
            </div>
            <div className="p-1.5 bg-green-50 rounded border border-green-200">
              <span className="text-[10px] text-green-400 block mb-0.5">LLM sees</span>
              <span className="text-green-700 break-all">{entry.redacted}</span>
            </div>
          </div>
        </div>
      ))}

      {diff.entries.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          No differences found — no PII was detected.
        </p>
      )}
    </div>
  );
}
