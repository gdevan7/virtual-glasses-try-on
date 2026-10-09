import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";
import { seed, validate } from "./catalog.js";
const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "32kb" }));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
let memory = [...seed];
async function list(){ if(!pool) return memory.filter(x=>x.active); return (await pool.query("SELECT * FROM glasses WHERE active=TRUE ORDER BY name")).rows; }
async function get(id){ if(!pool) return memory.find(x=>x.id===id)||null; return (await pool.query("SELECT * FROM glasses WHERE id=$1",[id])).rows[0]||null; }
app.get("/api/health",async(_q,r)=>{try{if(pool)await pool.query("SELECT 1");r.json({status:"ok",database:pool?"connected":"memory"});}catch{r.status(503).json({status:"degraded",database:"unavailable"});}});
app.get("/api/glasses",async(_q,r,n)=>{try{r.json({data:await list()});}catch(e){n(e);}});
app.get("/api/glasses/:id",async(q,r,n)=>{try{const x=await get(q.params.id);if(!x||!x.active)return r.status(404).json({error:"Not found"});r.json({data:x});}catch(e){n(e);}});
app.post("/api/glasses",async(q,r,n)=>{const errors=validate(q.body);if(!/^[a-z0-9-]+$/.test(q.body?.id||""))errors.push("id must use lowercase letters, numbers, and hyphens");if(errors.length)return r.status(400).json({error:"Invalid input",details:errors});try{let x;if(!pool){if(memory.some(g=>g.id===q.body.id))return r.status(409).json({error:"ID exists"});x={...q.body,description:q.body.description||"",frame_color:q.body.frame_color||"#202124",style:q.body.style||"classic",model_url:q.body.model_url||null,active:q.body.active??true};memory.push(x);}else{x=(await pool.query("INSERT INTO glasses(id,name,description,frame_color,style,model_url,active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[q.body.id,q.body.name,q.body.description||"",q.body.frame_color||"#202124",q.body.style||"classic",q.body.model_url||null,q.body.active??true])).rows[0];}r.status(201).json({data:x});}catch(e){n(e);}});
app.patch("/api/glasses/:id",async(q,r,n)=>{const errors=validate(q.body,true);if(errors.length)return r.status(400).json({error:"Invalid input",details:errors});try{const old=await get(q.params.id);if(!old)return r.status(404).json({error:"Not found"});const x={...old,...q.body,id:old.id};if(!pool)memory=memory.map(g=>g.id===old.id?x:g);else await pool.query("UPDATE glasses SET name=$2,description=$3,frame_color=$4,style=$5,model_url=$6,active=$7,updated_at=NOW() WHERE id=$1",[old.id,x.name,x.description,x.frame_color,x.style,x.model_url,x.active]);r.json({data:x});}catch(e){n(e);}});
app.delete("/api/glasses/:id",async(q,r,n)=>{try{if(!await get(q.params.id))return r.status(404).json({error:"Not found"});if(!pool)memory=memory.filter(g=>g.id!==q.params.id);else await pool.query("DELETE FROM glasses WHERE id=$1",[q.params.id]);r.status(204).end();}catch(e){n(e);}});
app.use((e,_q,r,_n)=>{console.error(e);r.status(500).json({error:"Internal server error"});});
const server=app.listen(port,()=>console.log(`API listening on ${port}`));
async function close(){server.close();if(pool)await pool.end();}
process.on("SIGINT",close);process.on("SIGTERM",close);
