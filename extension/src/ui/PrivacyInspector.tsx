import React, { useState } from 'react';

export interface RedactionEntry {
  placeholder: string;
  originalPreview: string;
  type: string;
}

export interface InspectorData {
  redactions: RedactionEntry[];
  outgoingPayload: string;
  timestamp: number;
}

interface PrivacyInspectorProps {
  data: InspectorData | null;
}

export function PrivacyInspector({ data }: PrivacyInspectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPayload, setShowPayload] = useState(false);

  if (!data) {
    return (
      <div className="px-4 py-3 bg-white border-t">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Privacy Inspector</span>
          <span className="text-xs text-gray-400">No data yet</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Redaction details appear here after the agent runs.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-white border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-sm font-semibold text-gray-700">Privacy Inspector</span>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            {data.redactions.length} redacted
          </span>
          <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            {data.redactions.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-gray-50 rounded">
                <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                  {r.placeholder}
                </span>
                <span className="text-gray-400">&larr;</span>
                <span className="text-gray-600 font-mono">{r.originalPreview}</span>
                <span className="ml-auto text-gray-400">{r.type}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowPayload(!showPayload)}
            className="text-xs text-indigo-600 hover:underline"
          >
            {showPayload ? 'Hide' : 'Show'} outgoing payload
          </button>

          {showPayload && (
            <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
              {data.outgoingPayload}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
