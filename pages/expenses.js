import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [titre, setTitre] = useState("");
  const [montant, setMontant] = useState("");

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

    const { error } = await supabase.from("expenses_pms").insert([
      {
        titre,
        montant: Number(montant),
      },
    ]);

    if (error) {
      alert("Erreur SQL: " + error.message);
      return;
    }

    alert("Dépense ajoutée");
    setTitre("");
    setMontant("");
    fetchExpenses();
  }

  return (
    <Layout title="Dépenses">
      <h2>Ajouter une dépense</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 400 }}>
        <input
          type="text"
          placeholder="Titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Montant"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          required
        />

        <button type="submit">Enregistrer</button>
      </form>

      <h2 style={{ marginTop: 30 }}>Liste</h2>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Titre</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td style={{ border: "1px solid #ddd", padding: 10 }}>{expense.titre}</td>
              <td style={{ border: "1px solid #ddd", padding: 10 }}>{expense.montant}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
