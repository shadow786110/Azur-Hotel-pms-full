import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Caisse() {
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [closures, setClosures] = useState([]);
  const [notes, setNotes] = useState("");

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
    const [{ data: paymentsData }, { data: closuresData }] = await Promise.all([
      supabase.from("payments_pms").select("*").order("paid_at", { ascending: false }),
      supabase.from("cash_closures").select("*").order("id", { ascending: false })
    ]);

    setPayments(paymentsData || []);
    setClosures(closuresData || []);
  }

  const totals = useMemo(() => {
    const byMethod = {
      Esp: 0,
      Cb: 0,
      Chq: 0,
      Virement: 0,
      Crédit: 0
    };

    payments.forEach((payment) => {
      const method = payment.method || "Esp";
      if (typeof byMethod[method] === "undefined") byMethod[method] = 0;
      byMethod[method] += Number(payment.amount || 0);
    });

    return {
      ...byMethod,
      total: Object.values(byMethod).reduce((a, b) => a + b, 0)
    };
  }, [payments]);

  async function closeCash() {
    if (!confirm("Créer une clôture de caisse ?")) return;

    const { error } = await supabase.from("cash_closures").insert([
      {
        closure_date: new Date().toISOString().slice(0, 10),
        total_cash: totals.Esp || 0,
        total_cb: totals.Cb || 0,
        total_cheque: totals.Chq || 0,
        total_virement: totals.Virement || 0,
        total_credit: totals.Crédit || 0,
        total_all: totals.total || 0,
        notes
      }
    ]);

    if (error) {
      alert("Erreur clôture de caisse: " + error.message);
      return;
    }

    alert("Clôture enregistrée");
    setNotes("");
    loadData();
  }

  function exportCsv() {
    const rows = [["date", "facture", "montant", "mode", "reference"]];

    payments.forEach((payment) => {
      rows.push([
        payment.paid_at || "",
        payment.invoice_id || "",
        Number(payment.amount || 0).toFixed(2),
        payment.method || "",
        payment.reference || ""
      ]);
    });

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `caisse-comptable-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Layout title="Caisse" profile={profile}>
      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="stat-card"><div className="label">Espèces</div><div className="value">{totals.Esp.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="label">CB</div><div className="value">{totals.Cb.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="label">Chèque</div><div className="value">{totals.Chq.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="label">Virement</div><div className="value">{totals.Virement.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="label">Crédit</div><div className="value">{totals.Crédit.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="label">Total</div><div className="value">{totals.total.toFixed(2)} €</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Clôture de caisse</h2>
          <textarea
            className="textarea"
            placeholder="Notes de clôture"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={closeCash}>Créer la clôture</button>
            <button className="btn btn-secondary" onClick={exportCsv}>Exporter CSV comptable</button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Historique des clôtures</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {closures.map((closure) => (
                  <tr key={closure.id}>
                    <td>{closure.closure_date}</td>
                    <td>{Number(closure.total_all || 0).toFixed(2)} €</td>
                    <td>{closure.notes || "-"}</td>
                  </tr>
                ))}
                {closures.length === 0 && (
                  <tr>
                    <td colSpan="3">Aucune clôture enregistrée.</td>
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
