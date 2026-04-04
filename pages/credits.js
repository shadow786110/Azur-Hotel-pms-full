import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Credits() {
  const [profile, setProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [credits, setCredits] = useState([]);

  useEffect(() => {
    loadProfile();
    loadData();
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

  async function loadData() {
    const [{ data: clientsData }, { data: creditsData }] = await Promise.all([
      supabase.from("clients_pms").select("*").order("nom", { ascending: true }),
      supabase
        .from("client_credits")
        .select("*, clients_pms(id, nom)")
        .order("id", { ascending: false })
    ]);

    setClients(clientsData || []);
    setCredits(creditsData || []);
  }

  async function adjustClientCredit(clientId, delta) {
    const client = clients.find((c) => Number(c.id) === Number(clientId));
    if (!client) return;

    const current = Number(client.credit_balance || 0);
    const updated = Math.max(0, current + Number(delta || 0));

    const { error } = await supabase
      .from("clients_pms")
      .update({ credit_balance: updated })
      .eq("id", clientId);

    if (error) {
      alert("Erreur crédit client: " + error.message);
      return;
    }

    loadData();
  }

  return (
    <Layout title="Crédits clients" profile={profile}>
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Solde client</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Crédit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.nom}</td>
                    <td>{Number(client.credit_balance || 0).toFixed(2)} €</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-secondary"
                          onClick={() => adjustClientCredit(client.id, 10)}
                        >
                          +10
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => adjustClientCredit(client.id, -10)}
                        >
                          -10
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan="3">Aucun client.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Historique crédits</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Facture</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((credit) => (
                  <tr key={credit.id}>
                    <td>{credit.clients_pms?.nom || "-"}</td>
                    <td>{credit.invoice_id || "-"}</td>
                    <td>{Number(credit.amount || 0).toFixed(2)} €</td>
                    <td>{credit.status}</td>
                    <td>{credit.created_at}</td>
                  </tr>
                ))}
                {credits.length === 0 && (
                  <tr>
                    <td colSpan="5">Aucun crédit enregistré.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
