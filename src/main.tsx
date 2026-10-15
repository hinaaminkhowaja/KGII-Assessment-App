import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

type Rec={RecordID:string;CycleID:string;Year:number;ParticipantType:string;Assessment:string;Region:string;LocalBoard:string;REC:string;ParticipantCount:number;Phase:string;ThemeID:string;DimensionID:string;IndicatorID:string;Score:number;MaxScore:number};
type Ref={Region:string;LocalBoard:string;REC:string};
type Indicator={CycleID:string;ParticipantType:string;Assessment:string;ThemeID:string;ThemeName:string;DimensionID:string|null;IndicatorID:string;MaxScore:number;SourceSheet:string;SourceColumn:number};
const pct=(n:number,d:number)=>d?100*n/d:0;
const fmt=(x:number)=>Number.isFinite(x)?x.toFixed(1)+'%':'—';
const norm=(v:any)=>String(v??'').trim();
function aggregate(rows:Rec[]){let s=0,m=0;for(const r of rows){s+=Number(r.Score)||0;m+=Number(r.MaxScore)||0}return {score:s,max:m,p:pct(s,m)};}
function avgRating(rows:Rec[],participantType:string){const x=rows.filter(r=>r.ParticipantType===participantType);if(!x.length)return 0;return x.reduce((a,r)=>a+(Number(r.Score)||0),0)/x.length;}
function scoreOutOf(rows:Rec[],participantType:string,unitMax:number){const x=rows.filter(r=>r.ParticipantType===participantType);return x.length?avgRating(rows,participantType)*unitMax:0;}
function scoreModel(rows:Rec[]){const student=scoreOutOf(rows,'Student',29);const teacher=scoreOutOf(rows,'Teacher',4);return {student,teacher,total:student+teacher,max:103};}
function combinedScore(rows:Rec[]){const pre=scoreModel(rows.filter(r=>r.Assessment==='Pre')),post=scoreModel(rows.filter(r=>r.Assessment==='Post'));return {score:pre.total+post.total,max:206,percent:pct(pre.total+post.total,206),pre,post};}
function unique(rows:Rec[],key:keyof Rec){return [...new Set(rows.map(r=>norm(r[key])) )].filter(Boolean).sort((a,b)=>a.localeCompare(b));}
function labelTheme(id:string){const m:any={T1:'Theme 1 — Authority and Leadership',T2:'Theme 2 — Intellectual Traditions',T3:'Theme 3 — Role in Family, Community and Society',T4:'Theme 4 — Two Aspects of Life'};return m[id]||id}
function displayGeo(value:string){
  const raw=String(value||'').trim();
  const labels:any={
    Southern:'Southern','Southern_01':'Southern',
    Central:'Central','Central_01':'Central',
    Gilgit:'Gilgit','Gilgit_01':'Gilgit',
    Hunza:'Hunza','Hunza_01':'Hunza',
    Gupis_Yasin:'Gupis Yasin','Gupis_Yasin_01':'Gupis Yasin',
    Ishkoman_Puniyal:'Ishkoman Puniyal','Ishkoman_Puniyal_01':'Ishkoman Puniyal',
    Lower_Chitral:'Lower Chitral','Lower_Chitral_01':'Lower Chitral',
    Upper_Chitral:'Upper Chitral','Upper_Chitral_01':'Upper Chitral'
  };
  return labels[raw] || raw.replace(/_\\d+$/,'').replace(/_/g,' ');
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

function filterRows(rows:Rec[],f:any){return rows.filter(r=>(!f.region||r.Region===f.region)&&(!f.board||r.LocalBoard===f.board)&&(!f.rec||r.REC===f.rec)&&(!f.pt||r.ParticipantType===f.pt)&&(!f.assessment||r.Assessment===f.assessment)&&(!f.theme||r.ThemeID===f.theme)&&(!f.dim||r.DimensionID===f.dim)&&(!f.year||String(r.Year)===String(f.year)))}

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
async function apiGet(action:string,params:Record<string,string>={}){const q=new URLSearchParams({action,...params});const r=await fetch(`${API_URL}?${q.toString()}`);if(!r.ok)throw new Error(`API request failed (${r.status})`);const d=await r.json();if(d.success===false)throw new Error(d.message||d.error||'API request failed.');return d;}
async function apiPost(action:string,body:Record<string,any>){const r=await fetch(`${API_URL}?action=${encodeURIComponent(action)}`,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`API request failed (${r.status})`);const d=await r.json();if(d.success===false)throw new Error(d.message||d.error||'API request failed.');return d;}
function mapUser(x:any):AppUser{const role=String(x.role||'User').toLowerCase()==='admin'?'admin':'user';const rawStatus=String(x.status||'pending').toLowerCase();const status=(rawStatus==='approved'?'approved':rawStatus==='rejected'?'rejected':rawStatus==='suspended'?'suspended':'pending') as UserStatus;const email=norm(x.email).toLowerCase();return {id:norm(x.id)||email,name:norm(x.name)||email,email,role,status,createdAt:norm(x.createdAt||x.created_at)}}
function mapAccess(x:any):AccessRule{const email=norm(x.email).toLowerCase();return {id:norm(x.id)||[email,x.region,x.localBoard||x.board,x.rec].join('|'),userId:norm(x.userId)||email,region:norm(x.region),board:norm(x.localBoard||x.board),rec:norm(x.rec),active:x.active===true||String(x.active).toLowerCase()==='true'||String(x.active)==='1'||String(x.active).toLowerCase()==='yes'}}
function accessMatches(r:Rec,a:AccessRule){return a.active&&(!a.region||r.Region===a.region)&&(!a.board||r.LocalBoard===a.board)&&(!a.rec||r.REC===a.rec)}
function userHasAccess(u:AppUser|null,access:AccessRule[]){return !!u&&(u.role==='admin'||access.some(a=>a.userId===u.id&&a.active))}
function arrayFrom(d:any,...keys:string[]):any[]{for(const k of keys)if(Array.isArray(d?.[k]))return d[k];if(Array.isArray(d))return d;return []}

function App(){
 const [records,setRecords]=useState<Rec[]>([]);const [refs,setRefs]=useState<Ref[]>([]);const [indicators,setIndicators]=useState<Indicator[]>([]);
 const [page,setPage]=useState('home');const [apiError,setApiError]=useState('');const [loading,setLoading]=useState(false);
 const [f,setF]=useState<any>({region:'',board:'',rec:'',pt:'',assessment:'',theme:'',dim:'',year:''});
 const [user,setUser]=useState<AppUser|null>(null);const [users,setUsers]=useState<AppUser[]>([]);const [access,setAccess]=useState<AccessRule[]>([]);
 const loadReference=async()=>{const d=await apiGet('reference');const rr=arrayFrom(d,'refs','reference','records','data');const ii=arrayFrom(d,'indicators','APP_Indicators');setRefs(rr.map((x:any)=>({Region:norm(x.Region||x.region),LocalBoard:norm(x.LocalBoard||x.localBoard),REC:norm(x.REC||x.rec)})).filter((x:Ref)=>x.Region&&x.LocalBoard&&x.REC));setIndicators(ii);};
 const loadDashboard=async(email:string)=>{const d=await apiGet('dashboard',{email});const rows=arrayFrom(d,'records','rows','data');const headers=Array.isArray(d.headers)?d.headers:[];const normalized=rows.map((x:any)=>{if(Array.isArray(x)){const o:any={};headers.forEach((h:string,i:number)=>o[h]=x[i]);x=o;}return {RecordID:norm(x.RecordID||x.recordId||x.ID),CycleID:norm(x.CycleID),Year:Number(x.Year)||0,ParticipantType:norm(x.ParticipantType),Assessment:norm(x.Assessment),Region:norm(x.Region),LocalBoard:norm(x.LocalBoard),REC:norm(x.REC),ParticipantCount:Number(x.ParticipantCount)||0,Phase:norm(x.Phase),ThemeID:norm(x.ThemeID),DimensionID:norm(x.DimensionID),IndicatorID:norm(x.IndicatorID),Score:Number(x.Score)||0,MaxScore:Number(x.MaxScore)||0} as Rec;});setRecords(normalized);};
 const loadAdmin=async(email:string)=>{const [u,a]=await Promise.all([apiGet('users',{email}),apiGet('access',{email})]);const us=arrayFrom(u,'users','data').map(mapUser);const ac=arrayFrom(a,'access','rules','data').map(mapAccess);setUsers(us);setAccess(ac);};
 useEffect(()=>{setLoading(true);loadReference().catch(e=>setApiError(`Could not load reference data from Apps Script: ${e.message}`)).finally(()=>setLoading(false));const saved=sessionStorage.getItem(SESSION_KEY);if(saved){apiGet('login',{email:saved}).then(async d=>{if(!d.user)throw new Error('This email is not approved for dashboard access.');const u=mapUser(d.user);if(u.status!=='approved'&&u.role!=='admin')throw new Error('This account is not approved.');setUser(u);await loadDashboard(u.email);if(u.role==='admin')await loadAdmin(u.email);setPage(u.role==='admin'?'admin':'dashboard')}).catch(e=>{sessionStorage.removeItem(SESSION_KEY);setApiError(e.message);}).finally(()=>setLoading(false));}},[]);
 
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
 const allowedRecords=records;const filtered=useMemo(()=>filterRows(allowedRecords,f),[allowedRecords,f]);
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
const pts=unique(allowedRecords,'ParticipantType'),assessments=unique(allowedRecords,'Assessment'),themes=unique(allowedRecords,'ThemeID'),dims=unique(allowedRecords,'DimensionID'),years=unique(allowedRecords,'Year');
 const refresh=async(u= user)=>{if(!u)return;setLoading(true);setApiError('');try{await loadDashboard(u.email);if(u.role==='admin')await loadAdmin(u.email);}catch(e:any){setApiError(e.message||'Could not refresh from Apps Script.')}finally{setLoading(false)}};
 const nav=(p:string)=>{if(['dashboard','region','board','rec','theme','dimension','prepost','admin','resources'].includes(p)&&!user){setPage('login');return}setPage(p)};
 const login=async(email:string)=>{setLoading(true);setApiError('');try{const d=await apiGet('login',{email:email.trim().toLowerCase()});if(!d.user)throw new Error(d.message||'No account was found for this email.');const u=mapUser(d.user);if(u.status!=='approved'&&u.role!=='admin')throw new Error(u.status==='pending'?'Your account is awaiting administrator approval.':`Your account is ${u.status}.`);setUser(u);
sessionStorage.setItem(SESSION_KEY, u.email);

console.time('Dashboard load');
if (u.role === 'admin') {
  console.time('Dashboard and admin API');
  await Promise.all([loadDashboard(u.email),loadAdmin(u.email)]);
  console.timeEnd('Dashboard and admin API');
} else {
  console.time('Dashboard API');
  await loadDashboard(u.email);
  console.timeEnd('Dashboard API');
}
console.timeEnd('Dashboard load');
setF({region:'',board:'',rec:'',pt:'',assessment:'',theme:'',dim:'',year:''});setPage(u.role==='admin'?'admin':'dashboard');}catch(e:any){setApiError(e.message||'Login failed.')}finally{setLoading(false)}};
 const requestLogin=async(name:string,email:string,requestedRole:string)=>{setLoading(true);setApiError('');try{await apiPost('createloginrequest',{name,email,requestedRole,role:'user',status:'Pending'});}catch(e:any){throw new Error(e.message||'Could not submit login request.')}finally{setLoading(false)}};
 const logout=()=>{setUser(null);sessionStorage.removeItem(SESSION_KEY);setRecords([]);setUsers([]);setAccess([]);setPage('home');setF({region:'',board:'',rec:'',pt:'',assessment:'',theme:'',dim:'',year:''})};
 if(page==='home')return <PublicHome onLogin={()=>setPage('login')} onStudent={()=>setPage('student-survey')} onTeacher={()=>setPage('teacher-survey')}/>;
 if(page==='login')return <LoginPage onLogin={login} onRequest={requestLogin} loading={loading} error={apiError} onBack={()=>{setApiError('');setPage('home')}}/>;
 const protectedPage=!page.includes('survey')&&page!=='home';
 if(protectedPage&&!user)return <LoginPage onLogin={login} onRequest={requestLogin} loading={loading} error={apiError} onBack={()=>setPage('home')}/>;
 if((page==='student-survey'||page==='teacher-survey')&&!user)return <PublicSurveyShell page={page} setPage={setPage} children={page==='student-survey'?<StudentSurvey refs={surveyRefs} user={null}/>:<TeacherSurvey refs={surveyRefs} user={null}/>}/>;
 return <div className="app"><aside><div className="brand"><div className="mark">KG</div><div><b>KG II</b><span>Assessment App</span></div></div><div className="signed-in"><span>Signed in as</span><b>{user?.name}</b><small>{user?.role==='admin'?'Administrator':'Approved user'}</small><button onClick={logout}>Log out</button></div><nav><div className="nav-label">Assessment</div>{[['dashboard','Dashboard'],['region','Region-wise Analysis'],['board','Local Board-wise Analysis'],['rec','REC-wise Analysis'],['theme','Theme-wise Analysis'],['dimension','Dimension-wise Analysis'],['prepost','Pre / Post Analysis']].map(([id,n])=><button className={page===id?'active':''} onClick={()=>nav(id)} key={id}>{n}</button>)}<div className="survey-nav"><button className={page==='student-survey'?'active':''} onClick={()=>setPage('student-survey')}>Student Survey</button><button className={page==='teacher-survey'?'active':''} onClick={()=>setPage('teacher-survey')}>Teacher Survey</button></div><div className="nav-label">Resources</div><button className={page==='resources'?'active':''} onClick={()=>nav('resources')}>Mentoring & Assessment Strategies</button>{user?.role==='admin'&&<><div className="nav-label">Administration</div><button className={page==='admin'?'active':''} onClick={()=>setPage('admin')}>Users & Access</button></>}</nav></aside><main><header><div><h1>{title(page)}</h1><p>{subtitle(page)}</p></div>{!page.includes('survey')&&page!=='admin'&&<div className="header-actions"><button className="secondary print-action" onClick={()=>window.print()}>Print / Save PDF</button><button className="refresh" onClick={()=>refresh()}>↻ Refresh data</button></div>}</header>{(apiError||loading)&&<div className="auth-message">{loading?'Connecting to Google Sheets…':apiError}</div>}{page==='student-survey'?<StudentSurvey refs={surveyRefs} user={user}/>:page==='teacher-survey'?<TeacherSurvey refs={surveyRefs} user={user}/>:page==='admin'?<AdminPanel users={users} setUsers={setUsers} access={access} setAccess={setAccess} refs={refs} currentUser={user!} onRefresh={()=>refresh()}/>:page==='resources'?<ResourceLibrary user={user}/>:<><Filters f={f} setF={setF} regions={regions} boards={boards} recs={recs} pts={pts} assessments={assessments} themes={themes} dims={dims} years={years}/>{page==='dashboard'?<Dashboard rows={filtered} nav={nav}/>:<Analysis page={page} rows={filtered} all={allowedRecords} f={f} setF={setF} nav={nav}/>}</>}</main></div>
}
function PublicHome({onLogin,onStudent,onTeacher}:{onLogin:()=>void;onStudent:()=>void;onTeacher:()=>void}){return <div className="landing"><div className="landing-card"><div className="mark big">KG</div><h1>KG II Assessment App</h1><p>Assessment data and survey entry platform.</p><div className="landing-actions"><button className="primary" onClick={onStudent}>Student Survey Entry</button><button className="primary" onClick={onTeacher}>Teacher Survey Entry</button><button className="secondary" onClick={onLogin}>Login for Dashboard</button></div><div className="landing-note">Survey entry is available to all users. The assessment dashboard is available only to users approved and assigned access by an administrator.</div></div></div>}
function PublicSurveyShell({page,setPage,children}:{page:string;setPage:(p:string)=>void;children:React.ReactNode}){return <div className="app"><aside><div className="brand"><div className="mark">KG</div><div><b>KG II</b><span>Assessment App</span></div></div><nav><button className={page==='student-survey'?'active':''} onClick={()=>setPage('student-survey')}>Student Survey</button><button className={page==='teacher-survey'?'active':''} onClick={()=>setPage('teacher-survey')}>Teacher Survey</button></nav></aside><main><header><div><h1>{title(page)}</h1><p>{subtitle(page)}</p></div></header>{children}</main></div>}
function LoginPage({onLogin,onRequest,loading,error,onBack}:{onLogin:(email:string)=>void;onRequest:(name:string,email:string,requestedRole:string)=>Promise<void>;loading:boolean;error:string;onBack:()=>void}){const [mode,setMode]=useState<'login'|'request'>('login');const [email,setEmail]=useState('');const [name,setName]=useState('');const [requestedRole,setRequestedRole]=useState('Region');const [msg,setMsg]=useState('');const [requestBusy,setRequestBusy]=useState(false);const submit=()=>{if(!email.trim()){setMsg('Enter your registered email address.');return}setMsg('');onLogin(email)};const request=async()=>{if(!name.trim()||!email.trim()){setMsg('Enter your full name and email address.');return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setMsg('Enter a valid email address.');return}if(!requestedRole){setMsg('Select the role you are requesting.');return}setRequestBusy(true);setMsg('');try{await onRequest(name.trim(),email.trim().toLowerCase(),requestedRole);setMsg('Your login request has been submitted successfully. Access is subject to administrator approval. You will be notified once your request has been reviewed.');setMode('login')}catch(e:any){setMsg(e.message||'Could not submit your request. Please try again.')}finally{setRequestBusy(false)}};return <div className="auth-page"><div className="auth-card"><div className="mark big">KG</div><h1>{mode==='login'?'Login to Dashboard':'Request Login Access'}</h1>{mode==='login'?<><p>Enter the email address associated with your approved account.</p><Field label="Email Address" required><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} autoComplete="email"/></Field><button className="primary full" onClick={submit} disabled={loading}>{loading?'Checking access…':'Login to Dashboard'}</button><button className="secondary full auth-switch" onClick={()=>{setMode('request');setMsg('')}} disabled={loading}>Request Login Access</button></>:<><p>Complete the form below. Your request will be reviewed by an administrator.</p><Field label="Full Name" required><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></Field><Field label="Email Address" required><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" onKeyDown={e=>e.key==='Enter'&&request()}/></Field><Field label="Requested Access Level" required><select value={requestedRole} onChange={e=>setRequestedRole(e.target.value)}><option value="Region">Region</option><option value="Local Board">Local Board</option><option value="REC">REC</option></select></Field><button className="primary full" onClick={request} disabled={requestBusy||loading}>{requestBusy?'Submitting…':'Submit Login Request'}</button><button className="secondary full auth-switch" onClick={()=>{setMode('login');setMsg('')}} disabled={requestBusy}>Back to Login</button></>}{(msg||error)&&<div className="auth-message">{msg||error}</div>}<p className="admin-note">Student and teacher survey entry is available without dashboard access. Dashboard access requires administrator approval and assigned permissions.</p><button className="back-button" onClick={onBack}>← Back to Home</button></div></div>}
function AdminPanel({users,setUsers,access,setAccess,refs,currentUser,onRefresh}:{users:AppUser[];setUsers:React.Dispatch<React.SetStateAction<AppUser[]>>;access:AccessRule[];setAccess:React.Dispatch<React.SetStateAction<AccessRule[]>>;refs:Ref[];currentUser:AppUser;onRefresh:()=>void}){const [selected,setSelected]=useState('');const [region,setRegion]=useState('');const [board,setBoard]=useState('');const [rec,setRec]=useState('');const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const regions=[...new Set(refs.map(r=>r.Region))].sort();const boards=[...new Set(refs.filter(r=>!region||r.Region===region).map(r=>r.LocalBoard))].sort();const recs=[...new Set(refs.filter(r=>(!region||r.Region===region)&&(!board||r.LocalBoard===board)).map(r=>r.REC))].sort();const selectedUser=users.find(u=>u.id===selected);const userRules=access.filter(a=>a.userId===selected||(selectedUser&&a.userId===selectedUser.email));const act=async(fn:()=>Promise<any>,success:string)=>{setBusy(true);setMsg('');try{await fn();setMsg(success);onRefresh()}catch(e:any){setMsg(e.message||'Could not save changes.')}finally{setBusy(false)}};const status=async(u:AppUser,statusValue:string)=>act(()=>apiPost('updateuser',{email:u.email,status:statusValue,updatedBy:currentUser.email}),`${u.name} updated.`);const add=()=>{if(!selectedUser){setMsg('Select a user first.');return}if(!region){setMsg('Select a Region before assigning access.');return}act(()=>apiPost('saveaccess',{email:selectedUser.email,name:selectedUser.name,region,localBoard:board,rec,active:true,updatedBy:currentUser.email}),'Access assignment saved.').then(()=>{setRegion('');setBoard('');setRec('')})};const toggle=(a:AccessRule)=>{const u=users.find(x=>x.id===a.userId||x.email===a.userId);if(!u){setMsg('Could not identify the user for this access rule.');return}act(()=>apiPost('saveaccess',{email:u.email,name:u.name,region:a.region,localBoard:a.board,rec:a.rec,active:!a.active,updatedBy:currentUser.email}),`Access ${a.active?'disabled':'enabled'}.`)};return <div className="admin-page"><section className="card"><h2>Users</h2><p>Accounts and approval status are loaded from Google Sheets.</p><table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className={`status ${u.status}`}>{u.status}</span></td><td>{u.role}</td><td>{u.role==='user'&&<><button className="small-button" disabled={busy} onClick={()=>status(u,'Approved')}>Approve</button><button className="small-button danger" disabled={busy} onClick={()=>status(u,'Rejected')}>Reject</button><button className="small-button" onClick={()=>setSelected(u.id)}>Assign</button></>}</td></tr>)}</tbody></table></section><section className="card"><h2>Access Assignment</h2><div className="survey-grid"><Field label="User" required><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select user</option>{users.filter(u=>u.role==='user').map(u=><option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}</select></Field><div className="access-help"><b>{selectedUser?.name||'Select a user'}</b><span>Assign Region, Local Board and/or REC. Blank lower levels mean all data under the selected level.</span></div></div><div className="survey-grid"><Field label="Region" required><select value={region} onChange={e=>{setRegion(e.target.value);setBoard('');setRec('')}}><option value="">Select region</option>{regions.map(x=><option key={x} value={x}>{displayGeo(x)}</option>)}</select></Field><Field label="Local Board"><select value={board} disabled={!region} onChange={e=>{setBoard(e.target.value);setRec('')}}><option value="">All boards</option>{boards.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="REC"><select value={rec} disabled={!board} onChange={e=>setRec(e.target.value)}><option value="">All RECs</option>{recs.map(x=><option key={x}>{x}</option>)}</select></Field><div className="form-actions"><button className="primary" disabled={busy} onClick={add}>Add Access</button></div></div>{selected&&<table><thead><tr><th>Region</th><th>Local Board</th><th>REC</th><th>Status</th><th>Action</th></tr></thead><tbody>{userRules.map(a=><tr key={a.id}><td>{a.region||'All'}</td><td>{a.board||'All'}</td><td>{a.rec||'All'}</td><td>{a.active?'Active':'Disabled'}</td><td><button className="small-button" disabled={busy} onClick={()=>toggle(a)}>{a.active?'Disable':'Enable'}</button></td></tr>)}</tbody></table>}{msg&&<div className="auth-message">{msg}</div>}</section><section className="card"><h2>Administrator note</h2><p className="admin-note">User approvals, access assignments and dashboard records are handled through the Google Sheets + Apps Script backend. The frontend does not store account passwords.</p></section></div>}

function ResourceLibrary({user}:{user:AppUser|null}){
  const [resources,setResources]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [category,setCategory]=useState('All');
  const [titleValue,setTitleValue]=useState('');
  const [description,setDescription]=useState('');
  const [uploadCategory,setUploadCategory]=useState('Mentoring Strategies');
  const [uploadPassword,setUploadPassword]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const load=async()=>{setBusy(true);setMsg('');try{const d=await apiGet('resources');setResources(Array.isArray(d.resources)?d.resources:[]);}catch(e:any){setMsg(e.message||'Could not load resources.');}finally{setBusy(false)}};
  useEffect(()=>{load()},[]);
  const upload=async(e:any)=>{
    e.preventDefault();
    if(!user||user.role!=='admin'){setMsg('Administrator access is required to upload resources.');return;}
    if(!titleValue.trim()||!uploadCategory||!file||!uploadPassword){setMsg('Complete the title, category, file and upload password fields.');return;}
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
        uploadPassword,
        title:titleValue.trim(),
        description:description.trim(),
        category:uploadCategory,
        fileName:file.name,
        mimeType:file.type||'application/octet-stream',
        fileBase64
      });
      setMsg(result.message||'Resource uploaded successfully.');
      setTitleValue('');setDescription('');setUploadPassword('');setFile(null);
      const input=document.getElementById('resource-upload-file') as HTMLInputElement|null;
      if(input)input.value='';
      await load();
    }catch(e:any){setMsg(e.message||'Could not upload the resource.');}
    finally{setBusy(false);}
  };
  const visible=category==='All'?resources:resources.filter(r=>r.category===category);
  return <div className="admin-page">
    {user?.role==='admin'&&<section className="card">
      <h2>Upload a Resource</h2>
      <p className="admin-note">Add mentoring or assessment resources for approved app users to view and download. Maximum file size: 10 MB.</p>
      <form onSubmit={upload}>
        <div className="survey-grid">
          <Field label="Resource title" required><input value={titleValue} onChange={e=>setTitleValue(e.target.value)} required maxLength={180}/></Field>
          <Field label="Category" required><select value={uploadCategory} onChange={e=>setUploadCategory(e.target.value)} required><option>Mentoring Strategies</option><option>Assessment Strategies</option></select></Field>
          <Field label="Description"><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={1000}/></Field>
          <Field label="Choose file (up to 10 MB)" required><input id="resource-upload-file" type="file" onChange={e=>setFile(e.target.files?.[0]||null)} required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png"/></Field>
          <Field label="Administrator upload password" required><input type="password" value={uploadPassword} onChange={e=>setUploadPassword(e.target.value)} required autoComplete="current-password"/></Field>
        </div>
        <div className="form-actions"><button className="primary" type="submit" disabled={busy}>{busy?'Please wait…':'Upload resource'}</button></div>
      </form>
      {msg&&<div className="auth-message" role="status">{msg}</div>}
    </section>}
    <section className="card">
      <div className="section-head"><div><h2>Mentoring and Assessment Strategies</h2><p>Browse and open resources shared by the KG II Assessment team.</p></div><button className="secondary" onClick={load} disabled={busy}>{busy?'Loading…':'Refresh resources'}</button></div>
      <div className="survey-grid"><Field label="Category"><select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option><option>Mentoring Strategies</option><option>Assessment Strategies</option></select></Field></div>
      {msg&&user?.role!=='admin'&&<div className="auth-message">{msg}</div>}
      {busy&&!resources.length?<p>Loading resources…</p>:visible.length===0?<p>No active resources are available in this category yet.</p>:<div className="resource-list">{visible.map((r:any)=><article className="card" key={r.resourceID||r.fileURL}><h3>{r.title||r.fileName||'Untitled resource'}</h3>{r.category&&<p><b>Category:</b> {r.category}</p>}{r.description&&<p>{r.description}</p>}<p className="admin-note">{r.fileName||''}</p>{r.fileURL&&<a href={r.fileURL} target="_blank" rel="noreferrer">Open / Download resource ↗</a>}</article>)}</div>}
    </section>
  </div>
}

function title(p:string){return ({dashboard:'KG II Assessment Dashboard',region:'Region-wise Analysis',board:'Local Board-wise Analysis',rec:'REC-wise Analysis',theme:'Theme-wise Analysis',dimension:'Dimension-wise Analysis',prepost:'Pre / Post Analysis',admin:'Users & Access',resources:'Mentoring & Assessment Strategies','student-survey':'Student Survey Entry','teacher-survey':'Teacher Survey Entry'} as any)[p]}
function subtitle(p:string){if(p==='student-survey')return 'Enter student survey responses using the master Region → Local Board → REC hierarchy.';if(p==='teacher-survey')return 'Enter teacher survey responses using the master Region → Local Board → REC hierarchy.';if(p==='resources')return 'View and download mentoring and assessment resources.';return p==='dashboard'?'Assessment Performance Overview':'Drill down into performance using the selected filters.'}
function Filters({f,setF,regions,boards,recs,pts,assessments,themes,dims,years}:any){const S=({k,lab,vals}:{k:string;lab:string;vals:string[]})=><label><span>{lab}</span><select value={f[k]} onChange={e=>setF((x:any)=>({...x,[k]:e.target.value,...(k==='region'?{board:'',rec:''}:k==='board'?{rec:''}:{})}))}><option value="">All</option>{vals.map(v=><option key={v} value={v}>{k==='theme'?labelTheme(v):k==='dim'?labelDim(v):k==='region'?displayGeo(v):v}</option>)}</select></label>;return <section className="filters"><S k="region" lab="Region" vals={regions}/><S k="board" lab="Local Board" vals={boards}/><S k="rec" lab="REC" vals={recs}/><S k="pt" lab="Participant" vals={pts}/><S k="assessment" lab="Assessment" vals={assessments}/><S k="theme" lab="Theme" vals={themes}/><S k="dim" lab="Dimension" vals={dims}/><S k="year" lab="Year" vals={years.map(String)}/></section>}
function statusFor(p:number){return p>=80?'Excellent':p>=65?'Good':p>=50?'Satisfactory':'Need Attention'}
function Kpis({rows}:{rows:Rec[]}){const c=combinedScore(rows);const studentTotal=c.pre.student+c.post.student;const teacherTotal=c.pre.teacher+c.post.teacher;const themePct=aggregate(rows).p;const dimPct=aggregate(rows).p;const prePct=c.pre.total/103*100;const postPct=c.post.total/103*100;const preStudents=new Set(rows.filter(r=>r.ParticipantType==='Student'&&r.Assessment==='Pre').map(r=>r.RecordID)).size;const postStudents=new Set(rows.filter(r=>r.ParticipantType==='Student'&&r.Assessment==='Post').map(r=>r.RecordID)).size;const preTeachers=new Set(rows.filter(r=>r.ParticipantType==='Teacher'&&r.Assessment==='Pre').map(r=>r.RecordID)).size;const postTeachers=new Set(rows.filter(r=>r.ParticipantType==='Teacher'&&r.Assessment==='Post').map(r=>r.RecordID)).size;const recKey=(r:Rec)=>[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');const preRecs=new Set(rows.filter(r=>r.Assessment==='Pre'&&r.Region&&r.LocalBoard&&r.REC).map(recKey)).size;const postRecs=new Set(rows.filter(r=>r.Assessment==='Post'&&r.Region&&r.LocalBoard&&r.REC).map(recKey)).size;return <div className="kpis">{[['Overall Score',c.score.toFixed(1)+' / 206'],['Performance',fmt(c.percent)],['Status',statusFor(c.percent)],['No. of Students',preStudents+' / '+postStudents],['No. of Teachers',preTeachers+' / '+postTeachers],['No. of RECs',preRecs+' / '+postRecs],['Students Overall',fmt(pct(studentTotal,174))],['Teachers Overall',fmt(pct(teacherTotal,32))],['Theme Overall',fmt(themePct)],['Dimension Overall',fmt(dimPct)],['Pre Overall',fmt(prePct)],['Post Overall',fmt(postPct)]].map(([a,b])=><div className="kpi" key={a}><span>{a==='No. of RECs'?'No. of RECs (Pre / Post)':a}</span><strong className={a==='Status'?'status-kpi '+String(b).toLowerCase().replace(/ /g,'-'):''}>{b}</strong></div>)}</div>}
function group(rows:Rec[],key:keyof Rec){return unique(rows,key).map(k=>{const a=aggregate(rows.filter(r=>norm(r[key])===k));return {key:k,p:a.p,score:a.score,max:a.max}})}
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

function WayForward({rows,scope,f,nav}:{rows:Rec[];scope:string;f:any;nav?:(p:string)=>void}) {
  const studentRows = rows.filter(r => r.ParticipantType === 'Student');
  const teacherRows = rows.filter(r => r.ParticipantType === 'Teacher');
  const studentThemes = group(studentRows,'ThemeID').sort((a,b)=>a.p-b.p);
  const teacherThemes = group(teacherRows,'ThemeID').sort((a,b)=>a.p-b.p);
  const dimGroups = group(studentRows,'DimensionID').sort((a,b)=>a.p-b.p);
  const indicatorGroups = unique(studentRows,'IndicatorID').map(id => {
    const subset = studentRows.filter(r => r.IndicatorID === id);
    const a = aggregate(subset);
    return {id, label:rubricDescription(id), p:a.p,rows:subset};
  }).sort((a,b)=>a.p-b.p);
  const weakestStudentTheme = studentThemes[0];
  const weakestTeacherTheme = teacherThemes[0];
  const weakestDim = dimGroups[0];
  const weakIndicators = indicatorGroups.slice(0,3).filter(x=>x.rows.length);
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
  const titleScope = scope==='dashboard'?'Overall':scope==='region'?'Region':scope==='board'?'Local Board':'REC';
  return <section className="card way-forward">
    <div className="section-head"><div><h2>Way Forward — {titleScope}</h2><p>Student and teacher priorities are calculated separately from the lowest-performing themes in the current selection.</p></div></div>
    {!rows.length ? <p className="empty">No assessment data is available for these filters yet.</p> : <>
      <div className="way-forward-priorities">
        <div><span>Students · Weakest theme</span><b>{weakestStudentTheme ? labelTheme(weakestStudentTheme.key)+' · '+fmt(weakestStudentTheme.p) : 'Not available'}</b><p>{weakestStudentTheme ? (themeActions[weakestStudentTheme.key] || 'Plan a focused review, model the expected learning, and assess it again using the same indicators.') : 'No student assessment data is available for this selection.'}</p></div>
        <div><span>Teachers · Weakest theme</span><b>{weakestTeacherTheme ? labelTheme(weakestTeacherTheme.key)+' · '+fmt(weakestTeacherTheme.p) : 'Not available'}</b><p>{weakestTeacherTheme ? (teacherThemeActions[weakestTeacherTheme.key] || 'Plan focused professional learning and review progress against the same indicators.') : 'No teacher assessment data is available for this selection.'}</p></div>
        <div><span>Students · Weakest dimension</span><b>{weakestDim ? labelDim(weakestDim.key)+' · '+fmt(weakestDim.p) : 'Not available'}</b><p>{dimAction}</p></div>
      </div>
      <h3>Student rubrics requiring attention</h3>
      {weakIndicators.length ? <div className="table-wrap"><table><thead><tr><th>Full rubric description</th><th>Theme</th><th>Dimension</th><th>Performance</th><th>Suggested action</th></tr></thead><tbody>
        {weakIndicators.map(x=>{const sample=x.rows[0];const action=rubricAction(x.id,sample.ThemeID,sample.DimensionID);return <tr key={x.id}><td>{x.label}</td><td>{labelTheme(sample.ThemeID)}</td><td>{sample.DimensionID ? labelDim(sample.DimensionID) : '—'}</td><td>{fmt(x.p)}</td><td>{action}</td></tr>})}
      </tbody></table></div> : <p className="empty">Student indicator-level data is not available for this selection.</p>}
      <div className="way-forward-resources"><div><h3>Connect priorities to mentoring resources</h3><p>Use the recommended actions above to select a focused activity, mentoring strategy or assessment resource, then review the same indicators in the next assessment cycle.</p></div><button type="button" className="primary" onClick={()=>nav?.('resources')}>Open Mentoring & Assessment Strategies ↗</button></div>
      <p className="way-forward-note">Next step: select one or two priorities for students and teachers, plan targeted learning or professional development, record evidence against the same indicators, and review progress in the next assessment cycle.</p>
    </>}
  </section>;
}

function Dashboard({rows,nav}:{rows:Rec[];nav:(p:string)=>void}){return <><Kpis rows={rows}/><div className="grid2"><CompareChart title="Theme Performance — Pre vs Post" data={compareGroup(rows,'ThemeID').map(x=>({label:labelTheme(x.key),pre:x.pre,post:x.post}))}/><CompareChart title="Dimension Performance — Pre vs Post" data={compareGroup(rows,'DimensionID').map(x=>({label:labelDim(x.key),pre:x.pre,post:x.post}))}/></div><Chart title="Assessment Performance — Pre vs Post" data={group(rows,'Assessment').map(x=>({label:x.key,value:x.p}))}/><PerformanceHighlights rows={rows}/><WayForward rows={rows} scope="dashboard" f={{}} nav={nav}/></>}
function compareGroup(rows:Rec[],key:'ThemeID'|'DimensionID'){return unique(rows,key).map(k=>({key:k,pre:aggregate(rows.filter(r=>norm(r[key])===k&&r.Assessment==='Pre')).p,post:aggregate(rows.filter(r=>norm(r[key])===k&&r.Assessment==='Post')).p}));}
function CompareChart({title,data}:{title:string;data:{label:string;pre:number;post:number}[]}){return <section className="card chart compare-chart"><h2>{title}</h2><div className="compare-legend"><span><i className="pre-swatch"/>Pre</span><span><i className="post-swatch"/>Post</span></div>{data.length?data.map(d=><div className="compare-row" key={d.label}><strong>{d.label}</strong><div className="compare-bars"><div className="compare-track"><i className="pre-bar" style={{width:Math.max(0,Math.min(100,d.pre))+'%'}}/></div><b>{fmt(d.pre)}</b><div className="compare-track"><i className="post-bar" style={{width:Math.max(0,Math.min(100,d.post))+'%'}}/></div><b>{fmt(d.post)}</b></div></div>):<div className="empty">No matching data</div>}</section>}
function PerformanceHighlights({rows}:{rows:Rec[]}){const byRegion=group(rows,'Region').filter(x=>x.key).sort((a,b)=>b.p-a.p);const boardMap=new Map<string,Rec[]>();rows.filter(r=>r.LocalBoard).forEach(r=>{const k=[norm(r.Region),norm(r.LocalBoard)].join('||');if(!boardMap.has(k))boardMap.set(k,[]);boardMap.get(k)!.push(r)});const byBoard=[...boardMap.entries()].map(([key,rs])=>({key,label:rs[0].LocalBoard+(rs[0].Region?' · '+displayGeo(rs[0].Region):''),p:aggregate(rs).p})).sort((a,b)=>b.p-a.p);const recMap=new Map<string,Rec[]>();rows.filter(r=>r.REC).forEach(r=>{const k=[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');if(!recMap.has(k))recMap.set(k,[]);recMap.get(k)!.push(r)});const byRec=[...recMap.entries()].map(([key,rs])=>({key,label:rs[0].REC+(rs[0].LocalBoard?' · '+rs[0].LocalBoard:''),p:aggregate(rs).p})).sort((a,b)=>b.p-a.p);const topRegion=byRegion[0],weakRegion=byRegion[byRegion.length-1],topBoard=byBoard[0],weakBoard=byBoard[byBoard.length-1],topRec=byRec[0],weakRec=byRec[byRec.length-1];return <section className="card performance-highlights"><h2>Performance Highlights</h2><p className="admin-note">Rankings are based on the records matching the current dashboard filters.</p><div className="highlight-grid">{[["Top-performing region",topRegion?displayGeo(topRegion.key)+' · '+fmt(topRegion.p):'Not available'],["Region needing most support",weakRegion?displayGeo(weakRegion.key)+' · '+fmt(weakRegion.p):'Not available'],["Top-performing local board",topBoard?topBoard.label+' · '+fmt(topBoard.p):'Not available'],["Local board needing most support",weakBoard?weakBoard.label+' · '+fmt(weakBoard.p):'Not available'],["Top-performing REC",topRec?topRec.label+' · '+fmt(topRec.p):'Not available'],["REC needing most support",weakRec?weakRec.label+' · '+fmt(weakRec.p):'Not available']].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>}
function Chart({title,data}:{title:string;data:{label:string;value:number}[]}){return <section className="card chart"><h2>{title}</h2>{data.length?data.map(d=><div className="barrow" key={d.label}><span>{d.label}</span><div><i style={{width:Math.max(0,Math.min(100,d.value))+'%'}}/></div><b>{fmt(d.value)}</b></div>):<div className="empty">No matching data</div>}</section>}
function Analysis({page,rows,all,f,setF,nav}:{page:string;rows:Rec[];all:Rec[];f:any;setF:(x:any)=>void;nav:(p:string)=>void}){if(page==='prepost')return <PrePost rows={rows}/>;if(page==='theme')return <ThemeAnalysis rows={rows}/>;if(page==='dimension')return <DimensionAnalysis rows={rows}/>;if(page==='rec')return <RecAnalysis rows={rows} f={f}/>;const key=page==='region'?'LocalBoard':'REC';const items=unique(rows,key as keyof Rec);return <><Kpis rows={rows}/><section className="card"><h2>{page==='region'?'Local Board Performance':'REC Performance'}</h2><table><thead><tr><th>{page==='region'?'Local Board':'REC'}</th><th>Students</th><th>Teachers</th><th>Overall</th><th>UA</th><th>A</th><th>Pre</th><th>Post</th></tr></thead><tbody>{items.map(item=><tr key={item} onClick={()=>{if(page==='region'){setF((x:any)=>({...x,board:item,rec:''}));nav('board')}else{setF((x:any)=>({...x,rec:item}));nav('rec')}}}><td className="link">{item}</td><td>{count(rows,item,'Student',key as 'LocalBoard'|'REC')}</td><td>{count(rows,item,'Teacher',key as 'LocalBoard'|'REC')}</td><td>{fmt(aggregate(rows.filter(r=>norm(r[key as keyof Rec])===item)).p)}</td><td>{fmt(aggregate(rows.filter(r=>norm(r[key as keyof Rec])===item&&r.DimensionID==='UA')).p)}</td><td>{fmt(aggregate(rows.filter(r=>norm(r[key as keyof Rec])===item&&r.DimensionID==='A')).p)}</td><td>{fmt(aggregate(rows.filter(r=>norm(r[key as keyof Rec])===item&&r.Assessment==='Pre')).p)}</td><td>{fmt(aggregate(rows.filter(r=>norm(r[key as keyof Rec])===item&&r.Assessment==='Post')).p)}</td></tr>)}</tbody></table></section>{page==='region'?<><ChildPerformanceHighlights rows={rows} level="Local Board"/><ChildPerformanceHighlights rows={rows} level="REC"/></>:<ChildPerformanceHighlights rows={rows} level="REC"/>}<div className="grid2"><CompareChart title="Theme Performance — Pre vs Post" data={compareGroup(rows,'ThemeID').map(x=>({label:labelTheme(x.key),pre:x.pre,post:x.post}))}/><CompareChart title="Dimension Performance — Pre vs Post" data={compareGroup(rows,'DimensionID').map(x=>({label:labelDim(x.key),pre:x.pre,post:x.post}))}/></div><Chart title="Assessment Performance — Pre vs Post" data={group(rows,'Assessment').map(x=>({label:x.key,value:x.p}))}/><WayForward rows={rows} scope={page} f={f}/></>}
function ChildPerformanceHighlights({rows,level}:{rows:Rec[];level:'Local Board'|'REC'}){const key=level==='Local Board'?'LocalBoard':'REC';const map=new Map<string,Rec[]>();rows.filter(r=>r[key]).forEach(r=>{const id=level==='Local Board'?[norm(r.Region),norm(r.LocalBoard)].join('||'):[norm(r.Region),norm(r.LocalBoard),norm(r.REC)].join('||');if(!map.has(id))map.set(id,[]);map.get(id)!.push(r)});const ranked=[...map.entries()].map(([id,rs])=>({id,label:level==='Local Board'?(rs[0].LocalBoard+(rs[0].Region?' · '+displayGeo(rs[0].Region):'')):(rs[0].REC+(rs[0].LocalBoard?' · '+rs[0].LocalBoard:'')),pre:aggregate(rs.filter(r=>r.Assessment==='Pre')).p,post:aggregate(rs.filter(r=>r.Assessment==='Post')).p,overall:aggregate(rs).p})).sort((a,b)=>b.overall-a.overall);const top=ranked[0],weak=ranked[ranked.length-1];return <section className="card performance-highlights"><h2>{level} Performance Highlights</h2><p className="admin-note">Highest and lowest overall performance among the {level.toLowerCase()}s in this selection. Pre and Post percentages are calculated separately.</p>{!ranked.length?<div className="empty">No matching data</div>:<div className="highlight-grid">{[[`Top-performing ${level.toLowerCase()}`,top],[`${level} needing most support`,weak]].map(([label,item]:any)=><div key={label}><span>{label}</span><strong>{item.label}</strong><span>Pre: {fmt(item.pre)} · Post: {fmt(item.post)}</span></div>)}</div>}</section>}

function count(rows:Rec[],item:string,pt:string,key:'LocalBoard'|'REC'|'ThemeID'|'DimensionID'){return new Set(rows.filter(r=>r.ParticipantType===pt&&norm(r[key])===item).map(r=>r.RecordID)).size}
function RecAnalysis({rows,f}:{rows:Rec[];f:any}){return <><Kpis rows={rows}/><div className="grid2"><CompareChart title="Theme Performance — Pre vs Post" data={compareGroup(rows,'ThemeID').map(x=>({label:labelTheme(x.key),pre:x.pre,post:x.post}))}/><CompareChart title="Dimension Performance — Pre vs Post" data={compareGroup(rows,'DimensionID').map(x=>({label:labelDim(x.key),pre:x.pre,post:x.post}))}/></div><Chart title="Assessment Performance — Pre vs Post" data={group(rows,'Assessment').map(x=>({label:x.key,value:x.p}))}/><WayForward rows={rows} scope="rec" f={f}/></>}
function ThemeAnalysis({rows}:{rows:Rec[]}){return <><Kpis rows={rows}/><section className="card"><h2>Theme Performance</h2><table><thead><tr><th>Theme</th><th>Students</th><th>Teachers</th><th>Overall</th><th>UA</th><th>A</th><th>Pre</th><th>Post</th></tr></thead><tbody>{unique(rows,'ThemeID').map(t=><tr key={t}><td>{labelTheme(t)}</td><td>{count(rows,t,'Student','ThemeID')}</td><td>{count(rows,t,'Teacher','ThemeID')}</td><td>{fmt(aggregate(rows.filter(r=>r.ThemeID===t)).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.ThemeID===t&&r.DimensionID==='UA')).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.ThemeID===t&&r.DimensionID==='A')).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.ThemeID===t&&r.Assessment==='Pre')).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.ThemeID===t&&r.Assessment==='Post')).p)}</td></tr>)}</tbody></table></section><div className="grid2"><Chart title="Theme Performance" data={group(rows,'ThemeID').map(x=>({label:labelTheme(x.key),value:x.p}))}/><Chart title="Dimension Performance" data={group(rows,'DimensionID').map(x=>({label:labelDim(x.key),value:x.p}))}/></div></>}
function DimensionAnalysis({rows}:{rows:Rec[]}){return <><Kpis rows={rows}/><section className="card"><h2>Dimension Performance</h2><table><thead><tr><th>Dimension</th><th>Students</th><th>Teachers</th><th>Overall</th><th>Pre</th><th>Post</th></tr></thead><tbody>{unique(rows,'DimensionID').map(d=><tr key={d}><td>{labelDim(d)}</td><td>{count(rows,d,'Student','DimensionID')}</td><td>{count(rows,d,'Teacher','DimensionID')}</td><td>{fmt(aggregate(rows.filter(r=>r.DimensionID===d)).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.DimensionID===d&&r.Assessment==='Pre')).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.DimensionID===d&&r.Assessment==='Post')).p)}</td></tr>)}</tbody></table></section><div className="grid2"><Chart title="UA vs A" data={group(rows,'DimensionID').map(x=>({label:labelDim(x.key),value:x.p}))}/><Chart title="Pre / Post by Dimension" data={['Pre','Post'].map(a=>({label:a,value:aggregate(rows.filter(r=>r.Assessment===a)).p}))}/></div></>}
function PrePost({rows}:{rows:Rec[]}){const pre=aggregate(rows.filter(r=>r.Assessment==='Pre')).p,post=aggregate(rows.filter(r=>r.Assessment==='Post')).p;return <><Kpis rows={rows}/><section className="card"><h2>Overall Pre / Post</h2><table><thead><tr><th>Measure</th><th>Pre</th><th>Post</th><th>Change</th></tr></thead><tbody><tr><td>Overall</td><td>{fmt(pre)}</td><td>{fmt(post)}</td><td className={post-pre>=0?'positive':'negative'}>{(post-pre>=0?'+':'')+(post-pre).toFixed(1)} pp</td></tr><tr><td>Students</td><td>{fmt(aggregate(rows.filter(r=>r.ParticipantType==='Student'&&r.Assessment==='Pre')).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.ParticipantType==='Student'&&r.Assessment==='Post')).p)}</td><td>—</td></tr><tr><td>Teachers</td><td>{fmt(aggregate(rows.filter(r=>r.ParticipantType==='Teacher'&&r.Assessment==='Pre')).p)}</td><td>{fmt(aggregate(rows.filter(r=>r.ParticipantType==='Teacher'&&r.Assessment==='Post')).p)}</td><td>—</td></tr></tbody></table></section><div className="grid2"><Chart title="Overall Pre → Post" data={[{label:'Pre',value:pre},{label:'Post',value:post}]}/><Chart title="Theme Post" data={unique(rows,'ThemeID').map(t=>({label:labelTheme(t),value:aggregate(rows.filter(r=>r.ThemeID===t&&r.Assessment==='Post')).p}))}/></div><Chart title="Dimension Post" data={unique(rows,'DimensionID').map(d=>({label:labelDim(d),value:aggregate(rows.filter(r=>r.DimensionID===d&&r.Assessment==='Post')).p}))}/></>}

function GeoFields({refs,value,onChange}:{refs:Ref[];value:any;onChange:(x:any)=>void}){const regions=[...new Set(refs.map(r=>r.Region))].sort();const boards=[...new Set(refs.filter(r=>r.Region===value.region).map(r=>r.LocalBoard))].sort();const recs=[...new Set(refs.filter(r=>r.Region===value.region&&r.LocalBoard===value.board).map(r=>r.REC))].sort();return <div className="survey-grid"><Field label="Region" required><select value={value.region} onChange={e=>onChange({...value,region:e.target.value,board:'',rec:''})}><option value="">Select region</option>{regions.map(x=><option key={x} value={x}>{displayGeo(x)}</option>)}</select></Field><Field label="Local Board" required><select value={value.board} disabled={!value.region} onChange={e=>onChange({...value,board:e.target.value,rec:''})}><option value="">Select Local Board</option>{boards.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="REC" required><select value={value.rec} disabled={!value.board} onChange={e=>onChange({...value,rec:e.target.value})}><option value="">Select REC</option>{recs.map(x=><option key={x}>{x}</option>)}</select></Field></div>}
function Field({label,required,children,wide}:{label:string;required?:boolean;children:React.ReactNode;wide?:boolean}){return <label className={wide?'field wide':'field'}><span>{label}{required&&<em> *</em>}</span>{children}</label>}
function useSurveyState(key:string,initial:any){const [v,setV]=useState<any>(()=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')||initial}catch{return initial}});useEffect(()=>{sessionStorage.setItem(key,JSON.stringify(v))},[key,v]);return [v,setV] as const}

function StudentSurvey({ refs, user }: { refs: Ref[]; user: AppUser | null }) {
  const initial: any = {
    region: '',
    board: '',
    rec: '',
    childName: '',
    gender: '',
    designation: '',
    otherDesignation: '',
    theme: '',
    assessment: 'Pre',
    themes: {}
  };

  const [v, setV] = useSurveyState('kgii_student_survey_draft', initial);
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


  const update = (x: any) => setV(x);

  
const save = async (finishAssessment: boolean) => {
  const assessment = v.assessment || 'Pre';
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
    item =>
      String(item.themeName || '').trim().toLowerCase() ===
        themeName.trim().toLowerCase() &&
      String(item.assessment || '').trim().toLowerCase() ===
        assessment.toLowerCase()
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

    setLookupMatches(previous => [
      ...previous,
      {
        submissionId: result.submissionId || '',
        name: v.childName.trim(),
        themeName,
        assessment,
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
        <div className="section-head">
          <div>
            <h2>Student Survey</h2>
            <p>
              Complete the child assessment survey. Evidence upload is not
              included.
            </p>
          </div>
        </div>

        <GeoFields refs={refs} value={v} onChange={update} />

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

          <div className="lookup-action">
  <button
    type="button"
    className="secondary lookup-button"
    onClick={lookupChild}
    disabled={lookupLoading || saving}
  >
    {lookupLoading ? 'Searching…' : 'Find Existing Child'}
  </button>
</div>


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

          <Field label="Assessment Stage" required>
            <select
              value={v.assessment || 'Pre'}
              onChange={e =>
                update({ ...v, assessment: e.target.value })
              }
            >
              <option value="Pre">Pre</option>
              <option value="Post">Post</option>
            </select>
          </Field>
        </div>
      </section>

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
</div>
);
}


function StudentTheme({theme,index,state,setState}:{theme:string;index:number;state:any;setState:(x:any)=>void}){const acts=studentActivities[theme];const toggle=(a:string)=>setState({...state,activities:state.activities.includes(a)?state.activities.filter((x:string)=>x!==a):[...state.activities,a]});return <section className="card survey-theme"><h2>Theme {index}</h2><Field label="Activities used"><div className="check-grid">{acts.map((a:string)=><label className="check" key={a}><input type="checkbox" checked={state.activities.includes(a)} onChange={()=>toggle(a)}/><span>{a}</span></label>)}</div></Field>{state.activities.includes('any other')||state.activities.includes('Any other')?<Field label="Please specify other activity"><input value={state.otherActivity||''} onChange={e=>setState({...state,otherActivity:e.target.value})}/></Field>:null}<div className="indicator-list">{(studentIndicators as any)[theme].map((q:string,i:number)=><div className="indicator" key={i}><div><b>{i+1}.</b> {q}</div><select value={state.ratings[i]||''} onChange={e=>setState({...state,ratings:{...state.ratings,[i]:e.target.value}})}><option value="">Select rating</option>{rating3.map(r=><option key={r}>{r}</option>)}</select></div>)}</div><Field label={`Remarks on Theme ${index}`}><textarea rows={4} value={state.remarks||''} onChange={e=>setState({...state,remarks:e.target.value})}/></Field></section>}


function TeacherSurvey({ refs, user }: { refs: Ref[]; user: AppUser | null }) {
  const initial: any = {
    region: '',
    board: '',
    rec: '',
    teacherName: '',
    positions: [],
    years: '',
    training: '',
    otherTraining: '',
    assessmentConducted: '',
    theme: '',
    ratings: { pre: '', post: '' },
    filler: ''
  };

  const [v, setV] = useSurveyState('kgii_teacher_survey_draft', initial);
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
      v.assessmentConducted &&
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
    // Check the latest saved records before submitting.
    const lookup = await apiPost('lookupsurvey', {
      userEmail: user?.email || '',
      participantType: 'Teacher',
      region: v.region,
      localBoard: v.board,
      rec: v.rec,
      teacherName: v.teacherName.trim()
    });

    const latestMatches = Array.isArray(lookup.matches)
      ? lookup.matches
      : [];

    setLookupMatches(latestMatches);

    const duplicate = latestMatches.some(
      (item: any) =>
        String(item.themeName || '').trim().toLowerCase() ===
        themeName.trim().toLowerCase()
    );

    if (duplicate) {
      setMsg(
        `A submission already exists for ${themeName} for this teacher in this REC. Please select another theme.`
      );
      setLookupMsg('Previous submissions have been refreshed.');
      return;
    }

    const result = await apiPost('teachersurvey', {
      userEmail: user?.email || '',
      region: v.region,
      localBoard: v.board,
      rec: v.rec,
      teacherName: v.teacherName.trim(),
      teacherPosition: v.positions.join(', '),
      otherPosition: v.positions.includes('Other') ? 'Other' : '',
      yearsTeaching: v.years,
      trainingAttended: v.training,
      otherTraining: v.otherTraining || '',
      assessmentContext: v.assessmentConducted,
      themeID: v.theme,
      themeName,
      preRating: teacherScore(v.ratings.pre),
      postRating: teacherScore(v.ratings.post),
      fillerName: v.filler.trim(),
      fillerDesignation: ''
    });

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
        <h2>Teacher Survey</h2>
        <p>
          Complete the teacher survey. Rubric descriptions are shown with
          each rating level.
        </p>

        <GeoFields refs={refs} value={v} onChange={setV} />

        <div className="survey-grid">
          
<Field label="Name of teacher" required>
  <input
    value={v.teacherName}
    onChange={e => {
      setV({ ...v, teacherName: e.target.value });
      setLookupMatches([]);
      setLookupMsg('');
    }}
  />
</Field>


<div className="lookup-action">
  <button
    type="button"
    className="secondary lookup-button"
    onClick={lookupTeacher}
    disabled={lookupLoading || saving}
  >
    {lookupLoading ? 'Searching…' : 'Find Existing Teacher'}
  </button>
</div>


{lookupMsg && (
  <p className="form-message">{lookupMsg}</p>
)}

{lookupMatches.length > 0 && (
  <section className="card">
    <h3>Previous Teacher Submissions</h3>

    {lookupMatches.map((item, index) => (
      <div
        key={`${item.submissionId || 'record'}-${index}`}
        style={{
          borderBottom: '1px solid #ddd',
          padding: '12px 0'
        }}
      >
        <strong>{item.name || v.teacherName}</strong>
        <p>Theme: {item.themeName || 'Not recorded'}</p>
        <p>
          Pre rating: {item.preRating ?? 'Not recorded'}
          {' · '}
          Post rating: {item.postRating ?? 'Not recorded'}
        </p>
        <p>
          Submitted: {item.submittedAt || 'Date unavailable'}
        </p>
        <p>
          Submission ID: {item.submissionId || 'Not recorded'}
        </p>
      </div>
    ))}
  </section>
)}

          <Field label="Position of teacher" required>
            <div className="check-grid">
              {['ECED Coordinator', 'ECED Educator', 'ECED Teacher', 'Other'].map(a => (
                <label className="check" key={a}>
                  <input
                    type="checkbox"
                    checked={v.positions.includes(a)}
                    onChange={() =>
                      setV({
                        ...v,
                        positions: v.positions.includes(a)
                          ? v.positions.filter((x: string) => x !== a)
                          : [...v.positions, a]
                      })
                    }
                  />
                  <span>{a}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="No. of years of teaching in RECs" required>
            <select
              value={v.years}
              onChange={e => setV({ ...v, years: e.target.value })}
            >
              <option value="">Select</option>
              {['0-1 year', '2-3 years', '3-5 years', '5-10 years', 'more than 10 years'].map(x => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>

          <Field label="Training attended by ITREB" required>
            <select
              value={v.training}
              onChange={e => setV({ ...v, training: e.target.value })}
            >
              <option value="">Select</option>
              {["Teacher's training", 'refresher', 'No', 'other'].map(x => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>

          {v.training === 'other' && (
            <Field label="If other, please mention about training" required>
              <input
                value={v.otherTraining}
                onChange={e => setV({ ...v, otherTraining: e.target.value })}
              />
            </Field>
          )}

          <Field label="Select when this assessment conducted" required>
            <select
              value={v.assessmentConducted}
              onChange={e =>
                setV({ ...v, assessmentConducted: e.target.value })
              }
            >
              <option value="">Select</option>
              <option>Teachers training</option>
              <option>mentoring session</option>
            </select>
          </Field>

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
        </div>
      </section>

      {v.theme && (
        <TeacherRubric
          theme={v.theme}
          value={v.ratings}
          onChange={(ratings: any) => setV({ ...v, ratings })}
        />
      )}

      <section className="card">
        <Field
          label="Name of the person filling this form with designation"
          required
        >
          <input
            value={v.filler}
            onChange={e => setV({ ...v, filler: e.target.value })}
          />
        </Field>
      </section>

      
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

    </div>
  );
}

function TeacherRubric({theme,value,onChange}:{theme:string;value:any;onChange:(x:any)=>void}){const rubric=teacherRubrics[theme];return <section className="card survey-theme"><h2>{labelTheme(theme)} — Pre / Post Rubrics</h2><div className="rubric-grid">{(['pre','post'] as const).map(which=><div className="rubric-box" key={which}><h3>{which==='pre'?'Pre-Assessment Rubric':'Post-Assessment Rubric'}</h3><div className="rubric-options">{rubric[which].map((r:any)=><label className="rubric-option" key={r[0]}><input type="radio" name={`${theme}-${which}`} checked={value[which]===r[0]} onChange={()=>onChange({...value,[which]:r[0]})}/><span><b>{r[0]}</b><small>{r[1]}</small></span></label>)}</div></div>)}</div></section>}

createRoot(document.getElementById('root')!).render(<App/>);
