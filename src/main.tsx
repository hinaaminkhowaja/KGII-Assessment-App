import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

type Rec={RecordID:string;SourceRecordID?:string;ChildName?:string;TeacherName?:string;CycleID:string;Year:number;ParticipantType:string;Assessment:string;Region:string;LocalBoard:string;REC:string;ParticipantCount:number;Phase:string;ThemeID:string;DimensionID:string;IndicatorID:string;Score:number;MaxScore:number};
type Ref={Region:string;LocalBoard:string;REC:string};
type Indicator={CycleID:string;ParticipantType:string;Assessment:string;ThemeID:string;ThemeName:string;DimensionID:string|null;IndicatorID:string;MaxScore:number;SourceSheet:string;SourceColumn:number};
const pct=(n:number,d:number)=>d?100*n/d:0;
const fmt=(x:number)=>Number.isFinite(x)?x.toFixed(1)+'%':'—';
const norm=(v:any)=>String(v??'').trim();
const geoNorm=(v:any)=>norm(v).replace(/\s+/g,' ').toLocaleLowerCase();
function uniqueGeoValues(values:any[]){const map=new Map<string,string>();for(const value of values){const raw=norm(value);const key=geoNorm(raw);if(key&&!map.has(key))map.set(key,raw.replace(/\s+/g,' '));}return [...map.values()].sort((a,b)=>a.localeCompare(b));}
function aggregate(rows:Rec[]){let s=0,m=0;for(const r of rows){s+=Number(r.Score)||0;m+=Number(r.MaxScore)||0}return {score:s,max:m,p:pct(s,m)};}
function avgRating(rows:Rec[],participantType:string){const x=rows.filter(r=>r.ParticipantType===participantType);if(!x.length)return 0;return x.reduce((a,r)=>a+(Number(r.Score)||0),0)/x.length;}
function scoreOutOf(rows:Rec[],participantType:string,unitMax:number){const x=rows.filter(r=>r.ParticipantType===participantType);return x.length?avgRating(rows,participantType)*unitMax:0;}
function scoreModel(rows:Rec[]){const student=scoreOutOf(rows,'Student',29);const teacher=scoreOutOf(rows,'Teacher',4);return {student,teacher,total:student+teacher,max:103};}
function combinedScore(rows:Rec[]){const pre=scoreModel(rows.filter(r=>assessmentIs(r.Assessment,'Pre'))),post=scoreModel(rows.filter(r=>assessmentIs(r.Assessment,'Post')));return {score:pre.total+post.total,max:32,percent:pct(pre.total+post.total,32),pre,post};}
function unique(rows:Rec[],key:keyof Rec){return [...new Set(rows.map(r=>norm(r[key])) )].filter(Boolean).sort((a,b)=>a.localeCompare(b));}
function labelTheme(id:string){const m:any={T1:'Theme 1 — Authority and Leadership',T2:'Theme 2 — Intellectual Traditions',T3:'Theme 3 — Role in Family, Community and Society',T4:'Theme 4 — Two Aspects of Life'};return m[id]||id}
function cycleLabel(value:string){
  const raw=norm(value);
  const match=raw.match(/^cycle[\s_-]*0?([12])(?:\b|$)/i)||raw.match(/^c[\s_-]*0?([12])$/i)||raw.match(/^0?([12])$/);
  return match?`Cycle ${match[1]}`:raw;
}
function displayGeo(value:string){
  const raw=String(value||'').trim();
  const cleaned=raw.replace(/[_-]+/g,' ').replace(/\s+\d+$/,'').replace(/\s+/g,' ').trim();
  const normalized=cleaned.toLowerCase();
  const labels:Record<string,string>={southern:'Southern',central:'Central',gilgit:'Gilgit',hunza:'Hunza','gupis yasin':'Gupis Yasin','ishkoman puniyal':'Ishkoman Puniyal','lower chitral':'Lower Chitral','upper chitral':'Upper Chitral'};
  return labels[normalized] || cleaned;
}
function rubricAction(id:string,theme:string,dimension:string){
  const actions:any={
    'Theme1:UA1':'Use a picture sequence of familiar creations (people, animals, plants and the world). Ask the child to name what Allah created and explain one example in their own words.',
    'Theme1:A1':'Set up a nature-care task. Observe whether the child handles plants, animals, people and surroundings gently, then discuss one caring choice.',
    'Theme1:UA2':'Use a “can I see it?” sorting game with examples from nature. Invite the child to explain what can be seen and what cannot be seen, without prompting the answer.',
    'Theme1:A2':'Give the child a water-use scenario. Ask them to demonstrate one way to use water carefully and explain why it is a gift to protect.',
    'Theme1:A3':'Share a short everyday dilemma and ask the child to choose a kind or thoughtful response. Observe whether the child connects the action with doing what is right.',
    'Theme1:UA3':'Ask the child to explain who the present Imam is and describe one way the Imam guides the Jamat.',
    'Theme1:UA4':'Invite the child to describe a prayer or REC/Jamat Khana practice and what it means to follow guidance.',
    'Theme1:A4':'Set a classroom or home routine challenge: tidy materials, share resources or water a plant. Observe whether the child independently follows through.',
    'Theme1:A5':'Use a peer-play scenario. Observe kind words, helpful behaviour and care for living things; discuss one specific example afterward.',
    'Theme1:A6':'Ask the child to choose one caring action for the day and report or demonstrate it at the next check-in.',
    'Theme2:UA1':'Use a Didar picture or story. Ask the child to explain why meeting the Imam and the Jamat is a special occasion.',
    'Theme2:UA2':'Ask the child to describe how the Imam guides and blesses the Jamat through Farmans, using their own words.',
    'Theme2:A1':'Help the child plan a simple preparation-for-Didar sequence that includes prayer, helping others and caring for the environment; observe which steps they can explain.',
    'Theme2:UA3':'Use greeting cards or a short role-play. Ask the child when to say “Ya Ali Madad” or “Mawla Ali Madad” and how to greet others respectfully.',
    'Theme2:UA4':'Ask the child to explain who Mawlana Ali is and when they seek help by saying “Ya Ali Madad” or “Mawla Ali Madad”.',
    'Theme2:A2':'Practise greetings through a role-play with familiar and unfamiliar people. Observe whether the child chooses an appropriate greeting independently.',
    'Theme2:A3':'Give a short scenario about helping or showing kindness before a special occasion. Ask the child to choose and demonstrate an action that reflects the Imam’s guidance.',
    'Theme3:UA1':'Use a family picture or home routine story. Ask the child to name their role in the family and give an example of helping or sharing.',
    'Theme3:A1':'Offer a practical classroom helper task, such as tidying, planting or sharing materials. Observe whether the child takes part and can describe how it helps others.',
    'Theme3:UA2':'Use a simple global Jamat map or story. Ask the child to explain how people are connected and how they can help people in their community.',
    'Theme3:UA3':'Discuss a familiar service situation and ask the child to explain one age-appropriate way to serve or support others.',
    'Theme3:A2':'Arrange a small voluntary service opportunity, such as offering water or helping a peer. Observe respectful participation and reflect with the child.',
    'Theme4:UA1':'Use a two-sided picture sort for material and spiritual aspects of life. Ask the child to give an example of each and explain why both matter.',
    'Theme4:UA2':'Ask the child to plan a balanced day that includes caring for self/others/environment and prayer or rituals. Discuss how the choices fit together.',
    'Theme4:A1':'Set a small learning goal and ask the child to complete it carefully. Notice persistence and invite them to reflect on effort.',
    'Theme4:A2':'Give the child a plant or animal-care responsibility and observe whether they act gently and consistently.',
    'Theme4:A3':'Use a peer-conflict or sharing scenario. Ask the child to demonstrate a helpful, kind response and describe its effect on others.',
    'Theme4:A4':'Review attendance routines with the child and caregiver. Identify one practical barrier and agree on a simple plan to support regular REC attendance.',
    'Theme4:A5':'Use a role-play about Jamat Khana. Ask the child to describe or demonstrate an age-appropriate way to participate respectfully in prayers and rituals.',
    'Theme4:A6':'Plan a small service task for the Jamat. Observe the child helping willingly and discuss how the action supports the wider community.'
  };
  return actions[id] || (dimension==='UA'
    ? 'Use a concrete picture, story or object linked to this rubric. Ask an open question, allow the child time to respond, and record the child’s own explanation as evidence.'
    : 'Provide a practical activity linked to this rubric. Observe the child demonstrating the behaviour independently, give specific supportive feedback, and reassess using the same indicator.');
}

function surveyThemeName(id: string) {
  const names: Record<string, string> = {
    T1: 'Authority and Leadership',
    T2: 'Ismaili Muslim Traditions',
    T3: 'Role in family, community and society',
    T4: 'Two aspects of life'
  };

  return names[id] || id;
}

const studentIndicatorKeys: Record<string, string[]> = {
  T1: [
    'Theme1:UA1', 'Theme1:A1', 'Theme1:UA2', 'Theme1:A2',
    'Theme1:A3', 'Theme1:UA3', 'Theme1:UA4', 'Theme1:A4',
    'Theme1:A5', 'Theme1:A6'
  ],
  T2: [
    'Theme2:UA1', 'Theme2:UA2', 'Theme2:A1', 'Theme2:UA3',
    'Theme2:UA4', 'Theme2:A2', 'Theme2:A3'
  ],
  T3: [
    'Theme3:UA1', 'Theme3:A1', 'Theme3:UA2', 'Theme3:A2'
  ],
  T4: [
    'Theme4:UA1', 'Theme4:UA2', 'Theme4:A1', 'Theme4:A2',
    'Theme4:A3', 'Theme4:A4', 'Theme4:A5', 'Theme4:A6'
  ]
};

function studentScore(value: string): number {
  const scores: Record<string, number> = {
    'Very well': 3,
    'To some extent': 2,
    'Face difficulty': 1
  };

  return scores[value] || 0;
}

function teacherScore(value: string): number {
  const scores: Record<string, number> = {
    'Exemplary (4)': 4,
    'Proficient (3)': 3,
    'Developing (2)': 2,
    'Emerging (1)': 1
  };

  return scores[value] || 0;
}

function labelDim(id:string){return id==='UA'?'UA — Understanding / Articulation':id==='A'?'A — Application':id}

function ratingFilterMatch(r:Rec,f:any){
 const type=norm(r.ParticipantType).toLowerCase(),score=Number(r.Score);
 const studentRating=norm(f.studentRating),teacherRating=norm(f.teacherRating);
 if(!studentRating&&!teacherRating)return true;
 return (type==='student'&&!!studentRating&&score===Number(studentRating))||(type==='teacher'&&!!teacherRating&&score===Number(teacherRating));
}
function filterRows(rows:Rec[],f:any){return rows.filter(r=>(!f.cycle||f.cycle==='All'||cycleLabel(r.CycleID)===cycleLabel(f.cycle))&&(!f.region||geoNorm(r.Region)===geoNorm(f.region))&&(!f.board||geoNorm(r.LocalBoard)===geoNorm(f.board))&&(!f.rec||geoNorm(r.REC)===geoNorm(f.rec))&&(!f.pt||r.ParticipantType===f.pt)&&(!f.teacher||norm(r.TeacherName)===f.teacher)&&(!f.assessment||r.Assessment===f.assessment)&&(!f.theme||r.ThemeID===f.theme)&&(!f.dim||r.DimensionID===f.dim)&&(!f.year||String(r.Year)===String(f.year))&&ratingFilterMatch(r,f))}

const studentIndicators={
 T1:[
 'Child explained with examples that Allah made everything, including the world, animals, plants, nature and us.','Child showed care and respect for Allah’s creation.','Child explained visible and invisible things in nature.','Child used natural resources such as water as a gift of Allah.','Child did a kind or thoughtful action knowing Allah is always with them.','Child shared or explained that Mawlana Rahim Al-Hussaini is the 50th and present Imam who loves and guides us.','Child explained that the Imam guides through Farmans to care for self, others and the environment.','Child followed Imam guidance through prayers, tasbih, attending RECs or JKs.','Child followed guidance through caring actions such as cleaning, sharing, helping, watering plants and not wasting.','Child showed good behaviour toward others and the environment through kind words, helping, and caring for plants or animals.'
 ],
 T2:['Child understood Didar as a special and happy occasion to meet the Imam and Ismaili brothers and sisters.','Child understood that the Imam gives blessings and guides Jamat through Farmans during Didar.','Child prepared for Didar by praying, helping and caring for the environment.','Child demonstrated Imam guidance through sharing, helping, kindness and caring.','Child explained that Mawlana Ali is Imam and that we seek help with Ya Ali Madad or Mawla Ali Madad.','Child knew that Ya Ali Madad or Mawla Ali Madad are Ismaili greetings.','Child greeted Ismaili brothers and sisters with Ya Ali Madad or Mawla Ali Madad and non-Ismailis with Assalamualaikum.'],
 T3:['Child understood the role of family, helped parents and shared with siblings.','Child helped parents with simple chores and shared toys or belongings.','Child understood the global Jamat, Hazar Imam, global guidance and service.','Child participated in age-appropriate voluntary services such as giving water, helping with shoes, washing hands or listening respectfully.'],
 T4:['Child understood that material and spiritual life are both important.','Child balanced caring for self, others and the environment with prayers and rituals.','Child worked hard in school to make parents and the Imam happy.','Child cared for animals, plants and the environment.','Child helped and supported others and showed kindness.','Child attended REC regularly to learn and understand faith.','Child attended Jamat Khana for prayers and rituals.','Child served the Jamat and helped Ismaili brothers and sisters as one global Jamat.']
};
const rating3=['Very well','To some extent','Face difficulty'];
const studentActivities:any={T1:['Allah the Creator worksheet','Nature walk','Right or Wrong worksheet','Any other'],T2:['Role play','Scenario based worksheet','Any other'],T3:['Helping Hands','Any other'],T4:['Balancing Scale','Any other']};

const teacherRubricT1=[['Exemplary (4)','The response demonstrates a thorough understanding of diverse models of authority and leadership within Islam, with a clear rationalization of rightful leadership throughout. The articulation features the continuity of divine guidance within the Shia Ismaili Muslim community till date, based on Shia doctrine, tradition and interpretation of history. It reflects inclusivity and respect towards other communities of interpretations and practical perspectives.'],['Proficient (3)','The response demonstrates a sound understanding of diverse models of authority and leadership within Islam with some rationalization. It features continuity of divine guidance within the Shia Ismaili Muslim community till date with some references to Shia doctrine, tradition and interpretation of history, and reflects respect and openness towards other communities of interpretations.'],['Developing (2)','The response demonstrates an understanding of Sunni and Shia models of authority, highlighting diverse interpretations only within Shia Islam. It features continuity of divine guidance within the Shia Ismaili Muslim community till date through hereditary Imamat from Prophet Muhammad’s family through Hazrat Mawlana Ali (A.S.) and Hazrat Bibi Fatimah (A.S.), but reflects a struggle in accepting diverse communities and their interpretations as part of Islam.'],['Emerging (1)','The response demonstrates a basic understanding of interpretations within Islam and can hardly show evidence of diverse communities of interpretations. It features continuity of divine guidance within the Shia Ismaili Muslim community till date through Imamat and after the Prophet Muhammad, Hazrat Mawlana Ali (A.S.) became our first Imam. The response might reflect that Ismailis are truly guided or on the right path and also an effort towards learning about others.']];
const teacherRubricT3=[['Exemplary (4)','Provides a thoughtful and well-structured response that integrates Islamic teachings on vicegerency (khalifa), mutual responsibility, and ethical living. Proposes well-reasoned solutions that effectively balance personal growth and community service while thoughtfully considering multiple perspectives (social, religious, cultural, and intellectual).'],['Proficient (3)','Provides a clear and structured response that integrates Islamic teachings on vicegerency (khalifa), mutual responsibility, and ethical living. Suggests practical solutions but struggles to fully balance personal growth and community service, with only limited consideration of multiple perspectives (social, religious, cultural, and intellectual).'],['Developing (2)','Demonstrates a basic understanding of Islamic teachings and responsibilities but struggles to provide practical solutions. Lacks depth in balancing personal growth and community service and shows only limited consideration of multiple perspectives (social, religious, cultural, and intellectual).'],['Emerging (1)','Begins to develop a basic understanding of Islamic teachings and responsibilities but fails to suggest practical solutions. Lacks depth in balancing personal growth and community service with no consideration of multiple perspectives (social, religious, cultural, and intellectual).']];
const teacherRubricT4=[['Exemplary (4)','Provides a well-structured explanation of the balance between din and dunya, recognizing their interconnection within Islam and the Ismaili tradition. Suggests multiple actionable strategies while maintaining balance between material and spiritual growth.'],['Proficient (3)','Provides a well-structured explanation of the balance between din and dunya, recognizing their interconnection within Islam and the Ismaili tradition. Attempts to suggest multiple actionable strategies while maintaining balance between material and spiritual growth, but with some difficulty.'],['Developing (2)','Demonstrates a basic understanding of the relationship between din and dunya; however, struggles to provide a detailed explanation of their significance and interconnection within Islam and the Ismaili tradition. Finds it difficult to suggest multiple actionable strategies while maintaining balance between material and spiritual growth.'],['Emerging (1)','Begins to develop an understanding of the relationship between din and dunya; however, struggles to provide a detailed explanation of their significance and interconnection within Islam and the Ismaili tradition. Also fails to provide actionable strategies for maintaining balance between material and spiritual growth.']];
const teacherRubricT2=[['Exemplary (4)','The response clearly highlights the importance of primary sources while encouraging reflection and seeking knowledge from diverse sources. It provides historical examples of Muslim intellectuals engaging with various cultures, integrating knowledge within the ethics of Islam, and making significant contributions across different fields. It demonstrates a strong understanding of the diverse and evolving nature of Islamic thought. Additionally, it emphasizes the continuation of this intellectual tradition, showcasing the Ismaili tradition within the broader Islamic framework, which values knowledge, lifelong learning, and contributing to society’s well-being.'],['Proficient (3)','The response highlights the importance of primary sources while encouraging reflection and seeking knowledge from diverse sources. It provides historical examples of Muslim intellectuals engaging with various cultures, integrating knowledge within the ethics of Islam, and making significant contributions across different fields. It shows a struggle in understanding the evolution but an effort is evident to connect it with the intellectual approach of the Ismaili tradition within the broader Islamic framework, which values knowledge, lifelong learning, and contributing to society’s well-being.'],['Developing (2)','The response highlights Qur’an and Sunnah as the main sources of Islamic teachings with reference to Hadith, which encourages acquiring knowledge from other sources and reflection mentioned in the Qur’an. An effort is evident towards openness to learn from other sources.'],['Emerging (1)','The response only refers to the Qur’an and Sunnah as the significant sources of guidance as most Muslims seek guidance from these sources; the response might refer to the Hadith-e-Thaqalayn, with the interpretation of these two sources mentioned.']];
const teacherRubrics:any={T1:{pre:teacherRubricT1,post:teacherRubricT1},T2:{pre:teacherRubricT2,post:teacherRubricT2},T3:{pre:teacherRubricT3,post:teacherRubricT3},T4:{pre:teacherRubricT4,post:teacherRubricT4}};

type UserRole='admin'|'user';
type UserStatus='pending'|'approved'|'rejected'|'suspended';
type AppUser={id:string;name:string;email:string;password?:string;role:UserRole;status:UserStatus;createdAt:string};
type AccessRule={id:string;userId:string;region:string;board:string;rec:string;active:boolean};
const API_URL='https://script.google.com/macros/s/AKfycbyKPP1xJ2u00KDvrI3igfbT5ezDo0we7zR2Frta8AL9Usu0G6kWS36MxyZMC5yQ7gW25A/exec';
const SESSION_KEY='kgii_app_session_email_v1';
const USER_CACHE_KEY='kgii_app_cached_user_v1';

async function apiGetRaw(action:string,params:Record<string,string>={}){const q=new URLSearchParams({action,...params});let lastError:any;for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(API_URL+'?'+q.toString(),{cache:'no-store'});if(!r.ok){if(r.status===404||r.status>=500||r.status===429)throw new Error('Temporary API error ('+r.status+')');throw new Error('API request failed ('+r.status+')')}const d=await r.json();if(d.success===false)throw new Error(d.message||d.error||'API request failed.');return d;}catch(e:any){lastError=e;const message=String(e?.message||e);const retryable=e instanceof TypeError||/Temporary API error|Failed to fetch|NetworkError|Load failed/i.test(message);if(!retryable||attempt===1)break;await new Promise(resolve=>setTimeout(resolve,500));}}throw lastError||new Error('API request failed.');}
const apiGetInFlight=new Map<string,Promise<any>>();
function apiGet(action:string,params:Record<string,string>={}){const key=action+'?'+new URLSearchParams(Object.entries(params).sort(([a],[b])=>a.localeCompare(b))).toString();const pending=apiGetInFlight.get(key);if(pending)return pending;const request=apiGetRaw(action,params).finally(()=>{if(apiGetInFlight.get(key)===request)apiGetInFlight.delete(key)});apiGetInFlight.set(key,request);return request;}
const OFFLINE_QUEUE_KEY='kgii_assessment_offline_queue_v1';
type OfflineJob={id:string;action:string;body:Record<string,any>;createdAt:string};
function readOfflineQueue():OfflineJob[]{try{const q=JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)||'[]');return Array.isArray(q)?q:[]}catch{return []}}
function writeOfflineQueue(q:OfflineJob[]){localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(q));}
async function apiPost(action:string,body:Record<string,any>){let response:Response;try{response=await fetch(`${API_URL}?action=${encodeURIComponent(action)}`,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow'});}catch(e:any){if(action==='studentsurvey'||action==='teachersurvey'){const q=readOfflineQueue();q.push({id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,action,body,createdAt:new Date().toISOString()});writeOfflineQueue(q);return {success:true,queuedOffline:true,queueId:q[q.length-1].id};}throw new Error(`${action} request could not reach Google Apps Script: ${e?.message||'network or CORS error'}. Check your internet connection and Apps Script deployment.`)}const raw=await response.text();let d:any;try{d=JSON.parse(raw)}catch{const detail=raw.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim().slice(0,220);throw new Error(`${action} API returned a non-JSON response (HTTP ${response.status}): ${detail||'empty response'}. Check the Apps Script deployment and execution log.`)}if(!response.ok)throw new Error(`${action} API failed with HTTP ${response.status}: ${d.message||d.error||d.details||'No error details returned by Apps Script.'}`);if(d.success===false)throw new Error(`${action} API rejected the request: ${d.message||d.error||d.details||'Apps Script returned success:false without an error message.'}`);return d;}
async function syncOfflineSurveyQueue(){if(!navigator.onLine)return {synced:0,pending:readOfflineQueue().length};const q=readOfflineQueue();const remaining:OfflineJob[]=[];let synced=0;for(const job of q){try{const result=await apiPostOnline(job.action,job.body);if(result?.success===false)throw new Error(result.message||'Rejected');synced++;}catch{remaining.push(job);}}writeOfflineQueue(remaining);return {synced,pending:remaining.length};}
async function apiPostOnline(action:string,body:Record<string,any>){const response=await fetch(`${API_URL}?action=${encodeURIComponent(action)}`,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow'});const raw=await response.text();const d=JSON.parse(raw);if(!response.ok||d.success===false)throw new Error(d.message||'Sync failed');return d;}

function mapUser(x:any):AppUser{const role=String(x.role||'User').toLowerCase()==='admin'?'admin':'user';const rawStatus=String(x.status||'pending').toLowerCase();const status=(rawStatus==='approved'?'approved':rawStatus==='rejected'?'rejected':rawStatus==='suspended'?'suspended':'pending') as UserStatus;const email=norm(x.email).toLowerCase();return {id:norm(x.id)||email,name:norm(x.name)||email,email,role,status,createdAt:norm(x.createdAt||x.created_at)}}
function mapAccess(x:any):AccessRule{const email=norm(x.email).toLowerCase();return {id:norm(x.id)||[email,x.region,x.localBoard||x.board,x.rec].join('|'),userId:norm(x.userId)||email,region:norm(x.region),board:norm(x.localBoard||x.board),rec:norm(x.rec),active:x.active===true||String(x.active).toLowerCase()==='true'||String(x.active)==='1'||String(x.active).toLowerCase()==='yes'}}
function accessMatches(r:Rec,a:AccessRule){return a.active&&(!a.region||r.Region===a.region)&&(!a.board||r.LocalBoard===a.board)&&(!a.rec||r.REC===a.rec)}
function userHasAccess(u:AppUser|null,access:AccessRule[]){return !!u&&(u.role==='admin'||access.some(a=>a.userId===u.id&&a.active))}
function arrayFrom(d:any,...keys:string[]):any[]{for(const k of keys)if(Array.isArray(d?.[k]))return d[k];if(Array.isArray(d))return d;return []}
function normalizeRefs(rows:any[]):Ref[]{return rows.map((x:any)=>({Region:norm(x?.Region??x?.region??x?.REGION??x?.RegionName),LocalBoard:norm(x?.LocalBoard??x?.localBoard??x?.localboard??x?.['Local Board']??x?.LOCALBOARD),REC:norm(x?.REC??x?.rec??x?.Rec??x?.RECName)})).filter((x:Ref)=>x.Region&&x.LocalBoard&&x.REC)}
function readCachedRefs():Ref[]{try{const rows=JSON.parse(localStorage.getItem('kgii_assessment_cached_refs')||'[]');return normalizeRefs(Array.isArray(rows)?rows:[])}catch{return []}}

function App(){
 const [records,setRecords]=useState<Rec[]>(()=>{try{const cached=JSON.parse(localStorage.getItem('kgii_assessment_cached_records')||'[]');return Array.isArray(cached)?cached:[]}catch{return []}});const [refs,setRefs]=useState<Ref[]>(readCachedRefs);const [targetRecs,setTargetRecs]=useState<any[]>(()=>{try{const cached=JSON.parse(localStorage.getItem('kgii_assessment_cached_target_recs')||'[]');return Array.isArray(cached)?cached:[]}catch{return []}});const [indicators,setIndicators]=useState<Indicator[]>([]);const [referenceLoaded,setReferenceLoaded]=useState(false);
 const [page,setPage]=useState('home');const [mobileNavOpen,setMobileNavOpen]=useState(false);const [printOpen,setPrintOpen]=useState(false);const [apiError,setApiError]=useState('');const [loading,setLoading]=useState(false);
 const [f,setF]=useState<any>({region:'',board:'',rec:'',pt:'',assessment:'',theme:'',dim:'',year:'',phase:''});
 const [user,setUser]=useState<AppUser|null>(null);const [users,setUsers]=useState<AppUser[]>([]);const [access,setAccess]=useState<AccessRule[]>([]);
 useEffect(()=>{const sync=()=>{void syncOfflineSurveyQueue();};window.addEventListener('online',sync);if(navigator.onLine)sync();return()=>window.removeEventListener('online',sync);},[]);
 const loadReference=async()=>{if(referenceLoaded)return;const cachedRefs=readCachedRefs();const cachedIndicators=(()=>{try{return JSON.parse(localStorage.getItem('kgii_assessment_cached_indicators')||'[]')}catch{return []}})();if(cachedRefs.length)setRefs(cachedRefs);if(Array.isArray(cachedIndicators)&&cachedIndicators.length)setIndicators(cachedIndicators);const d=await apiGet('reference');const rr=arrayFrom(d,'refs','reference','records','data');const normalizedRefs=normalizeRefs(rr);const ii=arrayFrom(d,'indicators','APP_Indicators');const targets=arrayFrom(d,'targetRecs','targetRECs','target_recs').map((x:any)=>({Region:norm(x.Region??x.region),LocalBoard:norm(x.LocalBoard??x.localBoard??x.localboard),REC:norm(x.REC??x.rec),Cycle1Phase:norm(x.Cycle1Phase??x['Cycle 1 Phase']),Cycle2Phase:norm(x.Cycle2Phase??x['Cycle 2 Phase']),Status:norm(x.Status??x.status)})).filter((x:any)=>x.Region&&x.LocalBoard&&x.REC);if(normalizedRefs.length)setRefs(normalizedRefs);if(targets.length){setTargetRecs(targets);activeTargetRecs=targets;}if(ii.length)setIndicators(ii);localStorage.setItem('kgii_assessment_cached_refs',JSON.stringify(normalizedRefs));localStorage.setItem('kgii_assessment_cached_target_recs',JSON.stringify(targets));localStorage.setItem('kgii_assessment_cached_indicators',JSON.stringify(ii));setReferenceLoaded(true);};
 const loadDashboard=async(email:string)=>{
  const d=await apiGet('dashboard',{email});
  const rows=arrayFrom(d,'records','rows','data');
  const headers=Array.isArray(d.headers)?d.headers:[];
  const headerIndex=new Map<string,number>();
  headers.forEach((h:string,i:number)=>headerIndex.set(norm(h).toLowerCase().replace(/[^a-z0-9]/g,''),i));
  const normalized=rows.map((row:any)=>{
    const objectRow=Array.isArray(row)?null:row;
    const objectIndex=new Map<string,string>();
    if(objectRow)Object.keys(objectRow).forEach((key:string)=>objectIndex.set(key.toLowerCase().replace(/[^a-z0-9]/g,''),key));
    const field=(...names:string[])=>{
      for(const name of names){
        const wanted=name.toLowerCase().replace(/[^a-z0-9]/g,'');
        const direct=objectRow?.[name];
        if(direct!==undefined&&direct!==null&&String(direct).trim()!=='')return direct;
        if(Array.isArray(row)){
          const index=headerIndex.get(wanted);
          if(index!==undefined&&row[index]!==undefined&&row[index]!==null&&String(row[index]).trim()!=='')return row[index];
        }else{
          const key=objectIndex.get(wanted);
          const value=key?objectRow[key]:undefined;
          if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;
        }
      }
      return '';
    };
    return {RecordID:norm(field('RecordID','recordId','ID')),SourceRecordID:norm(field('SourceRecordID','Source Record ID')),ChildName:norm(field('ChildName','Child Name','StudentName','Student Name','ParticipantName','Participant Name','Name')),StudentID:norm(field('StudentID','Student ID','ChildID','Child ID','ParticipantID','Participant ID','StudentCode','Student Code')),TeacherName:norm(field('TeacherName','Teacher Name','Name of Teacher','TeacherID','Teacher ID')),CycleID:norm(field('CycleID')),Year:Number(field('Year'))||0,ParticipantType:norm(field('ParticipantType','Participant Type')),Assessment:norm(field('Assessment','Assessment Stage')),Region:norm(field('Region')),LocalBoard:norm(field('LocalBoard','Local Board')),REC:norm(field('REC')),ParticipantCount:Number(field('ParticipantCount','Participant Count','No. of Participants','Number of Participants','Participants Count','No of Students','Student Count'))||0,Phase:norm(field('Phase')),ThemeID:norm(field('ThemeID','Theme ID')),DimensionID:norm(field('DimensionID','Dimension ID')),IndicatorID:norm(field('IndicatorID','Indicator ID')),Score:Number(field('Score'))||0,MaxScore:Number(field('MaxScore','Max Score'))||0} as Rec;
  });
  setRecords(normalized);
  try{localStorage.setItem('kgii_assessment_cached_records',JSON.stringify(normalized));}catch(e){console.warn('Could not cache assessment records',e)}
 };
 const loadAdmin=async(email:string)=>{const [u,a]=await Promise.all([apiGet('users',{email}),apiGet('access',{email})]);const uu=arrayFrom(u,'users','records','data').map(mapUser);const ac=arrayFrom(a,'access','rules','data').map(mapAccess);setUsers(uu);setAccess(ac);};
 // Load reference lists only when a page needs them. Keeping this request off the initial dashboard path reduces competing Apps Script calls.
 useEffect(()=>{if(!['student-survey','teacher-survey','admin','dashboard','region','board','rec','teacher','theme','dimension','prepost','crossanalysis'].includes(page))return;let active=true;loadReference().catch(e=>{if(active)setApiError('Could not load reference data from Apps Script: '+e.message)});return()=>{active=false}},[page]);
 useEffect(()=>{if(page!=='admin'||user?.role!=='admin'||!user.email)return;let active=true;loadAdmin(user.email).catch((e:any)=>{if(active)setApiError('Could not load Users & Access data: '+(e?.message||''))});return()=>{active=false}},[page,user?.email,user?.role]);
 useEffect(()=>{let active=true;let saved=localStorage.getItem(SESSION_KEY);let cached:AppUser|null=null;try{const raw=localStorage.getItem(USER_CACHE_KEY);if(raw)cached=mapUser(JSON.parse(raw));}catch{localStorage.removeItem(USER_CACHE_KEY);}if(!saved&&cached?.email)saved=cached.email;const validCached=!!saved&&!!cached&&cached!.email===saved&&(cached!.status==='approved'||cached!.role==='admin');if(validCached){localStorage.setItem(SESSION_KEY,cached!.email);setUser(cached);setPage('dashboard');}setLoading(!!saved&&!validCached);if(saved){const refreshSession=async()=>{try{let liveUser:AppUser;if(validCached){liveUser=cached!;}else{const d=await apiGet('login',{email:saved!});if(!d.user)throw new Error('This email is not approved for dashboard access.');liveUser=mapUser(d.user);if(liveUser.status!=='approved'&&liveUser.role!=='admin')throw new Error('This account is not approved.');}if(!active)return;setUser(liveUser);localStorage.setItem(SESSION_KEY,liveUser.email);localStorage.setItem(USER_CACHE_KEY,JSON.stringify(liveUser));setPage('dashboard');setLoading(false);void loadDashboard(liveUser.email).catch((e:any)=>{if(active)setApiError('Dashboard data could not be refreshed. Your saved sign-in remains active. '+(e?.message||''));});}catch(e:any){if(!active)return;if(!validCached){setApiError('Could not verify the saved session with the server. Your saved sign-in was kept; please refresh and retry. '+(e.message||''));}else{setApiError('Dashboard data could not be refreshed. Your saved sign-in remains active. '+(e.message||''));}}finally{if(active)setLoading(false);}};refreshSession();}else{setLoading(false);}return()=>{active=false}},[]);
 
const boards = useMemo(
  () => [...new Set(
    records
      .filter(r => !f.region || r.Region === f.region)
      .map(r => r.LocalBoard)
      .filter(Boolean)
  )].sort(),
  [records, f.region]
);

const recs = useMemo(
  () => [...new Set(
    records
      .filter(r =>
        (!f.region || r.Region === f.region) &&
        (!f.board || r.LocalBoard === f.board)
      )
      .map(r => r.REC)
      .filter(Boolean)
  )].sort(),
  [records, f.region, f.board]
);
 const allowedRecords=records;const cycles=[...new Set([...unique(records,'CycleID').filter(Boolean).map(cycleLabel),'Cycle 1','Cycle 2'])].sort((a,b)=>a.localeCompare(b));useEffect(()=>{if(!f.cycle&&cycles.length){const first=cycles.find(x=>cycleLabel(x)==='Cycle 1')||cycles[0];setF((x:any)=>x.cycle?x:{...x,cycle:first,phase:''})}},[cycles,f.cycle]);const phaseField=cycleLabel(f.cycle||'Cycle 1')==='Cycle 2'?'Cycle2Phase':'Cycle1Phase';const phases=uniqueGeoValues(targetRecs.filter((r:any)=>['active','yes','true','1'].includes(norm(r.Status).toLowerCase())).map((r:any)=>r[phaseField]).filter(Boolean));useEffect(()=>{if(f.phase&&!phases.some(p=>geoNorm(p)===geoNorm(f.phase)))setF((x:any)=>({...x,phase:''}))},[f.phase,phases.join('|')]);const phaseRecKeys=useMemo(()=>new Set(targetRecs.filter((r:any)=>['active','yes','true','1'].includes(norm(r.Status).toLowerCase())&&(!f.region||geoNorm(r.Region)===geoNorm(f.region))&&(!f.board||geoNorm(r.LocalBoard)===geoNorm(f.board))&&(!f.rec||geoNorm(r.REC)===geoNorm(f.rec))&&(!f.phase||geoNorm(r[phaseField])===geoNorm(f.phase))).map((r:any)=>[geoNorm(r.Region),geoNorm(r.LocalBoard),geoNorm(r.REC)].join('|'))),[targetRecs,f.region,f.board,f.rec,f.phase,phaseField]);const phaseScopedRecords=useMemo(()=>f.phase?allowedRecords.filter(r=>phaseRecKeys.has([geoNorm(r.Region),geoNorm(r.LocalBoard),geoNorm(r.REC)].join('|'))):allowedRecords,[allowedRecords,phaseRecKeys,f.phase]);const pageRecords=useMemo(()=>page==='teacher'?phaseScopedRecords.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'):phaseScopedRecords,[phaseScopedRecords,page==='teacher']);const filtered=useMemo(()=>filterRows(pageRecords,f),[pageRecords,f]);const metricRows=useMemo(()=>filterRows(pageRecords,{...f,studentRating:'',teacherRating:''}),[pageRecords,f]);const phase3Rows=useMemo(()=>filterRows(pageRecords,{...f,assessment:'',studentRating:'',teacherRating:''}).filter(r=>cycleLabel(r.CycleID)==='Cycle 2'&&norm(r.ParticipantType).toLowerCase()==='student'),[pageRecords,f]);const regionPerformanceRows=useMemo(()=>filterRows(phaseScopedRecords,f),[phaseScopedRecords,f]);const highlightRows=useMemo(()=>filterRows(phaseScopedRecords,{...f,assessment:''}),[phaseScopedRecords,f]);const crossRows=useMemo(()=>filterRows(phaseScopedRecords,{...f,assessment:'',pt:'',studentRating:'',teacherRating:'',dim:''}),[phaseScopedRecords,f]);
 const surveyRefs=refs;
 useEffect(()=>{if(f.board&&!boards.includes(f.board))setF((x:any)=>({...x,board:'',rec:''}))},[boards,f.board]);useEffect(()=>{if(f.rec&&!recs.includes(f.rec))setF((x:any)=>({...x,rec:''}))},[recs,f.rec]);
 // Region options are sourced from the current dashboard records (APP_Records).
 // Exclude the obsolete coded Lower Chitral value; keep only a plain "Lower Chitral"
 // option if that exact value is present in the current records.
 const regions = [...new Set(
  records
    .map(r => norm(r.Region))
    .filter(Boolean)
    .filter(region => !/^Lower[_ ]Chitral[_ ]?\d+$/i.test(region) && !/^Lower_Chitral_01$/i.test(region))
 )].sort((a,b)=>displayGeo(a).localeCompare(displayGeo(b)));
const pts=unique(allowedRecords,'ParticipantType'),assessments=unique(allowedRecords,'Assessment'),themes=unique(allowedRecords,'ThemeID'),dims=unique(allowedRecords,'DimensionID'),years=unique(allowedRecords,'Year');const teacherNames=unique(allowedRecords.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'&&(!f.region||r.Region===f.region)&&(!f.board||r.LocalBoard===f.board)&&(!f.rec||r.REC===f.rec)),'TeacherName');
 const refresh=async(u= user)=>{if(!u)return;setApiError('');try{if(page==='admin'&&u.role==='admin')await loadAdmin(u.email);else await loadDashboard(u.email);}catch(e:any){setApiError(e.message||'Could not refresh from Apps Script.')}finally{setLoading(false)}};
 // Dashboard data is refreshed only at sign-in or when the user chooses Refresh data.
 // This prevents background refreshes from replacing visible data during active work.
 const nav=(p:string)=>{setMobileNavOpen(false);if(['dashboard','region','board','rec','teacher','theme','dimension','prepost','crossanalysis','admin','resources'].includes(p)&&!user){setPage('login');return}if(p==='teacher')setF((x:any)=>({...x,pt:'',teacher:'',studentRating:''}));else setF((x:any)=>x.teacher?({...x,teacher:''}):x);setPage(p)};
 const login=async(email:string)=>{setLoading(true);setApiError('');try{const d=await apiGet('login',{email:email.trim().toLowerCase()});if(!d.user)throw new Error(d.message||'No account was found for this email.');const u=mapUser(d.user);if(u.status!=='approved'&&u.role!=='admin')throw new Error(u.status==='pending'?'Your account is awaiting administrator approval.':`Your account is ${u.status}.`);setUser(u);localStorage.setItem(SESSION_KEY,u.email);localStorage.setItem(USER_CACHE_KEY,JSON.stringify(u));setF({region:'',board:'',rec:'',pt:'',assessment:'',theme:'',dim:'',year:'',phase:''});setPage('dashboard');setLoading(false);
    // Load dashboard first; admin users/access data is fetched only when Users & Access is opened.
    void loadDashboard(u.email).catch((e:any)=>setApiError('Signed in, but dashboard data could not be loaded. Use Refresh data to retry. '+(e?.message||'')));
  }catch(e:any){setApiError(e.message||'Login failed.');setLoading(false)}};
 const requestLogin=async(name:string,email:string,requestedRole:string)=>{setLoading(true);setApiError('');try{await apiPost('createloginrequest',{name,email,requestedRole,role:'user',status:'Pending'});}catch(e:any){throw new Error(e.message||'Could not submit login request.')}finally{setLoading(false)}};
 const logout=()=>{setUser(null);localStorage.removeItem(SESSION_KEY);localStorage.removeItem(USER_CACHE_KEY);setRecords([]);setUsers([]);setAccess([]);setPage('home');setF({region:'',board:'',rec:'',pt:'',assessment:'',theme:'',dim:'',year:''})};
 if(page==='home')return <PublicHome onLogin={()=>setPage('login')} onStudent={()=>setPage('student-survey')} onTeacher={()=>setPage('teacher-survey')}/>;
 if(page==='login')return <LoginPage onLogin={login} onRequest={requestLogin} loading={loading} error={apiError} onBack={()=>{setApiError('');setPage('home')}}/>;
 const protectedPage=!page.includes('survey')&&page!=='home';
 if(protectedPage&&!user)return <LoginPage onLogin={login} onRequest={requestLogin} loading={loading} error={apiError} onBack={()=>setPage('home')}/>;
 if((page==='student-survey'||page==='teacher-survey')&&!user)return <PublicSurveyShell page={page} setPage={setPage} children={page==='student-survey'?<StudentSurvey refs={surveyRefs} user={null}/>:<TeacherSurvey refs={surveyRefs} user={null}/>}/>;
 return <div className={`app${mobileNavOpen?' mobile-nav-open':''}`}>{mobileNavOpen&&<button className="mobile-nav-overlay" aria-label="Close navigation" onClick={()=>setMobileNavOpen(false)}/>}<aside><div className="brand"><div className="mark">KG</div><div><b>KG II</b><span>Assessment App</span></div></div><div className="signed-in"><span>Signed in as</span><b>{user?.name}</b><small>{user?.role==='admin'?'Administrator':'Approved user'}</small><button onClick={()=>{logout();setMobileNavOpen(false)}}>Log out</button></div><nav><div className="nav-label">Assessment</div>{[['dashboard','Dashboard'],['region','Region-wise Analysis'],['board','Local Board-wise Analysis'],['rec','REC-wise Analysis'],['teacher','Teacher-wise Analysis'],['theme','Theme-wise Analysis'],['dimension','Dimension-wise Analysis'],['prepost','Pre / Post Analysis'],['crossanalysis','Student–Teacher Cross-Analysis']].map(([id,n])=><button className={page===id?'active':''} onClick={()=>nav(id)} key={id}>{n}</button>)}<div className="survey-nav"><button className={page==='student-survey'?'active':''} onClick={()=>{setPage('student-survey');setMobileNavOpen(false)}}>Student Survey</button><button className={page==='teacher-survey'?'active':''} onClick={()=>{setPage('teacher-survey');setMobileNavOpen(false)}}>Teacher Survey</button></div><div className="nav-label">Resources</div><button className={page==='resources'?'active':''} onClick={()=>nav('resources')}>Mentoring & Assessment Strategies</button>{user?.role==='admin'&&<><div className="nav-label">Administration</div><button className={page==='admin'?'active':''} onClick={()=>{setPage('admin');setMobileNavOpen(false)}}>Users & Access</button></>}</nav></aside><main><header><button className="mobile-nav-toggle" aria-label={mobileNavOpen?'Close menu':'Open menu'} aria-expanded={mobileNavOpen} onClick={()=>setMobileNavOpen(v=>!v)}><span aria-hidden="true">☰</span><span>Menu</span></button><div><h1>{title(page)}</h1><p>{subtitle(page)}</p></div>{!page.includes('survey')&&page!=='admin'&&<div className="header-actions"><button className="secondary print-action" onClick={()=>setPrintOpen(true)}>Print / Save PDF</button>{page==='dashboard'&&<button className="secondary" onClick={()=>document.getElementById('dashboard-report-builder')?.scrollIntoView({behavior:'smooth',block:'start'})}>PowerPoint Report Builder</button>}<button className="refresh" onClick={()=>refresh()}>↻ Refresh data</button></div>}</header>{page==='dashboard'&&<div id="dashboard-report-builder"><ReportActions rows={phaseScopedRecords} f={f} isAdmin={user?.role==='admin'}/></div>}{printOpen&&<PrintSelection page={page} onClose={()=>setPrintOpen(false)}/>}{(apiError||loading)&&<div className="auth-message">{loading?'Connecting to Google Sheets…':apiError}</div>}{page==='student-survey'?<StudentSurvey refs={surveyRefs} user={user} records={records} onRefresh={()=>refresh(user)}/>:page==='teacher-survey'?<TeacherSurvey refs={surveyRefs} user={user} records={records} onRefresh={()=>refresh(user)}/>:page==='admin'?<AdminPanel users={users} setUsers={setUsers} access={access} setAccess={setAccess} refs={refs} currentUser={user!} onRefresh={()=>refresh()}/>:page==='resources'?<ResourceLibrary user={user}/>:<><Filters f={f} setF={setF} cycles={cycles} phases={phases} regions={regions} boards={boards} recs={recs} pts={pts} teachers={teacherNames} assessments={assessments} themes={themes} dims={dims} years={years} page={page}/>{page==='dashboard'?<Dashboard rows={filtered} metricRows={metricRows} phase3Rows={phase3Rows} regionRows={regionPerformanceRows} highlightRows={highlightRows} nav={nav} f={f} refs={refs}/>:page==='crossanalysis'?<StudentTeacherCrossAnalysis rows={crossRows} f={f}/>:<Analysis page={page} rows={filtered} all={phaseScopedRecords} metricRows={metricRows} phase3Rows={phase3Rows} f={f} setF={setF} nav={nav} refs={refs} targetRecs={targetRecs}/>}</>}</main></div>
}

function PrintSelection({page,onClose}:{page:string;onClose:()=>void}){
 const [items,setItems]=useState<{id:string;label:string;el:HTMLElement}[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 useEffect(()=>{
  const nodes=Array.from(document.querySelectorAll<HTMLElement>('main section.card:not(.report-actions):not(.print-select-modal)'));
  const found=nodes.map((el,index)=>{const heading=el.querySelector('h2,h3,h4');const label=(heading?.textContent||'').trim();if(!label)return null;const id='kgii-print-'+index;el.dataset.printId=id;return {id,label,el};}).filter((x):x is {id:string;label:string;el:HTMLElement}=>!!x);
  setItems(found);setSelected(found.map(x=>x.id));
  return ()=>{found.forEach(x=>{delete x.el.dataset.printId;});};
 },[page]);
 const all=items.length>0&&selected.length===items.length;
 const print=()=>{if(!selected.length)return;document.querySelectorAll<HTMLElement>('main [data-print-selected]').forEach(el=>delete el.dataset.printSelected);items.filter(x=>selected.includes(x.id)).forEach(x=>{x.el.dataset.printSelected='true';});document.body.classList.add('kgii-print-mode');onClose();window.onafterprint=()=>{document.body.classList.remove('kgii-print-mode');document.querySelectorAll<HTMLElement>('[data-print-selected]').forEach(el=>delete el.dataset.printSelected);window.onafterprint=null;};window.setTimeout(()=>window.print(),180);};
 return <div className="print-select-backdrop" role="dialog" aria-modal="true" aria-label="Select components to print"><section className="card print-select-modal"><div className="section-head"><div><h2>Print / Save PDF — {title(page)}</h2><p>Select the components from this panel to include.</p></div><button type="button" className="secondary" onClick={onClose}>Close</button></div><label className="check print-select-all"><input type="checkbox" checked={all} onChange={()=>setSelected(all?[]:items.map(x=>x.id))}/><strong>All components</strong></label>{items.length?<div className="print-select-options">{items.map(item=><label className="check" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>setSelected(v=>v.includes(item.id)?v.filter(x=>x!==item.id):[...v,item.id])}/><span>{item.label}</span></label>)}</div>:<p>No printable components were found in this panel.</p>}<div className="form-actions"><span>{selected.length} of {items.length} selected</span><button type="button" className="primary" disabled={!selected.length} onClick={print}>Print selected / Save as PDF</button></div></section></div>;
}

function PublicHome({onLogin,onStudent,onTeacher}:{onLogin:()=>void;onStudent:()=>void;onTeacher:()=>void}){return <div className="landing"><div className="landing-card"><div className="mark big">KG</div><h1>KG II Assessment App</h1><p>Assessment data and survey entry platform.</p><div className="landing-actions"><button className="primary" onClick={onStudent}>Student Survey Entry</button><button className="primary" onClick={onTeacher}>Teacher Survey Entry</button><button className="secondary" onClick={onLogin}>Login for Dashboard</button></div><div className="landing-note">Survey entry is available to all users. The assessment dashboard is available only to users approved and assigned access by an administrator.</div></div></div>}
function PublicSurveyShell({page,setPage,children}:{page:string;setPage:(p:string)=>void;children:React.ReactNode}){return <div className="app"><aside><div className="brand"><div className="mark">KG</div><div><b>KG II</b><span>Assessment App</span></div></div><nav><button className={page==='student-survey'?'active':''} onClick={()=>setPage('student-survey')}>Student Survey</button><button className={page==='teacher-survey'?'active':''} onClick={()=>setPage('teacher-survey')}>Teacher Survey</button></nav></aside><main><header><div><h1>{title(page)}</h1><p>{subtitle(page)}</p></div></header>{children}</main></div>}
function LoginPage({onLogin,onRequest,loading,error,onBack}:{onLogin:(email:string)=>void;onRequest:(name:string,email:string,requestedRole:string)=>Promise<void>;loading:boolean;error:string;onBack:()=>void}){const [mode,setMode]=useState<'login'|'request'>('login');const [email,setEmail]=useState('');const [name,setName]=useState('');const [requestedRole,setRequestedRole]=useState('Region');const [msg,setMsg]=useState('');const [requestBusy,setRequestBusy]=useState(false);const submit=()=>{if(!email.trim()){setMsg('Enter your registered email address.');return}setMsg('');onLogin(email)};const request=async()=>{if(!name.trim()||!email.trim()){setMsg('Enter your full name and email address.');return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setMsg('Enter a valid email address.');return}if(!requestedRole){setMsg('Select the role you are requesting.');return}setRequestBusy(true);setMsg('');try{await onRequest(name.trim(),email.trim().toLowerCase(),requestedRole);setMsg('Your login request has been submitted successfully. Access is subject to administrator approval. You will be notified once your request has been reviewed.');setMode('login')}catch(e:any){setMsg(e.message||'Could not submit your request. Please try again.')}finally{setRequestBusy(false)}};return <div className="auth-page"><div className="auth-card"><div className="mark big">KG</div><h1>{mode==='login'?'Login to Dashboard':'Request Login Access'}</h1>{mode==='login'?<><p>Enter the email address associated with your approved account.</p><Field label="Email Address" required><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} autoComplete="email"/></Field><button className="primary full" onClick={submit} disabled={loading}>{loading?'Checking access…':'Login to Dashboard'}</button><button className="secondary full auth-switch" onClick={()=>{setMode('request');setMsg('')}} disabled={loading}>Request Login Access</button></>:<><p>Complete the form below. Your request will be reviewed by an administrator.</p><Field label="Full Name" required><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></Field><Field label="Email Address" required><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" onKeyDown={e=>e.key==='Enter'&&request()}/></Field><Field label="Requested Access Level" required><select value={requestedRole} onChange={e=>setRequestedRole(e.target.value)}><option value="Region">Region</option><option value="Local Board">Local Board</option><option value="REC">REC</option></select></Field><button className="primary full" onClick={request} disabled={requestBusy||loading}>{requestBusy?'Submitting…':'Submit Login Request'}</button><button className="secondary full auth-switch" onClick={()=>{setMode('login');setMsg('')}} disabled={requestBusy}>Back to Login</button></>}{(msg||error)&&<div className="auth-message">{msg||error}</div>}<p className="admin-note">Student and teacher survey entry is available without dashboard access. Dashboard access requires administrator approval and assigned permissions.</p><button className="back-button" onClick={onBack}>← Back to Home</button></div></div>}
function AdminPanel({users,setUsers,access,setAccess,refs,currentUser,onRefresh}:{users:AppUser[];setUsers:React.Dispatch<React.SetStateAction<AppUser[]>>;access:AccessRule[];setAccess:React.Dispatch<React.SetStateAction<AccessRule[]>>;refs:Ref[];currentUser:AppUser;onRefresh:()=>void}){const [selected,setSelected]=useState('');const [region,setRegion]=useState('');const [board,setBoard]=useState('');const [rec,setRec]=useState('');const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const [waGroupSelected,setWaGroupSelected]=useState(true);const [waIncludeFeatures,setWaIncludeFeatures]=useState(true);const [waIncludeReminders,setWaIncludeReminders]=useState(true);const [waIncludeImportant,setWaIncludeImportant]=useState(true);const [waDraft,setWaDraft]=useState('*KG II ASSESSMENT APP | UPDATE*\n\n*New Feature*\n• PowerPoint report preview with selectable slide sections.\n\n*Reminder*\n• Please complete pending KG II assessment data entry and review the Pre/Post assessment analysis.\n\n*Important Notice*\n• Use *Users & Access* to manage approved users and their assigned Region, Local Board and REC access.\n\n*Open the app:* https://kgii-assessment-app.pages.dev');const regions=[...new Map(refs.map(r=>[displayGeo(r.Region).toLowerCase(),r.Region])).values()].sort((a,b)=>displayGeo(a).localeCompare(displayGeo(b)));const boards=[...new Set(refs.filter(r=>!region||r.Region===region).map(r=>r.LocalBoard))].sort();const recs=[...new Set(refs.filter(r=>(!region||r.Region===region)&&(!board||r.LocalBoard===board)).map(r=>r.REC))].sort();const selectedUser=users.find(u=>u.id===selected);const userRules=access.filter(a=>a.userId===selected||(selectedUser&&a.userId===selectedUser.email));const accessUser=(a:AccessRule)=>users.find(u=>u.id===a.userId||u.email===a.userId);const act=async(fn:()=>Promise<any>,success:string)=>{setBusy(true);setMsg('');try{await fn();setMsg(success);onRefresh()}catch(e:any){setMsg(e.message||'Could not save changes.')}finally{setBusy(false)}};const status=async(u:AppUser,statusValue:string)=>act(()=>apiPost('updateuser',{email:u.email,status:statusValue,updatedBy:currentUser.email}),`${u.name} updated.`);const add=()=>{if(!selectedUser){setMsg('Select a user first.');return}if(!region){setMsg('Select a Region before assigning access.');return}act(()=>apiPost('saveaccess',{email:selectedUser.email,name:selectedUser.name,region,localBoard:board,rec,active:true,updatedBy:currentUser.email}),'Access assignment saved.').then(()=>{setRegion('');setBoard('');setRec('')})};const toggle=(a:AccessRule)=>{const u=users.find(x=>x.id===a.userId||x.email===a.userId);if(!u){setMsg('Could not identify the user for this access rule.');return}act(()=>apiPost('saveaccess',{email:u.email,name:u.name,region:a.region,localBoard:a.board,rec:a.rec,active:!a.active,updatedBy:currentUser.email}),`Access ${a.active?'disabled':'enabled'}.`)};return <div className="admin-page"><section className="card"><h2>Users</h2><p>Accounts and approval status are loaded from Google Sheets.</p><table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className={`status ${u.status}`}>{u.status}</span></td><td>{u.role}</td><td>{u.role==='user'&&<div className="user-actions">{u.status!=='approved'&&<button className="small-button" disabled={busy} onClick={()=>status(u,'Approved')}>Approve</button>}{u.status!=='rejected'&&<button className="small-button danger" disabled={busy} onClick={()=>status(u,'Rejected')}>Reject</button>}{u.status==='approved'&&<button className="small-button" onClick={()=>setSelected(u.id)}>Assign access</button>}</div>}</td></tr>)}</tbody></table></section><section className="card"><h2>Users with Assigned Access</h2><p>All users with access assignments are listed here, including their assigned Region, Local Board and REC.</p>{access.length?<table><thead><tr><th>Name</th><th>Email</th><th>Region</th><th>Local Board</th><th>REC</th><th>Status</th><th>Action</th></tr></thead><tbody>{access.map((a,i)=>{const u=accessUser(a);return <tr key={a.id||`${a.userId}-${a.region}-${a.board}-${a.rec}-${i}`}><td>{u?.name||a.userId||"Unknown user"}</td><td>{u?.email||a.userId}</td><td>{displayGeo(a.region)||"All"}</td><td>{a.board||"All"}</td><td>{a.rec||"All"}</td><td><span className={a.active?"positive":"negative"}>{a.active?"Active":"Disabled"}</span></td><td><button className="small-button" disabled={busy} onClick={()=>toggle(a)}>{a.active?"Disable":"Enable"}</button></td></tr>})}</tbody></table>:<p className="admin-note">No access assignments have been recorded yet.</p>}</section><section className="card"><h2>Access Assignment</h2><div className="survey-grid"><Field label="User" required><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select user</option>{users.filter(u=>u.role==='user'&&u.status==='approved').map(u=><option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}</select></Field><div className="access-help"><b>{selectedUser?.name||'Select a user'}</b><span>Assign Region, Local Board and/or REC. Blank lower levels mean all data under the selected level.</span></div></div><div className="survey-grid"><Field label="Region" required><select value={region} onChange={e=>{setRegion(e.target.value);setBoard('');setRec('')}}><option value="">Select region</option>{regions.map(x=><option key={x} value={x}>{displayGeo(x)}</option>)}</select></Field><Field label="Local Board"><select value={board} disabled={!region} onChange={e=>{setBoard(e.target.value);setRec('')}}><option value="">All boards</option>{boards.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="REC"><select value={rec} disabled={!board} onChange={e=>setRec(e.target.value)}><option value="">All RECs</option>{recs.map(x=><option key={x}>{x}</option>)}</select></Field><div className="form-actions"><button className="primary" disabled={busy} onClick={add}>Add Access</button></div></div>{selected&&<div className="existing-access"><h3>Existing access assignments{selectedUser?` — ${selectedUser.name}`:''}</h3>{userRules.length?<table><thead><tr><th>User</th><th>Region</th><th>Local Board</th><th>REC</th><th>Status</th><th>Action</th></tr></thead><tbody>{userRules.map(a=><tr key={a.id}><td>{selectedUser?.name||'Unknown user'}</td><td>{displayGeo(a.region)||'All'}</td><td>{a.board||'All'}</td><td>{a.rec||'All'}</td><td><span className={a.active?'positive':'negative'}>{a.active?'Active':'Disabled'}</span></td><td><button className="small-button" disabled={busy} onClick={()=>toggle(a)}>{a.active?'Disable':'Enable'}</button></td></tr>)}</tbody></table>:<p className="admin-note">No access assignments are recorded for this user yet.</p>}</div>}{msg&&<div className="auth-message">{msg}</div>}</section><section className="card"><h2>WhatsApp Reports & Admin Updates</h2><p>Prepare your message, then use the button below to copy it and open the KG II Assessment App WhatsApp group.</p><Field label="Message draft"><textarea rows={8} value={waDraft} onChange={e=>setWaDraft(e.target.value)} /></Field><div className="form-actions"><button type="button" className="secondary" onClick={()=>{const parts=[waIncludeFeatures?'*NEW FEATURE*\n• PowerPoint report preview with selectable slide sections.':'',waIncludeReminders?'*REMINDER*\n• Please complete pending KG II assessment data entry and review the Pre/Post assessment analysis.':'',waIncludeImportant?'*IMPORTANT NOTICE*\n• Use *Users & Access* to manage approved users and their assigned Region, Local Board and REC access.':''].filter(Boolean);setWaDraft('*KG II ASSESSMENT APP | UPDATE*\n\n'+parts.join('\n\n')+'\n\n*Open the app:* https://kgii-assessment-app.pages.dev');}}>Generate professional draft</button><button type="button" className="primary" disabled={!waDraft.trim()} onClick={async()=>{try{await navigator.clipboard.writeText(waDraft.trim());window.open('https://chat.whatsapp.com/D7NUegj52bq0PqWrs2EmJj','_blank','noopener,noreferrer');setMsg('Message copied. The WhatsApp group has been opened; paste the message into the group and press Send.');}catch{window.open('https://chat.whatsapp.com/D7NUegj52bq0PqWrs2EmJj','_blank','noopener,noreferrer');setMsg('WhatsApp group opened. Copy the message draft and paste it into the group, then press Send.');}}}>Copy message & open WhatsApp group</button></div>{msg&&<p className="form-message" role="status">{msg}</p>}</section><section className="card"><h2>Administrator note</h2><p className="admin-note">User approvals, access assignments and dashboard records are handled through the Google Sheets + Apps Script backend. The frontend does not store account passwords.</p></section></div>}

function ResourceLibrary({user}:{user:AppUser|null}){
  const [resources,setResources]=useState<any[]>(()=>{try{const cached=JSON.parse(localStorage.getItem('kgii_assessment_cached_resources')||'[]');return Array.isArray(cached)?cached:[]}catch{return []}});
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [category,setCategory]=useState('All');
  const [titleValue,setTitleValue]=useState('');
  const [description,setDescription]=useState('');
  const [uploadCategory,setUploadCategory]=useState('Mentoring Strategies');
  const resourceCategories=[...new Set(resources.map((r:any)=>String(r.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const [editing,setEditing]=useState<any|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const load=async()=>{setBusy(true);setMsg('');try{const d=await apiGet('resources');const fresh=Array.isArray(d.resources)?d.resources:[];setResources(fresh);try{localStorage.setItem('kgii_assessment_cached_resources',JSON.stringify(fresh));}catch(e){console.warn('Could not cache resources',e)}}catch(e:any){setMsg(e.message||'Could not load resources.');}finally{setBusy(false)}};
  // Show the last saved resource list immediately, then update it from the server.
  useEffect(()=>{void load()},[]);
  const upload=async(e:any)=>{
    e.preventDefault();
    if(!user||user.role!=='admin'){setMsg('Administrator access is required to upload resources.');return;}
    if(!titleValue.trim()||!uploadCategory||!file){setMsg('Complete the title, category and file fields.');return;}
    if(file.size>10*1024*1024){setMsg('Please select a file smaller than 10 MB.');return;}
    setBusy(true);setMsg('');
    try{
      const fileBase64=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||''));
        reader.onerror=()=>reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });
      const result=await apiPost('uploadresource',{
        adminEmail:user.email,
        title:titleValue.trim(),
        description:description.trim(),
        category:uploadCategory,
        fileName:file.name,
        mimeType:file.type||'application/octet-stream',
        fileBase64
      });
      setMsg(result.message||'Resource uploaded successfully.');
      setTitleValue('');setDescription('');setFile(null);
      const input=document.getElementById('resource-upload-file') as HTMLInputElement|null;
      if(input)input.value='';
      await load();
    }catch(e:any){setMsg(e.message||'Could not upload the resource.');}
    finally{setBusy(false);}
  };
  const moveResource=(resourceID:string,direction:-1|1)=>{
    const ordered=[...resources];
    const index=ordered.findIndex(r=>String(r.resourceID)===resourceID);
    const next=index+direction;
    if(index<0||next<0||next>=ordered.length)return;
    [ordered[index],ordered[next]]=[ordered[next],ordered[index]];
    setResources(ordered);
    setMsg('Display order changed for this session. To keep the order after refresh, the Apps Script API must also save resource positions.');
  };
  const visible=category==='All'?resources:resources.filter(r=>r.category===category);
  return <div className="admin-page">
    {user?.role==='admin'&&<section className="card">
      <h2>Upload a Resource</h2>
      <p className="admin-note">Add mentoring or assessment resources for approved app users to view and download. Maximum file size: 10 MB.</p>
      <form onSubmit={upload}>
        <div className="survey-grid">
          <Field label="Resource title" required><input value={titleValue} onChange={e=>setTitleValue(e.target.value)} required maxLength={180}/></Field>
          <Field label="Category" required><input list="resource-category-options" value={uploadCategory} onChange={e=>setUploadCategory(e.target.value)} required maxLength={100} placeholder="Select or type a category"/><datalist id="resource-category-options">{resourceCategories.map((x:string)=><option key={x} value={x}/>)}</datalist></Field>
          <Field label="Description"><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={1000}/></Field>
          <Field label="Choose file (up to 10 MB)" required><input id="resource-upload-file" type="file" onChange={e=>setFile(e.target.files?.[0]||null)} required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png"/></Field>
        </div>
        <div className="form-actions"><button className="primary" type="submit" disabled={busy}>{busy?'Please wait…':'Upload resource'}</button></div>
      </form>
      {msg&&<div className="auth-message" role="status">{msg}</div>}
    </section>}
    {editing&&user?.role==='admin'&&<section className="card">
      <h2>Edit resource</h2>
      <form onSubmit={async(e:any)=>{e.preventDefault();if(!editing.title.trim()||!editing.category){setMsg('Title and category are required.');return;}setBusy(true);setMsg('');try{const out=await apiPost('updateresource',{adminEmail:user.email,resourceID:editing.resourceID,title:editing.title.trim(),description:(editing.description||'').trim(),category:editing.category});setMsg(out.message||'Resource updated.');setEditing(null);await load()}catch(err:any){setMsg(err.message||'Could not update resource.')}finally{setBusy(false)}}}>
        <div className="survey-grid">
          <Field label="Resource title" required><input value={editing.title||''} onChange={e=>setEditing({...editing,title:e.target.value})} required maxLength={180}/></Field>
          <Field label="Category" required><input list="resource-category-options" value={editing.category||''} onChange={e=>setEditing({...editing,category:e.target.value})} required maxLength={100} placeholder="Select or type a category"/><datalist id="resource-category-options">{resourceCategories.map((x:string)=><option key={x} value={x}/>)}</datalist></Field>
          <Field label="Description"><textarea value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})} rows={3} maxLength={1000}/></Field>
        </div>
        <div className="form-actions"><button className="primary" type="submit" disabled={busy}>{busy?'Saving…':'Save changes'}</button><button className="secondary" type="button" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button></div>
      </form>
      {msg&&<div className="auth-message" role="status">{msg}</div>}
    </section>}
    <section className="card">
      <div className="section-head"><div><h2>Mentoring and Assessment Strategies</h2><p>Browse and open resources shared by the KG II Assessment team.</p></div><button className="secondary" onClick={load} disabled={busy}>{busy?'Loading…':'Refresh resources'}</button></div>
      <div className="survey-grid"><Field label="Category"><select value={category} onChange={e=>setCategory(e.target.value)}><option value="All">All categories</option>{resourceCategories.map((x:string)=><option key={x} value={x}>{x}</option>)}</select></Field></div>
      {msg&&user?.role!=='admin'&&<div className="auth-message">{msg}</div>}
      {busy&&!resources.length?<p>Loading resources…</p>:visible.length===0?<p>No active resources are available in this category yet.</p>:<div className="resource-list">{visible.map((r:any)=><article className="card" key={r.resourceID||r.fileURL}><h3>{r.title||r.fileName||'Untitled resource'}</h3>{r.category&&<p><b>Category:</b> {r.category}</p>}{r.description&&<p>{r.description}</p>}<p className="admin-note">{r.fileName||''}</p>{r.fileURL&&<a href={r.fileURL} target="_blank" rel="noreferrer">Open / Download resource ↗</a>}{user?.role==='admin'&&<div className="form-actions"><button type="button" className="secondary resource-order-button" title="Move resource up" aria-label="Move resource up" disabled={busy||resources.findIndex(x=>String(x.resourceID)===String(r.resourceID))===0} onClick={()=>moveResource(String(r.resourceID),-1)}>↑</button><button type="button" className="secondary resource-order-button" title="Move resource down" aria-label="Move resource down" disabled={busy||resources.findIndex(x=>String(x.resourceID)===String(r.resourceID))===resources.length-1} onClick={()=>moveResource(String(r.resourceID),1)}>↓</button><button type="button" className="secondary" onClick={()=>{setEditing({...r});setMsg('')}}>Edit resource</button><button type="button" className="secondary" disabled={busy} onClick={async()=>{if(!window.confirm('Delete “'+(r.title||r.fileName)+'” from the resource library?'))return;setBusy(true);setMsg('');try{const out=await apiPost('deleteresource',{adminEmail:user.email,resourceID:r.resourceID});setMsg(out.message||'Resource deleted.');await load()}catch(e:any){setMsg(e.message||'Could not delete resource.')}finally{setBusy(false)}}}>Delete</button></div>}</article>)}</div>}
    </section>
  </div>
}

function title(p:string){return ({dashboard:'KG II Assessment Dashboard',region:'Region-wise Analysis',board:'Local Board-wise Analysis',rec:'REC-wise Analysis',teacher:'Teacher-wise Analysis',theme:'Theme-wise Analysis',dimension:'Dimension-wise Analysis',prepost:'Pre / Post Analysis',crossanalysis:'Student–Teacher Cross-Analysis',admin:'Users & Access',resources:'Mentoring & Assessment Strategies','student-survey':'Student Survey Entry','teacher-survey':'Teacher Survey Entry'} as any)[p]}
function subtitle(p:string){if(p==='student-survey')return 'Enter student survey responses using the master Region → Local Board → REC hierarchy.';if(p==='teacher-survey')return 'Enter teacher survey responses using the master Region → Local Board → REC hierarchy.';if(p==='resources')return 'View and download mentoring and assessment resources.';return p==='dashboard'?'Assessment Performance Overview':p==='teacher'?'Review individual teacher performance across themes, dimensions and pre/post assessments.':p==='crossanalysis'?'Explore teacher development alongside student understanding, articulation and application across REC, Local Board, Region and National levels.':'Drill down into performance using the selected filters.'}
function Filters({f,setF,cycles,phases,regions,boards,recs,pts,assessments,themes,dims,years,teachers,page}:any){const teacherPage=page==='teacher';const geoLevel=page==='region'?1:page==='board'?2:page==='rec'?3:3;const S=({k,lab,vals}:{k:string;lab:string;vals:string[]})=><label><span>{lab}</span><select value={f[k]||''} onChange={e=>setF((x:any)=>({...x,[k]:e.target.value,...(k==='region'?{board:'',rec:'',teacher:''}:k==='board'?{rec:'',teacher:''}:k==='rec'?{teacher:''}:{})}))}>{k==='cycle'?<option value="All">All</option>:<option value="">All</option>}{vals.map(v=><option key={v} value={v}>{k==='cycle'?cycleLabel(v):k==='theme'?labelTheme(v):k==='dim'?labelDim(v):k==='region'?displayGeo(v):k==='studentRating'?studentRatingLabel(v):k==='teacherRating'?teacherRatingLabel(v):v}</option>)}</select></label>;return <section className="filters"><S k="region" lab="Region" vals={regions}/>{geoLevel>=2&&<S k="board" lab="Local Board" vals={boards}/>}{geoLevel>=3&&<S k="rec" lab="REC" vals={recs}/>}{page==='crossanalysis'?null:page==='teacher'?<S k="teacher" lab="Teacher Name" vals={teachers}/>:<S k="pt" lab="Participant" vals={pts}/>}{page!=='crossanalysis'&&<S k="assessment" lab="Assessment" vals={assessments}/>}{!teacherPage&&page!=='crossanalysis'&&<S k="studentRating" lab="Student Rating" vals={['3','2','1']}/>}{page!=='crossanalysis'&&<S k="teacherRating" lab="Teacher Rating" vals={['4','3','2','1']}/>}<S k="theme" lab="Theme" vals={themes}/>{!teacherPage&&page!=='crossanalysis'&&<S k="dim" lab="Dimension" vals={dims}/>}<S k="year" lab="Year" vals={years.map(String)}/><S k="cycle" lab="Cycle" vals={cycles}/><S k="phase" lab="Phase" vals={phases}/></section>}
function studentRatingLabel(score:string){return ({'3':'Very well (3)','2':'To some extent (2)','1':'Face difficulty (1)'} as Record<string,string>)[score]||score}
function teacherRatingLabel(score:string){return ({'4':'Exemplary (4)','3':'Proficient (3)','2':'Developing (2)','1':'Emerging (1)'} as Record<string,string>)[score]||score}

function statusFor(p:number){return p>=80?'Excellent':p>=65?'Good':p>=50?'Satisfactory':'Need Attention'}

function Kpis({rows,metricRows=rows,phase3Rows=metricRows,hideTeacherBreakdown=false,hideAtGlance=false,f={},refs=[]}:{rows:Rec[];metricRows?:Rec[];phase3Rows?:Rec[];hideTeacherBreakdown?:boolean;hideAtGlance?:boolean;f?:any;refs?:Ref[]}) {
  const ratingSelected=!!(f.studentRating||f.teacherRating);
  const scoreRows=ratingSelected?metricRows.filter(r=>(!f.studentRating&&!f.teacherRating)||(!!f.studentRating&&norm(r.ParticipantType).toLowerCase()==='student')||(!!f.teacherRating&&norm(r.ParticipantType).toLowerCase()==='teacher')):metricRows;
  const overall=aggregate(scoreRows);
  const preTotals=aggregate(scoreRows.filter(r=>assessmentIs(r.Assessment,'Pre')));
  const postTotals=aggregate(scoreRows.filter(r=>assessmentIs(r.Assessment,'Post')));
  const studentRows=scoreRows.filter(r=>r.ParticipantType==='Student');
  const teacherRows=scoreRows.filter(r=>r.ParticipantType==='Teacher');
  const preRows=scoreRows.filter(r=>assessmentIs(r.Assessment,'Pre'));
  const postRows=scoreRows.filter(r=>assessmentIs(r.Assessment,'Post'));
  const studentCountRows=f.studentRating?rows:metricRows;
  const teacherCountRows=f.teacherRating?rows:metricRows;
  const recCountRows=ratingSelected?rows:metricRows;
  const countPreRows=studentCountRows.filter(r=>assessmentIs(r.Assessment,'Pre'));
  const countPostRows=studentCountRows.filter(r=>assessmentIs(r.Assessment,'Post'));
  const teacherCount=teacherCountRows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher');
  const recPreRows=recCountRows.filter(r=>assessmentIs(r.Assessment,'Pre'));
  const recPostRows=recCountRows.filter(r=>assessmentIs(r.Assessment,'Post'));
  const cycle2=cycleLabel(f.cycle)==='Cycle 2';
  const studentPct=cycle2?aggregate(phase3Rows).p:aggregate(studentRows).p;
  const teacherPct=aggregate(teacherRows).p;
  const prePct=aggregate(preRows).p;
  const postPct=aggregate(postRows).p;
  const teacherOnly=hideTeacherBreakdown;
  const includeStudent=(!ratingSelected||!!f.studentRating)&&(!f.pt||norm(f.pt).toLowerCase()==='student');
  const includeTeacher=(!ratingSelected||!!f.teacherRating)&&(!f.pt||norm(f.pt).toLowerCase()==='teacher');
  const phase3StudentRows=includeStudent?phase3Rows.filter(r=>norm(r.ParticipantType).toLowerCase()==='student'):[];
  const phase3Score=cycle2?aggregate(phase3StudentRows).p*87/100:0;
  const teacherPreRows=scoreRows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'&&assessmentIs(r.Assessment,'Pre'));
  const teacherPostRows=scoreRows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'&&assessmentIs(r.Assessment,'Post'));
  const selectedRatingMax=(f.studentRating?87:0)+(f.teacherRating?16:0);
  const preSelected=ratingSelected&&(!f.assessment||assessmentIs(f.assessment,'Pre'));
  const postSelected=ratingSelected&&(!f.assessment||assessmentIs(f.assessment,'Post'));
  const studentStageScore=(stageRows:Rec[])=>aggregate(stageRows.filter(r=>r.ParticipantType==='Student')).p*87/100;
  const teacherStageScore=(stageRows:Rec[])=>cycle2
    ? aggregate(stageRows.filter(r=>r.ParticipantType==='Teacher')).p*48/100
    : scoreOutOf(stageRows,'Teacher',4);
  const preScore=cycle2
    ? (includeTeacher?teacherStageScore(teacherPreRows):0)
    : ratingSelected
      ? (f.studentRating?studentStageScore(preRows):0)+(f.teacherRating?teacherStageScore(preRows):0)
      : teacherOnly?scoreModel(preRows).total:prePct;
  const postScore=cycle2
    ? (includeTeacher?teacherStageScore(teacherPostRows):0)
    : ratingSelected
      ? (f.studentRating?studentStageScore(postRows):0)+(f.teacherRating?teacherStageScore(postRows):0)
      : teacherOnly?scoreModel(postRows).total:postPct;
  const preMax=cycle2
    ? (includeTeacher&&(!f.assessment||assessmentIs(f.assessment,'Pre'))?48:0)
    : ratingSelected?(preSelected?selectedRatingMax:0):16;
  const postMax=cycle2
    ? (includeTeacher&&(!f.assessment||assessmentIs(f.assessment,'Post'))?48:0)
    : ratingSelected?(postSelected?selectedRatingMax:0):16;
  const phase3Max=cycle2&&includeStudent?87:0;
  const cycle2Score=phase3Score+preScore+postScore;
  const cycle2Max=phase3Max+preMax+postMax;
  const cycleAll=!f.cycle||f.cycle==='All';
  const cycle1Rows=scoreRows.filter(r=>cycleLabel(r.CycleID)==='Cycle 1');
  const cycle2Rows=scoreRows.filter(r=>cycleLabel(r.CycleID)==='Cycle 2');
  const cycle1Score=aggregate(cycle1Rows).p*206/100;
  const cycle2TeacherPre=aggregate(cycle2Rows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'&&assessmentIs(r.Assessment,'Pre'))).p*48/100;
  const cycle2TeacherPost=aggregate(cycle2Rows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'&&assessmentIs(r.Assessment,'Post'))).p*48/100;
  const cycle2StudentScore=includeStudent?aggregate(phase3Rows.filter(r=>norm(r.ParticipantType).toLowerCase()==='student'&&(!f.studentRating||ratingFilterMatch(r,f)))).p*87/100:0;
  const allCycleScore=cycle1Score+cycle2StudentScore+(includeTeacher?cycle2TeacherPre+cycle2TeacherPost:0);
  const allCycleMax=ratingSelected
    ? 2*selectedRatingMax+(f.studentRating?87:0)+(f.teacherRating?96:0)
    : 389;
  const score=cycleAll?allCycleScore:cycle2?cycle2Score:ratingSelected?preScore+postScore:overall.p*206/100;
  const totalMax=cycleAll?allCycleMax:cycle2?cycle2Max:ratingSelected?preMax+postMax:206;
  const overallPerformance=cycleAll||cycle2?pct(score,totalMax):overall.p;

  // Keep the existing dashboard participant-count calculations and show them on
  // the dashboard and all non-teacher analysis views.
  const preStudents = (() => {
    const groups = new Map<string, Set<string>>();
    countPreRows.filter(r => r.ParticipantType.toLowerCase()==='student' && r.Region && r.LocalBoard && r.REC)
      .forEach(r => {
        const rec=[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');
        const identity=norm(r.SourceRecordID)||norm(r.ChildName);
        if(!identity) return;
        const set=groups.get(rec)||new Set<string>();
        set.add(identity.toLocaleLowerCase());
        groups.set(rec,set);
      });
    let total=0; groups.forEach(children=>total+=children.size); return total;
  })();
  const postStudents = (() => {
    const childKey=(r:Rec)=>(norm(r.SourceRecordID)||norm(r.ChildName)).toLocaleLowerCase();
    const byRecTheme=new Map<string,Set<string>>();
    countPostRows.filter(r=>r.ParticipantType.toLowerCase()==='student'&&r.Region&&r.LocalBoard&&r.REC)
      .forEach(r=>{
        const child=childKey(r); if(!child)return;
        const key=[norm(r.Region),norm(r.LocalBoard),norm(r.REC),norm(r.ThemeID)].join('||');
        const set=byRecTheme.get(key)||new Set<string>(); set.add(child); byRecTheme.set(key,set);
      });
    const byRec=new Map<string,number>();
    byRecTheme.forEach((children,key)=>{
      const rec=key.split('||').slice(0,3).join('||');
      byRec.set(rec,Math.max(byRec.get(rec)||0,children.size));
    });
    let total=0; byRec.forEach(n=>total+=n); return total;
  })();
  const teachers = (() => {
    const groups=new Map<string,Set<string>>();
    teacherCount.filter(r=>r.Region&&r.LocalBoard&&r.REC).forEach(r=>{
      const rec=[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');
      const name=norm(r.TeacherName); if(!name)return;
      const names=groups.get(rec)||new Set<string>(); names.add(name.toLocaleLowerCase()); groups.set(rec,names);
    });
    let total=0; groups.forEach(names=>total+=names.size); return total;
  })();
  const recKey=(r:Rec)=>[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');
  const preRecs=new Set(recPreRows.filter(r=>r.Region&&r.LocalBoard&&r.REC).map(recKey)).size;
  const postRecs=new Set(recPostRows.filter(r=>r.Region&&r.LocalBoard&&r.REC).map(recKey)).size;

  const cards=[
    ['Overall Score',ratingSelected||cycle2?(score.toFixed(1)+' / '+totalMax.toFixed(1)):teacherOnly?((preScore+postScore).toFixed(1)+' / 32'):(score.toFixed(1)+' / '+totalMax.toFixed(1))],
    ['Performance',fmt(overallPerformance)],
    ['Status',statusFor(overallPerformance)],
    ['No. of Students',preStudents+' / '+postStudents],
    ['No. of Teachers (Unique)',String(teachers)],
    ['No. of RECs',preRecs+' / '+postRecs],
    ['Students Overall',fmt(studentPct)],
    ['Teachers Overall',fmt(teacherPct)],
    ['Theme Overall',fmt(overallPerformance)],
    ['Dimension Overall',fmt(overallPerformance)],
    ['Phase 3 Overall',cycle2&&phase3Max?phase3Score.toFixed(1)+' / '+phase3Max.toFixed(1):'—'],
    ['Pre Overall',cycle2?(preMax?preScore.toFixed(1)+' / '+preMax.toFixed(1):'—'):ratingSelected?(preMax?preScore.toFixed(1)+' / '+preMax.toFixed(1):'—'):teacherOnly?(preScore.toFixed(1)+' / 16'):fmt(prePct)],
    ['Post Overall',cycle2?(postMax?postScore.toFixed(1)+' / '+postMax.toFixed(1):'—'):ratingSelected?(postMax?postScore.toFixed(1)+' / '+postMax.toFixed(1):'—'):teacherOnly?(postScore.toFixed(1)+' / 16'):fmt(postPct)]
  ];
  const hiddenByRating=f.studentRating&&!f.teacherRating
    ? ['No. of Teachers (Unique)','Teachers Overall',...(cycle2?['Pre Overall','Post Overall']:[])]
    : f.teacherRating&&!f.studentRating
      ? ['No. of Students','Students Overall',...(cycle2?['Phase 3 Overall']:[])]
      : [];
  const visibleCards=teacherOnly
    ? cards.filter(([label])=>!['No. of Students','No. of Teachers (Unique)','Students Overall','Teachers Overall','Theme Overall','Dimension Overall'].includes(label))
    : cards.filter(([label])=>String(label)==='Phase 3 Overall'?!cycle2:!hiddenByRating.includes(String(label)));
  const expectedRecKeys = new Set(refs.filter(r=>(!f.region||r.Region===f.region)&&(!f.board||r.LocalBoard===f.board)&&(!f.rec||r.REC===f.rec)).map(r=>[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||')));
  const themeCoverage = ['T1','T2','T3','T4'].map(theme => {
    const themeRows = metricRows.filter(r => r.ThemeID === theme);
    const countStage = (stage:'Pre'|'Post') => {
      const stageRows = themeRows.filter(r => assessmentIs(r.Assessment,stage));
      const recKey = (r:Rec) => [norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');
      const studentCounts = new Map<string,Set<string>>();
      const teacherCounts = new Map<string,Set<string>>();
      stageRows.filter(r => norm(r.ParticipantType).toLowerCase()==='student' && r.Region && r.LocalBoard && r.REC).forEach(r => {
        const key=recKey(r), id=(norm(r.SourceRecordID)||norm(r.ChildName)).toLocaleLowerCase();
        if(!id)return; const set=studentCounts.get(key)||new Set<string>();set.add(id);studentCounts.set(key,set);
      });
      stageRows.filter(r => norm(r.ParticipantType).toLowerCase()==='teacher' && r.Region && r.LocalBoard && r.REC).forEach(r => {
        const key=recKey(r), id=norm(r.TeacherName).toLocaleLowerCase();
        if(!id)return; const set=teacherCounts.get(key)||new Set<string>();set.add(id);teacherCounts.set(key,set);
      });
      const sum=(m:Map<string,Set<string>>)=>[...m.values()].reduce((n,set)=>n+set.size,0);
      const studentRecs=new Set(stageRows.filter(r=>norm(r.ParticipantType).toLowerCase()==='student'&&r.Region&&r.LocalBoard&&r.REC).map(recKey));
      const teacherRecs=new Set(stageRows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'&&r.Region&&r.LocalBoard&&r.REC).map(recKey));
      const coveredRecs=new Set([...studentRecs,...teacherRecs]);
      const totalRecs=Math.max(studentRecs.size,teacherRecs.size);
      const expectedRecs=expectedRecKeys.size || new Set(stageRows.filter(r=>r.Region&&r.LocalBoard&&r.REC).map(recKey)).size;
      return {students:sum(studentCounts),teachers:sum(teacherCounts),studentRecs:studentRecs.size,teacherRecs:teacherRecs.size,totalRecs,coveredRecs:coveredRecs.size,missingRecs:Math.max(0,expectedRecs-coveredRecs.size)};
    };
    return {theme,name:labelTheme(theme),pre:countStage('Pre'),post:countStage('Post')};
  });
  return <><div className="kpis">{visibleCards.map(([label,value])=><div className="kpi" key={label}><span>{label==='No. of RECs'?'No. of RECs (Pre / Post)':label}</span><strong className={label==='Status'?'status-kpi '+value.toLowerCase().replace(/ /g,'-'):''}>{value}</strong>{label==='Status'&&<small className="status-criteria">Excellent ≥ 80% · Good ≥ 65% · Satisfactory ≥ 50% · Need Attention &lt; 50%</small>}</div>)}</div>{!teacherOnly&&<section className="card theme-coverage"><h2>Theme-wise Assessment Coverage</h2><p className="admin-note">Distinct students and teachers counted within each REC for each theme. Student REC counts show RECs with student assessment records; Teacher REC counts show RECs with teacher assessment records.</p><div className="table-wrap"><table><thead><tr><th rowSpan={2}>Theme</th><th colSpan={2}>Students</th><th colSpan={2}>Student RECs</th><th colSpan={2}>Teachers</th><th colSpan={2}>Teacher RECs</th></tr><tr><th>Pre</th><th>Post</th><th>Pre</th><th>Post</th><th>Pre</th><th>Post</th><th>Pre</th><th>Post</th></tr></thead><tbody>{themeCoverage.map(t=><tr key={t.theme}><td><b>{t.theme}</b><br/><small>{t.name}</small></td><td>{t.pre.students}</td><td>{t.post.students}</td><td>{t.pre.studentRecs}</td><td>{t.post.studentRecs}</td><td>{t.pre.teachers}</td><td>{t.post.teachers}</td><td>{t.pre.teacherRecs}</td><td>{t.post.teacherRecs}</td></tr>)}</tbody></table></div></section>}</>;
}

function group(rows:Rec[],key:keyof Rec){return unique(rows,key).map(k=>{const a=aggregate(rows.filter(r=>norm(r[key])===k));return {key:k,p:a.p,score:a.score,max:a.max}})}

function ThemeWiseRecCoverage({records,refs,targetRecs,f,level='region'}:{records:Rec[];refs:Ref[];targetRecs:any[];f:any;level?:'region'|'board'|'rec'}) {
  const geoMatches=(r:any)=>(!f.region||geoNorm(r.Region)===geoNorm(f.region))&&(!f.board||geoNorm(r.LocalBoard)===geoNorm(f.board))&&(!f.rec||geoNorm(r.REC)===geoNorm(f.rec));
  const scopedRecords=records.filter(r=>geoMatches(r)&&(!f.cycle||f.cycle==='All'||cycleLabel(r.CycleID)===cycleLabel(f.cycle))&&(!f.year||String(r.Year)===String(f.year)));
  const scopedRefs=refs.filter(geoMatches);
  const activeTarget=(r:any)=>['active','yes','true','1'].includes(norm(r.Status??r.status).toLowerCase());
  const targetMatches=(r:any)=>(!f.region||geoNorm(r.Region)===geoNorm(f.region))&&(!f.board||geoNorm(r.LocalBoard)===geoNorm(f.board))&&(!f.rec||geoNorm(r.REC)===geoNorm(f.rec))&&activeTarget(r);
  const scopedTargets=targetRecs.filter(targetMatches).filter((r:any)=>{
    const phase=cycleLabel(f.cycle||'Cycle 1')==='Cycle 2'?norm(r.Cycle2Phase):norm(r.Cycle1Phase);
    return !phase||!f.phase||phase===norm(f.phase);
  });
  const themes=['T1','T2','T3','T4'];
  const groupValue=(r:any)=>level==='region'?r.Region:level==='board'?r.LocalBoard:r.REC;
  const groupLabel=level==='region'?'Region':level==='board'?'Local Board':'REC';
  const title=level==='region'?'Region-wise Theme Assessment':level==='board'?'Local Board-wise Theme Assessment':'REC-wise Theme Assessment';
  const groupKey=(value:any)=>geoNorm(displayGeo(norm(value)));
  const groupMap=new Map<string,string>();
  const sourceGroups=level==='region'?[...scopedRefs,...scopedRecords]:scopedTargets;
  sourceGroups.forEach((r:any)=>{const raw=norm(groupValue(r));if(!raw)return;const key=groupKey(raw);if(key&&!groupMap.has(key))groupMap.set(key,displayGeo(raw));});
  const groups=[...groupMap.values()].sort((a,b)=>a.localeCompare(b));

  // Each assessment can contain several indicator rows for the same participant.
  // Count a student/teacher once per REC, theme and assessment stage.
  // Aggregate once in a single pass. The previous implementation decoded and
  // scanned every participant bucket again for every table cell, which became
  // increasingly expensive as the number of RECs grew.
  const participants=new Map<string,Set<string>>();
  for(const r of scopedRecords){
    const group=groupKey(groupValue(r));
    const theme=norm(r.ThemeID);
    if(!group||!themes.includes(theme)||!r.REC)continue;
    const stage=assessmentIs(r.Assessment,'Pre')?'Pre':assessmentIs(r.Assessment,'Post')?'Post':null;
    const participant=norm(r.ParticipantType);
    if(!stage||(participant!=='Student'&&participant!=='Teacher'))continue;
    const personName=participant==='Student'?norm(r.ChildName):norm(r.TeacherName);
    const participantId=participant==='Student'?norm((r as any).StudentID):norm(r.TeacherName);
    const identity=geoNorm(participantId || personName || r.SourceRecordID || r.RecordID || '');
    if(!identity)continue;
    const key=[group,theme,stage,participant].join('||');
    if(!participants.has(key))participants.set(key,new Set<string>());
    participants.get(key)!.add(identity);
  }
  const participantCount=(group:string,theme:string,stage:'Pre'|'Post',participant:'Student'|'Teacher')=>
    participants.get([groupKey(group),theme,stage,participant].join('||'))?.size||0;
  return <section className="card theme-rec-coverage">
    <div className="section-head"><div><h2>{title}</h2><p>Distinct students and teachers assessed in each theme, counted once per person for each REC and assessment stage.</p></div></div>
    <div className="table-wrap"><table><thead>
      <tr><th rowSpan={3}>{groupLabel}</th>{themes.map(theme=><th key={theme} colSpan={4}>{labelTheme(theme)}</th>)}</tr>
      <tr>{themes.flatMap(theme=>[<th key={theme+'-students'} colSpan={2}>Students</th>,<th key={theme+'-teachers'} colSpan={2}>Teachers</th>])}</tr>
      <tr>{themes.flatMap(theme=>[<th key={theme+'-spre'}>Pre</th>,<th key={theme+'-spost'}>Post</th>,<th key={theme+'-tpre'}>Pre</th>,<th key={theme+'-tpost'}>Post</th>])}</tr>
    </thead><tbody>{groups.map(group=><tr key={group}><td><strong>{displayGeo(group)}</strong></td>{themes.flatMap(theme=>[<td key={theme+'-spre'}>{participantCount(group,theme,'Pre','Student')}</td>,<td key={theme+'-spost'}>{participantCount(group,theme,'Post','Student')}</td>,<td key={theme+'-tpre'}>{participantCount(group,theme,'Pre','Teacher')}</td>,<td key={theme+'-tpost'}>{participantCount(group,theme,'Post','Teacher')}</td>])}</tr>)}</tbody></table></div>
    {!groups.length&&<p className="empty">No matching {groupLabel.toLowerCase()} data found for the selected filters.</p>}
  </section>;
}
function RecCoverage({refs,records,f}:{refs:Ref[];records:Rec[];f:any}) {
  const locationKey = (x:{Region:string;LocalBoard:string;REC:string}) =>
    [norm(x.Region),norm(x.LocalBoard),norm(x.REC)].join('||');
  const expected = refs.filter(r =>
    (!f.region || r.Region === f.region) &&
    (!f.board || r.LocalBoard === f.board) &&
    (!f.rec || r.REC === f.rec)
  );
  const expectedByKey = new Map<string,Ref>();
  expected.forEach(r => {
    const k = locationKey(r);
    if (!expectedByKey.has(k)) expectedByKey.set(k,r);
  });
  const preRows = records.filter(r =>
    r.Assessment.toLowerCase() === 'pre' &&
    (!f.region || r.Region === f.region) &&
    (!f.board || r.LocalBoard === f.board) &&
    (!f.rec || r.REC === f.rec) &&
    (!f.year || String(r.Year) === String(f.year))
  );
  const receivedKeys = new Set(preRows.filter(r => r.Region && r.LocalBoard && r.REC).map(r => locationKey(r)));
  const received = [...expectedByKey.keys()].filter(k => receivedKeys.has(k)).length;
  const total = expectedByKey.size;
  const pending = [...expectedByKey.entries()]
    .filter(([k]) => !receivedKeys.has(k))
    .map(([,r]) => r)
    .sort((a,b) => a.Region.localeCompare(b.Region) || a.LocalBoard.localeCompare(b.LocalBoard) || a.REC.localeCompare(b.REC));
  const coverage = total ? 100 * received / total : 0;
  return <section className="card rec-coverage">
    <div className="section-head">
      <div><h2>REC Assessment Coverage</h2><p>Coverage is counted once per REC with at least one Pre-assessment record.</p></div>
      <strong className="coverage-percent">{fmt(coverage)}</strong>
    </div>
    <div className="coverage-stats">
      <div><span>Expected RECs</span><b>{total}</b></div>
      <div><span>Received Pre-assessment</span><b>{received}</b></div>
      <div><span>Pending RECs</span><b>{Math.max(0,total-received)}</b></div>
    </div>
    {pending.length > 0 && <details className="pending-recs"><summary>View pending RECs ({pending.length})</summary>
      <div className="table-wrap"><table><thead><tr><th>Region</th><th>Local Board</th><th>REC</th></tr></thead><tbody>
        {pending.map(r=><tr key={locationKey(r)}><td>{r.Region}</td><td>{r.LocalBoard}</td><td>{r.REC}</td></tr>)}
      </tbody></table></div>
    </details>}
    {total === 0 && <p className="empty">No RECs match the selected location filters.</p>}
  </section>;
}

function rubricDescription(id:string){
  const match = id.match(/^Theme(\d+):/);
  if(!match) return id;
  const themeKey = 'T'+match[1];
  const keys = studentIndicatorKeys[themeKey] || [];
  const descriptions = (studentIndicators as any)[themeKey] || [];
  let index = keys.indexOf(id);
  // Some historical Kobo records use an alternate UA sequence (for example Theme3:UA3).
  // Resolve those IDs by their rubric family and ordinal when they are not in the app's current key list.
  if(index < 0){
    const code = id.split(':')[1] || '';
    const family = code.startsWith('UA') ? 'UA' : code.startsWith('A') ? 'A' : '';
    const ordinal = Number(code.replace(family,''));
    const candidates = keys.map((key,i)=>({key,i})).filter(x=>(x.key.split(':')[1]||'').startsWith(family));
    const matchByOrdinal = candidates.find(x=>Number((x.key.split(':')[1]||'').replace(family,''))===ordinal);
    if(matchByOrdinal) index = matchByOrdinal.i;
    else if(family==='UA' && ordinal===3 && themeKey==='T3') index = 2;
    else if(family==='A' && ordinal===2 && themeKey==='T3') index = 3;
  }
  return index >= 0 && descriptions[index] ? descriptions[index] : id;
}

let wayForwardResourcesCache:any[]|null=null;
let wayForwardResourcesRequest:Promise<any[]>|null=null;
let activeTargetRecs:any[]=[];

function WayForward({rows,scope,f,nav}:{rows:Rec[];scope:string;f:any;nav?:(p:string)=>void}) {
  const [wayForwardResources,setWayForwardResources]=useState<any[]>(()=>wayForwardResourcesCache||[]);
  useEffect(()=>{
    let active=true;
    if(wayForwardResourcesCache){setWayForwardResources(wayForwardResourcesCache);return()=>{active=false};}
    if(!wayForwardResourcesRequest){
      const request:Promise<any[]>=apiGet('resources')
        .then(d=>{wayForwardResourcesCache=Array.isArray(d.resources)?d.resources:[];return wayForwardResourcesCache||[];})
        .catch(()=>{wayForwardResourcesRequest=null;return [] as any[];});
      wayForwardResourcesRequest=request;
    }
    const pending=wayForwardResourcesRequest;
    if(pending)pending.then(items=>{if(active)setWayForwardResources(items);});
    return()=>{active=false};
  },[]);
  const studentRows = rows.filter(r => r.ParticipantType === 'Student');
  const teacherRows = rows.filter(r => r.ParticipantType === 'Teacher');
  const studentThemes = group(studentRows,'ThemeID').sort((a,b)=>a.p-b.p);
  const teacherThemes = group(teacherRows,'ThemeID').sort((a,b)=>a.p-b.p);
  const priorityRows = scope==='teacher' ? teacherRows : studentRows;
  const dimGroups = group(priorityRows,'DimensionID').sort((a,b)=>a.p-b.p);
  const indicatorBuckets=new Map<string,Rec[]>();
  priorityRows.forEach(r=>{
    const id=norm(r.IndicatorID);
    if(!id)return;
    const bucket=indicatorBuckets.get(id)||[];
    bucket.push(r);
    indicatorBuckets.set(id,bucket);
  });
  const indicatorGroups=[...indicatorBuckets.entries()].map(([id,subset])=>{
    const a=aggregate(subset);
    return {id,label:rubricDescription(id),p:a.p,rows:subset};
  }).sort((a,b)=>a.p-b.p);
  const strongestTheme = (scope==='teacher'?teacherThemes:studentThemes).slice().sort((a,b)=>b.p-a.p)[0];
  const weakestStudentTheme = studentThemes[0];
  const weakestTeacherTheme = teacherThemes[0];
  const weakestDim = dimGroups[0];
  const strongestDim = dimGroups.slice().sort((a,b)=>b.p-a.p)[0];
  const weakIndicators = indicatorGroups.slice(0,3).filter(x=>x.rows.length);
  const strongIndicators = indicatorGroups.slice().sort((a,b)=>b.p-a.p).slice(0,3).filter(x=>x.rows.length);
  const themeActions:Record<string,string> = {
    T1:'Use short stories, picture prompts and role-play. Ask children to explain their thinking, then demonstrate the expected action in a familiar daily routine.',
    T2:'Use concrete objects, story sequencing and guided questions. Invite children to describe what they notice, compare ideas and explain their answers in their own words.',
    T3:'Use family and community scenarios, cooperative play and small service tasks. Observe whether children can apply the idea in a real interaction, not only repeat it.',
    T4:'Use a simple balance-and-choice activity. Help children connect the concept to everyday routines, caring actions and age-appropriate responsibilities.'
  };
  const teacherThemeActions:Record<string,string> = {
    T1:'Provide focused professional learning on authority, leadership and guidance. Use a short case study, peer discussion and lesson-planning practice to connect the theme to age-appropriate classroom experiences.',
    T2:'Strengthen teachers’ understanding of Ismaili Muslim traditions through guided study, collaborative interpretation of examples and practice explaining concepts in child-friendly language.',
    T3:'Support teachers to plan inclusive family, community and service-learning activities. Review examples together and practise facilitating respectful discussion and participation.',
    T4:'Help teachers connect material and spiritual aspects of life through integrated activities, reflection and practical examples that children can apply in everyday routines.'
  };
  const dimAction = weakestDim?.key === 'UA'
    ? 'Strengthen understanding and articulation: model key vocabulary, use open-ended questions, allow wait time, and ask children to explain or show what they understand.'
    : weakestDim?.key === 'A'
      ? 'Strengthen application: provide guided practice, role-play and repeated opportunities to demonstrate the learning during classroom and home routines.'
      : 'Review the weakest rubric area with the team and agree on one observable child behaviour to practise and assess.';
  const titleScope = scope==='teacher'?'Teacher':scope==='dashboard'?'Overall':scope==='region'?'Region':scope==='board'?'Local Board':'REC';
  return <section className="card way-forward">
    <div className="section-head"><div><h2>Way Forward — {titleScope}</h2><p>{scope==='teacher'?'Teacher priorities are based on the selected teacher’s theme performance.':'Student and teacher priorities are calculated separately from the lowest-performing themes in the current selection.'}</p></div></div>
    {!rows.length ? <p className="empty">No assessment data is available for these filters yet.</p> : <>
      <div className="way-forward-priorities">
        {scope==='teacher' ? <>
          <div><span>Teacher · Strongest theme</span><b>{strongestTheme ? labelTheme(strongestTheme.key)+' · '+fmt(strongestTheme.p) : 'Not available'}</b><p>Build on this strength by sharing effective practice with peers and using it as a model for other themes.</p></div>
          <div><span>Teacher · Weakest theme</span><b>{weakestTeacherTheme ? labelTheme(weakestTeacherTheme.key)+' · '+fmt(weakestTeacherTheme.p) : 'Not available'}</b><p>{weakestTeacherTheme ? (teacherThemeActions[weakestTeacherTheme.key] || 'Plan focused professional learning and review progress against the same indicators.') : 'No teacher assessment data is available for this selection.'}</p></div>
        </> : <>
          <div><span>Students · Weakest theme</span><b>{weakestStudentTheme ? labelTheme(weakestStudentTheme.key)+' · '+fmt(weakestStudentTheme.p) : 'Not available'}</b><p>{weakestStudentTheme ? (themeActions[weakestStudentTheme.key] || 'Plan a focused review, model the expected learning, and assess it again using the same indicators.') : 'No student assessment data is available for this selection.'}</p></div>
          <div><span>Teachers · Weakest theme</span><b>{weakestTeacherTheme ? labelTheme(weakestTeacherTheme.key)+' · '+fmt(weakestTeacherTheme.p) : 'Not available'}</b><p>{weakestTeacherTheme ? (teacherThemeActions[weakestTeacherTheme.key] || 'Plan focused professional learning and review progress against the same indicators.') : 'No teacher assessment data is available for this selection.'}</p></div>
          <div><span>Students · Weakest dimension</span><b>{weakestDim ? labelDim(weakestDim.key)+' · '+fmt(weakestDim.p) : 'Not available'}</b><p>{dimAction}</p></div>
        </>}
      </div>
      {scope!=='teacher'&&<>
      <h3>Student rubrics requiring attention</h3>
      {weakIndicators.length ? <div className="table-wrap"><table><thead><tr><th>Full rubric description</th><th>Theme</th><th>Dimension</th><th>Performance</th><th>Suggested action</th></tr></thead><tbody>
        {weakIndicators.map((x:any,i:number)=>{const sample=x.rows[0];const action=rubricAction(x.id,sample.ThemeID,sample.DimensionID);return <tr key={x.id+'-'+i}><td>{x.label}</td><td>{labelTheme(sample.ThemeID)}</td><td>{sample.DimensionID ? labelDim(sample.DimensionID) : '—'}</td><td>{fmt(x.p)}</td><td>{action}</td></tr>})}
      </tbody></table></div> : <p className="empty">Student indicator-level data is not available for this selection.</p>}
      </>}
      <div className="way-forward-resources"><div><h3>Resources matched to the way forward</h3><p>Open mentoring presentations, reading materials and assessment strategies that match the theme needing support. Resource matching uses the theme number or theme name in each resource title, category or description.</p></div><button type="button" className="primary" onClick={()=>nav?.('resources')}>Browse all resources ↗</button></div>
      {(()=>{
        const weakThemes=[...(scope==='teacher'?teacherThemes:studentThemes)].sort((a,b)=>a.p-b.p).slice(0,2);
        const matched=weakThemes.map(t=>{
          const themeKey=String(t.key||'').toLowerCase();
          const themeNo=themeKey.match(/[1-4]/)?.[0]||'';
          const aliases=[themeKey,'theme '+themeNo,'theme'+themeNo,'t'+themeNo].filter(Boolean);
          const hits=wayForwardResources.filter(r=>{
            const hay=[r.title,r.category,r.description,r.fileName].join(' ').toLowerCase();
            return aliases.some(a=>hay.includes(a));
          });
          return {theme:t,resources:hits};
        });
        return matched.length?<div className="resource-list">{matched.map((m:any)=><article className="card" key={String(m.theme.key)}><h3>{labelTheme(m.theme.key)} · {fmt(m.theme.p)} — Recommended resources</h3>{m.resources.length?<ul>{m.resources.map((r:any)=><li key={r.resourceID||r.fileURL}><a href={r.fileURL} target="_blank" rel="noreferrer">{r.title||r.fileName||'Open resource'} ↗</a>{r.category&&<span> — {r.category}</span>}{r.description&&<p>{r.description}</p>}</li>)}</ul>:<p className="admin-note">No resource title or description currently matches this theme. Add the theme number/name (for example, “Theme 1”) to the resource title or description to link it here.</p>}</article>)}</div>:null;
      })()}

    </>}
  </section>;
}


function ReportActions({rows,f,isAdmin}:{rows:Rec[];f:any;isAdmin:boolean}){
 const [busy,setBusy]=useState(false);
 const [previewOpen,setPreviewOpen]=useState(false);
 const [selectedPreview,setSelectedPreview]=useState<string>('');
 const [selectedSlides,setSelectedSlides]=useState<string[]>(['cover','themes','assessment','dimensions','cross','region','board','rec','wayforward']);
 const reportRows=useMemo(()=>filterRows(rows,{...f,assessment:'',pt:'',dim:'',teacher:'',studentRating:'',teacherRating:''}),[rows,f]);
 const scope=[f.region,f.board,f.rec].filter(Boolean).join(' / ')||'All authorised areas';
 const stageRows=(stage:'Pre'|'Post',type?:string,subset=reportRows)=>subset.filter(r=>assessmentIs(r.Assessment,stage)&&(!type||norm(r.ParticipantType).toLowerCase()===type));
 const score=(subset:Rec[])=>aggregate(subset);
 const overall=(type:string,stage:'Pre'|'Post')=>score(stageRows(stage,type));
 const dimensionRows=unique(reportRows,'DimensionID').filter(Boolean).map(dim=>({dim,pre:score(stageRows('Pre','student',reportRows.filter(r=>r.DimensionID===dim))),post:score(stageRows('Post','student',reportRows.filter(r=>r.DimensionID===dim))),teacherPre:score(stageRows('Pre','teacher',reportRows.filter(r=>r.DimensionID===dim))),teacherPost:score(stageRows('Post','teacher',reportRows.filter(r=>r.DimensionID===dim)))}));
 const groupRank=(key:'Region'|'LocalBoard'|'REC')=>unique(reportRows,key).filter(Boolean).map(name=>({name,pre:score(stageRows('Pre',undefined,reportRows.filter(r=>norm(r[key])===name))),post:score(stageRows('Post',undefined,reportRows.filter(r=>norm(r[key])===name))),studentPre:score(stageRows('Pre','student',reportRows.filter(r=>norm(r[key])===name))),studentPost:score(stageRows('Post','student',reportRows.filter(r=>norm(r[key])===name))),teacherPost:score(stageRows('Post','teacher',reportRows.filter(r=>norm(r[key])===name))),recs:new Set(reportRows.filter(r=>norm(r[key])===name).map(r=>r.REC)).size})).filter(x=>x.studentPost.max>0).sort((a,b)=>b.studentPost.p-a.studentPost.p);
 const rankings={Region:groupRank('Region'), 'Local Board':groupRank('LocalBoard'), REC:groupRank('REC')};
 const change=(a:{p:number;max:number},b:{p:number;max:number})=>a.max&&b.max?(b.p-a.p):null;
 const changeText=(a:{p:number;max:number},b:{p:number;max:number})=>a.max&&b.max?((b.p-a.p>0?'+':'')+(b.p-a.p).toFixed(1)+' pp'):'N/A';
 const label=(x:any)=>labelDim(x);
 const generatePptx=async()=>{
  setBusy(true);
  try{
   const moduleUrl='https://esm.sh/pptxgenjs@3.12.0';const mod:any=await import(/* @vite-ignore */ moduleUrl);
   const PptxGenJS=mod.default||mod;
   const pptx=new PptxGenJS();
   pptx.layout='LAYOUT_WIDE';pptx.author='KG II Assessment App';pptx.subject='Filter-based KG II assessment analysis';pptx.title='KG II Assessment Report';
   pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-US'};
   const C={green:'064E3B',mint:'DDEFE8',ink:'18352E',muted:'65756F',orange:'D97706',red:'B91C1C',white:'FFFFFF',line:'D8E3DE'};
   const addBase=(title:string,sub='')=>{const slide=pptx.addSlide();slide.background={color:'F7FAF8'};slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:0.18,line:{color:C.green,transparency:100},fill:{color:C.green}});slide.addText(title,{x:0.55,y:0.38,w:12.2,h:0.48,fontFace:'Aptos Display',fontSize:25,bold:true,color:C.green,margin:0,breakLine:false});if(sub)slide.addText(sub,{x:0.58,y:0.91,w:12,h:0.35,fontSize:10,color:C.muted,margin:0});slide.addText('KG II Assessment App',{x:0.58,y:7.16,w:5,h:0.18,fontSize:8,color:C.muted,margin:0});slide.addText(String(pptx._slides.length).padStart(2,'0'),{x:12.35,y:7.12,w:0.4,h:0.22,fontSize:9,color:C.muted,align:'right',margin:0});return slide;};
   const addText=(slide:any,text:string,x:number,y:number,w:number,h:number,opts:any={})=>slide.addText(text,{x,y,w,h,fontFace:'Aptos',fontSize:opts.fontSize||13,color:opts.color||C.ink,bold:!!opts.bold,margin:opts.margin??0.05,breakLine:false,fit:'shrink',...opts});
   const addBarChart=(slide:any,items:any[],x:number,y:number,w:number,h:number)=>{const usable=Math.max(1,items.length),rowH=Math.min(0.62,h/usable),max=100;items.forEach((it,i)=>{const yy=y+i*rowH;addText(slide,String(it.label).slice(0,34),x,yy,2.5,rowH-0.04,{fontSize:10, valign:'mid'});slide.addShape(pptx.ShapeType.rect,{x:x+2.55,y:yy+0.12,w:w-3.2,h:0.22,line:{color:C.line,transparency:100},fill:{color:'E7EEEA'}});if(it.pre!==null&&it.pre!==undefined)slide.addShape(pptx.ShapeType.rect,{x:x+2.55,y:yy+0.12,w:Math.max(0.02,(w-3.2)*Math.min(max,it.pre)/max),h:0.22,line:{color:C.green,transparency:100},fill:{color:C.green}});if(it.post!==null&&it.post!==undefined)slide.addShape(pptx.ShapeType.rect,{x:x+2.55,y:yy+0.36,w:Math.max(0.02,(w-3.2)*Math.min(max,it.post)/max),h:0.16,line:{color:C.orange,transparency:100},fill:{color:C.orange}});addText(slide,(it.pre===null||it.pre===undefined?'Pre —':'Pre '+it.pre.toFixed(1)+'%')+'  /  '+(it.post===null||it.post===undefined?'Post —':'Post '+it.post.toFixed(1)+'%'),x+2.6+w-3.2,yy+0.03,0.7,rowH-0.03,{fontSize:8,color:C.muted,align:'right'});});};
   if(selectedSlides.includes('cover')){const cover=addBase('KG II Assessment Analysis', 'Filter-based report · '+new Date().toLocaleDateString());
   addText(cover,'REPORT SCOPE',0.75,1.65,2,0.3,{fontSize:11,bold:true,color:C.green});
   addText(cover,scope,0.75,2.0,11.5,0.7,{fontSize:24,bold:true,color:C.ink});
   addText(cover,'Cycle: '+(f.cycle||'All cycles')+'     Year: '+(f.year||'All years')+'     Theme: '+(f.theme?labelTheme(f.theme):'All themes')+'     Dimension: '+(f.dim?labelDim(f.dim):'All dimensions'),0.75,2.85,11.6,0.55,{fontSize:13,color:C.muted});
   const studentPre=overall('student','Pre'),studentPost=overall('student','Post'),teacherPre=overall('teacher','Pre'),teacherPost=overall('teacher','Post');
   const cards:Array<[string,{score:number;max:number;p:number}]>=[['Student Pre',studentPre],['Student Post',studentPost],['Teacher Pre',teacherPre],['Teacher Post',teacherPost]];
   cards.forEach((c,i)=>{const x=0.75+i*3.08;cover.addShape(pptx.ShapeType.roundRect,{x,y:4,w:2.72,h:1.25,rectRadius:0.08,line:{color:C.line},fill:{color:C.white}});addText(cover,c[0],x+0.15,4.18,2.4,0.3,{fontSize:12,bold:true,color:C.muted});addText(cover,c[1].max?fmt(c[1].p):'N/A',x+0.15,4.53,2.4,0.48,{fontSize:25,bold:true,color:C.green});addText(cover,c[1].max?'Assessment records included':'No matching data',x+0.15,5.05,2.4,0.22,{fontSize:8,color:C.muted});});
   addText(cover,'Prepared from the records available to the signed-in user. Results may be limited where pre/post or participant data is incomplete.',0.8,6.05,11.6,0.55,{fontSize:11,color:C.muted});
   }
   if(selectedSlides.includes('dimensions')){
   const dims=dimensionRows.filter(d=>d.pre.max||d.post.max||d.teacherPre.max||d.teacherPost.max);
   const dimSlide=addBase('Dimension-wise Pre/Post Analysis','Green bars = Pre · Orange bars = Post · Percentages are calculated from score / maximum score');
   if(dims.length){addBarChart(dimSlide,dims.flatMap(d=>[{label:'Students · '+label(d.dim),pre:d.pre.max?d.pre.p:null,post:d.post.max?d.post.p:null},{label:'Teachers · '+label(d.dim),pre:d.teacherPre.max?d.teacherPre.p:null,post:d.teacherPost.max?d.teacherPost.p:null}]),0.7,1.55,11.9,4.8);}else addText(dimSlide,'No dimension-wise Pre/Post data is available for the selected filters.',0.8,1.8,11,0.6,{fontSize:16});
   }
   if(selectedSlides.includes('cross')){
   const cross=addBase('Student–Teacher Cross-Analysis','Comparisons are descriptive; differences do not establish cause or effect.');
   const crossItems=unique(reportRows,'ThemeID').filter(Boolean).map(theme=>({theme,sp:score(stageRows('Post','student',reportRows.filter(r=>r.ThemeID===theme))),tp:score(stageRows('Post','teacher',reportRows.filter(r=>r.ThemeID===theme))),spre:score(stageRows('Pre','student',reportRows.filter(r=>r.ThemeID===theme))),tpre:score(stageRows('Pre','teacher',reportRows.filter(r=>r.ThemeID===theme)))})).filter(x=>x.sp.max||x.tp.max||x.spre.max||x.tpre.max);
   if(crossItems.length){crossItems.forEach((it,i)=>{const yy=1.5+i*1.18;addText(cross,labelTheme(it.theme),0.8,yy,2.7,0.4,{fontSize:14,bold:true});addText(cross,'Students: '+(it.spre.max?fmt(it.spre.p):'Pre N/A')+' → '+(it.sp.max?fmt(it.sp.p):'Post N/A'),3.6,yy,4.1,0.4,{fontSize:12});addText(cross,'Teachers: '+(it.tpre.max?fmt(it.tpre.p):'Pre N/A')+' → '+(it.tp.max?fmt(it.tp.p):'Post N/A'),7.7,yy,4.6,0.4,{fontSize:12});if(it.sp.max&&it.tp.max)addText(cross,'Post gap: '+(it.sp.p-it.tp.p>=0?'+':'')+(it.sp.p-it.tp.p).toFixed(1)+' pp (students − teachers)',3.6,yy+0.42,6,0.28,{fontSize:10,color:C.muted});});}else addText(cross,'No matching student/teacher assessment data is available.',0.8,1.8,11,0.5,{fontSize:15});
   }
   for(const [level,list] of Object.entries(rankings) as [string,any[]][]){
    if(!selectedSlides.includes(level==='Region'?'region':level==='Local Board'?'board':'rec'))continue;
    const slide=addBase(level+' Performance Rankings','Ranked by Post-assessment score across the selected and authorised scope; insufficient data is excluded.');
    if(!list.length){addText(slide,'No comparable Post-assessment data is available for this level.',0.8,1.7,11,0.5,{fontSize:15});continue;}
    const top=list.slice(0,5),bottom=[...list].sort((a,b)=>a.post.p-b.post.p).slice(0,5);
    addText(slide,'TOP PERFORMING',0.8,1.45,5.4,0.35,{fontSize:14,bold:true,color:C.green});
    addText(slide,'NEEDS SUPPORT',6.8,1.45,5.4,0.35,{fontSize:14,bold:true,color:C.red});
    top.forEach((it,i)=>{const yy=1.95+i*0.78;addText(slide,(i+1)+'. '+it.name,0.85,yy,3.5,0.28,{fontSize:11,bold:i===0});addText(slide,'Student '+fmt(it.studentPost.p),4.05,yy,1.6,0.28,{fontSize:11,bold:true,color:C.green});addText(slide,'Student Pre '+(it.studentPre.max?fmt(it.studentPre.p):'N/A')+' · Teacher Post '+(it.teacherPost.max?fmt(it.teacherPost.p):'N/A'),0.9,yy+0.3,5.2,0.22,{fontSize:8,color:C.muted});});
    bottom.forEach((it,i)=>{const yy=1.95+i*0.78;addText(slide,(i+1)+'. '+it.name,6.85,yy,3.5,0.28,{fontSize:11,bold:i===0});addText(slide,'Student '+fmt(it.studentPost.p),10.05,yy,1.6,0.28,{fontSize:11,bold:true,color:C.red});addText(slide,'Student Pre '+(it.studentPre.max?fmt(it.studentPre.p):'N/A')+' · Teacher Post '+(it.teacherPost.max?fmt(it.teacherPost.p):'N/A'),6.9,yy+0.3,5.2,0.22,{fontSize:8,color:C.muted});});
   }
   if(selectedSlides.includes('wayforward')){
   const priority=dimensionRows.filter(d=>d.post.max).sort((a,b)=>a.post.p-b.post.p).slice(0,4);
   const wf=addBase('Way Forward & Priority Actions','Priorities are based on the lowest available student post-assessment dimensions in this scope.');
   if(priority.length){priority.forEach((d,i)=>{const yy=1.5+i*1.15;addText(wf,(i+1)+'. '+label(d.dim)+' — '+fmt(d.post.p),0.85,yy,10.8,0.35,{fontSize:15,bold:true,color:C.green});addText(wf,wayForwardForDimension(d.dim,reportRows.filter(r=>r.DimensionID===d.dim)),1.15,yy+0.4,10.7,0.5,{fontSize:11,color:C.ink});});}else addText(wf,'Collect sufficient assessment evidence before setting dimension-level priorities.',0.85,1.7,11,0.5,{fontSize:14});
   }
   const filename='KGII_Assessment_Report_'+new Date().toISOString().slice(0,10)+'.pptx';
   await pptx.writeFile({fileName:filename});
  }catch(e:any){alert('Could not generate the PowerPoint report. Please try again. '+(e?.message||''));}
  finally{setBusy(false);}
 };
 const liveSummary=[{label:'Student Pre',value:overall('student','Pre')},{label:'Student Post',value:overall('student','Post')},{label:'Teacher Pre',value:overall('teacher','Pre')},{label:'Teacher Post',value:overall('teacher','Post')}];
 const livePriority=dimensionRows.filter(d=>d.post.max).sort((a,b)=>a.post.p-b.post.p)[0];
 const slideOptions=[{id:'cover',title:'Overall student & teacher Pre/Post',desc:'Overall student Pre/Post and teacher Pre/Post scores'},{id:'themes',title:'Theme-wise performance',desc:'Student and teacher Pre/Post results by theme'},{id:'assessment',title:'Assessment type performance',desc:'Pre/Post assessment coverage and scores by participant type'},{id:'dimensions',title:'Dimension-wise Pre/Post',desc:'Student and teacher scores by dimension'},{id:'cross',title:'Student–teacher cross-analysis',desc:'Theme comparisons and score gaps'},{id:'region',title:'Overall Region performance',desc:'Student and teacher Pre/Post performance by region'},{id:'board',title:'Overall Local Board performance',desc:'Student and teacher Pre/Post performance by Local Board'},{id:'rec',title:'Overall REC performance',desc:'Student and teacher Pre/Post performance by REC'},{id:'wayforward',title:'Way forward',desc:'Dashboard-aligned priorities based on lowest student post results'}];
  const toggleSlide=(id:string)=>setSelectedSlides(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  return <section className="card report-actions"><div><h2>Report Builder</h2><p className="admin-note">Uses the current filters and only the assessment data available to your account.</p></div><div className="report-action-buttons"><button type="button" className="secondary" onClick={()=>setPreviewOpen(v=>!v)}>{previewOpen?'Hide preview':'Preview & select slides'}</button><button type="button" className="primary" onClick={generatePptx} disabled={busy||selectedSlides.length===0}>{busy?'Generating PowerPoint…':'Generate selected PowerPoint slides'}</button></div>{previewOpen&&<div className="report-preview"><h3>Presentation preview</h3><p>Select the sections to include. The generated PowerPoint uses the live filtered data shown in this preview.</p><div className="report-live-preview"><strong>{scope}</strong><p>Cycle: {f.cycle||'All cycles'} · Year: {f.year||'All years'} · Theme: {f.theme?labelTheme(f.theme):'All themes'}</p><div className="report-live-metrics">{liveSummary.map(item=><div key={item.label}><span>{item.label}</span><b>{item.value.max?fmt(item.value.p):'N/A'}</b></div>)}</div><p><b>Priority dimension:</b> {livePriority?label(livePriority.dim)+' · '+fmt(livePriority.post.p)+' student post':'Insufficient post data'}</p></div><div className="report-slide-grid">{slideOptions.map((item,index)=><article className={'report-slide-preview '+(selectedSlides.includes(item.id)?'selected':'')} key={item.id}><div className="report-slide-number">Slide {index+1}</div><h4>{item.title}</h4><p>{item.desc}</p><div className="form-actions"><button type="button" className="secondary" onClick={()=>setSelectedPreview(prev=>prev===item.id?'':item.id)}>{selectedPreview===item.id?'Hide data preview':'Preview data'}</button><button type="button" className={selectedSlides.includes(item.id)?'secondary':'primary'} onClick={()=>toggleSlide(item.id)}>{selectedSlides.includes(item.id)?'✓ Added to presentation':'＋ Add to presentation'}</button></div>{selectedPreview===item.id&&<div className="report-slide-data-preview"><strong>Data preview · {item.title}</strong>{item.id==='cover'&&<><p>Scope: {scope}</p><div className="report-live-metrics">{liveSummary.map(metric=><div key={metric.label}><span>{metric.label}</span><b>{metric.value.max?fmt(metric.value.p):'N/A'}</b></div>)}</div><p><b>Student change:</b> {changeText(overall('student','Pre'),overall('student','Post'))} &nbsp; <b>Teacher change:</b> {changeText(overall('teacher','Pre'),overall('teacher','Post'))}</p></>}{item.id==='themes'&&<div className="table-wrap"><table><thead><tr><th>Theme</th><th>Student Pre</th><th>Student Post</th><th>Student Change</th><th>Teacher Pre</th><th>Teacher Post</th><th>Teacher Change</th><th>Coverage</th></tr></thead><tbody>{unique(reportRows,'ThemeID').filter(Boolean).map(theme=>{const subset=reportRows.filter(r=>r.ThemeID===theme);const sp=score(stageRows('Pre','student',subset)),so=score(stageRows('Post','student',subset)),tp=score(stageRows('Pre','teacher',subset)),to=score(stageRows('Post','teacher',subset));return <tr key={theme}><td>{labelTheme(theme)}</td><td>{sp.max?fmt(sp.p):'N/A'}</td><td>{so.max?fmt(so.p):'N/A'}</td><td>{changeText(sp,so)}</td><td>{tp.max?fmt(tp.p):'N/A'}</td><td>{to.max?fmt(to.p):'N/A'}</td><td>{changeText(tp,to)}</td><td>{[sp,so,tp,to].filter(v=>v.max>0).length}/4 stages</td></tr>})}</tbody></table></div>}{item.id==='assessment'&&<div className="table-wrap"><table><thead><tr><th>Participant type</th><th>Pre score</th><th>Post score</th><th>Change (Post − Pre)</th><th>Pre records</th><th>Post records</th><th>Coverage</th></tr></thead><tbody>{(['Student','Teacher'] as const).map(type=>{const pre=score(stageRows('Pre',type.toLowerCase())),post=score(stageRows('Post',type.toLowerCase()));const preCount=stageRows('Pre',type.toLowerCase()).length,postCount=stageRows('Post',type.toLowerCase()).length;return <tr key={type}><td>{type}</td><td>{pre.max?fmt(pre.p):'N/A'}</td><td>{post.max?fmt(post.p):'N/A'}</td><td>{changeText(pre,post)}</td><td>{preCount}</td><td>{postCount}</td><td>{(pre.max?1:0)+(post.max?1:0)}/2 stages</td></tr>})}</tbody></table><p>Change is shown in percentage points only when both Pre and Post scores are available. Coverage counts records in the current dashboard filter scope.</p></div>}{item.id==='dimensions'&&<div className="table-wrap"><table><thead><tr><th>Dimension</th><th>Student Pre</th><th>Student Post</th><th>Student Change</th><th>Teacher Pre</th><th>Teacher Post</th><th>Teacher Change</th></tr></thead><tbody>{dimensionRows.map(d=><tr key={d.dim}><td>{label(d.dim)}</td><td>{d.pre.max?fmt(d.pre.p):'N/A'}</td><td>{d.post.max?fmt(d.post.p):'N/A'}</td><td>{changeText(d.pre,d.post)}</td><td>{d.teacherPre.max?fmt(d.teacherPre.p):'N/A'}</td><td>{d.teacherPost.max?fmt(d.teacherPost.p):'N/A'}</td><td>{changeText(d.teacherPre,d.teacherPost)}</td></tr>)}</tbody></table></div>}{item.id==='cross'&&<div className="table-wrap"><table><thead><tr><th>Theme</th><th>Student Pre</th><th>Student Post</th><th>Teacher Pre</th><th>Teacher Post</th></tr></thead><tbody>{unique(reportRows,'ThemeID').filter(Boolean).map(theme=><tr key={theme}><td>{labelTheme(theme)}</td><td>{score(stageRows('Pre','student',reportRows.filter(r=>r.ThemeID===theme))).max?fmt(score(stageRows('Pre','student',reportRows.filter(r=>r.ThemeID===theme))).p):'N/A'}</td><td>{score(stageRows('Post','student',reportRows.filter(r=>r.ThemeID===theme))).max?fmt(score(stageRows('Post','student',reportRows.filter(r=>r.ThemeID===theme))).p):'N/A'}</td><td>{score(stageRows('Pre','teacher',reportRows.filter(r=>r.ThemeID===theme))).max?fmt(score(stageRows('Pre','teacher',reportRows.filter(r=>r.ThemeID===theme))).p):'N/A'}</td><td>{score(stageRows('Post','teacher',reportRows.filter(r=>r.ThemeID===theme))).max?fmt(score(stageRows('Post','teacher',reportRows.filter(r=>r.ThemeID===theme))).p):'N/A'}</td></tr>)}</tbody></table></div>}{(item.id==='region'||item.id==='board'||item.id==='rec')&&<div className="table-wrap"><table><thead><tr><th>{item.id==='region'?'Region':item.id==='board'?'Local Board':'REC'}</th><th>Student Pre</th><th>Student Post</th><th>Student Pre</th><th>Student Post</th><th>Teacher Pre</th><th>Teacher Post</th><th>Overall Post</th></tr></thead><tbody>{(item.id==='region'?rankings.Region:item.id==='board'?rankings['Local Board']:rankings.REC).map(rank=><tr key={rank.name}><td>{item.id==='region'?displayGeo(rank.name):rank.name}</td><td>{rank.studentPre.max?fmt(rank.studentPre.p):'N/A'}</td><td>{rank.studentPost.max?fmt(rank.studentPost.p):'N/A'}</td><td>{(()=>{const v=score(stageRows('Pre','teacher',reportRows.filter(r=>norm(r[item.id==='region'?'Region':item.id==='board'?'LocalBoard':'REC'])===rank.name)));return v.max?fmt(v.p):'N/A'})()}</td><td>{rank.teacherPost.max?fmt(rank.teacherPost.p):'N/A'}</td><td>{rank.post.max?fmt(rank.post.p):'N/A'}</td></tr>)}</tbody></table><p>Showing all { (item.id==='region'?rankings.Region:item.id==='board'?rankings['Local Board']:rankings.REC).length } entries in the selected scope.</p></div>}{item.id==='wayforward'&&<ul>{dimensionRows.filter(d=>d.post.max).sort((a,b)=>a.post.p-b.post.p).slice(0,4).map(d=><li key={d.dim}><strong>{label(d.dim)} — {fmt(d.post.p)}</strong>: {wayForwardForDimension(d.dim,reportRows.filter(r=>r.DimensionID===d.dim))}</li>)}</ul>}</div>}</article>)}</div><p className="admin-note">{selectedSlides.length} of {slideOptions.length} slide sections selected. Previews use the current dashboard filters and authorised data scope shown above.</p></div>}</section>;
}

function wayForwardForDimension(dim:string,rows:Rec[]){return dim==='UA'?'Use stories, pictures and open-ended questions to strengthen children’s understanding and articulation. Allow thinking time and record their own explanations.':dim==='A'?'Provide practical, age-appropriate activities to practise the target behaviour. Observe independently, give specific feedback and reassess using the same indicators.':'Review the lowest-performing indicators in this dimension, plan a focused activity and monitor progress in the next assessment.';}

function Dashboard({rows,metricRows,phase3Rows,regionRows,highlightRows,nav,f,refs}:{rows:Rec[];metricRows:Rec[];phase3Rows:Rec[];regionRows:Rec[];highlightRows:Rec[];nav:(p:string)=>void;f:any;refs:Ref[]}){return <><Kpis rows={rows} metricRows={metricRows} phase3Rows={phase3Rows} f={f} refs={refs}/><RegionPerformanceTable rows={regionRows}/><ThemeWiseRecCoverage records={rows} refs={refs} targetRecs={activeTargetRecs} f={f} level="region"/><div className="grid2"><CompareChart title="Theme Performance — Pre vs Post" data={compareGroup(rows,'ThemeID').map(x=>({label:labelTheme(x.key),pre:x.pre,post:x.post}))}/><CompareChart title="Dimension Performance — Pre vs Post" data={compareGroup(rows,'DimensionID').map(x=>({label:labelDim(x.key),pre:x.pre,post:x.post}))}/></div><Chart title="Assessment Performance — Pre vs Post" data={group(rows,'Assessment').map(x=>({label:x.key,value:x.p}))}/><PerformanceHighlights rows={highlightRows}/><WayForward rows={rows} scope="dashboard" f={{}} nav={nav}/></>}
function RegionPerformanceTable({rows}:{rows:Rec[]}){const regions=unique(rows,'Region').sort((a,b)=>stageAggregate(rows.filter(r=>norm(r.Region)===b),'Post').p-stageAggregate(rows.filter(r=>norm(r.Region)===a),'Post').p||a.localeCompare(b));return <section className="card"><h2>Region Performance</h2><div className="table-wrap"><table><thead><tr><th>Region</th><th>Students</th><th>Teachers</th><th>Student Score %</th><th>Teacher Score %</th><th>Overall</th><th>UA</th><th>A</th><th>Pre</th><th>Post</th></tr></thead><tbody>{regions.map(region=>{const scoped=rows.filter(r=>norm(r.Region)===region);return <tr key={region}><td>{displayGeo(region)}</td><td>{count(scoped,region,'Student','Region')}</td><td>{count(scoped,region,'Teacher','Region')}</td><td>{fmt(aggregate(scoped.filter(r=>r.ParticipantType==='Student')).p)}</td><td>{fmt(aggregate(scoped.filter(r=>r.ParticipantType==='Teacher')).p)}</td><td>{fmt(aggregate(scoped).p)}</td><td>{fmt(aggregate(scoped.filter(r=>r.DimensionID==='UA')).p)}</td><td>{fmt(aggregate(scoped.filter(r=>r.DimensionID==='A')).p)}</td><td>{fmt(stageAggregate(scoped,'Pre').p)}</td><td>{fmt(stageAggregate(scoped,'Post').p)}</td></tr>})}</tbody></table></div>{!regions.length&&<div className="empty">No matching region data</div>}</section>}
function compareGroup(rows:Rec[],key:'ThemeID'|'DimensionID'){return unique(rows,key).map(k=>({key:k,pre:stageAggregate(rows.filter(r=>norm(r[key])===k),'Pre').p,post:stageAggregate(rows.filter(r=>norm(r[key])===k),'Post').p}));}
function CompareChart({title,data}:{title:string;data:{label:string;pre:number;post:number}[]}){return <section className="card chart compare-chart"><h2>{title}</h2><div className="compare-legend"><span><i className="pre-swatch"/>Pre</span><span><i className="post-swatch"/>Post</span></div>{data.length?data.map(d=><div className="compare-row" key={d.label}><strong>{d.label}</strong><div className="compare-bars"><div className="compare-track"><i className="pre-bar" style={{width:Math.max(0,Math.min(100,d.pre))+'%'}}/></div><b>{fmt(d.pre)}</b><div className="compare-track"><i className="post-bar" style={{width:Math.max(0,Math.min(100,d.post))+'%'}}/></div><b>{fmt(d.post)}</b></div></div>):<div className="empty">No matching data</div>}</section>}
function performanceDrivers(rows:Rec[],mode:'strong'|'weak'){
 const choose=(key:'ThemeID'|'DimensionID'|'IndicatorID')=>unique(rows,key).map(id=>{const subset=rows.filter(r=>norm(r[key])===id);return {id,p:aggregate(subset).p}}).sort((a,b)=>mode==='strong'?b.p-a.p:a.p-b.p)[0];
 const t=choose('ThemeID'),d=choose('DimensionID'),i=choose('IndicatorID');
 return [t?{label:labelTheme(t.id),p:t.p}:null,d?{label:labelDim(d.id),p:d.p}:null,i?{label:rubricDescription(i.id),p:i.p}:null].filter(Boolean) as {label:string;p:number}[];
}
function highlightDrivers(rows:Rec[],mode:'strong'|'weak'){
 const areas=performanceDrivers(rows,mode);
 return areas.length?areas.map(a=>a.label+' ('+fmt(a.p)+')').join(' · '):'Insufficient data to identify contributing areas';
}
function HighlightTable({items,title}:{items:{label:string;item?:{rows:Rec[];name:string;overall:number}}[];title:string}){
 const stageRows=(rows:Rec[],stage:'pre'|'post')=>rows.filter(r=>{const a=norm(r.Assessment).toLowerCase().replace(/[^a-z]/g,'');return a===stage||a.startsWith(stage)});
 const renderDrivers=(rs:Rec[],mode:'strong'|'weak')=>performanceDrivers(rs,mode).map((a,i)=><div key={i} className="highlight-area"><b>{a.label}</b><small>{fmt(a.p)}</small></div>);
 return <section className="card performance-highlights"><div className="highlight-heading"><div><span className="eyebrow">AT A GLANCE</span><h2>{title}</h2></div><p>Compare results and identify where to build on strengths or offer support.</p></div><div className="highlight-card-grid">{items.map(({label,item})=>{if(!item)return <article className="highlight-card" key={label}><p className="highlight-card-label">{label}</p><div className="empty">Not available</div></article>;const pre=aggregate(stageRows(item.rows,'pre')),post=aggregate(stageRows(item.rows,'post'));const positive=label.toLowerCase().startsWith('top-performing');return <article className="highlight-card" key={label}><div className="highlight-card-top"><span className={'highlight-status '+(positive?'status-strong':'status-support')}>{positive?'TOP PERFORMANCE':'NEEDS SUPPORT'}</span><span className="highlight-scope">{label.toLowerCase().includes('region')?'REGION':label.toLowerCase().includes('local board')?'LOCAL BOARD':'REC'}</span></div><h3>{item.name}</h3><div className="highlight-overall"><span>Post score used for ranking</span><strong>{fmt(item.overall)}</strong></div><div className="highlight-score-row"><div><span>Pre score</span><strong>{pre.max?fmt(pre.p):'No Pre data'}</strong></div><div><span>Post score</span><strong>{post.max?fmt(post.p):'No Post data'}</strong></div></div><div className="highlight-driver-grid"><div className="highlight-driver strength"><h4><span>✓</span> Stronger areas</h4>{renderDrivers(item.rows,'strong')||<small>Not enough data</small>}</div><div className="highlight-driver support"><h4><span>↗</span> Focus areas</h4>{renderDrivers(item.rows,'weak')||<small>Not enough data</small>}</div></div></article>})}</div></section>
}
function PerformanceHighlights({rows}:{rows:Rec[]}){
 const rank=(key:'Region'|'LocalBoard'|'REC')=>{const map=new Map<string,Rec[]>();rows.filter(r=>r[key]).forEach(r=>{const region=displayGeo(norm(r.Region)),board=displayGeo(norm(r.LocalBoard)),rec=displayGeo(norm(r.REC));const id=key==='Region'?region:key==='LocalBoard'?[region,board].join('||'):[region,board,rec].join('||');if(!map.has(id))map.set(id,[]);map.get(id)!.push(r)});return [...map.values()].map(rs=>({rows:rs,name:key==='Region'?displayGeo(rs[0].Region):key==='LocalBoard'?displayGeo(rs[0].LocalBoard)+' · '+displayGeo(rs[0].Region):displayGeo(rs[0].REC)+' · '+displayGeo(rs[0].LocalBoard),overall:stageAggregate(rs,'Post').p})).filter(x=>stageAggregate(x.rows,'Post').max>0).sort((a,b)=>b.overall-a.overall)};
 const regions=rank('Region'),boards=rank('LocalBoard'),recs=rank('REC');
 const cards:{label:string;item:{rows:Rec[];name:string;overall:number}|undefined}[]=[{label:'Top-performing region',item:regions[0]},{label:'Region needing most support',item:regions[regions.length-1]},{label:'Top-performing local board',item:boards[0]},{label:'Local board needing most support',item:boards[boards.length-1]},{label:'Top-performing REC',item:recs[0]},{label:'REC needing most support',item:recs[recs.length-1]}];
 return <HighlightTable title="Performance Highlights" items={cards}/>
}
function Chart({title,data}:{title:string;data:{label:string;value:number}[]}){return <section className="card chart"><h2>{title}</h2>{data.length?data.map(d=><div className="barrow" key={d.label}><span>{d.label}</span><div><i style={{width:Math.max(0,Math.min(100,d.value))+'%'}}/></div><b>{fmt(d.value)}</b></div>):<div className="empty">No matching data</div>}</section>}
function TeacherAnalysis({rows,all,metricRows,phase3Rows,f,setF}:{rows:Rec[];all:Rec[];metricRows:Rec[];phase3Rows:Rec[];f:any;setF:(x:any)=>void}) {
 const teacherRows=all.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher');
 const rankingRows=filterRows(teacherRows,{...f,teacher:'',pt:''});
 const ranked=unique(rankingRows,'TeacherName').filter(name=>!!norm(name)).map(name=>{
   const rs=rankingRows.filter(r=>norm(r.TeacherName)===norm(name));
   return {name,rows:rs,overall:aggregate(rs).p,pre:stageAggregate(rs,'Pre'),post:stageAggregate(rs,'Post')};
 }).sort((a,b)=>b.overall-a.overall);
 const analysisRows=rows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher'&&(!f.teacher||norm(r.TeacherName)===norm(f.teacher)));
 const selectTeacher=(name:string)=>setF((x:any)=>({...x,teacher:name,pt:''}));
 return <>
   <Kpis rows={analysisRows} metricRows={metricRows.filter(r=>norm(r.ParticipantType).toLowerCase()==='teacher')} phase3Rows={phase3Rows} hideTeacherBreakdown f={f}/>
   <section className="card">
    <div className="section-head"><div><h2>{f.teacher?'Teacher Analysis — '+f.teacher:'Overall Teacher Analysis'}</h2><p>{f.teacher?'Theme and pre/post assessment results for the selected teacher.':'Combined results for all teachers. Individual teacher names and scores are hidden in this view.'}</p></div>
    {f.teacher&&<button className="secondary" type="button" onClick={()=>setF((x:any)=>({...x,teacher:''}))}>View all teachers</button>}
    </div>
    {!analysisRows.length ? <p className="empty">No teacher assessment records were found for the selected filters.</p> : <>
     <div className="grid2">
      <CompareChart title="Teacher Theme Performance — Pre vs Post" data={compareGroup(analysisRows,'ThemeID').map(x=>({label:labelTheme(x.key),pre:x.pre,post:x.post}))}/>
      <Chart title="Teacher Assessment Performance — Pre vs Post" data={[{label:'Pre Assessment',value:stageAggregate(analysisRows,'Pre').p},{label:'Post Assessment',value:stageAggregate(analysisRows,'Post').p}]}/>
     </div>
     <WayForward rows={analysisRows} scope="teacher" f={f}/>
    </>}
   </section>
 </>;
}

function StudentTeacherCrossAnalysis({rows,f}:{rows:Rec[];f:any}){
 const clean=rows.filter(r=>r.ParticipantType==='Student'||r.ParticipantType==='Teacher');
 const [view,setView]=useState<'matrix'|'charts'>('matrix');
 const hasRegion=!!f.region&&f.region!=='All',hasBoard=!!f.board&&f.board!=='All',hasRec=!!f.rec&&f.rec!=='All';
 const selectedLevel: 'National'|'Region'|'Local Board'|'REC'=hasRec?'REC':hasBoard?'Local Board':hasRegion?'Region':'National';
 const levelKey:any=selectedLevel==='REC'?'REC':selectedLevel==='Local Board'?'LocalBoard':selectedLevel==='Region'?'Region':null;
 const names=levelKey?unique(clean,levelKey).sort((a,b)=>a.localeCompare(b)):['National'];
 const items=names.map(name=>{
  const scoped=levelKey?clean.filter(r=>norm((r as any)[levelKey])===name):clean;
  const students=scoped.filter(r=>r.ParticipantType==='Student'),teachers=scoped.filter(r=>r.ParticipantType==='Teacher');
  const studentPre=stageAggregate(students,'Pre'),studentPost=stageAggregate(students,'Post'),teacherPre=stageAggregate(teachers,'Pre'),teacherPost=stageAggregate(teachers,'Post');
  const uaPre=stageAggregate(students.filter(r=>norm(r.DimensionID).toUpperCase()==='UA'),'Pre'),uaPost=stageAggregate(students.filter(r=>norm(r.DimensionID).toUpperCase()==='UA'),'Post');
  const appPre=stageAggregate(students.filter(r=>norm(r.DimensionID).toUpperCase()==='A'),'Pre'),appPost=stageAggregate(students.filter(r=>norm(r.DimensionID).toUpperCase()==='A'),'Post');
  const teacherOverall=aggregate(teachers),studentOverall=aggregate(students);
  return {name,scoped,students,teachers,studentPre,studentPost,teacherPre,teacherPost,uaPre,uaPost,appPre,appPost,teacherOverall,studentOverall,
   studentGain:studentPost.max&&studentPre.max?studentPost.p-studentPre.p:null,
   teacherGain:teacherPost.max&&teacherPre.max?teacherPost.p-teacherPre.p:null,
   uaGain:uaPost.max&&uaPre.max?uaPost.p-uaPre.p:null,appGain:appPost.max&&appPre.max?appPost.p-appPre.p:null};
 });
 const themes=unique(clean,'ThemeID').map(theme=>{const s=clean.filter(r=>norm(r.ThemeID)===theme);const st=s.filter(r=>r.ParticipantType==='Student'),te=s.filter(r=>r.ParticipantType==='Teacher');return {theme,studentPre:stageAggregate(st,'Pre'),studentPost:stageAggregate(st,'Post'),teacherPre:stageAggregate(te,'Pre'),teacherPost:stageAggregate(te,'Post')};});
 const national=items[0];
 const statusFor=(p:number)=>p>=80?'Excellent':p>=65?'Good':p>=50?'Satisfactory':'Needs Attention';
 const statusClass=(p:number)=>p>=80?'excellent':p>=65?'good':p>=50?'satisfactory':'attention';
 const cell=(n:number,has:boolean)=>has?fmt(n):'—';
 const delta=(post:any,pre:any)=>post?.max&&pre?.max?post.p-pre.p:null;
 const change=(v:number|null)=>v===null? <span className="cross-no-change">—</span>:<span className={'cross-change '+(v>0?'up':v<0?'down':'flat')}><b>{v>0?'↑':v<0?'↓':'→'}</b> {v>0?'+':''}{fmt(v).replace('%',' pp')}</span>;
 const overallStudentGain=delta(national?.studentPost,national?.studentPre),overallTeacherGain=delta(national?.teacherPost,national?.teacherPre);
 const priorities=[{title:'Understanding',gain:national?.uaGain},{title:'Articulation',gain:national?.uaGain},{title:'Application',gain:national?.appGain}].sort((a,b)=>(a.gain??0)-(b.gain??0));
 return <div className="cross-analysis">
  <section className="card cross-hero"><span className="eyebrow">STUDENT LEARNING · TEACHER DEVELOPMENT</span><h2>Student–Teacher Assessment Analysis</h2><p>Compare pre/post performance and identify themes, dimensions and rubrics requiring further support.</p><div className="cross-cycle">Cycle: {f.cycle&&f.cycle!=='All'?cycleLabel(f.cycle):'All cycles'} · View: {selectedLevel}</div></section>
  <div className="cross-summary-grid">
   <section className="card cross-summary"><h3>Student performance</h3><div className="cross-three"><div><small>Pre</small><strong>{cell(national?.studentPre.p||0,!!national?.studentPre.max)}</strong><span>Overall score</span></div><div><small>Post</small><strong>{cell(national?.studentPost.p||0,!!national?.studentPost.max)}</strong><span>Overall score</span></div><div><small>Change</small>{change(overallStudentGain)}<span>Post minus pre</span></div></div><div className="cross-dimension-row"><span>Understanding / Articulation (UA)</span><b>{cell(national?.uaPre.p||0,!!national?.uaPre.max)} → {cell(national?.uaPost.p||0,!!national?.uaPost.max)}</b>{change(national?.uaGain??null)}</div><div className="cross-dimension-row"><span>Application (A)</span><b>{cell(national?.appPre.p||0,!!national?.appPre.max)} → {cell(national?.appPost.p||0,!!national?.appPost.max)}</b>{change(national?.appGain??null)}</div></section>
   <section className="card cross-summary"><h3>Teacher performance</h3><div className="cross-three"><div><small>Pre</small><strong>{cell(national?.teacherPre.p||0,!!national?.teacherPre.max)}</strong><span>Overall score</span></div><div><small>Post</small><strong>{cell(national?.teacherPost.p||0,!!national?.teacherPost.max)}</strong><span>Overall score</span></div><div><small>Change</small>{change(overallTeacherGain)}<span>Post minus pre</span></div></div><p className="cross-summary-note">Teacher performance and student learning are compared at REC level; individual teacher-to-child attribution is not available in the current data.</p></section>
  </div>
  <section className="card cross-matrix-card"><div className="cross-section-head"><div><h2>{selectedLevel} cross-analysis matrix</h2><p>{selectedLevel==='National'?'All filters are set to All; showing one national summary.':selectedLevel==='Region'?'Showing the selected region only.':selectedLevel==='Local Board'?'Showing Local Boards within the selected region.':'Showing the selected REC only.'}</p></div><div className="cross-tabs"><button className={view==='matrix'?'active':''} onClick={()=>setView('matrix')}>Table</button><button className={view==='charts'?'active':''} onClick={()=>setView('charts')}>Charts</button></div></div>
   {view==='matrix'?<div className="cross-matrix-scroll"><table className="cross-matrix"><thead><tr><th>{selectedLevel}</th><th>Teacher Pre</th><th>Teacher Post</th><th>Teacher Change</th><th>Student Pre</th><th>Student Post</th><th>Student Change</th><th>UA Pre → Post</th><th>UA Change</th><th>A Pre → Post</th><th>A Change</th><th>Student Status</th><th>Teacher Status</th></tr></thead><tbody>{items.map(x=><tr key={x.name}><td className="cross-name">{levelKey?displayGeo(x.name):'National'}</td><td>{cell(x.teacherPre.p,!!x.teacherPre.max)}</td><td>{cell(x.teacherPost.p,!!x.teacherPost.max)}</td><td>{change(x.teacherGain)}</td><td>{cell(x.studentPre.p,!!x.studentPre.max)}</td><td>{cell(x.studentPost.p,!!x.studentPost.max)}</td><td>{change(x.studentGain)}</td><td>{cell(x.uaPre.p,!!x.uaPre.max)} → {cell(x.uaPost.p,!!x.uaPost.max)}</td><td>{change(x.uaGain)}</td><td>{cell(x.appPre.p,!!x.appPre.max)} → {cell(x.appPost.p,!!x.appPost.max)}</td><td>{change(x.appGain)}</td><td>{x.studentPost.max?<span className={'cross-status '+statusClass(x.studentPost.p)}>{statusFor(x.studentPost.p)}</span>:'—'}</td><td>{x.teacherPost.max?<span className={'cross-status '+statusClass(x.teacherPost.p)}>{statusFor(x.teacherPost.p)}</span>:'—'}</td></tr>)}</tbody></table></div>:<div className="cross-charts"><section><h3>Student and teacher pre/post by theme</h3>{themes.map(t=><div className="cross-progress-row" key={t.theme}><b>{labelTheme(t.theme)}</b><span>Students: {cell(t.studentPre.p,!!t.studentPre.max)} → {cell(t.studentPost.p,!!t.studentPost.max)} {change(delta(t.studentPost,t.studentPre))}</span><span>Teachers: {cell(t.teacherPre.p,!!t.teacherPre.max)} → {cell(t.teacherPost.p,!!t.teacherPost.max)} {change(delta(t.teacherPost,t.teacherPre))}</span></div>)}</section></div>}
  </section>
  <section className="card cross-way-forward"><h2>Suggested way forward</h2><p className="cross-resource-intro">Use the selected scope’s student post-assessment results to prioritise the weakest theme, dimension and rubric. Where pre/post data exists, the change is shown to help focus follow-up support.</p><div className="cross-actions">{[
   {title:'Student themes requiring support',items:unique(national?.students||[],'ThemeID').map(id=>{const rs=(national?.students||[]).filter(r=>norm(r.ThemeID)===id);const pre=stageAggregate(rs,'Pre'),post=stageAggregate(rs,'Post');return {id,label:labelTheme(id),pre:pre.max?pre.p:null,score:post.max?post.p:null,gain:post.max&&pre.max?post.p-pre.p:null,rows:rs}}).filter(x=>x.score!==null).sort((a,b)=>(a.score??100)-(b.score??100)).slice(0,2),kind:'student-theme'},
   {title:'Teacher themes requiring support',items:unique(national?.teachers||[],'ThemeID').map(id=>{const rs=(national?.teachers||[]).filter(r=>norm(r.ThemeID)===id);const pre=stageAggregate(rs,'Pre'),post=stageAggregate(rs,'Post');return {id,label:labelTheme(id),pre:pre.max?pre.p:null,score:post.max?post.p:null,gain:post.max&&pre.max?post.p-pre.p:null,rows:rs}}).filter(x=>x.score!==null).sort((a,b)=>(a.score??100)-(b.score??100)).slice(0,2),kind:'teacher-theme'},
   {title:'Dimension requiring support',items:unique(national?.students||[],'DimensionID').map(id=>{const rs=(national?.students||[]).filter(r=>norm(r.DimensionID)===id);const pre=stageAggregate(rs,'Pre'),post=stageAggregate(rs,'Post');return {id,label:labelDim(id),pre:pre.max?pre.p:null,score:post.max?post.p:null,gain:post.max&&pre.max?post.p-pre.p:null,rows:rs}}).filter(x=>x.score!==null).sort((a,b)=>(a.score??100)-(b.score??100)).slice(0,2),kind:'dimension'},
   {title:'Rubric / indicator requiring support',items:unique(national?.students||[],'IndicatorID').map(id=>{const rs=(national?.students||[]).filter(r=>norm(r.IndicatorID)===id);const pre=stageAggregate(rs,'Pre'),post=stageAggregate(rs,'Post');return {id,label:String(id)+' — '+rubricDescription(String(id)),pre:pre.max?pre.p:null,score:post.max?post.p:null,gain:post.max&&pre.max?post.p-pre.p:null,rows:rs}}).filter(x=>x.score!==null).sort((a,b)=>(a.score??100)-(b.score??100)).slice(0,3),kind:'rubric'}
 ].map(group=><div key={group.kind} className={'cross-priority-group '+(group.kind==='rubric'?'cross-priority-rubrics':group.kind==='teacher-theme'?'cross-priority-teacher-themes':'')}><b>{group.title}</b>{group.items.length? <ul className="cross-priority-list">{group.items.map(item=>{const weakest=item.rows.slice().sort((a,b)=>Number(a.Score)/Math.max(1,Number(a.MaxScore))-Number(b.Score)/Math.max(1,Number(b.MaxScore)))[0];const action=group.kind==='rubric'?rubricAction(String(item.id),norm(weakest?.ThemeID),norm(weakest?.DimensionID)):group.kind==='student-theme'?'Plan short, play-based activities around this theme. Model the key idea using a story, picture or object; ask open-ended questions; invite children to explain or demonstrate independently; then revisit the same indicators during circle time and learning centres.':group.kind==='teacher-theme'?'Plan focused teacher support for this theme: revisit the key concepts, model a sample learning experience, collaboratively plan open-ended questions and hands-on tasks, and use peer observation to reflect on implementation before reassessing.':'Use small-group teaching focused on this dimension. Model the skill, then provide guided practice with concrete materials, discussion or role-play. Observe children against the relevant indicators, give specific feedback and repeat the activity with less support before reassessing.';return <li key={item.id}><strong>{item.label}</strong><span className="cross-priority-scores">Pre: {item.pre===null?'—':fmt(item.pre)} · Post: {item.score===null?'—':fmt(item.score)} · Change: {item.gain===null?'—':`${item.gain>0?'+':''}${fmt(item.gain).replace('%',' pp')}`}</span><p>{item.gain===null?'Check assessment coverage and collect comparable pre/post evidence.':action}</p></li>})}</ul>:<p>Not enough matching post-assessment data in this scope to rank this area.</p>}</div>)}</div><p className="cross-note">Priorities are ranked by the lowest available student post-assessment score; negative or unchanged pre/post movement signals a need for follow-up. Understanding and Articulation remain combined as UA where the source data does not distinguish them.</p></section>
 </div>;
}

function Analysis({page,rows,all,metricRows,phase3Rows,f,setF,nav,refs,targetRecs}:{page:string;rows:Rec[];all:Rec[];metricRows:Rec[];phase3Rows:Rec[];f:any;setF:(x:any)=>void;nav:(p:string)=>void;refs:Ref[];targetRecs:any[]}){if(page==='teacher')return <TeacherAnalysis rows={rows} all={all} metricRows={metricRows} phase3Rows={phase3Rows} f={f} setF={setF}/>;if(page==='prepost')return <PrePost rows={rows}/>;if(page==='theme')return <ThemeAnalysis rows={rows}/>;if(page==='dimension')return <DimensionAnalysis rows={rows}/>;if(page==='rec')return <RecAnalysis rows={rows} all={all} f={f} metricRows={metricRows} phase3Rows={phase3Rows} refs={refs} targetRecs={targetRecs}/>;const highlightRows=filterRows(all,{...f,assessment:''});const key=page==='region'?'LocalBoard':'REC';const groupedRows=new Map<string,Rec[]>();rows.forEach(r=>{const name=norm(r[key as keyof Rec]);if(!name)return;const k=geoNorm(name);if(!groupedRows.has(k))groupedRows.set(k,[]);groupedRows.get(k)!.push(r)});const items=[...groupedRows.entries()].map(([k,rs])=>({name:norm(rs[0][key as keyof Rec]),rows:rs,post:stageAggregate(rs.filter(r=>assessmentIs(r.Assessment,'Post')),'Post').p})).sort((a,b)=>b.post-a.post||a.name.localeCompare(b.name)).map(x=>x.name);return <><Kpis rows={rows} metricRows={metricRows} phase3Rows={phase3Rows} f={f} refs={refs}/><section className="card"><h2>{page==='region'?'Local Board Performance':'REC Performance'}</h2><table><thead><tr><th>{page==='region'?'Local Board':'REC'}</th><th>Students</th><th>Teachers</th><th>Student Score %</th><th>Teacher Score %</th><th>Overall</th><th>UA</th><th>A</th><th>Pre</th><th>Post</th></tr></thead><tbody>{items.map(item=><tr key={item} onClick={()=>{if(page==='region'){setF((x:any)=>({...x,board:item,rec:''}));nav('board')}else{setF((x:any)=>({...x,rec:item}));nav('rec')}}}><td className="link">{item}</td><td>{count(rows,item,'Student',key as 'LocalBoard'|'REC')}</td><td>{count(rows,item,'Teacher',key as 'LocalBoard'|'REC')}</td><td>{fmt(aggregate(rows.filter(r=>geoNorm(r[key as keyof Rec])===geoNorm(item)&&r.ParticipantType==='Student')).p)}</td><td>{fmt(aggregate(rows.filter(r=>geoNorm(r[key as keyof Rec])===geoNorm(item)&&r.ParticipantType==='Teacher')).p)}</td><td>{fmt(aggregate(rows.filter(r=>geoNorm(r[key as keyof Rec])===geoNorm(item))).p)}</td><td>{fmt(aggregate(rows.filter(r=>geoNorm(r[key as keyof Rec])===geoNorm(item)&&r.DimensionID==='UA')).p)}</td><td>{fmt(aggregate(rows.filter(r=>geoNorm(r[key as keyof Rec])===geoNorm(item)&&r.DimensionID==='A')).p)}</td><td>{fmt(aggregate(rows.filter(r=>geoNorm(r[key as keyof Rec])===geoNorm(item)&&assessmentIs(r.Assessment,'Pre'))).p)}</td><td>{fmt(aggregate(rows.filter(r=>geoNorm(r[key as keyof Rec])===geoNorm(item)&&assessmentIs(r.Assessment,'Post'))).p)}</td></tr>)}</tbody></table></section><ThemeWiseRecCoverage records={all} refs={refs} targetRecs={targetRecs} f={f} level={page==='region'?'region':'board'}/>{page==='region'?<><ChildPerformanceHighlights rows={highlightRows} level="Local Board"/><ChildPerformanceHighlights rows={highlightRows} level="REC"/></>:<ChildPerformanceHighlights rows={highlightRows} level="REC"/>}<div className="grid2"><CompareChart title="Theme Performance — Pre vs Post" data={compareGroup(rows,'ThemeID').map(x=>({label:labelTheme(x.key),pre:x.pre,post:x.post}))}/><CompareChart title="Dimension Performance — Pre vs Post" data={compareGroup(rows,'DimensionID').map(x=>({label:labelDim(x.key),pre:x.pre,post:x.post}))}/></div><Chart title="Assessment Performance — Pre vs Post" data={group(rows,'Assessment').map(x=>({label:x.key,value:x.p}))}/><WayForward rows={rows} scope={page} f={f}/></>}
function ChildPerformanceHighlights({rows,level}:{rows:Rec[];level:'Local Board'|'REC'}){
 const key=level==='Local Board'?'LocalBoard':'REC';const map=new Map<string,Rec[]>();
 rows.filter(r=>r[key]).forEach(r=>{const id=level==='Local Board'?[norm(r.Region),norm(r.LocalBoard)].join('||'):[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');if(!map.has(id))map.set(id,[]);map.get(id)!.push(r)});
 const ranked=[...map.values()].map(rs=>({rows:rs,name:level==='Local Board'?displayGeo(rs[0].LocalBoard)+' · '+displayGeo(rs[0].Region):displayGeo(rs[0].REC)+' · '+displayGeo(rs[0].LocalBoard),overall:stageAggregate(rs,'Post').p})).filter(x=>stageAggregate(x.rows,'Post').max>0).sort((a,b)=>b.overall-a.overall);
 return <HighlightTable title={level+' Performance Highlights'} items={[{label:'Top-performing '+level.toLowerCase(),item:ranked[0]},{label:level+' needing most support',item:ranked[ranked.length-1]}]}/>
}
function count(rows:Rec[],item:string,pt:string,key:'Region'|'LocalBoard'|'REC'|'ThemeID'|'DimensionID'){return new Set(rows.filter(r=>r.ParticipantType===pt&&norm(r[key])===item).map(r=>r.RecordID)).size}
function RecAnalysis({rows,all,f,metricRows,phase3Rows,refs,targetRecs}:{rows:Rec[];all:Rec[];f:any;metricRows:Rec[];phase3Rows:Rec[];refs:Ref[];targetRecs:any[]}){return <><Kpis rows={rows} metricRows={metricRows} phase3Rows={phase3Rows} f={f} refs={refs}/><ThemeWiseRecCoverage records={all} refs={refs} targetRecs={targetRecs} f={f}/><div className="grid2"><CompareChart title="Theme Performance — Pre vs Post" data={compareGroup(rows,'ThemeID').map(x=>({label:labelTheme(x.key),pre:x.pre,post:x.post}))}/><CompareChart title="Dimension Performance — Pre vs Post" data={compareGroup(rows,'DimensionID').map(x=>({label:labelDim(x.key),pre:x.pre,post:x.post}))}/></div><Chart title="Assessment Performance — Pre vs Post" data={group(rows,'Assessment').map(x=>({label:x.key,value:x.p}))}/><WayForward rows={rows} scope="rec" f={f}/></>}
function assessmentIs(value:string,stage:'Pre'|'Post'){
 const a=norm(value).toLowerCase().replace(/[^a-z]/g,'');
 const target=stage.toLowerCase();
 return a===target||a.startsWith(target);
}
function stageAggregate(rows:Rec[],stage:'Pre'|'Post'){return aggregate(rows.filter(r=>assessmentIs(r.Assessment,stage)))}
function RubricDetailTable({rows,title}:{rows:Rec[];title:string}){
 const ids=unique(rows,'IndicatorID');
 return <section className="card rubric-detail"><h3>{title}</h3><div className="table-wrap"><table><thead><tr><th>Rubric / Indicator</th><th>Participant Type</th><th>Overall</th><th>Pre</th><th>Post</th><th>Records</th></tr></thead><tbody>{ids.flatMap(id=>['Student','Teacher'].map(pt=>{const subset=rows.filter(r=>norm(r.IndicatorID)===id&&r.ParticipantType===pt);if(!subset.length)return null;const pre=stageAggregate(subset,'Pre'),post=stageAggregate(subset,'Post');return <tr key={id+'-'+pt}><td><strong>{id}</strong> — {rubricDescription(id)}</td><td>{pt}</td><td>{fmt(aggregate(subset).p)}</td><td>{pre.max?fmt(pre.p):'—'}</td><td>{post.max?fmt(post.p):'—'}</td><td>{subset.length}</td></tr>})).filter(Boolean)}</tbody></table></div></section>
}
function ThemeAnalysis({rows}:{rows:Rec[]}){
 const themes=['T1','T2','T3','T4'];const studentRows=rows.filter(r=>r.ParticipantType==='Student');const teacherRows=rows.filter(r=>r.ParticipantType==='Teacher');
 return <><section className="card"><h2>Theme Performance</h2><div className="table-wrap"><table><thead><tr><th>Theme</th><th>Students</th><th>Teachers</th><th>Overall</th><th>UA</th><th>A</th><th>Pre</th><th>Post</th></tr></thead><tbody>{themes.map(t=>{const subset=rows.filter(r=>norm(r.ThemeID)===t),pre=stageAggregate(subset,'Pre'),post=stageAggregate(subset,'Post');return <tr key={t}><td>{labelTheme(t)}</td><td>{count(rows,t,'Student','ThemeID')}</td><td>{count(rows,t,'Teacher','ThemeID')}</td><td>{fmt(aggregate(subset).p)}</td><td>{fmt(aggregate(subset.filter(r=>r.DimensionID==='UA')).p)}</td><td>{fmt(aggregate(subset.filter(r=>r.DimensionID==='A')).p)}</td><td>{pre.max?fmt(pre.p):'—'}</td><td>{post.max?fmt(post.p):'—'}</td></tr>})}</tbody></table></div></section><div className="grid2"><CompareChart title="Students — Theme Pre vs Post" data={themes.map(t=>({label:labelTheme(t),pre:stageAggregate(studentRows.filter(r=>norm(r.ThemeID)===t),'Pre').p,post:stageAggregate(studentRows.filter(r=>norm(r.ThemeID)===t),'Post').p}))}/><CompareChart title="Teachers — Theme Pre vs Post" data={themes.map(t=>({label:labelTheme(t),pre:stageAggregate(teacherRows.filter(r=>norm(r.ThemeID)===t),'Pre').p,post:stageAggregate(teacherRows.filter(r=>norm(r.ThemeID)===t),'Post').p}))}/></div><GeoPerformanceInsights rows={rows} mode="theme"/>{themes.filter(t=>unique(rows,'ThemeID').includes(t)).map(t=><RubricDetailTable key={t} title={labelTheme(t)+' — Rubric Details'} rows={rows.filter(r=>norm(r.ThemeID)===t)}/>)}</>
}
function DimensionAnalysis({rows}:{rows:Rec[]}){
 const themes=['T1','T2','T3','T4'];const dimThemeData=themes.flatMap(t=>['UA','A'].map(dim=>{const rs=rows.filter(r=>norm(r.ThemeID)===t&&norm(r.DimensionID)===dim);return {label:labelTheme(t).split(' — ')[0]+' '+dim,pre:stageAggregate(rs,'Pre').p,post:stageAggregate(rs,'Post').p}}));
 return <><section className="card"><h2>Dimension Performance</h2><div className="table-wrap"><table><thead><tr><th>Dimension</th><th>Students</th><th>Overall</th><th>Pre</th><th>Post</th></tr></thead><tbody>{['UA','A'].map(d=>{const subset=rows.filter(r=>norm(r.DimensionID)===d),pre=stageAggregate(subset,'Pre'),post=stageAggregate(subset,'Post');return <tr key={d}><td>{labelDim(d)}</td><td>{count(rows,d,'Student','DimensionID')}</td><td>{fmt(aggregate(subset).p)}</td><td>{pre.max?fmt(pre.p):'—'}</td><td>{post.max?fmt(post.p):'—'}</td></tr>})}</tbody></table></div></section><div className="grid2"><CompareChart title="Theme × Dimension Performance — Pre vs Post" data={dimThemeData}/><CompareChart title="Dimension Performance — Pre vs Post" data={['UA','A'].map(d=>{const rs=rows.filter(r=>norm(r.DimensionID)===d);return {label:labelDim(d),pre:stageAggregate(rs,'Pre').p,post:stageAggregate(rs,'Post').p}})}/></div><GeoPerformanceInsights rows={rows} mode="dimension"/>{['UA','A'].map(d=><RubricDetailTable key={d} title={labelDim(d)+' — Rubric Details'} rows={rows.filter(r=>norm(r.DimensionID)===d)}/>)}</>
}
function PrePost({rows}:{rows:Rec[]}){
 const themes=['T1','T2','T3','T4'];const byParticipant=(pt:string)=>themes.map(t=>{const rs=rows.filter(r=>r.ParticipantType===pt&&norm(r.ThemeID)===t);return {label:labelTheme(t),pre:stageAggregate(rs,'Pre').p,post:stageAggregate(rs,'Post').p}});
 return <><section className="card"><h2>Overall Pre / Post</h2><div className="table-wrap"><table><thead><tr><th>Measure</th><th>Pre</th><th>Post</th><th>Change</th></tr></thead><tbody>{[{label:'Overall',pt:''},{label:'Students',pt:'Student'},{label:'Teachers',pt:'Teacher'}].map(x=>{const subset=x.pt?rows.filter(r=>r.ParticipantType===x.pt):rows;const p=stageAggregate(subset,'Pre').p,q=stageAggregate(subset,'Post').p;return <tr key={x.label}><td>{x.label}</td><td>{fmt(p)}</td><td>{fmt(q)}</td><td className={q-p>=0?'positive':'negative'}>{(q-p>=0?'+':'')+(q-p).toFixed(1)} pp</td></tr>})}</tbody></table></div></section><div className="grid2"><CompareChart title="Students — Pre vs Post by Theme" data={byParticipant('Student')}/><CompareChart title="Teachers — Pre vs Post by Theme" data={byParticipant('Teacher')}/></div><GeoPerformanceInsights rows={rows} mode="stage"/></>
}
function GeoPerformanceInsights({rows,mode}:{rows:Rec[];mode:'dimension'|'stage'|'theme'}){
 const levels=[{label:'Region',key:'Region' as const},{label:'Local Board',key:'LocalBoard' as const},{label:'REC',key:'REC' as const}];
 const criteria=mode==='dimension'?[{id:'UA',label:'UA — Understanding / Articulation'},{id:'A',label:'A — Application'}]:mode==='stage'?[{id:'Pre',label:'Pre assessment'},{id:'Post',label:'Post assessment'}]:[{id:'T1',label:'Theme 1'},{id:'T2',label:'Theme 2'},{id:'T3',label:'Theme 3'},{id:'T4',label:'Theme 4'}];
 const subsetFor=(rs:Rec[],criterion:string)=>mode==='dimension'?rs.filter(r=>norm(r.DimensionID)===criterion):mode==='stage'?rs.filter(r=>assessmentIs(r.Assessment,criterion as 'Pre'|'Post')):rs.filter(r=>norm(r.ThemeID)===criterion);
 const rank=(key:'Region'|'LocalBoard'|'REC',criterion:string)=>{const map=new Map<string,Rec[]>();rows.filter(r=>norm(r[key])).forEach(r=>{const id=key==='Region'?norm(r.Region):key==='LocalBoard'?[norm(r.Region),norm(r.LocalBoard)].join('||'):[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');if(!map.has(id))map.set(id,[]);map.get(id)!.push(r)});return [...map.values()].map(rs=>{const filtered=subsetFor(rs,criterion);return {name:key==='Region'?displayGeo(rs[0].Region):key==='LocalBoard'?displayGeo(rs[0].LocalBoard)+' · '+displayGeo(rs[0].Region):displayGeo(rs[0].REC)+' · '+displayGeo(rs[0].LocalBoard),rows:filtered,p:filtered.length?aggregate(filtered).p:-1}}).filter(x=>x.p>=0).sort((a,b)=>b.p-a.p)};
 const actionFor=(rs:Rec[])=>{const weakDim=unique(rs,'DimensionID').map(id=>({id,p:aggregate(rs.filter(r=>norm(r.DimensionID)===id)).p})).sort((a,b)=>a.p-b.p)[0];const weakTheme=unique(rs,'ThemeID').map(id=>({id,p:aggregate(rs.filter(r=>norm(r.ThemeID)===id)).p})).sort((a,b)=>a.p-b.p)[0];if(weakTheme)return 'Way forward: plan targeted learning activities for '+labelTheme(weakTheme.id)+'. '+rubricAction(unique(rs.filter(r=>norm(r.ThemeID)===weakTheme.id),'IndicatorID')[0]||'',weakTheme.id,weakDim?.id||'UA');if(weakDim)return 'Way forward: strengthen '+labelDim(weakDim.id)+' through guided practice, concrete examples and a follow-up assessment.';return 'Maintain current practice and monitor progress in the next cycle.'};
 return <section className="card"><h2>{mode==='dimension'?'UA and A — Top and Weak Geography':mode==='stage'?'Pre and Post — Top and Weak Geography':'Theme-wise — Top and Weak Geography'}</h2><p>Rankings reflect the currently selected dashboard filters. Suggested actions target the weakest available theme or dimension.</p>{levels.map(level=><div key={level.key} className="table-wrap" style={{marginTop:16}}><h3>{level.label}</h3><table><thead><tr><th>Measure</th><th>Top performing</th><th>Score</th><th>Needs most support</th><th>Score</th><th>Way forward</th></tr></thead><tbody>{criteria.map(criterion=>{const ranked=rank(level.key,criterion.id);const top=ranked[0],weak=ranked[ranked.length-1];return <tr key={criterion.id}><td>{criterion.label}</td><td className={top?'performance-top':''}>{top?.name||'Not available'}</td><td className={top?'performance-top':''}>{top?fmt(top.p):'—'}</td><td className={weak?'performance-weak':''}>{weak?.name||'Not available'}</td><td className={weak?'performance-weak':''}>{weak?fmt(weak.p):'—'}</td><td>{weak?actionFor(weak.rows):'Insufficient matching data'}</td></tr>})}</tbody></table></div>)}</section>;
}
function RecSurveySummary({records,participantType,region,board,rec,onRefresh}:{records:Rec[];participantType:string;region:string;board:string;rec:string;onRefresh?:()=>void}) {
  if (!region || !board || !rec) return <section className="card"><h3>REC Assessment Summary</h3><p>Select a Region, Local Board and REC to review existing assessment data before entering new data.</p></section>;
  const canonical=(v:any)=>norm(v).trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  const same=(a:any,b:any)=>canonical(a)===canonical(b);
  const themeKey=(v:any)=>{const x=canonical(v).toUpperCase();const m=x.match(/(?:^|\b)(?:T|THEME\s*)([1-4])(?:\b|$)/);return m?'T'+m[1]:x;};
  const stageKey=(v:any)=>{const x=canonical(v);if(/^(pre|pre assessment|baseline)$/.test(x))return 'Pre';if(/^(post|post assessment|endline)$/.test(x))return 'Post';return x;};
  const rows=records.filter(r=>same(r.ParticipantType,participantType)&&same(r.Region,region)&&same(r.LocalBoard,board)&&same(r.REC,rec));
  const stageRows=(theme:string,stage:string)=>rows.filter(r=>themeKey(r.ThemeID)===theme&&stageKey(r.Assessment)===stage);
  const pctRows=(items:Rec[])=>{const score=items.reduce((n,r)=>n+(Number(r.Score)||0),0);const max=items.reduce((n,r)=>n+(Number(r.MaxScore)||0),0);return max?(score/max*100).toFixed(1)+'%':'—'};
  return <section className="card"><div className="section-head"><div><h3>Existing REC Summary — {rec}</h3><p><strong>Consolidated assessment scores</strong> · Scores combine the saved records for this REC.</p></div>{onRefresh&&<button type="button" className="secondary" onClick={onRefresh}>↻ Refresh existing data</button>}</div>{rows.length===0?<p>{records.length===0?'No assessment records are currently loaded. Refresh existing data to retry loading, then check that the selected Region, Local Board and REC match the saved records.':'No matching '+participantType.toLowerCase()+' assessment records were found for this REC in the loaded data. Check the selected details and refresh if needed.'}</p>:<><div className="table-wrap"><table><thead><tr><th>Theme</th><th>Pre</th><th>Post</th><th>Data status</th></tr></thead><tbody>{['T1','T2','T3','T4'].map(theme=>{const pre=stageRows(theme,'Pre');const post=stageRows(theme,'Post');return <tr key={theme}><td>{labelTheme(theme)}</td><td>{pctRows(pre)}</td><td>{pctRows(post)}</td><td>{pre.length||post.length?'Data available':'No data in loaded records'}</td></tr>})}</tbody></table></div><p className="form-message">“Data available” reflects saved score records only; it is not a completion marker.</p></>}</section>;
}
function GeoFields({refs,value,onChange,afterRec}:{refs:Ref[];value:any;onChange:(x:any)=>void;afterRec?:React.ReactNode}){const regions=uniqueGeoValues(refs.map(r=>r.Region));const boards=uniqueGeoValues(refs.filter(r=>geoNorm(r.Region)===geoNorm(value.region)).map(r=>r.LocalBoard));const recs=uniqueGeoValues(refs.filter(r=>geoNorm(r.Region)===geoNorm(value.region)&&geoNorm(r.LocalBoard)===geoNorm(value.board)).map(r=>r.REC));return <div className="survey-grid"><Field label="Region" required><select value={value.region} onChange={e=>onChange({...value,region:e.target.value,board:'',rec:''})}><option value="">Select region</option>{regions.map(x=><option key={x} value={x}>{displayGeo(x)}</option>)}</select></Field><Field label="Local Board" required><select value={value.board} disabled={!value.region} onChange={e=>onChange({...value,board:e.target.value,rec:''})}><option value="">Select Local Board</option>{boards.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="REC" required><select value={value.rec} disabled={!value.board} onChange={e=>onChange({...value,rec:e.target.value})}><option value="">Select REC</option>{recs.map(x=><option key={x}>{x}</option>)}</select>{afterRec}</Field></div>}
function Field({label,required,children,wide}:{label:string;required?:boolean;children:React.ReactNode;wide?:boolean}){return <label className={wide?'field wide':'field'}><span>{label}{required&&<em> *</em>}</span>{children}</label>}
function useSurveyState(key:string,initial:any){const [v,setV]=useState<any>(()=>{try{return JSON.parse(localStorage.getItem(key)||'null')||initial}catch{return initial}});useEffect(()=>{localStorage.setItem(key,JSON.stringify(v))},[key,v]);return [v,setV] as const}

function StudentSurvey({ refs, user, records = [], onRefresh }: { refs: Ref[]; user: AppUser | null; records?: Rec[]; onRefresh?:()=>void }) {
  const [showRecSummary,setShowRecSummary]=useState(false);
  const initial: any = {
    region: '',
    board: '',
    rec: '',
    cycle: 'Cycle 1',
    childName: '',
    gender: '',
    designation: '',
    otherDesignation: '',
    theme: '',
    assessment: 'Pre',
    themes: {}
  };

  const [v, setV] = useSurveyState('kgii_student_survey_draft', initial);
  const cycle = v.cycle || 'Cycle 1';
  const phase = cycle === 'Cycle 2' ? 'Phase 3' : '';
  const [entryStarted, setEntryStarted] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  
const [lookupLoading, setLookupLoading] = useState(false);
const [lookupMatches, setLookupMatches] = useState<any[]>([]);
const [lookupMsg, setLookupMsg] = useState('');

const lookupChild = async () => {
  if (!v.region || !v.board || !v.rec || !v.childName?.trim()) {
    setLookupMatches([]);
    setLookupMsg('');
    return;
  }

  setLookupLoading(true);
  setLookupMsg('');

  try {
    const result = await apiPost('lookupsurvey', {
      userEmail: user?.email || sessionStorage.getItem('userEmail') || '',
      participantType: 'Student',
      region: v.region,
      localBoard: v.board,
      rec: v.rec,
      cycleID: v.cycle || 'Cycle 1',
      childName: v.childName.trim()
    });

    const matches = Array.isArray(result.matches) ? result.matches : [];
    setLookupMatches(matches);

    setLookupMsg(
  matches.length
    ? `Found ${matches.length} previous submission(s). Indicator ratings are shown below.`
    : 'No previous submissions found for this child in this REC.'
);
  } catch (e: any) {
    setLookupMatches([]);
    setLookupMsg(`Lookup failed: ${e.message || 'Please try again.'}`);
  } finally {
    setLookupLoading(false);
  }
};


  const update = (x: any) => { if (x.region !== v.region || x.board !== v.board || x.rec !== v.rec) setEntryStarted(false); setV(x); };

  
const save = async (finishAssessment: boolean) => {
  const assessment = cycle === 'Cycle 2' ? 'Pre' : (v.assessment || 'Pre');
  const themeState = v.themes[v.theme] || {
    activities: [],
    otherActivity: '',
    ratings: {},
    remarks: ''
  };

  const questions = (studentIndicators as any)[v.theme] || [];
  const indicatorKeys = studentIndicatorKeys[v.theme] || [];

  if (!v.theme) {
    setMsg('Please select a theme before saving.');
    return;
  }

  const missing = questions.some(
    (_: string, i: number) => !themeState.ratings[i]
  );

  if (
    !(
      v.region &&
      v.board &&
      v.rec &&
      v.childName?.trim() &&
      v.gender &&
      v.designation?.trim() &&
      assessment
    ) ||
    missing
  ) {
    setMsg(
      'Please complete all required information and rate each indicator.'
    );
    return;
  }

  if (indicatorKeys.length !== questions.length) {
    setMsg(
      'Indicator mapping error. Please contact the app administrator.'
    );
    return;
  }

  const themeName = surveyThemeName(v.theme);

  const duplicate = lookupMatches.some(
    item => {
      const itemCycle = norm(item.cycleID || item.CycleID || item.cycle) || 'Cycle 1';
      return itemCycle === cycle &&
        String(item.themeName || '').trim().toLowerCase() ===
          themeName.trim().toLowerCase() &&
        String(item.assessment || '').trim().toLowerCase() ===
          assessment.toLowerCase();
    }
  );

  if (duplicate) {
    setMsg(
      `A saved ${assessment} submission already exists for ${themeName}. Review the previous submission before proceeding.`
    );
    return;
  }

  setSaving(true);
  setMsg('');

  try {
    const indicatorRatings: Record<string, number> = {};

    indicatorKeys.forEach((key, i) => {
      const score = studentScore(
        String(themeState.ratings[i] || '')
      );

      if (score > 0) {
        indicatorRatings[key] = score;
      }
    });

    const result = await apiPost('studentsurvey', {
      userEmail: user?.email || '',
      region: v.region,
      localBoard: v.board,
      rec: v.rec,
      cycleID: cycle,
      phase,
      childName: v.childName.trim(),
      childGender: v.gender,
      assessorDesignation: v.designation.trim(),
      otherDesignation: v.otherDesignation || '',
      themeID: v.theme,
      themeName,
      assessment,
      activity: (themeState.activities || []).join(', '),
      otherActivity: themeState.otherActivity || '',
      indicatorRatings,
      remarks: themeState.remarks || ''
    });

    if(result?.queuedOffline){setMsg('Saved on this device while offline. Keep this app installed/opened on this device; it will try to sync when internet returns.');return;}

    setLookupMatches(previous => [
      ...previous,
      {
        submissionId: result.submissionId || '',
        name: v.childName.trim(),
        themeName,
        assessment,
        cycleID: cycle,
        phase,
        submittedAt: new Date().toISOString()
      }
    ]);

    if (finishAssessment) {
      sessionStorage.removeItem('kgii_student_survey_draft');
      setV(initial);
      setLookupMatches([]);
      setLookupMsg('');
      setMsg('Student assessment submitted successfully.');
    } else {
      setV({
        ...v,
        theme: '',
        themes: {
          ...v.themes,
          [v.theme]: {
            activities: [],
            otherActivity: '',
            ratings: {},
            remarks: ''
          }
        }
      });

      setMsg(
        `${themeName} (${assessment}) saved successfully. Select another theme to continue.`
      );
    }
  } catch (e: any) {
    setMsg(
      `Submission failed: ${e.message || 'Please try again.'}`
    );
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="survey-page">
      <section className="card">
        <div className="section-head survey-print-head">
          <div>
            <h2>Student Survey</h2>
            <p>
              Complete the child assessment survey. Evidence upload is not
              included.
            </p>
          </div>
          <button type="button" className="secondary print-action" onClick={()=>window.print()}>Print / Save PDF</button>
        </div>

        <div className="survey-print-complete">
          <h2>Complete Student Survey — All Themes and Indicators</h2>
          {(['T1','T2','T3','T4'] as const).map((theme) => (
            <section className="survey-print-theme" key={theme}>
              <h3>Theme {theme.slice(1)} — {surveyThemeName(theme)}</h3>
              <ol>
                {(studentIndicators as any)[theme].map((question: string, index: number) => (
                  <li key={index}>{question}<div className="survey-print-response">Rating: ____________________</div></li>
                ))}
              </ol>
              <p><strong>Activities used:</strong> ______________________________________________</p>
              <p><strong>Other activity:</strong> __________________________________________________</p>
              <p><strong>Remarks:</strong> _______________________________________________________</p>
            </section>
          ))}
        </div>

        <GeoFields refs={refs} value={v} onChange={update} />
        <div className="summary-action-row"><button type="button" className="primary" disabled={!v.region||!v.board||!v.rec} onClick={()=>{setShowRecSummary(true);onRefresh?.();}}>View REC Summary</button></div>{showRecSummary&&<RecSurveySummary records={records} participantType="Student" region={v.region} board={v.board} rec={v.rec} onRefresh={onRefresh} />}
        {v.rec && !entryStarted && <div className="form-actions"><button type="button" className="primary" onClick={() => setEntryStarted(true)}>Continue Data Entry</button></div>}
        {entryStarted && <>
        <div className="survey-grid">
          
<Field label="Name of Child" required>
  <input
    value={v.childName}
    onChange={e => {
      update({ ...v, childName: e.target.value });
      setLookupMatches([]);
      setLookupMsg('');
    }}
    onBlur={lookupChild}
  />
</Field>





{lookupMatches.length > 0 && (
  <div className="card">
    <h3>Previous Submissions</h3>

    {lookupMatches.map((item, index) => (
      <div
        key={`${item.submissionId || 'record'}-${index}`}
        style={{
          borderBottom: '1px solid #ddd',
          padding: '12px 0'
        }}
      >
        <strong>{item.name}</strong>

        <p>
          Theme: {item.themeName || 'Not recorded'} ·
          Stage: {item.assessment || 'Not recorded'}
        </p>

        
{item.ratings && (() => {
  const themeMatch = String(item.themeName || '').match(/Theme\s*(\d+)/i);
  const themeNumber = themeMatch
    ? themeMatch[1]
    : String(item.themeID || '').replace(/\D/g, '');

  const ratings = Object.entries(item.ratings).filter(
    ([indicator]) =>
      !themeNumber || indicator.startsWith(`Theme${themeNumber}:`)
  );

  return ratings.length > 0 ? (
    <div className="previous-ratings">
      <strong>Indicator Ratings</strong>

      {ratings.map(([indicator, rating]) => (
        <div key={indicator} className="previous-rating-row">
          <span>{indicator}</span>
          <strong>{String(rating)}</strong>
        </div>
      ))}
    </div>
  ) : null;
})()}


        <p>
          Submitted: {item.submittedAt || 'Date unavailable'}
        </p>
      </div>
    ))}
  </div>
)}




          <Field label="Child's Gender" required>
            <select
              value={v.gender}
              onChange={e => update({ ...v, gender: e.target.value })}
            >
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </Field>




{lookupMsg && (
  <p className="form-message">{lookupMsg}</p>
)}

          <Field label="Designation of person assessing the child" required>
            <input
              value={v.designation}
              onChange={e => update({ ...v, designation: e.target.value })}
            />
          </Field>

          <Field label="If other, please specify designation">
            <input
              value={v.otherDesignation}
              onChange={e =>
                update({ ...v, otherDesignation: e.target.value })
              }
            />
          </Field>

          <Field label="Cycle" required>
            <select value={v.cycle || 'Cycle 1'} onChange={e => update({ ...v, cycle: e.target.value })}>
              <option value="Cycle 1">Cycle 1</option>
              <option value="Cycle 2">Cycle 2</option>
            </select>
          </Field>
          {cycle === 'Cycle 2' && <Field label="Phase"><input value={phase} readOnly /></Field>}

          <Field label="Select Theme" required>
            <select
              value={v.theme}
              onChange={e => update({ ...v, theme: e.target.value })}
            >
              <option value="">Select theme</option>
              {['T1', 'T2', 'T3', 'T4'].map(t => (
                <option key={t} value={t}>
                  {labelTheme(t)}
                </option>
              ))}
            </select>
          </Field>

          {cycle !== 'Cycle 2' && <Field label="Assessment Stage" required>
            <select
              value={v.assessment || 'Pre'}
              onChange={e =>
                update({ ...v, assessment: e.target.value })
              }
            >
              <option value="Pre">Pre</option>
              <option value="Post">Post</option>
            </select>
          </Field>}
        </div>
      

      {v.theme && (
        <StudentTheme
          theme={v.theme}
          index={Number(v.theme.slice(1))}
          state={
            v.themes[v.theme] || {
              activities: [],
              otherActivity: '',
              ratings: {},
              remarks: ''
            }
          }
          setState={(x: any) =>
            update({
              ...v,
              themes: { ...v.themes, [v.theme]: x }
            })
          }
        />
      )}

      

<div className="form-actions">
  <button
    type="button"
    className="secondary"
    onClick={() => save(false)}
    disabled={saving}
  >
    {saving ? 'Saving…' : 'Save & Add Another Theme'}
  </button>

  <button
    type="button"
    className="primary"
    onClick={() => save(true)}
    disabled={saving}
  >
    {saving ? 'Saving…' : 'Submit Assessment'}
  </button>

  {msg && <span className="form-message">{msg}</span>}
</div>
        </>}
      </section>
</div>
);
}


function StudentTheme({theme,index,state,setState}:{theme:string;index:number;state:any;setState:(x:any)=>void}){const acts=studentActivities[theme];const toggle=(a:string)=>setState({...state,activities:state.activities.includes(a)?state.activities.filter((x:string)=>x!==a):[...state.activities,a]});return <section className="card survey-theme"><h2>Theme {index}</h2><Field label="Activities used"><div className="check-grid">{acts.map((a:string)=><label className="check" key={a}><input type="checkbox" checked={state.activities.includes(a)} onChange={()=>toggle(a)}/><span>{a}</span></label>)}</div></Field>{state.activities.includes('any other')||state.activities.includes('Any other')?<Field label="Please specify other activity"><input value={state.otherActivity||''} onChange={e=>setState({...state,otherActivity:e.target.value})}/></Field>:null}<div className="indicator-list">{(studentIndicators as any)[theme].map((q:string,i:number)=><div className="indicator" key={i}><div><b>{i+1}.</b> {q}</div><select value={state.ratings[i]||''} onChange={e=>setState({...state,ratings:{...state.ratings,[i]:e.target.value}})}><option value="">Select rating</option>{rating3.map(r=><option key={r}>{r}</option>)}</select></div>)}</div><Field label={`Remarks on Theme ${index}`}><textarea rows={4} value={state.remarks||''} onChange={e=>setState({...state,remarks:e.target.value})}/></Field></section>}


const teacherAssessmentSkills = [
  { key: 'instructional', title: 'Skill 1 · Instructional Skills', indicators: [
    { label: 'Gains attention first', levels: ['Begins to gain children’s attention before giving an instruction.', 'Sometimes gains children’s attention before giving an instruction.', 'Often gains children’s attention and prepares them before giving an instruction.', 'Always gains children’s attention and makes them fully ready before giving an instruction.'] },
    { label: 'Uses simple, clear, age-appropriate language', levels: ['Begins to use simple words that children understand.', 'Sometimes uses simple, familiar words that children understand.', 'Often uses simple, familiar, age-appropriate words that children follow.', 'Always uses simple, familiar, age-appropriate words that children follow with ease.'] },
    { label: 'Gives one instruction at a time', levels: ['Begins to give instructions one at a time.', 'Sometimes gives one instruction at a time.', 'Often gives one instruction at a time, with pauses.', 'Always gives one instruction at a time using speak–do–pause.'] },
    { label: 'Gives wait time after instructions', levels: ['Begins to pause after an instruction so children can respond.', 'Sometimes pauses after an instruction so children can think and act.', 'Often pauses after an instruction and waits for children to begin responding.', 'Always pauses after every instruction and waits until children listen, reflect and respond.'] }
  ]},
  { key: 'questioning', title: 'Skill 2 · Questioning Skills', indicators: [
    { label: 'Uses different types of questions', levels: ['Begins to ask questions beyond recall.', 'Sometimes uses two types of questions, such as recall and understanding.', 'Often uses three types of questions.', 'Always uses all four types (recall, understanding, probing, connecting) with purpose.'] },
    { label: 'Identifies question types', levels: ['Begins to identify the types of questions.', 'Sometimes identifies one or two question types correctly.', 'Often identifies most question types correctly.', 'Always identifies all four question types and gives an example of each.'] },
    { label: 'Asks clear, age-appropriate questions', levels: ['Begins to ask clear questions that children understand.', 'Sometimes asks clear questions, and rewords them when needed.', 'Often asks clear questions that suit children’s age.', 'Always asks clear, age-appropriate questions that children answer with ease.'] },
    { label: 'Questions make children think', levels: ['Begins to ask questions that go beyond short fact answers.', 'Sometimes asks questions that make children explain or share ideas.', 'Often asks questions that make children explain their thinking.', 'Always asks questions that lead children to give reasons and connect to real life.'] }
  ]},
  { key: 'feedback', title: 'Skill 3 · Feedback Skills', indicators: [
    { label: 'Acknowledges children’s responses', levels: ['Begins to acknowledge children’s responses beyond saying right or wrong.', 'Sometimes acknowledges children’s responses.', 'Often acknowledges children’s responses.', 'Always acknowledges every response so children feel heard.'] },
    { label: 'Clarifies and guides thinking', levels: ['Begins to ask follow-up questions after children’s answers.', 'Sometimes asks follow-up questions to help children explain.', 'Often asks follow-up questions that help children explain and clarify.', 'Always guides children to explain and refine their ideas.'] },
    { label: 'Extends and connects', levels: ['Begins to link children’s ideas to other situations.', 'Sometimes links the idea to home or friends.', 'Often asks children to connect the idea to other situations.', 'Always connects ideas to real life, and children apply them.'] },
    { label: 'Responds well to incorrect answers', levels: ['Begins to respond kindly when an answer is incorrect.', 'Sometimes respects the answer and corrects it politely.', 'Often respects the answer and offers guidance to improve it.', 'Always respects the answer and guides the child to improve it.'] }
  ]}
] as const;

function teacherSkillLevel(total: number) {
  if (total >= 14) return 'Flourishing';
  if (total >= 11) return 'Maturing';
  if (total >= 8) return 'Growing';
  if (total >= 4) return 'Seeding';
  return 'Not scored';
}

function TeacherCycle2Form({ value, onChange, user, onRefresh }: { value: any; onChange: (x: any) => void; user: AppUser | null; onRefresh?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const ratings = value.skillRatings || {};
  const notes = value.skillNotes || {};
  const summaries = teacherAssessmentSkills.map(skill => {
    const score = (ratings[skill.key] || []).reduce((sum: number, item: any) => sum + (Number(item) || 0), 0);
    return { ...skill, score, level: teacherSkillLevel(score) };
  });
  const setField = (key: string, fieldValue: any) => onChange({ ...value, [key]: fieldValue });
  const setRating = (skill: string, index: number, score: string) => {
    const current = [...(ratings[skill] || [])];
    current[index] = score ? Number(score) : '';
    setField('skillRatings', { ...ratings, [skill]: current });
  };
  const setNote = (skill: string, note: string) => setField('skillNotes', { ...notes, [skill]: note });

  const submit = async () => {
    const assessmentDate = value.assessmentDate || new Date().toISOString().slice(0, 10);
    if (!value.teacherName?.trim() || !value.positions?.length || !value.years || !value.training || (value.training === 'other' && !value.otherTraining?.trim()) || !value.filler?.trim() || !value.assessmentStage) {
      setMsg('Please complete the required teacher and training details and select Pre or Post.');
      return;
    }
    if (teacherAssessmentSkills.some(skill => (ratings[skill.key] || []).length !== 4 || (ratings[skill.key] || []).some((score: any) => ![1, 2, 3, 4].includes(Number(score))))) {
      setMsg('Please select a rating for each of the 12 indicators.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const skillTotals = Object.fromEntries(summaries.map(skill => [skill.key, skill.score]));
      const skillLevels = Object.fromEntries(summaries.map(skill => [skill.key, skill.level]));
      const result = await apiPost('teachersurvey', {
        userEmail: user?.email || '',
        participantType: 'Teacher',
        cycleID: 'Cycle 2',
        phase: 'Phase 3',
        assessmentTool: 'Teacher Assessment Rubrics',
        assessment: value.assessmentStage,
        region: value.region,
        localBoard: value.board,
        rec: value.rec,
        teacherName: value.teacherName.trim(),
        teacherPosition: value.positions.join(', '),
        otherPosition: value.positions.includes('Other') ? 'Other' : '',
        yearsTeaching: value.years,
        trainingAttended: value.training,
        otherTraining: value.otherTraining || '',
        fillerName: value.filler.trim(),
        fillerDesignation: '',
        skillRatings: ratings,
        skillTotals,
        skillLevels,
        mentorNotes: notes
      });
      if (result?.queuedOffline) {
        setMsg('Assessment saved on this device while offline. It will try to sync when internet returns.');
        return;
      }
      setMsg('Teacher assessment summary submitted successfully.');
      onRefresh?.();
    } catch (error: any) {
      setMsg('Submission failed: ' + (error.message || 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return <section className="card teacher-cycle2-assessment">
    <div className="rating-scale"><strong>Rating scale</strong><span>1 · Seeding — begin to use the skills</span><span>2 · Growing — sometimes use the skills</span><span>3 · Maturing — often use the skills</span><span>4 · Flourishing — always use the skills</span></div>
    {teacherAssessmentSkills.map(skill => {
      const score = summaries.find(item => item.key === skill.key)?.score || 0;
      return <section className="card teacher-skill-card" key={skill.key}>
        <h3>{skill.title}</h3>
        <div className="table-wrap"><table><thead><tr><th>Indicator</th><th>1 · Seeding</th><th>2 · Growing</th><th>3 · Maturing</th><th>4 · Flourishing</th><th>Score</th></tr></thead>
          <tbody>{skill.indicators.map((indicator, index) => <tr key={indicator.label}><td><strong>{indicator.label}</strong></td>{indicator.levels.map((description, levelIndex) => <td key={levelIndex}>{description}</td>)}<td><select aria-label={skill.title + ': ' + indicator.label + ' score'} value={(ratings[skill.key] || [])[index] || ''} onChange={e => setRating(skill.key, index, e.target.value)}><option value="">Select</option>{[1, 2, 3, 4].map(level => <option key={level} value={level}>{level}</option>)}</select></td></tr>)}</tbody>
          <tfoot><tr><th colSpan={5}>Total (out of 16)</th><th>{score} / 16</th></tr></tfoot>
        </table></div>
        <Field label="Mentor’s notes and next steps"><textarea rows={3} value={notes[skill.key] || ''} onChange={e => setNote(skill.key, e.target.value)} /></Field>
      </section>;
    })}
    <div className="form-actions"><button type="button" className="primary" disabled={saving} onClick={submit}>{saving ? 'Submitting…' : 'Submit Teacher Assessment'}</button>{msg && <span className="form-message">{msg}</span>}</div>
  </section>;
}

function TeacherSurvey({ refs, user, records = [], onRefresh }: { refs: Ref[]; user: AppUser | null; records?: Rec[]; onRefresh?:()=>void }) {
  const [showRecSummary,setShowRecSummary]=useState(false);
  const initial: any = {
    region: '',
    board: '',
    rec: '',
    cycle: 'Cycle 1',
    teacherName: '',
    schoolCentre: '',
    mentorName: '',
    assessmentDate: new Date().toISOString().slice(0, 10),
    skillRatings: {},
    skillNotes: {},
    positions: [],
    years: '',
    training: '',
    otherTraining: '',
    theme: '',
    ratings: { pre: '', post: '' },
    filler: ''
  };

  const [v, setV] = useSurveyState('kgii_teacher_survey_draft', initial);
  const [entryStarted, setEntryStarted] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  
const [lookupLoading, setLookupLoading] = useState(false);
const [lookupMatches, setLookupMatches] = useState<any[]>([]);
const [lookupMsg, setLookupMsg] = useState('');

const lookupTeacher = async () => {
  if (!v.region || !v.board || !v.rec || !v.teacherName?.trim()) {
    setLookupMatches([]);
    setLookupMsg(
      'Select the region, local board and REC, then enter the teacher name.'
    );
    return;
  }

  setLookupLoading(true);
  setLookupMsg('');

  try {
    const result = await apiPost('lookupsurvey', {
      userEmail: user?.email || sessionStorage.getItem('userEmail') || '',
      participantType: 'Teacher',
      region: v.region,
      localBoard: v.board,
      rec: v.rec,
      teacherName: v.teacherName.trim()
    });

    const matches = Array.isArray(result.matches)
      ? result.matches
      : [];

    setLookupMatches(matches);
    setLookupMsg(
      matches.length
        ? `Found ${matches.length} previous submission(s) for this teacher in this REC.`
        : 'No previous submissions found for this teacher in this REC.'
    );
  } catch (e: any) {
    setLookupMatches([]);
    setLookupMsg(`Lookup failed: ${e.message || 'Please try again.'}`);
  } finally {
    setLookupLoading(false);
  }
};


  
const save = async (finishAssessment: boolean) => {
  if (
    !(
      v.region &&
      v.board &&
      v.rec &&
      v.teacherName?.trim() &&
      v.positions.length &&
      v.years &&
      v.training &&
      (v.training !== 'other' || v.otherTraining?.trim()) &&
      v.theme &&
      v.ratings.pre &&
      v.ratings.post &&
      v.filler?.trim()
    )
  ) {
    setMsg('Please complete all required fields and both Pre and Post ratings.');
    return;
  }

  const themeName = surveyThemeName(v.theme);

  setSaving(true);
  setMsg('');

  try {
    // Check duplicates online when possible. Offline submissions are queued locally
    // and will be checked by the server when they sync.
    if (navigator.onLine) {
      const lookup = await apiPost('lookupsurvey', {
        userEmail: user?.email || '',
        participantType: 'Teacher',
        region: v.region,
        localBoard: v.board,
        rec: v.rec,
        teacherName: v.teacherName.trim()
      });

      const latestMatches = Array.isArray(lookup.matches) ? lookup.matches : [];
      setLookupMatches(latestMatches);
      const duplicate = latestMatches.some((item: any) =>
        String(item.themeName || '').trim().toLowerCase() === themeName.trim().toLowerCase()
      );
      if (duplicate) {
        setMsg(`A submission already exists for ${themeName} for this teacher in this REC. Please select another theme.`);
        setLookupMsg('Previous submissions have been refreshed.');
        return;
      }
    }

    const result = await apiPost('teachersurvey', {
      userEmail: user?.email || '',
      region: v.region,
      localBoard: v.board,
      rec: v.rec,
      teacherName: v.teacherName.trim(),
      cycleID: v.cycle || 'Cycle 1',
      teacherPosition: v.positions.join(', '),
      otherPosition: v.positions.includes('Other') ? 'Other' : '',
      yearsTeaching: v.years,
      trainingAttended: v.training,
      otherTraining: v.otherTraining || '',
      themeID: v.theme,
      themeName,
      preRating: teacherScore(v.ratings.pre),
      postRating: teacherScore(v.ratings.post),
      fillerName: v.filler.trim(),
      fillerDesignation: ''
    });

    if(result?.queuedOffline){setMsg('Saved on this device while offline. Keep this app installed/opened on this device; it will try to sync when internet returns.');return;}

    const savedRecord = {
      submissionId: result.submissionId || '',
      name: v.teacherName.trim(),
      themeName,
      preRating: teacherScore(v.ratings.pre),
      postRating: teacherScore(v.ratings.post),
      submittedAt: new Date().toISOString()
    };

    setLookupMatches(previous => [...previous, savedRecord]);

    if (finishAssessment) {
      sessionStorage.removeItem('kgii_teacher_survey_draft');
      setV(initial);
      setLookupMatches([]);
      setLookupMsg('');
      setMsg('Teacher assessment submitted successfully.');
    } else {
      setV({
        ...v,
        theme: '',
        ratings: { pre: '', post: '' }
      });

      setMsg(
        `${themeName} saved successfully. Select another theme to continue for the same teacher.`
      );
    }
  } catch (e: any) {
    setMsg(`Submission failed: ${e.message || 'Please try again.'}`);
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="survey-page">
      <section className="card">
        <div className="survey-title-row"><h2>Teacher Survey</h2><button type="button" className="secondary print-action" onClick={()=>window.print()}>Print / Save PDF</button></div>
        <p>
          Complete the teacher survey. Rubric descriptions are shown with
          each rating level.
        </p>
{(v.cycle || 'Cycle 1') === 'Cycle 1' && <div className="survey-print-complete">
          <h2>Complete Teacher Survey — All Themes and Pre/Post Rubrics</h2>
          {(['T1','T2','T3','T4'] as const).map((theme) => (
            <section className="survey-print-theme" key={theme}>
              <h3>Theme {theme.slice(1)} — {surveyThemeName(theme)}</h3>
              {(['pre','post'] as const).map((stage) => (
                <div className="survey-print-rubric" key={stage}>
                  <h4>{stage === 'pre' ? 'Pre-assessment rubric' : 'Post-assessment rubric'}</h4>
                  <ol>
                    {teacherRubrics[theme][stage].map((rubric: string[]) => (
                      <li key={rubric[0]}><strong>{rubric[0]}</strong><p>{rubric[1]}</p></li>
                    ))}
                  </ol>
                  <p><strong>Selected rating:</strong> ____________________</p>
                </div>
              ))}
            </section>
          ))}
        </div>}

        <GeoFields refs={refs} value={v} onChange={(x:any) => { if (x.region !== v.region || x.board !== v.board || x.rec !== v.rec) setEntryStarted(false); setV(x); }} afterRec={<div className="summary-action-row"><button type="button" className="primary" disabled={!v.region||!v.board||!v.rec} onClick={()=>{setShowRecSummary(true);onRefresh?.();}}>View REC Summary</button></div>} />

        {showRecSummary&&<RecSurveySummary records={records} participantType="Teacher" region={v.region} board={v.board} rec={v.rec} onRefresh={onRefresh} />}
        {v.rec && !entryStarted && <div className="form-actions"><button type="button" className="primary" onClick={() => setEntryStarted(true)}>Continue Data Entry</button></div>}
        {entryStarted && <div className="survey-grid">
          <Field label="Name of the person filling this form with designation" required><input value={v.filler || ''} onChange={e => setV({ ...v, filler: e.target.value })} /></Field>
          <Field label="Name of teacher" required><input value={v.teacherName || ''} onChange={e => { setV({ ...v, teacherName: e.target.value }); setLookupMatches([]); setLookupMsg(''); }} /></Field>
          <Field label="Position of teacher" required><div className="check-grid">
            {['ECED Coordinator', 'ECED Educator', 'ECED Teacher', 'Other'].map(a => <label className="check" key={a}><input type="checkbox" checked={v.positions.includes(a)} onChange={() => setV({ ...v, positions: v.positions.includes(a) ? v.positions.filter((x: string) => x !== a) : [...v.positions, a] })} /><span>{a}</span></label>)}
          </div></Field>
          <Field label="No. of years of teaching in RECs" required><select value={v.years} onChange={e => setV({ ...v, years: e.target.value })}><option value="">Select</option>{['0-1 year', '2-3 years', '3-5 years', '5-10 years', 'more than 10 years'].map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Training attended by ITREB" required><select value={v.training} onChange={e => setV({ ...v, training: e.target.value })}><option value="">Select</option>{["Teacher's training", 'refresher', 'No', 'other'].map(x => <option key={x}>{x}</option>)}</select></Field>
          {v.training === 'other' && <Field label="If other, please mention about training" required><input value={v.otherTraining} onChange={e => setV({ ...v, otherTraining: e.target.value })} /></Field>}
          <Field label="Cycle" required><select value={v.cycle || 'Cycle 1'} onChange={e => setV({ ...v, cycle: e.target.value })}><option value="Cycle 1">Cycle 1</option><option value="Cycle 2">Cycle 2</option></select></Field>
          {v.cycle === 'Cycle 2' && <Field label="Assessment stage" required><select value={v.assessmentStage || ''} onChange={e => setV({ ...v, assessmentStage: e.target.value })}><option value="">Select</option><option value="Pre">Pre</option><option value="Post">Post</option></select></Field>}
        </div>}
        {entryStarted && (v.cycle || 'Cycle 1') === 'Cycle 1' && <>{lookupMsg && <p className="form-message">{lookupMsg}</p>}{lookupMatches.length > 0 && <section className="card"><h3>Previous Teacher Submissions</h3>{lookupMatches.map((item, index) => <div key={`${item.submissionId || 'record'}-${index}`} style={{borderBottom:'1px solid #ddd',padding:'12px 0'}}><strong>{item.name || v.teacherName}</strong><p>Theme: {item.themeName || 'Not recorded'}</p><p>Pre rating: {item.preRating ?? 'Not recorded'} · Post rating: {item.postRating ?? 'Not recorded'}</p><p>Submitted: {item.submittedAt || 'Date unavailable'}</p><p>Submission ID: {item.submissionId || 'Not recorded'}</p></div>)}</section>}
        {entryStarted && (v.cycle || 'Cycle 1') === 'Cycle 1' && <div className="survey-grid">
          <Field label="Select the theme" required>
            <select
              value={v.theme}
              onChange={e =>
                setV({
                  ...v,
                  theme: e.target.value,
                  ratings: { pre: '', post: '' }
                })
              }
            >
              <option value="">Select</option>
              {['T1', 'T2', 'T3', 'T4'].map(t => (
                <option key={t} value={t}>
                  {labelTheme(t)}
                </option>
              ))}
            </select>
          </Field>
        </div>}

      {v.theme && (
        <TeacherRubric
          theme={v.theme}
          value={v.ratings}
          onChange={(ratings: any) => setV({ ...v, ratings })}
        />
      )}


      

      
<div className="form-actions">
  <button
    type="button"
    className="secondary"
    onClick={() => save(false)}
    disabled={saving || lookupLoading}
  >
    {saving ? 'Saving…' : 'Save & Add Another Theme'}
  </button>

  <button
    type="button"
    className="primary"
    onClick={() => save(true)}
    disabled={saving || lookupLoading}
  >
    {saving ? 'Submitting…' : 'Submit Assessment'}
  </button>

  {msg && <span className="form-message">{msg}</span>}
</div>

            </>}
        {entryStarted && v.cycle === 'Cycle 2' && <TeacherCycle2Form value={v} onChange={(x:any) => setV(x)} user={user} onRefresh={onRefresh} />}
      </section>
</div>
  );
}

function TeacherRubric({theme,value,onChange}:{theme:string;value:any;onChange:(x:any)=>void}){const rubric=teacherRubrics[theme];return <section className="card survey-theme"><h2>{labelTheme(theme)} — Pre / Post Rubrics</h2><div className="rubric-grid">{(['pre','post'] as const).map(which=><div className="rubric-box" key={which}><h3>{which==='pre'?'Pre-Assessment Rubric':'Post-Assessment Rubric'}</h3><div className="rubric-options">{rubric[which].map((r:any)=><label className="rubric-option" key={r[0]}><input type="radio" name={`${theme}-${which}`} checked={value[which]===r[0]} onChange={()=>onChange({...value,[which]:r[0]})}/><span><b>{r[0]}</b><small>{r[1]}</small></span></label>)}</div></div>)}</div></section>}

createRoot(document.getElementById('root')!).render(<App/>);
