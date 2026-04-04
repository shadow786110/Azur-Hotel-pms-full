import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildQuotePdf } from "../lib/pdfUtils";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];

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

export default function Quotes() {
  const [profile, setProfile] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
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
    loadNextNumber();
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

  async function loadNextNumber() {
    const { data, error } = await supabase.rpc("next_document_number", {
      p_doc_type: "quote"
    });

    if (!error && data) {
      setForm((prev) => ({ ...prev, quote_number: data }));
    }
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

  async function saveQuotePdf(quoteRow, lines) {
    const client = clients.find((c) => Number(c.id) === Number(quoteRow.client_id));

    const blob = await buildQuotePdf({
      quote_number: quoteRow.quote_number,
      client_name: client?.nom || quoteRow.manual_client_name || "",
      client_email: client?.email || quoteRow.manual_client_email || "",
      client_phone: client?.telephone || quoteRow.manual_client_phone || "",
      client_address: client?.adresse || quoteRow.manual_client_address || "",
      status: quoteRow.status,
      total_amount: Number(quoteRow.total_amount || 0),
      validity_days: quoteRow.validity_days || 30,
      lines: lines.map((line) => ({
        ...line,
        total_ht: Number(line.total_ht || 0),
        total_ttc: Number(line.total_ttc || 0)
      }))
    });

    const fileName = `quote-${quoteRow.quote_number}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("quotes-pdf")
      .upload(fileName, blob, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) throw new Error(uploadError.message);

    const { error: updateError } = await supabase
      .from("quotes_pms")
      .update({ pdf_url: fileName })
      .eq("id", quoteRow.id);

    if (updateError) throw new Error(updateError.message);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const computedLines = cart
      .map(computeLine)
      .filter((line) => String(line.label || "").trim() !== "");

    if (computedLines.length === 0) {
      alert("Ajoute au moins une prestation");
      return;
    }

    if (customerMode === "existing" && !form.client_id) {
      alert("Choisir un client");
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

    try {
      await saveQuotePdf(inserted, linesToInsert);
    } catch (err) {
      alert("Erreur PDF devis: " + err.message);
      return;
    }

    alert("Devis enregistré avec PDF sauvegardé");

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
    fetchAll();
    loadNextNumber();
  }

  async function loadLines(quoteId) {
    const { data } = await supabase
      .from("quote_custom_lines")
      .select("*")
      .eq("quote_id", quoteId)
      .order("id", { ascending: true });

    return data || [];
  }

  async function generateQuotePdf(quote) {
    try {
      const lines = await loadLines(quote.id);
      await saveQuotePdf(quote, lines);
      alert("PDF devis généré et sauvegardé");
      fetchAll();
    } catch (err) {
      alert("Erreur PDF devis: " + err.message);
    }
  }

  async function viewPdf(path) {
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("quotes-pdf")
      .createSignedUrl(path, 120);

    if (error) {
      alert("Erreur lecture PDF: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  const totals = useMemo(() => computeTotals(cart.map(computeLine)), [cart]);

  return (
    <Layout title="Devis" profile={profile}>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h2 className="section-title">Nouveau devis</h2>

          <form className="form-grid" onSubmit={handleSubmit}>
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

            <input
              className="input"
              placeholder="N° devis auto"
              value={form.quote_number}
              readOnly
            />

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
              </div>
            )}

            <div className="grid grid-2">
              <input
                className="input"
                type="number"
                placeholder="Validité (jours)"
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
            </div>

            {cart.map((line, index) => (
              <div
                key={index}
                className="card"
                style={{ padding: 14, background: "#f8fbff", border: "1px solid #e4edf7" }}
              >
                <div className="grid grid-4">
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
                    placeholder="Qté"
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
                        TVA {vat}%
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

            <button
              type="button"
              className="btn btn-secondary"
              onClick={addCartLine}
            >
              + Ajouter ligne
            </button>

            <div className="card" style={{ background: "#f4f9ff" }}>
              <strong>Total HT :</strong> {totals.total_ht.toFixed(2)} €<br />
              <strong>Total TVA :</strong> {totals.total_tva.toFixed(2)} €<br />
              <strong>Total TTC :</strong> {totals.total_ttc.toFixed(2)} €
            </div>

            <button className="btn" type="submit">
              Enregistrer le devis
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
                  <th>Statut</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.quote_number}</td>
                    <td>{quote.clients_pms?.nom || quote.manual_client_name || "-"}</td>
                    <td>{Number(quote.total_amount || 0).toFixed(2)} €</td>
                    <td>{quote.status}</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-secondary"
                          onClick={() => generateQuotePdf(quote)}
                        >
                          PDF
                        </button>
                        {quote.pdf_url ? (
                          <button
                            className="btn btn-success"
                            onClick={() => viewPdf(quote.pdf_url)}
                          >
                            Ouvrir
                          </button>
                        ) : (
                          <span className="helper">Aucun</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan="5">Aucun devis.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
