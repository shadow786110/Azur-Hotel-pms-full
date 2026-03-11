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
    expenses: 0,
    invoices: 0
  });

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
      { count: reservations },
      { count: expenses },
      { count: invoices }
    ] = await Promise.all([
      supabase.from("clients_pms").select("*", { count: "exact", head: true }),
      supabase.from("rooms").select("*"),
      supabase.from("reservations_pms").select("*", { count: "exact", head: true }),
      supabase.from("expenses_pms").select("*", { count: "exact", head: true }),
      supabase.from("invoices_pms").select("*", { count: "exact", head: true })
    ]);

    const rooms = roomsData || [];

    setStats({
      clients: clients || 0,
      rooms: rooms.length,
      availableRooms: rooms.filter((r) => r.status === "available").length,
      occupiedRooms: rooms.filter((r) => r.status === "occupied").length,
      dirtyRooms: rooms.filter((r) => r.status === "dirty").length,
      reservations: reservations || 0,
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

  return (
    <Layout title="Dashboard" profile={profile}>
      <div className="grid grid-4">
        {cards.map((card) => (
          <div className="stat-card" key={card.title}>
            <div className="label">{card.title}</div>
            <div className="value">{card.value}</div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
