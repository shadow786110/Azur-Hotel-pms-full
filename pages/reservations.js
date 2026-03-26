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

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function computeReservationAmounts({
  nightly_price_ttc,
  vat_rate,
  adults,
  children,
  taxable_adults,
  check_in,
  check_out,
  taxe_sejour_rate,
  taxe_sejour_cap
}) {
  const nights = calcNights(check_in, check_out);
  const priceTtcNight = Number(nightly_price_ttc || 0);
  const vat = Number(vat_rate || 0);
  const adultsCount = Number(adults || 0);
  const childrenCount = Number(children || 0);
  const taxableAdultsCount = Number(taxable_adults || 0);

  const totalOccupants = adultsCount + childrenCount;

  const nightly_price_ht =
    vat > 0 ? priceTtcNight / (1 + vat / 100) : priceTtcNight;

  const room_total_ttc = priceTtcNight * nights;
  const room_total_ht = nightly_price_ht * nights;
  const room_total_tva = room_total_ttc - room_total_ht;

  let cout_ht_par_personne_par_nuit = 0;
  if (nights > 0 && totalOccupants > 0) {
    cout_ht_par_personne_par_nuit = room_total_ht / nights / totalOccupants;
  }

  const taux = Number(taxe_sejour_rate || 0) / 100;
  const cap = Number(taxe_sejour_cap || 0);

  const taxe_unitaire_brute = cout_ht_par_personne_par_nuit * taux;
  const taxe_unitaire = Math.min(taxe_unitaire_brute, cap);

  const taxe_sejour_amount = taxe_unitaire * taxableAdultsCount * nights;
  const total_amount = room_total_ttc + taxe_sejour_amount;

  return {
    nights,
    totalOccupants,
    nightly_price_ht: round2(nightly_price_ht),
    room_total_ht: round2(room_total_ht),
    room_total_tva: round2(room_total_tva),
    room_total_ttc: round2(room_total_ttc),
    cout_ht_par_personne_par_nuit: round2(cout_ht_par_personne_par_nuit),
    taxe_unitaire_brute: round2(taxe_unitaire_brute),
    taxe_unitaire: round2(taxe_unitaire),
    taxe_sejour_amount: round2(taxe_sejour_amount),
    total_amount: round2(total_amount)
  };
}

export default function Reservations() {
  const [profile, setProfile] = useState(null);
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
    taxable_adults: 1,
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
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(data || null);
  }

  async function fetchAll() {
    await Promise.all([
      fetchReservations(),
      fetchClients(),
      fetchRooms(),
      fetchSettings()
    ]);
  }

  async function fetchReservations() {
    const { data } = await supabase
      .from("reservations_pms")
      .select("*, clients_pms(id, nom, email, telephone, adresse, credit_balance), rooms(id, room_number, room_type)")
      .order("id", { ascending: false });

    setReservations(data || []);
  }

  async function fetchClients() {
    const { data } = await supabase
      .from("clients_pms")
      .select("*")
      .order("nom", { ascending: true });

    setClients(data || []);
  }

  async function fetchRooms() {
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .order("room_number", { ascending: true });

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
      children: form.children,
      taxable_adults: form.taxable_adults,
      check_in: form.check_in,
      check_out: form.check_out,
      taxe_sejour_rate: settings?.taxe_sejour_rate || 0,
      taxe_sejour_cap: settings?.taxe_sejour_cap || 0
    });
  }, [form, settings]);

  async function handleSubmit(e) {
    e.preventDefault();

    const amounts = computeReservationAmounts({
      nightly_price_ttc: form.nightly_price_ttc,
      vat_rate: form.vat_rate,
      adults: form.adults,
      children: form.children,
      taxable_adults: form.taxable_adults,
      check_in: form.check_in,
      check_out: form.check_out,
      taxe_sejour_rate: settings?.taxe_sejour_rate || 0,
      taxe_sejour_cap: settings?.taxe_sejour_cap || 0
    });

    const { error } = await supabase.from("reservations_pms").insert([
      {
        client_id: Number(form.client_id),
        room_id: Number(form.room_id),
        check_in: form.check_in,
        check_out: form.check_out,
        adults: Number(form.adults),
        children: Number(form.children),
        taxable_adults: Number(form.taxable_adults),
        total_occupants: Number(amounts.totalOccupants || 0),
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
      taxable_adults: 1,
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

  async function moveRoom(e) {
    e.preventDefault();

    const reservation = reservations.find(
      (r) => Number(r.id) === Number(moveForm.reservation_id)
    );
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

    await supabase
      .from("rooms")
      .update({ status: "dirty" })
      .eq("id", oldRoomId);

    await supabase
      .from("rooms")
      .update({ status: "occupied" })
      .eq("id", newRoomId);

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

  async function createInvoiceFromReservation(reservation) {
    try {
      const { data: client } = await supabase
        .from("clients_pms")
        .select("*")
        .eq("id", reservation.client_id)
        .single();

      const invoicePayload = {
        invoice_number: `RES-${reservation.id}-${Date.now()}`,
        client_id: reservation.client_id,
        total_amount: Number(reservation.total_amount || 0),
        paid_amount: Number(reservation.paid_amount || 0),
        status:
          Number(reservation.paid_amount || 0) >= Number(reservation.total_amount || 0)
            ? "paid"
            : Number(reservation.paid_amount || 0) > 0
              ? "partial"
              : "draft",
        payment_method: "Crédit",
        notes: `Facture créée automatiquement depuis réservation #${reservation.id}`
      };

      const { data: insertedInvoice, error: invoiceError } = await supabase
        .from("invoices_pms")
        .insert([invoicePayload])
        .select()
        .single();

      if (invoiceError) {
        alert("Erreur création facture: " + invoiceError.message);
        return;
      }

      const nights = calcNights(reservation.check_in, reservation.check_out) || 1;
      const lineLabel = `Séjour chambre ${reservation.rooms?.room_number || ""} du ${reservation.check_in} au ${reservation.check_out} (${nights} nuit(s))`;

      await supabase.from("invoice_custom_lines").insert([
        {
          invoice_id: insertedInvoice.id,
          label: lineLabel,
          quantity: 1,
          unit_price: Number(reservation.room_total_ht || 0),
          vat_rate: Number(reservation.vat_rate || 0),
          total_ht: Number(reservation.room_total_ht || 0),
          total_tva: Number(reservation.room_total_tva || 0),
          total_ttc: Number(reservation.room_total_ttc || 0)
        },
        {
          invoice_id: insertedInvoice.id,
          label: "Taxe de séjour",
          quantity: 1,
          unit_price: Number(reservation.taxe_sejour_amount || 0),
          vat_rate: 0,
          total_ht: Number(reservation.taxe_sejour_amount || 0),
          total_tva: 0,
          total_ttc: Number(reservation.taxe_sejour_amount || 0)
        }
      ]);

      const due =
        Number(reservation.total_amount || 0) - Number(reservation.paid_amount || 0);

      if (due > 0 && client) {
        await supabase
          .from("clients_pms")
          .update({
            credit_balance: Number(client.credit_balance || 0) + due
          })
          .eq("id", reservation.client_id);
      }

      alert("Facture créée automatiquement");
      fetchAll();
    } catch (err) {
      alert("Erreur facture depuis réservation: " + err.message);
    }
  }

  return (
    <Layout title="Réservations" profile={profile}>
      <div className="grid">
        <div className="card">
          <h2 className="section-title">Nouvelle réservation</h2>

          <form className="form-grid two" onSubmit={handleSubmit}>
            <select
              className="select"
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
              className="select"
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
              className="input"
              type="date"
              value={form.check_in}
              onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              required
            />

            <input
              className="input"
              type="date"
              value={form.check_out}
              onChange={(e) => setForm({ ...form, check_out: e.target.value })}
              required
            />

            <input
              className="input"
              type="number"
              placeholder="Adultes"
              value={form.adults}
              onChange={(e) => setForm({ ...form, adults: e.target.value })}
            />

            <input
              className="input"
              type="number"
              placeholder="Enfants"
              value={form.children}
              onChange={(e) => setForm({ ...form, children: e.target.value })}
            />

            <input
              className="input"
              type="number"
              placeholder="Adultes assujettis taxe séjour"
              value={form.taxable_adults}
              onChange={(e) => setForm({ ...form, taxable_adults: e.target.value })}
            />

            <input
              className="input"
              type="number"
              placeholder="Prix chambre TTC / nuit"
              value={form.nightly_price_ttc}
              onChange={(e) => setForm({ ...form, nightly_price_ttc: e.target.value })}
            />

            <select
              className="select"
              value={form.vat_rate}
              onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
            >
              {VAT_OPTIONS.map((vat) => (
                <option key={vat} value={vat}>
                  {vat}% TVA
                </option>
              ))}
            </select>

            <select
              className="select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="checked_in">Check-in direct</option>
              <option value="cancelled">Annulée</option>
            </select>

            <input
              className="input"
              placeholder="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />

            <input
              className="input"
              type="number"
              placeholder="Montant déjà payé"
              value={form.paid_amount}
              onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
            />

            <div className="card" style={{ gridColumn: "1 / -1", padding: 12 }}>
              <strong>Taux taxe séjour :</strong> {Number(settings?.taxe_sejour_rate || 0).toFixed(2)} %<br />
              <strong>Plafond taxe séjour :</strong> {Number(settings?.taxe_sejour_cap || 0).toFixed(2)} €<br />
              <strong>Nuits :</strong> {computed.nights}<br />
              <strong>Occupants totaux :</strong> {computed.totalOccupants}<br />
              <strong>Prix HT / nuit :</strong> {computed.nightly_price_ht.toFixed(2)} €<br />
              <strong>Total HT chambre :</strong> {computed.room_total_ht.toFixed(2)} €<br />
              <strong>Total TVA chambre :</strong> {computed.room_total_tva.toFixed(2)} €<br />
              <strong>Total TTC chambre :</strong> {computed.room_total_ttc.toFixed(2)} €<br />
              <strong>Coût HT / personne / nuit :</strong> {computed.cout_ht_par_personne_par_nuit.toFixed(2)} €<br />
              <strong>Taxe unitaire brute :</strong> {computed.taxe_unitaire_brute.toFixed(2)} €<br />
              <strong>Taxe unitaire plafonnée :</strong> {computed.taxe_unitaire.toFixed(2)} €<br />
              <strong>Taxe de séjour totale :</strong> {computed.taxe_sejour_amount.toFixed(2)} €<br />
              <strong>Total réservation :</strong> {computed.total_amount.toFixed(2)} €
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <textarea
                className="textarea"
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <button className="btn" type="submit">
                Enregistrer
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Changer de chambre pendant le séjour</h2>

          <form className="form-grid two" onSubmit={moveRoom}>
            <select
              className="select"
              value={moveForm.reservation_id}
              onChange={(e) => setMoveForm({ ...moveForm, reservation_id: e.target.value })}
              required
            >
              <option value="">Choisir une réservation</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.clients_pms?.nom || "-"} - chambre {r.rooms?.room_number || "-"}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={moveForm.new_room_id}
              onChange={(e) => setMoveForm({ ...moveForm, new_room_id: e.target.value })}
              required
            >
              <option value="">Nouvelle chambre</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} - {room.room_type}
                </option>
              ))}
            </select>

            <div style={{ gridColumn: "1 / -1" }}>
              <textarea
                className="textarea"
                placeholder="Note de changement"
                value={moveForm.note}
                onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <button className="btn" type="submit">
                Changer la chambre
              </button>
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
                        <button
                          className="btn btn-secondary"
                          onClick={() => updateReservationStatus(reservation, "confirmed")}
                        >
                          Confirmer
                        </button>

                        <button
                          className="btn btn-success"
                          onClick={() => updateReservationStatus(reservation, "checked_in")}
                        >
                          Check-in
                        </button>

                        <button
                          className="btn btn-warning"
                          onClick={() => updateReservationStatus(reservation, "checked_out")}
                        >
                          Check-out
                        </button>

                        <button
                          className="btn btn-danger"
                          onClick={() => updateReservationStatus(reservation, "cancelled")}
                        >
                          Annuler
                        </button>

                        <button
                          className="btn btn-success"
                          onClick={() => createInvoiceFromReservation(reservation)}
                        >
                          Facturer
                        </button>
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
