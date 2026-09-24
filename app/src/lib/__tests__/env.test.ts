import { describe, it, expect, beforeEach, vi } from "vitest";

describe("env validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("clientEnv falla si faltan variables públicas requeridas", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(import("@/lib/env")).rejects.toThrow(
      "Variables de entorno públicas inválidas"
    );

    vi.unstubAllEnvs();
  });

  it("clientEnv se parsea correctamente con variables válidas", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.ratehub.com.ar");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

    const { clientEnv } = await import("@/lib/env");
    expect(clientEnv.NEXT_PUBLIC_APP_URL).toBe("https://app.ratehub.com.ar");
    expect(clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");

    vi.unstubAllEnvs();
  });
});
