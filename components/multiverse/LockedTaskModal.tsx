'use client';

interface LockedTaskModalProps {
  taskTitle: string;
  reason: string;
  prerequisite: string;
  onClose: () => void;
}

export function LockedTaskModal({ taskTitle, reason, prerequisite, onClose }: LockedTaskModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-lg">
              🔒
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-300">{taskTitle}</h2>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Locked</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-700/30 rounded-xl">
            <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-sm text-amber-200 leading-relaxed">{reason}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl">
            <p className="text-[11px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
              Complete first
            </p>
            <p className="text-sm text-white font-medium">{prerequisite}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition-colors font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
