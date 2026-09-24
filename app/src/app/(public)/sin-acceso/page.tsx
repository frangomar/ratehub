import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin acceso" };

export default function SinAccesoPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">Sin acceso</h1>
        <p className="text-sm text-neutral-600">
          Tu cuenta no tiene acceso a ninguna organización. Si esperabas una
          invitación, escribinos a{" "}
          <a
            href="mailto:hola@ratehub.com.ar"
            className="text-brand-600 underline underline-offset-2"
          >
            hola@ratehub.com.ar
          </a>
          .
        </p>
      </div>
    </main>
  );
}
