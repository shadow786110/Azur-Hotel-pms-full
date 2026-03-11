import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      router.replace("/dashboard");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage("Erreur connexion : " + error.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <img className="auth-logo" src="/logo-azur-hotel.jpg" alt="Azur Hotel" />
        <h1 className="auth-title">Azur Hotel PMS</h1>
        <p className="auth-sub">Connexion sécurisée</p>

        <form onSubmit={handleLogin} className="form-grid">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        {message && <p style={{ color: "#d92d20", marginTop: 14 }}>{message}</p>}
      </div>
    </div>
  );
}
