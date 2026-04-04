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
    stock: "",
    alert_stock: ""
  });

  const [movementForm, setMovementForm] = useState({
    product_id: "",
    quantity: "",
    type: "out",
    reason: ""
  });

  useEffect(() => {
    loadProfile();
    fetchAll();
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
    const [{ data: productsData }, { data: movementsData }] = await Promise.all([
      supabase.from("products").select("*").order("id", { ascending: false }),
      supabase
        .from("stock_movements")
        .select("*, products(name, category)")
        .order("id", { ascending: false })
    ]);

    setProducts(productsData || []);
    setMovements(movementsData || []);
  }

  async function handleProductSubmit(e) {
    e.preventDefault();

    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price || 0),
      stock: Number(form.stock || 0),
      alert_stock: Number(form.alert_stock || 0)
    };

    const { error } = await supabase.from("products").insert([payload]);

    if (error) {
      alert("Erreur produit: " + error.message);
      return;
    }

    setForm({
      name: "",
      category: "vente",
      price: "",
      stock: "",
      alert_stock: ""
    });

    alert("Produit ajouté");
    fetchAll();
  }

  async function handleMovementSubmit(e) {
    e.preventDefault();

    const quantity = Number(movementForm.quantity || 0);
    const productId = Number(movementForm.product_id);

    if (!quantity || quantity <= 0) {
      alert("Quantité invalide");
      return;
    }

    const product = products.find((p) => Number(p.id) === productId);
    if (!product) {
      alert("Produit introuvable");
      return;
    }

    let newStock = Number(product.stock || 0);

    if (movementForm.type === "out") {
      if (newStock < quantity) {
        alert("Stock insuffisant");
        return;
      }
      newStock -= quantity;
    } else {
      newStock += quantity;
    }

    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert([
        {
          product_id: productId,
          quantity,
          type: movementForm.type,
          reason: movementForm.reason
        }
      ]);

    if (movementError) {
      alert("Erreur mouvement: " + movementError.message);
      return;
    }

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId);

    if (stockError) {
      alert("Erreur mise à jour stock: " + stockError.message);
      return;
    }

    setMovementForm({
      product_id: "",
      quantity: "",
      type: "out",
      reason: ""
    });

    alert("Mouvement enregistré");
    fetchAll();
  }

  async function deleteProduct(id) {
    if (profile?.role !== "admin") {
      alert("Admin uniquement");
      return;
    }

    if (!confirm("Supprimer ce produit ?")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      alert("Erreur suppression: " + error.message);
      return;
    }

    fetchAll();
  }

  function getStockBadge(product) {
    const stock = Number(product.stock || 0);
    const alertStock = Number(product.alert_stock || 0);

    if (stock <= 0) return { text: "Rupture", color: "#dc2626", bg: "#fee2e2" };
    if (alertStock > 0 && stock <= alertStock) {
      return { text: "Stock bas", color: "#d97706", bg: "#fef3c7" };
    }
    return { text: "OK", color: "#15803d", bg: "#dcfce7" };
  }

  return (
    <Layout title="Stock" profile={profile}>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h2 className="section-title">Ajouter un produit</h2>

          <form className="form-grid" onSubmit={handleProductSubmit}>
            <input
              className="input"
              placeholder="Nom produit"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            <select
              className="select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="vente">Produit vente</option>
              <option value="menage">Produit ménage</option>
              <option value="ustensile">Ustensile</option>
            </select>

            <div className="grid grid-3">
              <input
                className="input"
                type="number"
                placeholder="Prix"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />

              <input
                className="input"
                type="number"
                placeholder="Stock initial"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />

              <input
                className="input"
                type="number"
                placeholder="Alerte stock"
                value={form.alert_stock}
                onChange={(e) =>
                  setForm({ ...form, alert_stock: e.target.value })
                }
              />
            </div>

            <button className="btn" type="submit">
              Ajouter le produit
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Mouvement de stock</h2>

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
              <option value="">Choisir un produit</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category}) - stock {p.stock}
                </option>
              ))}
            </select>

            <div className="grid grid-3">
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
            </div>

            <button className="btn" type="submit">
              Valider le mouvement
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 className="section-title">Liste des produits</h2>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Alerte</th>
                <th>État</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => {
                const badge = getStockBadge(product);

                return (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{Number(product.price || 0).toFixed(2)} €</td>
                    <td>{Number(product.stock || 0)}</td>
                    <td>{Number(product.alert_stock || 0)}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontWeight: 700,
                          color: badge.color,
                          background: badge.bg
                        }}
                      >
                        {badge.text}
                      </span>
                    </td>
                    <td>
                      {profile?.role === "admin" && (
                        <button
                          className="btn btn-danger"
                          onClick={() => deleteProduct(product.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {products.length === 0 && (
                <tr>
                  <td colSpan="7">Aucun produit enregistré.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 className="section-title">Historique des mouvements</h2>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Type</th>
                <th>Quantité</th>
                <th>Motif</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.products?.name || "-"}</td>
                  <td>{movement.products?.category || "-"}</td>
                  <td>{movement.type === "in" ? "Entrée" : "Sortie"}</td>
                  <td>{Number(movement.quantity || 0)}</td>
                  <td>{movement.reason || "-"}</td>
                  <td>{movement.created_at || "-"}</td>
                </tr>
              ))}

              {movements.length === 0 && (
                <tr>
                  <td colSpan="6">Aucun mouvement enregistré.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
