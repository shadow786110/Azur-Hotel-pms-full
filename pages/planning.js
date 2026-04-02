import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function getDaysInMonth(year, month) {
  const days = [];
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function isReservationOnDate(reservation, dateStr) {
  const checkIn = reservation.check_in;
  const checkOut = reservation.check_out;

  if (!checkIn || !checkOut) return false;

  return dateStr >= checkIn && dateStr < checkOut;
}

function getReservationBadgeClass(status) {
  if (status === "checked_in") return "badge badge-green";
  if (status === "confirmed") return "badge badge-blue";
  if (status === "pending") return "badge badge-orange";
  if (status === "cancelled") return "badge badge-red";
  return "badge badge-gray";
}

function getCellStyle(reservation, dateStr) {

  if (dateStr === reservation.check_in) {
    return {
      background: "#dbeafe", // arrivée
      border: "2px solid #3b82f6"
    };
  }

  if (dateStr === reservation.check_out) {
    return {
      background: "#fef3c7", // départ
      border: "2px solid #f59e0b"
    };
  }

  if (reservation.status === "checked_in") {
    return {
      background: "#dcfce7", // en cours
      border: "2px solid #16a34a"
    };
  }

  return {
    background: "#f1f5f9",
    border: "1px solid #cbd5e1"
  };
}

export default function Planning() {
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  useEffect(() => {
    loadProfile();
    fetchPlanning();
  }, [selectedYear, selectedMonth]);

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

  async function fetchPlanning() {
    const monthStart = formatDate(new Date(selectedYear, selectedMonth, 1));
    const monthEnd = formatDate(new Date(selectedYear, selectedMonth + 1, 1));

    const [{ data: roomsData }, { data: reservationsData }] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .order("room_number", { ascending: true }),

      supabase
        .from("reservations_pms")
        .select("*, clients_pms(id, nom), rooms(id, room_number)")
        .lt("check_in", monthEnd)
        .gte("check_out", monthStart)
        .order("check_in", { ascending: true })
    ]);

    setRooms(roomsData || []);
    setReservations(reservationsData || []);
  }

  const days = useMemo(() => {
    return getDaysInMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  function changeMonth(offset) {
    const newDate = new Date(selectedYear, selectedMonth + offset, 1);
    setSelectedYear(newDate.getFullYear());
    setSelectedMonth(newDate.getMonth());
  }

  const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleDateString(
    "fr-FR",
    { month: "long", year: "numeric" }
  );

  return (
    <Layout title="Planning chambres" profile={profile}>
      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "space-between"
          }}
        >
          <div>
            <h2 className="section-title" style={{ marginBottom: 6 }}>
              Planning mensuel
            </h2>
            <div className="helper">
              Vue visuelle des réservations par chambre
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => changeMonth(-1)}>
              Mois précédent
            </button>
            <div className="card" style={{ padding: "10px 14px" }}>
              <strong style={{ textTransform: "capitalize" }}>{monthLabel}</strong>
            </div>
            <button className="btn btn-secondary" onClick={() => changeMonth(1)}>
              Mois suivant
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 1600 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "#f8fbff", zIndex: 3 }}>
                  Chambre
                </th>
                {days.map((day) => (
                  <th key={day.toISOString()}>
                    <div>{day.getDate()}</div>
                    <div className="helper">
                      {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rooms.map((room) => {
                const roomReservations = reservations.filter(
                  (r) => Number(r.room_id) === Number(room.id)
                );

                return (
                  <tr key={room.id}>
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        background: "#fff",
                        zIndex: 2,
                        minWidth: 140
                      }}
                    >
                      <strong>{room.room_number}</strong>
                      <br />
                      <span className="helper">{room.room_type || "-"}</span>
                    </td>

                    {days.map((day) => {
                      const dateStr = formatDate(day);
                      const reservation = roomReservations.find((r) =>
                        isReservationOnDate(r, dateStr)
                      );

                      if (!reservation) {
                        return <td key={dateStr}></td>;
                      }

                      const style = getCellStyle(reservation.status);

                      return (
                        <td key={dateStr}>
                          <div
                            style={{
                              ...style,
                              borderRadius: 10,
                              padding: 6,
                              minWidth: 110
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 12 }}>
                              {reservation.clients_pms?.nom || "Client"}
                            </div>
                            <div className={getReservationBadgeClass(reservation.status)}>
                              {translateReservationStatus(reservation.status)}
                            </div>
                            <div className="helper" style={{ marginTop: 4 }}>
                              {reservation.check_in} → {reservation.check_out}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function translateReservationStatus(status) {
  if (status === "pending") return "En attente";
  if (status === "confirmed") return "Confirmée";
  if (status === "checked_in") return "Check-in";
  if (status === "checked_out") return "Check-out";
  if (status === "cancelled") return "Annulée";
  return status;
}
