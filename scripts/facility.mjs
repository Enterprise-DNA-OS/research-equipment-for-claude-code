#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb} from './lib/db.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {table as textTable} from './lib/format.mjs';
import {page,table,writeOut} from './lib/render.mjs';

export const commands={
 help:'Show this command list',resources:'Equipment and rules',people:'Operators',bookings:'All booking records',
 'lab-week':'Bookings in the next seven days','training-due':'Expired, revoked or expiring recorded training',
 'maintenance-board':'Open equipment holds','usage-review':'Completed booked versus actual minutes',
 'charge-review':'Estimates by project and currency, never invoices',attention:'Work needing attention',compliance:'Record checks, not certification',
 insights:'Ten cross-record answers',show:'BOOKING: detail and history',history:'SUBJECT: event history',
 'add-resource':'--code --name --location --owner --rate-cents --currency --training=yes|no --actor',
 'review-resource':'RESOURCE --owner --rate-cents --currency --training=yes|no --actor',
 'add-person':'--code --name --actor','set-active':'resource|person REF --active=yes|no --actor',
 'record-training':'--person --resource --from=DATE --until=DATE --evidence --assessor --actor',
 'revoke-training':'CREDENTIAL_ID --reason --actor',
 book:'--code --resource --person --project --purpose --start=ISO --end=ISO --actor',
 approve:'BOOKING --actor',cancel:'BOOKING --reason --actor',
 'record-usage':'BOOKING --minutes --actor',
 'hold-equipment':'RESOURCE --start=ISO --end=ISO --reason --owner --actor',
 'close-hold':'HOLD_ID --evidence --actor',log:'BOOKING --note --actor',
 'weekly-review':'Write a local weekly review from three reports',
 'draft-booking-brief':'BOOKING: write a local brief',
 import:'qreserve FILE.csv --source=SITE --actor [--offset=+13:00] [--dry-run]',
 imports:'Import receipts',export:'--out=NEW_FILE.json: all records'
};
const hash=s=>createHash('sha256').update(s).digest('hex');
function args(argv){const pos=[],opts={};for(const a of argv){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in opts)throw Error(`Duplicate flag: ${k}`);opts[k]=i<0?true:a.slice(i+1);}else pos.push(a);}return {pos,opts};}
const required=(o,k)=>{if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Required --${k}=VALUE`);return o[k].trim();};
const bool=(o,k)=>{const v=required(o,k);if(!['yes','no'].includes(v))throw Error(`--${k} must be yes or no`);return v==='yes';};
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Use a valid YYYY-MM-DD date');return v;}
function instant(v,offset){
 v=String(v).trim().replace(' ','T');
 if(offset && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(v))v+=offset;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v))throw Error('Times require ISO dates and an explicit UTC offset');
 date(v.slice(0,10));if(Number(v.slice(11,13))>23||Number(v.slice(14,16))>59)throw Error('Invalid clock time');
 if(!Number.isFinite(Date.parse(v)))throw Error('Invalid timestamp');return new Date(v).toISOString();
}
function decimal(v){if(!/^\d+(\.\d{1,2})?$/.test(v)||Number(v)>9999999999)throw Error('Minutes must be nonnegative with at most two decimal places');return v;}
function rate(o){const cents=required(o,'rate-cents');if(!/^\d+$/.test(cents)||Number(cents)>2147483647)throw Error('rate-cents must be a nonnegative integer within range');const currency=required(o,'currency');if(!/^[A-Z]{3}$/.test(currency))throw Error('currency needs three uppercase letters');return [Number(cents),currency];}
async function match(db,t,ref){
 if(!ref)throw Error(`A ${t} reference is required`);
 const named=['resources','people','bookings'].includes(t);
 if(named){const exact=await db.query(`select * from ${t} where lower(code)=lower($1)`,[ref]);if(exact.length===1)return exact[0];}
 const rows=await db.query(`select * from ${t} where id::text ilike $1${named?' or lower(code)=lower($2)':''}${['resources','people'].includes(t)?' or name ilike $3':''} order by id`,named?(['resources','people'].includes(t)?[ref+'%',ref,'%'+ref+'%']:[ref+'%',ref]):[ref+'%']);
 if(rows.length!==1){const e=Error(rows.length?'Ambiguous reference; choose an ID from candidates':'No matching record');e.candidates=rows.map(r=>({id:r.id,code:r.code,name:r.name}));throw e;}return rows[0];
}
const event=(db,id,actor,action,detail)=>db.query('insert into events(subject_id,actor,action,detail) values($1,$2,$3,$4::jsonb)',[id,actor,action,JSON.stringify(detail)]);
const readQueries={
 resources:'select id,code,name,location,owner,rate_cents,currency,training_required,reviewed,active from resources order by code',
 people:'select id,code,name,active from people order by code',
 bookings:'select * from v_booking_week order by starts_at,code',
 'lab-week':"select code,resource,person,project,starts_at,ends_at,status from v_booking_week where starts_at<now()+interval '7 days' and ends_at>now() and status in ('requested','approved') order by starts_at,code",
 'training-due':"select p.name as person,r.name as resource,c.id,c.valid_until,c.revoked from credentials c join people p on p.id=c.person_id join resources r on r.id=c.resource_id where c.valid_until<=current_date+30 or c.revoked order by c.valid_until",
 'maintenance-board':'select m.id,r.code as resource,m.starts_at,m.ends_at,m.reason,m.owner from maintenance m join resources r on r.id=m.resource_id where closed_at is null order by starts_at',
 'usage-review':'select code,resource,completed_sessions,booked_minutes,actual_minutes,variance_minutes from v_usage order by code',
 'charge-review':"select b.project,b.currency,count(*) as sessions,sum(round(b.actual_minutes*b.rate_cents/60))::bigint as estimated_cents from bookings b where status='completed' and b.rate_cents is not null group by b.project,b.currency order by b.project,b.currency",
 attention:'select reference,kind,detail from v_attention order by reference,kind',
 compliance:'select reference,rule,finding from v_compliance order by reference,rule',
 imports:'select * from imports order by created_at'
};
export const insightQueries=[
 ['Which requested bookings lack current training?',"select reference,finding from v_compliance where rule='TRAINING' order by reference"],
 ['Which reservations overlap maintenance holds?',"select reference,finding from v_compliance where rule='MAINTENANCE' order by reference"],
 ['Which approved sessions ended without usage?',"select reference,detail from v_attention where kind='USAGE_MISSING' order by reference"],
 ['Which instruments used more time than booked?',"select resource,variance_minutes from v_usage where variance_minutes>0 order by resource"],
 ['Which projects have recorded usage estimates by currency?',readQueries['charge-review']],
 ['Which equipment rules still need review?',"select code,name,owner from resources where not reviewed order by code"],
 ['Which instruments have no completed usage?',"select code,resource from v_usage where completed_sessions=0 order by code"],
 ['Which operators have expired training?',"select p.name,r.name as resource,c.valid_until from credentials c join people p on p.id=c.person_id join resources r on r.id=c.resource_id where c.valid_until<current_date and not c.revoked order by p.name,r.name"],
 ['Which equipment holds are overdue?',"select reference,detail from v_attention where kind='MAINTENANCE_OVERDUE' order by reference"],
 ['Which imported bookings still need reconciliation?',"select code,source_key,starts_at,ends_at from bookings where status='imported' order by code"]
];
async function importCsv(db,file,o,actor){
 if(!file)throw Error('CSV path required');const source=required(o,'source');
 const raw=fs.readFileSync(file,'utf8'),rows=parseCsv(raw);if(!rows.length)throw Error('CSV contains no records');
 if(o.offset && !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(o.offset))throw Error('Invalid --offset');
 let added=0,skipped=0;const seen=new Set();
 for(const [index,row] of rows.entries()){
  const get=k=>{const v=pick(row,k).trim();if(!v)throw Error(`Row ${index+2}: missing ${k}`);return v;};
  if(get('Type')!=='Reservation')throw Error(`Row ${index+2}: only Reservation rows are supported; export other activity types separately`);
  if(!['approved','pending','cancelled','denied'].includes(get('Status').toLowerCase()))throw Error(`Row ${index+2}: unsupported Status`);
  const sourceId=get('Reservation ID'),resourceName=get('Resource'),personName=get('User');
  const key=JSON.stringify([source,sourceId,resourceName]);if(seen.has(key))throw Error(`Duplicate reservation/resource row ${index+2}`);seen.add(key);
  const digest=hash(JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))));
  const prior=await db.query('select source_hash from bookings where source_key=$1',[key]);
  if(prior.length){if(prior[0].source_hash!==digest)throw Error(`Changed source row ${sourceId}; reconcile explicitly, no overwrite`);skipped++;continue;}
  const start=instant(get('Date'),o.offset),end=instant(get('Date End'),o.offset);if(start>=end)throw Error('Booking end must follow start');
  const units=pick(row,'Units').trim();if(units && !['1','1.0','1.00'].includes(units))throw Error('Only single-unit exclusive equipment is supported');
  const resCode='QR-R-'+hash(JSON.stringify([source,resourceName])).slice(0,16),personCode='QR-P-'+hash(JSON.stringify([source,personName])).slice(0,16);
  let [r]=await db.query('select * from resources where code=$1',[resCode]);
  if(!r)[r]=await db.query("insert into resources(code,name,location,owner) values($1,$2,'Needs review','Needs review') returning *",[resCode,resourceName]);
  let [p]=await db.query('select * from people where code=$1',[personCode]);
  if(!p)[p]=await db.query('insert into people(code,name) values($1,$2) returning *',[personCode,personName]);
  const actual=pick(row,'Actual Minutes').trim();if(actual)decimal(actual);
  const [b]=await db.query("insert into bookings(code,resource_id,person_id,project,purpose,starts_at,ends_at,status,actual_minutes,source_key,source_hash,source_row) values($1,$2,$3,$4,$5,$6,$7,'imported',$8,$9,$10,$11::jsonb) returning id",['QR-B-'+hash(key).slice(0,20),r.id,p.id,pick(row,'Projects').trim(),pick(row,'Purpose').trim(),start,end,actual||null,key,digest,JSON.stringify(row)]);
  await event(db,b.id,actor,'import',{source,source_id:sourceId});added++;
 }
 if(!o['dry-run'])await db.query('insert into imports(source,sha256,rows_added,rows_skipped,actor) values($1,$2,$3,$4,$5)',[source,hash(raw),added,skipped,actor]);
 return {added,skipped,dry_run:!!o['dry-run'],status:'imported history; review before live use'};
}
export async function run(db,argv){
 const {pos,opts:o}=args(argv);const [cmd='help',ref,arg]=pos;
 if(!Object.hasOwn(commands,cmd))throw Error(`Unknown command ${cmd}; use help`);
 if(cmd==='help')return Object.entries(commands).map(([command,usage])=>({command,usage}));
 if(readQueries[cmd])return db.query(readQueries[cmd]);
 if(cmd==='insights'){const out=[];for(const [question,sql] of insightQueries)out.push({question,answer:await db.query(sql)});return out;}
 if(cmd==='show'){const b=await match(db,'bookings',ref);return {booking:b,checks:await db.query('select * from v_compliance where subject_id=$1',[b.id]),history:await db.query('select actor,action,detail,created_at from events where subject_id=$1 order by created_at',[b.id])};}
 if(cmd==='history'){
  if(!ref||!/^[0-9a-f-]{8,36}$/i.test(ref))throw Error('history requires at least 8 characters of a subject UUID');
  const ids=await db.query('select distinct subject_id from events where subject_id::text ilike $1',[ref+'%']);
  if(ids.length>1)throw Error('Ambiguous subject ID');
  return db.query('select * from events where subject_id::text ilike $1 order by created_at',[ref+'%']);
 }
 if(cmd==='weekly-review'||cmd==='draft-booking-brief'){
  await db.exec('BEGIN READ ONLY');
  try{const sections=[];if(cmd==='weekly-review'){for(const name of ['lab-week','attention','usage-review'])sections.push({title:name.replaceAll('-',' '),html:table(await db.query(readQueries[name]))});}
  else {const b=await match(db,'bookings',ref);sections.push({title:'Booking',html:table(await db.query('select * from v_booking_week where id=$1',[b.id]))},{title:'Record findings',html:table(await db.query('select reference,rule,finding from v_compliance where subject_id=$1',[b.id]))});}
  const name=cmd+'-'+Date.now();return {file:writeOut('drafts',name,page({title:cmd==='weekly-review'?'Research facility weekly review':'Booking brief',subtitle:'Internal draft. No authority to operate equipment.',sections}))};
  }finally{await db.exec('ROLLBACK');}
 }
 if(cmd==='export'){
  const out=required(o,'out');const data={format:'research-equipment/v1',exported_at:new Date().toISOString(),records:{}};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{for(const t of ['resources','people','credentials','bookings','maintenance','events','imports'])data.records[t]=await db.query(`select * from ${t} order by id`);}finally{await db.exec('ROLLBACK');}
  fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {file:path.resolve(out)};
 }
 const actor=required(o,'actor');await db.exec('BEGIN');
 try{
  // A single writer lock keeps approval checks and mutations consistent across CLI processes.
  await db.exec('LOCK TABLE resources, people, credentials, bookings, maintenance IN SHARE ROW EXCLUSIVE MODE');
  let result;
  if(cmd==='import'){
   if(ref!=='qreserve')throw Error('Supported source: qreserve');result=await importCsv(db,arg,o,actor);
  }else if(cmd==='add-resource'){
   const [c,cur]=rate(o);[result]=await db.query('insert into resources(code,name,location,owner,rate_cents,currency,training_required,reviewed) values($1,$2,$3,$4,$5,$6,$7,true) returning *',[required(o,'code'),required(o,'name'),required(o,'location'),required(o,'owner'),c,cur,bool(o,'training')]);
  }else if(cmd==='review-resource'){
   const r=await match(db,'resources',ref),[c,cur]=rate(o);[result]=await db.query('update resources set owner=$2,rate_cents=$3,currency=$4,training_required=$5,reviewed=true where id=$1 returning *',[r.id,required(o,'owner'),c,cur,bool(o,'training')]);
  }else if(cmd==='add-person'){
   [result]=await db.query('insert into people(code,name) values($1,$2) returning *',[required(o,'code'),required(o,'name')]);
  }else if(cmd==='set-active'){
   const t={resource:'resources',person:'people'}[ref];if(!t)throw Error('Choose resource or person');const r=await match(db,t,arg);[result]=await db.query(`update ${t} set active=$2 where id=$1 returning *`,[r.id,bool(o,'active')]);
  }else if(cmd==='record-training'){
   const p=await match(db,'people',required(o,'person')),r=await match(db,'resources',required(o,'resource'));
   [result]=await db.query('insert into credentials(person_id,resource_id,valid_from,valid_until,evidence,assessor) values($1,$2,$3,$4,$5,$6) returning *',[p.id,r.id,date(required(o,'from')),date(required(o,'until')),required(o,'evidence'),required(o,'assessor')]);
  }else if(cmd==='revoke-training'){
   const c=await match(db,'credentials',ref);required(o,'reason');[result]=await db.query('update credentials set revoked=true where id=$1 returning *',[c.id]);
  }else if(cmd==='book'){
   const r=await match(db,'resources',required(o,'resource')),p=await match(db,'people',required(o,'person'));
   [result]=await db.query('insert into bookings(code,resource_id,person_id,project,purpose,starts_at,ends_at) values($1,$2,$3,$4,$5,$6,$7) returning *',[required(o,'code'),r.id,p.id,required(o,'project'),required(o,'purpose'),instant(required(o,'start')),instant(required(o,'end'))]);
  }else if(cmd==='approve'){
   const b=await match(db,'bookings',ref);if(b.status!=='requested')throw Error('Only requested bookings can be approved');
   const [r]=await db.query('select * from resources where id=$1',[b.resource_id]);if(!r.reviewed)throw Error('Resource rules need review');
   if(new Date(b.starts_at)<=new Date())throw Error('Cannot approve a booking that has started');
   const findings=await db.query('select rule,finding from v_compliance where subject_id=$1',[b.id]);
   if(findings.length)throw Error('Approval blocked: '+findings.map(f=>f.finding).join('; '));
   [result]=await db.query("update bookings set status='approved',approved_by=$2,approved_at=now(),rate_cents=$3,currency=$4 where id=$1 returning *",[b.id,actor,r.rate_cents,r.currency]);
  }else if(cmd==='cancel'){
   const b=await match(db,'bookings',ref);if(!['requested','approved'].includes(b.status))throw Error('Only requested or approved bookings can be cancelled');required(o,'reason');[result]=await db.query("update bookings set status='cancelled' where id=$1 returning *",[b.id]);
  }else if(cmd==='record-usage'){
   const b=await match(db,'bookings',ref);if(b.status!=='approved')throw Error('Only approved bookings accept actual usage');
   if(new Date(b.starts_at)>new Date())throw Error('Cannot record future actual usage');
   [result]=await db.query("update bookings set actual_minutes=$2,status='completed' where id=$1 returning *",[b.id,decimal(required(o,'minutes'))]);
  }else if(cmd==='hold-equipment'){
   const r=await match(db,'resources',ref);[result]=await db.query('insert into maintenance(resource_id,starts_at,ends_at,reason,owner) values($1,$2,$3,$4,$5) returning *',[r.id,instant(required(o,'start')),instant(required(o,'end')),required(o,'reason'),required(o,'owner')]);
  }else if(cmd==='close-hold'){
   const m=await match(db,'maintenance',ref);if(m.closed_at)throw Error('Hold already closed');[result]=await db.query('update maintenance set closed_at=now(),evidence=$2 where id=$1 returning *',[m.id,required(o,'evidence')]);
  }else if(cmd==='log'){
   const b=await match(db,'bookings',ref);result={id:b.id,note:required(o,'note')};
  }
  if(result?.id)await event(db,result.id,actor,cmd,{...o,after:result});
  await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
export function format(value){
 if(Array.isArray(value)){if(!value.length)return '(none)';const rows=value.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Date?v.toISOString():typeof v==='object'&&v!==null?JSON.stringify(v):v])));return textTable(rows,Object.keys(rows[0]).map(key=>({key,label:key.replaceAll('_',' '),width:key==='detail'||key==='finding'?70:32})));}
 return JSON.stringify(value,null,2);
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const argv=process.argv.slice(2);let db;
 try{db=await getDb();const result=await run(db,argv);console.log(argv.includes('--json')?JSON.stringify(result):format(result));}
 catch(e){console.error(JSON.stringify({error:e.message,...(e.candidates?{candidates:e.candidates}:{})}));process.exitCode=1;}
 finally{if(db)await db.close();}
}
