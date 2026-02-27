import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/pages/_app";

export default function Layout({ children }) {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const links = [
    ["/", "Tableau"],
    ["/clients", "Clients"],
    ["/reservations", "Réservations"],
    ["/documents", "Devis/Factures"],
    ["/expenses", "Dépenses"],
  ];
  if (profile?.role === "admin") links.push(["/admin", "Admin"]);

  return (
    <div className="container">
      <div className="row" style={{alignItems:"center", justifyContent:"space-between"}}>
        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          <div className="badge" style={{background:"#2563eb", color:"#fff"}}>A</div>
          <div>
            <div style={{fontWeight:900}}>Azur Hôtel PMS</div>
            <div className="small">Next.js + Supabase</div>
          </div>
        </div>
        <div className="small">
          {profile ? (
            <>
              <span className="badge">{profile.role}</span>{" "}
              {profile.username}{" "}
              <button className="ghost" style={{marginLeft:10}} onClick={async()=>{ await signOut(); router.push("/login"); }}>
                Déconnexion
              </button>
            </>
          ) : null}
        </div>
      </div>

      <nav>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={router.pathname === href ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
