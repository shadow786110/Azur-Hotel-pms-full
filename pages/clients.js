import Layout from "../components/Layout";

export default function Clients() {
  return (
    <Layout title="Clients">
      <p>Gestion des fiches clients.</p>

      <div style={{ marginTop: 20 }}>
        <button style={{ padding: "10px 14px" }}>Ajouter un client</button>
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
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Nom</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Téléphone</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Pièce d'identité</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Jean Rakoto</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>+261 34 00 00 000</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>À uploader</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Actif</td>
          </tr>
        </tbody>
      </table>
    </Layout>
  );
}

