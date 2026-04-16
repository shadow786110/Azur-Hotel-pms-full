import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

function round2(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end - start;
  if (isNaN(diff) || diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default function Reservations() {
  const [profile, setProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [hotelSettings, setHotelSettings] = useState(null);

  const [clientMode, setClientMode] = useState("existing");

  const [form, setForm] = useState({
    reservation_number: "",
    client_id: "",
    manual_client_name: "",
    manual_client_email: "",
    manual_client_phone: "",
    manual_client_address: "",
    manual_client_id_doc: "",
    room_id: "",
    check_in: "",
    check_out: "",
    adults: 1,
    children: 0,
    adults_taxable: 1,
    room_price_ttc_per_night: "",
    vat_rate: 2.1,
    status: "pending",
    notes: ""
  });

  const [changeRoomForm, setChangeRoomForm] = useState({
    reservation_id: "",
    new_room_id: "",
    note: ""
  });

  useEffect(() => {
    loadAll();
    loadProfile();
    loadNextReservationNumber();
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

  async function loadNextReservationNumber() {
    const { data, error } = await supabase.rpc("next_document_number", {
      p_doc_type: "reservation"
    });

    if (!error && data) {
      setForm((prev) => ({ ...prev, reservation_number: data }));
    }
  }

  async function loadAll() {
    const [
      { data: clientsData },
      { data: roomsData },
      { data: reservationsData },
      { data: hotelData }
    ] = await Promise.all([
      supabase.from("clients_pms").select("*").order("nom", { ascending: true }),
      supabase.from("rooms").select("*").order("room_number", { ascending: true }),
      supabase
        .from("reservations_pms")
        .select("*, clients_pms(id, nom, client_code), rooms(id, room_number, room_type)")
        .order("id", { ascending: false }),
      supabase.from("hotel_settings").select("*").order("id", { ascending: true }).limit(1)
    ]);

    setClients(clientsData || []);
    setRooms(roomsData || []);
    setReservations(reservationsData || []);
    setHotelSettings((hotelData && hotelData[0]) || null);
  }

  const computed = useMemo(() => {
    const nights = nightsBetween(form.check_in, form.check_out);
    const adults = Number(form.adults || 0);
    const adultsTaxable = Number(form.adults_taxable || 0);
    const roomPriceTtcPerNight = Number(form.room_price_ttc_per_night || 0);
    const vatRate = Number(form.vat_rate || 0);

    const roomTotalTtc = round2(roomPriceTtcPerNight * nights);
    const roomTotalHt =
      vatRate > 0 ? round2(roomTotalTtc / (1 + vatRate / 100)) : roomTotalTtc;
    const totalTva = round2(roomTotalTtc - roomTotalHt);

    const taxeRate = Number(hotelSettings?.taxe_sejour_rate || 5);
    const taxeCap = Number(hotelSettings?.taxe_sejour_cap || 4);

    const coutTtcParPersNuit =
      adults > 0 && nights > 0 ? roomTotalTtc / adults / nights : 0;

    const taxeUnitaireBrute = round2((coutTtcParPersNuit * taxeRate) / 100);
    const taxeUnitairePlafonnee = Math.min(taxeUnitaireBrute, taxeCap);
    const taxeSejourAmount = round2(taxeUnitairePlafonnee * adultsTaxable * nights);

    const totalReservation = round2(roomTotalTtc + taxeSejourAmount);

    return {
      nights,
      roomTotalHt,
      roomTotalTtc,
      totalTva,
      coutTtcParPersNuit: round2(coutTtcParPersNuit),
      taxeUnitaireBrute,
      taxeUnitairePlafonnee: round2(taxeUnitairePlafonnee),
      taxeSejourAmount,
      totalReservation
    };
  }, [form, hotelSettings]);

  async function createManualClientIfNeeded() {
    if (clientMode === "existing") {
      return Number(form.client_id);
    }

    if (!form.manual_client_name.trim()) {
      throw new Error("Nom client obligatoire");
    }

    const { data: clientCode, error: codeError } = await supabase.rpc(
      "next_document_number",
      { p_doc_type: "client" }
    );

    if (codeError) throw new Error(codeError.message);

    const payload = {
      client_code: clientCode,
      nom: form.manual_client_name,
      email: form.manual_client_email || null,
      telephone: form.manual_client_phone || null,
      adresse: form.manual_client_address || null,
      id_document_url: form.manual_client_id_doc || null,
      credit_balance: 0
    };

    const { data, error } = await supabase
      .from("clients_pms")
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return data.id;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.room_id) {
      alert("Choisir une chambre");
      return;
    }

    if (!form.check_in || !form.check_out) {
      alert("Choisir les dates");
      return;
    }

    if (computed.nights <= 0) {
      alert("Le séjour doit comporter au moins 1 nuit");
      return;
    }

    if (!form.reservation_number) {
      alert("Numéro réservation absent");
      return;
    }

    try {
      const clientId = await createManualClientIfNeeded();

      const payload = {
        reservation_number: form.reservation_number,
        client_id: clientId,
        room_id: Number(form.room_id),
        check_in: form.check_in,
        check_out: form.check_out,
        adults: Number(form.adults || 0),
        children: Number(form.children || 0),
        adults_taxable: Number(form.adults_taxable || 0),
        room_total_ttc: computed.roomTotalTtc,
        vat_rate: Number(form.vat_rate || 0),
        taxe_sejour_amount: computed.taxeSejourAmount,
        total_amount: computed.totalReservation,
        status: form.status,
        notes: form.notes || null
      };

      const { error } = await supabase.from("reservations_pms").insert([payload]);

      if (error) {
        alert("Erreur réservation: " + error.message);
        return;
      }

      alert("Réservation enregistrée");

      setForm({
        reservation_number: "",
        client_id: "",
        manual_client_name: "",
        manual_client_email: "",
        manual_client_phone: "",
        manual_client_address: "",
        manual_client_id_doc: "",
        room_id: "",
        check_in: "",
        check_out: "",
        adults: 1,
        children: 0,
        adults_taxable: 1,
        room_price_ttc_per_night: "",
        vat_rate: 2.1,
        status: "pending",
        notes: ""
      });

      setClientMode("existing");
      await loadAll();
      await loadNextReservationNumber();
    } catch (err) {
      alert(err.message);
    }
  }

  async function createInvoiceFromReservation(reservation) {
    const { data: invoiceNumber, error: numError } = await supabase.rpc(
      "next_document_number",
      { p_doc_type: "invoice" }
    );

    if (numError) {
      alert("Erreur numérotation facture: " + numError.message);
      return;
    }

    const totalAmount = Number(reservation.total_amount || 0);

    const { data: insertedInvoice, error: invoiceError } = await supabase
      .from("invoices_pms")
      .insert([
        {
          invoice_number: invoiceNumber,
          client_id: reservation.client_id,
          reservation_id: reservation.id,
          total_amount: totalAmount,
          paid_amount: 0,
          status: "draft",
          payment_method: null,
          source: "reservation",
          notes: reservation.notes || `Facture issue de ${reservation.reservation_number || reservation.id}`
        }
      ])
      .select()
      .single();

    if (invoiceError) {
      alert("Erreur création facture: " + invoiceError.message);
      return;
    }

    const lines = [
      {
        invoice_id: insertedInvoice.id,
        label: `Séjour chambre ${reservation.rooms?.room_number || ""}`,
        quantity: 1,
        unit_price: Number(reservation.room_total_ttc || 0),
        vat_rate: Number(reservation.vat_rate || 0),
        total_ht:
          Number(reservation.vat_rate || 0) > 0
            ? round2(
                Number(reservation.room_total_ttc || 0) /
                  (1 + Number(reservation.vat_rate || 0) / 100)
              )
            : Number(reservation.room_total_ttc || 0),
        total_tva:
          Number(reservation.room_total_ttc || 0) -
          (Number(reservation.vat_rate || 0) > 0
            ? round2(
                Number(reservation.room_total_ttc || 0) /
                  (1 + Number(reservation.vat_rate || 0) / 100)
              )
            : Number(reservation.room_total_ttc || 0)),
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
    ];

    const { error: lineError } = await supabase
      .from("invoice_custom_lines")
      .insert(lines);

    if (lineError) {
      alert("Erreur lignes facture: " + lineError.message);
      return;
    }

    alert(`Facture ${invoiceNumber} créée`);
  }

  async function updateReservationStatus(id, status) {
    const { error } = await supabase
      .from("reservations_pms")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("Erreur statut: " + error.message);
      return;
    }

    loadAll();
  }

  async function changeRoomDuringStay(e) {
    e.preventDefault();

    if (!changeRoomForm.reservation_id || !changeRoomForm.new_room_id) {
      alert("Choisir réservation et nouvelle chambre");
      return;
    }

    const { error } = await supabase
      .from("reservations_pms")
      .update({
        room_id: Number(changeRoomForm.new_room_id),
        notes: changeRoomForm.note || null
      })
      .eq("id", Number(changeRoomForm.reservation_id));

    if (error) {
      alert("Erreur changement de chambre: " + error.message);
      return;
    }

    alert("Chambre modifiée");
    setChangeRoomForm({
      reservation_id: "",
      new_room_id: "",
      note: ""
    });
    loadAll();
  }

  return (
    <Layout title="Réservations" profile={profile}>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h2 className="section-title">Nouvelle réservation</h2>

          <form className="form-grid" onSubmit={handleSubmit}>
            <input
              className="input"
              placeholder="N° réservation auto"
              value={form.reservation_number}
              readOnly
            />

            <div className="btn-row">
              <button
                type="button"
                className={`btn ${clientMode === "existing" ? "" : "btn-secondary"}`}
                onClick={() => setClientMode("existing")}
              >
                Client existant
              </button>

              <button
                type="button"
                className={`btn ${clientMode === "manual" ? "" : "btn-secondary"}`}
                onClick={() => setClientMode("manual")}
              >
                Nouveau client
              </button>
            </div>

            {clientMode === "existing" ? (
              <select
                className="select"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              >
                <option value="">Choisir un client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.client_code ? `${client.client_code} - ` : ""}
                    {client.nom}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-2">
                <input
                  className="input"
                  placeholder="Nom client"
                  value={form.manual_client_name}
                  onChange={(e) =>
                    setForm({ ...form, manual_client_name: e.target.value })
                  }
                />

                <input
                  className="input"
                  placeholder="Email client"
                  value={form.manual_client_email}
                  onChange={(e) =>
                    setForm({ ...form, manual_client_email: e.target.value })
                  }
                />

                <input
                  className="input"
                  placeholder="Téléphone client"
                  value={form.manual_client_phone}
                  onChange={(e) =>
                    setForm({ ...form, manual_client_phone: e.target.value })
                  }
                />

                <input
                  className="input"
                  placeholder="Adresse client"
                  value={form.manual_client_address}
                  onChange={(e) =>
                    setForm({ ...form, manual_client_address: e.target.value })
                  }
                />

                <input
                  className="input"
                  placeholder="Lien / pièce identité"
                  value={form.manual_client_id_doc}
                  onChange={(e) =>
                    setForm({ ...form, manual_client_id_doc: e.target.value })
                  }
                />
              </div>
            )}

            <div className="grid grid-2">
              <select
                className="select"
                value={form.room_id}
                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              >
                <option value="">Choisir une chambre</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Chambre {room.room_number} - {room.room_type || "-"}
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
                <option value="checked_in">Check-in</option>
                <option value="checked_out">Check-out</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>

            <div className="grid grid-2">
              <input
                className="input"
                type="date"
                value={form.check_in}
                onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              />

              <input
                className="input"
                type="date"
                value={form.check_out}
                onChange={(e) => setForm({ ...form, check_out: e.target.value })}
              />
            </div>

            <div className="grid grid-4">
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
                placeholder="Adultes taxables"
                value={form.adults_taxable}
                onChange={(e) =>
                  setForm({ ...form, adults_taxable: e.target.value })
                }
              />

              <input
                className="input"
                type="number"
                placeholder="TVA %"
                value={form.vat_rate}
                onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
              />
            </div>

            <input
              className="input"
              type="number"
              placeholder="Prix chambre TTC / nuit"
              value={form.room_price_ttc_per_night}
              onChange={(e) =>
                setForm({ ...form, room_price_ttc_per_night: e.target.value })
              }
            />

            <div className="card" style={{ background: "#f4f9ff" }}>
              <strong>Nuits :</strong> {computed.nights}
              <br />
              <strong>Occupants totaux :</strong>{" "}
              {Number(form.adults || 0) + Number(form.children || 0)}
              <br />
              <strong>Prix HT / nuit :</strong>{" "}
              {computed.nights > 0
                ? round2(computed.roomTotalHt / computed.nights).toFixed(2)
                : "0.00"}{" "}
              €
              <br />
              <strong>Total HT chambre :</strong> {computed.roomTotalHt.toFixed(2)} €
              <br />
              <strong>Total TVA chambre :</strong> {computed.totalTva.toFixed(2)} €
              <br />
              <strong>Total TTC chambre :</strong> {computed.roomTotalTtc.toFixed(2)} €
              <br />
              <strong>Coût TTC / personne / nuit :</strong>{" "}
              {computed.coutTtcParPersNuit.toFixed(2)} €
              <br />
              <strong>Taxe unitaire brute :</strong>{" "}
              {computed.taxeUnitaireBrute.toFixed(2)} €
              <br />
              <strong>Taxe unitaire plafonnée :</strong>{" "}
              {computed.taxeUnitairePlafonnee.toFixed(2)} €
              <br />
              <strong>Taxe de séjour totale :</strong>{" "}
              {computed.taxeSejourAmount.toFixed(2)} €
              <br />
              <strong>Total réservation :</strong>{" "}
              {computed.totalReservation.toFixed(2)} €
            </div>

            <textarea
              className="textarea"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <button className="btn" type="submit">
              Enregistrer la réservation
            </button>
          </form>
        </div>

        <div className="grid">
          <div className="card">
            <h2 className="section-title">Changer de chambre pendant le séjour</h2>

            <form className="form-grid" onSubmit={changeRoomDuringStay}>
              <select
                className="select"
                value={changeRoomForm.reservation_id}
                onChange={(e) =>
                  setChangeRoomForm({
                    ...changeRoomForm,
                    reservation_id: e.target.value
                  })
                }
              >
                <option value="">Choisir une réservation</option>
                {reservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {reservation.reservation_number || `#${reservation.id}`} -{" "}
                    {reservation.clients_pms?.nom || "-"}
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={changeRoomForm.new_room_id}
                onChange={(e) =>
                  setChangeRoomForm({
                    ...changeRoomForm,
                    new_room_id: e.target.value
                  })
                }
              >
                <option value="">Nouvelle chambre</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Chambre {room.room_number}
                  </option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Note de changement"
                value={changeRoomForm.note}
                onChange={(e) =>
                  setChangeRoomForm({
                    ...changeRoomForm,
                    note: e.target.value
                  })
                }
              />

              <button className="btn" type="submit">
                Changer la chambre
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Liste des réservations</h2>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Client</th>
                    <th>Chambre</th>
                    <th>Arrivée</th>
                    <th>Départ</th>
                    <th>Statut</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>{reservation.reservation_number || reservation.id}</td>
                      <td>
                        {reservation.clients_pms?.nom || "-"}
                        <br />
                        <span className="helper">
                          {reservation.clients_pms?.client_code || ""}
                        </span>
                      </td>
                      <td>{reservation.rooms?.room_number || "-"}</td>
                      <td>{reservation.check_in}</td>
                      <td>{reservation.check_out}</td>
                      <td>{reservation.status}</td>
                      <td>{Number(reservation.total_amount || 0).toFixed(2)} €</td>
                      <td>
                        <div className="btn-row">
                          <button
                            className="btn btn-secondary"
                            onClick={() =>
                              updateReservationStatus(reservation.id, "confirmed")
                            }
                          >
                            Confirmer
                          </button>

                          <button
                            className="btn btn-success"
                            onClick={() =>
                              updateReservationStatus(reservation.id, "checked_in")
                            }
                          >
                            Check-in
                          </button>

                          <button
                            className="btn btn-secondary"
                            onClick={() =>
                              updateReservationStatus(reservation.id, "checked_out")
                            }
                          >
                            Check-out
                          </button>

                          <button
                            className="btn"
                            onClick={() => createInvoiceFromReservation(reservation)}
                          >
                            Facturer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {reservations.length === 0 && (
                    <tr>
                      <td colSpan="8">Aucune réservation.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
