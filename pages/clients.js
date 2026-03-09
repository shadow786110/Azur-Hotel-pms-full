import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewingUrl, setViewingUrl] = useState("");

  const [form, setForm] = useState({
    code: "",
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    note: "",
  });

  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data, error } = await supabase
      .from("clients_pms")
      .select("*")
      .order("id", { ascending: false });

    if (!error) setClients(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    let piece_identite_url = "";

    try {
      if (file) {
        const fileName = `client-${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("client-docs-private")
          .upload(fileName, file);

        if (uploadError) {
          alert("Erreur upload document: " + uploadError.message);
          setLoading(false);
          return;
        }

        piece_identite_url = fileName;
      }

      const { error } = await supabase.from("clients_pms").insert([
        {
          code: form.code || null,
          nom: form.nom,
          telephone: form.telephone,
          email: form.email,
          adresse: form.adresse,
          note: form.note,
          piece_identite_url,
        },
      ]);

      if (error) {
        alert("Erreur client: " + error.message);
      } else {
        alert("Client enregistré");
        setForm({
          code: "",
          nom: "",
          telephone: "",
          email: "",
          adresse: "",
          note: "",
        });
        setFile(null);
        fetchClients();
      }
    } catch (err) {
      alert("Erreur générale: " + err.message);
    }

    setLoading(false);
  }

  async function viewPrivateDoc(path) {
    if (!path) {
      alert("Aucun document");
      return;
    }

    const { data, error } = await supabase.storage
      .from("client-docs-private")
      .createSignedUrl(path, 60);

    if (error) {
      alert("Erreur lecture document: " + error.message);
      return;
    }

    setViewingUrl(data.signedUrl);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Layout title="Clients">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Ajouter un client</h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 620 }}>
            <input
              type="text"
              placeholder="Code client"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />

            <input
              type="text"
              placeholder="Nom complet"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="Téléphone"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />

            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              type="text"
              placeholder="Adresse"
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            />

            <textarea
              placeholder="Note interne"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />

            <label>Pièce d’identité / passeport / CIN</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer le client"}
            </button>
          </form>
        </div>

        <div>
          <h2>Liste des clients</h2>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={th}>Code</th>
                <th style={th}>Nom</th>
                <th style={th}>Téléphone</th>
                <th style={th}>Email</th>
                <th style={th}>Document</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td style={td}>{client.code || "-"}</td>
                  <td style={td}>{client.nom}</td>
                  <td style={td}>{client.telephone || "-"}</td>
                  <td style={td}>{client.email || "-"}</td>
                  <td style={td}>
                    {client.piece_identite_url ? (
                      <button onClick={() => viewPrivateDoc(client.piece_identite_url)}>
                        Voir document
                      </button>
                    ) : (
                      "Aucun"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {viewingUrl && (
          <div>
            <p>Lien temporaire créé.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

const th = { border: "1px solid #ddd", padding: 10, textAlign: "left" };
const td = { border: "1px solid #ddd", padding: 10 };
