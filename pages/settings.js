import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState({});
  const [settingsId, setSettingsId] = useState(null);

  useEffect(() => {
    loadProfile();
    loadSettings();
  }, []);

  async function loadProfile() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(data || null);
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("hotel_settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1);

    if (error) {
      alert("Erreur chargement paramètres: " + error.message);
      return;
    }

    if (data && data.length > 0) {
      setSettings(data[0]);
      setSettingsId(data[0].id);
    }
  }

  async function saveSettings(e) {
    if (e) e.preventDefault();

    const payload = {
      hotel_name: settings.hotel_name || "",
      address: settings.address || "",
      phone: settings.phone || "",
      email: settings.email || "",
      rib: settings.rib || "",
      iban: settings.iban || "",
      bic: settings.bic || "",
      logo_url: settings.logo_url || "",
      taxe_sejour_rate: Number(settings.taxe_sejour_rate || 5),
      taxe_sejour_cap: Number(settings.taxe_sejour_cap || 4)
    };

    let error = null;

    if (settingsId) {
      const res = await supabase
        .from("hotel_settings")
        .update(payload)
        .eq("id", settingsId);

      error = res.error;
    } else {
      const res = await supabase
        .from("hotel_settings")
        .insert([payload])
        .select()
        .single();

      error = res.error;

      if (!error && res.data) {
        setSettingsId(res.data.id);
        setSettings(res.data);
      }
    }

    if (error) {
      alert("Erreur sauvegarde: " + error.message);
      return;
    }

    alert("Paramètres sauvegardés");
    loadSettings();
  }

  async function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = "logo-" + Date.now() + "-" + file.name;

    const { error: uploadError } = await supabase.storage
      .from("hotel-logo")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      alert("Erreur upload logo: " + uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("hotel-logo")
      .getPublicUrl(fileName);

    setSettings({ ...settings, logo_url: data.publicUrl });
  }

  return (
    <Layout title="Paramètres Hôtel" profile={profile}>
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Informations générales</h2>

          <form onSubmit={saveSettings} className="form-grid">
            <input
              className="input"
              placeholder="Nom hôtel"
              value={settings.hotel_name || ""}
              onChange={(e) =>
                setSettings({ ...settings, hotel_name: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="Adresse"
              value={settings.address || ""}
              onChange={(e) =>
                setSettings({ ...settings, address: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="Téléphone"
              value={settings.phone || ""}
              onChange={(e) =>
                setSettings({ ...settings, phone: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="Email"
              value={settings.email || ""}
              onChange={(e) =>
                setSettings({ ...settings, email: e.target.value })
              }
            />

            <h3>Taxe de séjour</h3>

            <div className="grid grid-2">
              <input
                className="input"
                type="number"
                placeholder="Taux %"
                value={settings.taxe_sejour_rate || 5}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    taxe_sejour_rate: e.target.value
                  })
                }
              />

              <input
                className="input"
                type="number"
                placeholder="Plafond €"
                value={settings.taxe_sejour_cap || 4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    taxe_sejour_cap: e.target.value
                  })
                }
              />
            </div>

            <button className="btn" type="submit">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Logo et banque</h2>

          <div className="form-grid">
            <input className="input" type="file" onChange={uploadLogo} />

            {settings.logo_url && (
              <img
                src={settings.logo_url}
                alt="Logo hôtel"
                style={{ width: 180, borderRadius: 12 }}
              />
            )}

            <input
              className="input"
              placeholder="RIB"
              value={settings.rib || ""}
              onChange={(e) =>
                setSettings({ ...settings, rib: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="IBAN"
              value={settings.iban || ""}
              onChange={(e) =>
                setSettings({ ...settings, iban: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="BIC"
              value={settings.bic || ""}
              onChange={(e) =>
                setSettings({ ...settings, bic: e.target.value })
              }
            />

            <button className="btn" type="button" onClick={saveSettings}>
              Sauvegarder logo + banque
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
