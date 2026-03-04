export default function Home() {
  return (
    <div style={{fontFamily:"Arial",padding:"40px"}}>
      <h1>Azur Hotel PMS</h1>
      <p>Système de gestion hôtel.</p>

      <a href="/admin">
        <button style={{padding:"10px 20px",fontSize:"18px"}}>
          Accéder au panneau admin
        </button>
      </a>
    </div>
  )
}
