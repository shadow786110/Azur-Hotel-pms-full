import { supabase } from "../lib/supabaseClient";

export default function TestSupabase() {
  async function runTest() {
    try {
      alert("URL utilisée: " + process.env.NEXT_PUBLIC_SUPABASE_URL);

      const { data, error } = await supabase
        .from("clients_pms")
        .select("*")
        .limit(1);

      if (error) {
        alert("Erreur Supabase: " + error.message);
      } else {
        alert("Connexion OK à Supabase");
        console.log(data);
      }
    } catch (err) {
      alert("Erreur réseau: " + err.message);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>Test Supabase</h1>
      <button onClick={runTest}>Tester la connexion</button>
    </div>
  );
}
