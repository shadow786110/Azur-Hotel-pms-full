import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Settings() {
  const [settings, setSettings] = useState({});

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

  async function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = "logo.png";

    await supabase.storage
      .from("hotel-logo")
      .upload(fileName, file, { upsert: true });

    const { data } = supabase.storage
      .from("hotel-logo")
      .getPublicUrl(fileName);

    setSettings({ ...settings, logo_url: data.publicUrl });
  }

  return (
    <Layout title="Paramètres Hôtel">
      <div className="card">

        <h2>Informations Hôtel</h2>

        <form onSubmit={saveSettings} className="form-grid">

          <input placeholder="Nom hôtel"
            value={settings.hotel_name || ""}
            onChange={(e)=>setSettings({...settings, hotel_name:e.target.value})} />

          <input placeholder="Adresse"
            value={settings.address || ""}
            onChange={(e)=>setSettings({...settings, address:e.target.value})} />

          <input placeholder="Téléphone"
            value={settings.phone || ""}
            onChange={(e)=>setSettings({...settings, phone:e.target.value})} />

          <input placeholder="Email"
            value={settings.email || ""}
            onChange={(e)=>setSettings({...settings, email:e.target.value})} />

          <h3>Logo</h3>

          <input type="file" onChange={uploadLogo} />

          {settings.logo_url && (
            <img src={settings.logo_url} width="120" />
          )}

          <h3>Banque</h3>

          <input placeholder="RIB"
            value={settings.rib || ""}
            onChange={(e)=>setSettings({...settings, rib:e.target.value})} />

          <input placeholder="IBAN"
            value={settings.iban || ""}
            onChange={(e)=>setSettings({...settings, iban:e.target.value})} />

          <input placeholder="BIC"
            value={settings.bic || ""}
            onChange={(e)=>setSettings({...settings, bic:e.target.value})} />

          <h3>Taxe de séjour</h3>

          <input type="number"
            placeholder="Taux %"
            value={settings.taxe_sejour_rate || 5}
            onChange={(e)=>setSettings({...settings, taxe_sejour_rate:e.target.value})} />

          <input type="number"
            placeholder="Plafond €"
            value={settings.taxe_sejour_cap || 4}
            onChange={(e)=>setSettings({...settings, taxe_sejour_cap:e.target.value})} />

          <button className="btn">Enregistrer</button>

        </form>
      </div>
    </Layout>
  );
}
