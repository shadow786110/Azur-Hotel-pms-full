import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    clients: 0,
    rooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    dirtyRooms: 0,
    reservations: 0,
    expenses: 0,
    invoices: 0
  });
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(profileData || null);

    const [
      { count: clients },
      { data: roomsData },
      { count: reservationsCount },
      { count: expenses },
      { count: invoices },
      { data: reservationRows }
    ] = await Promise.all([
      supabase.from("clients_pms").select("*", { count: "exact", head: true }),
      supabase.from("rooms").select("*").order("room_number", { ascending: true }),
      supabase.from("reservations_pms").select("*", { count: "exact", head: true }),
      supabase.from("expenses_pms").select("*", { count: "exact", head: true }),
      supabase.from("invoices_pms").select("*", { count: "exact", head: true }),
      supabase
        .from("reservations_pms")
        .select("*, clients_pms(id, nom), rooms(id, room_number)")
        .order("check_in", { ascending: true })
    ]);

    const roomList = roomsData || [];
    setRooms(roomList);
    setReservations(reservationRows || []);

    setStats({
      clients: clients || 0,
      rooms: roomList.length,
      availableRooms: roomList.filter((r) => r.status === "available").length,
      occupiedRooms: roomList.filter((r) => r.status === "occupied").length,
      dirtyRooms: roomList.filter((r) => r.status === "dirty").length,
      reservations: reservationsCount || 0,
      expenses: expenses || 0,
      invoices: invoices || 0
    });
  }

  const cards = [
    { title: "Clients", value: stats.clients },
    { title: "Chambres", value: stats.rooms },
    { title: "Chambres libres", value: stats.availableRooms },
    { title: "Chambres occupées", value: stats.occupiedRooms },
    { title: "Chambres sales", value: stats.dirtyRooms },
    { title: "Réservations", value: stats.reservations },
    { title: "Dépenses", value: stats.expenses },
    { title: "Factures", value: stats.invoices }
  ];

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  function reservationFor(roomId, day) {
    const date = new Date(year, month, day);
    return reservations.find((r) => {
      if (Number(r.room_id) !== Number(roomId)) return false;
      const checkIn = new Date(r.check_in);
      const checkOut = new Date(r.check_out);
      return date >= checkIn && date < checkOut;
    });
  }

  return (
    <Layout title="Dashboard" profile={profile}>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        {cards.map((card) => (
          <div className="stat-card" key={card.title}>
            <div className="label">{card.title}</div>
            <div className="value">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="section-title">Planning mensuel des chambres</h2>
        <div className="helper" style={{ marginBottom: 12 }}>
          Vue du mois en cours. Chaque case affiche le client du jour dans la chambre.
        </div>

        <div className="table-wrap">
          <table className="table" style={{ minWidth: 1400 }}>
            <thead>
              <tr>
                <th>Chambre</th>
                {days.map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td>
                    <strong>{room.room_number}</strong>
                    <br />
                    <span className="helper">{room.room_type || "-"}</span>
                  </td>
                  {days.map((day) => {
                    const r = reservationFor(room.id, day);
                    return (
                      <td key={day}>
                        {r ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{r.clients_pms?.nom || "-"}</div>
                            <div className="helper" style={{ fontSize: 11 }}>
                              {r.status}
                            </div>
                          </div>
                        ) : (
                          ""
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
