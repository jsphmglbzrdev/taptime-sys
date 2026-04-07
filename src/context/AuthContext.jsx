// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { useLoading } from "./LoadingContext";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const { setLoading } = useLoading(); // global loading context

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true); // start global spinner

      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
      } finally {
        setLoading(false); // stop spinner
      }
    };

    checkSession();

    // Listen for auth state changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [setLoading]);

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);