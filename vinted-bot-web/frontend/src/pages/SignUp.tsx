import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "@/api/client.js";
import { AuthComponent } from "@/components/ui/sign-up";

// Page d'inscription "premium" basée sur la primitive shadcn AuthComponent.
// La logique métier reste ici (la primitive ne fait qu'appeler onSubmit) :
// l'email saisi sert de `username` côté backend (POST /api/auth/register).
export default function SignUp() {
  const navigate = useNavigate();

  const handleSubmit = useCallback(async (email: string, password: string) => {
    const data = await post("/auth/register", { username: email, password });
    localStorage.setItem("token", data.token);
  }, []);

  const handleSuccess = useCallback(() => navigate("/home"), [navigate]);

  return (
    <AuthComponent
      brandName="Vinted Bot"
      onSubmit={handleSubmit}
      onSuccess={handleSuccess}
    />
  );
}
