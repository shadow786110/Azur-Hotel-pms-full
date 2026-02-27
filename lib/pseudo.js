export function pseudoToEmail(pseudo){ const domain=process.env.PSEUDO_EMAIL_DOMAIN||'azur.local'; const p=String(pseudo||'').trim().toLowerCase(); return `${p}@${domain}`; }
