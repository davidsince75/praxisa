import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";

function roleBasedHome(role: string): string {
  if (role === "admin") return "/";
  if (role === "instructor") return "/teacher/courses";
  return "/learn/catalog";
}

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user !== null) {
    return <Navigate to={roleBasedHome(user.role)} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // Re-render will trigger <Navigate> above based on role
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-white text-2xl font-bold tracking-tight">
            Psycho<span className="text-teal">study</span>
          </h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
            Administration
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-teal"
              placeholder="admin@psychostudy.fr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-teal"
            />
          </div>

          {error !== null && (
            <p className="text-xs text-rose font-medium">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
