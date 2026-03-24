import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end - start;
  if (isNaN(diff) || diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function round2(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

function computeReservationAmounts({
  nightly_price_ttc,
  vat_rate,
  adults,
  children,
  taxable_adults,
  check_in,
  check_out,
  taxe_sejour_rate,
  taxe_sejour_cap
}) {
  const nights = calcNights(check_in, check_out);
  const priceTtcNight = Number(nightly_price_ttc || 0);
  const vat = Number(vat_rate || 0);
  const adultsCount = Number(adults || 0);
  const childrenCount = Number(children || 0);
  const taxableAdultsCount = Number(taxable_adults || 0);

  const totalOccupants = adultsCount + childrenCount;

  const nightly_price_ht = vat > 0 ? priceTtcNight / (1 + vat / 100) : priceTtcNight;

  const room_total_ttc = priceTtcNight * nights;
  const room_total_ht = nightly_price_ht * nights;
  const room_total_tva = room_total_ttc - room_total_ht;

  let cout_ht_par_personne_par_nuit = 0;
  if (nights > 0 && totalOccupants > 0) {
    cout_ht_par_personne_par_nuit = room_total_ht / nights / totalOccupants;
  }

  const taux = Number(taxe_sejour_rate || 0) / 100;
  const cap = Number(taxe_sejour_cap || 0);

  const taxe_unitaire_brute = cout_ht_par_personne_par_nuit * taux;
  const taxe_unitaire = Math.min(taxe_unitaire_brute, cap);

  const taxe_sejour_amount = taxe_unitaire * taxableAdultsCount * nights;

  const total_amount = room_total_ttc + taxe_sejour_amount;

  return {
    nights,
    totalOccupants,
    nightly_price_ht: round2(nightly_price_ht),
    room_total_ht: round2(room_total_ht),
    room_total_tva: round2(room_total_tva),
    room_total_ttc: round2(room_total_ttc),
