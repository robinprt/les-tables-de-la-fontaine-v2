const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("Missing environment variable: SUPABASE_URL");
}

/**
 * Retourne une instance du client Supabase
 * @param {boolean} useServiceRole Si true, utilise la clé de rôle de service (contourne la RLS)
 */
const getClient = (useServiceRole = false) => {
  const key = useServiceRole ? supabaseServiceKey : supabaseAnonKey;
  if (!key) {
    console.error(`Missing environment variable: ${useServiceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY'}`);
  }
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

module.exports = {
  getClient,
  supabaseUrl,
  supabaseAnonKey
};
