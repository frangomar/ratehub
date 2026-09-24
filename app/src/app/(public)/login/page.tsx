import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ingresá" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">RateHub</h1>
          <p className="text-sm text-neutral-500">
            El acceso a RateHub es por invitación.
          </p>
        </div>
        {/* Fase 2: magic link + "Continuar con Google" */}
        <p className="text-center text-xs text-neutral-400">
          Autenticación disponible en Fase 2.
        </p>
      </div>
    </main>
  );
}
