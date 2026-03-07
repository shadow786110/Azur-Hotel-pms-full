import Link from "next/link";

export default function Home() {
  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1>Azur Hotel PMS</h1>
      <p>Système de gestion hôtel</p>

      <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
        <Link href="/login">
          <button style={{ padding: "12px 18px", cursor: "pointer" }}>
            Connexion
          </button>
        </Link>

        <Link href="/dashboard">
          <button style={{ padding: "12px 18px", cursor: "pointer" }}>
            Accéder au PMS
          </button>
        </Link>
      </div>
    </div>
  );
}
