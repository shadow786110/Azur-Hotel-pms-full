export default function Login() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Connexion</h1>
      <p>Page login Azur Hotel PMS</p>

      <form style={{ maxWidth: 320 }}>
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Nom d'utilisateur"
            style={{ width: "100%", padding: 10 }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <input
            type="password"
            placeholder="Mot de passe"
            style={{ width: "100%", padding: 10 }}
          />
        </div>
        <button type="button">Se connecter</button>
      </form>
    </div>
  );
}
