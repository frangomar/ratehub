import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clientEnv, serverEnv } from "@/lib/env";

// Cliente con service role. Solo accesible desde el servidor.
// NUNCA pasar al cliente ni usar para lecturas que el usuario puede hacer con su sesión.
// Cada función que lo use debe validar autorización primero (requireOrgRole / requireStaff / CRON_SECRET).
export function createAdminClient() {
  const env = serverEnv();
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
