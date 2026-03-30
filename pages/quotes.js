import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildQuotePdf } from "../lib/pdfUtils";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];

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

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [profile, setProfile] = useState(null);
  const [customerMode, setCustomerMode] = useState("existing");

  const [form, setForm] = useState({
    quote_number: "",
    client_id: "",
    manual_client_name: "",
    manual_client_email: "",
    manual_client_phone: "",
    manual_client_address: "",
    validity_days: 30,
    status: "draft"
  });

  const [cart, setCart] = useState([makeLine()]);

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
    const [{ data: quotesData }, { data: clientsData }] = await Promise.all([
      supabase
        .from("quotes_pms")
        .select("*, clients_pms(id, nom, email, telephone, adresse)")
        .order("id", { ascending: false }),
      supabase.from("clients_pms").select("*").order("nom", { ascending: true })
    ]);

    setQuotes(quotesData || []);
    setClients(clientsData || []);
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
      quote_number: "",
      client_id: "",
      manual_client_name: "",
      manual_client_email: "",
      manual_client_phone: "",
      manual_client_address: "",
      validity_days: 30,
      status: "draft"
    });
    setCart([makeLine()]);
    setCustomerMode("existing");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const computedLines = cart
      .map(computeLine)
      .filter((line) => String(line.label || "").trim() !== "");

    if (computedLines.length === 0) {
      alert("Ajoute au moins une prestation au devis");
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

    const payload = {
      quote_number: form.quote_number,
      client_id: customerMode === "existing" ? Number(form.client_id) : null,
      manual_client_name:
        customerMode === "manual" ? form.manual_client_name : null,
      manual_client_email:
        customerMode === "manual" ? form.manual_client_email : null,
      manual_client_phone:
        customerMode === "manual" ? form.manual_client_phone : null,
      manual_client_address:
        customerMode === "manual" ? form.manual_client_address : null,
      total_amount: totals.total_ttc,
      validity_days: Number(form.validity_days || 30),
      status: form.status
    };

    const { data: inserted, error } = await supabase
      .from("quotes_pms")
      .insert([payload])
      .select()
      .single();

    if (error) {
      alert("Erreur devis: " + error.message);
      return;
    }

    const linesToInsert = computedLines.map((line) => ({
      quote_id: inserted.id,
      label: line.label,
      quantity: Number(line.quantity || 0),
      unit_price: Number(line.unit_price_ht || 0),
      vat_rate: Number(line.vat_rate || 0),
      total_ht: Number(line.total_ht || 0),
      total_tva: Number(line.total_tva || 0),
      total_ttc: Number(line.total_ttc || 0)
    }));

    const { error: lineError } = await supabase
      .from("quote_custom_lines")
      .insert(linesToInsert);

    if (lineError) {
      alert("Erreur lignes devis: " + lineError.message);
      return;
    }

    alert("Devis enregistré");
    resetForm();
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

  async function deleteQuote(id) {
    if (!profile || profile.role !== "admin") {
      alert("Suppression réservée à l'admin");
      return;
    }

    if (!confirm("Supprimer ce devis ?")) return;

    await supabase.from("quote_custom_lines").delete().eq("quote_id", id);

    const { error } = await supabase.from("quotes_pms").delete().eq("id", id);

    if (error) {
      alert("Erreur suppression devis: " + error.message);
      return;
    }

    fetchAll();
  }

  async function convertQuoteToInvoice(quote) {
    try {
      const { data: quoteLines, error: quoteLinesError } = await supabase
        .from("quote_custom_lines")
        .select("*")
        .eq("quote_id", quote.id)
        .order("id", { ascending: true });

      if (quoteLinesError) {
        alert("Erreur lecture lignes devis: " + quoteLinesError.message);
        return;
      }

      const invoicePayload = {
        invoice_number: `F-${quote.quote_number}`,
        client_id: quote.client_id || null,
        manual_client_name: quote.manual_client_name || null,
        manual_client_email: quote.manual_client_email || null,
        manual_client_phone: quote.manual_client_phone || null,
        manual_client_address: quote.manual_client_address || null,
        total_amount: Number(quote.total_amount || 0),
        paid_amount: 0,
        status: "draft",
        payment_method: "Crédit",
        notes: `Facture créée depuis devis ${quote.quote_number}`
      };

      const { data: insertedInvoice, error: invoiceError } = await supabase
        .from("invoices_pms")
        .insert([invoicePayload])
        .select()
        .single();

      if (invoiceError) {
        alert("Erreur conversion devis → facture : " + invoiceError.message);
        return;
      }

      if (quoteLines?.length) {
        const invoiceLines = quoteLines.map((line) => ({
          invoice_id: insertedInvoice.id,
          label: line.label,
          quantity: Number(line.quantity || 0),
          unit_price: Number(line.unit_price || 0),
          vat_rate: Number(line.vat_rate || 0),
          total_ht: Number(line.total_ht || 0),
          total_tva: Number(line.total_tva || 0),
          total_ttc: Number(line.total_ttc || 0)
        }));

        const { error: linesError } = await supabase
          .from("invoice_custom_lines")
          .insert(invoiceLines);

        if (linesError) {
          alert("Erreur lignes facture : " + linesError.message);
          return;
        }
      }

      await supabase
        .from("quotes_pms")
        .update({ status: "accepted" })
        .eq("id", quote.id);

      alert("Devis converti en facture");
      fetchAll();
    } catch (err) {
      alert("Erreur conversion : " + err.message);
    }
  }

  async function loadLines(quoteId) {
    const { data } = await supabase
      .from("quote_custom_lines")
      .select("*")
      .eq("quote_id", quoteId)
      .order("id", { ascending: true });

    return (data || []).map((line) => ({
      ...line,
      unit_price_ttc:
        Number(line.quantity || 1) > 0
          ? Number(line.total_ttc || 0) / Number(line.quantity || 1)
          : 0
    }));
  }

  async function generateQuotePdf(quote) {
    try {
      const quoteLines = await loadLines(quote.id);

      const clientName =
        quote.clients_pms?.nom || quote.manual_client_name || "-";
      const clientEmail =
        quote.clients_pms?.email || quote.manual_client_email || "";
      const clientPhone =
        quote.clients_pms?.telephone || quote.manual_client_phone || "";
      const clientAddress =
        quote.clients_pms?.adresse || quote.manual_client_address || "";

      const blob = await buildQuotePdf({
        quote_number: quote.quote_number,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        client_address: clientAddress,
        status: translateQuoteStatus(quote.status),
        total_amount: quote.total_amount,
        validity_days: quote.validity_days || 30,
        lines: quoteLines
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

  const totals = useMemo(() => computeTotals(cart.map(computeLine)), [cart]);

  return (
    <Layout title="Devis" profile={profile}>
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Nouveau devis</h2>

          <form className="form-grid" onSubmit={handleSubmit}>
            <input
              className="input"
              placeholder="Numéro devis"
              value={form.quote_number}
              onChange={(e) =>
                setForm({ ...form, quote_number: e.target.value })
              }
              required
            />

            <div className="btn-row">
              <button
                type="button"
                className={`btn ${
                  customerMode === "existing" ? "" : "btn-secondary"
                }`}
                onClick={() => setCustomerMode("existing")}
              >
                Client existant
              </button>

              <button
                type="button"
                className={`btn ${
                  customerMode === "manual" ? "" : "btn-secondary"
                }`}
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

                <textarea
                  className="textarea"
                  placeholder="Adresse client"
                  value={form.manual_client_address}
                  onChange={(e) =>
                    setForm({ ...form, manual_client_address: e.target.value })
                  }
                />
              </>
            )}

            <input
              className="input"
              type="number"
              placeholder="Validité du devis (jours)"
              value={form.validity_days}
              onChange={(e) =>
                setForm({ ...form, validity_days: e.target.value })
              }
            />

            <select
              className="select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="accepted">Accepté</option>
              <option value="refused">Refusé</option>
            </select>

            <hr className="soft" />

            <h3 className="section-title">Panier des prestations</h3>

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

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addCartLine}
              >
                Ajouter prestation au panier
              </button>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <strong>Total HT :</strong> {totals.total_ht.toFixed(2)} €<br />
              <strong>Total TVA :</strong> {totals.total_tva.toFixed(2)} €<br />
              <strong>Total TTC :</strong> {totals.total_ttc.toFixed(2)} €
            </div>

            <button className="btn" type="submit">
              Valider le devis
            </button>
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
                  <th>Validité</th>
                  <th>Statut</th>
                  <th>PDF</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.quote_number}</td>
                    <td>
                      {quote.clients_pms?.nom || quote.manual_client_name || "-"}
                    </td>
                    <td>{Number(quote.total_amount || 0).toFixed(2)} €</td>
                    <td>{quote.validity_days || 30} jours</td>
                    <td>{translateQuoteStatus(quote.status)}</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-secondary"
                          onClick={() => generateQuotePdf(quote)}
                        >
                          Générer PDF
                        </button>

                        {quote.pdf_url ? (
                          <button
                            className="btn btn-success"
                            onClick={() => viewPdf(quote.pdf_url)}
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
                        <button
                          className="btn btn-secondary"
                          onClick={() => updateStatus(quote.id, "sent")}
                        >
                          Envoyé
                        </button>

                        <button
                          className="btn btn-success"
                          onClick={() => updateStatus(quote.id, "accepted")}
                        >
                          Accepté
                        </button>

                        <button
                          className="btn btn-success"
                          onClick={() => convertQuoteToInvoice(quote)}
                        >
                          Convertir en facture
                        </button>

                        <button
                          className="btn btn-danger"
                          onClick={() => updateStatus(quote.id, "refused")}
                        >
                          Refusé
                        </button>

                        {profile?.role === "admin" && (
                          <button
                            className="btn btn-danger"
                            onClick={() => deleteQuote(quote.id)}
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
