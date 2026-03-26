import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Settings() {
  const [settings, setSettings] = useState({
    hotel_name: "",
    address: "",
    phone: "",
    email: "",
    rib: "",
    iban: "",
    bic: "",
    taxe_sejour_rate: 5,
    taxe_sejour_cap: 4
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase
      .from("hotel_settings")
      .select("*")
      .limit(1)
      .single();

    if (data) setSettings(data);
  }

  async function saveSettings(e) {
    e.preventDefault();

    const { error } = await supabase
      .from("hotel_settings")
      .upsert([settings]);

    if (error) return alert(error.message);

    alert("Paramètres sauvegardés");
  }

  return (
    <Layout title="Paramètres Hôtel">
      <div className="card">
        <h2>Informations hôtel</h2>

        <form onSubmit={saveSettings} className="form-grid">

          <input value={settings.hotel_name} placeholder="Nom hôtel"
            onChange={(e)=>setSettings({...settings, hotel_name:e.target.value})} />

          <input value={settings.address} placeholder="Adresse"
            onChange={(e)=>setSettings({...settings, address:e.target.value})} />

          <input value={settings.phone} placeholder="Téléphone"
            onChange={(e)=>setSettings({...settings, phone:e.target.value})} />

          <input value={settings.email} placeholder="Email"
            onChange={(e)=>setSettings({...settings, email:e.target.value})} />

          <h3>Banque</h3>

          <input value={settings.rib} placeholder="RIB"
            onChange={(e)=>setSettings({...settings, rib:e.target.value})} />

          <input value={settings.iban} placeholder="IBAN"
            onChange={(e)=>setSettings({...settings, iban:e.target.value})} />

          <input value={settings.bic} placeholder="BIC"
            onChange={(e)=>setSettings({...settings, bic:e.target.value})} />

          <h3>Taxe de séjour</h3>

          <input type="number" value={settings.taxe_sejour_rate}
            onChange={(e)=>setSettings({...settings, taxe_sejour_rate:e.target.value})}
            placeholder="Taux %" />

          <input type="number" value={settings.taxe_sejour_cap}
            onChange={(e)=>setSettings({...settings, taxe_sejour_cap:e.target.value})}
            placeholder="Plafond €" />

          <button className="btn">Enregistrer</button>

        </form>
      </div>
    </Layout>
  );
}
