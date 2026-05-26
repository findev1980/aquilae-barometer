import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { LogIn, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { language } = useBarometerStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const MIN_PASSWORD = 15;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError(language === "nl" ? "Vul je e-mailadres in" : "Entrez votre adresse e-mail");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(
        language === "nl"
          ? `Wachtwoord moet minstens ${MIN_PASSWORD} tekens bevatten`
          : `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères`
      );
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (authError) {
      setError(
        language === "nl"
          ? "Ongeldige inloggegevens"
          : "Identifiants invalides"
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-[0.18em] text-primary">
            AQUILAE
          </h1>
          <p className="mt-2 text-sm font-medium text-foreground">
            Barometer
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === "nl" ? "Meld je aan om verder te gaan" : "Connectez-vous pour continuer"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
              {language === "nl" ? "E-mailadres" : "Adresse e-mail"}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
              placeholder="naam@voorbeeld.be"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
              {language === "nl" ? "Wachtwoord" : "Mot de passe"}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
                placeholder={`Min. ${MIN_PASSWORD} ${language === "nl" ? "tekens" : "caractères"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {language === "nl" ? "Aanmelden" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
