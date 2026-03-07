import Layout from "../components/Layout";

export default function Dashboard() {
  const cards = [
    { title: "Chambres occupées", value: "8" },
    { title: "Chambres libres", value: "5" },
    { title: "Arrivées du jour", value: "3" },
    { title: "Départs du jour", value: "2" },
    { title: "Revenus du jour", value: "420 €" },
    { title: "Dépenses du jour", value: "95 €" },
  ];

  return (
    <Layout title="Dashboard">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "12px",
              padding: "18px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px" }}>{card.title}</h3>
            <p style={{ margin: "10px 0 0", fontSize: "28px", fontWeight: "bold" }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </Layout>
  );
}
