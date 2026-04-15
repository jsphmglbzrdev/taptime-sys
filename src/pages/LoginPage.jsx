import React from "react";
import LoginForm from "../components/LoginForm";

const LoginPage = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-6 font-sans sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.12),_transparent_28%),linear-gradient(180deg,_#fff7ed_0%,_#ffffff_42%,_#fffaf5_100%)]" />
        <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-orange-100/70 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-orange-200/50 blur-3xl sm:h-96 sm:w-96" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;
