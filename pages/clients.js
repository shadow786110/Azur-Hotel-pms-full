import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");

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

    const { error } = await supabase.from("clients_pms").insert([
      {
        nom,
        email,
      },
    ]);

    if (error) {
      alert("Erreur SQL client: " + error.message);
      return;
    }

    alert("Client ajouté");
    setNom("");
    setEmail("");
    fetchClients();
  }

  return (
    <Layout title="Clients">
      <h2>Ajouter un client</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 400 }}>
        <input
          type="text"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button type="submit">Enregistrer</button>
      </form>

      <h2 style={{ marginTop: 30 }}>Liste</h2>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Nom</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Email</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td style={{ border: "1px solid #ddd", padding: 10 }}>{client.nom}</td>
              <td style={{ border: "1px solid #ddd", padding: 10 }}>{client.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
