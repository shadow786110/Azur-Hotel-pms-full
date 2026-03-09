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
    expense_date: "",
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
        const fileName = `expense-${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("expense-files-private")
          .upload(fileName, file);

        if (uploadError) {
          alert("Erreur upload justificatif: " + uploadError.message);
          setLoading(false);
          return;
        }

        justificatif_url = fileName;
      }

      const { error } = await supabase.from("expenses_pms").insert([
        {
          titre: form.titre,
          montant: Number(form.montant),
          categorie: form.categorie,
          note: form.note,
          expense_date: form.expense_date || null,
          justificatif_url,
        },
      ]);

      if (error) {
        alert("Erreur dépense: " + error.message);
      } else {
        alert("Dépense enregistrée");
        setForm({
          titre: "",
          montant: "",
          categorie: "",
          note: "",
          expense_date: "",
        });
        setFile(null);
        fetchExpenses();
      }
    } catch (err) {
      alert("Erreur générale: " + err.message);
    }

    setLoading(false);
  }

  async function viewExpenseDoc(path) {
    if (!path) {
      alert("Aucun justificatif");
      return;
    }

    const { data, error } = await supabase.storage
      .from("expense-files-private")
      .createSignedUrl(path, 60);

    if (error) {
      alert("Erreur lecture fichier: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  return (
    <Layout title="Dépenses">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Ajouter une dépense</h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 620 }}>
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

            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
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
                <th style={th}>Titre</th>
                <th style={th}>Montant</th>
                <th style={th}>Catégorie</th>
                <th style={th}>Date</th>
                <th style={th}>Justificatif</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td style={td}>{expense.titre}</td>
                  <td style={td}>{expense.montant}</td>
                  <td style={td}>{expense.categorie || "-"}</td>
                  <td style={td}>{expense.expense_date || "-"}</td>
                  <td style={td}>
                    {expense.justificatif_url ? (
                      <button onClick={() => viewExpenseDoc(expense.justificatif_url)}>
                        Voir
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
    </Layout>
  );
}

const th = { border: "1px solid #ddd", padding: 10, textAlign: "left" };
const td = { border: "1px solid #ddd", padding: 10 };
