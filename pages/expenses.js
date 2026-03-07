import Layout from "../components/Layout";

export default function Expenses() {
  return (
    <Layout title="Dépenses">
      <p>Suivi des dépenses avec justificatif photo.</p>

      <div style={{ marginTop: 20 }}>
        <button style={{ padding: "10px 14px" }}>Ajouter une dépense</button>
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
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Date</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Catégorie</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Montant</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Justificatif</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>06/03/2026</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Courses</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>35 €</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Photo ticket</td>
          </tr>
        </tbody>
      </table>
    </Layout>
  );
}
