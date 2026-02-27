import Layout from "@/components/Layout";
import { useAuth } from "./_app";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export default function Admin(){
  const { session, loading, profile } = useAuth();
  const router = useRouter();
  const [users,setUsers]=useState([]);
  const [msg,setMsg]=useState("");
  const [form,setForm]=useState({ username:"", password:"", role:"reception", full_name:"" });

  useEffect(()=>{ if(!loading && !session) router.replace("/login"); },[loading,session,router]);
  useEffect(()=>{ if(session && profile?.role==="admin") load(); },[session, profile]);

  async function load(){
    setMsg("Chargement...");
    const r = await apiFetch("/api/admin/listUsers", { method:"GET", headers:{} });
    const j = await r.json();
    if(!j.ok){ setMsg(j.error||"Erreur"); return; }
    setUsers(j.users||[]); setMsg("");
  }

  async function create(){
    setMsg("Création...");
    const r = await apiFetch("/api/admin/createUser", { method:"POST", body: JSON.stringify(form) });
    const j = await r.json();
    if(!j.ok){ setMsg(j.error||"Erreur"); return; }
    setForm({ username:"", password:"", role:"reception", full_name:"" });
    setMsg("Créé ✓");
    await load();
  }

  async function toggle(u){
    setMsg("Mise à jour...");
    const r = await apiFetch("/api/admin/updateUser", { method:"POST", body: JSON.stringify({ id:u.id, is_active: !u.is_active }) });
    const j = await r.json();
    if(!j.ok){ setMsg(j.error||"Erreur"); return; }
    await load();
  }

  async function del(u){
    if(!confirm("Supprimer ?")) return;
    setMsg("Suppression...");
    const r = await apiFetch("/api/admin/deleteUser", { method:"POST", body: JSON.stringify({ id:u.id }) });
    const j = await r.json();
    if(!j.ok){ setMsg(j.error||"Erreur"); return; }
    await load();
  }

  if(!session) return null;
  if(profile?.role!=="admin") return <Layout><div className="card"><div className="err">Accès admin uniquement.</div></div></Layout>;

  return (
    <Layout>
      <div className="row">
        <div className="col card">
          <div style={{fontWeight:900}}>Créer utilisateur</div>
          <label>Pseudo *</label><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} />
          <label>Mot de passe *</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
          <label>Rôle</label>
          <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
            <option value="reception">Réception</option>
            <option value="compta">Compta</option>
            <option value="room">Room staff</option>
            <option value="admin">Admin</option>
          </select>
          <label>Nom complet</label><input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} />
          <div style={{display:"flex", gap:10, marginTop:10, alignItems:"center"}}>
            <button onClick={create} disabled={!form.username.trim()||!form.password}>Créer</button>
            <span className="small">{msg}</span>
          </div>
        </div>

        <div className="col card">
          <div style={{fontWeight:900}}>Utilisateurs</div>
          <table>
            <thead><tr><th>Pseudo</th><th>Rôle</th><th>Nom</th><th>Actif</th><th></th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td>{u.username}</td><td>{u.role}</td><td>{u.full_name||""}</td>
                  <td>{u.is_active ? <span className="ok">actif</span> : <span className="err">off</span>}</td>
                  <td className="right">
                    <button className="ghost" onClick={()=>toggle(u)}>{u.is_active?"Désactiver":"Activer"}</button>{" "}
                    <button className="danger" onClick={()=>del(u)}>Suppr</button>
                  </td>
                </tr>
              ))}
              {users.length===0 ? <tr><td colSpan={5} className="small">Aucun</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
