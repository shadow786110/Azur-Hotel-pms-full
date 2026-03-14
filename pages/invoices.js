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

      const { error:
