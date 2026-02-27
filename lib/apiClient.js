import { supabase } from '@/lib/supabaseClient';
export async function apiFetch(url, options={}){ const { data } = await supabase.auth.getSession(); const token=data.session?.access_token; const headers={...(options.headers||{}), 'Content-Type':'application/json'}; if(token) headers['Authorization']=`Bearer ${token}`; return fetch(url,{...options,headers}); }
