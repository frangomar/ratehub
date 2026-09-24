import { redirect } from "next/navigation";

// Fase 2 implementará la lógica completa:
// sesión activa + staff → /admin
// sesión activa + org  → /o/[slug]
// sin sesión           → /login
export default function RootPage() {
  redirect("/login");
}
