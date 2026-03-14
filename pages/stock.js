import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Stock() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    name: "",
    category: "vente",
    sku: "",
    unit: "pièce",
    quantity: "",
    min_quantity: "",
    unit_price: "",
    notes: ""
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const { data } = await supabase
      .from("products_stock")
      .select("*")
      .order("id", { ascending: false });

    setItems(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("products_stock").insert([
      {
        name: form.name,
        category: form.category,
        sku: form.sku,
        unit: form.unit,
        quantity: Number(form.quantity || 0),
        min_quantity: Number(form.min_quantity || 0),
        unit_price: Number(form.unit_price || 0),
        notes: form.notes
      }
    ]);

    if (error) {
      alert("Erreur stock: " + error.message);
      return;
    }

    alert("Produit ajouté");
    setForm({
      name: "",
      category: "vente",
      sku: "",
      unit: "pièce",
      quantity: "",
      min_quantity: "",
      unit_price: "",
      notes: ""
    });
    fetchItems();
  }

  return (
    <Layout title="Stock">
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Ajouter un produit</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <input className="input" placeholder="Nom produit" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="vente">Produit de vente</option>
              <option value="menage">Produit ménager</option>
              <option value="ustensile">Ustensile hôtel</option>
            </select>
            <input className="input" placeholder="SKU / Référence" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <input className="input" placeholder="Unité" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <input className="input" type="number" placeholder="Quantité" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <input className="input" type="number" placeholder="Seuil minimum" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} />
            <input className="input" type="number" placeholder="Prix unitaire" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
            <textarea className="textarea" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="btn" type="submit">Enregistrer</button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Liste du stock</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Qté</th>
                  <th>Min</th>
                  <th>Unité</th>
                  <th>Prix</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.quantity}</td>
                    <td>{item.min_quantity}</td>
                    <td>{item.unit}</td>
                    <td>{item.unit_price}</td>
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
