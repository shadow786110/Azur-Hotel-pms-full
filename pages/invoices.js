import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { buildInvoicePdf } from "../lib/pdfUtils";

const VAT_OPTIONS = [0, 2.1, 8.5, 10, 20];
const PAYMENT_METHODS = ["Esp", "Cb", "Chq", "Virement", "Crédit"];

function round2(v){ return Math.round((Number(v||0)+Number.EPSILON)*100)/100; }

function makeLine(){
  return {
    label:"",
    quantity:1,
    unit_price_ttc:0,
    vat_rate:0,
    total_ht:0,
    total_tva:0,
    total_ttc:0,
    product_id:null,
    is_stock_item:false
  };
}

function computeLine(l){
  const q=Number(l.quantity||0);
  const ttc=Number(l.unit_price_ttc||0);
  const vat=Number(l.vat_rate||0);

  const ht=vat>0 ? ttc/(1+vat/100) : ttc;

  const total_ttc=q*ttc;
  const total_ht=q*ht;
  const total_tva=total_ttc-total_ht;

  return {
    ...l,
    total_ht:round2(total_ht),
    total_tva:round2(total_tva),
    total_ttc:round2(total_ttc)
  };
}

function computeTotals(lines){
  return lines.reduce((a,l)=>{
    a.total_ht+=l.total_ht;
    a.total_tva+=l.total_tva;
    a.total_ttc+=l.total_ttc;
    return a;
  },{total_ht:0,total_tva:0,total_ttc:0});
}

export default function Invoices(){

  const [products,setProducts]=useState([]);
  const [cart,setCart]=useState([makeLine()]);
  const [form,setForm]=useState({
    invoice_number:"",
    client_id:"",
    paid_amount:"",
    payment_method:"Esp"
  });

  useEffect(()=>{ loadProducts(); },[]);

  async function loadProducts(){
    const {data}=await supabase.from("products").select("*");
    setProducts(data||[]);
  }

  function updateLine(i,field,val){
    const copy=[...cart];
    copy[i]=computeLine({...copy[i],[field]:val});
    setCart(copy);
  }

  function addProduct(productId){
    const p=products.find(x=>x.id==productId);
    if(!p)return;

    setCart([...cart,computeLine({
      label:p.name,
      quantity:1,
      unit_price_ttc:p.price,
      vat_rate:8.5,
      product_id:p.id,
      is_stock_item:true
    })]);
  }

  async function applyStock(lines,invoiceId){
    for(const l of lines){
      if(!l.product_id) continue;

      const p=products.find(x=>x.id==l.product_id);
      if(!p || p.stock < l.quantity){
        throw new Error("Stock insuffisant: "+p?.name);
      }
    }

    for(const l of lines){
      if(!l.product_id) continue;

      const p=products.find(x=>x.id==l.product_id);

      await supabase.from("stock_movements").insert([{
        product_id:l.product_id,
        quantity:l.quantity,
        type:"out",
        reason:"Facture "+invoiceId
      }]);

      await supabase.from("products")
        .update({stock:p.stock - l.quantity})
        .eq("id",l.product_id);
    }
  }

  async function submit(e){
    e.preventDefault();

    const lines=cart.map(computeLine).filter(l=>l.label);

    const totals=computeTotals(lines);

    const paid=Number(form.paid_amount||0);

    const status = paid >= totals.total_ttc ? "paid" : "draft";

    const {data:inv}=await supabase
      .from("invoices_pms")
      .insert([{
        invoice_number:form.invoice_number,
        client_id:Number(form.client_id),
        total_amount:totals.total_ttc,
        paid_amount:paid,
        status,
        payment_method:form.payment_method
      }])
      .select()
      .single();

    await supabase.from("invoice_custom_lines").insert(
      lines.map(l=>({
        invoice_id:inv.id,
        label:l.label,
        quantity:l.quantity,
        unit_price:l.total_ht,
        vat_rate:l.vat_rate,
        total_ttc:l.total_ttc,
        product_id:l.product_id
      }))
    );

    // 🔥 STOCK UNIQUEMENT SI PAYÉ
    if(status==="paid"){
      await applyStock(lines,inv.id);
    }

    alert("Facture OK");
  }

  const totals=useMemo(()=>computeTotals(cart.map(computeLine)),[cart]);

  return(
    <Layout title="Factures">

      <form onSubmit={submit} className="card">

        <input placeholder="N° facture"
          value={form.invoice_number}
          onChange={e=>setForm({...form,invoice_number:e.target.value})}/>

        <input placeholder="Client ID"
          value={form.client_id}
          onChange={e=>setForm({...form,client_id:e.target.value})}/>

        <select onChange={e=>addProduct(e.target.value)}>
          <option>Ajouter produit</option>
          {products.map(p=>(
            <option key={p.id} value={p.id}>
              {p.name} (stock {p.stock})
            </option>
          ))}
        </select>

        {cart.map((l,i)=>(
          <div key={i}>
            <input value={l.label}
              onChange={e=>updateLine(i,"label",e.target.value)}/>
            <input type="number" value={l.quantity}
              onChange={e=>updateLine(i,"quantity",e.target.value)}/>
            <input type="number" value={l.unit_price_ttc}
              onChange={e=>updateLine(i,"unit_price_ttc",e.target.value)}/>
          </div>
        ))}

        <h3>Total {totals.total_ttc} €</h3>

        <input placeholder="Payé"
          onChange={e=>setForm({...form,paid_amount:e.target.value})}/>

        <button>Valider</button>

      </form>
    </Layout>
  );
}
