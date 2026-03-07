import Layout from "../components/Layout";

export default function Reservations() {
  return (
    <Layout title="Réservations">
      <p>Gestion des réservations, check-in et check-out.</p>

      <div style={{ marginTop: 20 }}>
        <button style={{ padding: "10px 14px" }}>Nouvelle réservation</button>
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
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Client</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Chambre</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Arrivée</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Départ</th>
            <th style={{ border: "1px solid #ddd", padding: 10 }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Marie R.</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Chambre 204</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>06/03/2026</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>08/03/2026</td>
            <td style={{ border: "1px solid #ddd", padding: 10 }}>Confirmée</td>
          </tr>
        </tbody>
      </table>
    </Layout>
  );
}
