import { supabase } from "./supabase";


// Sign in function that authenticates user and fetches their account data
export const signIn = async (username, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: username,
    password: password,
  });

  if (error) {
    console.error('Error signing in:', error.message);
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
    console.error('Error fetching user account:', errorAccount.message);
    return { success: false, error: errorAccount.message };
  }

  if (!userAccount) {
    return { success: false, error: 'User account not found' };
  }

  console.log('User account data from table:', userAccount);
  console.log('Auth data:', data);

  return {
    success: true,
    user: data.user,
    account: userAccount
  };
};

// Fetch current user who are logged in

export const getCurrentUser = async (id) => {
	const { data, error } = await supabase.from('user_profiles').select("*").eq('auth_id', id).maybeSingle();

	return { data, error };
}

export const signOut = async () => {	
	const { error } = await supabase.auth.signOut();
	if (error) {
		console.error('Error signing out:', error.message);
		return { success: false, error: error.message };
	}
	return { success: true };
}