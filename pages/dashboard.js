import { useEffect, useState } from "react";
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
    checkedIn: 0,
    checkedOut: 0,
    expenses: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const userId = session.user.id;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setProfile(profileData || null);

    const [
      { count: clients },
      { data: roomsData },
      { count: reservations },
      { count: checkedIn },
      { count: checkedOut },
      { count: expenses },
    ] = await Promise.all([
      supabase.from("clients_pms").select("*", { count: "exact", head: true }),
      supabase.from("rooms").select("*"),
      supabase.from("reservations_pms").select("*", { count: "exact", head: true }),
      supabase.from("reservations_pms").select("*", { count: "exact", head: true }).eq("status", "checked_in"),
      supabase.from("reservations_pms").select("*", { count: "exact", head: true }).eq("status", "checked_out"),
      supabase.from("expenses_pms").select("*", { count: "exact", head: true }),
    ]);

    const rooms = roomsData || [];

    setStats({
      clients: clients || 0,
      rooms: rooms.length,
      availableRooms: rooms.filter((r) => r.status === "available").length,
      occupiedRooms: rooms.filter((r) => r.status === "occupied").length,
      dirtyRooms: rooms.filter((r) => r.status === "dirty").length,
      reservations: reservations || 0,
      checkedIn: checkedIn || 0,
      checkedOut: checkedOut || 0,
      expenses: expenses || 0,
    });
  }

  const cards = [
    { title: "Clients", value: stats.clients },
    { title: "Chambres", value: stats.rooms },
    { title: "Chambres libres", value: stats.availableRooms },
    { title: "Chambres occupées", value: stats.occupiedRooms },
    { title: "Chambres sales", value: stats.dirtyRooms },
    { title: "Réservations", value: stats.reservations },
    { title: "Check-in", value: stats.checkedIn },
    { title: "Check-out", value: stats.checkedOut },
    { title: "Dépenses", value: stats.expenses },
  ];

  return (
    <Layout title="Dashboard" profile={profile}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: 18,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>{card.title}</h3>
            <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: "bold" }}>{card.value}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}
