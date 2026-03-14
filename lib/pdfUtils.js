import { jsPDF } from "jspdf";

const HOTEL = {
  name: "AZUR HOTEL",
  address: "48 rue Monseigneur de Beaumont",
  city: "97400 Saint Denis - La Réunion",
  website: "www.azurhotel.re",
  phone: "+262 693 644 848",
  email: "contact@azurhotel.re",
  bank: "Crédit Agricole",
  rib: "19906 00974 30021081317 07",
  iban: "FR76 1990 6009 7430 0210 8131 707",
  bic: "AGRIRERX"
};

function euro(v){
  return Number(v || 0).toFixed(2) + " €";
}

export function buildInvoicePdf(data){

  const doc = new jsPDF();

  // LOGO
  try{
    doc.addImage("/logo-azur-hotel.jpg","JPEG",150,10,40,25);
  }catch(e){}

  // HOTEL
  doc.setFontSize(20);
  doc.text(HOTEL.name,20,20);

  doc.setFontSize(10);
  doc.text(HOTEL.address,20,28);
  doc.text(HOTEL.city,20,33);
  doc.text(HOTEL.website,20,38);
  doc.text("Téléphone : "+HOTEL.phone,20,43);
  doc.text("Email : "+HOTEL.email,20,48);

  // TITRE
  doc.setFontSize(18);
  doc.text("FACTURE",20,60);

  // CLIENT
  doc.setFontSize(11);
  doc.text("Client",20,75);

  doc.setFontSize(10);
  doc.text(data.client_name || "",20,83);
  doc.text(data.client_address || "",20,88);
  doc.text("Email : "+(data.client_email||""),20,93);
  doc.text("Téléphone : "+(data.client_phone||""),20,98);

  // META
  doc.text("N° facture : "+data.invoice_number,130,83);
  doc.text("Date : "+new Date().toLocaleDateString(),130,88);
  doc.text("Statut : "+data.status,130,93);

  // TABLE HEADER
  doc.setFillColor(230,230,230);
  doc.rect(20,110,170,10,"F");

  doc.text("Désignation",25,117);
  doc.text("Qté",115,117);
  doc.text("PU",140,117);
  doc.text("Total",165,117);

  // LIGNE
  const price = Number(data.total_amount||0);

  doc.text("Prestation hôtelière",25,130);
  doc.text("1",115,130);
  doc.text(euro(price),140,130);
  doc.text(euro(price),165,130);

  // TVA
  const tvaHotel = price * 0.021;
  const tvaService = price * 0.085;

  doc.text("TVA hébergement 2.10% : "+euro(tvaHotel),120,150);
  doc.text("TVA services 8.5% : "+euro(tvaService),120,158);

  // TOTAL
  doc.setFontSize(12);
  doc.text("Montant total : "+euro(price),120,175);

  doc.text("Acompte / déjà payé : "+euro(data.paid_amount||0),120,185);

  const reste = price - Number(data.paid_amount||0);
  doc.text("Reste à payer : "+euro(reste),120,195);

  // MESSAGE
  doc.setFontSize(10);
  doc.text("Merci pour votre règlement.",20,210);

  // BANK
  doc.setFontSize(11);
  doc.text("Informations bancaires :",20,230);

  doc.setFontSize(10);
  doc.text("BANQUE : "+HOTEL.bank,20,238);
  doc.text("NOM : "+HOTEL.name,20,244);
  doc.text("RIB : "+HOTEL.rib,20,250);
  doc.text("IBAN : "+HOTEL.iban,20,256);
  doc.text("BIC : "+HOTEL.bic,20,262);

  return doc.output("blob");
}
