import { supabase } from "./supabase";
import { createClient } from "@supabase/supabase-js";
import {
  generateAttendanceQrSvg,
  generateRandomEmployeeCode,
  isValidEmployeeCode,
  normalizeEmployeeCode,
} from "./attendanceQr";
import { isEmployerRole } from "./roles";

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

async function getUniqueEmployerProfileByCode(employerCode) {
  const safeEmployerCode = String(employerCode ?? "").trim().toUpperCase();
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("auth_id, first_name, last_name, email, role, department, employer_code")
    .eq("employer_code", safeEmployerCode)
    .limit(2);

  if (error) throw error;

  const matches = (data ?? []).filter(
    (profile) => profile?.auth_id && isEmployerRole(profile.role),
  );

  if (matches.length === 0) {
    return { profile: null, error: "Employer code was not found." };
  }

  if (matches.length > 1) {
    return {
      profile: null,
      error:
        "This employer code is assigned to multiple accounts. Please contact the system administrator for a new employer invite code.",
    };
  }

  return { profile: matches[0], error: null };
}

// Sign in function that authenticates user and fetches their account data
export const signIn = async (username, password) => {
  const normalizedEmail = String(username ?? "").trim().toLowerCase();
  const safePassword = String(password ?? "");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: safePassword,
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

  if (isEmployerRole(userAccount.role)) {
    userAccount.role = "Employer";
  }

  return {
    success: true,
    user: data.user,
    account: userAccount
  };
};

// Account creation


export const createUser = async ({
  first_name,
  last_name,
  email,
  password,
  role,
  employee_code,
}) => {
  try {
    const safeEmail = (email ?? "").trim();
    const safePassword = password ?? "";
    const normalizedEmployeeCode = normalizeEmployeeCode(employee_code);

    if (!safeEmail) return { success: false, error: "Email is required" };
    if (!safePassword) return { success: false, error: "Password is required" };
    if (employee_code && !isValidEmployeeCode(normalizedEmployeeCode)) {
      return {
        success: false,
        error: "Employee ID must be exactly 7 digits.",
      };
    }

    let resolvedEmployeeCode = normalizedEmployeeCode;
    if (!resolvedEmployeeCode) {
      for (let index = 0; index < 20; index += 1) {
        const candidate = generateRandomEmployeeCode();
        const { data: existingProfile, error: existingProfileError } =
          await supabaseAdmin
            .from("user_profiles")
            .select("auth_id")
            .eq("employee_code", candidate)
            .maybeSingle();

        if (existingProfileError) throw existingProfileError;
        if (!existingProfile?.auth_id) {
          resolvedEmployeeCode = candidate;
          break;
        }
      }
    } else {
      const { data: existingProfile, error: existingProfileError } =
        await supabaseAdmin
          .from("user_profiles")
          .select("auth_id")
          .eq("employee_code", resolvedEmployeeCode)
          .maybeSingle();

      if (existingProfileError) throw existingProfileError;
      if (existingProfile?.auth_id) {
        return {
          success: false,
          error: "Employee ID already exists. Use a different 7-digit value.",
        };
      }
    }

    if (!resolvedEmployeeCode) {
      throw new Error("Unable to generate a unique employee ID.");
    }

    const qrRecord = await generateAttendanceQrSvg(resolvedEmployeeCode);

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
          employee_code: qrRecord.employeeCode,
          attendance_qr_payload: qrRecord.payload,
          attendance_qr_svg: qrRecord.svg,
        },
      ]);
    if (profileError) throw profileError;

    return {
      success: true,
      user: data?.user ?? data,
      profile: {
        auth_id: authUserId,
        first_name,
        last_name,
        email: safeEmail,
        role: role || "Employee",
        employee_code: qrRecord.employeeCode,
        attendance_qr_payload: qrRecord.payload,
        attendance_qr_svg: qrRecord.svg,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const signUpEmployeeWithEmployerCode = async ({
  first_name,
  last_name,
  email,
  password,
  employer_code,
}) => {
  try {
    const safeEmail = String(email ?? "").trim().toLowerCase();
    const safePassword = String(password ?? "");
    const safeEmployerCode = String(employer_code ?? "").trim().toUpperCase();

    if (!safeEmail) return { success: false, error: "Email is required" };
    if (!safePassword) return { success: false, error: "Password is required" };
    if (!safeEmployerCode) {
      return { success: false, error: "Employer code is required" };
    }

    const { profile: employerProfile, error: employerLookupError } =
      await getUniqueEmployerProfileByCode(safeEmployerCode);

    if (employerLookupError) {
      return { success: false, error: employerLookupError };
    }

    const { data, error } = await supabase.auth.signUp({
      email: safeEmail,
      password: safePassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const authUserId = data.user?.id;
    if (!authUserId) {
      return { success: false, error: "Created auth user id not found" };
    }

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert([
        {
          auth_id: authUserId,
          first_name,
          last_name,
          email: safeEmail,
          role: "Employee",
          department: employerProfile.department ?? null,
          employer_auth_id: employerProfile.auth_id,
          employer_code: employerProfile.employer_code ?? safeEmployerCode,
        },
      ]);

    if (profileError) throw profileError;

    return {
      success: true,
      user: data.user,
      employer: employerProfile,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getEmployerByCode = async (employerCode) => {
  try {
    const safeEmployerCode = String(employerCode ?? "").trim().toUpperCase();
    if (!safeEmployerCode) {
      return { success: false, error: "Employer code is required." };
    }

    const { profile: data, error } = await getUniqueEmployerProfileByCode(
      safeEmployerCode,
    );

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
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
