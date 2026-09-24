import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_GBP_CLIENT_ID: z.string().min(1),
  GOOGLE_GBP_CLIENT_SECRET: z.string().min(1),
  GOOGLE_GBP_REDIRECT_URI: z.string().url(),
  ENABLE_GOOGLE_PROVIDER: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  ENABLE_MOCK_PROVIDER: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  DERIVED_METRICS_ENABLED: z
    .string()
    .transform((v) => v !== "false")
    .default("true"),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  TOKEN_ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  CRON_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1).default("RateHub <hola@send.ratehub.com.ar>"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

function parseEnv() {
  const clientResult = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!clientResult.success) {
    throw new Error(
      `Variables de entorno públicas inválidas:\n${clientResult.error.toString()}`
    );
  }

  return clientResult.data;
}

function parseServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Variables de entorno del servidor inválidas:\n${result.error.toString()}`
    );
  }
  return result.data;
}

export const clientEnv = parseEnv();

// Las variables de servidor se parsean en tiempo de ejecución, no en el módulo top-level,
// para que el bundle del cliente no las incluya accidentalmente.
export function serverEnv() {
  return parseServerEnv();
}
