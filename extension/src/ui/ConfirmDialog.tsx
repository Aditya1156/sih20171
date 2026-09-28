import React from 'react';
import type { Action } from '../shared/schemas';

interface ConfirmDialogProps {
  action: Action;
  onConfirm: () => void;
  onDeny: () => void;
}

function describeAction(action: Action): string {
  switch (action.type) {
    case 'click':
      return `Click element ${action.elementId}`;
    case 'type':
      return `Type into element ${action.elementId}`;
    case 'scroll':
      return `Scroll ${action.direction}`;
    case 'select':
      return `Select "${action.value}" in element ${action.elementId}`;
    default:
      return `Perform ${action.type}`;
  }
}

export function ConfirmDialog({ action, onConfirm, onDeny }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-yellow-500 text-lg">&#9888;</span>
          <h3 className="text-sm font-semibold text-gray-800">Risky Action Detected</h3>
        </div>
        <p className="text-xs text-gray-600 mb-1">The agent wants to:</p>
        <p className="text-sm font-mono bg-gray-50 p-2 rounded mb-3">{describeAction(action)}</p>
        {action.reasoning && (
          <p className="text-xs text-gray-500 mb-3 italic">Reason: {action.reasoning}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Allow
          </button>
          <button
            onClick={onDeny}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
