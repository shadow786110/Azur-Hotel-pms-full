import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildInvoicePdf } from "../lib/pdfUtils";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({
    invoice_number: "",
    client_id: "",
    total_amount: "",
    paid_amount: "",
    status: "draft",
  });

  const [paymentForm, setPaymentForm] = useState({
    invoice_id: "",
    amount: "",
    method: "",
    reference: "",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [{ data: invoicesData }, { data: clientsData }, { data: paymentsData }] = await Promise.all([
      supabase
        .from("invoices_pms")
        .select("*, clients_pms(id, nom)")
        .order("id", { ascending: false }),
      supabase
        .from("clients_pms")
        .select("*")
        .order("nom", { ascending: true }),
      supabase
        .from("payments_pms")
        .select("*")
        .order("id", { ascending: false }),
    ]);

    setInvoices(invoicesData || []);
    setClients(clientsData || []);
    setPayments(paymentsData || []);
  }

  async function handleInvoiceSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("invoices_pms").insert([
      {
        invoice_number: form.invoice_number,
        client_id: Number(form.client_id),
        total_amount: Number(form.total_amount || 0),
        paid_amount: Number(form.paid_amount || 0),
        status: form.status,
      },
    ]);

    if (error) {
      alert("Erreur facture: " + error.message);
      return;
    }

    alert("Facture enregistrée");
    setForm({
      invoice_number: "",
      client_id: "",
      total_amount: "",
      paid_amount: "",
      status: "draft",
    });
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
        reference: paymentForm.reference,
      },
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
        status,
      })
      .eq("id", invoiceId);

    alert("Paiement enregistré");
    setPaymentForm({
      invoice_id: "",
      amount: "",
      method: "",
      reference: "",
    });
    fetchAll();
  }

  async function updateInvoiceStatus(id, status) {
    const { error } = await supabase
      .from("invoices_pms")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("Erreur statut facture: " + error.message);
      return;
    }

    fetchAll();
  }

  async function generateInvoicePdf(invoice) {
    try {
      const blob = buildInvoicePdf({
        invoice_number: invoice.invoice_number,
        client_name: invoice.clients_pms?.nom || "-",
        status: translateInvoiceStatus(invoice.status),
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount,
      });

      const fileName = `invoice-${invoice.invoice_number || invoice.id}-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("invoices-pdf")
        .upload(fileName, blob, {
          contentType: "application/pdf",
          upsert: true,
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
    if (!path) {
      alert("Aucun PDF");
      return;
    }

    const { data, error } = await supabase.storage
      .from("invoices-pdf")
      .createSignedUrl(path, 60);

    if (error) {
      alert("Erreur lecture PDF: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  return (
    <Layout title="Factures">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Nouvelle facture</h2>

          <form onSubmit={handleInvoiceSubmit} style={{ display: "grid", gap: 12, maxWidth: 620 }}>
            <input
              type="text"
              placeholder="Numéro facture"
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              required
            />

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

            <input
              type="number"
              placeholder="Montant total"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
            />

            <input
              type="number"
              placeholder="Montant déjà payé"
              value={form.paid_amount}
              onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyée</option>
              <option value="partial">Partiellement payée</option>
              <option value="paid">Payée</option>
              <option value="cancelled">Annulée</option>
            </select>

            <button type="submit">Enregistrer facture</button>
          </form>
        </div>

        <div>
          <h2>Enregistrer un paiement</h2>

          <form onSubmit={handlePaymentSubmit} style={{ display: "grid", gap: 12, maxWidth: 620 }}>
            <select
              value={paymentForm.invoice_id}
              onChange={(e) => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })}
              required
            >
              <option value="">Choisir une facture</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {invoice.clients_pms?.nom || "-"}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Montant payé"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="Méthode (cash, virement, carte...)"
              value={paymentForm.method}
              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
            />

            <input
              type="text"
              placeholder="Référence"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            />

            <button type="submit">Enregistrer paiement</button>
          </form>
        </div>

        <div>
          <h2>Liste des factures</h2>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={th}>N° facture</th>
                <th style={th}>Client</th>
                <th style={th}>Montant</th>
                <th style={th}>Payé</th>
                <th style={th}>Statut</th>
                <th style={th}>PDF</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td style={td}>{invoice.invoice_number}</td>
                  <td style={td}>{invoice.clients_pms?.nom || "-"}</td>
                  <td style={td}>{invoice.total_amount}</td>
                  <td style={td}>{invoice.paid_amount}</td>
                  <td style={td}>{translateInvoiceStatus(invoice.status)}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => generateInvoicePdf(invoice)}>Générer PDF</button>
                      {invoice.pdf_url ? (
                        <button onClick={() => viewPdf(invoice.pdf_url)}>Voir PDF</button>
                      ) : (
                        "Aucun"
                      )}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => updateInvoiceStatus(invoice.id, "sent")}>Envoyée</button>
                      <button onClick={() => updateInvoiceStatus(invoice.id, "paid")}>Payée</button>
                      <button onClick={() => updateInvoiceStatus(invoice.id, "cancelled")}>Annulée</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 30 }}>Paiements enregistrés</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={th}>Facture ID</th>
                <th style={th}>Montant</th>
                <th style={th}>Méthode</th>
                <th style={th}>Référence</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td style={td}>{payment.invoice_id}</td>
                  <td style={td}>{payment.amount}</td>
                  <td style={td}>{payment.method || "-"}</td>
                  <td style={td}>{payment.reference || "-"}</td>
                  <td style={td}>{payment.paid_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

const th = { border: "1px solid #ddd", padding: 10, textAlign: "left" };
const td = { border: "1px solid #ddd", padding: 10 };
