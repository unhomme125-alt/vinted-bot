import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "@/api/client.js";
import { Component as AnimatedAuth, type AuthMode } from "@/components/ui/animated-characters-login-page";

// Page d'authentification unique (connexion + inscription) basée sur la page à
// personnages animés (components/ui). La logique métier reste ici : selon le mode,
// on appelle /auth/login ou /auth/register avec { username, password }.
export default function Auth({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const handleSubmit = useCallback(async (username: string, password: string) => {
    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
    const data = await post(endpoint, { username, password });
    localStorage.setItem("token", data.token);
  }, [mode]);

  const handleSuccess = useCallback(() => navigate("/home"), [navigate]);

  return (
    <AnimatedAuth
      brandName="Vinted Bot"
      mode={mode}
      onModeChange={setMode}
      onSubmit={handleSubmit}
      onSuccess={handleSuccess}
    />
  );
}
