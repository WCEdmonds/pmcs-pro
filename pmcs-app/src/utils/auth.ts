import { supabase } from './supabase';

function dodIdToEmail(dodId: string): string {
  return `${dodId}@id.pmcspro.app`;
}

export async function supabaseSignUp(dodId: string, pin: string, profile: {
  rank: string;
  last_name: string;
  first_name: string;
  mi: string;
  unit: string;
}) {
  const { data, error } = await supabase.functions.invoke('signup', {
    body: { dod_id: dodId, pin, ...profile },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  await supabaseSignIn(dodId, pin);
  return data;
}

export async function supabaseSignIn(dodId: string, pin: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: dodIdToEmail(dodId),
    password: pin,
  });
  if (error) throw error;
  return data;
}

export async function supabaseSignOut() {
  await supabase.auth.signOut();
}

export async function getSupabaseProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return data;
}

export async function checkDodIdExists(dodId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_dod_id_exists', { p_dod_id: dodId });
  if (error) return false;
  return data === true;
}

export async function getSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
