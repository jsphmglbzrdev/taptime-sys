import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { signIn } from "../utils/auth";
import { useLoading } from "../context/LoadingContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function LoginForm({ onLogin }) {
  const { setLoading } = useLoading();
	const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

// LoginPage.jsx or MainLogin.jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const response = await signIn(username, password);

    if (!response.success) {
      toast.error(response.error); // show error toasts
      return; // stop further execution
    }
		
		if(response.account.role === "Admin") {
			navigate("/admin/dashboard");
		}else{
			navigate("/user/dashboard");
		}
		
  } catch (err) {
    toast.error("Something went wrong");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-orange-500 -z-10 rounded-b-[50px] md:rounded-b-[100px] shadow-lg"></div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div className="p-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800">Welcome Back</h2>
            <p className="text-gray-500 mt-2">
              Please enter your details to sign in
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute cursor-pointer inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-orange-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              className={`w-full flex cursor-pointer justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all transform active:scale-[0.98] }`}
            >
              Sign In
            </button>
          </form>
        </div>

        <div className="bg-orange-50 py-4 px-8 text-center">
          <p className="text-xs text-orange-800 font-medium">
            Internal System Access Only
          </p>
        </div>
      </div>
    </div>
  );
}
