import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

export default function Stock(){

  const [products,setProducts]=useState([]);

  useEffect(()=>{load();},[]);

  async function load(){
    const {data}=await supabase.from("products").select("*");
    setProducts(data||[]);
  }

  async function add(e){
    e.preventDefault();

    const form=new FormData(e.target);

    await supabase.from("products").insert([{
      name:form.get("name"),
      price:Number(form.get("price")),
      stock:Number(form.get("stock")),
      category:"vente"
    }]);

    load();
  }

  return(
    <Layout title="Stock">

      <form onSubmit={add} className="card">
        <input name="name" placeholder="Produit"/>
        <input name="price" placeholder="Prix"/>
        <input name="stock" placeholder="Stock"/>
        <button>Ajouter</button>
      </form>

      <div className="card">
        {products.map(p=>(
          <div key={p.id}>
            {p.name} | {p.stock} | {p.price}€
          </div>
        ))}
      </div>

    </Layout>
  );
}
