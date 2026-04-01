import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildInvoicePdf } from "../lib/pdfUtils";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];
const PAYMENT_METHODS = ["Esp", "Cb", "Chq", "Virement", "Crédit"];

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function makeLine() {
  return {
    label: "",
    quantity: 1,
    unit_price_ttc: 0,
    vat_rate: 0,
    unit_price_ht: 0,
    total_ht: 0,
    total_tva: 0,
    total_ttc: 0
  };
}

function computeLine(line) {
  const quantity = Number(line.quantity || 0);
  const unit_price_ttc = Number(line.unit_price_ttc || 0);
  const vat_rate = Number(line.vat_rate || 0);

  const unit_price_ht =
    vat_rate > 0 ? unit_price_ttc / (1 + vat_rate / 100) : unit_price_ttc;

  const total_ttc = quantity * unit_price_ttc;
  const total_ht = quantity * unit_price_ht;
  const total_tva = total_ttc - total_ht;

  return {
    ...line,
    unit_price_ht: round2(unit_price_ht),
    total_ht: round2(total_ht),
    total_tva: round2(total_tva),
    total_ttc: round2(total_ttc)
  };
}

function computeTotals(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.total_ht += Number(line.total_ht || 0);
      acc.total_tva += Number(line.total_tva || 0);
      acc.total_ttc += Number(line.total_ttc || 0);
      return acc;
    },
    { total_ht: 0, total_tva: 0, total_ttc: 0 }
  );
}

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end - start;
  if (isNaN(diff) || diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default function Invoices() {
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reservations, setReservations] = useState([]);

  const [customerMode, setCustomerMode] = useState("existing");

  const [form, setForm] = useState({
    invoice_number: "",
    client_id: "",
    manual_client_name: "",
    manual_client_email: "",
    manual_client_phone: "",
    manual_client_address: "",
    reservation_id: "",
    paid_amount: "",
    payment_method: "Crédit",
    credit_used: "",
    notes: ""
  });

  const [cart, setCart] = useState([makeLine()]);

  const [paymentForm, setPaymentForm] = useState({
    invoice_id: "",
    amount: "",
    method: "Esp",
    reference: ""
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
    const [
      { data: invoicesData },
      { data: clientsData },
      { data: paymentsData },
      { data: reservationsData }
    ] = await Promise.all([
      supabase
        .from("invoices_pms")
        .select("*, clients_pms(id, nom, email, telephone, adresse, credit_balance)")
        .order("id", { ascending: false }),
      supabase.from("clients_pms").select("*").order("nom", { ascending: true }),
      supabase.from("payments_pms").select("*").order("id", { ascending: false }),
      supabase
        .from("reservations_pms")
        .select("*, clients_pms(id, nom, email, telephone, adresse, credit_balance), rooms(id, room_number, room_type)")
        .order("id", { ascending: false })
    ]);

    setInvoices(invoicesData || []);
    setClients(clientsData || []);
    setPayments(paymentsData || []);
    setReservations(reservationsData || []);
  }

  function updateCartLine(index, field, value) {
    const copy = [...cart];
    copy[index] = computeLine({
      ...copy[index],
      [field]: value
    });
    setCart(copy);
  }

  function addCartLine() {
    setCart([...cart, makeLine()]);
  }

  function removeCartLine(index) {
    if (cart.length === 1) return;
    setCart(cart.filter((_, i) => i !== index));
  }

  function addQuickLine(type) {
    if (type === "petit_dejeuner") {
      setCart([
        ...cart,
        computeLine({
          label: "Petit-déjeuner",
          quantity: 1,
          unit_price_ttc: 10,
          vat_rate: 2.1
        })
      ]);
      return;
    }

    if (type === "navette") {
      setCart([
        ...cart,
        computeLine({
          label: "Navette",
          quantity: 1,
          unit_price_ttc: 25,
          vat_rate: 8.5
        })
      ]);
      return;
    }

    if (type === "vente") {
      setCart([
        ...cart,
        computeLine({
          label: "Produit / vente",
          quantity: 1,
          unit_price_ttc: 5,
          vat_rate: 8.5
        })
      ]);
      return;
    }

    if (type === "autre") {
      setCart([...cart, makeLine()]);
    }
  }

  function resetForm() {
    setForm({
      invoice_number: "",
      client_id: "",
      manual_client_name: "",
      manual_client_email: "",
      manual_client_phone: "",
      manual_client_address: "",
      reservation_id: "",
      paid_amount: "",
      payment_method: "Crédit",
      credit_used: "",
      notes: ""
    });
    setCart([makeLine()]);
    setCustomerMode("existing");
  }

  function fillFromReservation(reservationId) {
    const reservation = reservations.find(
      (r) => Number(r.id) === Number(reservationId)
    );
    if (!reservation) return;

    const nights = calcNights(reservation.check_in, reservation.check_out) || 1;

    const roomLine = computeLine({
      label: `Séjour chambre ${reservation.rooms?.room_number || ""} du ${reservation.check_in} au ${reservation.check_out} (${nights} nuit(s))`,
      quantity: 1,
      unit_price_ttc: Number(reservation.room_total_ttc || 0),
      vat_rate: Number(reservation.vat_rate || 0)
    });

    const taxLine = computeLine({
      label: "Taxe de séjour",
      quantity: 1,
      unit_price_ttc: Number(reservation.taxe_sejour_amount || 0),
      vat_rate: 0
    });

    setCustomerMode("existing");
    setForm((prev) => ({
      ...prev,
      client_id: reservation.client_id ? String(reservation.client_id) : "",
      reservation_id: String(reservation.id),
      notes: `Facture issue de la réservation #${reservation.id}`
    }));
    setCart([roomLine, taxLine]);
  }

  async function handleInvoiceSubmit(e) {
    e.preventDefault();

    const computedLines = cart
      .map(computeLine)
      .filter((line) => String(line.label || "").trim() !== "");

    if (computedLines.length === 0) {
      alert("Ajoute au moins une ligne au panier");
      return;
    }

    if (customerMode === "existing" && !form.client_id) {
      alert("Choisir un client ou passer en client manuel");
      return;
    }

    if (customerMode === "manual" && !form.manual_client_name.trim()) {
      alert("Le nom du client manuel est obligatoire");
      return;
    }

    const totals = computeTotals(computedLines);
    const paidAmount = Number(form.paid_amount || 0);
    const creditUsed = Number(form.credit_used || 0);

    let status = "draft";
    const accountedPaid = paidAmount + creditUsed;

    if (accountedPaid > 0 && accountedPaid < totals.total_ttc) status = "partial";
    if (accountedPaid >= totals.total_ttc) status = "paid";

    const payload = {
      invoice_number: form.invoice_number,
      client_id: customerMode === "existing" ? Number(form.client_id) : null,
      manual_client_name:
        customerMode === "manual" ? form.manual_client_name : null,
      manual_client_email:
        customerMode === "manual" ? form.manual_client_email : null,
      manual_client_phone:
        customerMode === "manual" ? form.manual_client_phone : null,
      manual_client_address:
        customerMode === "manual" ? form.manual_client_address : null,
      reservation_id: form.reservation_id ? Number(form.reservation_id) : null,
      total_amount: Number(totals.total_ttc || 0),
      paid_amount: accountedPaid,
      status,
      payment_method: form.payment_method,
      credit_used: creditUsed,
      source: form.reservation_id ? "reservation" : "manual",
      notes: form.notes
    };

    const { data: insertedInvoice, error: invoiceError } = await supabase
      .from("invoices_pms")
      .insert([payload])
      .select()
      .single();

    if (invoiceError) {
      alert("Erreur facture: " + invoiceError.message);
      return;
    }

    const linesToInsert = computedLines.map((line) => ({
      invoice_id: insertedInvoice.id,
      label: line.label,
      quantity: Number(line.quantity || 0),
      unit_price: Number(line.unit_price_ht || 0),
      vat_rate: Number(line.vat_rate || 0),
      total_ht: Number(line.total_ht || 0),
      total_tva: Number(line.total_tva || 0),
      total_ttc: Number(line.total_ttc || 0)
    }));

    const { error: lineError } = await supabase
      .from("invoice_custom_lines")
      .insert(linesToInsert);

    if (lineError) {
      alert("Erreur lignes facture: " + lineError.message);
      return;
    }

    if (customerMode === "existing" && form.client_id) {
      const client = clients.find((c) => Number(c.id) === Number(form.client_id));
      const currentCredit = Number(client?.credit_balance || 0);

      if (creditUsed > 0) {
        await supabase
          .from("clients_pms")
          .update({
            credit_balance: Math.max(0, currentCredit - creditUsed)
          })
          .eq("id", Number(form.client_id));
      }

      const due = Number(totals.total_ttc || 0) - accountedPaid;

      if (due > 0) {
        await supabase.from("client_credits").insert([
          {
            client_id: Number(form.client_id),
            invoice_id: insertedInvoice.id,
            amount: due,
            status: "open"
          }
        ]);

        await supabase
          .from("clients_pms")
          .update({
            credit_balance: Math.max(0, currentCredit - creditUsed) + due
          })
          .eq("id", Number(form.client_id));
      }
    }

    if (paidAmount > 0) {
      await supabase.from("payments_pms").insert([
        {
          invoice_id: insertedInvoice.id,
          amount: paidAmount,
          method: form.payment_method,
          reference: form.reservation_id
            ? `Reservation-${form.reservation_id}`
            : "Paiement initial"
        }
      ]);
    }

    alert("Facture enregistrée");
    resetForm();
    fetchAll();
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();

    const amount = Number(paymentForm.amount || 0);
    const invoiceId = Number(paymentForm.invoice_id);

    const { error } = await supabase.from("payments_pms").insert([
      {
        invoice_id: invoiceId,
        amount,
        method: paymentForm.method,
        reference: paymentForm.reference
      }
    ]);

    if (error) {
      alert("Erreur paiement: " + error.message);
      return;
    }

    const invoice = invoices.find((i) => i.id === invoiceId);
    const newPaid = Number(invoice?.paid_amount || 0) + amount;
    const total = Number(invoice?.total_amount || 0);

    let status = "partial";
    if (newPaid <= 0) status = "draft";
    if (newPaid >= total) status = "paid";

    await supabase
      .from("invoices_pms")
      .update({
        paid_amount: newPaid,
        status
      })
      .eq("id", invoiceId);

    if (newPaid >= total) {
      await supabase
        .from("client_credits")
        .update({ status: "closed", amount: 0 })
        .eq("invoice_id", invoiceId);
    }

    alert("Paiement enregistré");
    setPaymentForm({
      invoice_id: "",
      amount: "",
      method: "Esp",
      reference: ""
    });
    fetchAll();
  }

  async function deleteInvoice(id) {
    if (!profile || profile.role !== "admin") {
      alert("Suppression réservée à l'admin");
      return;
    }

    if (!confirm("Supprimer cette facture ?")) return;

    await supabase.from("payments_pms").delete().eq("invoice_id", id);
    await supabase.from("invoice_custom_lines").delete().eq("invoice_id", id);
    await supabase.from("client_credits").delete().eq("invoice_id", id);

    const { error } = await supabase.from("invoices_pms").delete().eq("id", id);
    if (error) {
      alert("Erreur suppression facture: " + error.message);
      return;
    }

    fetchAll();
  }

  async function loadLines(invoiceId) {
    const { data } = await supabase
      .from("invoice_custom_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("id", { ascending: true });

    return (data || []).map((line) => {
      const quantity = Number(line.quantity || 0);
      const totalTtc = Number(line.total_ttc || 0);
      const unitPriceTtc = quantity > 0 ? totalTtc / quantity : totalTtc;

      return {
        ...line,
        unit_price_ttc: round2(unitPriceTtc)
      };
    });
  }

  async function generateInvoicePdf(invoice) {
    try {
      const invoiceLines = await loadLines(invoice.id);

      const clientName =
        invoice.clients_pms?.nom || invoice.manual_client_name || "-";
      const clientEmail =
        invoice.clients_pms?.email || invoice.manual_client_email || "";
      const clientPhone =
        invoice.clients_pms?.telephone || invoice.manual_client_phone || "";
      const clientAddress =
        invoice.clients_pms?.adresse || invoice.manual_client_address || "";

      const blob = await buildInvoicePdf({
        invoice_number: invoice.invoice_number,
        created_at: invoice.created_at
          ? new Date(invoice.created_at).toLocaleDateString("fr-FR")
          : new Date().toLocaleDateString("fr-FR"),
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        client_address: clientAddress,
        status: translateInvoiceStatus(invoice.status),
        total_amount: Number(invoice.total_amount || 0),
        paid_amount: Number(invoice.paid_amount || 0),
        payment_method: invoice.payment_method,
        lines: invoiceLines
      });

      const fileName = `invoice-${invoice.invoice_number || invoice.id}-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("invoices-pdf")
        .upload(fileName, blob, {
          contentType: "application/pdf",
          upsert: true
        });

      if (uploadError) {
        alert("Erreur upload PDF facture: " + uploadError.message);
        return;
      }

      const { error: updateError } = await supabase
        .from("invoices_pms")
        .update({ pdf_url: fileName })
        .eq("id", invoice.id);

      if (updateError) {
        alert("Erreur enregistrement PDF: " + updateError.message);
        return;
      }

      alert("PDF facture généré");
      fetchAll();
    } catch (err) {
      alert("Erreur PDF facture: " + err.message);
    }
  }

  async function viewPdf(path) {
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("invoices-pdf")
      .createSignedUrl(path, 60);

    if (error) {
      alert("Erreur lecture PDF: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  const totals = useMemo(() => computeTotals(cart.map(computeLine)), [cart]);

  const selectedClient =
    customerMode === "existing" && form.client_id
      ? clients.find((c) => Number(c.id) === Number(form.client_id))
      : null;

  return (
    <Layout title="Factures" profile={profile}>
      <div className="grid">
        <div className="grid grid-2">
          <div className="card">
            <h2 className="section-title">Nouvelle facture / panier</h2>

            <form className="form-grid" onSubmit={handleInvoiceSubmit}>
              <input
                className="input"
                placeholder="Numéro facture"
                value={form.invoice_number}
                onChange={(e) =>
                  setForm({ ...form, invoice_number: e.target.value })
                }
                required
              />

              <select
                className="select"
                value={form.reservation_id}
                onChange={(e) => {
                  setForm({ ...form, reservation_id: e.target.value });
                  if (e.target.value) fillFromReservation(e.target.value);
                }}
              >
                <option value="">Charger depuis une réservation (optionnel)</option>
                {reservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    #{reservation.id} - {reservation.clients_pms?.nom || "-"} - chambre {reservation.rooms?.room_number || "-"}
                  </option>
                ))}
              </select>

              <div className="btn-row">
                <button
                  type="button"
                  className={`btn ${customerMode === "existing" ? "" : "btn-secondary"}`}
                  onClick={() => setCustomerMode("existing")}
                >
                  Client existant
                </button>

                <button
                  type="button"
                  className={`btn ${customerMode === "manual" ? "" : "btn-secondary"}`}
                  onClick={() => setCustomerMode("manual")}
                >
                  Client manuel
                </button>
              </div>

              {customerMode === "existing" ? (
                <>
                  <select
                    className="select"
                    value={form.client_id}
                    onChange={(e) =>
                      setForm({ ...form, client_id: e.target.value })
                    }
                  >
                    <option value="">Choisir un client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nom}
                      </option>
                    ))}
                  </select>

                  <div className="helper">
                    Crédit disponible :{" "}
                    {Number(selectedClient?.credit_balance || 0).toFixed(2)} €
                  </div>
                </>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="Nom client"
                    value={form.manual_client_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        manual_client_name: e.target.value
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Email client"
                    value={form.manual_client_email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        manual_client_email: e.target.value
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Téléphone client"
                    value={form.manual_client_phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        manual_client_phone: e.target.value
                      })
                    }
                  />

                  <textarea
                    className="textarea"
                    placeholder="Adresse client"
                    value={form.manual_client_address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        manual_client_address: e.target.value
                      })
                    }
                  />
                </>
              )}

              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => addQuickLine("petit_dejeuner")}
                >
                  + Petit-déjeuner
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => addQuickLine("navette")}
                >
                  + Navette
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => addQuickLine("vente")}
                >
                  + Vente
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => addQuickLine("autre")}
                >
                  + Autre prestation
                </button>
              </div>

              {cart.map((line, index) => (
                <div key={index} className="card" style={{ padding: 12 }}>
                  <div className="form-grid two">
                    <input
                      className="input"
                      placeholder="Désignation"
                      value={line.label}
                      onChange={(e) =>
                        updateCartLine(index, "label", e.target.value)
                      }
                    />

                    <input
                      className="input"
                      type="number"
                      placeholder="Quantité"
                      value={line.quantity}
                      onChange={(e) =>
                        updateCartLine(index, "quantity", e.target.value)
                      }
                    />

                    <input
                      className="input"
                      type="number"
                      placeholder="Prix TTC"
                      value={line.unit_price_ttc}
                      onChange={(e) =>
                        updateCartLine(index, "unit_price_ttc", e.target.value)
                      }
                    />

                    <select
                      className="select"
                      value={line.vat_rate}
                      onChange={(e) =>
                        updateCartLine(index, "vat_rate", e.target.value)
                      }
                    >
                      {VAT_OPTIONS.map((vat) => (
                        <option key={vat} value={vat}>
                          {vat}%
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="helper" style={{ marginTop: 10 }}>
                    HT : {Number(line.total_ht || 0).toFixed(2)} € | TVA :{" "}
                    {Number(line.total_tva || 0).toFixed(2)} € | TTC :{" "}
                    {Number(line.total_ttc || 0).toFixed(2)} €
                  </div>

                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => removeCartLine(index)}
                    >
                      Supprimer ligne
                    </button>
                  </div>
                </div>
              ))}

              <select
                className="select"
                value={form.payment_method}
                onChange={(e) =>
                  setForm({ ...form, payment_method: e.target.value })
                }
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>

              <input
                className="input"
                type="number"
                placeholder="Montant payé maintenant"
                value={form.paid_amount}
                onChange={(e) =>
                  setForm({ ...form, paid_amount: e.target.value })
                }
              />

              {customerMode === "existing" && (
                <input
                  className="input"
                  type="number"
                  placeholder="Crédit client utilisé"
                  value={form.credit_used}
                  onChange={(e) =>
                    setForm({ ...form, credit_used: e.target.value })
                  }
                />
              )}

              <textarea
                className="textarea"
                placeholder="Notes facture"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <div className="card" style={{ padding: 12 }}>
                <strong>Total HT :</strong> {totals.total_ht.toFixed(2)} €<br />
                <strong>Total TVA :</strong> {totals.total_tva.toFixed(2)} €<br />
                <strong>Total TTC :</strong> {totals.total_ttc.toFixed(2)} €
              </div>

              <button className="btn" type="submit">
                Enregistrer la facture
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Enregistrer un paiement</h2>

            <form className="form-grid" onSubmit={handlePaymentSubmit}>
              <select
                className="select"
                value={paymentForm.invoice_id}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    invoice_id: e.target.value
                  })
                }
                required
              >
                <option value="">Choisir une facture</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} -{" "}
                    {invoice.clients_pms?.nom || invoice.manual_client_name || "-"}
                  </option>
                ))}
              </select>

              <input
                className="input"
                type="number"
                placeholder="Montant payé"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    amount: e.target.value
                  })
                }
                required
              />

              <select
                className="select"
                value={paymentForm.method}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    method: e.target.value
                  })
                }
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Référence"
                value={paymentForm.reference}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    reference: e.target.value
                  })
                }
              />

              <button className="btn" type="submit">
                Enregistrer paiement
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Liste des factures</h2>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>N° facture</th>
                  <th>Client</th>
                  <th>Source</th>
                  <th>Montant</th>
                  <th>Payé</th>
                  <th>Paiement</th>
                  <th>Statut</th>
                  <th>PDF</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoice_number}</td>
                    <td>
                      {invoice.clients_pms?.nom ||
                        invoice.manual_client_name ||
                        "-"}
                    </td>
                    <td>{invoice.source || "-"}</td>
                    <td>{Number(invoice.total_amount || 0).toFixed(2)} €</td>
                    <td>{Number(invoice.paid_amount || 0).toFixed(2)} €</td>
                    <td>{invoice.payment_method || "-"}</td>
                    <td>{translateInvoiceStatus(invoice.status)}</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-secondary"
                          onClick={() => generateInvoicePdf(invoice)}
                        >
                          Générer PDF
                        </button>

                        {invoice.pdf_url ? (
                          <button
                            className="btn btn-success"
                            onClick={() => viewPdf(invoice.pdf_url)}
                          >
                            Voir PDF
                          </button>
                        ) : (
                          "Aucun"
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="btn-row">
                        {profile?.role === "admin" && (
                          <button
                            className="btn btn-danger"
                            onClick={() => deleteInvoice(invoice.id)}
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <hr className="soft" />

          <h3 className="section-title">Paiements enregistrés</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Facture ID</th>
                  <th>Montant</th>
                  <th>Méthode</th>
                  <th>Référence</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.invoice_id}</td>
                    <td>{Number(payment.amount || 0).toFixed(2)} €</td>
                    <td>{payment.method || "-"}</td>
                    <td>{payment.reference || "-"}</td>
                    <td>{payment.paid_at}</td>
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

function translateInvoiceStatus(status) {
  if (status === "draft") return "Brouillon";
  if (status === "sent") return "Envoyée";
  if (status === "paid") return "Payée";
  if (status === "partial") return "Partielle";
  if (status === "cancelled") return "Annulée";
  return status;
}
