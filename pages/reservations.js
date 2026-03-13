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
    notes: ""
  });

  const [moveForm, setMoveForm] = useState({
    reservation_id: "",
    new_room_id: "",
    note: ""
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    await Promise.all([fetchReservations(), fetchClients(), fetchRooms()]);
  }

  async function fetchReservations() {
    const { data } = await supabase
      .from("reservations_pms")
      .select("*, clients_pms(id, nom), rooms(id, room_number, room_type)")
      .order("id", { ascending: false });

    setReservations(data || []);
  }

  async function fetchClients() {
    const { data } = await supabase.from("clients_pms").select("*").order("nom", { ascending: true });
    setClients(data || []);
  }

  async function fetchRooms() {
    const { data } = await supabase.from("rooms").select("*").order("room_number", { ascending: true });
    setRooms(data || []);
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
        notes: form.notes
      }
    ]);

    if (error) {
      alert("Erreur réservation: " + error.message);
      return;
    }

    if (form.status === "checked_in") {
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", Number(form.room_id));
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
      notes: ""
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
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", reservation.room_id);
    }

    if (newStatus === "checked_out") {
      await supabase.from("rooms").update({ status: "dirty" }).eq("id", reservation.room_id);
    }

    if (newStatus === "cancelled") {
      await supabase.from("rooms").update({ status: "available" }).eq("id", reservation.room_id);
    }

    fetchAll();
  }

  async function moveRoom(e) {
    e.preventDefault();

    const reservation = reservations.find((r) => Number(r.id) === Number(moveForm.reservation_id));
    if (!reservation) {
      alert("Réservation introuvable");
      return;
    }

    if (!moveForm.new_room_id) {
      alert("Choisir la nouvelle chambre");
      return;
    }

    const oldRoomId = reservation.room_id;
    const newRoomId = Number(moveForm.new_room_id);

    const { error: updateReservationError } = await supabase
      .from("reservations_pms")
      .update({ room_id: newRoomId })
      .eq("id", reservation.id);

    if (updateReservationError) {
      alert("Erreur changement chambre: " + updateReservationError.message);
      return;
    }

    await supabase.from("rooms").update({ status: "dirty" }).eq("id", oldRoomId);
    await supabase.from("rooms").update({ status: "occupied" }).eq("id", newRoomId);

    await supabase.from("reservation_room_moves").insert([
      {
        reservation_id: reservation.id,
        old_room_id: oldRoomId,
        new_room_id: newRoomId,
        note: moveForm.note
      }
    ]);

    alert("Chambre changée");
    setMoveForm({
      reservation_id: "",
      new_room_id: "",
      note: ""
    });

    fetchAll();
  }

  return (
    <Layout title="Réservations">
      <div className="grid">
        <div className="card">
          <h2 className="section-title">Nouvelle réservation</h2>
          <form className="form-grid two" onSubmit={handleSubmit}>
            <select className="select" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
              <option value="">Choisir un client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.nom}</option>
              ))}
            </select>

            <select className="select" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} required>
              <option value="">Choisir une chambre</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} - {room.room_type} ({translateRoomStatus(room.status)})
                </option>
              ))}
            </select>

            <input className="input" type="date" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} required />
            <input className="input" type="date" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} required />

            <input className="input" type="number" placeholder="Adultes" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
            <input className="input" type="number" placeholder="Enfants" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />

            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="checked_in">Check-in direct</option>
              <option value="cancelled">Annulée</option>
            </select>

            <input className="input" placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <input className="input" type="number" placeholder="Montant total" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            <input className="input" type="number" placeholder="Montant payé" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />

            <div style={{ gridColumn: "1 / -1" }}>
              <textarea className="textarea" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <button className="btn" type="submit">Enregistrer</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Changer de chambre pendant le séjour</h2>
          <form className="form-grid two" onSubmit={moveRoom}>
            <select className="select" value={moveForm.reservation_id} onChange={(e) => setMoveForm({ ...moveForm, reservation_id: e.target.value })} required>
              <option value="">Choisir une réservation</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.clients_pms?.nom || "-"} - chambre {r.rooms?.room_number || "-"}
                </option>
              ))}
            </select>

            <select className="select" value={moveForm.new_room_id} onChange={(e) => setMoveForm({ ...moveForm, new_room_id: e.target.value })} required>
              <option value="">Nouvelle chambre</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} - {room.room_type}
                </option>
              ))}
            </select>

            <div style={{ gridColumn: "1 / -1" }}>
              <textarea className="textarea" placeholder="Note de changement" value={moveForm.note} onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <button className="btn" type="submit">Changer la chambre</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Liste des réservations</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Chambre</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th>Statut</th>
                  <th>Montant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.clients_pms?.nom || "-"}</td>
                    <td>{reservation.rooms?.room_number || "-"}</td>
                    <td>{reservation.check_in}</td>
                    <td>{reservation.check_out}</td>
                    <td>{translateReservationStatus(reservation.status)}</td>
                    <td>{reservation.paid_amount} / {reservation.total_amount}</td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" onClick={() => updateReservationStatus(reservation, "confirmed")}>Confirmer</button>
                        <button className="btn btn-success" onClick={() => updateReservationStatus(reservation, "checked_in")}>Check-in</button>
                        <button className="btn btn-warning" onClick={() => updateReservationStatus(reservation, "checked_out")}>Check-out</button>
                        <button className="btn btn-danger" onClick={() => updateReservationStatus(reservation, "cancelled")}>Annuler</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
