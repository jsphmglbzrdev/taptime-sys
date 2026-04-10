import { useState, useEffect } from "react";

function DeleteEmployeeModal({ isOpen, onClose, employee, confirmText, onConfirm, isSelf }) {
    const [typed, setTyped] = useState("");
  
    useEffect(() => {
      if (isOpen) setTyped("");
    }, [isOpen]);
  
    if (!isOpen || !employee) return null;
  
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-100 shadow-2xl p-6">
          <h3 className="text-lg font-black text-gray-800">Delete Account</h3>
          <p className="text-sm text-gray-500 mt-1">
            This will permanently delete <span className="font-bold text-gray-800">{employee.email}</span>.
          </p>
  
          {isSelf && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 text-orange-700 text-sm font-bold">
              You can’t delete your own admin account.
            </div>
          )}
  
          <div className="mt-5">
            <label className="text-xs font-bold text-gray-500 tracking-widest">
              Type <span className="text-gray-800">{confirmText}</span> to confirm
            </label>
            <input
              disabled={isSelf}
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-60"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
  
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full cursor-pointer px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSelf || typed !== confirmText}
              onClick={() => onConfirm(employee)}
              className="w-full cursor-pointer px-4 py-3 rounded-xl font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

export default DeleteEmployeeModal;