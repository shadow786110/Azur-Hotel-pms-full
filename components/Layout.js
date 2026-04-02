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
  { href: "/planning", label: "Planning" },
  { href: "/expenses", label: "Dépenses" },
  { href: "/quotes", label: "Devis" },
  { href: "/invoices", label: "Factures" },
  { href: "/stock", label: "Stock" },
  { href: "/caisse", label: "Caisse" }
];
  return (
    <div className="page-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <img src="/logo-azur-hotel.jpg" alt="Azur Hotel" />
          <div>
            <p className="brand-title">Azur Hotel</p>
            <div className="brand-sub">PMS Professionnel</div>
          </div>
        </div>

        <div className="user-pill">
          <strong>{profile?.full_name || profile?.email || "Utilisateur"}</strong>
          <span>{profile?.role || "PMS Hôtel"}</span>
        </div>

        <nav className="nav-menu">
          {links.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          Déconnexion
        </button>
      </aside>

      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="page-title">{title}</h1>
            <div className="page-subtitle">Gestion complète Azur Hotel</div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
