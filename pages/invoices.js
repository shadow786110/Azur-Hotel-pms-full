import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildInvoicePdf } from "../lib/pdfUtils";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];
const PAYMENT_METHODS = ["Esp", "Cb", "Chq", "Virement", "Crédit"];

function round2(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

function makeLine() {
  return {
    label: "",
    quantity: 1,
    unit_price_ttc: 0,
    vat_rate: 0,
    total_ht: 0,
    total_tva: 0,
    total_ttc: 0,
    product_id: null,
    is_stock_item: false
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

export default function Invoices() {
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);

  const [customerMode, setCustomerMode] = useState("existing");

  const [form, setForm] = useState({
    invoice_number: "",
    client_id: "",
    manual_client_name: "",
    manual_client_email: "",
    manual_client_phone: "",
    manual_client_address: "",
    paid_amount: "",
    payment_method: "Esp",
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
      p_doc_type: "invoice"
    });

    if (!error && data) {
      setForm((prev) => ({ ...prev, invoice_number: data }));
    }
  }

  async function fetchAll() {
    const [
      { data: invoicesData },
      { data: clientsData },
      { data: paymentsData },
      { data: productsData }
    ] = await Promise.all([
      supabase
        .from("invoices_pms")
        .select("*, clients_pms(id, nom, email, telephone, adresse, credit_balance)")
        .order("id", { ascending: false }),
      supabase.from("clients_pms").select("*").order("nom", { ascending: true }),
      supabase.from("payments_pms").select("*").order("id", { ascending: false }),
      supabase.from("products").select("*").order("name", { ascending: true })
    ]);

    setInvoices(invoicesData || []);
    setClients(clientsData || []);
    setPayments(paymentsData || []);
    setProducts(productsData || []);
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

  function addProductLine(productId) {
    const product = products.find((p) => Number(p.id) === Number(productId));
    if (!product) return;

    setCart([
      ...cart,
      computeLine({
        label: product.name,
        quantity: 1,
        unit_price_ttc: Number(product.price || 0),
        vat_rate: product.category === "vente" ? 8.5 : 0,
        product_id: product.id,
        is_stock_item: true
      })
    ]);
  }

  async function applyStockOutputs(lines, invoiceId) {
    for (const line of lines) {
      if (!line.product_id || !line.is_stock_item) continue;

      const product = products.find((p) => Number(p.id) === Number(line.product_id));
      const qty = Number(line.quantity || 0);

      if (!product) throw new Error(`Produit introuvable : ${line.label}`);
      if (Number(product.stock || 0) < qty) {
        throw new Error(`Stock insuffisant pour ${product.name}`);
      }
    }

    for (const line of lines) {
      if (!line.product_id || !line.is_stock_item) continue;

      const product = products.find((p) => Number(p.id) === Number(line.product_id));
      const qty = Number(line.quantity || 0);
      const newStock = Number(product.stock || 0) - qty;

      const { error: moveError } = await supabase.from("stock_movements").insert([
        {
          product_id: Number(line.product_id),
          quantity: qty,
          type: "out",
          reason: `Vente facture ${invoiceId}`
        }
      ]);

      if (moveError) throw new Error(moveError.message);

      const { error: stockError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", Number(line.product_id));

      if (stockError) throw new Error(stockError.message);
    }
  }

  async function loadLines(invoiceId) {
    const { data } = await supabase
      .from("invoice_custom_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("id", { ascending: true });

    return data || [];
  }

  async function saveInvoicePdf(invoiceRow, lines) {
    const client = clients.find((c) => Number(c.id) === Number(invoiceRow.client_id));

    const blob = await buildInvoicePdf({
      invoice_number: invoiceRow.invoice_number,
      created_at: invoiceRow.created_at
        ? new Date(invoiceRow.created_at).toLocaleDateString("fr-FR")
        : new Date().toLocaleDateString("fr-FR"),
      client_name: client?.nom || invoiceRow.manual_client_name || "",
      client_email: client?.email || invoiceRow.manual_client_email || "",
      client_phone: client?.telephone || invoiceRow.manual_client_phone || "",
      client_address: client?.adresse || invoiceRow.manual_client_address || "",
      status: invoiceRow.status,
      total_amount: Number(invoiceRow.total_amount || 0),
      paid_amount: Number(invoiceRow.paid_amount || 0),
      payment_method: invoiceRow.payment_method,
      lines: lines.map((line) => ({
        ...line,
        total_ht: Number(line.total_ht || 0),
        total_ttc: Number(line.total_ttc || 0)
      }))
    });

    const fileName = `invoice-${invoiceRow.invoice_number}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("invoices-pdf")
      .upload(fileName, blob, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) throw new Error(uploadError.message);

    const { error: updateError } = await supabase
      .from("invoices_pms")
      .update({ pdf_url: fileName })
      .eq("id", invoiceRow.id);

    if (updateError) throw new Error(updateError.message);
  }

  async function handleInvoiceSubmit(e) {
    e.preventDefault();

    const computedLines = cart
      .map(computeLine)
      .filter((line) => String(line.label || "").trim() !== "");

    if (computedLines.length === 0) {
      alert("Ajoute au moins une ligne");
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
      total_amount: Number(totals.total_ttc || 0),
      paid_amount: accountedPaid,
      status,
      payment_method: form.payment_method,
      credit_used: creditUsed,
      source: "manual",
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
      unit_price: Number(
        (Number(line.total_ht || 0) / Math.max(1, Number(line.quantity || 1))) || 0
      ),
      vat_rate: Number(line.vat_rate || 0),
      total_ht: Number(line.total_ht || 0),
      total_tva: Number(line.total_tva || 0),
      total_ttc: Number(line.total_ttc || 0),
      product_id: line.product_id ? Number(line.product_id) : null
    }));

    const { error: lineError } = await supabase
      .from("invoice_custom_lines")
      .insert(linesToInsert);

    if (lineError) {
      alert("Erreur lignes facture: " + lineError.message);
      return;
    }

    try {
      if (status === "paid") {
        await applyStockOutputs(computedLines, insertedInvoice.id);
      }
      await saveInvoicePdf(insertedInvoice, linesToInsert);
    } catch (err) {
      alert("Erreur après création: " + err.message);
      return;
    }

    if (paidAmount > 0) {
      await supabase.from("payments_pms").insert([
        {
          invoice_id: insertedInvoice.id,
          amount: paidAmount,
          method: form.payment_method,
          reference: "Paiement initial"
        }
      ]);
    }

    alert("Facture enregistrée avec PDF sauvegardé");

    setForm({
      invoice_number: "",
      client_id: "",
      manual_client_name: "",
      manual_client_email: "",
      manual_client_phone: "",
      manual_client_address: "",
      paid_amount: "",
      payment_method: "Esp",
      credit_used: "",
      notes: ""
    });
    setCart([makeLine()]);
    setCustomerMode("existing");
    fetchAll();
    loadNextNumber();
  }

  async function generateInvoicePdf(invoice) {
    try {
      const lines = await loadLines(invoice.id);
      await saveInvoicePdf(invoice, lines);
      alert("PDF facture généré et sauvegardé");
      fetchAll();
    } catch (err) {
      alert("Erreur PDF facture: " + err.message);
    }
  }

  async function viewPdf(path) {
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("invoices-pdf")
      .createSignedUrl(path, 120);

    if (error) {
      alert("Erreur lecture PDF: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  const totals = useMemo(() => computeTotals(cart.map(computeLine)), [cart]);

  return (
    <Layout title="Factures" profile={profile}>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h2 className="section-title">Nouvelle facture</h2>

          <form className="form-grid" onSubmit={handleInvoiceSubmit}>
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
              placeholder="N° facture auto"
              value={form.invoice_number}
              readOnly
            />

            {customerMode === "existing" ? (
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

            <select
              className="select"
              onChange={(e) => {
                if (e.target.value) {
                  addProductLine(e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
            >
              <option value="">Ajouter un produit du stock</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - stock {product.stock} - {Number(product.price || 0).toFixed(2)} €
                </option>
              ))}
            </select>

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

            <div className="grid grid-2">
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
                placeholder="Montant payé"
                value={form.paid_amount}
                onChange={(e) =>
                  setForm({ ...form, paid_amount: e.target.value })
                }
              />
            </div>

            <textarea
              className="textarea"
              placeholder="Notes facture"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <div className="card" style={{ background: "#f4f9ff" }}>
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
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoice_number}</td>
                    <td>{invoice.clients_pms?.nom || invoice.manual_client_name || "-"}</td>
                    <td>{Number(invoice.total_amount || 0).toFixed(2)} €</td>
                    <td>{Number(invoice.paid_amount || 0).toFixed(2)} €</td>
                    <td>{invoice.status}</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-secondary"
                          onClick={() => generateInvoicePdf(invoice)}
                        >
                          PDF
                        </button>
                        {invoice.pdf_url ? (
                          <button
                            className="btn btn-success"
                            onClick={() => viewPdf(invoice.pdf_url)}
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
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan="6">Aucune facture.</td>
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
