import { jsPDF } from "jspdf";

const HOTEL = {
  name: "AZUR HOTEL",
  address1: "48 rue Monseigneur de Beaumont",
  address2: "97400 Saint-Denis - La Réunion",
  website: "www.azurhotel.re",
  phone: "+262 693 644 848",
  email: "contact@azurhotel.re",
  bank: "Crédit Agricole",
  rib: "19906 00974 30021081317 07",
  iban: "FR76 1990 6009 7430 0210 8131 707",
  bic: "AGRIRERX"
};

function euro(v) {
  return `${Number(v || 0).toFixed(2)} €`;
}

function safe(v, fallback = "-") {
  return v ? String(v) : fallback;
}

async function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function addLogo(doc) {
  try {
    const logoData = await loadImageAsDataUrl("/logo-azur-hotel.jpg");
    doc.addImage(logoData, "JPEG", 145, 10, 45, 28);
  } catch (e) {
    // si le logo ne charge pas, on continue sans bloquer
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
  doc.text(HOTEL.website, 20, 36);
  doc.text(`Téléphone : ${HOTEL.phone}`, 20, 41);
  doc.text(`Email : ${HOTEL.email}`, 20, 46);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 20, 60);
}

function drawClientBlock(doc, data, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Client", 20, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(safe(data.client_name), 20, y + 8);
  if (data.client_address) doc.text(safe(data.client_address), 20, y + 14);
  if (data.client_email) doc.text(`Email : ${safe(data.client_email)}`, 20, y + 20);
  if (data.client_phone) doc.text(`Téléphone : ${safe(data.client_phone)}`, 20, y + 26);
}

function drawMetaBlock(doc, data, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${data.numberLabel} : ${safe(data.number)}`, 130, y + 8);
  doc.text(`Date : ${safe(data.date)}`, 130, y + 14);
  doc.text(`Statut : ${safe(data.status)}`, 130, y + 20);
  if (data.payment_method) doc.text(`Paiement : ${safe(data.payment_method)}`, 130, y + 26);
  if (data.validity_text) doc.text(data.validity_text, 130, y + 32);
}

function drawTable(doc, rows, startY) {
  let y = startY;

  doc.setFillColor(232, 239, 251);
  doc.rect(20, y, 170, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Désignation", 22, y + 7);
  doc.text("Qté", 92, y + 7);
  doc.text("PU HT", 108, y + 7);
  doc.text("TVA", 132, y + 7);
  doc.text("TTC", 162, y + 7);

  y += 14;
  doc.setFont("helvetica", "normal");

  rows.forEach((row) => {
    doc.text(String(row.label || "-"), 22, y);
    doc.text(String(row.quantity || 1), 92, y);
    doc.text(euro(row.unit_price || 0), 108, y);
    doc.text(`${Number(row.vat_rate || 0).toFixed(2)}%`, 132, y);
    doc.text(euro(row.total_ttc || 0), 162, y);
    y += 9;
  });

  doc.line(20, y, 190, y);
  return y + 8;
}

function drawTotals(doc, totals, startY, withPaid = false) {
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total HT : ${euro(totals.total_ht)}`, 135, y);
  y += 7;
  doc.text(`Total TVA : ${euro(totals.total_tva)}`, 132, y);
  y += 7;
  doc.text(`Total TTC : ${euro(totals.total_ttc)}`, 132, y);
  y += 7;

  if (withPaid) {
    doc.text(`Déjà payé : ${euro(totals.paid_amount)}`, 130, y);
    y += 7;
    doc.text(`Reste à payer : ${euro(totals.total_ttc - totals.paid_amount)}`, 118, y);
    y += 7;
  }

  return y;
}

function drawBankBlock(doc, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Informations bancaires :", 20, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`BANQUE : ${HOTEL.bank}`, 20, y + 8);
  doc.text(`NOM : ${HOTEL.name}`, 20, y + 14);
  doc.text(`RIB : ${HOTEL.rib}`, 20, y + 20);
  doc.text(`IBAN : ${HOTEL.iban}`, 20, y + 26);
  doc.text(`BIC : ${HOTEL.bic}`, 20, y + 32);
}

function computeTotals(lines = []) {
  let total_ht = 0;
  let total_tva = 0;
  let total_ttc = 0;

  lines.forEach((line) => {
    total_ht += Number(line.total_ht || 0);
    total_tva += Number(line.total_tva || 0);
    total_ttc += Number(line.total_ttc || 0);
  });

  return { total_ht, total_tva, total_ttc };
}

export async function buildQuotePdf(data) {
  const doc = new jsPDF();
  await addLogo(doc);
  drawHeader(doc, "DEVIS");

  drawClientBlock(doc, data, 74);
  drawMetaBlock(
    doc,
    {
      numberLabel: "N° devis",
      number: data.quote_number,
      date: new Date().toLocaleDateString(),
      status: data.status,
      validity_text: `Validité : ${data.validity_days || 30} jours`
    },
    74
  );

  const lines = data.lines?.length
    ? data.lines
    : [
        {
          label: "Prestation hôtelière",
          quantity: 1,
          unit_price: Number(data.total_amount || 0),
          vat_rate: 0,
          total_ht: Number(data.total_amount || 0),
          total_tva: 0,
          total_ttc: Number(data.total_amount || 0)
        }
      ];

  let y = drawTable(doc, lines, 130);
  const totals = computeTotals(lines);
  y = drawTotals(doc, totals, y + 4, false);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Devis valable ${data.validity_days || 30} jours à compter de sa date d'émission.`, 20, y + 14);
  doc.text("Merci de votre confiance.", 20, y + 22);

  drawBankBlock(doc, 230);

  return doc.output("blob");
}

export async function buildInvoicePdf(data) {
  const doc = new jsPDF();
  await addLogo(doc);
  drawHeader(doc, "FACTURE");

  drawClientBlock(doc, data, 74);
  drawMetaBlock(
    doc,
    {
      numberLabel: "N° facture",
      number: data.invoice_number,
      date: new Date().toLocaleDateString(),
      status: data.status,
      payment_method: data.payment_method
    },
    74
  );

  const lines = data.lines?.length
    ? data.lines
    : [
        {
          label: "Prestation hôtelière",
          quantity: 1,
          unit_price: Number(data.total_amount || 0),
          vat_rate: 0,
          total_ht: Number(data.total_amount || 0),
          total_tva: 0,
          total_ttc: Number(data.total_amount || 0)
        }
      ];

  let y = drawTable(doc, lines, 130);
  const totals = computeTotals(lines);
  y = drawTotals(
    doc,
    {
      ...totals,
      paid_amount: Number(data.paid_amount || 0)
    },
    y + 4,
    true
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Merci pour votre règlement.", 20, y + 14);

  drawBankBlock(doc, 230);

  return doc.output("blob");
}
