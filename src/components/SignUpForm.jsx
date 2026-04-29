import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  XCircle,
  User,
  UserPlus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useLoading } from "../context/LoadingContext";
import { signUpEmployeeWithEmployerCode } from "../utils/auth";
import logo from "/surf2sawa.png";
import jk2l2_logo from "/JK2L2_Crown.png";

const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "One number",
    test: (value) => /\d/.test(value),
  },
  {
    id: "special",
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export default function SignUpForm() {
  const navigate = useNavigate();
  const { setLoading } = useLoading();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    employer_code: "",
  });
  const passwordChecks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(String(formData.password ?? "")),
  }));
  const isPasswordValid = passwordChecks.every((rule) => rule.passed);
  const isAccountDetailsValid =
    String(formData.first_name ?? "").trim().length > 0 &&
    String(formData.last_name ?? "").trim().length > 0 &&
    String(formData.email ?? "").trim().length > 0 &&
    isPasswordValid;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: name === "employer_code" ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setLoading(true);

    try {
      if (!isPasswordValid) {
        toast.error("Password does not meet the required strength.");
        return;
      }

      const response = await signUpEmployeeWithEmployerCode(formData);
      if (!response.success) {
        toast.error(response.error || "Failed to create employee account.");
        return;
      }

      toast.success(
        `Account created. You are now linked to ${response.employer?.first_name ?? "your employer"}'s employer code.`,
      );
      navigate("/user/dashboard", { replace: true });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const goToInviteCodeStep = () => {
    if (!isAccountDetailsValid) {
      toast.error("Complete your account details and password requirements first.");
      return;
    }

    setStep(2);
  };

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
              <img src={logo} alt="" />
              <img src={jk2l2_logo} alt="" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Employee Sign Up
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Create your employee account first, then finish the setup with your employer invite code.
            </p>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                step === 1
                  ? "bg-orange-500 text-white"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              1
            </div>
            <div className="h-1 flex-1 rounded-full bg-orange-100">
              <div
                className={`h-full rounded-full bg-orange-500 transition-all ${
                  step === 2 ? "w-full" : "w-1/2"
                }`}
              />
            </div>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                step === 2
                  ? "bg-orange-500 text-white"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              2
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 ? (
              <>
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm text-orange-900">
                  Enter your personal details and create a strong password. You will add the employer invite code on the next step to finish joining your employer.
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      First Name
                    </span>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="first_name"
                        required
                        value={formData.first_name}
                        onChange={handleChange}
                        className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 outline-none transition-all focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        placeholder="First name"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Last Name
                    </span>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="last_name"
                        required
                        value={formData.last_name}
                        onChange={handleChange}
                        className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 outline-none transition-all focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        placeholder="Last name"
                      />
                    </div>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Email Address
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 outline-none transition-all focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      placeholder="employee@company.com"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Password
                  </span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      aria-invalid={formData.password.length > 0 && !isPasswordValid}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 outline-none transition-all focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 cursor-pointer pr-3 text-gray-400 hover:text-orange-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {passwordChecks.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-2 text-xs font-medium ${
                          rule.passed ? "text-emerald-600" : "text-gray-500"
                        }`}
                      >
                        {rule.passed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0" />
                        )}
                        <span>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                </label>

                <button
                  type="button"
                  onClick={goToInviteCodeStep}
                  className="w-full cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600"
                >
                  Continue
                  <ArrowRight className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm text-orange-900">
                  Final step: enter the employer invite code provided to you. This will link your new employee account to the correct employer and department.
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Employer Invite Code
                  </span>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      name="employer_code"
                      required
                      value={formData.employer_code}
                      onChange={handleChange}
                      className="block w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 uppercase outline-none transition-all focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      placeholder="Enter employer code"
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    This code links your employee account to the matching employer only.
                  </p>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 px-4 py-3 text-sm font-semibold text-orange-700 transition-all hover:bg-orange-50 sm:w-auto sm:min-w-36"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="h-5 w-5" />
                    {isSubmitting ? "Creating Account..." : "Finish Sign Up"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <div className="border-t border-orange-100 bg-orange-50 px-6 py-4 text-center text-sm font-medium text-orange-800">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
