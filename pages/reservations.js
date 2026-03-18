import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end - start;
  if (isNaN(diff) || diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function computeReservationAmounts({ nightly_price_ttc, vat_rate, adults, check_in, check_out, taxe_sejour_per_adult_night }) {
  const nights = calcNights(check_in, check_out);
  const priceTtc = Number(nightly_price_ttc || 0);
  const vat = Number(vat_rate || 0);
  const adultsCount = Number(adults || 0);
  const taxeSejour = Number(taxe_sejour_per_adult_night || 0);

  const nightly_price_ht = vat > 0 ? priceTtc / (1 + vat / 100) : priceTtc;
  const room_total_ttc = priceTtc * nights;
  const room_total_ht = nightly_price_ht * nights;
  const room_total_tva = room_total_ttc - room_total_ht;
  const taxe_sejour_amount = adultsCount * nights * taxeSejour;
  const total_amount = room_total_ttc + taxe_sejour_amount;

  return {
    nights,
    nightly_price_ht,
    room_total_ht,
    room_total_tva,
    room_total_ttc,
    taxe_sejour_amount,
    total_amount
  };
}

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [clients, setClients] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(null);

  const [form, setForm] = useState({
    client_id: "",
    room_id: "",
    check_in: "",
    check_out: "",
    adults: 1,
    children: 0,
    status: "pending",
    source: "",
    nightly_price_ttc: "",
    vat_rate: 2.1,
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
    await Promise.all([fetchReservations(), fetchClients(), fetchRooms(), fetchSettings()]);
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

  async function fetchSettings() {
    const { data } = await supabase
      .from("hotel_settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .single();

    setSettings(data || null);
  }

  const computed = useMemo(() => {
    return computeReservationAmounts({
      nightly_price_ttc: form.nightly_price_ttc,
      vat_rate: form.vat_rate,
      adults: form.adults,
      check_in: form.check_in,
      check_out: form.check_out,
      taxe_sejour_per_adult_night: settings?.taxe_sejour_per_adult_night || 0
    });
  }, [form, settings]);

  async function handleSubmit(e) {
    e.preventDefault();

    const amounts = computeReservationAmounts({
      nightly_price_ttc: form.nightly_price_ttc,
      vat_rate: form.vat_rate,
      adults: form.adults,
      check_in: form.check_in,
      check_out: form.check_out,
      taxe_sejour_per_adult_night: settings?.taxe_sejour_per_adult_night || 0
    });

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
        nightly_price_ttc: Number(form.nightly_price_ttc || 0),
        vat_rate: Number(form.vat_rate || 0),
        room_total_ht: Number(amounts.room_total_ht || 0),
        room_total_tva: Number(amounts.room_total_tva || 0),
        room_total_ttc: Number(amounts.room_total_ttc || 0),
        taxe_sejour_amount: Number(amounts.taxe_sejour_amount || 0),
        total_amount: Number(amounts.total_amount || 0),
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
      nightly_price_ttc: "",
      vat_rate: 2.1,
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

            <input className="input" type="number" placeholder="Prix chambre TTC / nuit" value={form.nightly_price_ttc} onChange={(e) => setForm({ ...form, nightly_price_ttc: e.target.value })} />
            <select className="select" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}>
              {VAT_OPTIONS.map((vat) => (
                <option key={vat} value={vat}>{vat}% TVA</option>
              ))}
            </select>

            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="checked_in">Check-in direct</option>
              <option value="cancelled">Annulée</option>
            </select>

            <input className="input" placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <input className="input" type="number" placeholder="Montant déjà payé" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />

            <div className="card" style={{ gridColumn: "1 / -1", padding: 12 }}>
              <strong>Paramètre taxe séjour :</strong> {Number(settings?.taxe_sejour_per_adult_night || 0).toFixed(2)} € / adulte / nuit<br />
              <strong>Nuits :</strong> {computed.nights}<br />
              <strong>Total HT chambre :</strong> {computed.room_total_ht.toFixed(2)} €<br />
              <strong>Total TVA chambre :</strong> {computed.room_total_tva.toFixed(2)} €<br />
              <strong>Total TTC chambre :</strong> {computed.room_total_ttc.toFixed(2)} €<br />
              <strong>Taxe de séjour :</strong> {computed.taxe_sejour_amount.toFixed(2)} €<br />
              <strong>Total réservation :</strong> {computed.total_amount.toFixed(2)} €
            </div>

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
                  <th>Total chambre TTC</th>
                  <th>Taxe séjour</th>
                  <th>Total final</th>
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
                    <td>{Number(reservation.room_total_ttc || 0).toFixed(2)} €</td>
                    <td>{Number(reservation.taxe_sejour_amount || 0).toFixed(2)} €</td>
                    <td>{Number(reservation.total_amount || 0).toFixed(2)} €</td>
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
