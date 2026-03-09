import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    quote_number: "",
    client_id: "",
    total_amount: "",
    status: "draft",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [{ data: quotesData }, { data: clientsData }] = await Promise.all([
      supabase.from("quotes_pms").select("*, clients_pms(id, nom)").order("id", { ascending: false }),
      supabase.from("clients_pms").select("*").order("nom", { ascending: true }),
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
        status: form.status,
      },
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
      status: "draft",
    });
    fetchAll();
  }

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from("quotes_pms")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("Erreur statut devis: " + error.message);
      return;
    }

    fetchAll();
  }

  return (
    <Layout title="Devis">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Nouveau devis</h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 620 }}>
            <input
              type="text"
              placeholder="Numéro devis"
              value={form.quote_number}
              onChange={(e) => setForm({ ...form, quote_number: e.target.value })}
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

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="accepted">Accepté</option>
              <option value="refused">Refusé</option>
            </select>

            <button type="submit">Enregistrer</button>
          </form>
        </div>

        <div>
          <h2>Liste des devis</h2>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={th}>N° devis</th>
                <th style={th}>Client</th>
                <th style={th}>Montant</th>
                <th style={th}>Statut</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td style={td}>{quote.quote_number}</td>
                  <td style={td}>{quote.clients_pms?.nom || "-"}</td>
                  <td style={td}>{quote.total_amount}</td>
                  <td style={td}>{translateQuoteStatus(quote.status)}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => updateStatus(quote.id, "sent")}>Envoyé</button>
                      <button onClick={() => updateStatus(quote.id, "accepted")}>Accepté</button>
                      <button onClick={() => updateStatus(quote.id, "refused")}>Refusé</button>
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

function translateQuoteStatus(status) {
  if (status === "draft") return "Brouillon";
  if (status === "sent") return "Envoyé";
  if (status === "accepted") return "Accepté";
  if (status === "refused") return "Refusé";
  return status;
}

const th = { border: "1px solid #ddd", padding: 10, textAlign: "left" };
const td = { border: "1px solid #ddd", padding: 10 };
