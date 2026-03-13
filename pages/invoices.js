import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildInvoicePdf } from "../lib/pdfUtils";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    invoice_number: "",
    client_id: "",
    total_amount: "",
    paid_amount: "",
    status: "draft"
  });

  const [paymentForm, setPaymentForm] = useState({
    invoice_id: "",
    amount: "",
    method: "",
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

    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(data || null);
  }

  async function fetchAll() {
    const [{ data: invoicesData }, { data: clientsData }, { data: paymentsData }] = await Promise.all([
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

  async function handleInvoiceSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("invoices_pms").insert([
      {
        invoice_number: form.invoice_number,
        client_id: Number(form.client_id),
        total_amount: Number(form.total_amount || 0),
        paid_amount: Number(form.paid_amount || 0),
        status: form.status
      }
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
      status: "draft"
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

    alert("Paiement enregistré");
    setPaymentForm({
      invoice_id: "",
      amount: "",
      method: "",
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
    const newPaid = Math.max(0, Number(invoice?.paid_amount || 0) - Number(payment.amount || 0));
    const total = Number(invoice?.total_amount || 0);

    let status = "draft";
    if (newPaid > 0 && newPaid < total) status = "partial";
    if (newPaid >= total) status = "paid";

    await supabase.from("payments_pms").delete().eq("id", id);
    await supabase
      .from("invoices_pms")
      .update({ paid_amount: newPaid, status })
      .eq("id", payment.invoice_id);

    fetchAll();
  }

  async function updateInvoiceStatus(id, status) {
    const { error } = await supabase.from("invoices_pms").update({ status }).eq("id", id);
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
        client_email: invoice.clients_pms?.email || "",
        client_phone: invoice.clients_pms?.telephone || "",
        client_address: invoice.clients_pms?.adresse || "",
        status: translateInvoiceStatus(invoice.status),
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount
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

  return (
    <Layout title="Factures" profile={profile}>
      <div className="grid">
        <div className="grid grid-2">
          <div className="card">
            <h2 className="section-title">Nouvelle facture</h2>
            <form className="form-grid" onSubmit={handleInvoiceSubmit}>
              <input className="input" placeholder="Numéro facture" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required />
              <select className="select" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
                <option value="">Choisir un client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.nom}</option>
                ))}
              </select>
              <input className="input" type="number" placeholder="Montant total" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
              <input className="input" type="number" placeholder="Montant déjà payé" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
                <option value="partial">Partiellement payée</option>
                <option value="paid">Payée</option>
                <option value="cancelled">Annulée</option>
              </select>
              <button className="btn" type="submit">Enregistrer facture</button>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Enregistrer un paiement</h2>
            <form className="form-grid" onSubmit={handlePaymentSubmit}>
              <select className="select" value={paymentForm.invoice_id} onChange={(e) => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })} required>
                <option value="">Choisir une facture</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.clients_pms?.nom || "-"}
                  </option>
                ))}
              </select>
              <input className="input" type="number" placeholder="Montant payé" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
              <input className="input" placeholder="Méthode" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} />
              <input className="input" placeholder="Référence" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
              <button className="btn" type="submit">Enregistrer paiement</button>
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
                  <th>Statut</th>
                  <th>PDF</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoice_number}</td>
                    <td>{invoice.clients_pms?.nom || "-"}</td>
                    <td>{invoice.total_amount}</td>
                    <td>{invoice.paid_amount}</td>
                    <td>{translateInvoiceStatus(invoice.status)}</td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" onClick={() => generateInvoicePdf(invoice)}>Générer PDF</button>
                        {invoice.pdf_url ? (
                          <button className="btn btn-success" onClick={() => viewPdf(invoice.pdf_url)}>Voir PDF</button>
                        ) : (
                          "Aucun"
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" onClick={() => updateInvoiceStatus(invoice.id, "sent")}>Envoyée</button>
                        <button className="btn btn-success" onClick={() => updateInvoiceStatus(invoice.id, "paid")}>Payée</button>
                        <button className="btn btn-danger" onClick={() => updateInvoiceStatus(invoice.id, "cancelled")}>Annulée</button>
                        {profile?.role === "admin" && (
                          <button className="btn btn-danger" onClick={() => deleteInvoice(invoice.id)}>Supprimer</button>
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
