import { supabase } from "./supabase";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ROLE_KEY,
  {
    auth: {
      // Prevent the admin client from touching (and potentially clobbering)
      // the currently logged-in user's browser auth session.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "supabase-admin-session",
    },
  }
);

// Sign in function that authenticates user and fetches their account data
export const signIn = async (username, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: username,
    password: password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { success: false, error: 'User ID not found after login' };
  }

  // Use maybeSingle to avoid error when 0 rows
  const { data: userAccount, error: errorAccount } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_id', userId).maybeSingle();
	
  if (errorAccount) {
    return { success: false, error: errorAccount.message };
  }

  if (!userAccount) {
    return { success: false, error: 'User account not found' };
  }

  return {
    success: true,
    user: data.user,
    account: userAccount
  };
};

// Account creation


export const createUser = async ({ first_name, last_name, email, password, role }) => {
  try {
    const safeEmail = (email ?? "").trim();
    const safePassword = password ?? "";

    if (!safeEmail) return { success: false, error: "Email is required" };
    if (!safePassword) return { success: false, error: "Password is required" };

    // 1. Create user without affecting current session
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true, // optional
    });
    if (error) throw error;
    
    // supabase-js returns created user under `data.user` for admin.createUser
    const authUserId = data?.user?.id ?? data?.id;
    if (!authUserId) {
      throw new Error('Created auth user id not found');
    }

    // 2. Insert into profiles table
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert([
        {
          auth_id: authUserId,
          first_name,
          last_name,
          email: safeEmail,
          role: role || "Employee",
        },
      ]);
    if (profileError) throw profileError;

    return { success: true, user: data?.user ?? data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


// Fetch current user who are logged in
export const getCurrentUser = async (id) => {
	const { data, error } = await supabase.from('user_profiles').select("*").eq('auth_id', id).maybeSingle();

	return { data, error };
}

// Sign out
export const signOut = async () => {	
	const { error } = await supabase.auth.signOut();
	if (error) {
		return { success: false, error: error.message };
	}
	return { success: true };
}