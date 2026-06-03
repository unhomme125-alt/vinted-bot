import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "@/api/client.js";
import { AuthComponent, type AuthMode } from "@/components/ui/sign-up";

// Page d'authentification unique (connexion + inscription) basée sur la primitive
// shadcn AuthComponent. La logique métier reste ici : selon le mode, on appelle
// /auth/login ou /auth/register. L'email saisi sert de `username` côté backend.
export default function Auth({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const handleSubmit = useCallback(async (email: string, password: string) => {
    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
    const data = await post(endpoint, { username: email, password });
    localStorage.setItem("token", data.token);
  }, [mode]);

  const handleSuccess = useCallback(() => navigate("/home"), [navigate]);

  return (
    <AuthComponent
      brandName="Vinted Bot"
      mode={mode}
      onModeChange={setMode}
      onSubmit={handleSubmit}
      onSuccess={handleSuccess}
    />
  );
}
