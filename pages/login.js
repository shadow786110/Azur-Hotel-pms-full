import { useState } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  function handleLogin(e) {
    e.preventDefault();

    if (pseudo === "admin" && password === "admin123") {
      setMessage("Connexion réussie");
      setTimeout(() => router.push("/dashboard"), 500);
    } else {
      setMessage("Identifiants invalides");
    }
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
        <h1>Connexion</h1>
        <p>Pseudo : admin | Mot de passe : admin123</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Pseudo"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <button type="submit" style={{ padding: "10px 16px", cursor: "pointer" }}>
            Se connecter
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 12, color: message.includes("réussie") ? "green" : "red" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
