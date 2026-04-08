import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
	import.meta.env.VITE_SUPABASE_URL,
	import.meta.env.VITE_SUPABASE_ROLE_KEY,
	{
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
			storageKey: "supabase-admin-session",
		},
	}
);

// Account creation


export const createUser = async ({ first_name, last_name, email, password, role }) => {
  try {
    // 1. Create user without affecting current session
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // optional
    });
    if (error) throw error;
    
    const authUserId = data?.user?.id ?? data?.id;
    if (!authUserId) throw new Error("Created auth user id not found");

    // 2. Insert into profiles table
    const { error: profileError } = await supabaseAdmin.from("user_profiles").insert([
      {
        auth_id: authUserId,
        first_name,
        last_name,
        email,
        role: role || "Employee",
      },
    ]);
    if (profileError) throw profileError;

    return { success: true, user: data?.user ?? data };
  } catch (error) {
    console.error("Signup Error:", error.message);
    return { success: false, error: error.message };
  }
};

export const listUserProfiles = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error("List users error:", error.message);
    return { success: false, error: error.message };
  }
};

export const updateUserAccount = async ({ auth_id, first_name, last_name, password }) => {
  try {
    if (!auth_id) throw new Error("auth_id is required");

    // 1) Update profile names
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update({ first_name, last_name })
      .eq("auth_id", auth_id);

    if (profileError) throw profileError;

    // 2) Update password (optional)
    const safePassword = (password ?? "").trim();
    if (safePassword.length > 0) {
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(auth_id, {
        password: safePassword,
      });
      if (pwError) throw pwError;
    }

    return { success: true };
  } catch (error) {
    console.error("Update user error:", error.message);
    return { success: false, error: error.message };
  }
};

export const deleteUserAccount = async ({ auth_id }) => {
  try {
    if (!auth_id) throw new Error("auth_id is required");

    // Deleting from auth should cascade to user_profiles if FK is set up with on delete cascade.
    // If not, this still removes the login.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(auth_id);
    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Delete user error:", error.message);
    return { success: false, error: error.message };
  }
};

export const listTimeEntriesByAuthId = async ({ auth_id }) => {
  try {
    if (!auth_id) throw new Error("auth_id is required");

    const { data, error } = await supabaseAdmin
      .from("time_entries")
      .select("*")
      .eq("auth_id", auth_id)
      .order("shift_date", { ascending: false });

    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error("List time entries error:", error.message);
    return { success: false, error: error.message };
  }
};