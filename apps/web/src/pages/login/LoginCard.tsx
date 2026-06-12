import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { cn } from "@/lib/utils.js";

interface LoginCardProps {
  onLogin: (email: string, password: string) => Promise<void>;
  className?: string;
}

const FIELD_CLASSES =
  "border-white/35 bg-white/[0.06] text-white placeholder:text-white/55 transition-colors duration-300 hover:border-white/60 focus:border-teal-light";

/**
 * La « figure » sur le « fond » (clin d'œil à la Gestalt) : carte sombre
 * posée sur le papier crème, ombre décalée sable, tracé EEG qui se
 * dessine à l'ouverture.
 */
export function LoginCard({ onLogin, className }: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
      // La redirection est gérée par <Navigate> dans la page parente.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects");
      setLoading(false);
    }
  }

  return (
    <section
      id="connexion"
      aria-labelledby="connexion-titre"
      className={cn(
        "relative scroll-mt-28 border border-white/10 bg-dark p-8 text-white shadow-[12px_12px_0_0_#C8A97C] sm:p-10",
        className,
      )}
    >
      <svg
        viewBox="0 0 220 14"
        className="h-3.5 w-44 text-teal-light"
        aria-hidden="true"
      >
        <path
          d="M0 7 H30 L38 7 L44 2 L51 12 L57 7 H88 L96 7 L102 3.5 L108 10.5 L114 7 H146 L154 7 L160 4 L166 10 L172 7 H220"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={300}
          strokeDasharray={300}
          className="animate-eeg"
        />
      </svg>

      <h2
        id="connexion-titre"
        className="mt-5 font-display text-2xl tracking-tight text-white sm:text-3xl"
      >
        Ouvrir la session
      </h2>
      <p className="mt-2 text-sm text-white/75">
        Apprenants, formateurs et administration — chacun sa porte, la même clé.
      </p>

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-8 space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/90">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className={FIELD_CLASSES}
            placeholder="prenom@psychostudy.fr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/90">
            Mot de passe
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              className={cn(FIELD_CLASSES, "pr-12")}
            />
            <button
              type="button"
              onClick={() => {
                setShowPassword((visible) => !visible);
              }}
              aria-label={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/70 transition-colors duration-200 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {error !== null && (
          <p role="alert" className="text-sm font-medium text-rose-light">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="group w-full transition-all duration-300 hover:shadow-[0_6px_24px_rgba(143,176,212,0.25)]"
        >
          {loading ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Connexion…
            </>
          ) : (
            <>
              Se connecter
              <ArrowRight
                className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-white/70">
        Pas encore de compte&nbsp;? Testez votre formation pendant 30
        jours&nbsp;— inscriptions permanentes auprès de votre établissement.
      </p>
    </section>
  );
}
