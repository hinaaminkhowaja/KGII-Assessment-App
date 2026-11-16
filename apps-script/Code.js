const CONFIG = {
  USERS_SHEET: 'APP_Users',
  ACCESS_SHEET: 'APP_Access',
  STUDENT_SURVEYS_SHEET: 'APP_Student_Surveys',
  TEACHER_SURVEYS_SHEET: 'APP_Teacher_Surveys',
  CONFIG_SHEET: 'APP_Config',
  RESOURCES_SHEET: 'APP_Resources',
  RESOURCES_FOLDER_ID: '11C7JI6RQ5PGOT1nE1wy7snefEvdhuRGD'
};


/* =========================================================
   API ENTRY
========================================================= */

function doGet(e) {
  try {
    const action = e && e.parameter
      ? String(e.parameter.action || '').trim().toLowerCase()
      : '';

    let result;

    switch (action) {
      case 'directory':
        result = getRecDirectoryData();
        break;

      case 'surveyclassification':
        result = handleSurveyClassification_(e);
        break;
      case 'surveysummary':
        result = handlePublicSurveySummary_(e);
        break;

      case 'login':
        result = handleApiLogin(e);
        break;

      case 'dashboard':
        result = handleApiDashboard(e);
        break;

      case 'users':
        result = handleApiUsers(e);
        break;

      case 'access':
        result = handleApiAccess(e);
        break;
      
      case 'pushsubscriptions':
        result = handleListPushSubscriptions(e);
        break;


      case 'resources':
        result = handleListResources(e);
        break;

      default:
        result = {
          success: true,
          service: 'KG II Assessment API',
          status: 'running',
          availableActions: [
            'directory',
            'login',
            'dashboard',
            'users',
            'access',
            'resources'
          ]
        };
    }

    return jsonResponse(result);

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    });
  }
}


/* =========================================================
   POST API
========================================================= */

function doPost(e) {
  try {
    const action = e && e.parameter
      ? String(e.parameter.action || '').trim().toLowerCase()
      : '';

    const body = parsePostBody(e);

    let result;

    switch (action) {

      case 'studentsurvey':
        result = handleStudentSurvey(body);
        break;

      case 'teachersurvey':
        if (
        clean(body.cycleID).toLowerCase() === 'cycle 2' ||
        clean(body.cycleID).toUpperCase() === 'C2'
        ) {
        result = handleTeacherSurveyCycle2_(body);
        } else {
        result = handleTeacherSurvey(body);
        }
        break;

      case 'createuser':
        result = handleCreateUser(body);
        break;
      
      case 'createloginrequest':
        result = handleCreateLoginRequest(body);
        break;
      
      case 'registerpushsubscription':
        result = handleRegisterPushSubscription(body);
        break;

      case 'updateuser':
        result = handleUpdateUser(body);
        break;

      case 'saveaccess':
        result = handleSaveAccess(body);
        break;

      case 'uploadresource':
        result = handleUploadResource(body);
        break;

      case 'updateresource':
        result = handleUpdateResource(body);
        break;

      case 'deleteresource':
        result = handleDeleteResource(body);
        break;

        
      case 'lookupsurvey':
        result = handleSurveyLookup(body);
        break;


      default:
  result = {
    success: false,
    message: 'Unknown POST action received: [' + action + ']'
  };
  break;
    }

    return jsonResponse(result);

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    });
  }
}


/* =========================================================
   COMMON HELPERS
========================================================= */

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


function parsePostBody(e) {

  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const raw = String(e.postData.contents || '').trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON request.');
  }
}


function getApiEmail(e) {

  if (!e || !e.parameter) {
    return '';
  }

  return String(e.parameter.email || '')
    .trim()
    .toLowerCase();
}


function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}


function clean(value) {
  return String(value == null ? '' : value).trim();
}


function newSubmissionId(prefix) {
  return prefix + '-' +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMdd-HHmmss'
    ) +
    '-' +
    Utilities.getUuid().substring(0, 8);
}


/* =========================================================
   USERS
========================================================= */

function getUserByEmail(email) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.USERS_SHEET);

  if (!sheet) {
    throw new Error('APP_Users sheet not found.');
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return {
      success: false,
      message: 'No users are registered yet.'
    };
  }

  const headers = data[0];
  const emailCol = headers.indexOf('Email');
  const nameCol = headers.indexOf('Name');
  const roleCol = headers.indexOf('Role');
  const statusCol = headers.indexOf('Status');

  if ([emailCol, nameCol, roleCol, statusCol].some(i => i < 0)) {
    throw new Error('APP_Users headers are incorrect.');
  }

  const searchEmail = normalizeEmail(email);
  const matches = data.slice(1)
    .filter(row => normalizeEmail(row[emailCol]) === searchEmail);

  if (!matches.length) {
    return { success: false, message: 'User not found.' };
  }

  // An email can appear more than once if old test/user rows were retained.
  // Prefer an approved Admin row so an administrator is never silently
  // downgraded to a restricted user scope by an earlier duplicate row.
  const approvedAdmin = matches.find(row =>
    clean(row[roleCol]).toLowerCase() === 'admin' &&
    clean(row[statusCol]).toLowerCase() === 'approved'
  );
  const approvedMatch = matches.find(row =>
    clean(row[statusCol]).toLowerCase() === 'approved'
  );
  const row = approvedAdmin || approvedMatch || matches[0];

  return {
    success: true,
    user: {
      name: row[nameCol],
      email: row[emailCol],
      role: row[roleCol],
      status: row[statusCol]
    }
  };
}


function getAllUsers() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.USERS_SHEET);

  if (!sheet) {
    throw new Error('APP_Users sheet not found.');
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];

  const idCol = headers.indexOf('ID');
  const nameCol = headers.indexOf('Name');
  const emailCol = headers.indexOf('Email');
  const roleCol = headers.indexOf('Role');
  const statusCol = headers.indexOf('Status');
  const createdCol = headers.indexOf('CreatedAt');

  return values.slice(1)
    .filter(row => clean(row[emailCol]))
    .map(row => ({
      id: idCol >= 0 ? row[idCol] : '',
      name: row[nameCol],
      email: row[emailCol],
      role: row[roleCol],
      status: row[statusCol],
      createdAt: createdCol >= 0 ? row[createdCol] : ''
    }));
}


/* =========================================================
   ACCESS
========================================================= */

function getUserAccess(email) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACCESS_SHEET);

  if (!sheet) {
    throw new Error('APP_Access sheet not found.');
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return [];
  }

  const headers = data[0];

  const nameCol = headers.indexOf('Name');
  const emailCol = headers.indexOf('Email');
  const regionCol = headers.indexOf('Region');
  const lbCol = headers.indexOf('LocalBoard');
  const recCol = headers.indexOf('REC');
  const activeCol = headers.indexOf('Active');

  if (
    nameCol === -1 ||
    emailCol === -1 ||
    regionCol === -1 ||
    lbCol === -1 ||
    recCol === -1 ||
    activeCol === -1
  ) {
    throw new Error('APP_Access headers are incorrect.');
  }

  const searchEmail = normalizeEmail(email);

  const access = [];

  for (let i = 1; i < data.length; i++) {

    const rowEmail = normalizeEmail(data[i][emailCol]);
    const active = clean(data[i][activeCol]).toLowerCase();

    if (
      rowEmail === searchEmail &&
      (active === 'true' || active === 'yes' || active === '1')
    ) {

      access.push({
        name: data[i][nameCol],
        email: data[i][emailCol],
        region: data[i][regionCol],
        localBoard: data[i][lbCol],
        rec: data[i][recCol]
      });
    }
  }

  return access;
}


function getAllAccess() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACCESS_SHEET);

  if (!sheet) {
    throw new Error('APP_Access sheet not found.');
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];

  const nameCol = headers.indexOf('Name');
  const emailCol = headers.indexOf('Email');
  const regionCol = headers.indexOf('Region');
  const lbCol = headers.indexOf('LocalBoard');
  const recCol = headers.indexOf('REC');
  const activeCol = headers.indexOf('Active');

  return values.slice(1)
    .filter(row => clean(row[emailCol]))
    .map(row => ({
      name: row[nameCol],
      email: row[emailCol],
      region: row[regionCol],
      localBoard: row[lbCol],
      rec: row[recCol],
      active: row[activeCol]
    }));
}


/* =========================================================
   LOGIN
========================================================= */


function updateLastLogin(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Users');

  if (!sheet) {
    throw new Error('APP_Users sheet was not found.');
  }

  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2 || lastColumn < 1) {
    throw new Error('APP_Users has no user records.');
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(h => String(h).trim());

  const emailCol = headers.indexOf('Email') + 1;
  const lastLoginCol = headers.indexOf('LastLogin') + 1;

  if (!emailCol) {
    throw new Error('Email column was not found.');
  }

  if (!lastLoginCol) {
    throw new Error('LastLogin column was not found.');
  }

  const emails = sheet
    .getRange(2, emailCol, lastRow - 1, 1)
    .getDisplayValues();

  const targetEmail = String(email).trim().toLowerCase();

  for (let i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).trim().toLowerCase() === targetEmail) {
      sheet.getRange(i + 2, lastLoginCol)
        .setValue(new Date())
        .setNumberFormat('dd/MM/yyyy hh:mm:ss AM/PM');
      SpreadsheetApp.flush();
      return;
    }
  }

  throw new Error('User email was not found in APP_Users.');
}


function login(email) {
  const userResult = getUserByEmail(email);

  if (!userResult.success) {
    return userResult;
  }

  const user = userResult.user;

  if (clean(user.status).toLowerCase() !== 'approved') {
    return {
      success: false,
      message: 'Your account has not been approved.'
    };
  }

  let access = 'ALL';

  if (clean(user.role).toLowerCase() !== 'admin') {
    access = getUserAccess(user.email);

    if (access.length === 0) {
      return {
        success: false,
        message: 'No active access has been assigned to this account.'
      };
    }
  }

  // Update LastLogin only after all login checks pass.
  try {
    updateLastLogin(user.email);
  } catch (error) {
    console.error('LastLogin update failed: ' + error.message);
    return {
      success: false,
      message: 'Login could not be completed because the last-login timestamp could not be saved. Please contact the administrator.'
    };
  }

  return {
    success: true,
    user: user,
    access: access
  };
}


function handleApiLogin(e) {
  const email = getApiEmail(e);

  if (!email) {
    return {
      success: false,
      message: 'Email is required.'
    };
  }

  return login(email);
}



/* =========================================================
   REFERENCE
========================================================= */


function getRecDirectoryData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('RECs_list_Phase_Wise');
  if (!sheet) throw new Error('RECs_list_Phase_Wise sheet not found.');

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('RECs_list_Phase_Wise has no REC rows.');

  const headers = values[0].map(h => String(h).trim());
  const requiredHeaders = ['Region', 'LocalBoard', 'REC', 'StartingYear', 'Status'];
  const indexes = {};
  requiredHeaders.forEach(header => {
    indexes[header] = headers.indexOf(header);
    if (indexes[header] < 0) throw new Error('Missing header in RECs_list_Phase_Wise: ' + header);
  });

  const targetRecs = values.slice(1)
    .filter(row => clean(row[indexes.Region]) && clean(row[indexes.LocalBoard]) && clean(row[indexes.REC]))
    .map(row => ({
      Region: clean(row[indexes.Region]).replace(/_\d+$/, ''),
      LocalBoard: clean(row[indexes.LocalBoard]),
      REC: clean(row[indexes.REC]),
      StartingYear: Number(clean(row[indexes.StartingYear])) || '',
      Status: clean(row[indexes.Status])
    }));

  const refs = targetRecs.map(row => ({
    Region: row.Region, LocalBoard: row.LocalBoard, REC: row.REC
  }));
  return { success: true, refs: refs, targetRecs: targetRecs };
}

/* =========================================================
   DASHBOARD
========================================================= */


/**
 * Legacy dashboard implementation retained for compatibility; the active
 * getDashboardData implementation below reads the six live source sheets
 * directly and does not depend on APP_Records or APP_Indicators.
 */
function handlePublicSurveySummary_(e) {
  const p = e && e.parameter ? e.parameter : {};
  const region = clean(p.region), board = clean(p.board), rec = clean(p.rec);
  const participant = clean(p.participantType);
  if (!region || !board || !rec || !['Student','Teacher'].includes(participant)) {
    throw new Error('Region, Local Board, REC and participant type are required.');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sources = participant === 'Student'
    ? ['Students Pre Assessment','Students Post Assessment','APP_Student_Surveys']
    : ['Teachers Assessment','APP_Teacher_Surveys','APP_Teacher_Surveys_Cycle2'];
  const norm = v => clean(v).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  const regionNorm = v => norm(v).replace(/\s+\d+$/,'');
  const themeNum = v => {
    const s=norm(v);
    if (/^(t)?1$/.test(s)||s.includes('authority and leadership')) return '1';
    if (/^(t)?2$/.test(s)||s.includes('intellectual traditions')||s.includes('ismaili muslim traditions')) return '2';
    if (/^(t)?3$/.test(s)||s.includes('role in family')) return '3';
    if (/^(t)?4$/.test(s)||s.includes('two aspects of life')) return '4';
    return '';
  };
  const totals = {};
  const add = (id, assessment, score, max, count) => {
    if (score === '' || score == null || !Number.isFinite(Number(score))) return;
    const stage = clean(assessment) || 'Post';
    const key=[id,stage].join('|');
    if(!totals[key]) totals[key]={themeID:id,assessment:stage,score:0,maxScore:0,indicatorResponses:0};
    totals[key].score+=Number(score);
    totals[key].maxScore+=Number(max)||0;
    totals[key].indicatorResponses+=Number(count)||1;
  };
  sources.forEach(sourceName => {
    const sh=ss.getSheetByName(sourceName);
    if(!sh||sh.getLastRow()<2) return;
    const data=sh.getDataRange().getValues(), h=data[0].map(clean);
    const find=(...names)=>h.findIndex(x=>names.some(n=>norm(x)===norm(n)));
    const ri=find('Region','1. Select your region','Select your region');
    const bi=find('LocalBoard','Local Board','Local Board (Standardized)','Name of Local Board');
    const ci=find('REC','REC (Standardized)','Name of RECs');
    const ai=find('Assessment','Select when this assessment conducted','AssessmentStage');
    const ti=find('ThemeName','Select the themes','Theme Name','ThemeID','Theme');
    const ratingCols=[];
    h.forEach((header,j)=>{const m=header.match(/^Theme([1-4]):(UA|A)\d+$/i);if(m)ratingCols.push({j,id:'T'+m[1]});});
    data.slice(1).forEach(row=>{
      if(ri<0||bi<0||ci<0||regionNorm(row[ri])!==regionNorm(region)||norm(row[bi])!==norm(board)||norm(row[ci])!==norm(rec)) return;
      let stage=ai>=0?clean(row[ai]):'';
      if(sourceName==='Students Pre Assessment') stage='Pre';
      if(sourceName==='Students Post Assessment'&&!stage) stage='Post';
      if(sourceName==='APP_Student_Surveys'&&!stage) stage='Post 2';
      if(participant==='Student'){
        const selectedTheme=ti>=0?themeNum(row[ti]):'';
        ratingCols.forEach(col=>{
          if(selectedTheme&&selectedTheme!==col.id.slice(1))return;
          const value=row[col.j];
          if(value===''||value==null||typeof value==='boolean')return;
          const n=Number(value);if(!Number.isFinite(n)||n<0||n>3)return;
          add(col.id,stage,n,3,1);
        });
      } else if(sourceName==='Teachers Assessment'){
        for(let n=1;n<=4;n++){
          ['Pre','Post'].forEach(st=>{
            const j=find(st+' Theme '+n+' Score');
            if(j>=0&&row[j]!==''&&row[j]!=null){
              const score=Number(row[j]);if(Number.isFinite(score)&&score>=1&&score<=4)add('T'+n,st,score,4,1);
            }
          });
        }
      } else if(sourceName==='APP_Teacher_Surveys'){
        const n=themeNum(ti>=0?row[ti]:'');
        if(n){
          const pre=find('PreRating'),post=find('PostRating');
          if(pre>=0)add('T'+n,'Pre',row[pre],4,1);
          if(post>=0)add('T'+n,'Post',row[post],4,1);
        }
      } else {
        // Teacher skills: each row contains three skill domains and their four indicator ratings.
        const skills=[
          {id:'S1',prefix:'Instructional'},
          {id:'S2',prefix:'Questioning'},
          {id:'S3',prefix:'Feedback'}
        ];
        skills.forEach(skill=>{
          const cols=[1,2,3,4].map(k=>find(skill.prefix+'_Indicator'+k)).filter(j=>j>=0);
          let score=0,count=0;
          cols.forEach(j=>{const v=row[j];if(v!==''&&v!=null&&Number.isFinite(Number(v))){score+=Number(v);count++;}});
          if(count)add(skill.id,stage,score,4*count,count);
        });
      }
    });
  });
  const groups=Object.values(totals).map(x=>Object.assign(x,{percent:x.maxScore?Math.round(x.score/x.maxScore*1000)/10:null}));
  return {success:true,region,board,rec,participantType:participant,groups};
}

function handleApiDashboard(e) {

  const email = getApiEmail(e);

  if (!email) {
    return {
      success: false,
      message: 'Email is required.'
    };
  }

  return getDashboardData(email);
}


/* =========================================================
   ADMIN API
========================================================= */

function requireAdmin(email) {

  const result = getUserByEmail(email);

  if (!result.success) {
    return {
      success: false,
      message: 'Administrator account not found.'
    };
  }

  const user = result.user;

  if (
    clean(user.status).toLowerCase() !== 'approved' ||
    clean(user.role).toLowerCase() !== 'admin'
  ) {
    return {
      success: false,
      message: 'Administrator authorization required.'
    };
  }

  return {
    success: true,
    user: user
  };
}


function handleApiUsers(e) {

  const email = getApiEmail(e);

  const admin = requireAdmin(email);

  if (!admin.success) {
    return admin;
  }

  return {
    success: true,
    users: getAllUsers()
  };
}


function handleApiAccess(e) {

  const email = getApiEmail(e);

  const admin = requireAdmin(email);

  if (!admin.success) {
    return admin;
  }

  return {
    success: true,
    access: getAllAccess()
  };
}


/* =========================================================
   CREATE USER
========================================================= */

function handleCreateUser(body) {

  const adminEmail = normalizeEmail(body.adminEmail);

  const admin = requireAdmin(adminEmail);

  if (!admin.success) {
    return admin;
  }

  const name = clean(body.name);
  const email = normalizeEmail(body.email);
  const role = clean(body.role) || 'Regional user';
  const status = clean(body.status) || 'Pending';

  if (!name || !email) {
    return {
      success: false,
      message: 'Name and email are required.'
    };
  }

  const existing = getUserByEmail(email);

  if (existing.success) {
    return {
      success: false,
      message: 'A user with this email already exists.'
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.USERS_SHEET);

  if (!sheet) {
    throw new Error('APP_Users sheet not found.');
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const row = new Array(headers.length).fill('');

  const idCol = headers.indexOf('ID');
  const nameCol = headers.indexOf('Name');
  const emailCol = headers.indexOf('Email');
  const roleCol = headers.indexOf('Role');
  const statusCol = headers.indexOf('Status');
  const createdCol = headers.indexOf('CreatedAt');

  if (nameCol === -1 || emailCol === -1 ||
      roleCol === -1 || statusCol === -1) {
    throw new Error('APP_Users headers are incorrect.');
  }

  if (idCol >= 0) {
    row[idCol] = 'USR-' + Utilities.getUuid().substring(0, 8);
  }

  row[nameCol] = name;
  row[emailCol] = email;
  row[roleCol] = role;
  row[statusCol] = status;

  if (createdCol >= 0) {
    row[createdCol] = new Date();
  }

  sheet.appendRow(row);

  return {
    success: true,
    message: 'User created successfully.'
  };
}


/* =========================================================
   UPDATE USER
========================================================= */


function handleUpdateUser(body) {
  const adminEmail = normalizeEmail(body.adminEmail || body.updatedBy);
  const admin = requireAdmin(adminEmail);

  if (!admin.success) return admin;

  const email = normalizeEmail(body.email);
  if (!email) {
    return { success: false, message: 'User email is required.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!sheet) throw new Error('APP_Users sheet not found.');

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) {
    throw new Error('APP_Users has no header row.');
  }

  const headers = values[0];
  const emailCol = headers.indexOf('Email');
  const nameCol = headers.indexOf('Name');
  const roleCol = headers.indexOf('Role');
  const statusCol = headers.indexOf('Status');

  if ([emailCol, nameCol, roleCol, statusCol].includes(-1)) {
    throw new Error('APP_Users headers are incorrect.');
  }

  for (let i = 1; i < values.length; i++) {
    if (normalizeEmail(values[i][emailCol]) === email) {
      if (body.name !== undefined) {
        sheet.getRange(i + 1, nameCol + 1)
          .setValue(clean(body.name));
      }

      if (body.role !== undefined) {
        sheet.getRange(i + 1, roleCol + 1)
          .setValue(clean(body.role));
      }

      if (body.status !== undefined) {
        sheet.getRange(i + 1, statusCol + 1)
          .setValue(clean(body.status));
      }

      return {
        success: true,
        message: 'User updated successfully.'
      };
    }
  }

  return { success: false, message: 'User not found.' };
}



/* =========================================================
   SAVE ACCESS
========================================================= */


function handleSaveAccess(body) {
  const adminEmail = normalizeEmail(body.adminEmail || body.updatedBy);
  const admin = requireAdmin(adminEmail);

  if (!admin.success) return admin;

  const email = normalizeEmail(body.email);
  if (!email) {
    return { success: false, message: 'User email is required.' };
  }

  const userResult = getUserByEmail(email);
  if (!userResult.success) {
    return { success: false, message: 'User not found.' };
  }

  const user = userResult.user;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sheet) throw new Error('APP_Access sheet not found.');

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) {
    throw new Error('APP_Access has no header row.');
  }

  const headers = values[0];
  const nameCol = headers.indexOf('Name');
  const emailCol = headers.indexOf('Email');
  const regionCol = headers.indexOf('Region');
  const lbCol = headers.indexOf('LocalBoard');
  const recCol = headers.indexOf('REC');
  const activeCol = headers.indexOf('Active');

  if ([nameCol, emailCol, regionCol, lbCol, recCol, activeCol].includes(-1)) {
    throw new Error('APP_Access headers are incorrect.');
  }

  // Support either an array of scopes or the single scope
  // sent by the current React app.
  const scopes = Array.isArray(body.access)
    ? body.access
    : [{
        region: body.region,
        localBoard: body.localBoard,
        rec: body.rec,
        active: body.active !== false
      }];

  const newlyGranted = [];

  for (const scope of scopes) {
    const region = clean(scope.region);
    const board = clean(scope.localBoard || scope.board);
    const rec = clean(scope.rec);
    const active = scope.active !== false;

    if (!region && (board || rec)) {
      return { success: false, message: 'When Region is All, Local Board and REC must also be All.' };
    }

    let found = false;
    let wasActive = false;

    // Find this exact assignment without changing the user's other scopes.
    for (let i = 1; i < values.length; i++) {
      const sameUser =
        normalizeEmail(values[i][emailCol]) === email;
      const sameScope =
        clean(values[i][regionCol]) === region &&
        clean(values[i][lbCol]) === board &&
        clean(values[i][recCol]) === rec;

      if (sameUser && sameScope) {
        found = true;
        const currentActive = clean(values[i][activeCol]).toLowerCase();
        wasActive = wasActive ||
          currentActive === 'true' ||
          currentActive === 'yes' ||
          currentActive === '1';
        sheet.getRange(i + 1, activeCol + 1).setValue(active);
      }
    }

    // A notification is due only when an active permission is newly granted.
    if (active && (!found || !wasActive)) {
      newlyGranted.push({
        region: region,
        localBoard: board,
        rec: rec
      });
    }

    // Add the scope if it does not already exist and is being enabled.
    if (!found && active) {
      const row = new Array(headers.length).fill('');
      row[nameCol] = user.name;
      row[emailCol] = email;
      row[regionCol] = region;
      row[lbCol] = board;
      row[recCol] = rec;
      row[activeCol] = true;
      sheet.appendRow(row);
    }
  }

  // Permissions are saved first. Email failure must not undo a valid assignment.
  let notification = {
    attempted: false,
    sent: false
  };

  if (newlyGranted.length) {
    notification = sendAccessGrantedEmail_(user, newlyGranted);
  }

  return {
    success: true,
    message: 'Access updated successfully.',
    notification: notification
  };
}


/**
 * Sends a notification only after a new or re-enabled access scope is saved.
 * Set the optional APP_URL script property to include the application link.
 */
function sendAccessGrantedEmail_(user, accessScopes) {
  const recipient = normalizeEmail(user && user.email);
  if (!recipient) {
    return {
      attempted: true,
      sent: false,
      error: 'The user does not have a valid email address.'
    };
  }

  try {
    const appUrl = PropertiesService.getScriptProperties().getProperty('APP_URL') || '';
    const scopeLines = accessScopes.map(function(scope) {
      return [
        'Region: ' + scope.region,
        'Local Board: ' + (scope.localBoard || 'All Local Boards'),
        'REC: ' + (scope.rec || 'All RECs under the selected level')
      ].join('\n');
    });

    const subject = 'KG II Assessment App — Access Granted';
    const greeting = clean(user.name) || 'User';
    let bodyText =
      'Dear ' + greeting + ',\n\n' +
      'Your access to the KG II Assessment App has been successfully granted.\n\n' +
      'Your assigned access:\n\n' + scopeLines.join('\n\n') + '\n\n';

    if (appUrl) {
      bodyText += 'Open the application: ' + appUrl + '\n\n';
    } else {
      bodyText += 'Please open the KG II Assessment App using the application link shared by your administrator.\n\n';
    }

    bodyText +=
      'Please sign in using this registered email address: ' + recipient + '\n\n' +
      'For assistance, please contact the application administrator.\n\n' +
      'Regards,\nKG II Assessment App Administration';

    const escapeHtml = function(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const scopeHtml = accessScopes.map(function(scope) {
      return '<li><strong>Region:</strong> ' + escapeHtml(scope.region) +
        '<br><strong>Local Board:</strong> ' + escapeHtml(scope.localBoard || 'All Local Boards') +
        '<br><strong>REC:</strong> ' + escapeHtml(scope.rec || 'All RECs under the selected level') +
        '</li>';
    }).join('');

    const linkHtml = appUrl
      ? '<p><a href="' + escapeHtml(appUrl) + '">Open KG II Assessment App</a></p>'
      : '<p>Please use the application link shared by your administrator.</p>';

    const htmlBody =
      '<p>Dear ' + escapeHtml(greeting) + ',</p>' +
      '<p>Your access to the <strong>KG II Assessment App</strong> has been successfully granted.</p>' +
      '<p><strong>Your assigned access:</strong></p><ul>' + scopeHtml + '</ul>' +
      linkHtml +
      '<p>Please sign in using this registered email address: ' + escapeHtml(recipient) + '</p>' +
      '<p>For assistance, please contact the application administrator.</p>' +
      '<p>Regards,<br>KG II Assessment App Administration</p>';

    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: bodyText,
      htmlBody: htmlBody,
      name: 'KG II Assessment App'
    });

    return {
      attempted: true,
      sent: true,
      recipient: recipient
    };
  } catch (error) {
    console.error('Access notification email failed for ' + recipient + ': ' + error.message);
    return {
      attempted: true,
      sent: false,
      recipient: recipient,
      error: error.message || 'Email could not be sent.'
    };
  }
}


/**
 * Run this function once from the Apps Script editor as the script owner.
 * It prompts for the MailApp permission required by access notifications.
 */
function authorizeAccessNotificationEmail_() {
  const remainingQuota = MailApp.getRemainingDailyQuota();
  console.log('MailApp authorization checked. Remaining daily recipient quota: ' + remainingQuota);
}



/* =========================================================
   AUTHORIZATION FOR SURVEYS
========================================================= */

function verifyApprovedUser(email) {

  const result = getUserByEmail(email);

  if (!result.success) {
    return result;
  }

  const user = result.user;

  if (
    clean(user.status).toLowerCase() !== 'approved'
  ) {
    return {
      success: false,
      message: 'Your account has not been approved.'
    };
  }

  return {
    success: true,
    user: user
  };
}


function userCanAccessLocation(
  email,
  region,
  localBoard,
  rec
) {

  const userResult = verifyApprovedUser(email);

  if (!userResult.success) {
    return userResult;
  }

  const user = userResult.user;

  if (
    clean(user.role).toLowerCase() === 'admin'
  ) {
    return {
      success: true
    };
  }

  const access = getUserAccess(email);

  const allowed = access.some(scope => {

    const scopeRegion = clean(scope.region);
    const scopeLB = clean(scope.localBoard);
    const scopeREC = clean(scope.rec);

    if (
      scopeRegion &&
      clean(region) !== scopeRegion
    ) {
      return false;
    }

    if (
      scopeLB &&
      clean(localBoard) !== scopeLB
    ) {
      return false;
    }

    if (
      scopeREC &&
      clean(rec) !== scopeREC
    ) {
      return false;
    }

    return true;
  });

  if (!allowed) {
    return {
      success: false,
      message: 'You do not have access to this location.'
    };
  }

  return {
    success: true
  };
}


/* =========================================================
   SURVEY HELPERS — NEW NORMALIZED RECORDS
========================================================= */

function surveyConfigValue_(settingName, fallback) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.CONFIG_SHEET);

  if (!sheet) return fallback;

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return fallback;

  const headers = data[0];
  const settingCol = headers.indexOf('Setting');
  const valueCol = headers.indexOf('Value');

  if (settingCol < 0 || valueCol < 0) return fallback;

  for (let i = 1; i < data.length; i++) {
    if (clean(data[i][settingCol]) === settingName) {
      return data[i][valueCol] === '' ? fallback : data[i][valueCol];
    }
  }

  return fallback;
}


function getRecStartingYear_(region, localBoard, rec) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RECs_list_Phase_Wise');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => clean(h).toLowerCase());
  const col = name => headers.indexOf(name.toLowerCase());
  const ri=col('Region'), bi=col('LocalBoard'), ci=col('REC'), yi=col('StartingYear'), si=col('Status');
  if ([ri,bi,ci,yi].some(i=>i<0)) throw new Error('REC directory requires Region, LocalBoard, REC and StartingYear.');
  const key = v => clean(v).toLowerCase().replace(/[_-]+/g,' ').replace(/\\s+/g,' ').trim();
  for (const row of values.slice(1)) {
    const status=si>=0?clean(row[si]).toLowerCase():'active';
    if (status && !['active','yes','true','1'].includes(status)) continue;
    if (key(row[ri])===key(region) && key(row[bi])===key(localBoard) && key(row[ci])===key(rec)) {
      return Number(row[yi])||0;
    }
  }
  return 0;
}

function handleSurveyClassification_(e) {
  const p = e && e.parameter ? e.parameter : {};
  const participantType = clean(p.participantType || 'Student');
  const themeID = clean(p.themeID);
  if (!clean(p.region) || !clean(p.localBoard) || !clean(p.rec)) {
    throw new Error('Region, Local Board and REC are required for classification.');
  }
  const startingYear = getRecStartingYear_(p.region, p.localBoard, p.rec);
  if (!startingYear) throw new Error('REC StartingYear was not found in RECs_list_Phase_Wise.');

  if (participantType.toLowerCase() === 'student') {
    if (startingYear >= 2026) {
      return {success:true, assessment:'Pre', startingYear, classificationBasis:'REC StartingYear'};
    }
    if (startingYear === 2025) {
      const alreadyPosted = themeID && recThemeHasPostSubmission_(p.region, p.localBoard, p.rec, themeID);
      return {success:true, assessment:alreadyPosted ? 'Post 2' : 'Post', startingYear,
        classificationBasis:'REC StartingYear + prior theme submissions'};
    }
  }

  if (participantType.toLowerCase() === 'teacher') {
    return {success:true, startingYear, availableAssessments: startingYear === 2025
      ? ['Content Assessment', 'Teacher Skills Assessment']
      : ['Content Assessment'], classificationBasis:'REC StartingYear'};
  }
  return {success:true, startingYear, classificationBasis:'REC StartingYear'};
}

function recThemeHasPostSubmission_(region, localBoard, rec, themeID) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceNames = ['Students Post Assessment', 'APP_Student_Surveys'];
  const key = value => clean(value).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  const regionKey = value => key(value).replace(/\s+\\d+$/,'');
  for (const name of sourceNames) {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) continue;
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(h => clean(h));
    const col = (...names) => headers.findIndex(h => names.some(n => key(h) === key(n)));
    const ri=col('1. Select your region','Select your region','Region');
    const bi=col('LocalBoard','Local Board','Local Board (Standardized)','Name of Local Board');
    const ci=col('REC','REC (Standardized)','Name of RECs');
    const ti=col('ThemeName','Theme Name','Select the themes','ThemeID','Theme');
    const ai=col('Assessment','AssessmentStage','Select when this assessment conducted');
    if ([ri,bi,ci,ti,ai].some(i=>i<0)) continue;
    const canonicalTheme = value => {
      const raw=key(value);
      const digits=(raw.match(/(?:theme\s*)?([1-4])/i)||[])[1];
      if (digits) return 'theme'+digits;
      const compact=raw.replace(/[^a-z]/g,'');
      const aliases={
        authorityandleadership:'theme1',authorityleadership:'theme1',
        intellectualtraditions:'theme2',ismailimuslimtraditions:'theme2',
        roleinfamilycommunityandsociety:'theme3',roleinfamilycommunityandsocietytheme:'theme3',
        twoaspectsoflife:'theme4'
      };
      return aliases[compact] || compact;
    };
    const sameLocation = (a,b) => key(a)===key(b) ||
      key(a).replace(/[^a-z0-9]/g,'')===key(b).replace(/[^a-z0-9]/g,'');
    const found=values.slice(1).some(row => {
      const assessment=key(row[ai]).replace(/\s+/g,'');
      return regionKey(row[ri])===regionKey(region) && sameLocation(row[bi],localBoard) &&
        sameLocation(row[ci],rec) && canonicalTheme(row[ti])===canonicalTheme(themeID) &&
        (assessment==='post' || assessment==='postassessment');
    });
    if (found) return true;
  }
  return false;
}

function surveyAssessment_(value) {
  const v = clean(value).toLowerCase().replace(/[\s_-]+/g, '');

  if (v === 'pre' || v === 'preassessment') return 'Pre';
  if (v === 'post' || v === 'postassessment') return 'Post';
  if (v === 'post2' || v === 'post2assessment') return 'Post 2';

  throw new Error('Assessment must be Pre, Post, or Post 2.');
}

function surveyCycleId_(value) {
  const v = clean(value).toLowerCase().replace(/[\s_-]+/g, '');
  if (v === 'cycle2' || v === 'c2' || v === '2') return 'C2';
  if (v === 'cycle1' || v === 'c1' || v === '1') return 'C1';
  return clean(surveyConfigValue_('CycleID', 'C1'));
}


function surveyScore_(value, participantType) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const studentRatings = {
    'very well': 3,
    'to some extent': 2,
    'face difficulty': 1
  };

  const teacherRatings = {
    'exemplary': 4,
    'proficient': 3,
    'developing': 2,
    'emerging': 1
  };

  const ratingText = clean(value).toLowerCase();
  const ratingMap = participantType === 'Student'
    ? studentRatings
    : teacherRatings;

  if (Object.prototype.hasOwnProperty.call(ratingMap, ratingText)) {
    return ratingMap[ratingText];
  }

  const numeric = Number(value);
  const max = participantType === 'Student' ? 3 : 4;

  if (
    Number.isInteger(numeric) &&
    numeric >= 1 &&
    numeric <= max
  ) {
    return numeric;
  }

  throw new Error(
    'Invalid ' + participantType + ' rating: "' + value + '".'
  );
}


function surveyHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) {
    throw new Error('Survey sheet is missing its header row.');
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(h => clean(h));

  if (headers.every(h => !h)) {
    throw new Error('Survey sheet header row is empty.');
  }

  return headers;
}


function ensureSurveyColumns_(sheet, requiredColumns) {
  let headers = surveyHeaders_(sheet);
  const missing = requiredColumns.filter(name => headers.indexOf(name) < 0);
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }
  return headers;
}


function surveyRowFromObject_(headers, values) {
  const row = new Array(headers.length).fill('');

  headers.forEach((header, index) => {
    if (Object.prototype.hasOwnProperty.call(values, header)) {
      row[index] = values[header];
    }
  });

  return row;
}


function findSurveyIndicator_(
  referenceRows,
  cycleId,
  participantType,
  assessment,
  themeName,
  indicatorId
) {
  const match = referenceRows.find(item =>
    clean(item.CycleID) === clean(cycleId) &&
    clean(item.ParticipantType).toLowerCase() ===
      participantType.toLowerCase() &&
    surveyAssessment_(item.Assessment) === assessment &&
    clean(item.ThemeName).toLowerCase() ===
      clean(themeName).toLowerCase() &&
    clean(item.IndicatorID) === clean(indicatorId)
  );

  if (!match) {
    throw new Error(
      'No matching APP_Indicators entry for ' +
      participantType + ', ' + assessment + ', ' +
      themeName + ', ' + indicatorId + '.'
    );
  }

  return match;
}


/* =========================================================
   STUDENT SURVEY — WIDE SURVEY ROW TO NORMALIZED RECORDS
========================================================= */

function handleStudentSurvey(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.STUDENT_SURVEYS_SHEET);

  if (!sheet) {
    throw new Error('APP_Student_Surveys sheet not found.');
  }

  const headers = ensureSurveyColumns_(sheet, ['AssessorName', 'CycleID']);
  if (!clean(body.region) || !clean(body.localBoard) || !clean(body.rec) ||
      !clean(body.childName) || !clean(body.assessorName) ||
      !clean(body.assessorDesignation) ||
      (clean(body.assessorDesignation) === 'Other' && !clean(body.otherDesignation))) {
    throw new Error('Enter the location, child name, survey filler name and designation.');
  }
  // Assessment is classified by the REC + theme survey lookup before
  // submission. Trust that selected stage; do not infer it from CycleID or
  // APP_Indicators. Cohort year is resolved from RECs_list_Phase_Wise.
  const assessment = surveyAssessment_(body.assessment);
  const cycleId = '';
  const themeName = clean(body.themeName);

  if (!themeName) {
    throw new Error('ThemeName is required.');
  }

  // New app sends indicatorRatings as an object.
  // Temporary fallback supports the old single-indicator payload.
  let ratings = body.indicatorRatings;

  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
    ratings = {};

    if (body.indicatorId) {
      ratings[clean(body.indicatorId)] = body.rating;
    }
  }

  const ratingEntries = Object.keys(ratings)
    .filter(id => ratings[id] !== '' &&
                  ratings[id] !== null &&
                  ratings[id] !== undefined)
    .map(id => ({
      indicatorId: clean(id),
      score: surveyScore_(ratings[id], 'Student')
    }));

  if (!ratingEntries.length) {
    throw new Error('Enter at least one student indicator rating.');
  }

  // Survey ratings are stored using their own fixed ThemeN:UA/A headers.
  // Do not consult APP_Indicators: the survey schema is the source of truth.
  const themeNumber = ({
    'authority and leadership': '1',
    'intellectual traditions': '2',
    'ismaili muslim traditions': '2',
    'role in family, community and society': '3',
    'two aspects of life': '4'
  })[themeName.toLowerCase()];
  if (!themeNumber) throw new Error('Unrecognized student theme: ' + themeName);
  const indicatorEntries = ratingEntries.map(entry => {
    const sourceIndex = headers.indexOf(entry.indicatorId);
    if (sourceIndex < 0) throw new Error('Student survey sheet has no rating column: ' + entry.indicatorId);
    const match = entry.indicatorId.match(/^Theme(\d+):(UA|A)(\d+)$/);
    if (!match || match[1] !== themeNumber) throw new Error('Invalid indicator for ' + themeName + ': ' + entry.indicatorId);
    return {
      meta: {ThemeID:'T'+themeNumber,DimensionID:match[2],IndicatorID:entry.indicatorId,MaxScore:3},
      score: entry.score,
      appSourceColumn: sourceIndex + 1,
      appSourceHeader: headers[sourceIndex]
    };
  });

  const submissionId = newSubmissionId('STU');
  const values = {
    SubmissionID: submissionId,
    SubmittedAt: new Date(),
    CycleID: cycleId,
    Region: clean(body.region),
    LocalBoard: clean(body.localBoard),
    REC: clean(body.rec),
    ChildName: clean(body.childName),
    ChildGender: clean(body.childGender),
    AssessorName: clean(body.assessorName),
    AssessorDesignation: clean(body.assessorDesignation),
    OtherDesignation: clean(body.otherDesignation),
    ThemeName: themeName,
    Assessment: assessment,
    Activity: clean(body.activity),
    OtherActivity: clean(body.otherActivity),
    Remarks: clean(body.remarks)
  };

  // Store ratings in the actual UA/A columns from the survey header.
  indicatorEntries.forEach(entry => {
    values[entry.appSourceHeader] = entry.score;
  });

  const sourceRow = sheet.getLastRow() + 1;
  const surveyRow = surveyRowFromObject_(headers, values);

  sheet.getRange(sourceRow, 1, 1, headers.length).setValues([surveyRow]);

  const recordCount = appendNormalizedRecords_(
    sheet,
    sourceRow,
    submissionId,
    'Student',
    assessment,
    Object.assign({}, body, { cycleID: cycleId }),
    indicatorEntries
  );

  return {
    success: true,
    message: 'Student assessment submitted successfully.',
    submissionId: submissionId,
    normalizedRecordsCreated: recordCount
  };
}


/* =========================================================
   TEACHER SURVEY — PRE AND POST IN ONE SURVEY ROW
========================================================= */

function handleTeacherSurvey(body) {
  // Public survey submission: no email/login is collected.
  const email = '';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TEACHER_SURVEYS_SHEET);

  if (!sheet) {
    throw new Error('APP_Teacher_Surveys sheet not found.');
  }

  const headers = ensureSurveyColumns_(sheet, ['FillerName', 'FillerDesignation']);
  if (!clean(body.region) || !clean(body.localBoard) || !clean(body.rec) ||
      !clean(body.teacherName) || !clean(body.fillerName) ||
      !clean(body.fillerDesignation)) {
    throw new Error('Enter the location, teacher name, survey filler name and designation.');
  }
  const themeName = clean(body.themeName);

  if (!themeName) {
    throw new Error('ThemeName is required.');
  }

  // New app sends both values.
  // Temporary fallback supports the old Assessment/RubricRating payload.
  let preValue = body.preRating;
  let postValue = body.postRating;

  if (preValue === undefined && postValue === undefined &&
      body.assessment && body.rubricRating !== undefined) {
    const oldAssessment = surveyAssessment_(body.assessment);

    if (oldAssessment === 'Pre') {
      preValue = body.rubricRating;
    } else {
      postValue = body.rubricRating;
    }
  }

  const preScore = preValue === '' || preValue == null
    ? null
    : surveyScore_(preValue, 'Teacher');

  const postScore = postValue === '' || postValue == null
    ? null
    : surveyScore_(postValue, 'Teacher');

  if (preScore === null && postScore === null) {
    throw new Error('Enter a teacher PreRating, PostRating, or both.');
  }

  const cycleId = clean(surveyConfigValue_('CycleID', 'C1'));
  // Teacher content survey has one rubric score per theme and assessment.
  // Keep this fixed mapping local to the survey; APP_Indicators is not required.
  const teacherThemeMap = {
    'authority and leadership':'T1',
    'intellectual traditions':'T2',
    'ismaili muslim traditions':'T2',
    'role in family, community and society':'T3',
    'two aspects of life':'T4'
  };
  const teacherThemeID = teacherThemeMap[themeName.toLowerCase()];
  if (!teacherThemeID) throw new Error('Unrecognized teacher theme: ' + themeName);
  const indicatorEntries = [];
  if (preScore !== null) indicatorEntries.push({
    meta:{ThemeID:teacherThemeID,DimensionID:'Content',IndicatorID:teacherThemeID+'_PRE',MaxScore:4},
    score:preScore,assessment:'Pre'
  });
  if (postScore !== null) indicatorEntries.push({
    meta:{ThemeID:teacherThemeID,DimensionID:'Content',IndicatorID:teacherThemeID+'_POST',MaxScore:4},
    score:postScore,assessment:'Post'
  });

  const submissionId = newSubmissionId('TCH');
  const values = {
    SubmissionID: submissionId,
    SubmittedAt: new Date(),
    UserEmail: '',
    Region: clean(body.region),
    LocalBoard: clean(body.localBoard),
    REC: clean(body.rec),
    TeacherName: clean(body.teacherName),
    TeacherPosition: clean(body.teacherPosition),
    OtherPosition: clean(body.otherPosition),
    YearsTeaching: clean(body.yearsTeaching),
    TrainingAttended: clean(body.trainingAttended),
    OtherTraining: clean(body.otherTraining),
    AssessmentContext: clean(body.assessmentContext),
    ThemeName: themeName,
    PreRating: preScore === null ? '' : preScore,
    PostRating: postScore === null ? '' : postScore,
    FillerName: clean(body.fillerName),
    FillerDesignation: clean(body.fillerDesignation)
  };

  const sourceRow = sheet.getLastRow() + 1;
  const surveyRow = surveyRowFromObject_(headers, values);

  sheet.getRange(sourceRow, 1, 1, headers.length).setValues([surveyRow]);

  // Pre and Post need separate normalized records because Assessment
  // is stored per row in APP_Records.
  let recordCount = 0;

  indicatorEntries.forEach(entry => {
    recordCount += appendNormalizedRecords_(
      sheet,
      sourceRow,
      submissionId,
      'Teacher',
      entry.assessment,
      body,
      [entry]
    );
  });

  return {
    success: true,
    message: 'Teacher assessment submitted successfully.',
    submissionId: submissionId,
    normalizedRecordsCreated: recordCount
  };
}


function handleTeacherSurveyCycle2_(body) {
  // Public survey submission: no email/login is collected.
  const email = '';

  const assessment = surveyAssessment_(body.assessment);

  if (assessment !== 'Pre' && assessment !== 'Post') {
    throw new Error('Assessment must be Pre or Post.');
  }

  const skills = [
    { key: 'instructional', themeID: 'S1', themeName: 'Instructional Skills' },
    { key: 'questioning', themeID: 'S2', themeName: 'Questioning Skills' },
    { key: 'feedback', themeID: 'S3', themeName: 'Feedback Skills' }
  ];

  const ratings = body.skillRatings || {};
  const skillTotals = {};
  const skillLevels = {};

  skills.forEach(skill => {
    const scores = ratings[skill.key];

    if (
      !Array.isArray(scores) ||
      scores.length !== 4 ||
      scores.some(score => ![1, 2, 3, 4].includes(Number(score)))
    ) {
      throw new Error(
        'Please provide all four valid ratings for ' + skill.themeName + '.'
      );
    }

    skillTotals[skill.key] = scores.reduce(
      (sum, score) => sum + Number(score), 0
    );

    const total = skillTotals[skill.key];
    skillLevels[skill.key] =
      total >= 14 ? 'Flourishing' :
      total >= 11 ? 'Maturing' :
      total >= 8 ? 'Growing' : 'Seeding';
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Teacher_Surveys_Cycle2');

  if (!sheet) {
    throw new Error('APP_Teacher_Surveys_Cycle2 sheet not found.');
  }

  const headers = ensureSurveyColumns_(sheet, ['FillerName', 'FillerDesignation']);
  if (!clean(body.region) || !clean(body.localBoard) || !clean(body.rec) ||
      !clean(body.teacherName) || !clean(body.fillerName) ||
      !clean(body.fillerDesignation)) {
    throw new Error('Enter the location, teacher name, survey filler name and designation.');
  }
  const submissionId = newSubmissionId('TCHC2');
  const sourceRow = sheet.getLastRow() + 1;
  const year = Number(surveyConfigValue_('AssessmentYear', 2026));

  const values = {
    SubmissionID: submissionId,
    SubmittedAt: new Date(),
    UserEmail: email,
    CycleID: 'C2',
    Year: year,
    Region: clean(body.region),
    LocalBoard: clean(body.localBoard),
    REC: clean(body.rec),
    TeacherName: clean(body.teacherName),
    TeacherPosition: clean(body.teacherPosition),
    OtherPosition: clean(body.otherPosition),
    YearsTeaching: clean(body.yearsTeaching),
    TrainingAttended: clean(body.trainingAttended),
    OtherTraining: clean(body.otherTraining),
    AssessmentContext: clean(body.assessmentTool),
    Assessment: assessment,
    AssessmentDate: clean(body.assessmentDate),
    MentorName: clean(body.mentorName),
    FillerName: clean(body.fillerName),
    FillerDesignation: clean(body.fillerDesignation),
    Instructional_Indicator1: Number(ratings.instructional[0]),
    Instructional_Indicator2: Number(ratings.instructional[1]),
    Instructional_Indicator3: Number(ratings.instructional[2]),
    Instructional_Indicator4: Number(ratings.instructional[3]),
    Instructional_Total: skillTotals.instructional,
    Instructional_Level: skillLevels.instructional,
    Questioning_Indicator1: Number(ratings.questioning[0]),
    Questioning_Indicator2: Number(ratings.questioning[1]),
    Questioning_Indicator3: Number(ratings.questioning[2]),
    Questioning_Indicator4: Number(ratings.questioning[3]),
    Questioning_Total: skillTotals.questioning,
    Questioning_Level: skillLevels.questioning,
    Feedback_Indicator1: Number(ratings.feedback[0]),
    Feedback_Indicator2: Number(ratings.feedback[1]),
    Feedback_Indicator3: Number(ratings.feedback[2]),
    Feedback_Indicator4: Number(ratings.feedback[3]),
    Feedback_Total: skillTotals.feedback,
    Feedback_Level: skillLevels.feedback,
    Instructional_Notes: clean((body.mentorNotes || {}).instructional),
    Questioning_Notes: clean((body.mentorNotes || {}).questioning),
    Feedback_Notes: clean((body.mentorNotes || {}).feedback)
  };

  const surveyRow = surveyRowFromObject_(headers, values);

  // Save the original survey response only. The dashboard reads this source
  // sheet directly and expands the 12 skill indicators in memory; no APP_Records
  // or APP_Indicators dependency is required.
  sheet.getRange(sourceRow, 1, 1, headers.length).setValues([surveyRow]);

  return {
    success: true,
    message: 'Cycle 2 teacher assessment submitted successfully.',
    submissionId: submissionId,
    normalizedRecordsCreated: 0
  };
}




function findTeacherThemeIndicator_(
  referenceRows,
  cycleId,
  assessment,
  themeName
) {
  const matches = referenceRows.filter(item =>
    clean(item.CycleID) === clean(cycleId) &&
    clean(item.ParticipantType).toLowerCase() === 'teacher' &&
    surveyAssessment_(item.Assessment) === assessment &&
    clean(item.ThemeName).toLowerCase() ===
      clean(themeName).toLowerCase()
  );

  if (!matches.length) {
    throw new Error(
      'No teacher APP_Indicators entry found for ' +
      themeName + ' (' + assessment + ').'
    );
  }

  // Teacher reference uses one score indicator per theme and stage.
  const expectedSheet = 'APP_Teacher_Surveys';
  const expectedColumn = assessment === 'Pre' ? 15 : 16;
  const scoreIndicator = matches.find(item =>
    clean(item.IndicatorID).endsWith(':Score') &&
    clean(item.AppSourceSheet) === expectedSheet &&
    Number(item.AppSourceColumn) === expectedColumn
  );

  if (!scoreIndicator) {
    throw new Error(
      'Teacher App mapping was not found for ' +
      themeName + ' (' + assessment + '). Check AppSourceSheet and AppSourceColumn.'
    );
  }

  return scoreIndicator;
}


function handleSurveyLookup(body) {
  const email = normalizeEmail(body.userEmail);

  const participantType = clean(body.participantType).toLowerCase();
  const name = clean(
    participantType === 'student' ? body.childName : body.teacherName
  );
  const region = clean(body.region).replace(/_\d+$/, '');
  const localBoard = clean(body.localBoard);
  const rec = clean(body.rec);

  if (!['student', 'teacher'].includes(participantType)) {
    return { success: false, message: 'Participant type must be Student or Teacher.' };
  }
  if (!name || !region || !localBoard || !rec) {
    return {
      success: false,
      message: 'Enter the participant name, region, local board and REC.'
    };
  }

  
  if (email) {
  const access = userCanAccessLocation(
    email,
    region,
    localBoard,
    rec
  );

  if (!access.success) return access;
  }


  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = participantType === 'student'
    ? CONFIG.STUDENT_SURVEYS_SHEET
    : CONFIG.TEACHER_SURVEYS_SHEET;

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(sheetName + ' sheet not found.');

  const values = sheet.getDataRange().getValues();

if (values.length < 2) {
  const matches = [];

  // Include historical Kobo submissions so the survey can display records
  // collected before the app survey sheets were introduced.
  const legacySources = participantType === 'student'
    ? ['Students Pre Assessment','Students Post Assessment']
    : ['Teachers Assessment'];
  legacySources.forEach(sourceName => {
    const legacy = ss.getSheetByName(sourceName);
    if (!legacy || legacy.getLastRow() < 2) return;
    const data = legacy.getDataRange().getValues();
    const hh = data[0].map(h => clean(h));
    const findCol = names => hh.findIndex(h => names.some(n => h.toLowerCase() === n.toLowerCase()));
    const r=findCol(['Region','1. Select your region','Select your region']);
    const b=findCol(['LocalBoard','Local Board (Standardized)','Name of Local Board']);
    const rc=findCol(['REC','REC (Standardized)','Name of RECs']);
    const n=findCol(participantType==='student'?['ChildName','Name of a child:']:['TeacherName','Name of participant']);
    if([r,b,rc,n].some(x=>x<0)) return;
    const themeMap={'authority and leadership':'1','intellectual traditions':'2','ismaili muslim traditions':'2','role in family, community and society':'3','two aspects of life':'4'};
    data.slice(1).forEach((row,index)=>{
      if(clean(row[r]).replace(/_\\d+$/,'').toLowerCase()!==region.toLowerCase().replace(/_\\d+$/,'')||
         clean(row[b]).toLowerCase()!==localBoard.toLowerCase()||
         clean(row[rc]).toLowerCase()!==rec.toLowerCase()||
         clean(row[n]).toLowerCase()!==name.toLowerCase()) return;
      const themeCol=findCol(['ThemeName','Select the themes']);
      const themeName=themeCol>=0?clean(row[themeCol]):'';
      const item={submissionId:clean(row[findCol(['_uuid','_id'])])||sourceName+'-'+(index+2),
        name:clean(row[n]),region:clean(row[r]),localBoard:clean(row[b]),rec:clean(row[rc]),
        themeName,assessment:sourceName==='Students Pre Assessment'?'Pre':(clean(row[findCol(['Assessment','Select when this assessment conducted'])])||'Post'),
        submittedAt:clean(row[findCol(['SubmittedAt','_submission_time','end','start'])])};
      if(participantType==='student'){
        item.ratings={};
        const tn=themeMap[themeName.toLowerCase()]||'';
        hh.forEach((header,j)=>{
          if(/^Theme[1-4]:(UA|A)\\d+$/i.test(header)&&(!tn||header.startsWith('Theme'+tn+':'))&&row[j]!==''&&row[j]!=null)item.ratings[header]=row[j];
        });
        item.childGender=clean(row[findCol(["ChildGender","Child's gender"])]);
        item.assessorDesignation=clean(row[findCol(['AssessorDesignation','Designation of a person assess a child'])]);
      } else {
        item.teacherPosition=clean(row[findCol(['TeacherPosition','Position of participant'])]);
        const pre=findCol(['PreRating','Pre Theme 1 Score']);
        const post=findCol(['PostRating','Post Theme 1 Score']);
        item.preRating=pre>=0?row[pre]:'';
        item.postRating=post>=0?row[post]:'';
      }
      matches.push(item);
    });
  });

  return { success: true, matches: matches };
}

  const headers = values[0].map(h => clean(h));
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  const required = ['Region', 'LocalBoard', 'REC',
    participantType === 'student' ? 'ChildName' : 'TeacherName'];

  required.forEach(h => {
    if (col[h] === undefined) throw new Error('Missing column: ' + h);
  });

  const same = (a, b) =>
    clean(a).toLowerCase() === clean(b).toLowerCase();

  const matches = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    if (
      same(row[col.Region], region) &&
      same(row[col.LocalBoard], localBoard) &&
      same(row[col.REC], rec) &&
      same(row[col[required[3]]], name)
    ) {
      const item = {
        submissionId: col.SubmissionID === undefined ? '' : clean(row[col.SubmissionID]),
        name: clean(row[col[required[3]]]),
        region: clean(row[col.Region]),
        localBoard: clean(row[col.LocalBoard]),
        rec: clean(row[col.REC]),
        themeName: col.ThemeName === undefined ? '' : clean(row[col.ThemeName]),
        assessment: col.Assessment === undefined ? '' : clean(row[col.Assessment]),
        submittedAt: col.SubmittedAt === undefined ? '' :
          (row[col.SubmittedAt] instanceof Date
            ? row[col.SubmittedAt].toISOString()
            : clean(row[col.SubmittedAt]))
      };

      if (participantType === 'student') {
        item.childGender = col.ChildGender === undefined ? '' : clean(row[col.ChildGender]);
        item.assessorDesignation = col.AssessorDesignation === undefined ? '' : clean(row[col.AssessorDesignation]);
        item.otherDesignation = col.OtherDesignation === undefined ? '' : clean(row[col.OtherDesignation]);

        
item.ratings = {};

// Map the saved theme name to its theme number.
const themeMap = {
  'authority and leadership': '1',
  'ismaili muslim traditions': '2',
  'role in family, community and society': '3',
  'two aspects of life': '4'
};

const themeKey = clean(item.themeName).toLowerCase();
const themeNumber = themeMap[themeKey] || '';

headers.forEach((h, j) => {
  if (
    /^Theme\d+:(UA|A)\d+$/.test(h) &&
    themeNumber &&
    h.startsWith(`Theme${themeNumber}:`) &&
    row[j] !== '' &&
    row[j] != null
  ) {
    item.ratings[h] = row[j];
  }
});

      } else {
        item.teacherPosition = col.TeacherPosition === undefined ? '' : clean(row[col.TeacherPosition]);
        item.otherPosition = col.OtherPosition === undefined ? '' : clean(row[col.OtherPosition]);
        item.yearsTeaching = col.YearsTeaching === undefined ? '' : row[col.YearsTeaching];
        item.trainingAttended = col.TrainingAttended === undefined ? '' : clean(row[col.TrainingAttended]);
        item.otherTraining = col.OtherTraining === undefined ? '' : clean(row[col.OtherTraining]);
        item.assessmentContext = col.AssessmentContext === undefined ? '' : clean(row[col.AssessmentContext]);
        item.preRating = col.PreRating === undefined ? '' : row[col.PreRating];
        item.postRating = col.PostRating === undefined ? '' : row[col.PostRating];
      }

      matches.push(item);
    }
  }

  
  return { success: true, matches: matches };
}




/* Obsolete APP_Records import, matching, and synchronization utilities removed. The active dashboard reads the six original source sheets. */

function removeLegacyKoboSyncTriggers() {
  const legacyHandlers = new Set([
    'syncKoboToAPPRecords',
    'installAutomaticKoboSync'
  ]);
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (legacyHandlers.has(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  Logger.log('Removed legacy APP_Records sync triggers: ' + removed);
  return {success:true, removed:removed};
}

// Kept as a compatibility entry point. It removes the old APP_Records
// automation and deliberately does not create a replacement trigger.
function installAutomaticKoboSync() {
  return removeLegacyKoboSyncTriggers();
}


function handleCreateLoginRequest(body) {
  const name = clean(body.name);
  const email = normalizeEmail(body.email);
  const requestedAccessLevel = clean(body.requestedRole);

  // Validate required fields
  if (!name || !email || !requestedAccessLevel) {
    return {
      success: false,
      message: 'Full name, email and requested access level are required.'
    };
  }

  // Validate email format on the server
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      message: 'Please enter a valid email address.'
    };
  }

  // Only allow the three requested access levels
  const allowedLevels = ['Region', 'Local Board', 'REC'];

  if (!allowedLevels.includes(requestedAccessLevel)) {
    return {
      success: false,
      message: 'Invalid requested access level.'
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.USERS_SHEET);

  if (!sheet) {
    throw new Error('APP_Users sheet not found.');
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error('APP_Users sheet has no headers.');
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(h => clean(h));

  const idCol = headers.indexOf('ID');
  const nameCol = headers.indexOf('Name');
  const emailCol = headers.indexOf('Email');
  const roleCol = headers.indexOf('Role');
  const statusCol = headers.indexOf('Status');
  const createdCol = headers.indexOf('CreatedAt');
  const requestedCol = headers.indexOf('RequestedAccessLevel');

  if (
    nameCol === -1 ||
    emailCol === -1 ||
    roleCol === -1 ||
    statusCol === -1 ||
    requestedCol === -1
  ) {
    throw new Error(
      'APP_Users is missing a required header. Check Name, Email, Role, Status and RequestedAccessLevel.'
    );
  }

  // Prevent duplicate requests or duplicate accounts
  const existing = getUserByEmail(email);

  if (existing.success) {
    return {
      success: false,
      message: 'An account or request with this email already exists. Please contact the administrator.'
    };
  }

  const row = new Array(headers.length).fill('');

  if (idCol >= 0) {
    row[idCol] = 'USR-' + Utilities.getUuid().substring(0, 8);
  }

  row[nameCol] = name;
  row[emailCol] = email;
  row[roleCol] = 'user';
  row[statusCol] = 'Pending';
  row[requestedCol] = requestedAccessLevel;

  if (createdCol >= 0) {
    row[createdCol] = new Date();
  }

  sheet.appendRow(row);

  try {
  notifyAdminsOfAccessRequest();
} catch (error) {
  console.error('Push notification failed: ' + error.message);
}

  return {
    success: true,
    message: 'Your login request has been submitted successfully. Access is subject to administrator approval. You will be notified once your request has been reviewed.'
  };
}


/* =========================================================
   RESOURCE LIBRARY
========================================================= */

function handleListResources(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.RESOURCES_SHEET);

  if (!sheet) {
    return {
      success: false,
      message: 'APP_Resources sheet was not found.'
    };
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return { success: true, resources: [] };
  }

  const headers = data[0].map(h => String(h).trim());
  const index = {};
  headers.forEach((header, i) => index[header] = i);

  const required = [
    'ResourceID', 'Title', 'Description', 'Category',
    'FileName', 'FileURL', 'MimeType', 'UploadedBy',
    'UploadedAt', 'Active'
  ];

  const missing = required.filter(h => index[h] === undefined);
  if (missing.length) {
    return {
      success: false,
      message: 'Missing APP_Resources columns: ' + missing.join(', ')
    };
  }

  const resources = data.slice(1)
    .filter(row =>
      String(row[index.Active]).trim().toLowerCase() === 'true'
    )
    .map(row => ({
      resourceID: String(row[index.ResourceID] || ''),
      title: String(row[index.Title] || ''),
      description: String(row[index.Description] || ''),
      category: String(row[index.Category] || ''),
      fileName: String(row[index.FileName] || ''),
      fileURL: String(row[index.FileURL] || ''),
      mimeType: String(row[index.MimeType] || ''),
      uploadedBy: String(row[index.UploadedBy] || ''),
      uploadedAt: row[index.UploadedAt] instanceof Date
        ? row[index.UploadedAt].toISOString()
        : String(row[index.UploadedAt] || '')
    }));

  return { success: true, resources: resources };
}



function handleUploadResource(body) {
  const email = clean(body.adminEmail || body.uploadedBy || body.updatedBy);

  // Only approved administrators can upload resources.
  const authorization = requireAdmin(email);

  if (!authorization.success) {
    return {
      success: false,
      message: authorization.message ||
        'Administrator authorization required.'
    };
  }

  const title = clean(body.title);
  const description = clean(body.description);
  const category = clean(body.category);
  const fileName = clean(body.fileName);
  const mimeType = clean(body.mimeType) ||
    'application/octet-stream';

  let base64Data = String(body.fileBase64 || '').trim();
  base64Data = base64Data.replace(/^data:[^,]*;base64,/, '');

  if (!title || !category || !fileName || !base64Data) {
    return {
      success: false,
      message: 'Title, category, file name, and file data are required.'
    };
  }

  if (title.length > 180 || description.length > 1000) {
    return {
      success: false,
      message: 'Title or description exceeds the allowed length.'
    };
  }

  // Allow admins to use existing categories or enter new ones.
if (!category) {
  return {
    success: false,
    message: 'Please select or enter a resource category.'
  };
}

if (category.length > 100) {
  return {
    success: false,
    message: 'Category must not exceed 100 characters.'
  };
}

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.RESOURCES_SHEET);

  if (!sheet) {
    return {
      success: false,
      message: 'APP_Resources sheet was not found.'
    };
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    return {
      success: false,
      message: 'APP_Resources has no header row.'
    };
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(h => String(h).trim());

  const required = [
    'ResourceID', 'Title', 'Description', 'Category',
    'FileName', 'FileURL', 'MimeType', 'UploadedBy',
    'UploadedAt', 'Active'
  ];

  const missing = required.filter(h => !headers.includes(h));

  if (missing.length) {
    return {
      success: false,
      message: 'Missing APP_Resources columns: ' +
        missing.join(', ')
    };
  }

  let file;

  try {
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);

    const folder = DriveApp.getFolderById(
      CONFIG.RESOURCES_FOLDER_ID
    );

    file = folder.createFile(blob);

    // Allow users with the link to view/download.
    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );

  } catch (error) {
    // Clean up a file created before a later upload step failed.
    if (file) {
      try {
        file.setTrashed(true);
      } catch (ignored) {}
    }

    return {
      success: false,
      message: 'File upload failed: ' + error.message
    };
  }

  const valuesByHeader = {
    ResourceID: Utilities.getUuid(),
    Title: title,
    Description: description,
    Category: category,
    FileName: file.getName(),
    FileURL: file.getUrl(),
    MimeType: mimeType,
    UploadedBy: email,
    UploadedAt: new Date(),
    Active: true
  };

  const newRow = headers.map(header =>
    valuesByHeader[header] !== undefined
      ? valuesByHeader[header]
      : ''
  );

  try {
    sheet.appendRow(newRow);

  } catch (error) {
    try {
      file.setTrashed(true);
    } catch (ignored) {}

    return {
      success: false,
      message: 'Could not save resource details: ' +
        error.message
    };
  }

  return {
    success: true,
    message: 'Resource uploaded successfully.',
    resourceID: valuesByHeader.ResourceID,
    fileURL: valuesByHeader.FileURL
  };
}


function authorizeDriveAccess() {
  const folder = DriveApp.getFolderById(
    '11C7JI6RQ5PGOT1nE1wy7snefEvdhuRGD'
  );

  const testFile = folder.createFile(
    'drive-authorization-test.txt',
    'Temporary test file'
  );

  Logger.log('File created: ' + testFile.getName());

  testFile.setTrashed(true);
  Logger.log('Test file moved to trash.');
}


function handleUpdateResource(body) {
  const email = clean(body.adminEmail);
  const auth = requireAdmin(email);
  if (!auth.success) {
    return {
      success: false,
      message: auth.message || 'Administrator access required.'
    };
  }

  const id = clean(body.resourceID);
  const title = clean(body.title);
  const description = clean(body.description);
  const category = clean(body.category);

  if (!id || !title || !category) {
    return {
      success: false,
      message: 'Resource ID, title and category are required.'
    };
  }

  if (title.length > 180 || description.length > 1000) {
    return { success: false, message: 'Text exceeds the allowed length.' };
  }

  if (!['Mentoring Strategies', 'Assessment Strategies']
      .includes(category)) {
    return { success: false, message: 'Invalid resource category.' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.RESOURCES_SHEET);
  if (!sheet) {
    return { success: false, message: 'Resources sheet not found.' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  for (const h of ['ResourceID', 'Title', 'Description', 'Category', 'Active']) {
    if (col[h] === undefined) {
      return { success: false, message: 'Missing column: ' + h };
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.ResourceID]).trim() !== id) continue;

    if (String(data[i][col.Active]).trim().toLowerCase() !== 'true') {
      return { success: false, message: 'Resource is no longer active.' };
    }

    sheet.getRange(i + 1, col.Title + 1).setValue(title);
    sheet.getRange(i + 1, col.Description + 1).setValue(description);
    sheet.getRange(i + 1, col.Category + 1).setValue(category);

    return { success: true, message: 'Resource updated successfully.' };
  }

  return { success: false, message: 'Resource not found.' };
}


function handleDeleteResource(body) {
  const email = clean(body.adminEmail);
  const auth = requireAdmin(email);
  if (!auth.success) {
    return {
      success: false,
      message: auth.message || 'Administrator access required.'
    };
  }

  const id = clean(body.resourceID);
  if (!id) {
    return { success: false, message: 'Resource ID is required.' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.RESOURCES_SHEET);
  if (!sheet) {
    return { success: false, message: 'Resources sheet not found.' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idCol = headers.indexOf('ResourceID');
  const activeCol = headers.indexOf('Active');

  if (idCol < 0 || activeCol < 0) {
    return { success: false, message: 'ResourceID or Active column is missing.' };
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() !== id) continue;

    if (String(data[i][activeCol]).trim().toLowerCase() !== 'true') {
      return { success: false, message: 'Resource is already inactive.' };
    }

    // Soft-delete: preserve the Drive file and catalogue history.
    sheet.getRange(i + 1, activeCol + 1).setValue(false);

    return { success: true, message: 'Resource deleted from the library.' };
  }

  return { success: false, message: 'Resource not found.' };
}


/**
 * Audits teacher geography directly in the agreed original source sheet.
 * APP_Records is a normalized destination and is intentionally not read here.
 * Read-only: no spreadsheet cells are changed.
 */
function auditTeacherGeography() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const SOURCE_SHEET = 'Teachers Assessment';
  const source = ss.getSheetByName(SOURCE_SHEET);
  if (!source) throw new Error('Original source sheet not found: ' + SOURCE_SHEET);

  const values = source.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error(SOURCE_SHEET + ' has no assessment rows.');
  }

  const headers = values[0].map(h =>
    String(h == null ? '' : h).replace(/\\u00a0/g, ' ').trim()
  );
  const normHeader = h => String(h || '')
    .replace(/\\u00a0/g, ' ')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  const findColumn = candidates => {
    const wanted = candidates.map(normHeader);
    return headers.findIndex(h => wanted.includes(normHeader(h)));
  };

  const boardCol = findColumn(['LocalBoard', 'Local Board (Standardized)']);
  const recCol = findColumn(['REC', 'REC (Standardized)']);
  const regionCol = findColumn([
    'Select your region', '1. Select your region', 'Region'
  ]);
  const nameCol = findColumn([
    'Name of participant', 'Your Name', 'TeacherName'
  ]);
  const idCol = findColumn(['_uuid', '_id', 'meta/rootUuid']);

  const missingHeaders = [];
  if (boardCol < 0) missingHeaders.push('LocalBoard');
  if (recCol < 0) missingHeaders.push('REC');
  if (missingHeaders.length) {
    throw new Error(
      SOURCE_SHEET + ' is missing standardized geography header(s): ' +
      missingHeaders.join(', ') +
      '. Expected LocalBoard and REC (or legacy standardized header names).'
    );
  }

  let totalRows = 0;
  let rowsWithGeography = 0;
  let rowsMissingBoard = 0;
  let rowsMissingREC = 0;
  let rowsWithBothGeographyFields = 0;
  const samples = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const hasAnyData = row.some(v => String(v == null ? '' : v).trim() !== '');
    if (!hasAnyData) continue;

    totalRows++;
    const board = String(row[boardCol] || '').trim();
    const rec = String(row[recCol] || '').trim();

    if (board) rowsWithGeography++;
    else rowsMissingBoard++;

    if (!rec) rowsMissingREC++;
    if (board && rec) rowsWithBothGeographyFields++;

    if ((!board || !rec) && samples.length < 20) {
      samples.push({
        sourceSheet: SOURCE_SHEET,
        sourceRow: i + 1,
        submissionID: idCol >= 0 ? row[idCol] : '',
        teacherName: nameCol >= 0 ? row[nameCol] : '',
        region: regionCol >= 0 ? row[regionCol] : '',
        LocalBoard: board,
        REC: rec
      });
    }
  }

  const report = {
    status: 'AUDIT ONLY — ORIGINAL SOURCE SHEET; NO CELLS CHANGED',
    sourceSheet: SOURCE_SHEET,
    totalNonblankSubmissions: totalRows,
    rowsWithLocalBoard: totalRows - rowsMissingBoard,
    rowsMissingLocalBoard: rowsMissingBoard,
    rowsWithREC: totalRows - rowsMissingREC,
    rowsMissingREC: rowsMissingREC,
    rowsWithBothGeographyFields: rowsWithBothGeographyFields,
    samplesMissingGeography: samples,
    appRecordsRead: false
  };

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function handleRegisterPushSubscription(body) {
  const email = normalizeEmail(body.email);
  const auth = requireAdmin(email);

  if (!auth.success) {
    return auth;
  }

  const subscription = body.subscription;

  if (
    !subscription ||
    typeof subscription.endpoint !== 'string' ||
    !subscription.endpoint.startsWith('https://') ||
    !subscription.keys ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    return {
      success: false,
      message: 'A valid browser push subscription is required.'
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_PushSubscriptions');

  if (!sheet) {
    throw new Error('APP_PushSubscriptions sheet not found.');
  }

  const values = sheet.getDataRange().getValues();

  if (values.length === 0) {
    throw new Error('APP_PushSubscriptions must have a header row.');
  }

  const headers = values[0].map(h => clean(h));
  const emailCol = headers.indexOf('Email');
  const subscriptionCol = headers.indexOf('SubscriptionJSON');
  const deviceCol = headers.indexOf('DeviceLabel');
  const createdCol = headers.indexOf('CreatedAt');
  const activeCol = headers.indexOf('Active');

  if ([emailCol, subscriptionCol, deviceCol, createdCol, activeCol].some(i => i < 0)) {
    throw new Error('APP_PushSubscriptions is missing one or more required headers.');
  }

  const endpoint = subscription.endpoint;
  const serialized = JSON.stringify(subscription);
  let targetRow = -1;

  // Update an existing subscription for this device, or add a new one.
  for (let i = 1; i < values.length; i++) {
    if (
      normalizeEmail(values[i][emailCol]) === email &&
      String(values[i][subscriptionCol]).includes(endpoint)
    ) {
      targetRow = i + 1;
      break;
    }
  }

  const row = new Array(headers.length).fill('');
  row[emailCol] = email;
  row[subscriptionCol] = serialized;
  row[deviceCol] = clean(body.deviceLabel || 'Administrator device');
  row[createdCol] = new Date();
  row[activeCol] = true;

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return {
    success: true,
    message: 'Push subscription registered successfully.'
  };
}


function handleListPushSubscriptions(e) {
  const email = normalizeEmail(
    e && e.parameter ? e.parameter.email : ''
  );

  if (!email) {
    return {
      success: false,
      message: 'Administrator email is required.'
    };
  }

  const auth = requireAdmin(email);
  if (!auth.success) {
    return auth;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_PushSubscriptions');

  if (!sheet) {
    throw new Error('APP_PushSubscriptions sheet not found.');
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 1) {
    return { success: true, subscriptions: [] };
  }

  const headers = values[0].map(h => clean(h));
  const emailCol = headers.indexOf('Email');
  const deviceCol = headers.indexOf('DeviceLabel');
  const createdCol = headers.indexOf('CreatedAt');
  const activeCol = headers.indexOf('Active');

  if ([emailCol, deviceCol, createdCol, activeCol].some(i => i < 0)) {
    throw new Error(
      'APP_PushSubscriptions is missing required headers.'
    );
  }

  const subscriptions = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    // Only return devices registered to this administrator.
    if (normalizeEmail(row[emailCol]) !== email) continue;

    subscriptions.push({
      email: email,
      deviceLabel: clean(row[deviceCol]) || 'Administrator device',
      createdAt: row[createdCol] instanceof Date
        ? row[createdCol].toISOString()
        : String(row[createdCol] || ''),
      active:
        row[activeCol] === true ||
        String(row[activeCol]).toLowerCase() === 'true' ||
        String(row[activeCol]) === '1' ||
        String(row[activeCol]).toLowerCase() === 'yes'
    });
  }

  return {
    success: true,
    subscriptions: subscriptions
  };
}


function notifyAdminsOfAccessRequest() {
  const workerUrl =
    'https://kgii-push-worker.hinaamin-khowaja.workers.dev';

  const secret = PropertiesService
    .getScriptProperties()
    .getProperty('PUSH_API_SECRET');

  if (!secret) {
    throw new Error('PUSH_API_SECRET is missing from Script Properties.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_PushSubscriptions');

  if (!sheet) {
    throw new Error('APP_PushSubscriptions sheet not found.');
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    console.log('No push subscriptions registered yet.');
    return;
  }

  const headers = values[0].map(h => clean(h));
  const subscriptionCol = headers.indexOf('SubscriptionJSON');
  const activeCol = headers.indexOf('Active');

  if (subscriptionCol < 0 || activeCol < 0) {
    throw new Error('Required push subscription headers are missing.');
  }

  const subscriptions = [];

  for (let i = 1; i < values.length; i++) {
    const active = String(values[i][activeCol]).toLowerCase();

    if (active !== 'true') continue;

    try {
      const subscription = JSON.parse(values[i][subscriptionCol]);

      if (subscription.endpoint && subscription.keys) {
        subscriptions.push(subscription);
      }
    } catch (error) {
      console.error('Invalid subscription in row ' + (i + 1));
    }
  }

  if (subscriptions.length === 0) {
    console.log('No active push subscriptions found.');
    return;
  }

  const response = UrlFetchApp.fetch(workerUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + secret
    },
    payload: JSON.stringify({
      title: 'KGII Assessment',
      body: 'A new access request is waiting for review.',
      url: '/',
      subscriptions: subscriptions
    }),
    muteHttpExceptions: true
  });

  console.log(
    'Push Worker response: ' +
    response.getResponseCode() +
    ' ' +
    response.getContentText()
  );
}




/* DIRECT-SOURCE DASHBOARD (no APP_Records / APP_Indicators dependency) */
function getDashboardData(email) {
  const auth = getUserByEmail(email);
  if (!auth || !auth.success) return auth || {success:false,message:'User not found.'};
  const user = auth.user;
  if (String(user.status||'').toLowerCase()!=='approved' && String(user.role||'').toLowerCase()!=='admin')
    return {success:false,message:'Your account has not been approved.'};
  const isAdmin = String(user.role||'').toLowerCase()==='admin';
  const access = isAdmin ? [] : getUserAccess(user.email);
  if (!isAdmin && !access.length) return {success:false,message:'No active access has been assigned to this account.'};

  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const norm=v=>String(v==null?'':v).replace(/\u00a0/g,' ').trim().replace(/\s+/g,' ').toLowerCase();
  const clean=v=>String(v==null?'':v).replace(/\u00a0/g,' ').trim();
  const idx=(h,names)=>{for(const n of names){const i=h.findIndex(x=>norm(x)===norm(n));if(i>=0)return i;}return -1;};
  const val=(r,h,names)=>{const i=idx(h,names);return i<0?'':r[i];};
  const yearOf=v=>{if(v instanceof Date&&!isNaN(v))return String(v.getFullYear());const m=clean(v).match(/(?:19|20)\d{2}/);return m?m[0]:'';};
  const dateOf=v=>{if(v instanceof Date&&!isNaN(v))return v;const d=new Date(v);return isNaN(d)?null:d;};
  const geoKey=v=>norm(v).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  const master=ss.getSheetByName('RECs_list_Phase_Wise');
  const masterRows=master&&master.getLastRow()>1?master.getDataRange().getValues():[];
  const mh=masterRows.length?masterRows[0].map(clean):[];
  const directory=[];
  masterRows.slice(1).forEach(r=>{
    const Region=clean(val(r,mh,['Region'])).replace(/_\d+$/,'');
    const LocalBoard=clean(val(r,mh,['LocalBoard','Local Board']));
    const REC=clean(val(r,mh,['REC']));
    const StartingYear=Number(val(r,mh,['StartingYear','Starting Year']))||'';
    const Status=clean(val(r,mh,['Status']));
    if(Region&&LocalBoard&&REC)directory.push({Region,LocalBoard,REC,StartingYear,Status});
  });
  const active=directory.filter(x=>!x.Status||['active','yes','true','1'].includes(norm(x.Status)));
  const recCode_=v=>{const m=clean(v).match(/^\s*(\d{3,})\s*\|/);return m?m[1]:'';};
  const masterMap=new Map(active.map(x=>[[geoKey(x.Region),geoKey(x.LocalBoard),geoKey(x.REC)].join('|'),x]));
  // Kobo and app exports sometimes vary in board/REC display punctuation.
  // Use the stable numeric REC code as a guarded fallback when the full key differs.
  const masterByRecCode=new Map();
  active.forEach(x=>{const code=recCode_(x.REC);if(code&&!masterByRecCode.has(code))masterByRecCode.set(code,x);});
  const allowed=(region,board,rec)=>{
    // Admin dashboard reads the source sheets as the system of record.
    // Do not discard valid source submissions just because a REC is missing
    // or inactive in the reference directory.
    if(isAdmin)return true;
    return access.some(a=>{
      const ar=geoKey(a.Region||a.region),ab=geoKey(a.LocalBoard||a.localBoard),ac=geoKey(a.REC||a.rec);
      return (!ar||ar===geoKey(region))&&(!ab||ab===geoKey(board))&&(!ac||ac===geoKey(rec));
    });
  };
  const sources=[
    {name:'Students Pre Assessment',kind:'student-kobo',stage:'pre'},
    {name:'Students Post Assessment',kind:'student-kobo',stage:'auto'},
    {name:'Teachers Assessment',kind:'teacher-kobo'},
    {name:'APP_Student_Surveys',kind:'student-app'},
    {name:'APP_Teacher_Surveys',kind:'teacher-app'},
    {name:'APP_Teacher_Surveys_Cycle2',kind:'teacher-c2'}
  ];
  const loaded=[];
  sources.forEach(s=>{
    const sh=ss.getSheetByName(s.name);if(!sh||sh.getLastRow()<2)return;
    const v=sh.getDataRange().getValues();loaded.push({source:s,headers:v[0].map(clean),rows:v.slice(1)});
  });
  // Student stages are independent for each REC + theme. Original pre sheet is fixed baseline.
  const events=Object.create(null);
  const recEvents=Object.create(null);
  const themeNamesForRow_=(x,r)=>{
    if(x.source.name==='APP_Student_Surveys')return [directThemeId_(clean(val(r,x.headers,['ThemeName'])))].filter(Boolean);
    const cols=x.headers.map((name,j)=>({name,j})).filter(c=>/^Theme\s*[1-4]\s*:\s*(UA|A)\s*\d+$/i.test(c.name));
    return [...new Set(cols.filter(c=>r[c.j]!==''&&r[c.j]!==null&&r[c.j]!==undefined).map(c=>'Theme '+c.name.match(/^Theme\s*([1-4])/i)[1]))];
  };
  const rowDate_=(r,h)=>['start','Start','SubmittedAt','SubmissionDate','AssessmentDate','end','End'].map(k=>val(r,h,[k])).find(v=>clean(v)!=='');
  const recThemeKey_=(region,board,rec,theme)=>[geoKey(region),geoKey(board),geoKey(rec),geoKey(theme)].join('|');
  loaded.filter(x=>x.source.kind==='student-kobo'||x.source.kind==='student-app').forEach(x=>{
    x.rows.forEach((r,i)=>{
      if(x.source.name==='Students Pre Assessment')return;
      const h=x.headers,region=val(r,h,['1. Select your region','Select your region','Region']);
      const board=val(r,h,['LocalBoard','Local Board (Standardized)','Local Board','Name of Local Board']);
      const rec=val(r,h,['REC','REC (Standardized)','Name of RECs','Name of REC']);
      if(!region||!board||!rec)return;
      const d=dateOf(rowDate_(r,h));if(!d)return;
      const day=Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');
      const rowThemes=themeNamesForRow_(x,r);
      if(rowThemes.length){
        const recKey=[geoKey(region),geoKey(board),geoKey(rec)].join('|');
        (recEvents[recKey]||(recEvents[recKey]=[])).push({time:day,source:x.source.name,row:i+2});
      }
      rowThemes.forEach(theme=>{
        const key=recThemeKey_(region,board,rec,theme);
        (events[key]||(events[key]=[])).push({time:day,source:x.source.name,row:i+2});
      });
    });
  });
  const assignStages_=map=>{
    Object.keys(map).forEach(k=>{
      const dates=[...new Set(map[k].map(e=>e.time))].sort();
      map[k].forEach(e=>{e.sequence=dates.indexOf(e.time)+2;e.assessment=e.sequence===2?'Post':'Post '+(e.sequence-1);});
    });
  };
  assignStages_(events);
  assignStages_(recEvents);
  // Temporary assessment helper columns are no longer written to source sheets.
  const headers=['RecordID','CycleID','Year','CohortYear','ParticipantType','Assessment','Region','LocalBoard','REC','ParticipantCount','Phase','ThemeID','DimensionID','IndicatorID','Score','MaxScore','SourceSheet','SourceRow','SourceRecordID','ChildName','TeacherName'];
  const records=[];
  loaded.forEach(x=>{
    const s=x.source,h=x.headers;
    x.rows.forEach((r,i)=>{
      if(!r.some(v=>v!==''&&v!==null))return;
      const region=clean(val(r,h,['1. Select your region','Select your region','Region']));
      const board=clean(val(r,h,['LocalBoard','Local Board (Standardized)','Local Board','Name of Local Board']));
      const rec=clean(val(r,h,['REC','REC (Standardized)','Name of RECs','Name of REC']));
      if(!region||!board||!rec||!allowed(region,board,rec))return;
      const submitted=val(r,h,['start','Start','SubmittedAt','SubmissionDate','AssessmentDate','CreatedAt','end','End']);
      const date=dateOf(submitted);const submissionYear=yearOf(submitted)||yearOf(val(r,h,['end','End']))||yearOf(val(r,h,['Year']));
      const masterRec=masterMap.get([geoKey(region),geoKey(board),geoKey(rec)].join('|')) || masterByRecCode.get(recCode_(rec));
      const storedAssessment=clean(val(r,h,['Assessment','AssessmentStage','Select when this assessment conducted']));
      let cohort=masterRec?masterRec.StartingYear:'';
      // Stage is the reliable fallback for APP cohort classification:
      // Post 2+ belongs to the 2025 follow-up cohort; Pre belongs to 2026 intake.
      if(!cohort && (s.kind==='student-app'||s.kind==='teacher-app'||s.kind==='teacher-c2')){
        if(/^post\s*(?:2|3|4|5|6|7)$/i.test(storedAssessment))cohort=2025;
        else if(/^pre(?:\s*assessment)?$/i.test(storedAssessment))cohort=2026;
      }
      // Year is the actual assessment/submission year. CohortYear separately stores the REC's programme intake year.
      const year=submissionYear;
      const id=clean(val(r,h,['_uuid','_id','SubmissionID','meta/rootUuid']))||s.name+'-'+(i+2);
      const child=clean(val(r,h,['Name of a child:','Name of a child','ChildName']));
      const teacher=clean(val(r,h,['Name of participant','TeacherName','Your Name','Teacher']));
      const numericCols=h.map((name,j)=>({name,j})).filter(c=>
        /^Theme\s*[1-4]\s*:\s*(UA|A)\s*\d+$/i.test(c.name) &&
        // Theme 3 has a duplicated legacy UA3 column in both Kobo student
        // exports. The agreed framework has four Theme 3 indicators; exclude
        // this duplicate from both Pre and Post so each stage remains 87 points.
        !(['Students Pre Assessment','Students Post Assessment'].includes(s.name) &&
          /^Theme\s*3\s*:\s*UA\s*3$/i.test(c.name))
      );
      if(s.kind==='student-kobo'||s.kind==='student-app'){
        // Original student pre-assessment is the fixed four-theme baseline.
        // Keep every indicator in its denominator, including unanswered indicators.
        const isStudentPre = s.name === 'Students Pre Assessment';
        const themeNames = isStudentPre
          ? ['Theme 1','Theme 2','Theme 3','Theme 4']
          : s.kind==='student-app'
            ? [directThemeId_(clean(val(r,h,['ThemeName'])))]
            : [...new Set(numericCols.map(c=>{const m=c.name.match(/^Theme\s*([1-4])/i);return m&&r[c.j]!==''&&r[c.j]!==null&&r[c.j]!==undefined?'Theme '+m[1]:'';}).filter(Boolean))];
        themeNames.filter(Boolean).forEach(theme=>{
          const eventKey=recThemeKey_(region,board,rec,theme);
          const event=(events[eventKey]||[]).find(e=>e.source===s.name&&e.row===i+2);
          // The app student survey explicitly records its intended stage:
          // 2025 cohort submissions are Post 2 (or later), while 2026 cohort
          // submissions can be Pre. Never overwrite that value with a
          // date-sequence inference. Kobo post rows continue to be sequenced
          // independently for each REC + theme.
          let assessment = s.name === 'Students Pre Assessment'
            ? 'Pre'
            : s.kind === 'student-app'
              ? (clean(val(r,h,['Assessment','AssessmentStage','Select when this assessment conducted'])) || (event ? event.assessment : 'Post'))
              : (event ? event.assessment : clean(val(r,h,['Assessment','Specify the phase'])) || 'Post');
          // Student Post 2 submissions belong to Cycle 2; keep their submission year independent of cohort year.
          const cycle = s.kind==='student-app' && /^post\s*2$/i.test(assessment) ? 'C2' : 'C1';
          numericCols.forEach(c=>{
            if (s.kind === 'student-app') {
              const columnTheme = c.name.match(/^Theme\s*([1-4])\s*:\s*(UA|A)\s*\d+$/i);
              const selectedThemeNumber = Number((theme.match(/[1-4]/) || [])[0]);
              if (!columnTheme || Number(columnTheme[1]) !== selectedThemeNumber) return;
            }
            const raw=r[c.j];
            const isBlank = raw===''||raw===null||raw===undefined;
            if(isBlank && !isStudentPre)return;
            const score=isBlank?0:Number(raw);if(!Number.isFinite(score))return;
            const mm=c.name.match(/^Theme\s*([1-4])\s*:\s*(UA|A)\s*(\d+)$/i);
            if(!mm)return;
            records.push([id+'-'+mm[1]+'-'+mm[2]+'-'+mm[3],cycle,year,cohort,'Student',assessment,region,board,rec,1,'', 'T'+mm[1],mm[2].toUpperCase(), 'Theme'+mm[1]+':'+mm[2].toUpperCase()+mm[3],score,3,s.name,i+2,id,child,'']);
          });
        });
      } else if(s.kind==='teacher-kobo'){
        // Teacher content Kobo form stores one rubric response per theme and
        // assessment stage in descriptive columns, not normalized indicator columns.
        // Expand every received theme/stage response into its own dashboard record.
        for(let themeNo=1;themeNo<=4;themeNo++){
          for(const stage of ['Pre','Post']){
            const col=h.findIndex(name=>{
              const n=norm(name);
              return n.includes(stage.toLowerCase()+'-assessment rubrics for theme '+themeNo) ||
                n.includes(stage.toLowerCase()+' assessment rubrics for theme '+themeNo);
            });
            if(col<0)continue;
            const raw=r[col];
            if(raw===''||raw===null||raw===undefined)continue;
            const textValue=clean(raw);
            const rubricMatch=textValue.match(/\(([1-4])\)/);
            const score=rubricMatch?Number(rubricMatch[1]):Number(textValue);
            if(!Number.isFinite(score)||score<1||score>4)continue;
            const themeId='T'+themeNo;
            records.push([id+'-'+themeId+'-'+stage,'C1',year,cohort,'Teacher',stage,region,board,rec,1,'',themeId,'Overall',themeId+':'+stage,score,4,s.name,i+2,id,'',teacher]);
          }
        }
      } else if(s.kind==='teacher-app'){
        const themeLabel=directThemeId_(clean(val(r,h,['ThemeName']))||'Authority and Leadership');
        const themeMatch=String(themeLabel).match(/([1-4])/);
        const theme=themeMatch?'T'+themeMatch[1]:themeLabel;
        ['PreRating','PostRating'].forEach(k=>{const raw=val(r,h,[k]);if(raw===''||raw===null)return;const score=Number(raw);if(!Number.isFinite(score))return;records.push([id+'-'+k,'C1',year,cohort,'Teacher',k==='PreRating'?'Pre':'Post',region,board,rec,1,'',theme,'Overall',theme+':'+k,score,4,s.name,i+2,id,'',teacher]);});
      } else if(s.kind==='teacher-c2'){
        const assessment=clean(val(r,h,['Assessment']))||'Pre';
        ['Instructional','Questioning','Feedback'].forEach(dim=>{for(let n=1;n<=4;n++){const key=dim+'_Indicator'+n,raw=val(r,h,[key]);if(raw===''||raw===null)return;const score=Number(raw);if(!Number.isFinite(score))return;records.push([id+'-'+key,'C2',year||clean(val(r,h,['Year'])),cohort,'Teacher',assessment,region,board,rec,1,'',({Instructional:'S1',Questioning:'S2',Feedback:'S3'})[dim]||'S1',dim,dim+n,score,4,s.name,i+2,id,'',teacher]);}});
      }
    });
  });
  // Runtime visibility for the student-app source: makes an empty dashboard traceable
  // without exposing child names or changing any source data.
  const studentAppSource=loaded.find(x=>x.source.name==='APP_Student_Surveys');
  const studentAppRecords=records.filter(r=>r[16]==='APP_Student_Surveys');
  const studentSurveyDiagnostics={
    sourceSheetFound:!!studentAppSource,
    sourceRows:studentAppSource?studentAppSource.rows.filter(r=>r.some(v=>v!==''&&v!==null)).length:0,
    emittedIndicatorRecords:studentAppRecords.length,
    assessments:[...new Set(studentAppRecords.map(r=>String(r[5]||'')))],
    submissionYears:[...new Set(studentAppRecords.map(r=>String(r[2]||'')))],
    cohortYears:[...new Set(studentAppRecords.map(r=>String(r[3]||'')))],
    themes:[...new Set(studentAppRecords.map(r=>String(r[11]||'')))],
    recs:[...new Set(studentAppRecords.map(r=>String(r[8]||'')))]
  };
  return {success:true,user,access:isAdmin?'ALL':access,headers,records,targetRecs:directory,refs:directory.map(x=>({Region:x.Region,LocalBoard:x.LocalBoard,REC:x.REC})),indicators:[],studentSurveyDiagnostics};
}

/**
 * One-time cleanup: remove temporary assessment helper columns from source sheets.
 * Safe to run repeatedly; original assessment data columns are preserved.
 */
function removeAssessmentHelperColumnsFromSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const remove = new Set([
    'AssessmentDate', 'RECKey', 'AssessmentStage', 'AssessmentSequence',
    'Theme1AssessmentStage', 'Theme2AssessmentStage', 'Theme3AssessmentStage', 'Theme4AssessmentStage',
    'Theme1Sequence', 'Theme2Sequence', 'Theme3Sequence', 'Theme4Sequence'
  ]);
  const report = [];
  ss.getSheets().forEach(sh => {
    if (sh.getLastColumn() < 1) return;
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    const cols = [];
    headers.forEach((header, i) => { if (remove.has(String(header || '').trim())) cols.push(i + 1); });
    cols.sort((a, b) => b - a).forEach(col => sh.deleteColumn(col));
    if (cols.length) report.push({sheet: sh.getName(), removedColumns: cols.length});
  });
  return {success: true, message: 'Temporary assessment helper columns removed.', sheets: report};
}

function directThemeId_(name){
  const raw=String(name||'').trim();
  const numbered=raw.match(/^theme\s*([1-4])\b/i);
  if(numbered)return 'Theme '+numbered[1];
  const n=raw.toLowerCase().replace(/[^a-z]/g,'');
  const map={
    authorityandleadership:'Theme 1', authorityleadership:'Theme 1',
    intellectualtraditions:'Theme 2', ismailimuslimtraditions:'Theme 2',
    roleinfamilycommunityandsociety:'Theme 3', roleinfamilycommunity:'Theme 3',
    twoaspectsoflife:'Theme 4'
  };
  return map[n] || raw;
}


/* Runtime compatibility for legacy survey handlers: mappings are generated
   from the fixed source headers; normalized records are no longer written. */
function indicatorReferenceRows_(){
  const themes=[
    {id:'Theme 1',name:'Authority and Leadership',ua:4,a:6},
    {id:'Theme 2',name:'Ismaili Muslim Traditions',ua:4,a:3},
    {id:'Theme 3',name:'Role in family, community and society',ua:2,a:2},
    {id:'Theme 4',name:'Two aspects of life',ua:2,a:6}
  ];
  const out=[];
  themes.forEach(t=>{
    ['Pre','Post','Post 2','Post 3','Post 4','Post 5','Post 6','Post 7'].forEach(stage=>{
      for(let n=1;n<=t.ua;n++)out.push({CycleID:'C1',ParticipantType:'Student',Assessment:stage,ThemeID:t.id,ThemeName:t.name,DimensionID:'UA',IndicatorID:t.id.replace(' ','')+':UA'+n,MaxScore:3,AppSourceSheet:'APP_Student_Surveys'});
      for(let n=1;n<=t.a;n++)out.push({CycleID:'C1',ParticipantType:'Student',Assessment:stage,ThemeID:t.id,ThemeName:t.name,DimensionID:'A',IndicatorID:t.id.replace(' ','')+':A'+n,MaxScore:3,AppSourceSheet:'APP_Student_Surveys'});
    });
    ['Pre','Post'].forEach(stage=>out.push({CycleID:'C1',ParticipantType:'Teacher',Assessment:stage,ThemeID:t.id,ThemeName:t.name,DimensionID:'Overall',IndicatorID:stage+'Rating',MaxScore:5,AppSourceSheet:'APP_Teacher_Surveys'}));
  });
  return out;
}
function appendNormalizedRecords_(){return 0;}
