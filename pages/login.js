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
      data: { session },
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
      password,
    });

    if (error) {
      setMessage("Erreur connexion : " + error.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          maxWidth: 420,
          margin: "40px auto",
          background: "white",
          padding: 24,
          borderRadius: 12,
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        }}
      >
        <h1>Connexion PMS</h1>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 10 }}
              required
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 10 }}
              required
            />
          </div>

          <button type="submit" style={{ padding: "10px 16px", cursor: "pointer" }} disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 12, color: "red" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
