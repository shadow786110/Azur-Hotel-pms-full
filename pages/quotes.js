import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildQuotePdf } from "../lib/pdfUtils";

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    quote_number: "",
    client_id: "",
    total_amount: "",
    status: "draft"
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [{ data: quotesData }, { data: clientsData }] = await Promise.all([
      supabase.from("quotes_pms").select("*, clients_pms(id, nom)").order("id", { ascending: false }),
      supabase.from("clients_pms").select("*").order("nom", { ascending: true })
    ]);

    setQuotes(quotesData || []);
    setClients(clientsData || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("quotes_pms").insert([
      {
        quote_number: form.quote_number,
        client_id: Number(form.client_id),
        total_amount: Number(form.total_amount || 0),
        status: form.status
      }
    ]);

    if (error) {
      alert("Erreur devis: " + error.message);
      return;
    }

    alert("Devis enregistré");
    setForm({
      quote_number: "",
      client_id: "",
      total_amount: "",
      status: "draft"
    });
    fetchAll();
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("quotes_pms").update({ status }).eq("id", id);
    if (error) {
      alert("Erreur statut devis: " + error.message);
      return;
    }
    fetchAll();
  }

  async function generateQuotePdf(quote) {
    try {
      const blob = buildQuotePdf({
        quote_number: quote.quote_number,
        client_name: quote.clients_pms?.nom || "-",
        status: translateQuoteStatus(quote.status),
        total_amount: quote.total_amount
      });

      const fileName = `quote-${quote.quote_number || quote.id}-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("quotes-pdf")
        .upload(fileName, blob, {
          contentType: "application/pdf",
          upsert: true
        });

      if (uploadError) {
        alert("Erreur upload PDF devis: " + uploadError.message);
        return;
      }

      const { error: updateError } = await supabase
        .from("quotes_pms")
        .update({ pdf_url: fileName })
        .eq("id", quote.id);

      if (updateError) {
        alert("Erreur enregistrement PDF: " + updateError.message);
        return;
      }

      alert("PDF devis généré");
      fetchAll();
    } catch (err) {
      alert("Erreur PDF devis: " + err.message);
    }
  }

  async function viewPdf(path) {
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("quotes-pdf")
      .createSignedUrl(path, 60);

    if (error) {
      alert("Erreur lecture PDF: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  return (
    <Layout title="Devis">
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Nouveau devis</h2>

          <form className="form-grid" onSubmit={handleSubmit}>
            <input className="input" placeholder="Numéro devis" value={form.quote_number} onChange={(e) => setForm({ ...form, quote_number: e.target.value })} required />
            <select className="select" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
              <option value="">Choisir un client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.nom}</option>
              ))}
            </select>
            <input className="input" type="number" placeholder="Montant total" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="accepted">Accepté</option>
              <option value="refused">Refusé</option>
            </select>
            <button className="btn" type="submit">Enregistrer</button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Liste des devis</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>N° devis</th>
                  <th>Client</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>PDF</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.quote_number}</td>
                    <td>{quote.clients_pms?.nom || "-"}</td>
                    <td>{quote.total_amount}</td>
                    <td>{translateQuoteStatus(quote.status)}</td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" onClick={() => generateQuotePdf(quote)}>Générer PDF</button>
                        {quote.pdf_url ? (
                          <button className="btn btn-success" onClick={() => viewPdf(quote.pdf_url)}>Voir PDF</button>
                        ) : (
                          "Aucun"
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" onClick={() => updateStatus(quote.id, "sent")}>Envoyé</button>
                        <button className="btn btn-success" onClick={() => updateStatus(quote.id, "accepted")}>Accepté</button>
                        <button className="btn btn-danger" onClick={() => updateStatus(quote.id, "refused")}>Refusé</button>
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

function translateQuoteStatus(status) {
  if (status === "draft") return "Brouillon";
  if (status === "sent") return "Envoyé";
  if (status === "accepted") return "Accepté";
  if (status === "refused") return "Refusé";
  return status;
}
