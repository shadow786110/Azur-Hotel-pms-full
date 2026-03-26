import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Credits() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from("clients_pms")
      .select("*");

    setClients(data || []);
  }

  async function updateCredit(client, amount) {
    const newCredit = Number(client.credit_balance || 0) + Number(amount);

    await supabase
      .from("clients_pms")
      .update({ credit_balance: newCredit })
      .eq("id", client.id);

    loadClients();
  }

  return (
    <Layout title="Crédit Clients">
      <div className="card">

        <h2>Gestion crédit</h2>

        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Crédit</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>{c.nom}</td>
                <td>{c.credit_balance || 0} €</td>
                <td>
                  <button onClick={()=>updateCredit(c, 50)}>+50€</button>
                  <button onClick={()=>updateCredit(c, -50)}>-50€</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </Layout>
  );
}
