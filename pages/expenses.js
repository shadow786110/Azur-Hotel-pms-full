import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    montant: "",
    categorie: "",
    note: "",
  });
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    const { data, error } = await supabase
      .from("expenses_pms")
      .select("*")
      .order("id", { ascending: false });

    if (!error) setExpenses(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    let justificatif_url = "";

    try {
      if (file) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("expense-files")
          .upload(fileName, file);

        if (uploadError) {
          alert("Erreur upload: " + uploadError.message);
          setLoading(false);
          return;
        }

        const { data } = supabase.storage
          .from("expense-files")
          .getPublicUrl(fileName);

        justificatif_url = data.publicUrl;
      }

      const { error } = await supabase.from("expenses_pms").insert([
        {
          titre: form.titre,
          montant: Number(form.montant),
          categorie: form.categorie,
          note: form.note,
          justificatif_url,
        },
      ]);

      if (error) {
        alert("Erreur SQL: " + error.message);
      } else {
        alert("Dépense ajoutée");
        setForm({
          titre: "",
          montant: "",
          categorie: "",
          note: "",
        });
        setFile(null);
        fetchExpenses();
      }
    } catch (err) {
      alert("Erreur: " + err.message);
    }

    setLoading(false);
  }

  return (
    <Layout title="Dépenses">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Ajouter une dépense</h2>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 500 }}>
            <input
              type="text"
              placeholder="Titre"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Montant"
              value={form.montant}
              onChange={(e) => setForm({ ...form, montant: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Catégorie"
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            />
            <textarea
              placeholder="Note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <label>Justificatif</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
            <button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>

        <div>
          <h2>Liste des dépenses</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Titre</th>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Montant</th>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Catégorie</th>
                <th style={{ border: "1px solid #ddd", padding: 10 }}>Justificatif</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>{expense.titre}</td>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>{expense.montant} €</td>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>{expense.categorie}</td>
                  <td style={{ border: "1px solid #ddd", padding: 10 }}>
                    {expense.justificatif_url ? (
                      <a href={expense.justificatif_url} target="_blank" rel="noreferrer">
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
