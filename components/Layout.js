import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Layout({ children, title = "Azur Hotel PMS", profile }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/rooms", label: "Chambres" },
    { href: "/reservations", label: "Réservations" },
    { href: "/expenses", label: "Dépenses" },
    { href: "/quotes", label: "Devis" },
    { href: "/invoices", label: "Factures" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <aside style={{ width: 260, background: "#0f172a", color: "white", padding: 20 }}>
        <h2>Azur Hotel PMS</h2>
        <p style={{ fontSize: 13, color: "#cbd5e1" }}>
          {profile ? `${profile.full_name || profile.email} • ${profile.role}` : "PMS Hôtel"}
        </p>

        <nav style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 25 }}>
          {links.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "white",
                  background: active ? "#2563eb" : "transparent",
                  border: active ? "none" : "1px solid #334155",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            marginTop: 24,
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            background: "#dc2626",
            color: "white",
            cursor: "pointer",
          }}
        >
          Déconnexion
        </button>
      </aside>

      <main style={{ flex: 1, background: "#f1f5f9", padding: 30 }}>
        <div style={{ background: "white", borderRadius: 14, padding: 20 }}>
          <h1 style={{ marginTop: 0 }}>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
