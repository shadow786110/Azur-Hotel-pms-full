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
    expense_date: ""
  });

  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    const { data } = await supabase
      .from("expenses_pms")
      .select("*")
      .order("id", { ascending: false });

    setExpenses(data || []);
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
          justificatif_url
        }
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
          expense_date: ""
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
    if (!path) return;

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
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Ajouter une dépense</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <input className="input" placeholder="Titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required />
            <input className="input" type="number" placeholder="Montant" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required />
            <input className="input" placeholder="Catégorie" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} />
            <input className="input" type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            <textarea className="textarea" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div>
              <label className="label">Justificatif</label>
              <input className="input" type="file" onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Liste des dépenses</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Montant</th>
                  <th>Catégorie</th>
                  <th>Date</th>
                  <th>Justificatif</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.titre}</td>
                    <td>{expense.montant}</td>
                    <td>{expense.categorie || "-"}</td>
                    <td>{expense.expense_date || "-"}</td>
                    <td>
                      {expense.justificatif_url ? (
                        <button className="btn btn-secondary" onClick={() => viewExpenseDoc(expense.justificatif_url)}>
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
      </div>
    </Layout>
  );
}
