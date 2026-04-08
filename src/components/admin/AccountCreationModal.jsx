import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  ShieldCheck,
  Contact,
  X,
  UserPlus,
  CheckCircle2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useLoading } from "../../context/LoadingContext";
import { createUser } from "../../utils/auth";
import { toast } from "react-toastify";
/**
 * Modernized Form Row Component
 * Defined OUTSIDE the main component to prevent re-mounting and focus loss during typing.
 */
const FormRow = ({ label, children, icon: Icon }) => (
  <div className="flex flex-col gap-1.5 group">
    <label className="text-sm font-medium text-slate-500 text-left transition-colors group-focus-within:text-slate-900">
      {label}
    </label>
    <div className="relative w-full flex items-center">
      <div className="absolute left-3.5 flex items-center justify-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300">
        <Icon size={18} strokeWidth={1.5} />
      </div>
      {children}
    </div>
  </div>
);

const AccountCreationModal = ({ isOpen, setIsFormOpen }) => {
  const { setLoading } = useLoading();

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "Employee",
  });
  const initialFormData = {
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "Employee",
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsFormOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setIsSubmitting(true);

    try {
      const response = await createUser({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      if (response.success) {
        toast.success("Account created");
        setIsSuccess(true);
        setIsFormOpen(false);
      } else {
        toast.error(response.error || "Failed to create account");
      }

      setFormData(initialFormData);

    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md transition-opacity duration-300"
        onClick={() => setIsFormOpen(false)}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col transform overflow-hidden rounded-[20px] sm:rounded-[24px] bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] transition-all animate-in fade-in zoom-in-95 duration-300 border border-slate-100">
        {/* Top Gradient Border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-orange-300 via-orange-500 to-orange-400 opacity-90" />

        {/* Scrollable Content */}
        <div className="p-6 sm:p-10 overflow-y-auto flex-1">
          {/* Close Button */}
          <button
            onClick={() => setIsFormOpen(false)}
            className="absolute cursor-pointer right-5 top-5 sm:right-6 sm:top-6 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all p-2 rounded-full active:scale-95"
          >
            <X size={20} strokeWidth={2} />
          </button>

          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center animate-in zoom-in-95 duration-500">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 rounded-full animate-pulse" />
                <div className="relative bg-linear-to-b from-orange-50 to-white rounded-full p-5 shadow-sm border border-orange-100">
                  <CheckCircle2
                    size={48}
                    className="text-orange-500"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                Profile Activated
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-500">
                The workspace has been successfully updated.
              </p>
            </div>
          ) : (
            <div className="animate-in slide-in-from-bottom-2 duration-500">
              {/* Header */}
              <div className="mb-8 sm:mb-10 flex flex-col items-center md:items-start text-center md:text-left">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-500 border border-orange-100/50">
                    <Sparkles size={20} strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-semibold text-orange-500 tracking-wide uppercase">
                    New Member
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                  Create Account
                </h2>
                <p className="text-slate-500 mt-2 text-sm sm:text-base">
                  Configure details and assign workspace permissions.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4">
                  <FormRow label="First Name" icon={User}>
                    <input
                      type="text"
                      name="first_name"
                      required
                      placeholder="e.g. John"
                      value={formData.first_name}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm"
                    />
                  </FormRow>

                  <FormRow label="Last Name" icon={User}>
                    <input
                      type="text"
                      name="last_name"
                      required
                      placeholder="e.g. Doe"
                      value={formData.last_name}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm"
                    />
                  </FormRow>

                  <FormRow label="Email Address" icon={Mail}>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="jane@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm"
                    />
                  </FormRow>

                  <FormRow label="Password" icon={Lock}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute cursor-pointer right-1 top-1 bottom-1 px-3 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff size={18} strokeWidth={1.5} />
                      ) : (
                        <Eye size={18} strokeWidth={1.5} />
                      )}
                    </button>
                  </FormRow>

                  <FormRow
                    label="Access Role"
                    icon={formData.role === "Admin" ? ShieldCheck : Contact}
                  >
                    <div className="relative w-full">
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="block w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm cursor-pointer"
                      >
                        <option value="Employee">Employee</option>
                        <option value="Admin">Administrator</option>
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                        <ChevronDown size={16} strokeWidth={2} />
                      </div>
                    </div>
                  </FormRow>
                </div>

                {/* Footer */}
                <div className="pt-6 mt-6 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group cursor-pointer relative w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium py-3 sm:py-3.5 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(234,88,12,0.39)] hover:shadow-[0_6px_20px_rgba(234,88,12,0.23)] hover:-translate-y-px"
                  >
                    {isSubmitting ? (
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Profile</span>
                        <UserPlus
                          size={18}
                          className="group-hover:translate-x-0.5 transition-transform"
                          strokeWidth={2}
                        />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountCreationModal;
