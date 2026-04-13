import { X } from "lucide-react";

export default function AvatarViewerModal({ isOpen, src, title, onClose }) {
  if (!isOpen || !src) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl rounded-3xl bg-white p-4 sm:p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-black text-gray-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl bg-gray-100">
          <img
            src={src}
            alt={title}
            className="block h-auto max-h-[70vh] w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
