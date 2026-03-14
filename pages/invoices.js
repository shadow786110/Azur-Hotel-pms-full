import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildInvoicePdf } from "../lib/pdfUtils";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];
const PAYMENT_METHODS = ["Esp", "Cb", "Chq", "Virement", "Crédit"];

function makeLine() {
  return {
    label: "",
    quantity: 1,
    unit_price: 0,
    vat_rate: 0,
    total_ht: 0,
    total_tva: 0,
    total_ttc: 0
  };
}

function computeLine(line) {
  const quantity = Number(line.quantity || 0);
  const unit_price = Number(line.unit_price || 0);
  const vat_rate = Number(line.vat_rate || 0);

  const total_ht = quantity * unit_price;
  const total_tva = total_ht * (vat_rate / 100);
  const total_ttc = total_ht + total_tva;

  return {
    ...line,
    total_ht,
    total_tva,
    total_ttc
  };
}

function computeInvoiceTotals(lines) {
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

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [profile, setProfile] = useState(null);

  const [customerMode, setCustomerMode] = useState("existing");

  const [form, setForm] = useState({
    invoice_number: "",
    client_id: "",
    manual_client_name: "",
    manual_client_email: "",
    manual_client_phone: "",
    manual_client_address: "",
    paid_amount: "",
    status: "draft",
    payment_method: "Crédit"
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
    const [{ data: invoicesData }, { data: clientsData }, { data: paymentsData }] =
      await Promise.all([
        supabase
          .from("invoices_pms")
          .select("*, clients_pms(id, nom, email, telephone, adresse)")
          .order("id", { ascending: false }),
        supabase.from("clients_pms").select("*").order("nom", { ascending: true }),
        supabase.from("payments_pms").select("*").order("id", { ascending: false })
      ]);

    setInvoices(invoicesData || []);
    setClients(clientsData || []);
    setPayments(paymentsData || []);
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

  function resetForm() {
    setForm({
      invoice_number: "",
      client_id: "",
      manual_client_name: "",
      manual_client_email: "",
      manual_client_phone: "",
      manual_client_address: "",
      paid_amount: "",
      status: "draft",
      payment_method: "Crédit"
    });
    setCart([makeLine()]);
    setCustomerMode("existing");
  }

  async function handleInvoiceSubmit(e) {
    e.preventDefault();

    const computedLines = cart
      .map(computeLine)
      .filter((line) => String(line.label || "").trim() !== "");

    if (computedLines.length === 0) {
      alert("Ajoute au moins une prestation dans le panier");
      return;
    }

    if (customerMode === "existing" && !form.client_id) {
      alert("Choisir un client ou passer en saisie manuelle");
      return;
    }

    if (customerMode === "manual" && !form.manual_client_name.trim()) {
      alert("Saisir au moins le nom du client manuel");
      return;
    }

    const totals = computeInvoiceTotals(computedLines);
    const paid_amount = Number(form.paid_amount || 0);

    let status = form.status;
    if (paid_amount <= 0) status = "draft";
    if (paid_amount > 0 && paid_amount < totals.total_ttc) status = "partial";
    if (paid_amount >= totals.total_ttc) status = "paid";

    const payload = {
      invoice_number: form.invoice_number,
      client_id: customerMode === "existing" ? Number(form.client_id) : null,
      manual_client_name: customerMode === "manual" ? form.manual_client_name : null,
      manual_client_email: customerMode === "manual" ? form.manual_client_email : null,
      manual_client_phone: customerMode === "manual" ? form.manual_client_phone : null,
      manual_client_address: customerMode === "manual" ? form.manual_client_address : null,
      total_amount: totals.total_ttc,
      paid_amount,
      status,
      payment_method: form.payment_method
    };

    const { data: inserted, error } = await supabase
      .from("invoices_pms")
      .insert([payload])
      .select()
      .single();

    if (error) {
      alert("Erreur facture: " + error.message);
      return;
    }

    const linesToInsert = computedLines.map((line) => ({
      invoice_id: inserted.id,
      label: line.label,
      quantity: Number(line.quantity || 0),
      unit_price: Number(line.unit_price || 0),
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

    if (
      (form.payment_method === "Crédit" || paid_amount < totals.total_ttc) &&
      customerMode === "existing" &&
      form.client_id
    ) {
      const amountDue = totals.total_ttc - paid_amount;
      if (amountDue > 0) {
        await supabase.from("client_credits").insert([
          {
            client_id: Number(form.client_id),
            invoice_id: inserted.id,
            amount: amountDue,
            status: "open"
          }
        ]);
      }
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

  async function deletePayment(id) {
    if (!profile || profile.role !== "admin") {
      alert("Suppression réservée à l'admin");
      return;
    }

    if (!confirm("Supprimer ce paiement ?")) return;

    const payment = payments.find((p) => p.id === id);
    if (!payment) return;

    const invoice = invoices.find((i) => i.id === payment.invoice_id);
    const unpaid = Math.max(
      0,
      Number(invoice?.paid_amount || 0) - Number(payment.amount || 0)
    );
    const total = Number(invoice?.total_amount || 0);

    let status = "draft";
    if (unpaid > 0 && unpaid < total) status = "partial";
    if (unpaid >= total) status = "paid";

    await supabase.from("payments_pms").delete().eq("id", id);
    await supabase
      .from("invoices_pms")
      .update({ paid_amount: unpaid, status })
      .eq("id", payment.invoice_id);

    if (invoice?.client_id && unpaid < total) {
      const existing = await supabase
        .from("client_credits")
        .select("*")
        .eq("invoice_id", payment.invoice_id)
        .maybeSingle();

      if (existing.data) {
        await supabase
          .from("client_credits")
          .update({ amount: total - unpaid, status: "open" })
          .eq("invoice_id", payment.invoice_id);
      } else {
        await supabase.from("client_credits").insert([
          {
            client_id: invoice.client_id,
            invoice_id: payment.invoice_id,
            amount: total - unpaid,
            status: "open"
          }
        ]);
      }
    }

    fetchAll();
  }

  async function loadLines(invoiceId) {
    const { data } = await supabase
      .from("invoice_custom_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("id", { ascending: true });

    return data || [];
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
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        client_address: clientAddress,
        status: translateInvoiceStatus(invoice.status),
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount,
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

  const totals = useMemo(
    () => computeInvoiceTotals(cart.map(computeLine)),
    [cart]
  );

  return (
    <Layout title="Factures" profile={profile}>
      <div className="grid">
        <div className="grid grid-2">
          <div className="card">
            <h2 className="section-title">Nouvelle facture</h2>

            <form className="form-grid" onSubmit={handleInvoiceSubmit}>
              <input
                className="input"
                placeholder="Numéro facture"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                required
              />

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
                <select
                  className="select"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                >
                  <option value="">Choisir un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nom}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="Nom client"
                    value={form.manual_client_name}
                    onChange={(e) => setForm({ ...form, manual_client_name: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Email client"
                    value={form.manual_client_email}
                    onChange={(e) => setForm({ ...form, manual_client_email: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Téléphone client"
                    value={form.manual_client_phone}
                    onChange={(e) => setForm({ ...form, manual_client_phone: e.target.value })}
                  />
                  <textarea
                    className="textarea"
                    placeholder="Adresse client"
                    value={form.manual_client_address}
                    onChange={(e) => setForm({ ...form, manual_client_address: e.target.value })}
                  />
                </>
              )}

              <select
                className="select"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <input
                className="input"
                type="number"
                placeholder="Montant déjà payé"
                value={form.paid_amount}
                onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
              />

              <hr className="soft" />

              <h3 className="section-title">Panier des prestations</h3>

              {cart.map((line, index) => (
                <div key={index} className="card" style={{ padding: 12 }}>
                  <div className="form-grid two">
                    <input
                      className="input"
                      placeholder="Désignation"
                      value={line.label}
                      onChange={(e) => updateCartLine(index, "label", e.target.value)}
                    />

                    <input
                      className="input"
                      type="number"
                      placeholder="Quantité"
                      value={line.quantity}
                      onChange={(e) => updateCartLine(index, "quantity", e.target.value)}
                    />

                    <input
                      className="input"
                      type="number"
                      placeholder="Prix unitaire HT"
                      value={line.unit_price}
                      onChange={(e) => updateCartLine(index, "unit_price", e.target.value)}
                    />

                    <select
                      className="select"
                      value={line.vat_rate}
                      onChange={(e) => updateCartLine(index, "vat_rate", e.target.value)}
                    >
                      {VAT_OPTIONS.map((vat) => (
                        <option key={vat} value={vat}>{vat}%</option>
                      ))}
                    </select>
                  </div>

                  <div className="helper" style={{ marginTop: 10 }}>
                    HT : {Number(line.total_ht || 0).toFixed(2)} € | TVA : {Number(line.total_tva || 0).toFixed(2)} € | TTC : {Number(line.total_ttc || 0).toFixed(2)} €
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

              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={addCartLine}>
                  Ajouter prestation au panier
                </button>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <strong>Total HT :</strong> {totals.total_ht.toFixed(2)} €<br />
                <strong>Total TVA :</strong> {totals.total_tva.toFixed(2)} €<br />
                <strong>Total TTC :</strong> {totals.total_ttc.toFixed(2)} €
              </div>

              <button className="btn" type="submit">
                Valider la facture
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Enregistrer un paiement</h2>
            <form className="form-grid" onSubmit={handlePaymentSubmit}>
              <select
                className="select"
                value={paymentForm.invoice_id}
                onChange={(e) => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })}
                required
              >
                <option value="">Choisir une facture</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.clients_pms?.nom || invoice.manual_client_name || "-"}
                  </option>
                ))}
              </select>

              <input
                className="input"
                type="number"
                placeholder="Montant payé"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
              />

              <select
                className="select"
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Référence"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
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
                    <td>{invoice.clients_pms?.nom || invoice.manual_client_name || "-"}</td>
                    <td>{Number(invoice.total_amount || 0).toFixed(2)} €</td>
                    <td>{Number(invoice.paid_amount || 0).toFixed(2)} €</td>
                    <td>{invoice.payment_method || "-"}</td>
                    <td>{translateInvoiceStatus(invoice.status)}</td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" onClick={() => generateInvoicePdf(invoice)}>
                          Générer PDF
                        </button>
                        {invoice.pdf_url ? (
                          <button className="btn btn-success" onClick={() => viewPdf(invoice.pdf_url)}>
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
                          <button className="btn btn-danger" onClick={() => deleteInvoice(invoice.id)}>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.invoice_id}</td>
                    <td>{payment.amount}</td>
                    <td>{payment.method || "-"}</td>
                    <td>{payment.reference || "-"}</td>
                    <td>{payment.paid_at}</td>
                    <td>
                      {profile?.role === "admin" ? (
                        <button className="btn btn-danger" onClick={() => deletePayment(payment.id)}>
                          Supprimer
                        </button>
                      ) : (
                        "-"
                      )}
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

function translateInvoiceStatus(status) {
  if (status === "draft") return "Brouillon";
  if (status === "sent") return "Envoyée";
  if (status === "paid") return "Payée";
  if (status === "partial") return "Partielle";
  if (status === "cancelled") return "Annulée";
  return status;
}
