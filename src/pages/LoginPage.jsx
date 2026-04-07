import React, { useState } from 'react';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({ username: '' });

  const handleLogin = (username) => {
    setUser({ username });
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser({ username: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
			<LoginForm/>
    </div>
  );
}


