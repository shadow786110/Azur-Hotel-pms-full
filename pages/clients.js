import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
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

  let document_url = "";

  try {
    if (file) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-docs")
        .upload(fileName, file);

      if (uploadError) {
        alert("Erreur upload client: " + uploadError.message);
        setLoading(false);
        return;
      }

      const { data } = supabase.storage
        .from("client-docs")
        .getPublicUrl(fileName);

      document_url = data.publicUrl;
    }

    const { data: inserted, error } = await supabase
      .from("clients_pms")
      .insert([
        {
          nom: form.nom,
          telephone: form.telephone,
          email: form.email,
          adresse: form.adresse,
          document_url,
        },
      ])
      .select();

    if (error) {
      alert("Erreur SQL client: " + error.message);
    } else {
      alert("Client ajouté avec succès");
      setForm({
        nom: "",
        telephone: "",
        email: "",
        adresse: "",
      });
      setFile(null);
      fetchClients();
    }
  } catch (err) {
    alert("Erreur générale client: " + err.message);
  }

  setLoading(false);
}

    const { error } = await supabase.from("clients").insert([
      {
        nom: form.nom,
        telephone: form.telephone,
        email: form.email,
        adresse: form.adresse,
        document_url,
      },
    ]);

    if (!error) {
      setForm({
        nom: "",
        telephone: "",
        email: "",
        adresse: "",
      });
      setFile(null);
      fetchClients();
      alert("Client ajouté avec succès");
    } else {
      alert("Erreur ajout client");
    }

    setLoading(false);
  }

  return (
    <Layout title="Clients">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Ajouter un client</h2>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 500 }}>
            <input
              type="text"
              placeholder="Nom"
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

            <label>Pièce d'identité / document</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>

        <div>
          <h2>Liste des clients</h2>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
            }}
          >
            <thead>
              <tr>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Nom</th>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Téléphone</th>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Email</th>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Document</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>{client.nom}</td>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>{client.telephone}</td>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>{client.email}</td>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>
                    {client.document_url ? (
                      <a href={client.document_url} target="_blank" rel="noreferrer">
                        Voir
                      </a>
                    ) : (
                      "Aucun"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
