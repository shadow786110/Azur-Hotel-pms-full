import Layout from "../components/Layout";

export default function Invoices() {
  return (
    <Layout title="Factures">
      <p>Gestion des factures et export PDF.</p>

      <div style={{ marginTop: 20 }}>
        <button style={{ padding: "10px 14px" }}>Créer une facture</button>
      </div>

      <table
        style={{
          width: "100%",
          marginTop: 20,
          borderCollapse: "collapse",
          background: "white",
        }}
      >
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>N° facture</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Client</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Montant</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>FAC-001</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Jean Rakoto</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>120 €</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Payée</td>
          </tr>
        </tbody>
      </table>
    </Layout>
  );
}
