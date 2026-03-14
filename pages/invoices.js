import { useEffect, useState } from "react";
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

  const [form, setForm] = useState({
    invoice_number: "",
    client_id: "",
    paid_amount: "",
    status: "draft",
    payment_method: "Crédit"
  });

  const [lines, setLines] = useState([makeLine()]);

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

  function updateLine(index, field, value) {
    const copy = [...lines];
    copy[index] = computeLine({
      ...copy[index],
      [field]: value
    });
    setLines(copy);
  }

  function addLine() {
    setLines([...lines, makeLine()]);
  }

  function removeLine(index) {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleInvoiceSubmit(e) {
    e.preventDefault();

    const computedLines = lines.map(computeLine);
    const totals = computeInvoiceTotals(computedLines);
    const paid_amount = Number(form.paid_amount || 0);

    let status = form.status;
    if (paid_amount <= 0) status = "draft";
    if (paid_amount > 0 && paid_amount < totals.total_ttc) status = "partial";
    if (paid_amount >= totals.total_ttc) status = "paid";

    const { data: inserted, error } = await supabase
      .from("invoices_pms")
      .insert([
        {
          invoice_number: form.invoice_number,
          client_id: Number(form.client_id),
          total_amount: totals.total_ttc,
          paid_amount,
          status,
          payment_method: form.payment_method
        }
      ])
      .select()
      .single();

    if (error) {
      alert("Erreur facture: " + error.message);
      return;
    }

    if (computedLines.length) {
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

      await supabase.from("invoice_custom_lines").insert(linesToInsert);
    }

    if (form.payment_method === "Crédit" || paid_amount < totals.total_ttc) {
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
    setForm({
      invoice_number: "",
      client_id: "",
      paid_amount: "",
      status: "draft",
      payment_method: "Crédit"
    });
    setLines([makeLine()]);
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
    const newPaid = Math.max(0, Number(invoice?.paid_amount || 0) - Number(payment.amount || 0));
    const total = Number(invoice?.total_amount || 0);
