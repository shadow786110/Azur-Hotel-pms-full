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
    notes: ""
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .order("room_number", { ascending: true });

    setRooms(data || []);
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
        notes: form.notes
      }
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
      notes: ""
    });
    fetchRooms();
  }

  async function updateRoomStatus(id, status) {
    const { error } = await supabase.from("rooms").update({ status }).eq("id", id);
    if (error) {
      alert("Erreur statut: " + error.message);
      return;
    }
    fetchRooms();
  }

  return (
    <Layout title="Chambres">
      <div className="grid grid-2">
        <div className="card">
          <h2 className="section-title">Ajouter une chambre</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <input className="input" placeholder="Numéro chambre" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} required />
            <input className="input" placeholder="Type" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} />
            <input className="input" placeholder="Étage" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            <input className="input" type="number" placeholder="Capacité" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="available">Libre</option>
              <option value="occupied">Occupée</option>
              <option value="dirty">Sale</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Bloquée</option>
            </select>
            <textarea className="textarea" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="btn" type="submit">Enregistrer</button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Liste des chambres</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Type</th>
                  <th>Étage</th>
                  <th>Capacité</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.room_number}</td>
                    <td>{room.room_type}</td>
                    <td>{room.floor}</td>
                    <td>{room.capacity}</td>
                    <td>{translateRoomStatus(room.status)}</td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" onClick={() => updateRoomStatus(room.id, "available")}>Libre</button>
                        <button className="btn btn-warning" onClick={() => updateRoomStatus(room.id, "dirty")}>Sale</button>
                        <button className="btn btn-danger" onClick={() => updateRoomStatus(room.id, "maintenance")}>Maintenance</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
