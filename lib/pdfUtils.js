import { jsPDF } from "jspdf";

const HOTEL = {
  name: "AZUR HOTEL",
  address1: "48 rue Monseigneur de Beaumont",
  address2: "97400 Saint-Denis - La Réunion",
  email: "contact@azurhotel.re",
  bank: "Crédit Agricole",
  rib: "19906 00974 30021081317 07",
  iban: "FR76 1990 6009 7430 0210 8131 707",
  bic: "AGRIRERX"
};

function euro(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function drawHeader(doc, title) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(HOTEL.name, 20, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(HOTEL.address1, 20, 26);
  doc.text(HOTEL.address2, 20, 31);
  doc.text(`Email : ${HOTEL.email}`, 20, 36);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, 155, 20);
}

function drawBankBlock(doc, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Informations bancaires :", 20, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`BANQUE : ${HOTEL.bank}`, 20, y + 8);
  doc.text(`NOM : ${HOTEL.name}`, 20, y + 16);
  doc.text(`RIB : ${HOTEL.rib}`, 20, y + 24);
  doc.text(`IBAN : ${HOTEL.iban}`, 20, y + 32);
  doc.text(`BIC : ${HOTEL.bic}`, 20, y + 40);
}

function drawTable(doc, rows, startY) {
  let y = startY;

  doc.setFillColor(239, 244, 255);
  doc.rect(20, y, 170, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Désignation", 24, y + 7);
  doc.text("Qté", 118, y + 7);
  doc.text("PU", 138, y + 7);
  doc.text("Total", 168, y + 7);

  y += 14;

  doc.setFont("helvetica", "normal");

  rows.forEach((row) => {
    doc.text(String(row.label || "-"), 24, y);
    doc.text(String(row.quantity || 1), 118, y);
    doc.text(euro(row.unit_price || 0), 138, y);
    doc.text(euro(row.total || 0), 168, y);
    y += 10;
  });

  doc.line(20, y, 190, y);
  return y + 8;
}

export function buildQuotePdf(quote) {
  const doc = new jsPDF();

  drawHeader(doc, "DEVIS");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`N° devis : ${quote.quote_number || "-"}`, 20, 52);
  doc.text(`Date : ${new Date().toLocaleDateString()}`, 140, 52);

  doc.setFont("helvetica", "bold");
  doc.text("Client", 20, 66);
  doc.setFont("helvetica", "normal");
  doc.text(quote.client_name || "-", 20, 74);

  const rows = quote.lines?.length
    ? quote.lines
    : [
        {
          label: "Prestation hôtelière",
          quantity: 1,
          unit_price: Number(quote.total_amount || 0),
          total: Number(quote.total_amount || 0)
        }
      ];

  let y = drawTable(doc, rows, 88);

  doc.setFont("helvetica", "bold");
  doc.text(`Montant total : ${euro(quote.total_amount || 0)}`, 130, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.text("Merci de votre confiance.", 20, y);

  drawBankBlock(doc, 225);

  return doc.output("blob");
}

export function buildInvoicePdf(invoice) {
  const doc = new jsPDF();

  drawHeader(doc, "FACTURE");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`N° facture : ${invoice.invoice_number || "-"}`, 20, 52);
  doc.text(`Date : ${new Date().toLocaleDateString()}`, 140, 52);

  doc.setFont("helvetica", "bold");
  doc.text("Client", 20, 66);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.client_name || "-", 20, 74);

  const rows = invoice.lines?.length
    ? invoice.lines
    : [
        {
          label: "Prestation hôtelière",
          quantity: 1,
          unit_price: Number(invoice.total_amount || 0),
          total: Number(invoice.total_amount || 0)
        }
      ];

  let y = drawTable(doc, rows, 88);

  doc.setFont("helvetica", "bold");
  doc.text(`Total : ${euro(invoice.total_amount || 0)}`, 140, y);
  y += 8;
  doc.text(`Déjà payé : ${euro(invoice.paid_amount || 0)}`, 140, y);
  y += 8;
  doc.text(
    `Reste à payer : ${euro(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0))}`,
    118,
    y
  );
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.text("Merci pour votre règlement.", 20, y);

  drawBankBlock(doc, 225);

  return doc.output("blob");
}
