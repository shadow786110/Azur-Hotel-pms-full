import jsPDF from "jspdf";
import { supabase } from "./supabaseClient";

async function getHotelSettings() {
  const { data } = await supabase
    .from("hotel_settings")
    .select("*")
    .limit(1)
    .single();

  return data;
}

export async function buildQuotePdf(data) {
  const doc = new jsPDF();

  const hotel = await getHotelSettings();

  // ===== LOGO =====
  if (hotel?.logo_url) {
    try {
      const img = await fetch(hotel.logo_url).then(r => r.blob());
      const reader = new FileReader();

      await new Promise((resolve) => {
        reader.onloadend = () => {
          doc.addImage(reader.result, "PNG", 10, 10, 40, 20);
          resolve();
        };
        reader.readAsDataURL(img);
      });
    } catch (e) {
      console.log("Erreur logo", e);
    }
  }

  // ===== INFOS HOTEL =====
  doc.setFontSize(10);

  doc.text(hotel?.hotel_name || "", 150, 15);
  doc.text(hotel?.address || "", 150, 20);
  doc.text(hotel?.phone || "", 150, 25);
  doc.text(hotel?.email || "", 150, 30);

  // ===== TITRE =====
  doc.setFontSize(18);
  doc.text("DEVIS", 105, 50, null, null, "center");

  doc.setFontSize(10);
  doc.text(`N° : ${data.quote_number}`, 10, 60);
  doc.text(`Statut : ${data.status}`, 10, 65);
  doc.text(`Validité : ${data.validity_days} jours`, 10, 70);

  // ===== CLIENT =====
  doc.text("Client :", 10, 80);
  doc.text(data.client_name || "", 10, 85);
  doc.text(data.client_email || "", 10, 90);
  doc.text(data.client_phone || "", 10, 95);
  doc.text(data.client_address || "", 10, 100);

  // ===== TABLE =====
  let y = 110;

  doc.text("Désignation", 10, y);
  doc.text("Qté", 100, y);
  doc.text("TTC", 120, y);
  doc.text("Total", 160, y);

  y += 5;

  data.lines.forEach(line => {
    doc.text(line.label, 10, y);
    doc.text(String(line.quantity), 100, y);
    doc.text(line.unit_price_ttc?.toFixed(2) + "€", 120, y);
    doc.text(line.total_ttc?.toFixed(2) + "€", 160, y);
    y += 6;
  });

  // ===== TOTAL =====
  y += 10;
  doc.setFontSize(14);
  doc.text(`TOTAL : ${data.total_amount.toFixed(2)} €`, 150, y);

  // ===== BANQUE =====
  doc.setFontSize(10);
  doc.text("RIB: " + (hotel?.rib || ""), 10, 270);
  doc.text("IBAN: " + (hotel?.iban || ""), 10, 275);
  doc.text("BIC: " + (hotel?.bic || ""), 10, 280);

  return doc.output("blob");
}
export async function buildInvoicePdf(data) {
  const doc = new jsPDF();

  const hotel = await getHotelSettings();

  // ===== LOGO =====
  if (hotel?.logo_url) {
    try {
      const img = await fetch(hotel.logo_url).then(r => r.blob());
      const reader = new FileReader();

      await new Promise((resolve) => {
        reader.onloadend = () => {
          doc.addImage(reader.result, "PNG", 10, 10, 40, 20);
          resolve();
        };
        reader.readAsDataURL(img);
      });
    } catch (e) {
      console.log("Erreur logo", e);
    }
  }

  // ===== INFOS HOTEL =====
  doc.setFontSize(10);

  doc.text(hotel?.hotel_name || "", 150, 15);
  doc.text(hotel?.address || "", 150, 20);
  doc.text(hotel?.phone || "", 150, 25);
  doc.text(hotel?.email || "", 150, 30);

  // ===== TITRE =====
  doc.setFontSize(18);
  doc.text("FACTURE", 105, 50, null, null, "center");

  doc.setFontSize(10);
  doc.text(`N° : ${data.invoice_number}`, 10, 60);
  doc.text(`Statut : ${data.status}`, 10, 65);
  doc.text(`Date : ${data.created_at}`, 10, 70);

  // ===== CLIENT =====
  doc.text("Client :", 10, 80);
  doc.text(data.client_name || "", 10, 85);
  doc.text(data.client_email || "", 10, 90);
  doc.text(data.client_phone || "", 10, 95);
  doc.text(data.client_address || "", 10, 100);

  // ===== TABLE =====
  let y = 110;

  doc.text("Désignation", 10, y);
  doc.text("Qté", 100, y);
  doc.text("TTC", 120, y);
  doc.text("Total", 160, y);

  y += 5;

  data.lines.forEach(line => {
    doc.text(line.label, 10, y);
    doc.text(String(line.quantity), 100, y);
    doc.text(line.unit_price_ttc?.toFixed(2) + "€", 120, y);
    doc.text(line.total_ttc?.toFixed(2) + "€", 160, y);
    y += 6;
  });

  // ===== TOTAL =====
  y += 10;
  doc.setFontSize(14);
  doc.text(`TOTAL : ${data.total_amount.toFixed(2)} €`, 150, y);

  // ===== TVA (simple) =====
  doc.setFontSize(10);
  y += 10;
  doc.text("TVA incluse selon prestations", 10, y);

  // ===== BANQUE =====
  doc.text("RIB: " + (hotel?.rib || ""), 10, 270);
  doc.text("IBAN: " + (hotel?.iban || ""), 10, 275);
  doc.text("BIC: " + (hotel?.bic || ""), 10, 280);

  return doc.output("blob");
}
