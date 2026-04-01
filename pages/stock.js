import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Stock() {
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);

  const [form, setForm] = useState({
    name: "",
    category: "vente",
    price: "",
    stock: ""
  });

  const [movementForm, setMovementForm] = useState({
    product_id: "",
    quantity: "",
    type: "out",
    reason: ""
  });

  useEffect(() => {
    fetchAll();
    loadProfile();
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

  async function fetchAll() {
    const [{ data: productsData }, { data: movementsData }] =
      await Promise.all([
        supabase.from("products").select("*").order("id", { ascending: false }),
        supabase
          .from("stock_movements")
          .select("*, products(name)")
          .order("id", { ascending: false })
      ]);

    setProducts(productsData || []);
    setMovements(movementsData || []);
  }

  async function handleProductSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("products").insert([
      {
        name: form.name,
        category: form.category,
        price: Number(form.price || 0),
        stock: Number(form.stock || 0)
      }
    ]);

    if (error) {
      alert("Erreur produit: " + error.message);
      return;
    }

    setForm({
      name: "",
      category: "vente",
      price: "",
      stock: ""
    });

    fetchAll();
  }

  async function handleMovementSubmit(e) {
    e.preventDefault();

    const quantity = Number(movementForm.quantity || 0);
    const productId = Number(movementForm.product_id);

    const product = products.find((p) => p.id === productId);
    if (!product) return;

    let newStock = product.stock;

    if (movementForm.type === "out") {
      if (product.stock < quantity) {
        alert("Stock insuffisant");
        return;
      }
      newStock -= quantity;
    } else {
      newStock += quantity;
    }

    await supabase.from("stock_movements").insert([
      {
        product_id: productId,
        quantity,
        type: movementForm.type,
        reason: movementForm.reason
      }
    ]);

    await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId);

    setMovementForm({
      product_id: "",
      quantity: "",
      type: "out",
      reason: ""
    });

    fetchAll();
  }

  async function deleteProduct(id) {
    if (profile?.role !== "admin") {
      alert("Admin uniquement");
      return;
    }

    if (!confirm("Supprimer ce produit ?")) return;

    await supabase.from("products").delete().eq("id", id);
    fetchAll();
  }

  return (
    <Layout title="Stock" profile={profile}>
      <div className="grid">
        {/* PRODUITS */}
        <div className="card">
          <h2 className="section-title">Ajouter produit</h2>

          <form className="form-grid" onSubmit={handleProductSubmit}>
            <input
              className="input"
              placeholder="Nom produit"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              required
            />

            <select
              className="select"
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
            >
              <option value="vente">Produit vente</option>
              <option value="menage">Produit ménage</option>
              <option value="ustensile">Ustensile</option>
            </select>

            <input
              className="input"
              type="number"
              placeholder="Prix"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: e.target.value })
              }
            />

            <input
              className="input"
              type="number"
              placeholder="Stock initial"
              value={form.stock}
              onChange={(e) =>
                setForm({ ...form, stock: e.target.value })
              }
            />

            <button className="btn">Ajouter</button>
          </form>
        </div>

        {/* MOUVEMENT */}
        <div className="card">
          <h2 className="section-title">Mouvement stock</h2>

          <form className="form-grid" onSubmit={handleMovementSubmit}>
            <select
              className="select"
              value={movementForm.product_id}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  product_id: e.target.value
                })
              }
              required
            >
              <option value="">Produit</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stock: {p.stock})
                </option>
              ))}
            </select>

            <input
              className="input"
              type="number"
              placeholder="Quantité"
              value={movementForm.quantity}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  quantity: e.target.value
                })
              }
              required
            />

            <select
              className="select"
              value={movementForm.type}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  type: e.target.value
                })
              }
            >
              <option value="out">Sortie</option>
              <option value="in">Entrée</option>
            </select>

            <input
              className="input"
              placeholder="Motif"
              value={movementForm.reason}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  reason: e.target.value
                })
              }
            />

            <button className="btn">Valider</button>
          </form>
        </div>

        {/* LISTE PRODUITS */}
        <div className="card">
          <h2 className="section-title">Produits</h2>

          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.price} €</td>
                  <td>{p.stock}</td>
                  <td>
                    {profile?.role === "admin" && (
                      <button
                        className="btn btn-danger"
                        onClick={() => deleteProduct(p.id)}
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* HISTORIQUE */}
        <div className="card">
          <h2 className="section-title">Historique stock</h2>

          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Type</th>
                <th>Quantité</th>
                <th>Motif</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.products?.name}</td>
                  <td>{m.type}</td>
                  <td>{m.quantity}</td>
                  <td>{m.reason}</td>
                  <td>{m.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
