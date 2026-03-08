import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [clients, setClients] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [form, setForm] = useState({
    client_id: "",
    room_id: "",
    check_in: "",
    check_out: "",
    adults: 1,
    children: 0,
    status: "pending",
    source: "",
    total_amount: "",
    paid_amount: "",
    notes: "",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    await Promise.all([fetchReservations(), fetchClients(), fetchRooms()]);
  }

  async function fetchReservations() {
    const { data, error } = await supabase
      .from("reservations_pms")
      .select(`
        *,
        clients_pms ( id, nom ),
        rooms ( id, room_number, room_type )
      `)
      .order("id", { ascending: false });

    if (!error) setReservations(data || []);
  }

  async function fetchClients() {
    const { data, error } = await supabase
      .from("clients_pms")
      .select("*")
      .order("nom", { ascending: true });

    if (!error) setClients(data || []);
  }

  async function fetchRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("room_number", { ascending: true });

    if (!error) setRooms(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("reservations_pms").insert([
      {
        client_id: Number(form.client_id),
        room_id: Number(form.room_id),
        check_in: form.check_in,
        check_out: form.check_out,
        adults: Number(form.adults),
        children: Number(form.children),
        status: form.status,
        source: form.source,
        total_amount: Number(form.total_amount || 0),
        paid_amount: Number(form.paid_amount || 0),
        notes: form.notes,
      },
    ]);

    if (error) {
      alert("Erreur réservation: " + error.message);
      return;
    }

    if (form.status === "checked_in") {
      await supabase
        .from("rooms")
        .update({ status: "occupied" })
        .eq("id", Number(form.room_id));
    }

    alert("Réservation ajoutée");

    setForm({
      client_id: "",
      room_id: "",
      check_in: "",
      check_out: "",
      adults: 1,
      children: 0,
      status: "pending",
      source: "",
      total_amount: "",
      paid_amount: "",
      notes: "",
    });

    fetchAll();
  }

  async function updateReservationStatus(reservation, newStatus) {
    const { error } = await supabase
      .from("reservations_pms")
      .update({ status: newStatus })
      .eq("id", reservation.id);

    if (error) {
      alert("Erreur statut réservation: " + error.message);
      return;
    }

    if (newStatus === "checked_in") {
      await supabase
        .from("rooms")
        .update({ status: "occupied" })
        .eq("id", reservation.room_id);
    }

    if (newStatus === "checked_out") {
      await supabase
        .from("rooms")
        .update({ status: "dirty" })
        .eq("id", reservation.room_id);
    }

    if (newStatus === "cancelled") {
      await supabase
        .from("rooms")
        .update({ status: "available" })
        .eq("id", reservation.room_id);
    }

    fetchAll();
  }

  return (
    <Layout title="Réservations">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Nouvelle réservation</h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 620 }}>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              required
            >
              <option value="">Choisir un client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nom}
                </option>
              ))}
            </select>

            <select
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              required
            >
              <option value="">Choisir une chambre</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} - {room.room_type} ({translateRoomStatus(room.status)})
                </option>
              ))}
            </select>

            <input
              type="date"
              value={form.check_in}
              onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              required
            />

            <input
              type="date"
              value={form.check_out}
              onChange={(e) => setForm({ ...form, check_out: e.target.value })}
              required
            />

            <input
              type="number"
              placeholder="Adultes"
              value={form.adults}
              onChange={(e) => setForm({ ...form, adults: e.target.value })}
            />

            <input
              type="number"
              placeholder="Enfants"
              value={form.children}
              onChange={(e) => setForm({ ...form, children: e.target.value })}
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="checked_in">Check-in direct</option>
              <option value="cancelled">Annulée</option>
            </select>

            <input
              type="text"
              placeholder="Source (walk-in, booking, téléphone...)"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />

            <input
              type="number"
              placeholder="Montant total"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
            />

            <input
              type="number"
              placeholder="Montant payé"
              value={form.paid_amount}
              onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
            />

            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <button type="submit">Enregistrer</button>
          </form>
        </div>

        <div>
          <h2>Liste des réservations</h2>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={th}>Client</th>
                <th style={th}>Chambre</th>
                <th style={th}>Arrivée</th>
                <th style={th}>Départ</th>
                <th style={th}>Statut</th>
                <th style={th}>Montant</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td style={td}>{reservation.clients_pms?.nom || "-"}</td>
                  <td style={td}>{reservation.rooms?.room_number || "-"}</td>
                  <td style={td}>{reservation.check_in}</td>
                  <td style={td}>{reservation.check_out}</td>
                  <td style={td}>{translateReservationStatus(reservation.status)}</td>
                  <td style={td}>
                    {reservation.paid_amount} / {reservation.total_amount}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => updateReservationStatus(reservation, "confirmed")}>
                        Confirmer
                      </button>
                      <button onClick={() => updateReservationStatus(reservation, "checked_in")}>
                        Check-in
                      </button>
                      <button onClick={() => updateReservationStatus(reservation, "checked_out")}>
                        Check-out
                      </button>
                      <button onClick={() => updateReservationStatus(reservation, "cancelled")}>
                        Annuler
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function translateRoomStatus(status) {
  if (status === "available") return "Libre";
  if (status === "occupied") return "Occupée";
  if (status === "dirty") return "Sale";
  if (status === "maintenance") return "Maintenance";
  if (status === "blocked") return "Bloquée";
  return status;
}

function translateReservationStatus(status) {
  if (status === "pending") return "En attente";
  if (status === "confirmed") return "Confirmée";
  if (status === "checked_in") return "Check-in";
  if (status === "checked_out") return "Check-out";
  if (status === "cancelled") return "Annulée";
  return status;
}

const th = { border: "1px solid #ddd", padding: 10, textAlign: "left" };
const td = { border: "1px solid #ddd", padding: 10 };
