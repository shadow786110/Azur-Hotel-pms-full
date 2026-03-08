import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({
    room_number: "",
    room_type: "",
    floor: "",
    capacity: 1,
    status: "available",
    notes: "",
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("room_number", { ascending: true });

    if (!error) setRooms(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("rooms").insert([
      {
        room_number: form.room_number,
        room_type: form.room_type,
        floor: form.floor,
        capacity: Number(form.capacity),
        status: form.status,
        notes: form.notes,
      },
    ]);

    if (error) {
      alert("Erreur chambre: " + error.message);
      return;
    }

    alert("Chambre ajoutée");
    setForm({
      room_number: "",
      room_type: "",
      floor: "",
      capacity: 1,
      status: "available",
      notes: "",
    });
    fetchRooms();
  }

  async function updateRoomStatus(id, status) {
    const { error } = await supabase
      .from("rooms")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("Erreur statut: " + error.message);
      return;
    }

    fetchRooms();
  }

  return (
    <Layout title="Chambres">
      <div style={{ display: "grid", gap: 30 }}>
        <div>
          <h2>Ajouter une chambre</h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <input
              type="text"
              placeholder="Numéro chambre"
              value={form.room_number}
              onChange={(e) => setForm({ ...form, room_number: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="Type (Single, Double, Suite...)"
              value={form.room_type}
              onChange={(e) => setForm({ ...form, room_type: e.target.value })}
            />

            <input
              type="text"
              placeholder="Étage"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            />

            <input
              type="number"
              placeholder="Capacité"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="available">Libre</option>
              <option value="occupied">Occupée</option>
              <option value="dirty">Sale</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Bloquée</option>
            </select>

            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <button type="submit">Enregistrer</button>
          </form>
        </div>

        <div>
          <h2>Liste des chambres</h2>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={th}>N°</th>
                <th style={th}>Type</th>
                <th style={th}>Étage</th>
                <th style={th}>Capacité</th>
                <th style={th}>Statut</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td style={td}>{room.room_number}</td>
                  <td style={td}>{room.room_type}</td>
                  <td style={td}>{room.floor}</td>
                  <td style={td}>{room.capacity}</td>
                  <td style={td}>{translateRoomStatus(room.status)}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => updateRoomStatus(room.id, "available")}>Libre</button>
                      <button onClick={() => updateRoomStatus(room.id, "dirty")}>Sale</button>
                      <button onClick={() => updateRoomStatus(room.id, "maintenance")}>Maintenance</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function translateRoomStatus(status) {
  if (status === "available") return "Libre";
  if (status === "occupied") return "Occupée";
  if (status === "dirty") return "Sale";
  if (status === "maintenance") return "Maintenance";
  if (status === "blocked") return "Bloquée";
  return status;
}

const th = { border: "1px solid #ddd", padding: 10, textAlign: "left" };
const td = { border: "1px solid #ddd", padding: 10 };
