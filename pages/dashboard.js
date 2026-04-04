import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();

  const [stats, setStats] = useState({
    rooms: 0,
    occupied: 0,
    available: 0,
    todayCA: 0
  });

  const [todayReservations, setTodayReservations] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: rooms }, { data: res }, { data: invoices }] =
      await Promise.all([
        supabase.from("rooms").select("*"),
        supabase
          .from("reservations_pms")
          .select("*, clients_pms(nom), rooms(room_number)")
          .lte("check_in", today)
          .gt("check_out", today),
        supabase.from("invoices_pms").select("*")
      ]);

    const todayCA = (invoices || [])
      .filter((i) => (i.created_at || "").slice(0, 10) === today)
      .reduce((a, b) => a + Number(b.paid_amount || 0), 0);

    setStats({
      rooms: rooms.length,
      occupied: res.length,
      available: rooms.length - res.length,
      todayCA
    });

    setTodayReservations(res || []);
  }

  return (
    <Layout title="Accueil PMS">

      {/* ACTION RAPIDE */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <button className="btn" onClick={() => router.push("/reservations")}>
          ➕ Nouvelle réservation
        </button>

        <button className="btn" onClick={() => router.push("/invoices")}>
          💳 Nouvelle facture
        </button>

        <button className="btn" onClick={() => router.push("/planning")}>
          🗓 Voir planning
        </button>

        <button className="btn" onClick={() => router.push("/clients")}>
          👤 Clients
        </button>
      </div>

      {/* STATS RAPIDES */}
      <div className="grid grid-4">
        <div className="stat-card">
          <div className="label">Chambres</div>
          <div className="value">{stats.rooms}</div>
        </div>

        <div className="stat-card">
          <div className="label">Occupées</div>
          <div className="value">{stats.occupied}</div>
        </div>

        <div className="stat-card">
          <div className="label">Disponibles</div>
          <div className="value">{stats.available}</div>
        </div>

        <div className="stat-card">
          <div className="label">CA du jour</div>
          <div className="value">{stats.todayCA.toFixed(2)} €</div>
        </div>
      </div>

      {/* ARRIVÉES DU JOUR */}
      <div className="card" style={{ marginTop: 20 }}>
        <h2>Clients présents aujourd’hui</h2>

        {todayReservations.map((r) => (
          <div
            key={r.id}
            style={{
              padding: 10,
              marginBottom: 8,
              borderRadius: 10,
              background: "#f1f5f9",
              display: "flex",
              justifyContent: "space-between"
            }}
          >
            <div>
              <strong>{r.clients_pms?.nom}</strong>
              <br />
              Chambre {r.rooms?.room_number}
            </div>

            <div>
              {r.check_in} → {r.check_out}
            </div>
          </div>
        ))}
      </div>

    </Layout>
  );
}
