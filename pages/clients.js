import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    code: "",
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    note: ""
  });

  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data } = await supabase
      .from("clients_pms")
      .select("*")
      .order("id", { ascending: false });

    setClients(data || []);
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
          piece_identite_url
        }
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
          note: ""
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
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("client-docs-private")
      .createSignedUrl(path, 60);

    if (error) {
      alert("Erreur lecture document: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  return (
    <Layout title="Clients">
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Ajouter un client</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <input className="input" placeholder="Code client" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="input" placeholder="Nom complet" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
            <input className="input" placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            <textarea className="textarea" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div>
              <label className="label">Pièce d'identité</label>
              <input className="input" type="file" onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer le client"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Liste des clients</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.code || "-"}</td>
                    <td>{client.nom}</td>
                    <td>{client.telephone || "-"}</td>
                    <td>{client.email || "-"}</td>
                    <td>
                      {client.piece_identite_url ? (
                        <button className="btn btn-secondary" onClick={() => viewPrivateDoc(client.piece_identite_url)}>
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
        </div>
      </div>
    </Layout>
  );
}
