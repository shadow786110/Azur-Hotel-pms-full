import { jsPDF } from "jspdf";

export function buildQuotePdf(quote) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("AZUR HOTEL", 20, 20);

  doc.setFontSize(14);
  doc.text("DEVIS", 20, 32);

  doc.setFontSize(11);
  doc.text(`N° devis : ${quote.quote_number || "-"}`, 20, 45);
  doc.text(`Client : ${quote.client_name || "-"}`, 20, 53);
  doc.text(`Statut : ${quote.status || "-"}`, 20, 61);
  doc.text(`Montant : ${quote.total_amount || 0}`, 20, 69);
  doc.text(`Date : ${new Date().toLocaleDateString()}`, 20, 77);

  doc.setFontSize(10);
  doc.text("Merci de votre confiance.", 20, 95);

  return doc.output("blob");
}

export function buildInvoicePdf(invoice) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("AZUR HOTEL", 20, 20);

  doc.setFontSize(14);
  doc.text("FACTURE", 20, 32);

  doc.setFontSize(11);
  doc.text(`N° facture : ${invoice.invoice_number || "-"}`, 20, 45);
  doc.text(`Client : ${invoice.client_name || "-"}`, 20, 53);
  doc.text(`Statut : ${invoice.status || "-"}`, 20, 61);
  doc.text(`Montant total : ${invoice.total_amount || 0}`, 20, 69);
  doc.text(`Montant payé : ${invoice.paid_amount || 0}`, 20, 77);
  doc.text(`Reste à payer : ${(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0))}`, 20, 85);
  doc.text(`Date : ${new Date().toLocaleDateString()}`, 20, 93);

  doc.setFontSize(10);
  doc.text("Merci pour votre règlement.", 20, 111);

  return doc.output("blob");
}
