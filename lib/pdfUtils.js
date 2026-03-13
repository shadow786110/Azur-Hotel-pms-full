import { jsPDF } from "jspdf";

const HOTEL = {
  name: "AZUR HOTEL",
  address1: "48 rue Monseigneur de Beaumont 97400 St Denis",
  address2: " www.azurhotel.re ",
  phone: "+262693644848",
  email: "contact@azurhotel.re",
  bank: "Crédit Agricole",
  rib: "19906 00974 30021081317 07",
  iban: "FR76 1990 6009 7430 0210 8131 707",
  bic: "AGRIRERX",
  quoteValidityText: "Devis valable 3 jours à compter de sa date d’émission."
};

function euro(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function safe(value, fallback = "-") {
  return value ? String(value) : fallback;
}

function addLogo(doc) {
  try {
    doc.addImage("/logo-azur-hotel.jpg", "JPEG", 145, 10, 45, 28);
  } catch (e) {
    // logo optionnel si non chargé
  }
}

function drawHeader(doc, title) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(HOTEL.name, 20, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(HOTEL.address1, 20, 26);
  doc.text(HOTEL.address2, 20, 31);
  doc.text(`Téléphone : ${HOTEL.phone}`, 20, 36);
  doc.text(`Email : ${HOTEL.email}`, 20, 41);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, 20, 54);

  addLogo(doc);
}

function drawClientBlock(doc, data, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Client", 20, y);

  doc.setFont("helvetica", "normal");
  doc.text(safe(data.client_name), 20, y + 8);
  if (data.client_address) doc.text(safe(data.client_address), 20, y + 14);
  if (data.client_email) doc.text(`Email : ${safe(data.client_email)}`, 20, y + 20);
  if (data.client_phone) doc.text(`Téléphone : ${safe(data.client_phone)}`, 20, y + 26);
}

function drawMetaBlock(doc, data, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${data.labelNumber} : ${safe(data.number)}`, 130, y);
  doc.text(`Date : ${safe(data.date)}`, 130, y + 8);
  if (data.status) doc.text(`Statut : ${safe(data.status)}`, 130, y + 16);
  if (data.reservationNumber) doc.text(`Réservation : ${safe(data.reservationNumber)}`, 130, y + 24);
  if (data.checkIn) doc.text(`Arrivée : ${safe(data.checkIn)}`, 130, y + 32);
  if (data.checkOut) doc.text(`Départ : ${safe(data.checkOut)}`, 130, y + 40);
  if (data.paymentMethod) doc.text(`Paiement : ${safe(data.paymentMethod)}`, 130, y + 48);
}

function drawLinesTable(doc, rows, startY) {
  let y = startY;

  doc.setFillColor(233, 240, 255);
  doc.rect(20, y, 170, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Désignation", 24, y + 7);
  doc.text("Qté", 118, y + 7);
  doc.text("PU", 140, y + 7);
  doc.text("Total", 168, y + 7);

  y += 14;
  doc.setFont("helvetica", "normal");

  rows.forEach((row) => {
    doc.text(safe(row.label), 24, y);
    doc.text(String(row.quantity || 1), 118, y);
    doc.text(euro(row.unit_price || 0), 140, y);
    doc.text(euro(row.total || 0), 168, y);
    y += 10;
  });

  doc.line(20, y, 190, y);
  return y + 10;
}

function drawTotals(doc, data, y) {
  doc.setFont("helvetica", "bold");
  doc.text(`Montant total : ${euro(data.total_amount || 0)}`, 128, y);
  y += 8;

  if (typeof data.paid_amount !== "undefined") {
    doc.text(`Acompte / déjà payé : ${euro(data.paid_amount || 0)}`, 108, y);
    y += 8;
    doc.text(
      `Reste à payer : ${euro(Number(data.total_amount || 0) - Number(data.paid_amount || 0))}`,
      113,
      y
    );
    y += 8;
  }

  return y;
}

function drawBankBlock(doc, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Informations bancaires :", 20, y);

  doc.setFont("helvetica", "normal");
  doc.text(`BANQUE : ${HOTEL.bank}`, 20, y + 8);
  doc.text(`NOM : ${HOTEL.name}`, 20, y + 16);
  doc.text(`RIB : ${HOTEL.rib}`, 20, y + 24);
  doc.text(`IBAN : ${HOTEL.iban}`, 20, y + 32);
  doc.text(`BIC : ${HOTEL.bic}`, 20, y + 40);
}

export function buildQuotePdf(quote) {
  const doc = new jsPDF();

  drawHeader(doc, "DEVIS");

  drawClientBlock(doc, quote, 70);
  drawMetaBlock(
    doc,
    {
      labelNumber: "N° devis",
      number: quote.quote_number,
      date: new Date().toLocaleDateString(),
      status: quote.status,
      reservationNumber: quote.reservation_number,
      checkIn: quote.check_in,
      checkOut: quote.check_out
    },
    70
  );

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

  let y = drawLinesTable(doc, rows, 130);
  y = drawTotals(doc, { total_amount: quote.total_amount }, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(HOTEL.quoteValidityText, 20, y + 14);
  doc.text("Merci de votre confiance.", 20, y + 22);

  drawBankBlock(doc, 230);

  return doc.output("blob");
}

export function buildInvoicePdf(invoice) {
  const doc = new jsPDF();

  drawHeader(doc, "FACTURE");

  drawClientBlock(doc, invoice, 70);
  drawMetaBlock(
    doc,
    {
      labelNumber: "N° facture",
      number: invoice.invoice_number,
      date: new Date().toLocaleDateString(),
      status: invoice.status,
      reservationNumber: invoice.reservation_number,
      checkIn: invoice.check_in,
      checkOut: invoice.check_out,
      paymentMethod: invoice.payment_method
    },
    70
  );

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

  let y = drawLinesTable(doc, rows, 130);
  y = drawTotals(
    doc,
    {
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount
    },
    y + 4
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Merci pour votre règlement.", 20, y + 14);

  drawBankBlock(doc, 230);

  return doc.output("blob");
}
