import Link from "next/link";
import { useRouter } from "next/router";

export default function Layout({ children, title = "Azur Hotel PMS" }) {
  const router = useRouter();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/reservations", label: "Réservations" },
    { href: "/expenses", label: "Dépenses" },
    { href: "/invoices", label: "Factures" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <aside
        style={{
          width: "240px",
          background: "#111827",
          color: "white",
          padding: "20px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Azur Hotel PMS</h2>
        <p style={{ fontSize: "13px", color: "#cbd5e1" }}>Panneau de gestion hôtel</p>

        <nav style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "25px" }}>
          {links.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: "white",
                  background: active ? "#2563eb" : "transparent",
                  border: active ? "none" : "1px solid #374151",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "30px" }}>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: "8px",
              textDecoration: "none",
              color: "white",
              background: "#dc2626",
            }}
          >
            Déconnexion
          </Link>
        </div>
      </aside>

      <main style={{ flex: 1, background: "#f3f4f6", padding: "30px" }}>
        <div
          style={{
            background: "white",
            borderRadius: "14px",
            padding: "20px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ marginTop: 0 }}>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
