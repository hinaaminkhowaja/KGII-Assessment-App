const CONFIG = {
  USERS_SHEET: 'APP_Users',
  ACCESS_SHEET: 'APP_Access',
  STUDENT_SURVEYS_SHEET: 'APP_Student_Surveys',
  TEACHER_SURVEYS_SHEET: 'APP_Teacher_Surveys',
  RECORDS_SHEET: 'APP_Records',
  INDICATORS_SHEET: 'APP_Indicators',
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
  const requiredHeaders = ['Region', 'LocalBoard', 'REC', 'Cycle 1 Phase', 'Cycle 2 Phase', 'Status'];
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
      Cycle1Phase: clean(row[indexes['Cycle 1 Phase']]),
      Cycle2Phase: clean(row[indexes['Cycle 2 Phase']]),
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
 * Dashboard data is normalized directly from the six live source sheets.
 * APP_Records is deliberately not read; APP_Indicators remains the
 * single source of truth for indicator order, cycle, assessment and scores.
 */
function getDashboardData(email) {
  const userResult = getUserByEmail(email);
  if (!userResult.success) return userResult;

  const user = userResult.user;
  if (clean(user.status).toLowerCase() !== 'approved') {
    return { success: false, message: 'Your account has not been approved.' };
  }

  const isAdmin = clean(user.role).toLowerCase() === 'admin';
  const access = isAdmin ? [] : getUserAccess(user.email);
  if (!isAdmin && !access.length) {
    return { success: false, message: 'No active access has been assigned to this account.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cleanValue = v => String(v == null ? '' : v).replace(/\u00a0/g, ' ').trim();
  const norm = v => cleanValue(v).replace(/\s+/g, ' ').toLowerCase();
  const findIndex = (headers, candidates) => {
    for (const candidate of candidates) {
      const i = headers.findIndex(h => norm(h) === norm(candidate));
      if (i >= 0) return i;
    }
    return -1;
  };
  const getValue = (row, headers, candidates) => {
    const i = findIndex(headers, candidates);
    return i < 0 ? '' : row[i];
  };
  const yearFrom = value => {
    if (value instanceof Date && !isNaN(value.getTime())) return String(value.getFullYear());
    const raw = cleanValue(value);
    if (!raw) return '';
    const match = raw.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
    if (match) return match[1];
    const parsed = new Date(raw);
    return !isNaN(parsed.getTime()) ? String(parsed.getFullYear()) : '';
  };
  const makeFallbackId = (sourceName, sourceRow, row, headers) => {
    const identity = [
      sourceName, sourceRow,
      getValue(row, headers, ['start', 'Start']),
      getValue(row, headers, ['end', 'End']),
      getValue(row, headers, ['Name of a child:', 'Name of a child', 'ChildName', 'Name of participant', 'Your Name']),
      getValue(row, headers, ['1. Select your region', 'Select your region', 'Region']),
      getValue(row, headers, ['LocalBoard', 'Local Board (Standardized)']),
      getValue(row, headers, ['REC', 'REC (Standardized)'])
    ].map(cleanValue).join('|');
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, identity, Utilities.Charset.UTF_8);
    return 'SRC-' + bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('').substring(0, 24);
  };

  const indicatorSheet = ss.getSheetByName(CONFIG.INDICATORS_SHEET);
  if (!indicatorSheet) throw new Error('APP_Indicators sheet not found.');
  const mapValues = indicatorSheet.getDataRange().getValues();
  if (mapValues.length < 2) {
    return { success: true, user: user, access: isAdmin ? 'ALL' : access, headers: [], records: [] };
  }
  const mapHeaders = mapValues[0].map(cleanValue);
  const mi = {};
  mapHeaders.forEach((h, i) => { mi[h] = i; });
  const requiredMapHeaders = [
    'CycleID', 'ParticipantType', 'Assessment', 'ThemeID', 'DimensionID',
    'IndicatorID', 'MaxScore', 'SourceSheet', 'SourceColumn',
    'AppSourceSheet', 'AppSourceColumn'
  ];
  const missingMapHeaders = requiredMapHeaders.filter(h => mi[h] === undefined);
  if (missingMapHeaders.length) {
    throw new Error('APP_Indicators missing column(s): ' + missingMapHeaders.join(', '));
  }

  const mappings = mapValues.slice(1).filter(r => cleanValue(r[mi.IndicatorID])).map(r => ({
    cycle: cleanValue(r[mi.CycleID]),
    participant: cleanValue(r[mi.ParticipantType]),
    assessment: cleanValue(r[mi.Assessment]),
    theme: cleanValue(r[mi.ThemeID]),
    dimension: cleanValue(r[mi.DimensionID]),
    indicator: cleanValue(r[mi.IndicatorID]),
    maxScore: Number(r[mi.MaxScore]),
    koboSheet: cleanValue(r[mi.SourceSheet]),
    koboColumn: Number(r[mi.SourceColumn]),
    appSheet: cleanValue(r[mi.AppSourceSheet]),
    appColumn: Number(r[mi.AppSourceColumn])
  }));

  const sourceDefinitions = [
    { name: 'Students Pre Assessment', kind: 'kobo' },
    { name: 'Students Post Assessment', kind: 'kobo' },
    { name: 'Teachers Assessment', kind: 'kobo' },
    { name: 'APP_Student_Surveys', kind: 'app' },
    { name: 'APP_Teacher_Surveys', kind: 'app' },
    { name: 'APP_Teacher_Surveys_Cycle2', kind: 'app' }
  ];
  const outputHeaders = [
    'RecordID', 'CycleID', 'Year', 'ParticipantType', 'Assessment', 'Region',
    'LocalBoard', 'REC', 'ParticipantCount', 'Phase', 'ThemeID', 'DimensionID',
    'IndicatorID', 'Score', 'MaxScore', 'SourceSheet', 'SourceRow',
    'SourceRecordID', 'ChildName', 'TeacherName'
  ];
  const records = [];

  sourceDefinitions.forEach(source => {
    const sheet = ss.getSheetByName(source.name);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return;

    const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    const headers = values[0].map(cleanValue);
    const sourceMappings = mappings.filter(m =>
      norm(source.kind === 'kobo' ? m.koboSheet : m.appSheet) === norm(source.name)
    );
    if (!sourceMappings.length) return;

    values.slice(1).forEach((row, offset) => {
      if (!row.some(v => v !== '' && v !== null && v !== undefined)) return;
      const sourceRow = offset + 2;
      const region = cleanValue(getValue(row, headers, source.kind === 'kobo'
        ? ['1. Select your region', 'Select your region', 'Region']
        : ['Region']));
      const localBoard = cleanValue(getValue(row, headers, ['LocalBoard', 'Local Board (Standardized)']));
      const rec = cleanValue(getValue(row, headers, ['REC', 'REC (Standardized)']));
      if (!region || !localBoard || !rec) return;

      const explicitYear = cleanValue(getValue(row, headers, ['Year', 'Assessment Year']));
      const year = explicitYear ||
        yearFrom(getValue(row, headers, ['start', 'Start', 'SubmissionDate', 'SubmittedAt', 'CreatedAt'])) ||
        yearFrom(getValue(row, headers, ['end', 'End']));
      const phase = cleanValue(getValue(row, headers, ['Specify the phase', 'Phase']));
      const childName = cleanValue(getValue(row, headers, ['Name of a child:', 'Name of a child', 'ChildName']));
      const teacherName = cleanValue(getValue(row, headers, ['Name of participant', 'Your Name', 'TeacherName']));
      const sourceRecordID = cleanValue(getValue(row, headers, source.kind === 'kobo'
        ? ['_uuid', '_id', 'meta/rootUuid']
        : ['SubmissionID'])) || makeFallbackId(source.name, sourceRow, row, headers);

      sourceMappings.forEach(m => {
        const configuredColumn = source.kind === 'kobo' ? m.koboColumn : m.appColumn;
        if (!Number.isInteger(configuredColumn) || configuredColumn < 1 || configuredColumn > row.length) return;
        const rawScore = row[configuredColumn - 1];
        if (rawScore === '' || rawScore === null || rawScore === undefined || typeof rawScore === 'boolean') return;
        const score = Number(rawScore);
        if (!Number.isFinite(score) || !Number.isFinite(m.maxScore) || score < 0 || score > m.maxScore) return;

        // Keep each indicator/cycle/assessment as a separate normalized row.
        const recordID = [
          source.name, sourceRecordID, m.cycle, m.assessment, m.indicator
        ].join('|');
        records.push([
          recordID, m.cycle, year, m.participant, m.assessment, region,
          localBoard, rec, 1, phase, m.theme, m.dimension, m.indicator,
          score, m.maxScore, source.name, sourceRow, sourceRecordID,
          childName, teacherName
        ]);
      });
    });
  });

  // Enforce the same geography permissions as the former APP_Records dashboard.
  const normalizeRegionKey = value => norm(value).replace(/_\d+$/, '');
  const normalizeGeoKey = value => norm(value);
  const allowedRecords = isAdmin ? records : records.filter(row => {
    const rowRegion = normalizeRegionKey(row[5]);
    const rowLB = normalizeGeoKey(row[6]);
    const rowREC = normalizeGeoKey(row[7]);
    return access.some(scope =>
      (!normalizeRegionKey(scope.region) || rowRegion === normalizeRegionKey(scope.region)) &&
      (!normalizeGeoKey(scope.localBoard) || rowLB === normalizeGeoKey(scope.localBoard)) &&
      (!normalizeGeoKey(scope.rec) || rowREC === normalizeGeoKey(scope.rec))
    );
  });

  return {
    success: true,
    user: user,
    access: isAdmin ? 'ALL' : access,
    headers: outputHeaders,
    records: allowedRecords
  };
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


function handleSurveyClassification_(e) {
  const p = e && e.parameter ? e.parameter : {};
  const assessment = surveyAssessment_(p.assessment || 'Pre');
  const participantType = clean(p.participantType || 'Student');
  const themeID = clean(p.themeID);
  if (!clean(p.region) || !clean(p.localBoard) || !clean(p.rec) || !themeID) {
    throw new Error('Region, Local Board, REC and Theme are required for classification.');
  }
  const post2 = assessment !== 'Post 2' &&
    recThemeHasPreAndPost_(participantType, p.region, p.localBoard, p.rec, themeID);
  return {
    success: true,
    assessment: post2 ? 'Post 2' : assessment,
    cycleID: post2 ? 'C2' : surveyCycleId_(p.cycleID || 'Cycle 1'),
    isPost2: post2,
    classificationBasis: 'REC + participant type + theme'
  };
}


function recThemeHasPreAndPost_(participantType, region, localBoard, rec, themeID) {
  // Read the six original assessment/survey source sheets directly.
  // APP_Records is deliberately not used as a source for this decision.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const indicatorSheet = ss.getSheetByName(CONFIG.INDICATORS_SHEET);
  if (!indicatorSheet || indicatorSheet.getLastRow() < 2) {
    throw new Error('APP_Indicators mappings are required for Post 2 classification.');
  }
  const map = indicatorSheet.getDataRange().getValues();
  const mh = map[0].map(h => clean(h));
  const col = name => mh.indexOf(name);
  const required = ['CycleID','ParticipantType','Assessment','ThemeID','IndicatorID','SourceSheet','SourceColumn','AppSourceSheet','AppSourceColumn'];
  const missing = required.filter(name => col(name) < 0);
  if (missing.length) throw new Error('APP_Indicators missing classification columns: ' + missing.join(', '));
  const mappings = map.slice(1).filter(row =>
    clean(row[col('IndicatorID')]) &&
    clean(row[col('ParticipantType')]).toLowerCase() === clean(participantType).toLowerCase() &&
    clean(row[col('ThemeID')]) === clean(themeID)
  );
  const sources = [
    {name:'Students Pre Assessment', kind:'kobo'},
    {name:'Students Post Assessment', kind:'kobo'},
    {name:'Teachers Assessment', kind:'kobo'},
    {name:'APP_Student_Surveys', kind:'app'},
    {name:'APP_Teacher_Surveys', kind:'app'},
    {name:'APP_Teacher_Surveys_Cycle2', kind:'app'}
  ];
  const key = value => clean(value).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  let hasPre = false;
  let hasPost = false;
  sources.forEach(source => {
    const sheet = ss.getSheetByName(source.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(h => clean(h));
    const sourceMappings = mappings.filter(m =>
      key(m[source.kind === 'kobo' ? col('SourceSheet') : col('AppSourceSheet')]) === key(source.name)
    );
    if (!sourceMappings.length) return;
    values.slice(1).forEach(row => {
      const get = names => {
        for (const name of names) {
          const i = headers.findIndex(h => key(h) === key(name));
          if (i >= 0) return row[i];
        }
        return '';
      };
      if (key(get(source.kind === 'kobo'
        ? ['1. Select your region','Select your region','Region'] : ['Region'])) !== key(region) ||
          key(get(['LocalBoard','Local Board (Standardized)','Local Board'])) !== key(localBoard) ||
          key(get(['REC','REC (Standardized)'])) !== key(rec)) return;
      sourceMappings.forEach(m => {
        const cycle = key(m[col('CycleID')]).replace(/\s/g,'');
        if (cycle && !['c1','cycle1','1'].includes(cycle)) return;
        const sourceColumn = Number(m[col(source.kind === 'kobo' ? 'SourceColumn' : 'AppSourceColumn')]);
        if (!Number.isInteger(sourceColumn) || sourceColumn < 1 || sourceColumn > row.length) return;
        const score = row[sourceColumn - 1];
        if (score === '' || score === null || score === undefined || typeof score === 'boolean' || !Number.isFinite(Number(score))) return;
        const stage = key(m[col('Assessment')]);
        if (stage === 'pre' || stage === 'pre assessment') hasPre = true;
        if (stage === 'post' || stage === 'post assessment') hasPost = true;
      });
    });
  });
  return hasPre && hasPost;
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


function indicatorReferenceRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.INDICATORS_SHEET);

  if (!sheet) {
    throw new Error('APP_Indicators sheet not found.');
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    throw new Error('APP_Indicators has no indicator reference rows.');
  }

  const headers = data[0].map(h => clean(h));

  const required = [
    'CycleID',
    'ParticipantType',
    'Assessment',
    'ThemeID',
    'ThemeName',
    'DimensionID',
    'IndicatorID',
    'MaxScore',
    'SourceSheet',
    'SourceColumn',
    'AppSourceSheet',
    'AppSourceColumn'
  ];

  required.forEach(name => {
    if (headers.indexOf(name) < 0) {
      throw new Error('APP_Indicators is missing column: ' + name);
    }
  });

  return data.slice(1).map(row => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    return item;
  });
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


function appendNormalizedRecords_(
  sourceSheet,
  sourceRow,
  submissionId,
  participantType,
  assessment,
  body,
  indicatorEntries
) {
  if (!indicatorEntries.length) return 0;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordsSheet = ss.getSheetByName(CONFIG.RECORDS_SHEET);

  if (!recordsSheet) {
    throw new Error('APP_Records sheet not found.');
  }

  const recordHeaders = surveyHeaders_(recordsSheet);

  const required = [
    'RecordID',
    'CycleID',
    'Year',
    'ParticipantType',
    'Assessment',
    'Region',
    'LocalBoard',
    'REC',
    'ParticipantCount',
    'Phase',
    'ThemeID',
    'DimensionID',
    'IndicatorID',
    'Score',
    'MaxScore',
    'SourceSheet',
    'SourceRow',
    'SourceRecordID'
  ];

  required.forEach(name => {
    if (recordHeaders.indexOf(name) < 0) {
      throw new Error('APP_Records is missing column: ' + name);
    }
  });

  const cycleId = surveyCycleId_(body.cycleID);
  const configuredYear = surveyConfigValue_('AssessmentYear', 2026);
  const year = Number(body.year || configuredYear || 2026);
  const phase = assessment === 'Post 2'
    ? 'Post 2'
    : assessment === 'Pre'
      ? 'Pre-assessment'
      : 'Post-assessment';

  const participantCode = participantType === 'Student' ? 'S' : 'T';
const recordId =
  cycleId + '-' + participantCode + assessment.toUpperCase() + '-R' + sourceRow;

const rows = indicatorEntries.map((entry, index) => {
    const meta = entry.meta;

    const record = {
      RecordID: recordId,
      CycleID: cycleId,
      Year: year,
      ParticipantType: participantType,
      Assessment: assessment,
      Region: clean(body.region),
      LocalBoard: clean(body.localBoard),
      REC: clean(body.rec),
      ParticipantCount: 1,
      Phase: phase,
      ThemeID: meta.ThemeID,
      DimensionID: meta.DimensionID,
      IndicatorID: meta.IndicatorID,
      Score: entry.score,
      MaxScore: Number(meta.MaxScore),
      SourceSheet: sourceSheet.getName(),
      SourceRow: sourceRow,
      SourceRecordID: submissionId
    };

    return surveyRowFromObject_(recordHeaders, record);
  });

  recordsSheet
    .getRange(
      recordsSheet.getLastRow() + 1,
      1,
      rows.length,
      recordHeaders.length
    )
    .setValues(rows);

  return rows.length;
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
  let assessment = surveyAssessment_(body.assessment);
  let cycleId = surveyCycleId_(body.cycleID);
  const themeID = clean(body.themeID);
  if (cycleId === 'C1' && assessment !== 'Post 2' &&
      recThemeHasPreAndPost_('Student', body.region, body.localBoard, body.rec, themeID)) {
    assessment = 'Post 2';
    cycleId = 'C2';
  }
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

  const referenceRows = indicatorReferenceRows_();

  // Map the app's UA/A field keys to APP_Indicators using the
  // configured AppSourceSheet + AppSourceColumn. The indicator ID is
  // a normalized reporting ID; it is not necessarily a survey header.
  const indicatorEntries = ratingEntries.map(entry => {
    const sourceIndex = headers.indexOf(entry.indicatorId);

    if (sourceIndex < 0) {
      throw new Error(
        'Student survey sheet has no rating column: ' +
        entry.indicatorId
      );
    }

    const sourceColumn = sourceIndex + 1;
    const meta = referenceRows.find(item =>
      clean(item.CycleID) === clean(cycleId) &&
      clean(item.ParticipantType).toLowerCase() === 'student' &&
      surveyAssessment_(item.Assessment) === assessment &&
      clean(item.ThemeName).toLowerCase() === themeName.toLowerCase() &&
      clean(item.AppSourceSheet) === sheet.getName() &&
      Number(item.AppSourceColumn) === sourceColumn
    );

    if (!meta) {
      throw new Error(
        'No APP_Indicators App mapping for ' + cycleId + ', Student, ' +
        assessment + ', ' + themeName + ', source column ' + sourceColumn +
        ' (' + entry.indicatorId + ').'
      );
    }

    return {
      meta: meta,
      score: entry.score,
      appSourceColumn: sourceColumn,
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
  const referenceRows = indicatorReferenceRows_();
  const indicatorEntries = [];

  if (preScore !== null) {
    const meta = findTeacherThemeIndicator_(
      referenceRows, cycleId, 'Pre', themeName
    );

    indicatorEntries.push({ meta: meta, score: preScore, assessment: 'Pre' });
  }

  if (postScore !== null) {
    const meta = findTeacherThemeIndicator_(
      referenceRows, cycleId, 'Post', themeName
    );

    indicatorEntries.push({ meta: meta, score: postScore, assessment: 'Post' });
  }

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
  const referenceRows = indicatorReferenceRows_();
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

  // Validate the normalized-record destination before saving the submission.
  const recordsSheet = ss.getSheetByName(CONFIG.RECORDS_SHEET);

  if (!recordsSheet) {
    throw new Error('APP_Records sheet not found.');
  }

  const recordHeaders = surveyHeaders_(recordsSheet);
  const required = [
    'RecordID', 'CycleID', 'Year', 'ParticipantType', 'Assessment',
    'Region', 'LocalBoard', 'REC', 'ParticipantCount', 'Phase',
    'ThemeID', 'DimensionID', 'IndicatorID', 'Score', 'MaxScore',
    'SourceSheet', 'SourceRow', 'SourceRecordID'
  ];

  required.forEach(name => {
    if (recordHeaders.indexOf(name) < 0) {
      throw new Error('APP_Records is missing column: ' + name);
    }
  });

  const participantName = clean(body.teacherName);
  const phase = assessment === 'Pre' ? 'Pre-assessment' : 'Post-assessment';
  const recordId =
    'C2-T' + assessment.toUpperCase() + '-R' + sourceRow;

  const recordRows = [];

  skills.forEach(skill => {
    for (let i = 0; i < 4; i++) {
      const indicatorNumber = i + 1;
      const sourceHeader =
        (skill.key === 'instructional' ? 'Instructional_Indicator' :
         skill.key === 'questioning' ? 'Questioning_Indicator' :
         'Feedback_Indicator') + indicatorNumber;
      const sourceColumn = headers.indexOf(sourceHeader) + 1;

      const meta = referenceRows.find(item =>
        clean(item.CycleID) === 'C2' &&
        clean(item.ParticipantType).toLowerCase() === 'teacher' &&
        surveyAssessment_(item.Assessment) === assessment &&
        clean(item.AppSourceSheet) === sheet.getName() &&
        Number(item.AppSourceColumn) === sourceColumn
      );

      if (!meta || sourceColumn < 1) {
        throw new Error(
          'Missing C2 teacher App indicator mapping for ' +
          sourceHeader + ' (column ' + sourceColumn + ').'
        );
      }

      const record = {
        RecordID: recordId,
        CycleID: 'C2',
        Year: year,
        ParticipantType: 'Teacher',
        Assessment: assessment,
        Region: clean(body.region),
        LocalBoard: clean(body.localBoard),
        REC: clean(body.rec),
        ParticipantCount: 1,
        Phase: phase,
        ThemeID: meta.ThemeID,
        DimensionID: meta.DimensionID,
        IndicatorID: meta.IndicatorID,
        Score: Number(ratings[skill.key][i]),
        MaxScore: Number(meta.MaxScore) || 4,
        SourceSheet: sheet.getName(),
        SourceRow: sourceRow,
        SourceRecordID: submissionId,
        TeacherName: participantName
      };

      recordRows.push(surveyRowFromObject_(recordHeaders, record));
    }
  });

  // Write the submission, then its 12 normalized indicator records.
  sheet.getRange(sourceRow, 1, 1, headers.length).setValues([surveyRow]);

  recordsSheet.getRange(
    recordsSheet.getLastRow() + 1,
    1,
    recordRows.length,
    recordHeaders.length
  ).setValues(recordRows);

  return {
    success: true,
    message: 'Cycle 2 teacher assessment submitted successfully.',
    submissionId: submissionId,
    normalizedRecordsCreated: recordRows.length
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

  if (typeof appendAPPRecordLookupMatches_ === 'function') {
    appendAPPRecordLookupMatches_(
      matches,
      participantType,
      name,
      region,
      localBoard,
      rec
    );
  }

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

  
  if (typeof appendAPPRecordLookupMatches_ === 'function') {
    appendAPPRecordLookupMatches_(
      matches,
      participantType,
      name,
      region,
      localBoard,
      rec
    );
  }

  return { success: true, matches: matches };
}




function previewKoboImport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sources = [
    {
      name: 'Students Post Assessment',
      idColumn: '_uuid'
    },
    {
      name: 'Teachers Assessment',
      idColumn: '_uuid'
    }
  ];

  const report = sources.map(source => {
    const sheet = ss.getSheetByName(source.name);

    if (!sheet) {
      return {
        source: source.name,
        status: 'SOURCE SHEET NOT FOUND',
        rows: 0,
        uniqueIds: 0,
        missingIds: 0
      };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return {
        source: source.name,
        status: 'NO RESPONSE ROWS',
        rows: 0,
        uniqueIds: 0,
        missingIds: 0
      };
    }

    const headers = data[0].map(h => String(h).trim());
    const idIndex = headers.indexOf(source.idColumn);

    if (idIndex < 0) {
      return {
        source: source.name,
        status: 'UUID COLUMN NOT FOUND',
        rows: data.length - 1,
        uniqueIds: 0,
        missingIds: 0
      };
    }

    const ids = data.slice(1)
      .map(row => String(row[idIndex] || '').trim());

    const nonEmptyIds = ids.filter(Boolean);

    return {
      source: source.name,
      status: 'PREVIEW ONLY — NO CHANGES MADE',
      rows: data.length - 1,
      uniqueIds: new Set(nonEmptyIds).size,
      missingIds: ids.filter(id => !id).length
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function diagnoseKoboMissingUUIDs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sourceNames = [
    'Students Post Assessment',
    'Teachers Assessment'
  ];

  const keyHeaders = [
    '_uuid',
    '_id',
    'start',
    'end',
    'Name of a child:',
    'Name of participant',
    'Name of REC',
    'Local Board (Standardized)',
    'REC (Standardized)'
  ];

  const report = [];

  sourceNames.forEach(name => {
    const sheet = ss.getSheetByName(name);

    if (!sheet) {
      report.push({ source: name, status: 'SHEET NOT FOUND' });
      return;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      report.push({ source: name, status: 'NO DATA ROWS' });
      return;
    }

    const headers = data[0].map(h => String(h).trim());
    const uuidIndex = headers.indexOf('_uuid');

    if (uuidIndex < 0) {
      report.push({ source: name, status: 'UUID COLUMN NOT FOUND' });
      return;
    }

    const indexes = keyHeaders
      .map(header => ({
        header,
        index: headers.findIndex(
          h => h.toLowerCase() === header.toLowerCase()
        )
      }))
      .filter(item => item.index >= 0);

    let blankRows = 0;
    let missingUUIDWithData = 0;
    const samples = [];

    data.slice(1).forEach((row, i) => {
      const uuid = String(row[uuidIndex] || '').trim();
      if (uuid) return;

      const hasData = row.some(value =>
        String(value == null ? '' : value).trim() !== ''
      );

      if (!hasData) {
        blankRows++;
        return;
      }

      missingUUIDWithData++;

      if (samples.length < 10) {
        const sample = { sheetRow: i + 2 };
        indexes.forEach(item => {
          sample[item.header] = row[item.index];
        });
        samples.push(sample);
      }
    });

    report.push({
      source: name,
      totalRowsScanned: data.length - 1,
      blankRowsMissingUUID: blankRows,
      nonblankRowsMissingUUID: missingUUIDWithData,
      sampleMissingUUIDRows: samples
    });
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function previewExistingRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Records');

  if (!sheet) {
    Logger.log('APP_Records sheet not found.');
    return;
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    Logger.log('APP_Records has no data rows.');
    return;
  }

  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1);

  const sourceSheetIndex = headers.indexOf('SourceSheet');
  const sourceRowIndex = headers.indexOf('SourceRow');
  const sourceRecordIdIndex = headers.indexOf('SourceRecordID');
  const recordIdIndex = headers.indexOf('RecordID');

  const countsBySource = {};
  let missingSourceRecordId = 0;
  let missingRecordId = 0;
  const sourceRecordIds = [];

  rows.forEach(row => {
    const source = sourceSheetIndex >= 0
      ? String(row[sourceSheetIndex] || '').trim() || '(blank)'
      : '(column missing)';

    countsBySource[source] = (countsBySource[source] || 0) + 1;

    const sourceRecordId = sourceRecordIdIndex >= 0
      ? String(row[sourceRecordIdIndex] || '').trim()
      : '';

    const recordId = recordIdIndex >= 0
      ? String(row[recordIdIndex] || '').trim()
      : '';

    if (!sourceRecordId) missingSourceRecordId++;
    else sourceRecordIds.push(sourceRecordId);

    if (!recordId) missingRecordId++;
  });

  const duplicateSourceRecordIds = sourceRecordIds.length -
    new Set(sourceRecordIds).size;

  const report = {
    status: 'PREVIEW ONLY — NO CHANGES MADE',
    totalDataRows: rows.length,
    headers: headers,
    countsBySourceSheet: countsBySource,
    missingSourceRecordId,
    duplicateSourceRecordIds,
    missingRecordId,
    sampleSourceRows: rows.slice(0, 5).map(row => ({
      RecordID: recordIdIndex >= 0 ? row[recordIdIndex] : '(column missing)',
      SourceSheet: sourceSheetIndex >= 0 ? row[sourceSheetIndex] : '(column missing)',
      SourceRow: sourceRowIndex >= 0 ? row[sourceRowIndex] : '(column missing)',
      SourceRecordID: sourceRecordIdIndex >= 0
        ? row[sourceRecordIdIndex]
        : '(column missing)'
    }))
  };

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function previewSurveySheetsBeforeImport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const names = [
    'APP_Student_Surveys',
    'APP_Teacher_Surveys'
  ];

  const report = names.map(name => {
    const sheet = ss.getSheetByName(name);

    if (!sheet) {
      return { sheet: name, status: 'SHEET NOT FOUND' };
    }

    const data = sheet.getDataRange().getValues();

    if (!data.length) {
      return { sheet: name, status: 'EMPTY SHEET' };
    }

    const headers = data[0].map(h => String(h).trim());
    const rows = data.slice(1);
    const idIndex = headers.indexOf('SubmissionID');

    const populatedRows = rows.filter(row =>
      row.some(value => String(value == null ? '' : value).trim() !== '')
    );

    const ids = idIndex >= 0
      ? populatedRows.map(row => String(row[idIndex] || '').trim()).filter(Boolean)
      : [];

    return {
      sheet: name,
      status: 'PREVIEW ONLY — NO CHANGES MADE',
      populatedRows: populatedRows.length,
      rowsWithSubmissionID: ids.length,
      uniqueSubmissionIDs: new Set(ids).size,
      duplicateSubmissionIDs: ids.length - new Set(ids).size,
      headers: headers
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function previewKoboThemeMapping() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const studentThemes = {
    Theme1: ['Theme1:UA1', 'Theme1:A1', 'Theme1:UA2',
      'Theme1:A2', 'Theme1:A3', 'Theme1:UA3',
      'Theme1:UA4', 'Theme1:A4', 'Theme1:A5', 'Theme1:A6'],
    Theme2: ['Theme2:UA1', 'Theme2:UA2', 'Theme2:A1',
      'Theme2:UA3', 'Theme2:UA4', 'Theme2:A2', 'Theme2:A3'],
    Theme3: ['Theme3:UA1', 'Theme3:A1', 'Theme3:UA2', 'Theme3:A2'],
    Theme4: ['Theme4:UA1', 'Theme4:UA2', 'Theme4:A1',
      'Theme4:A2', 'Theme4:A3', 'Theme4:A4', 'Theme4:A5', 'Theme4:A6']
  };

  const results = [];

  function getColumn(headers, names) {
    for (const name of names) {
      const index = headers.findIndex(
        h => h.toLowerCase() === name.toLowerCase()
      );
      if (index >= 0) return index;
    }
    return -1;
  }

  // Student preview
  const studentSheet = ss.getSheetByName('Students Post Assessment');

  if (!studentSheet) {
    results.push({ source: 'Students Post Assessment', error: 'Sheet not found' });
  } else {
    const data = studentSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const uuidIndex = getColumn(headers, ['_uuid']);
    const phaseIndex = getColumn(headers, ['Specify the phase', 'Phase']);
    const counts = {};

    data.slice(1).forEach(row => {
      if (uuidIndex < 0 || !String(row[uuidIndex] || '').trim()) return;

      const phase = phaseIndex >= 0
        ? String(row[phaseIndex] || '').trim() || '(blank phase)'
        : '(phase column not found)';

      if (!counts[phase]) {
        counts[phase] = { submissions: 0, themesWithScores: {} };
      }
      counts[phase].submissions++;

      Object.keys(studentThemes).forEach(theme => {
        const indexes = studentThemes[theme]
          .map(name => getColumn(headers, [name]))
          .filter(index => index >= 0);

        const scored = indexes.filter(index =>
          row[index] !== '' && row[index] !== null &&
          String(row[index]).trim() !== ''
        ).length;

        if (scored > 0) {
          counts[phase].themesWithScores[theme] =
            (counts[phase].themesWithScores[theme] || 0) + 1;
        }
      });
    });

    results.push({
      source: 'Students Post Assessment',
      status: 'PREVIEW ONLY',
      uuidColumnFound: uuidIndex >= 0,
      phaseColumnFound: phaseIndex >= 0,
      indicatorColumnsFound: Object.values(studentThemes)
        .flat()
        .filter(name => getColumn(headers, [name]) >= 0).length,
      expectedIndicatorColumns: 29,
      countsByPhase: counts
    });
  }

  // Teacher preview
  const teacherSheet = ss.getSheetByName('Teachers Assessment');

  if (!teacherSheet) {
    results.push({ source: 'Teachers Assessment', error: 'Sheet not found' });
  } else {
    const data = teacherSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const uuidIndex = getColumn(headers, ['_uuid']);
    const counts = {};

    for (let theme = 1; theme <= 4; theme++) {
      const preIndex = getColumn(headers, [`Pre Theme ${theme} Score`]);
      const postIndex = getColumn(headers, [`Post Theme ${theme} Score`]);

      let preCount = 0;
      let postCount = 0;
      let bothCount = 0;

      data.slice(1).forEach(row => {
        if (uuidIndex < 0 || !String(row[uuidIndex] || '').trim()) return;

        const pre = preIndex >= 0 &&
          row[preIndex] !== '' && row[preIndex] !== null;
        const post = postIndex >= 0 &&
          row[postIndex] !== '' && row[postIndex] !== null;

        if (pre) preCount++;
        if (post) postCount++;
        if (pre && post) bothCount++;
      });

      counts[`Theme${theme}`] = {
        preScoreRows: preCount,
        postScoreRows: postCount,
        rowsWithBothScores: bothCount,
        preColumnFound: preIndex >= 0,
        postColumnFound: postIndex >= 0
      };
    }

    results.push({
      source: 'Teachers Assessment',
      status: 'PREVIEW ONLY',
      uuidColumnFound: uuidIndex >= 0,
      countsByTheme: counts
    });
  }

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}


function previewKoboImportHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sources = [
    'Students Post Assessment',
    'Teachers Assessment'
  ];

  const keywords = [
    'uuid', 'id', 'region', 'board', 'rec',
    'child', 'gender', 'participant', 'teacher',
    'position', 'designation', 'phase', 'assessment',
    'theme', 'activity', 'start', 'end',
    'email', 'submitted', 'rating', 'score',
    'remarks', 'training', 'years'
  ];

  const report = sources.map(name => {
    const sheet = ss.getSheetByName(name);

    if (!sheet) {
      return { source: name, error: 'Sheet not found' };
    }

    const headers = sheet.getRange(
      1, 1, 1, sheet.getLastColumn()
    ).getDisplayValues()[0].map(h => String(h).trim());

    return {
      source: name,
      matchingHeaders: headers
        .map((header, index) => ({
          column: index + 1,
          header: header
        }))
        .filter(item => keywords.some(keyword =>
          item.header.toLowerCase().includes(keyword)
        ))
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function previewKoboRequiredFields() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const checks = [
    {
      sheet: 'Students Post Assessment',
      fields: [
        '_uuid', '_id', 'start', 'end',
        '1. Select your region',
        'Local Board (Standardized)',
        'REC (Standardized)',
        'Name of REC', 'Name of a child:',
        "Child's gender",
        'Designation of a person assess a child',
        'If other, please specify designation',
        'Specify the phase',
        'Theme1:UA1', 'Theme1:A1',
        'Theme2:UA1', 'Theme3:UA1', 'Theme4:UA1'
      ]
    },
    {
      sheet: 'Teachers Assessment',
      fields: [
        '_uuid', '_id', 'start', 'end',
        'Select your region',
        'Local Board (Standardized)',
        'REC (Standardized)',
        'Name of participant',
        'Position of participant',
        'Select when this assessment conducted',
        'Select the themes',
        'Pre Theme 1 Score', 'Post Theme 1 Score',
        'Pre Theme 2 Score', 'Post Theme 2 Score',
        'Pre Theme 3 Score', 'Post Theme 3 Score',
        'Pre Theme 4 Score', 'Post Theme 4 Score'
      ]
    }
  ];

  const report = checks.map(item => {
    const sheet = ss.getSheetByName(item.sheet);

    if (!sheet) {
      return { sheet: item.sheet, error: 'Sheet not found' };
    }

    const headers = sheet.getRange(
      1, 1, 1, sheet.getLastColumn()
    ).getDisplayValues()[0].map(h => String(h).trim());

    return {
      sheet: item.sheet,
      fields: item.fields.map(field => {
        const index = headers.findIndex(
          h => h.toLowerCase() === field.toLowerCase()
        );

        return {
          field: field,
          found: index >= 0,
          column: index >= 0 ? index + 1 : null
        };
      })
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function previewKoboSurveyImportPlan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const studentThemes = {
    Theme1: ['Theme1:UA1', 'Theme1:A1', 'Theme1:UA2',
      'Theme1:A2', 'Theme1:A3', 'Theme1:UA3',
      'Theme1:UA4', 'Theme1:A4', 'Theme1:A5', 'Theme1:A6'],
    Theme2: ['Theme2:UA1', 'Theme2:UA2', 'Theme2:A1',
      'Theme2:UA3', 'Theme2:UA4', 'Theme2:A2', 'Theme2:A3'],
    Theme3: ['Theme3:UA1', 'Theme3:A1', 'Theme3:UA2', 'Theme3:A2'],
    Theme4: ['Theme4:UA1', 'Theme4:UA2', 'Theme4:A1',
      'Theme4:A2', 'Theme4:A3', 'Theme4:A4', 'Theme4:A5', 'Theme4:A6']
  };

  function filled(value) {
    return value !== '' && value !== null &&
      value !== undefined && String(value).trim() !== '';
  }

  function indexOf(headers, name) {
    return headers.findIndex(
      h => String(h).trim().toLowerCase() === name.toLowerCase()
    );
  }

  function value(row, headers, name) {
    const i = indexOf(headers, name);
    return i < 0 ? '' : row[i];
  }

  const report = {
    status: 'PREVIEW ONLY — NO CHANGES MADE',
    students: {},
    teachers: {},
    existingRecords: {},
    notes: [
      'No survey rows or normalized records were written.',
      'Counts estimate rows with theme score data, not confirmed new records.',
      'Existing APP_Records coverage cannot be reliably matched by UUID yet.'
    ]
  };

  // Student import candidates
  const studentSheet = ss.getSheetByName('Students Post Assessment');

  if (!studentSheet) {
    report.students.error = 'Source sheet not found';
  } else {
    const data = studentSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const uuidIndex = indexOf(headers, '_uuid');
    const phaseIndex = indexOf(headers, 'Specify the phase');

    const phases = {};
    let validUUIDRows = 0;
    let missingUUIDRowsWithData = 0;
    const samples = [];

    data.slice(1).forEach((row, offset) => {
      const uuid = uuidIndex < 0 ? '' : String(row[uuidIndex] || '').trim();
      const hasData = row.some(filled);

      if (!uuid) {
        if (hasData) missingUUIDRowsWithData++;
        return;
      }

      validUUIDRows++;
      const phase = phaseIndex < 0
        ? '(phase column missing)'
        : String(row[phaseIndex] || '').trim() || '(blank phase)';

      if (!phases[phase]) {
        phases[phase] = {
          submissions: 0,
          candidateSurveyRowsByTheme: {},
          indicatorValuesPresentByTheme: {}
        };
      }

      phases[phase].submissions++;

      const themesPresent = [];

      Object.keys(studentThemes).forEach(theme => {
        const indexes = studentThemes[theme]
          .map(name => indexOf(headers, name))
          .filter(i => i >= 0);

        const count = indexes.filter(i => filled(row[i])).length;

        if (count > 0) {
          phases[phase].candidateSurveyRowsByTheme[theme] =
            (phases[phase].candidateSurveyRowsByTheme[theme] || 0) + 1;

          phases[phase].indicatorValuesPresentByTheme[theme] =
            (phases[phase].indicatorValuesPresentByTheme[theme] || 0) + count;

          themesPresent.push(theme);
        }
      });

      if (samples.length < 8) {
        samples.push({
          sourceRow: offset + 2,
          uuid: uuid,
          phase: phase,
          child: value(row, headers, 'Name of a child:'),
          region: value(row, headers, '1. Select your region'),
          standardizedBoard: value(row, headers, 'Local Board (Standardized)'),
          standardizedREC: value(row, headers, 'REC (Standardized)'),
          themesWithScores: themesPresent
        });
      }
    });

    report.students = {
      source: 'Students Post Assessment',
      validUUIDSubmissions: validUUIDRows,
      nonblankRowsMissingUUID: missingUUIDRowsWithData,
      phases: phases,
      sampleCandidates: samples
    };
  }

  // Teacher import candidates
  const teacherSheet = ss.getSheetByName('Teachers Assessment');

  if (!teacherSheet) {
    report.teachers.error = 'Source sheet not found';
  } else {
    const data = teacherSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const uuidIndex = indexOf(headers, '_uuid');

    const themes = {};
    let validUUIDRows = 0;
    let missingUUIDRowsWithData = 0;
    const samples = [];

    for (let n = 1; n <= 4; n++) {
      themes['Theme' + n] = {
        rowsWithScores: 0,
        preScoresPresent: 0,
        postScoresPresent: 0
      };
    }

    data.slice(1).forEach((row, offset) => {
      const uuid = uuidIndex < 0 ? '' : String(row[uuidIndex] || '').trim();
      const hasData = row.some(filled);

      if (!uuid) {
        if (hasData) missingUUIDRowsWithData++;
        return;
      }

      validUUIDRows++;
      const themesWithScores = [];

      for (let n = 1; n <= 4; n++) {
        const pre = value(row, headers, `Pre Theme ${n} Score`);
        const post = value(row, headers, `Post Theme ${n} Score`);
        const hasPre = filled(pre);
        const hasPost = filled(post);

        if (hasPre) themes['Theme' + n].preScoresPresent++;
        if (hasPost) themes['Theme' + n].postScoresPresent++;

        if (hasPre || hasPost) {
          themes['Theme' + n].rowsWithScores++;
          themesWithScores.push('Theme' + n);
        }
      }

      if (samples.length < 8) {
        samples.push({
          sourceRow: offset + 2,
          uuid: uuid,
          teacher: value(row, headers, 'Name of participant'),
          region: value(row, headers, 'Select your region'),
          standardizedBoard: value(row, headers, 'Local Board (Standardized)'),
          standardizedREC: value(row, headers, 'REC (Standardized)'),
          selectedTheme: value(row, headers, 'Select the themes'),
          themesWithScores: themesWithScores
        });
      }
    });

    report.teachers = {
      source: 'Teachers Assessment',
      validUUIDSubmissions: validUUIDRows,
      nonblankRowsMissingUUID: missingUUIDRowsWithData,
      themes: themes,
      sampleCandidates: samples
    };
  }

  // Existing normalized-record counts only; no changes
  const recordsSheet = ss.getSheetByName('APP_Records');

  if (recordsSheet) {
    const data = recordsSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const sourceIndex = indexOf(headers, 'SourceSheet');
    const countBySource = {};

    data.slice(1).forEach(row => {
      if (row.every(v => !filled(v))) return;
      const source = sourceIndex < 0
        ? '(SourceSheet column missing)'
        : String(row[sourceIndex] || '').trim() || '(blank source)';
      countBySource[source] = (countBySource[source] || 0) + 1;
    });

    report.existingRecords = {
      totalRowsBySource: countBySource,
      totalDataRows: data.length - 1
    };
  } else {
    report.existingRecords.error = 'APP_Records sheet not found';
  }

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function previewRecordMatchingReadiness() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Records');

  if (!sheet) throw new Error('APP_Records sheet not found.');

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1);

  const idx = name => headers.findIndex(
    h => h.toLowerCase() === name.toLowerCase()
  );

  const fields = [
    'CycleID', 'ParticipantType', 'Assessment',
    'Region', 'LocalBoard', 'REC', 'Phase',
    'ThemeID', 'DimensionID', 'IndicatorID',
    'Score', 'MaxScore', 'SourceSheet',
    'SourceRow', 'SourceRecordID'
  ];

  const missingCounts = {};
  fields.forEach(field => {
    const i = idx(field);
    missingCounts[field] = i < 0
      ? 'COLUMN NOT FOUND'
      : rows.filter(row =>
          row[i] === '' || row[i] === null ||
          row[i] === undefined ||
          String(row[i]).trim() === ''
        ).length;
  });

  const sourceGroups = {};
  const scoreGroups = {};
  const assessmentGroups = {};

  rows.forEach(row => {
    const get = name => {
      const i = idx(name);
      return i < 0 ? '' : String(row[i] ?? '').trim();
    };

    const source = get('SourceSheet') || '(blank)';
    sourceGroups[source] = (sourceGroups[source] || 0) + 1;

    const assessmentKey = [
      get('CycleID'), get('ParticipantType'),
      get('Assessment'), get('Region'),
      get('LocalBoard'), get('REC'),
      get('ThemeID'), get('IndicatorID')
    ].join('|');

    assessmentGroups[assessmentKey] =
      (assessmentGroups[assessmentKey] || 0) + 1;

    const scoreKey = assessmentKey + '|' + get('Score');
    scoreGroups[scoreKey] = (scoreGroups[scoreKey] || 0) + 1;
  });

  const repeatedAssessmentKeys = Object.values(assessmentGroups)
    .filter(count => count > 1).length;

  const repeatedScoreKeys = Object.values(scoreGroups)
    .filter(count => count > 1).length;

  const report = {
    status: 'PREVIEW ONLY — NO CHANGES MADE',
    totalRows: rows.length,
    missingValuesByField: missingCounts,
    rowsBySourceSheet: sourceGroups,
    distinctAssessmentKeys: Object.keys(assessmentGroups).length,
    repeatedAssessmentKeys: repeatedAssessmentKeys,
    distinctAssessmentAndScoreKeys: Object.keys(scoreGroups).length,
    repeatedAssessmentAndScoreKeys: repeatedScoreKeys,
    note: 'Repeated keys may represent different children or teachers because names are not stored in APP_Records.'
  };

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function checkKoboSyncStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetNames = [
    'Students Post Assessment',
    'Teachers Assessment',
    'APP_Student_Surveys',
    'APP_Teacher_Surveys',
    'APP_Records'
  ];

  const report = {};

  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);

    if (!sheet) {
      report[name] = { error: 'Sheet not found' };
      return;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.length
      ? data[0].map(h => String(h).trim())
      : [];

    const uuidIndex = headers.findIndex(
      h => h.toLowerCase() === '_uuid'
    );

    const submissionIdIndex = headers.findIndex(
      h => h.toLowerCase() === 'submissionid'
    );

    const idIndex = uuidIndex >= 0
      ? uuidIndex
      : submissionIdIndex;

    let identifiedRows = 0;

    if (idIndex >= 0) {
      identifiedRows = data.slice(1).filter(row =>
        String(row[idIndex] || '').trim() !== ''
      ).length;
    }

    report[name] = {
      lastRow: sheet.getLastRow(),
      dataRows: Math.max(0, sheet.getLastRow() - 1),
      identifierColumn: idIndex >= 0 ? headers[idIndex] : 'Not found',
      rowsWithIdentifier: identifiedRows,
      headers: headers
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function checkKoboSyncCounts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const names = [
    'Students Pre Assessment',
    'Students Post Assessment',
    'Teachers Assessment',
    'APP_Student_Surveys',
    'APP_Teacher_Surveys',
    'APP_Records'
  ];

  const report = names.map(name => {
    const sh = ss.getSheetByName(name);

    if (!sh) return { sheet: name, status: 'NOT FOUND' };

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    if (lastRow < 2 || lastCol < 1) {
      return { sheet: name, dataRows: 0, rowsWithUUID: 0 };
    }

    const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idCol = headers.findIndex(h => h === '_uuid');

    const submissionCol = headers.findIndex(
      h => h === 'submissionid'
    );

    const col = idCol >= 0 ? idCol : submissionCol;

    return {
      sheet: name,
      dataRows: lastRow - 1,
      rowsWithUUID: idCol >= 0
        ? data.slice(1).filter(r => String(r[idCol] || '').trim()).length
        : 'UUID column not found',
      rowsWithSubmissionID: submissionCol >= 0
        ? data.slice(1).filter(r => String(r[submissionCol] || '').trim()).length
        : 'SubmissionID column not found'
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
}


function previewKoboSurveyImport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function readSheet(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Sheet not found: ' + name);
    const values = sh.getDataRange().getValues();
    const headers = values[0].map(h => String(h).trim());
    const col = {};
    headers.forEach((h, i) => col[h.toLowerCase()] = i);

    function find(...names) {
      for (const name of names) {
        const i = col[name.toLowerCase()];
        if (i !== undefined) return i;
      }
      return -1;
    }

    return { values, headers, find };
  }

  const student = readSheet('Students Post Assessment');
  const teacher = readSheet('Teachers Assessment');

  const studentThemes = {
    '1': {
      name: 'Authority and Leadership',
      indicators: ['Theme1:UA1','Theme1:A1','Theme1:UA2','Theme1:A2',
        'Theme1:A3','Theme1:UA3','Theme1:UA4','Theme1:A4','Theme1:A5','Theme1:A6']
    },
    '2': {
      name: 'Ismaili Muslim Traditions',
      indicators: ['Theme2:UA1','Theme2:UA2','Theme2:A1','Theme2:UA3',
        'Theme2:UA4','Theme2:A2','Theme2:A3']
    },
    '3': {
      name: 'Role in Family, Community and Society',
      indicators: ['Theme3:UA1','Theme3:A1','Theme3:UA2','Theme3:A2']
    },
    '4': {
      name: 'Two Aspects of Life',
      indicators: ['Theme4:UA1','Theme4:UA2','Theme4:A1','Theme4:A2',
        'Theme4:A3','Theme4:A4','Theme4:A5','Theme4:A6']
    }
  };

  const studentReport = {
    sourceRowsWithUUID: 0,
    candidatesByPhaseAndTheme: {},
    incompleteThemeExamples: [],
    missingRequiredColumns: []
  };

  const suuid = student.find('_uuid');
  const sphase = student.find('Specify the phase');
  const sregion = student.find('1. Select your region');
  const sboard = student.find('Local Board (Standardized)');
  const srec = student.find('REC (Standardized)');
  const sname = student.find('Name of a child:');

  [
    ['_uuid', suuid], ['Specify the phase', sphase],
    ['1. Select your region', sregion],
    ['Local Board (Standardized)', sboard],
    ['REC (Standardized)', srec],
    ['Name of a child:', sname]
  ].forEach(([name, index]) => {
    if (index < 0) studentReport.missingRequiredColumns.push(name);
  });

  Object.values(studentThemes).forEach(theme => {
    theme.indicators.forEach(name => {
      if (student.find(name) < 0) {
        studentReport.missingRequiredColumns.push(name);
      }
    });
  });

  if (studentReport.missingRequiredColumns.length) {
    throw new Error('Student source columns missing: ' +
      studentReport.missingRequiredColumns.join(', '));
  }

  const phaseIndex = sphase;

  student.values.slice(1).forEach((row, offset) => {
    const uuid = String(row[suuid] || '').trim();
    if (!uuid) return;
    studentReport.sourceRowsWithUUID++;

    const phase = String(row[phaseIndex] || '').trim() || '(blank phase)';

    Object.entries(studentThemes).forEach(([number, theme]) => {
      const values = theme.indicators.map(name =>
        row[student.find(name)]
      );
      const filled = values.filter(v =>
        v !== '' && v !== null && v !== undefined &&
        String(v).trim() !== ''
      ).length;

      if (!filled) return;

      const key = phase + ' | Theme ' + number;
      if (!studentReport.candidatesByPhaseAndTheme[key]) {
        studentReport.candidatesByPhaseAndTheme[key] = {
          candidateRows: 0,
          rowsWithAllIndicators: 0,
          totalIndicatorValues: 0
        };
      }

      const item = studentReport.candidatesByPhaseAndTheme[key];
      item.candidateRows++;
      item.totalIndicatorValues += filled;
      if (filled === theme.indicators.length) item.rowsWithAllIndicators++;

      if (filled < theme.indicators.length &&
          studentReport.incompleteThemeExamples.length < 10) {
        studentReport.incompleteThemeExamples.push({
          sourceRow: offset + 2,
          uuid: uuid,
          child: String(row[sname] || ''),
          phase: phase,
          theme: number,
          filledIndicators: filled,
          expectedIndicators: theme.indicators.length
        });
      }
    });
  });

  const teacherReport = {
    sourceRowsWithUUID: 0,
    candidatesByTheme: {},
    missingRequiredColumns: []
  };

  const tuuid = teacher.find('_uuid');
  const tregion = teacher.find('Select your region');
  const tboard = teacher.find('Local Board (Standardized)');
  const trec = teacher.find('REC (Standardized)');
  const tname = teacher.find('Name of participant');

  [
    ['_uuid', tuuid], ['Select your region', tregion],
    ['Local Board (Standardized)', tboard],
    ['REC (Standardized)', trec], ['Name of participant', tname]
  ].forEach(([name, index]) => {
    if (index < 0) teacherReport.missingRequiredColumns.push(name);
  });

  const teacherScores = {
    '1': ['Pre Theme 1 Score', 'Post Theme 1 Score'],
    '2': ['Pre Theme 2 Score', 'Post Theme 2 Score'],
    '3': ['Pre Theme 3 Score', 'Post Theme 3 Score'],
    '4': ['Pre Theme 4 Score', 'Post Theme 4 Score']
  };

  Object.values(teacherScores).flat().forEach(name => {
    if (teacher.find(name) < 0) teacherReport.missingRequiredColumns.push(name);
  });

  if (teacherReport.missingRequiredColumns.length) {
    throw new Error('Teacher source columns missing: ' +
      teacherReport.missingRequiredColumns.join(', '));
  }

  teacher.values.slice(1).forEach(row => {
    const uuid = String(row[tuuid] || '').trim();
    if (!uuid) return;
    teacherReport.sourceRowsWithUUID++;

    Object.entries(teacherScores).forEach(([theme, columns]) => {
      const pre = row[teacher.find(columns[0])];
      const post = row[teacher.find(columns[1])];
      const hasPre = pre !== '' && pre != null;
      const hasPost = post !== '' && post != null;

      if (!hasPre && !hasPost) return;

      if (!teacherReport.candidatesByTheme[theme]) {
        teacherReport.candidatesByTheme[theme] = {
          candidateRows: 0,
          withPreAndPost: 0,
          preOnly: 0,
          postOnly: 0
        };
      }

      const item = teacherReport.candidatesByTheme[theme];
      item.candidateRows++;
      if (hasPre && hasPost) item.withPreAndPost++;
      else if (hasPre) item.preOnly++;
      else item.postOnly++;
    });
  });

  const result = {
    status: 'PREVIEW ONLY — NO DATA WRITTEN',
    student: studentReport,
    teacher: teacherReport,
    existingStudentSurveyRows:
      Math.max(0, ss.getSheetByName('APP_Student_Surveys').getLastRow() - 1),
    existingTeacherSurveyRows:
      Math.max(0, ss.getSheetByName('APP_Teacher_Surveys').getLastRow() - 1),
    note: 'Counts are candidate rows, not proof that records are new to APP_Records.'
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function previewKoboIndicatorMapping() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('APP_Indicators');

  if (!sh) throw new Error('APP_Indicators sheet not found.');

  const data = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const required = [
    'CycleID', 'ParticipantType', 'Assessment',
    'ThemeID', 'DimensionID', 'IndicatorID',
    'MaxScore', 'SourceSheet', 'SourceColumn'
  ];

  required.forEach(name => {
    if (col[name] === undefined) {
      throw new Error('APP_Indicators is missing column: ' + name);
    }
  });

  const report = data.slice(1)
    .filter(row => String(row[col.IndicatorID] || '').trim())
    .map(row => ({
      cycle: row[col.CycleID],
      participant: row[col.ParticipantType],
      assessment: row[col.Assessment],
      theme: row[col.ThemeID],
      dimension: row[col.DimensionID],
      indicator: row[col.IndicatorID],
      maxScore: row[col.MaxScore],
      sourceSheet: row[col.SourceSheet],
      sourceColumn: row[col.SourceColumn]
    }));

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA CHANGED',
    mappingRows: report.length,
    mappings: report
  }, null, 2));
}


function previewMissingKoboRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordsSheet = ss.getSheetByName('APP_Records');
  const indicatorsSheet = ss.getSheetByName('APP_Indicators');

  if (!recordsSheet || !indicatorsSheet) {
    throw new Error('APP_Records or APP_Indicators sheet not found.');
  }

  const norm = v => String(v ?? '').trim().toLowerCase();
  const recData = recordsSheet.getDataRange().getValues();
  const recHeaders = recData[0].map(v => String(v).trim());
  const ri = {};
  recHeaders.forEach((h, i) => ri[h] = i);

  const required = [
    'CycleID', 'ParticipantType', 'Assessment', 'SourceSheet',
    'SourceRow', 'ThemeID', 'IndicatorID'
  ];
  required.forEach(h => {
    if (ri[h] === undefined) throw new Error('APP_Records missing ' + h);
  });

  // Match records by source row and indicator, not by score alone.
  const existing = new Set();
  recData.slice(1).forEach(r => {
    existing.add([
      norm(r[ri.SourceSheet]),
      norm(r[ri.SourceRow]),
      norm(r[ri.ParticipantType]),
      norm(r[ri.Assessment]),
      norm(r[ri.ThemeID]),
      norm(r[ri.IndicatorID])
    ].join('|'));
  });

  const mapData = indicatorsSheet.getDataRange().getValues();
  const mh = mapData[0].map(v => String(v).trim());
  const mi = {};
  mh.forEach((h, i) => mi[h] = i);

  const maps = mapData.slice(1).filter(r =>
    String(r[mi.IndicatorID] || '').trim() &&
    ['Student', 'Teacher'].includes(String(r[mi.ParticipantType] || '').trim()) &&
    ['Pre', 'Post'].includes(String(r[mi.Assessment] || '').trim())
  );

  const summary = {};
  const examples = [];

  function addSource(sheetName, participantType, mode) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      summary[sheetName] = { error: 'Source sheet not found' };
      return;
    }

    const data = sh.getDataRange().getValues();
    const headers = data[0].map(v => String(v).trim());
    const find = name => headers.findIndex(h => norm(h) === norm(name));

    const uuidCol = find('_uuid');
    const phaseCol = find('Specify the phase');
    const mappings = maps.filter(m =>
      norm(m[mi.ParticipantType]) === norm(participantType) &&
      norm(m[mi.SourceSheet]) === norm(sheetName)
    );

    const item = summary[sheetName] = {
      sourceRowsWithUUID: 0,
      nonblankIndicatorScores: 0,
      alreadyInRecords: 0,
      missingFromRecords: 0,
      missingExamples: []
    };

    if (uuidCol < 0) {
      item.error = 'UUID column not found; this preview requires UUIDs.';
      return;
    }

    data.slice(1).forEach((row, offset) => {
      const uuid = String(row[uuidCol] || '').trim();
      if (!uuid) return;
      item.sourceRowsWithUUID++;

      let phase = phaseCol >= 0 ? norm(row[phaseCol]) : '';
      mappings.forEach(m => {
        const assessment = String(m[mi.Assessment]).trim();
        const theme = String(m[mi.ThemeID]).trim();
        const indicator = String(m[mi.IndicatorID]).trim();
        const sourceColumn = Number(m[mi.SourceColumn]);

        if (!Number.isInteger(sourceColumn) || sourceColumn < 1) return;

        if (mode === 'student') {
          if (assessment === 'Pre' && phase !== 'pre-assessment') return;
          if (assessment === 'Post' && !phase.startsWith('post-assessment')) return;

          if (phase.includes('theme one') && theme !== 'T1') return;
          if (phase.includes('theme two') && theme !== 'T2') return;
          if (phase.includes('theme three') && !['T3', 'T4'].includes(theme)) return;
        }

        const score = row[sourceColumn - 1];
        if (score === '' || score === null || score === undefined ||
            String(score).trim() === '') return;

        item.nonblankIndicatorScores++;

        const key = [
          norm(sheetName), String(offset + 2),
          norm(participantType), norm(assessment),
          norm(theme), norm(indicator)
        ].join('|');

        if (existing.has(key)) {
          item.alreadyInRecords++;
        } else {
          item.missingFromRecords++;
          if (item.missingExamples.length < 5) {
            item.missingExamples.push({
              sourceRow: offset + 2,
              uuid: uuid,
              assessment: assessment,
              theme: theme,
              indicator: indicator,
              score: score
            });
          }
        }
      });
    });

    item.missingExamples = item.missingExamples.slice(0, 5);
  }

  addSource('Students Post Assessment', 'Student', 'student');
  addSource('Teachers Assessment', 'Teacher', 'teacher');

  Logger.log(JSON.stringify({
    status: 'PREVIEW ONLY — NO DATA WRITTEN',
    existingRecordRows: recData.length - 1,
    comparisonMethod: 'SourceSheet + SourceRow + ParticipantType + Assessment + ThemeID + IndicatorID',
    results: summary,
    warning: 'If existing historical records use different source-row numbering, some may appear missing. Review the report before importing.'
  }, null, 2));
}


function verifyMissingKoboRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const records = ss.getSheetByName('APP_Records').getDataRange().getValues();
  const headers = records[0].map(h => String(h).trim());
  const ix = {};
  headers.forEach((h, i) => ix[h] = i);

  const norm = v => String(v ?? '').trim().toLowerCase();

  const existingKeys = new Set();
  const existingUUIDs = new Set();

  records.slice(1).forEach(r => {
    existingKeys.add([
      norm(r[ix.SourceSheet]),
      norm(r[ix.SourceRow]),
      norm(r[ix.ParticipantType]),
      norm(r[ix.Assessment]),
      norm(r[ix.ThemeID]),
      norm(r[ix.IndicatorID])
    ].join('|'));

    if (ix.SourceRecordID !== undefined) {
      const id = norm(r[ix.SourceRecordID]);
      if (id) existingUUIDs.add(id);
    }
  });

  const indicators = ss.getSheetByName('APP_Indicators')
    .getDataRange().getValues();
  const mh = indicators[0].map(h => String(h).trim());
  const mi = {};
  mh.forEach((h, i) => mi[h] = i);

  const sources = [
    { name: 'Students Post Assessment', type: 'Student', mode: 'student' },
    { name: 'Teachers Assessment', type: 'Teacher', mode: 'teacher' }
  ];

  const report = {};

  sources.forEach(src => {
    const sh = ss.getSheetByName(src.name);
    const data = sh.getDataRange().getValues();
    const h = data[0].map(v => String(v).trim());
    const find = name => h.findIndex(x => norm(x) === norm(name));

    const uuidCol = find('_uuid');
    const phaseCol = find('Specify the phase');

    const maps = indicators.slice(1).filter(m =>
      norm(m[mi.ParticipantType]) === norm(src.type) &&
      norm(m[mi.SourceSheet]) === norm(src.name) &&
      ['Pre', 'Post'].includes(String(m[mi.Assessment]).trim())
    );

    const missing = new Map();

    data.slice(1).forEach((row, offset) => {
      const uuid = uuidCol >= 0 ? String(row[uuidCol] || '').trim() : '';
      if (!uuid) return;

      const phase = phaseCol >= 0 ? norm(row[phaseCol]) : '';

      maps.forEach(m => {
        const assessment = String(m[mi.Assessment]).trim();
        const theme = String(m[mi.ThemeID]).trim();
        const indicator = String(m[mi.IndicatorID]).trim();
        const col = Number(m[mi.SourceColumn]);

        if (!Number.isInteger(col) || col < 1) return;

        if (src.mode === 'student') {
          if (assessment === 'Pre' && phase !== 'pre-assessment') return;
          if (assessment === 'Post' && !phase.startsWith('post-assessment')) return;
          if (phase.includes('theme one') && theme !== 'T1') return;
          if (phase.includes('theme two') && theme !== 'T2') return;
          if (phase.includes('theme three') && !['T3', 'T4'].includes(theme)) return;
        }

        const score = row[col - 1];
        if (score === '' || score === null || score === undefined ||
            String(score).trim() === '') return;

        const key = [
          norm(src.name), String(offset + 2),
          norm(src.type), norm(assessment), norm(theme), norm(indicator)
        ].join('|');

        if (existingKeys.has(key)) return;

        const entryKey = uuid + '|' + assessment + '|' + theme;
        if (!missing.has(entryKey)) {
          missing.set(entryKey, {
            sourceRow: offset + 2,
            uuid: uuid,
            assessment: assessment,
            theme: theme,
            scoresMissingFromRecords: 0,
            uuidAlreadyUsedInRecords: existingUUIDs.has(norm(uuid))
          });
        }
        missing.get(entryKey).scoresMissingFromRecords++;
      });
    });

    report[src.name] = {
      potentialMissingGroups: missing.size,
      groups: Array.from(missing.values()).slice(0, 30)
    };
  });

  Logger.log(JSON.stringify({
    status: 'VERIFY ONLY — NO DATA WRITTEN',
    report
  }, null, 2));
}


function checkKoboUUIDMatches() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('APP_Records');
  const data = sh.getDataRange().getValues();
  const h = data[0].map(x => String(x).trim());

  const idCol = h.indexOf('SourceRecordID');
  const typeCol = h.indexOf('ParticipantType');
  const sourceCol = h.indexOf('SourceSheet');

  if (idCol < 0 || typeCol < 0 || sourceCol < 0) {
    throw new Error('Required APP_Records headers not found.');
  }

  const counts = {};
  data.slice(1).forEach(r => {
    const id = String(r[idCol] || '').trim();
    if (!id) return;

    const type = String(r[typeCol] || '').trim();
    const source = String(r[sourceCol] || '').trim();
    const key = type + ' | ' + source;

    counts[key] = (counts[key] || 0) + 1;
  });

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    recordsWithSourceRecordID: data.slice(1)
      .filter(r => String(r[idCol] || '').trim()).length,
    countsByParticipantAndSource: counts
  }, null, 2));
}


function inspectKoboSourceRecordIDs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('APP_Records');
  const data = sh.getDataRange().getValues();
  const headers = data[0].map(v => String(v).trim());

  const idCol = headers.indexOf('SourceRecordID');
  const typeCol = headers.indexOf('ParticipantType');
  const sourceCol = headers.indexOf('SourceSheet');

  if (idCol < 0) throw new Error('SourceRecordID column not found.');

  const samples = [];

  data.slice(1).forEach(row => {
    const id = String(row[idCol] || '').trim();
    if (!id || samples.length >= 20) return;

    samples.push({
      participantType: row[typeCol],
      sourceSheet: row[sourceCol],
      sourceRecordID: id
    });
  });

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    samples
  }, null, 2));
}


function verifyKoboScoresByUUID() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recData = ss.getSheetByName('APP_Records').getDataRange().getValues();
  const rh = recData[0].map(v => String(v).trim());
  const ri = {};
  rh.forEach((v, i) => ri[v] = i);

  const norm = v => String(v ?? '').trim().toLowerCase();
  const existing = new Set();

  recData.slice(1).forEach(r => {
    const uuid = norm(r[ri.SourceRecordID]);
    if (!uuid) return;

    existing.add([
      uuid,
      norm(r[ri.ParticipantType]),
      norm(r[ri.Assessment]),
      norm(r[ri.ThemeID]),
      norm(r[ri.IndicatorID])
    ].join('|'));
  });

  const indData = ss.getSheetByName('APP_Indicators').getDataRange().getValues();
  const ih = indData[0].map(v => String(v).trim());
  const ii = {};
  ih.forEach((v, i) => ii[v] = i);

  const sources = [
    { sheet: 'Students Post Assessment', type: 'Student', mode: 'student' },
    { sheet: 'Teachers Assessment', type: 'Teacher', mode: 'teacher' }
  ];

  const report = {};

  sources.forEach(src => {
    const sh = ss.getSheetByName(src.sheet);
    const data = sh.getDataRange().getValues();
    const h = data[0].map(v => String(v).trim());
    const col = name => h.findIndex(v => norm(v) === norm(name));
    const uuidCol = col('_uuid');
    const phaseCol = col('Specify the phase');

    const maps = indData.slice(1).filter(m =>
      norm(m[ii.ParticipantType]) === norm(src.type) &&
      norm(m[ii.SourceSheet]) === norm(src.sheet) &&
      ['pre', 'post'].includes(norm(m[ii.Assessment]))
    );

    let checked = 0, present = 0, missing = 0;
    const examples = [];

    data.slice(1).forEach((row, offset) => {
      const uuid = uuidCol >= 0 ? String(row[uuidCol] || '').trim() : '';
      if (!uuid) return;

      const phase = phaseCol >= 0 ? norm(row[phaseCol]) : '';

      maps.forEach(m => {
        const assessment = String(m[ii.Assessment]).trim();
        const theme = String(m[ii.ThemeID]).trim();
        const indicator = String(m[ii.IndicatorID]).trim();
        const sourceColumn = Number(m[ii.SourceColumn]);

        if (!Number.isInteger(sourceColumn) || sourceColumn < 1) return;

        if (src.mode === 'student') {
          if (assessment === 'Pre' && phase !== 'pre-assessment') return;
          if (assessment === 'Post' && !phase.startsWith('post-assessment')) return;
          if (phase.includes('theme one') && theme !== 'T1') return;
          if (phase.includes('theme two') && theme !== 'T2') return;
          if (phase.includes('theme three') && !['T3', 'T4'].includes(theme)) return;
        }

        const score = row[sourceColumn - 1];
        if (score === '' || score === null || score === undefined ||
            String(score).trim() === '') return;

        checked++;
        const key = [
          norm(uuid), norm(src.type), norm(assessment),
          norm(theme), norm(indicator)
        ].join('|');

        if (existing.has(key)) {
          present++;
        } else {
          missing++;
          if (examples.length < 10) {
            examples.push({
              sourceRow: offset + 2,
              uuid,
              assessment,
              theme,
              indicator,
              score
            });
          }
        }
      });
    });

    report[src.sheet] = { checked, present, missing, examples };
  });

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    matchingMethod: 'Kobo UUID + ParticipantType + Assessment + ThemeID + IndicatorID',
    report
  }, null, 2));
}


function checkKoboCandidateScores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordData = ss.getSheetByName('APP_Records').getDataRange().getValues();
  const rh = recordData[0].map(v => String(v).trim());
  const ri = {};
  rh.forEach((h, i) => ri[h] = i);

  const norm = v => String(v ?? '').trim().toLowerCase();
  const key = (uuid, type, assessment, theme, indicator, score) =>
    [uuid, type, assessment, theme, indicator, score].map(norm).join('|');

  const existingExact = new Set();
  const existingWithoutScore = new Set();

  recordData.slice(1).forEach(r => {
    const uuid = r[ri.SourceRecordID];
    if (!String(uuid ?? '').trim()) return;

    existingExact.add(key(
      uuid, r[ri.ParticipantType], r[ri.Assessment],
      r[ri.ThemeID], r[ri.IndicatorID], r[ri.Score]
    ));

    existingWithoutScore.add(key(
      uuid, r[ri.ParticipantType], r[ri.Assessment],
      r[ri.ThemeID], r[ri.IndicatorID], ''
    ));
  });

  const indicatorData = ss.getSheetByName('APP_Indicators').getDataRange().getValues();
  const ih = indicatorData[0].map(v => String(v).trim());
  const ii = {};
  ih.forEach((h, i) => ii[h] = i);

  const sources = [
    { sheet: 'Students Post Assessment', type: 'Student', student: true },
    { sheet: 'Teachers Assessment', type: 'Teacher', student: false }
  ];

  const report = {};

  sources.forEach(src => {
    const data = ss.getSheetByName(src.sheet).getDataRange().getValues();
    const h = data[0].map(v => String(v).trim());
    const col = name => h.findIndex(x => norm(x) === norm(name));
    const uuidCol = col('_uuid');
    const phaseCol = col('Specify the phase');

    const maps = indicatorData.slice(1).filter(m =>
      norm(m[ii.ParticipantType]) === norm(src.type) &&
      norm(m[ii.SourceSheet]) === norm(src.sheet) &&
      ['pre', 'post'].includes(norm(m[ii.Assessment]))
    );

    let exactMatches = 0, sameIndicatorDifferentScore = 0, absent = 0;
    const examples = [];

    data.slice(1).forEach((row, offset) => {
      const uuid = uuidCol >= 0 ? String(row[uuidCol] || '').trim() : '';
      if (!uuid) return;
      const phase = phaseCol >= 0 ? norm(row[phaseCol]) : '';

      maps.forEach(m => {
        const assessment = String(m[ii.Assessment]).trim();
        const theme = String(m[ii.ThemeID]).trim();
        const indicator = String(m[ii.IndicatorID]).trim();
        const sourceColumn = Number(m[ii.SourceColumn]);
        if (!Number.isInteger(sourceColumn) || sourceColumn < 1) return;

        if (src.student) {
          if (assessment === 'Pre' && phase !== 'pre-assessment') return;
          if (assessment === 'Post' && !phase.startsWith('post-assessment')) return;
          if (phase.includes('theme one') && theme !== 'T1') return;
          if (phase.includes('theme two') && theme !== 'T2') return;
          if (phase.includes('theme three') && !['T3', 'T4'].includes(theme)) return;
        }

        const score = row[sourceColumn - 1];
        if (score === '' || score === null || score === undefined ||
            String(score).trim() === '') return;

        const fullKey = key(uuid, src.type, assessment, theme, indicator, score);
        const indicatorKey = key(uuid, src.type, assessment, theme, indicator, '');

        if (existingExact.has(fullKey)) {
          exactMatches++;
        } else if (existingWithoutScore.has(indicatorKey)) {
          sameIndicatorDifferentScore++;
          if (examples.length < 10) {
            examples.push({
              sourceRow: offset + 2, uuid, assessment, theme, indicator,
              sourceScore: score, result: 'Indicator exists; score differs'
            });
          }
        } else {
          absent++;
          if (examples.length < 10) {
            examples.push({
              sourceRow: offset + 2, uuid, assessment, theme, indicator,
              sourceScore: score, result: 'No matching indicator record'
            });
          }
        }
      });
    });

    report[src.sheet] = {
      exactMatches,
      sameIndicatorDifferentScore,
      absent,
      examples
    };
  });

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    report
  }, null, 2));
}


function checkTeacherThemeCoverage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName('Teachers Assessment').getDataRange().getValues();
  const records = ss.getSheetByName('APP_Records').getDataRange().getValues();
  const indicators = ss.getSheetByName('APP_Indicators').getDataRange().getValues();

  const norm = v => String(v ?? '').trim().toLowerCase();
  const sh = source[0].map(v => String(v).trim());
  const rh = records[0].map(v => String(v).trim());
  const ih = indicators[0].map(v => String(v).trim());

  const si = {}, ri = {}, ii = {};
  sh.forEach((v, i) => si[v] = i);
  rh.forEach((v, i) => ri[v] = i);
  ih.forEach((v, i) => ii[v] = i);

  const summary = {};

  ['T1', 'T2', 'T3', 'T4'].forEach(theme => {
    summary[theme] = {
      sourcePre: 0,
      sourcePost: 0,
      recordsPre: 0,
      recordsPost: 0,
      mappedIndicator: ''
    };
  });

  indicators.slice(1).forEach(r => {
    if (norm(r[ii.ParticipantType]) !== 'teacher') return;
    const theme = String(r[ii.ThemeID] || '').trim();
    if (summary[theme]) summary[theme].mappedIndicator = r[ii.IndicatorID];
  });

  source.slice(1).forEach(r => {
    const uuid = String(r[si['_uuid']] || '').trim();
    if (!uuid) return;

    ['T1', 'T2', 'T3', 'T4'].forEach((theme, n) => {
      const preHeader = theme + ':Pre';
      const postHeader = theme + ':Post';
      const preCol = sh.findIndex(x => norm(x) === norm(preHeader));
      const postCol = sh.findIndex(x => norm(x) === norm(postHeader));

      // If named headers are unavailable, use the known mapped score columns.
      const scoreCols = {
        T1: [52, 53],
        T2: [54, 55],
        T3: [56, 57],
        T4: [58, 59]
      }[theme];

      const preValue = r[preCol >= 0 ? preCol : scoreCols[0] - 1];
      const postValue = r[postCol >= 0 ? postCol : scoreCols[1] - 1];

      if (preValue !== '' && preValue != null) summary[theme].sourcePre++;
      if (postValue !== '' && postValue != null) summary[theme].sourcePost++;
    });
  });

  records.slice(1).forEach(r => {
    if (norm(r[ri.ParticipantType]) !== 'teacher') return;
    const theme = String(r[ri.ThemeID] || '').trim();
    const assessment = norm(r[ri.Assessment]);
    if (!summary[theme]) return;
    if (assessment === 'pre') summary[theme].recordsPre++;
    if (assessment === 'post') summary[theme].recordsPost++;
  });

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    summary
  }, null, 2));
}


function previewMissingTeacherThemes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName('Teachers Assessment').getDataRange().getValues();
  const records = ss.getSheetByName('APP_Records').getDataRange().getValues();

  const norm = v => String(v ?? '').trim().toLowerCase();
  const sh = source[0].map(v => String(v).trim());
  const rh = records[0].map(v => String(v).trim());
  const si = {}, ri = {};
  sh.forEach((v, i) => si[v] = i);
  rh.forEach((v, i) => ri[v] = i);

  const existing = new Set();
  records.slice(1).forEach(r => {
    if (norm(r[ri.ParticipantType]) !== 'teacher') return;
    const uuid = norm(r[ri.SourceRecordID]);
    if (!uuid) return;
    existing.add([
      uuid, norm(r[ri.Assessment]), norm(r[ri.ThemeID])
    ].join('|'));
  });

  const output = [];
  const themeColumns = {
    T3: { pre: 56, post: 57 },
    T4: { pre: 58, post: 59 }
  };

  source.slice(1).forEach((r, offset) => {
    const uuid = String(r[si['_uuid']] || '').trim();
    if (!uuid) return;

    Object.keys(themeColumns).forEach(theme => {
      ['Pre', 'Post'].forEach(assessment => {
        const col = themeColumns[theme][assessment.toLowerCase()];
        const score = r[col - 1];
        if (score === '' || score == null) return;

        const key = [norm(uuid), norm(assessment), norm(theme)].join('|');
        if (existing.has(key)) return;

        output.push({
          sourceRow: offset + 2,
          uuid,
          theme,
          assessment,
          score,
          region: r[si['Select your region']],
          localBoard: r[si['Local Board (Standardized)']],
          rec: r[si['REC (Standardized)']]
        });
      });
    });
  });

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    missingCount: output.length,
    examples: output.slice(0, 20)
  }, null, 2));
}


function checkTeacherImportMapping() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const records = ss.getSheetByName('APP_Records');
  const indicators = ss.getSheetByName('APP_Indicators');

  const rh = records.getDataRange().getValues()[0]
    .map(v => String(v).trim());
  const mapData = indicators.getDataRange().getValues();
  const mh = mapData[0].map(v => String(v).trim());
  const mi = {};
  mh.forEach((v, i) => mi[v] = i);

  const required = [
    'RecordID', 'CycleID', 'Year', 'ParticipantType', 'Assessment',
    'Region', 'LocalBoard', 'REC', 'ParticipantCount', 'Phase',
    'ThemeID', 'DimensionID', 'IndicatorID', 'Score', 'MaxScore',
    'SourceSheet', 'SourceRow', 'SourceRecordID'
  ];

  const missingHeaders = required.filter(h => !rh.includes(h));

  const teacherMappings = mapData.slice(1)
    .filter(r =>
      String(r[mi.ParticipantType]).trim() === 'Teacher' &&
      ['T3', 'T4'].includes(String(r[mi.ThemeID]).trim())
    )
    .map(r => ({
      CycleID: r[mi.CycleID],
      ParticipantType: r[mi.ParticipantType],
      Assessment: r[mi.Assessment],
      ThemeID: r[mi.ThemeID],
      IndicatorID: r[mi.IndicatorID],
      MaxScore: r[mi.MaxScore],
      SourceSheet: r[mi.SourceSheet],
      SourceColumn: r[mi.SourceColumn]
    }));

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    recordHeadersComplete: missingHeaders.length === 0,
    missingHeaders,
    teacherMappings
  }, null, 2));
}


function importMissingTeacherThemes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName('Teachers Assessment');
  const records = ss.getSheetByName('APP_Records');
  const indicators = ss.getSheetByName('APP_Indicators');

  if (!source || !records || !indicators) {
    throw new Error('A required source or APP sheet was not found.');
  }

  const sourceData = source.getDataRange().getValues();
  const recordData = records.getDataRange().getValues();
  const indicatorData = indicators.getDataRange().getValues();

  const clean = v => String(v ?? '').trim();
  const norm = v => clean(v).toLowerCase();

  const sourceHeaders = sourceData[0].map(clean);
  const recordHeaders = recordData[0].map(clean);
  const indicatorHeaders = indicatorData[0].map(clean);

  const indexMap = headers => {
    const result = {};
    headers.forEach((h, i) => result[h] = i);
    return result;
  };

  const si = indexMap(sourceHeaders);
  const ri = indexMap(recordHeaders);
  const ii = indexMap(indicatorHeaders);

  const requiredSource = [
    '_uuid', 'Select your region',
    'Local Board (Standardized)', 'REC (Standardized)'
  ];
  requiredSource.forEach(h => {
    if (si[h] === undefined) {
      throw new Error('Source sheet is missing column: ' + h);
    }
  });

  const requiredRecord = [
    'RecordID', 'CycleID', 'Year', 'ParticipantType',
    'Assessment', 'Region', 'LocalBoard', 'REC',
    'ParticipantCount', 'Phase', 'ThemeID', 'DimensionID',
    'IndicatorID', 'Score', 'MaxScore', 'SourceSheet',
    'SourceRow', 'SourceRecordID'
  ];
  requiredRecord.forEach(h => {
    if (ri[h] === undefined) {
      throw new Error('APP_Records is missing column: ' + h);
    }
  });

  const mappings = {};
  indicatorData.slice(1).forEach(r => {
    if (
      norm(r[ii.ParticipantType]) !== 'teacher' ||
      !['T3', 'T4'].includes(clean(r[ii.ThemeID])) ||
      clean(r[ii.CycleID]) !== 'C1'
    ) return;

    const key = [
      clean(r[ii.Assessment]),
      clean(r[ii.ThemeID])
    ].join('|');

    mappings[key] = {
      ThemeID: clean(r[ii.ThemeID]),
      DimensionID: r[ii.DimensionID],
      IndicatorID: r[ii.IndicatorID],
      MaxScore: Number(r[ii.MaxScore]),
      SourceColumn: Number(r[ii.SourceColumn])
    };
  });

  const existing = new Set();
  recordData.slice(1).forEach(r => {
    if (norm(r[ri.ParticipantType]) !== 'teacher') return;

    const uuid = norm(r[ri.SourceRecordID]);
    if (!uuid) return;

    existing.add([
      uuid,
      norm(r[ri.Assessment]),
      norm(r[ri.ThemeID]),
      norm(r[ri.IndicatorID])
    ].join('|'));
  });

  const cycleId = 'C1';
  const year = Number(
    typeof surveyConfigValue_ === 'function'
      ? surveyConfigValue_('AssessmentYear', 2026)
      : 2026
  );

  const newRows = [];
  const alreadyPresent = new Set();
  const missingMappings = [];

  sourceData.slice(1).forEach((r, offset) => {
    const sourceRow = offset + 2;
    const uuid = clean(r[si['_uuid']]);
    if (!uuid) return;

    [
      { theme: 'T3', assessment: 'Pre' },
      { theme: 'T3', assessment: 'Post' },
      { theme: 'T4', assessment: 'Pre' },
      { theme: 'T4', assessment: 'Post' }
    ].forEach(item => {
      const key = item.assessment + '|' + item.theme;
      const mapping = mappings[key];

      if (!mapping) {
        missingMappings.push(key);
        return;
      }

      const score = r[mapping.SourceColumn - 1];
      if (score === '' || score == null) return;

      const dedupeKey = [
        norm(uuid), norm(item.assessment),
        norm(item.theme), norm(mapping.IndicatorID)
      ].join('|');

      if (existing.has(dedupeKey)) {
        alreadyPresent.add(dedupeKey);
        return;
      }

      const numericScore = Number(score);
      if (!Number.isFinite(numericScore)) return;

      const record = {
        RecordID:
          cycleId + '-T' + item.assessment.toUpperCase() +
          '-R' + sourceRow + '-' + item.theme,
        CycleID: cycleId,
        Year: year,
        ParticipantType: 'Teacher',
        Assessment: item.assessment,
        Region: clean(r[si['Select your region']]),
        LocalBoard: clean(r[si['Local Board (Standardized)']]),
        REC: clean(r[si['REC (Standardized)']]),
        ParticipantCount: 1,
        Phase: item.assessment === 'Pre'
          ? 'Pre-assessment'
          : 'Post-assessment',
        ThemeID: mapping.ThemeID,
        DimensionID: mapping.DimensionID,
        IndicatorID: mapping.IndicatorID,
        Score: numericScore,
        MaxScore: mapping.MaxScore,
        SourceSheet: source.getName(),
        SourceRow: sourceRow,
        SourceRecordID: uuid
      };

      newRows.push(
        recordHeaders.map(h =>
          Object.prototype.hasOwnProperty.call(record, h)
            ? record[h]
            : ''
        )
      );

      // Prevent duplicates within this same run.
      existing.add(dedupeKey);
    });
  });

  if (missingMappings.length) {
    throw new Error(
      'Import stopped: missing mappings: ' +
      [...new Set(missingMappings)].join(', ')
    );
  }

  if (newRows.length) {
    records.getRange(
      records.getLastRow() + 1,
      1,
      newRows.length,
      recordHeaders.length
    ).setValues(newRows);
  }

  Logger.log(JSON.stringify({
    status: 'IMPORT COMPLETED',
    rowsAdded: newRows.length,
    existingEntriesSkipped: alreadyPresent.size,
    finalAPPRecordsRows: records.getLastRow() - 1
  }, null, 2));
}


function inspectStudentTheme2Mapping() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Indicators');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(v => String(v).trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  const mappings = data.slice(1)
    .filter(r =>
      String(r[idx.ParticipantType]).trim() === 'Student' &&
      String(r[idx.Assessment]).trim() === 'Post' &&
      String(r[idx.ThemeID]).trim() === 'T2'
    )
    .map(r => ({
      CycleID: r[idx.CycleID],
      ThemeID: r[idx.ThemeID],
      IndicatorID: r[idx.IndicatorID],
      MaxScore: r[idx.MaxScore],
      SourceSheet: r[idx.SourceSheet],
      SourceColumn: r[idx.SourceColumn]
    }));

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    studentTheme2PostMappings: mappings
  }, null, 2));
}


function importMissingStudentTheme2Post() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName('Students Post Assessment');
  const records = ss.getSheetByName('APP_Records');
  const indicators = ss.getSheetByName('APP_Indicators');

  if (!source || !records || !indicators) {
    throw new Error('A required source or APP sheet was not found.');
  }

  const sourceData = source.getDataRange().getValues();
  const recordData = records.getDataRange().getValues();
  const indicatorData = indicators.getDataRange().getValues();

  const clean = v => String(v ?? '').trim();
  const norm = v => clean(v).toLowerCase();
  const indexMap = headers => {
    const out = {};
    headers.forEach((h, i) => out[clean(h)] = i);
    return out;
  };

  const si = indexMap(sourceData[0]);
  const ri = indexMap(recordData[0]);
  const ii = indexMap(indicatorData[0]);

  const requiredRecordHeaders = [
    'RecordID', 'CycleID', 'Year', 'ParticipantType',
    'Assessment', 'Region', 'LocalBoard', 'REC',
    'ParticipantCount', 'Phase', 'ThemeID', 'DimensionID',
    'IndicatorID', 'Score', 'MaxScore', 'SourceSheet',
    'SourceRow', 'SourceRecordID'
  ];

  requiredRecordHeaders.forEach(h => {
    if (ri[h] === undefined) {
      throw new Error('APP_Records is missing column: ' + h);
    }
  });

  [
    '_uuid', '1. Select your region',
    'Local Board (Standardized)', 'REC (Standardized)'
  ].forEach(h => {
    if (si[h] === undefined) {
      throw new Error('Source sheet is missing column: ' + h);
    }
  });

  const mappings = {};
  indicatorData.slice(1).forEach(r => {
    if (
      clean(r[ii.CycleID]) !== 'C1' ||
      norm(r[ii.ParticipantType]) !== 'student' ||
      norm(r[ii.Assessment]) !== 'post' ||
      clean(r[ii.ThemeID]) !== 'T2' ||
      norm(r[ii.SourceSheet]) !== norm(source.getName())
    ) return;

    const indicator = clean(r[ii.IndicatorID]);
    const column = Number(r[ii.SourceColumn]);

    if (indicator && column > 0) {
      mappings[indicator] = {
        ThemeID: clean(r[ii.ThemeID]),
        DimensionID: r[ii.DimensionID],
        IndicatorID: indicator,
        MaxScore: Number(r[ii.MaxScore]),
        SourceColumn: column
      };
    }
  });

  if (!Object.keys(mappings).length) {
    throw new Error('No matching Student Post T2 indicator mappings found.');
  }

  Object.values(mappings).forEach(m => {
    if (m.SourceColumn > sourceData[0].length) {
      throw new Error(
        'Mapped column exceeds source width: ' + m.IndicatorID
      );
    }
  });

  const existing = new Set();
  recordData.slice(1).forEach(r => {
    if (
      norm(r[ri.CycleID]) !== 'c1' ||
      norm(r[ri.ParticipantType]) !== 'student'
    ) return;

    const uuid = norm(r[ri.SourceRecordID]);
    if (!uuid) return;

    existing.add([
      uuid,
      norm(r[ri.Assessment]),
      norm(r[ri.ThemeID]),
      norm(r[ri.IndicatorID])
    ].join('|'));
  });

  const year = Number(
    typeof surveyConfigValue_ === 'function'
      ? surveyConfigValue_('AssessmentYear', 2026)
      : 2026
  );

  const newRows = [];
  let skippedExisting = 0;
  let skippedBlank = 0;

  sourceData.slice(1).forEach((r, offset) => {
    const sourceRow = offset + 2;
    const uuid = clean(r[si['_uuid']]);
    if (!uuid) return;

    Object.values(mappings).forEach(m => {
      const score = r[m.SourceColumn - 1];

      if (score === '' || score == null) {
        skippedBlank++;
        return;
      }

      const numericScore = Number(score);
      if (!Number.isFinite(numericScore)) return;

      const key = [
        norm(uuid), 'post', 't2', norm(m.IndicatorID)
      ].join('|');

      if (existing.has(key)) {
        skippedExisting++;
        return;
      }

      const record = {
        RecordID:
          'C1-SPOST-R' + sourceRow + '-' + m.IndicatorID,
        CycleID: 'C1',
        Year: year,
        ParticipantType: 'Student',
        Assessment: 'Post',
        Region: clean(r[si['1. Select your region']]),
        LocalBoard: clean(r[si['Local Board (Standardized)']]),
        REC: clean(r[si['REC (Standardized)']]),
        ParticipantCount: 1,
        Phase: 'Post-assessment',
        ThemeID: m.ThemeID,
        DimensionID: m.DimensionID,
        IndicatorID: m.IndicatorID,
        Score: numericScore,
        MaxScore: m.MaxScore,
        SourceSheet: source.getName(),
        SourceRow: sourceRow,
        SourceRecordID: uuid
      };

      newRows.push(
        recordData[0].map(h =>
          Object.prototype.hasOwnProperty.call(record, clean(h))
            ? record[clean(h)]
            : ''
        )
      );

      // Prevent duplicates during this run as well.
      existing.add(key);
    });
  });

  if (newRows.length) {
    records.getRange(
      records.getLastRow() + 1,
      1,
      newRows.length,
      recordData[0].length
    ).setValues(newRows);
  }

  Logger.log(JSON.stringify({
    status: 'IMPORT COMPLETED',
    rowsAdded: newRows.length,
    existingEntriesSkipped: skippedExisting,
    blankScoresSkipped: skippedBlank,
    finalAPPRecordsRows: records.getLastRow() - 1
  }, null, 2));
}


function inspectStudentTheme4PostMapping() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Indicators');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(v => String(v).trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  const mappings = data.slice(1)
    .filter(r =>
      String(r[idx.CycleID]).trim() === 'C1' &&
      String(r[idx.ParticipantType]).trim() === 'Student' &&
      String(r[idx.Assessment]).trim() === 'Post' &&
      String(r[idx.ThemeID]).trim() === 'T4'
    )
    .map(r => ({
      CycleID: r[idx.CycleID],
      ThemeID: r[idx.ThemeID],
      IndicatorID: r[idx.IndicatorID],
      MaxScore: r[idx.MaxScore],
      SourceSheet: r[idx.SourceSheet],
      SourceColumn: r[idx.SourceColumn]
    }));

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    studentTheme4PostMappings: mappings
  }, null, 2));
}


function importMissingStudentTheme4Post() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName('Students Post Assessment');
  const records = ss.getSheetByName('APP_Records');
  const indicators = ss.getSheetByName('APP_Indicators');

  if (!source || !records || !indicators) {
    throw new Error('A required source or APP sheet was not found.');
  }

  const sourceData = source.getDataRange().getValues();
  const recordData = records.getDataRange().getValues();
  const indicatorData = indicators.getDataRange().getValues();

  const clean = v => String(v ?? '').trim();
  const norm = v => clean(v).toLowerCase();
  const indexes = headers => {
    const out = {};
    headers.forEach((h, i) => out[clean(h)] = i);
    return out;
  };

  const si = indexes(sourceData[0]);
  const ri = indexes(recordData[0]);
  const ii = indexes(indicatorData[0]);

  const mappings = {};
  indicatorData.slice(1).forEach(r => {
    if (
      clean(r[ii.CycleID]) !== 'C1' ||
      norm(r[ii.ParticipantType]) !== 'student' ||
      norm(r[ii.Assessment]) !== 'post' ||
      clean(r[ii.ThemeID]) !== 'T4' ||
      norm(r[ii.SourceSheet]) !== norm(source.getName())
    ) return;

    const indicator = clean(r[ii.IndicatorID]);
    const col = Number(r[ii.SourceColumn]);

    if (indicator && col > 0 && col <= sourceData[0].length) {
      mappings[indicator] = {
        ThemeID: clean(r[ii.ThemeID]),
        DimensionID: r[ii.DimensionID],
        IndicatorID: indicator,
        MaxScore: Number(r[ii.MaxScore]),
        SourceColumn: col
      };
    }
  });

  if (Object.keys(mappings).length !== 8) {
    throw new Error(
      'Expected 8 Theme 4 mappings, found ' +
      Object.keys(mappings).length + '. No records written.'
    );
  }

  const existing = new Set();
  recordData.slice(1).forEach(r => {
    if (
      norm(r[ri.CycleID]) !== 'c1' ||
      norm(r[ri.ParticipantType]) !== 'student'
    ) return;

    const uuid = norm(r[ri.SourceRecordID]);
    if (!uuid) return;

    existing.add([
      uuid,
      norm(r[ri.Assessment]),
      norm(r[ri.ThemeID]),
      norm(r[ri.IndicatorID])
    ].join('|'));
  });

  const year = Number(
    typeof surveyConfigValue_ === 'function'
      ? surveyConfigValue_('AssessmentYear', 2026)
      : 2026
  );

  const newRows = [];
  let skippedExisting = 0;

  sourceData.slice(1).forEach((r, offset) => {
    const uuid = clean(r[si['_uuid']]);
    if (!uuid) return;

    Object.values(mappings).forEach(m => {
      const score = r[m.SourceColumn - 1];
      if (score === '' || score == null) return;

      const numericScore = Number(score);
      if (!Number.isFinite(numericScore)) return;

      const key = [
        norm(uuid), 'post', 't4', norm(m.IndicatorID)
      ].join('|');

      if (existing.has(key)) {
        skippedExisting++;
        return;
      }

      const record = {
        RecordID:
          'C1-SPOST-R' + (offset + 2) + '-' + m.IndicatorID,
        CycleID: 'C1',
        Year: year,
        ParticipantType: 'Student',
        Assessment: 'Post',
        Region: clean(r[si['1. Select your region']]),
        LocalBoard: clean(r[si['Local Board (Standardized)']]),
        REC: clean(r[si['REC (Standardized)']]),
        ParticipantCount: 1,
        Phase: 'Post-assessment',
        ThemeID: m.ThemeID,
        DimensionID: m.DimensionID,
        IndicatorID: m.IndicatorID,
        Score: numericScore,
        MaxScore: m.MaxScore,
        SourceSheet: source.getName(),
        SourceRow: offset + 2,
        SourceRecordID: uuid
      };

      newRows.push(
        recordData[0].map(h =>
          Object.prototype.hasOwnProperty.call(record, clean(h))
            ? record[clean(h)]
            : ''
        )
      );

      existing.add(key);
    });
  });

  if (newRows.length) {
    records.getRange(
      records.getLastRow() + 1,
      1,
      newRows.length,
      recordData[0].length
    ).setValues(newRows);
  }

  Logger.log(JSON.stringify({
    status: 'IMPORT COMPLETED',
    rowsAdded: newRows.length,
    existingEntriesSkipped: skippedExisting,
    finalAPPRecordsRows: records.getLastRow() - 1
  }, null, 2));
}


function inspectKoboSyncColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = [
    'Students Post Assessment',
    'Teachers Assessment'
  ];

  const report = {};

  sheetNames.forEach(name => {
    const sh = ss.getSheetByName(name);

    if (!sh) {
      report[name] = { error: 'Sheet not found' };
      return;
    }

    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    const uuidIndex = headers.findIndex(
      h => String(h).trim().toLowerCase() === '_uuid'
    );

    const lastRow = sh.getLastRow();
    const sample = [];

    if (lastRow >= 2) {
      const startRow = Math.max(2, lastRow - 2);
      const count = lastRow - startRow + 1;

      for (let r = startRow; r <= lastRow; r++) {
        sample.push({
          row: r,
          uuid: uuidIndex >= 0
            ? sh.getRange(r, uuidIndex + 1).getDisplayValue()
            : 'UUID column not found'
        });
      }
    }

    report[name] = {
      lastRow: lastRow,
      lastColumn: lastCol,
      uuidColumn: uuidIndex >= 0 ? uuidIndex + 1 : null,
      uuidHeader: uuidIndex >= 0 ? headers[uuidIndex] : null,
      latestRows: sample
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
}


function inspectLatestValidKoboRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = [
    'Students Post Assessment',
    'Teachers Assessment'
  ];
  const report = {};

  sheetNames.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) {
      report[name] = { error: 'Sheet not found' };
      return;
    }

    const data = sh.getDataRange().getDisplayValues();
    const headers = data[0].map(h => String(h).trim());
    const uuidCol = headers.findIndex(
      h => h.replace(/^\\/, '').toLowerCase() === '_uuid'
    );

    if (uuidCol < 0) {
      report[name] = { error: 'UUID column not found' };
      return;
    }

    const validRows = [];

    for (let i = data.length - 1; i >= 1 && validRows.length < 3; i--) {
      const uuid = String(data[i][uuidCol] || '').trim();
      if (!uuid) continue;

      const phaseIndex = headers.findIndex(
        h => h.toLowerCase() === 'specify the phase'
      );

      validRows.push({
        row: i + 1,
        uuid: uuid,
        phase: phaseIndex >= 0 ? data[i][phaseIndex] : '(not applicable)'
      });
    }

    report[name] = { latestValidRows: validRows };
  });

  Logger.log(JSON.stringify(report, null, 2));
}


function inspectKoboSyncMappings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('APP_Indicators');

  if (!sh) throw new Error('APP_Indicators sheet not found.');

  const data = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const required = [
    'CycleID', 'ParticipantType', 'Assessment',
    'ThemeID', 'IndicatorID', 'MaxScore',
    'SourceSheet', 'SourceColumn'
  ];

  required.forEach(h => {
    if (col[h] === undefined) {
      throw new Error('APP_Indicators missing column: ' + h);
    }
  });

  const mappings = data.slice(1)
    .filter(r =>
      ['Student', 'Teacher'].includes(String(r[col.ParticipantType]).trim()) &&
      ['Pre', 'Post'].includes(String(r[col.Assessment]).trim())
    )
    .map(r => ({
      cycle: r[col.CycleID],
      participant: r[col.ParticipantType],
      assessment: r[col.Assessment],
      theme: r[col.ThemeID],
      indicator: r[col.IndicatorID],
      maxScore: r[col.MaxScore],
      sourceSheet: r[col.SourceSheet],
      sourceColumn: r[col.SourceColumn]
    }));

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    mappingCount: mappings.length,
    mappings: mappings
  }, null, 2));
}


function inspectStudentPreSyncReadiness() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Students Pre Assessment');
  const records = ss.getSheetByName('APP_Records');

  if (!sh || !records) {
    throw new Error('Students Pre Assessment or APP_Records not found.');
  }

  const data = sh.getDataRange().getDisplayValues();
  const headers = data[0].map(h => String(h).trim());
  const uuidCol = headers.findIndex(
    h => h.replace(/^\\/, '').toLowerCase() === '_uuid'
  );

  let nonblankUUIDs = 0;
  let blankUUIDRows = 0;

  if (uuidCol >= 0) {
    data.slice(1).forEach(row => {
      if (String(row[uuidCol] || '').trim()) nonblankUUIDs++;
      else blankUUIDRows++;
    });
  }

  const recordData = records.getDataRange().getValues();
  const rh = recordData[0].map(h => String(h).trim());

  Logger.log(JSON.stringify({
    status: 'READ ONLY — NO DATA WRITTEN',
    studentPreLastRow: sh.getLastRow(),
    uuidColumnFound: uuidCol >= 0,
    uuidColumnNumber: uuidCol >= 0 ? uuidCol + 1 : null,
    rowsWithUUID: nonblankUUIDs,
    rowsWithoutUUID: uuidCol >= 0 ? blankUUIDRows : null,
    recordsRows: recordData.length - 1,
    recordsHasSourceRecordID: rh.includes('SourceRecordID'),
    recordsHasSourceSheet: rh.includes('SourceSheet')
  }, null, 2));
}


function populateNamesInAPPRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const records = ss.getSheetByName('APP_Records');

  if (!records) throw new Error('APP_Records not found.');

  const data = records.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const required = [
    'ParticipantType', 'SourceSheet', 'SourceRow',
    'ChildName', 'TeacherName'
  ];
  required.forEach(h => {
    if (col[h] === undefined) throw new Error('Missing column: ' + h);
  });

  const sources = {
    'students pre assessment': 'Student',
    'students post assessment': 'Student',
    'teachers assessment': 'Teacher'
  };

  const sourceCache = {};
  Object.keys(sources).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    const rows = sh.getDataRange().getValues();
    const hs = rows[0].map(h => String(h).trim());
    sourceCache[name] = { rows, headers: hs };
  });

  const findCol = (headers, candidates) => {
    for (const candidate of candidates) {
      const idx = headers.findIndex(
        h => h.toLowerCase() === candidate.toLowerCase()
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const updates = [];
  let namesFilled = 0;
  let sourceRowsMissing = 0;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const sourceName = String(r[col.SourceSheet] || '').trim().toLowerCase();
    const participant = String(r[col.ParticipantType] || '').trim().toLowerCase();
    const sourceRow = Number(r[col.SourceRow]);

    if (!sources[sourceName] || !sourceCache[sourceName] ||
        !Number.isInteger(sourceRow) || sourceRow < 2) continue;

    const source = sourceCache[sourceName];
    if (sourceRow > source.rows.length) {
      sourceRowsMissing++;
      continue;
    }

    const sourceHeaders = source.headers;
    const sourceData = source.rows[sourceRow - 1];

    if (participant === 'student') {
      const nameCol = findCol(sourceHeaders, [
        'Name of a child:', 'Name of child', 'ChildName', 'Child Name'
      ]);
      if (nameCol < 0) continue;

      const name = String(sourceData[nameCol] || '').trim();
      if (name && !String(r[col.ChildName] || '').trim()) {
        updates.push({ row: i + 1, col: col.ChildName + 1, value: name });
        namesFilled++;
      }
    } else if (participant === 'teacher') {
      const nameCol = findCol(sourceHeaders, [
        'Name of participant', 'TeacherName', 'Teacher Name'
      ]);
      if (nameCol < 0) continue;

      const name = String(sourceData[nameCol] || '').trim();
      if (name && !String(r[col.TeacherName] || '').trim()) {
        updates.push({ row: i + 1, col: col.TeacherName + 1, value: name });
        namesFilled++;
      }
    }
  }

  // Write only to the two newly added name columns.
  updates.forEach(u => records.getRange(u.row, u.col).setValue(u.value));

  Logger.log(JSON.stringify({
    status: 'NAME POPULATION COMPLETED',
    nameCellsFilled: namesFilled,
    sourceRowsMissing: sourceRowsMissing,
    recordsRows: data.length - 1
  }, null, 2));
}


function appendAPPRecordLookupMatches_(
  matches,
  participantType,
  name,
  region,
  localBoard,
  rec
) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Records');
  if (!sheet) throw new Error('APP_Records sheet not found.');

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const required = [
    'ParticipantType', 'Region', 'LocalBoard', 'REC',
    'Assessment', 'ThemeID', 'IndicatorID', 'Score',
    'SourceRow', 'SourceRecordID', 'ChildName', 'TeacherName'
  ];

  required.forEach(h => {
    if (col[h] === undefined) {
      throw new Error('APP_Records missing column: ' + h);
    }
  });

  const norm = v => String(v ?? '').trim().toLowerCase();
  const same = (a, b) => norm(a) === norm(b);

  const isStudent = norm(participantType) === 'student';
  const nameColumn = isStudent ? col.ChildName : col.TeacherName;

  const themeNames = {
    T1: 'Authority and Leadership',
    T2: 'Ismaili Muslim Traditions',
    T3: 'Role in Family, Community and Society',
    T4: 'Two Aspects of Life'
  };

  // Avoid showing records already returned from the app survey sheets.
  const existingSubmissionIds = new Set(
    matches.map(m => norm(m.submissionId)).filter(Boolean)
  );

  Logger.log('LOOKUP INPUT: ' + JSON.stringify({
  participantType: participantType,
  name: name,
  region: region,
  localBoard: localBoard,
  rec: rec
}));
Logger.log('APP_Records headers: ' + JSON.stringify(headers));

  const groups = new Map();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    if (!same(row[col.ParticipantType], isStudent ? 'Student' : 'Teacher')) continue;
    if (same(row[nameColumn], name)) {
  Logger.log('NAME MATCH: ' + JSON.stringify({
    row: i + 1,
    participantType: row[col.ParticipantType],
    region: row[col.Region],
    localBoard: row[col.LocalBoard],
    rec: row[col.REC]
  }));
}
    if (!same(row[nameColumn], name)) continue;
    if (!same(row[col.Region], region)) continue;
    if (!same(row[col.LocalBoard], localBoard)) continue;
    if (!same(row[col.REC], rec)) continue;

    const assessment = String(row[col.Assessment] || '').trim();
    const theme = String(row[col.ThemeID] || '').trim();
    const indicator = String(row[col.IndicatorID] || '').trim();
    const sourceRecordId = String(row[col.SourceRecordID] || '').trim();
    const sourceRow = String(row[col.SourceRow] || '').trim();

    if (!assessment || !theme || !indicator) continue;

    // If this submission is already available from the app survey sheet,
    // do not add a duplicate historical result.
    if (sourceRecordId && existingSubmissionIds.has(norm(sourceRecordId))) {
      continue;
    }

    const identity = sourceRecordId || ('row-' + sourceRow);
    const key = [
      identity, assessment, theme
    ].join('|');

    if (!groups.has(key)) {
      groups.set(key, {
        submissionId: sourceRecordId ||
          ('historical-' + sourceRow + '-' + assessment + '-' + theme),
        name: String(row[nameColumn] || '').trim(),
        region: String(row[col.Region] || '').trim(),
        localBoard: String(row[col.LocalBoard] || '').trim(),
        rec: String(row[col.REC] || '').trim(),
        themeName: themeNames[theme] || theme,
        assessment: assessment,
        submittedAt: '',
        ratings: {},
        preRating: '',
        postRating: '',
        childGender: '',
        assessorDesignation: '',
        otherDesignation: '',
        teacherPosition: '',
        otherPosition: '',
        yearsTeaching: '',
        trainingAttended: '',
        otherTraining: '',
        assessmentContext: ''
      });
    }

    const item = groups.get(key);
    const score = row[col.Score];

    if (isStudent) {
      if (score !== '' && score !== null && score !== undefined) {
        item.ratings[indicator] = score;
      }
    } else {
      if (score !== '' && score !== null && score !== undefined) {
        if (same(assessment, 'Pre')) item.preRating = score;
        if (same(assessment, 'Post')) item.postRating = score;
      }
    }
  }

  groups.forEach(item => matches.push(item));
}


function diagnoseAPPRecordName() {
  const searchName = 'Abdullah';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('APP_Records');

  if (!sheet) throw new Error('APP_Records sheet not found.');

  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0].map(h => h.trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const required = [
    'ParticipantType', 'ChildName', 'TeacherName',
    'Region', 'LocalBoard', 'REC', 'Assessment', 'ThemeID'
  ];

  const missing = required.filter(h => col[h] === undefined);

  if (missing.length) {
    Logger.log('MISSING COLUMNS: ' + missing.join(', '));
    return;
  }

  const norm = v => String(v || '').trim().toLowerCase();
  const matches = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    if (norm(row[col.ChildName]) === norm(searchName)) {
      matches.push({
        row: i + 1,
        participantType: row[col.ParticipantType],
        childName: row[col.ChildName],
        region: row[col.Region],
        localBoard: row[col.LocalBoard],
        rec: row[col.REC],
        assessment: row[col.Assessment],
        theme: row[col.ThemeID]
      });
    }
  }

  Logger.log('EXACT NAME MATCH COUNT: ' + matches.length);
  Logger.log(JSON.stringify(matches.slice(0, 10), null, 2));
}

function inspectKoboSyncMappingsCompact() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('APP_Indicators');

  if (!sh) throw new Error('APP_Indicators sheet not found.');

  const data = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const groups = {};

  data.slice(1).forEach(r => {
    const participant = String(r[col.ParticipantType] || '').trim();
    const assessment = String(r[col.Assessment] || '').trim();
    const sourceSheet = String(r[col.SourceSheet] || '').trim();
    const indicator = String(r[col.IndicatorID] || '').trim();
    const sourceColumn = Number(r[col.SourceColumn]);

    const key = [sourceSheet, participant, assessment].join(' | ');

    if (!groups[key]) groups[key] = [];
    groups[key].push(indicator + ':' + sourceColumn);
  });

  Object.keys(groups).sort().forEach(key => {
    Logger.log(key + '\n' + groups[key].join(', '));
  });
}


/**
 * Imports Kobo assessment scores into APP_Records.
 * Append-only: never clears or rewrites existing records.
 * Reads indicator and source-column mappings from APP_Indicators.
 */
function syncKoboToAPPRecords() {
  const syncLock = LockService.getScriptLock();
  if (!syncLock.tryLock(1000)) {
    Logger.log('Kobo sync skipped: another sync is already running.');
    return { status: 'Skipped — another sync is running', totalRowsAppended: 0 };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordsSheet = ss.getSheetByName('APP_Records');
  const mappingSheet = ss.getSheetByName('APP_Indicators');

  if (!recordsSheet) throw new Error('APP_Records sheet not found.');
  if (!mappingSheet) throw new Error('APP_Indicators sheet not found.');

  const norm = v => String(v == null ? '' : v)
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase();

  const clean = v => String(v == null ? '' : v)
    .replace(/\u00a0/g, ' ')
    .trim();

  const colMap = headers => {
    const out = {};
    headers.forEach((h, i) => out[clean(h)] = i);
    return out;
  };

  const mappingData = mappingSheet.getDataRange().getValues();
  if (mappingData.length < 2) {
    throw new Error('APP_Indicators has no mappings.');
  }

  const mh = mappingData[0].map(clean);
  const mc = colMap(mh);

  [
    'CycleID', 'ParticipantType', 'Assessment', 'ThemeID',
    'IndicatorID', 'MaxScore', 'SourceSheet', 'SourceColumn'
  ].forEach(h => {
    if (mc[h] === undefined) {
      throw new Error('APP_Indicators missing column: ' + h);
    }
  });

  const mappings = mappingData.slice(1)
    .map(r => ({
      cycle: clean(r[mc.CycleID]),
      participant: clean(r[mc.ParticipantType]),
      assessment: clean(r[mc.Assessment]),
      theme: clean(r[mc.ThemeID]),
      dimension: mc.DimensionID === undefined ? '' : clean(r[mc.DimensionID]),
      indicator: clean(r[mc.IndicatorID]),
      maxScore: Number(r[mc.MaxScore]),
      sourceSheet: clean(r[mc.SourceSheet]),
      sourceColumn: Number(r[mc.SourceColumn])
    }))
    .filter(m =>
      ['Student', 'Teacher'].includes(m.participant) &&
      ['Pre', 'Post', 'Post 2', 'Post2', 'Skill Pre', 'Skill Post'].includes(m.assessment) &&
      m.theme && m.indicator &&
      m.sourceSheet && m.sourceColumn > 0
    );

  if (!mappings.length) throw new Error('No usable indicator mappings found.');

  // Process only rows added since the last successful sync for each Kobo source tab.
  // A missing watermark triggers one safe full-history catch-up pass.
  const scriptProperties = PropertiesService.getScriptProperties();
  const sourceNames = [...new Set(mappings.map(m => norm(m.sourceSheet)))];
  const watermarkKey = sourceName => 'KOBO_SYNC_LAST_ROW_' + sourceName;
  const needsInitialDedupe = sourceNames.some(
    sourceName => scriptProperties.getProperty(watermarkKey(sourceName)) === null
  );
  const sourceLastRows = {};

  const recordsLastRow = recordsSheet.getLastRow();
  const recordsLastColumn = recordsSheet.getLastColumn();
  if (!recordsLastColumn) throw new Error('APP_Records has no header row.');
  const recordHeaders = recordsSheet.getRange(1, 1, 1, recordsLastColumn).getValues()[0];
  const recordData = needsInitialDedupe && recordsLastRow > 1
    ? recordsSheet.getRange(1, 1, recordsLastRow, recordsLastColumn).getValues()
    : [recordHeaders];
  const rh = recordData[0].map(clean);
  const rc = colMap(rh);

  const required = [
    'RecordID', 'CycleID', 'Year', 'ParticipantType', 'Assessment',
    'Region', 'LocalBoard', 'REC', 'ParticipantCount', 'Phase',
    'ThemeID', 'DimensionID', 'IndicatorID', 'Score', 'MaxScore',
    'SourceSheet', 'SourceRow', 'SourceRecordID'
  ];

  required.forEach(h => {
    if (rc[h] === undefined) {
      throw new Error('APP_Records missing column: ' + h);
    }
  });

  const configSheet = ss.getSheetByName('APP_Config');
  let cycleDefault = 'C1';
  let yearDefault = 2026;

  if (configSheet && configSheet.getLastRow() > 1) {
    const cfg = configSheet.getDataRange().getValues();
    cfg.slice(1).forEach(r => {
      if (clean(r[0]) === 'CycleID') cycleDefault = clean(r[1]) || cycleDefault;
      if (clean(r[0]) === 'AssessmentYear') yearDefault = Number(r[1]) || yearDefault;
    });
  }

  // Existing record signatures: submission + stage + indicator.
  // Also retain the source-row signature to protect previously imported rows.
  const existingSubmissionKeys = new Set();
  const existingRowKeys = new Set();

  recordData.slice(1).forEach(r => {
    const sourceSheet = norm(r[rc.SourceSheet]);
    const sourceRow = clean(r[rc.SourceRow]);
    const sourceId = norm(r[rc.SourceRecordID]);
    const assessment = norm(r[rc.Assessment]);
    const indicator = norm(r[rc.IndicatorID]);

    if (sourceId && assessment && indicator) {
      existingSubmissionKeys.add(
        [sourceId, assessment, indicator].join('|')
      );
    }

    if (sourceSheet && sourceRow && assessment && indicator) {
      existingRowKeys.add(
        [sourceSheet, sourceRow, assessment, indicator].join('|')
      );
    }
  });

  const sheetsByName = {};
  ss.getSheets().forEach(sh => {
    sheetsByName[norm(sh.getName())] = sh;
  });

  // Resolve Kobo Region values against the master REC phase list.
  const directorySheet = ss.getSheetByName('RECs_list_Phase_Wise');
  if (!directorySheet) throw new Error('RECs_list_Phase_Wise sheet not found.');
  const directoryValues = directorySheet.getDataRange().getValues();
  if (directoryValues.length < 2) throw new Error('RECs_list_Phase_Wise has no REC rows.');
  const directoryHeaders = directoryValues[0].map(clean);
  const directoryRegionCol = directoryHeaders.indexOf('Region');
  if (directoryRegionCol < 0) throw new Error('RECs_list_Phase_Wise is missing the Region column.');
  const directoryRegions = [...new Set(directoryValues.slice(1)
    .map(row => clean(row[directoryRegionCol]))
    .filter(Boolean))];

  function resolveLocation(value) {
    const v = clean(value);
    if (!v) return '';
    const displayValue = v.replace(/_\d+$/, '');
    const match = directoryRegions.find(region =>
      norm(region) === norm(v) ||
      norm(region.replace(/_\d+$/, '')) === norm(displayValue)
    );
    return (match || displayValue).replace(/_\d+$/, '');
  }

  function valueByHeader(row, headers, candidates) {
    for (const candidate of candidates) {
      const i = headers.findIndex(h => norm(h) === norm(candidate));
      if (i >= 0 && clean(row[i])) return row[i];
    }
    return '';
  }

  function stableFallbackId(row, headers, name, region, board, rec) {
    const start = valueByHeader(row, headers, ['start']);
    const end = valueByHeader(row, headers, ['end']);
    const parts = [
      start, end, name, region, board, rec
    ].map(clean);

    const raw = parts.join('|');
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      raw,
      Utilities.Charset.UTF_8
    );

    return 'KOBO-' + digest.map(b =>
      ('0' + ((b + 256) % 256).toString(16)).slice(-2)
    ).join('').substring(0, 24);
  }

  const newRows = [];
  let sourceRowsRead = 0;
  let sourceRowsSkipped = 0;
  let indicatorsAdded = 0;
  let duplicateIndicatorsSkipped = 0;
  let blankScoresSkipped = 0;
  const processedSubmissions = new Set();

  // Process each source tab once, using the mapping rows for that tab.
  sourceNames.forEach(sourceName => {
    const sourceSheet = sheetsByName[sourceName];

    if (!sourceSheet) {
      throw new Error(
        'Mapped Kobo source sheet not found (case-insensitive): ' +
        sourceName
      );
    }

    const sourceLastRow = sourceSheet.getLastRow();
    const sourceLastColumn = sourceSheet.getLastColumn();
    sourceLastRows[sourceName] = sourceLastRow;
    if (!sourceLastColumn || sourceLastRow < 2) return;

    const headers = sourceSheet.getRange(1, 1, 1, sourceLastColumn).getValues()[0].map(clean);
    const lastProcessedRow = Number(scriptProperties.getProperty(watermarkKey(sourceName))) || 1;
    const firstUnprocessedRow = Math.max(2, lastProcessedRow + 1);
    if (firstUnprocessedRow > sourceLastRow) return;

    const sourceData = sourceSheet.getRange(
      firstUnprocessedRow,
      1,
      sourceLastRow - firstUnprocessedRow + 1,
      sourceLastColumn
    ).getValues();
    const hc = colMap(headers);
    const sourceMappings = mappings.filter(m =>
      norm(m.sourceSheet) === sourceName
    );

    sourceData.forEach((row, rowIndex) => {
      const sourceRow = firstUnprocessedRow + rowIndex;
      sourceRowsRead++;

      const participant = sourceMappings[0].participant;
      const isStudent = participant === 'Student';

      const name = clean(valueByHeader(row, headers, isStudent
        ? ['Name of a child:', 'Name of a child', 'ChildName']
        : ['Name of participant', 'Your Name', 'TeacherName']));

      const regionRaw = valueByHeader(row, headers, [
        '1. Select your region', 'Select your region', 'Select your region '
      ]);

      const region = resolveLocation(regionRaw);

      
      // Use ONLY the standardized geography columns.
      // Do not fall back to raw survey responses or alter their values.
      const boardCol = headers.findIndex(h =>
        ['LocalBoard', 'Local Board (Standardized)']
          .some(candidate => norm(h) === norm(candidate))
      );

      const recCol = headers.findIndex(h =>
        ['REC', 'REC (Standardized)']
          .some(candidate => norm(h) === norm(candidate))
      );

      const board = boardCol >= 0 ? clean(row[boardCol]) : '';
      const rec = recCol >= 0 ? clean(row[recCol]) : '';


      // Prefer Kobo's unique identifiers whenever present.
      let sourceId = valueByHeader(row, headers, [
        '_uuid', '_id', 'meta/rootUuid'
      ]);

      if (!sourceId) {
        sourceId = stableFallbackId(
          row, headers, name, region, board, rec
        );
      }

      // Skip empty/non-submission rows.
      if (!name || !region || !board || !rec) {
        sourceRowsSkipped++;
        return;
      }

      const submissionSignature = [
        sourceName, sourceId
      ].join('|');

      // A source row should be processed only once in this run.
      if (processedSubmissions.has(submissionSignature)) {
        sourceRowsSkipped++;
        return;
      }
      processedSubmissions.add(submissionSignature);

      const yearValue = valueByHeader(row, headers, [
        'Year', 'Assessment Year'
      ]);
      const year = Number(yearValue) || yearDefault;

      const phaseValue = valueByHeader(row, headers, [
        'Specify the phase', 'Phase'
      ]);

      sourceMappings.forEach(m => {
        // Kobo rows still mapped as Cycle 1 are automatically routed to
        // Cycle 2 / Post 2 once this REC has completed Pre + Post for
        // this participant type and theme. APP_Records includes Kobo and app data.
        if (m.cycle === 'C2' && m.assessment === 'Post 2' &&
            sourceMappings.some(candidate =>
              candidate.cycle === 'C1' &&
              candidate.participant === m.participant &&
              candidate.theme === m.theme &&
              candidate.indicator === m.indicator
            )) return;
        let activeMapping = m;
        if (m.cycle === 'C1' && ['Pre', 'Post'].includes(m.assessment) &&
            recThemeHasPreAndPost_(m.participant, region, board, rec, m.theme)) {
          const post2Mapping = mappings.find(candidate =>
            candidate.cycle === 'C2' &&
            candidate.participant === m.participant &&
            candidate.assessment === 'Post 2' &&
            candidate.theme === m.theme &&
            candidate.indicator === m.indicator
          );
          if (!post2Mapping) {
            throw new Error(
              'Automatic Post 2 mapping is missing in APP_Indicators for ' +
              m.participant + ', ' + m.theme + ', ' + m.indicator +
              '. Add the Cycle 2 / Post 2 mapping before syncing this REC.'
            );
          }
          activeMapping = Object.assign({}, post2Mapping, {
            sourceSheet: m.sourceSheet,
            sourceColumn: m.sourceColumn
          });
        }
        if (activeMapping.sourceColumn > row.length) {
          throw new Error(
            'Source column ' + activeMapping.sourceColumn +
            ' exceeds the columns in ' + sourceSheet.getName()
          );
        }

        const scoreValue = row[activeMapping.sourceColumn - 1];

        if (scoreValue === '' || scoreValue === null ||
            scoreValue === undefined || !Number.isFinite(Number(scoreValue))) {
          blankScoresSkipped++;
          return;
        }

        const score = Number(scoreValue);
        if (score < 0 || score > activeMapping.maxScore) {
          throw new Error(
            'Invalid score in ' + sourceSheet.getName() +
            ', row ' + sourceRow + ', indicator ' + activeMapping.indicator +
            ': ' + score
          );
        }

        const submissionKey = [
          norm(sourceId), norm(activeMapping.assessment), norm(activeMapping.indicator)
        ].join('|');

        const rowKey = [
          norm(sourceSheet.getName()), String(sourceRow),
          norm(activeMapping.assessment), norm(activeMapping.indicator)
        ].join('|');

        if (existingSubmissionKeys.has(submissionKey) ||
            existingRowKeys.has(rowKey)) {
          duplicateIndicatorsSkipped++;
          return;
        }

        const recordId = [
          activeMapping.cycle || cycleDefault,
          isStudent ? 'S' : 'T',
          activeMapping.assessment.toUpperCase(),
          sourceId,
          m.indicator
        ].join('-').replace(/[^a-zA-Z0-9_-]/g, '_');

        const record = {
          RecordID: recordId,
          CycleID: activeMapping.cycle || cycleDefault,
          Year: year,
          ParticipantType: m.participant,
          Assessment: activeMapping.assessment,
          Region: region,
          LocalBoard: board,
          REC: rec,
          ParticipantCount: 1,
          Phase: phaseValue || (
            activeMapping.assessment === 'Post 2' ? 'Post 2' : activeMapping.assessment === 'Pre' ? 'Pre-assessment' : 'Post-assessment'
          ),
          ThemeID: activeMapping.theme,
          DimensionID: activeMapping.dimension,
          IndicatorID: activeMapping.indicator,
          Score: score,
          MaxScore: activeMapping.maxScore,
          SourceSheet: sourceSheet.getName(),
          SourceRow: sourceRow,
          SourceRecordID: sourceId
        };

        if (rc.ChildName !== undefined && isStudent) {
          record.ChildName = name;
        }
        if (rc.TeacherName !== undefined && !isStudent) {
          record.TeacherName = name;
        }

        newRows.push(
          rh.map(header => record[header] === undefined ? '' : record[header])
        );

        // Prevent duplicate mappings within this same run.
        existingSubmissionKeys.add(submissionKey);
        existingRowKeys.add(rowKey);
        indicatorsAdded++;
      });
    });
  });

  if (newRows.length) {
    recordsSheet.getRange(
      recordsSheet.getLastRow() + 1,
      1,
      newRows.length,
      rh.length
    ).setValues(newRows);
  }

  const result = {
    status: 'Completed — append-only',
    sourceRowsRead: sourceRowsRead,
    sourceRowsSkipped: sourceRowsSkipped,
    indicatorsAdded: indicatorsAdded,
    duplicateIndicatorsSkipped: duplicateIndicatorsSkipped,
    blankScoresSkipped: blankScoresSkipped,
    totalRowsAppended: newRows.length,
    historicalRowsDeletedOrRewritten: 0
  };

  // Advance watermarks only after APP_Records has been written successfully.
  // If an execution fails before this point, the next run retries and duplicate checks protect existing rows.
  const updatedWatermarks = {};
  sourceNames.forEach(sourceName => {
    const lastRow = sourceLastRows[sourceName];
    if (Number.isFinite(lastRow)) {
      updatedWatermarks[watermarkKey(sourceName)] = String(lastRow);
    }
  });
  if (Object.keys(updatedWatermarks).length) {
    scriptProperties.setProperties(updatedWatermarks, false);
  }

  result.sourceTabsChecked = sourceNames.length;
  result.incrementalMode = !needsInitialDedupe;
  Logger.log(JSON.stringify(result, null, 2));
  syncLock.releaseLock();
  return result;
}

/**
 * Read-only diagnostic for Kobo sync checkpoints.
 * Does not change watermarks or APP_Records.
 */
function inspectKoboSyncWatermarks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('APP_Indicators');
  if (!sh) throw new Error('APP_Indicators sheet not found.');

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(h => String(h == null ? '' : h).trim());
  const ix = {};
  headers.forEach((h, i) => ix[h] = i);

  ['SourceSheet', 'SourceColumn', 'ParticipantType', 'Assessment', 'IndicatorID']
    .forEach(h => {
      if (ix[h] === undefined) throw new Error('APP_Indicators missing ' + h);
    });

  const normName = v => String(v == null ? '' : v)
    .replace(/\\u00a0/g, ' ').trim().toLowerCase();

  const sources = {};
  values.slice(1).forEach(row => {
    const source = String(row[ix.SourceSheet] || '').trim();
    const col = Number(row[ix.SourceColumn]);
    const participant = String(row[ix.ParticipantType] || '').trim();
    const assessment = String(row[ix.Assessment] || '').trim();
    if (!source || !col || col < 1 || !participant || !assessment) return;
    const key = normName(source);
    if (!sources[key]) {
      sources[key] = {
        sourceSheet: source,
        mappings: 0,
        participantTypes: {},
        assessments: {}
      };
    }
    sources[key].mappings++;
    sources[key].participantTypes[participant] =
      (sources[key].participantTypes[participant] || 0) + 1;
    sources[key].assessments[assessment] =
      (sources[key].assessments[assessment] || 0) + 1;
  });

  const props = PropertiesService.getScriptProperties();
  const actualSheets = {};
  ss.getSheets().forEach(sheet => actualSheets[normName(sheet.getName())] = sheet);

  const report = {};
  Object.keys(sources).sort().forEach(key => {
    const item = sources[key];
    const sheet = actualSheets[key];
    const propertyKey = 'KOBO_SYNC_LAST_ROW_' + key;
    const saved = props.getProperty(propertyKey);
    const lastRow = sheet ? sheet.getLastRow() : null;
    report[item.sourceSheet] = {
      sheetFound: !!sheet,
      lastRow: lastRow,
      savedWatermark: saved,
      nextRowToRead: saved === null ? 2 : Number(saved) + 1,
      rowsAvailableAfterWatermark: sheet && lastRow
        ? Math.max(0, lastRow - Math.max(1, Number(saved || 1)))
        : null,
      mappings: item.mappings,
      participantTypes: item.participantTypes,
      assessments: item.assessments
    };
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


function installAutomaticKoboSync() {
  const handler = 'syncKoboToAPPRecords';

  // Remove duplicate triggers for this function only.
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Run the Kobo sync every 5 minutes.
  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Automatic Kobo sync installed: every 5 minutes.');
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


function testDashboardSourceSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheets = [
    {
      name: 'students pre assessment',
      type: 'Student',
      stage: 'Pre'
    },
    {
      name: 'students post assessment',
      type: 'Student',
      stage: 'Post'
    },
    {
      name: 'Teachers assessment',
      type: 'Teacher',
      stage: 'Both'
    }
  ];

  const studentIndicators = [
    'Theme1:UA1', 'Theme1:A1', 'Theme1:UA2',
    'Theme1:A2', 'Theme1:A3', 'Theme1:UA3',
    'Theme1:UA4', 'Theme1:A4', 'Theme1:A5',
    'Theme1:A6',

    'Theme2:UA1', 'Theme2:UA2', 'Theme2:A1',
    'Theme2:UA3', 'Theme2:UA4', 'Theme2:A2',
    'Theme2:A3',

    'Theme3:UA1', 'Theme3:A1', 'Theme3:UA2',
    'Theme3:A2',

    'Theme4:UA1', 'Theme4:UA2', 'Theme4:A1',
    'Theme4:A2', 'Theme4:A3', 'Theme4:A4',
    'Theme4:A5', 'Theme4:A6'
  ];

  const teacherIndicators = [
    'Pre Theme 1 Score',
    'Post Theme 1 Score',
    'Pre Theme 2 Score',
    'Post Theme 2 Score',
    'Pre Theme 3 Score',
    'Post Theme 3 Score',
    'Pre Theme 4 Score',
    'Post Theme 4 Score'
  ];

  const report = [];

  sourceSheets.forEach(source => {
    const sheet = ss.getSheetByName(source.name);

    if (!sheet) {
      report.push({
        sheet: source.name,
        error: 'SHEET NOT FOUND'
      });
      return;
    }

    const values = sheet.getDataRange().getValues();

    if (values.length === 0) {
      report.push({
        sheet: source.name,
        error: 'SHEET IS EMPTY'
      });
      return;
    }

    const headers = values[0].map(h => String(h).trim());
    const headerIndex = {};

    headers.forEach((h, i) => {
      headerIndex[h] = i;
    });

    const required = source.type === 'Teacher'
      ? [
          'Local Board (Standardized)',
          'REC (Standardized)',
          ...teacherIndicators
        ]
      : [
          'Local Board (Standardized)',
          'REC (Standardized)',
          'Specify the phase',
          ...studentIndicators
        ];

    const missingHeaders = required.filter(
      h => headerIndex[h] === undefined
    );

    let rowsWithAnyScore = 0;
    let rowsWithGeography = 0;
    let rowsWithValidScore = 0;
    let preRows = 0;
    let postRows = 0;

    for (let r = 1; r < values.length; r++) {
      const row = values[r];

      const board = row[headerIndex['Local Board (Standardized)']];
      const rec = row[headerIndex['REC (Standardized)']];

      if (String(board || '').trim() &&
          String(rec || '').trim()) {
        rowsWithGeography++;
      }

      let scoreCount = 0;
      let validCount = 0;

      const scoreHeaders = source.type === 'Teacher'
        ? teacherIndicators
        : studentIndicators;

      scoreHeaders.forEach(h => {
        const index = headerIndex[h];

        if (index === undefined) return;

        const value = row[index];

        if (value !== '' && value !== null) {
          scoreCount++;

          const n = Number(value);

          if (Number.isFinite(n) &&
              n >= 1 &&
              n <= (source.type === 'Teacher' ? 4 : 3)) {
            validCount++;
          }
        }
      });

      if (scoreCount > 0) rowsWithAnyScore++;
      if (validCount > 0) rowsWithValidScore++;

      if (source.type === 'Student') {
        const phaseIndex = headerIndex['Specify the phase'];
        const phase = phaseIndex === undefined
          ? ''
          : String(row[phaseIndex] || '').trim().toLowerCase();

        if (source.stage === 'Pre' &&
            phase.startsWith('pre-assessment')) {
          preRows++;
        }

        if (source.stage === 'Post' &&
            phase.startsWith('post-assessment')) {
          postRows++;
        }
      }
    }

    report.push({
      sheet: source.name,
      totalDataRows: Math.max(0, values.length - 1),
      headersFound: headers.length,
      missingHeaders: missingHeaders,
      rowsWithGeography: rowsWithGeography,
      rowsWithAnyScore: rowsWithAnyScore,
      rowsWithValidScore: rowsWithValidScore,
      preStageRows: preRows,
      postStageRows: postRows
    });
  });

  Logger.log(JSON.stringify(report, null, 2));

  return report;
}


function inspectStudentPreTheme2Headers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('students pre assessment');

  if (!sheet) {
    throw new Error('Student Pre sheet not found.');
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const matches = headers
    .map((header, index) => ({
      column: index + 1,
      header: String(header).trim()
    }))
    .filter(item =>
      /theme\s*2|theme2|A3/i.test(item.header)
    );

  Logger.log(JSON.stringify(matches, null, 2));
  return matches;
}

function testBuildDashboardSourceRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const studentIndicators = {
    T1: [
      'Theme1:UA1', 'Theme1:A1', 'Theme1:UA2',
      'Theme1:A2', 'Theme1:A3', 'Theme1:UA3',
      'Theme1:UA4', 'Theme1:A4', 'Theme1:A5',
      'Theme1:A6'
    ],
    T2: [
      'Theme2:UA1', 'Theme2:UA2', 'Theme2:A1',
      'Theme2:UA3', 'Theme2:UA4', 'Theme2:A2',
      'Theme2:A3'
    ],
    T3: [
      'Theme3:UA1', 'Theme3:A1',
      'Theme3:UA2', 'Theme3:A2'
    ],
    T4: [
      'Theme4:UA1', 'Theme4:UA2', 'Theme4:A1',
      'Theme4:A2', 'Theme4:A3', 'Theme4:A4',
      'Theme4:A5', 'Theme4:A6'
    ]
  };

  const teacherScoreColumns = {
    T1: { Pre: 'Pre Theme 1 Score', Post: 'Post Theme 1 Score' },
    T2: { Pre: 'Pre Theme 2 Score', Post: 'Post Theme 2 Score' },
    T3: { Pre: 'Pre Theme 3 Score', Post: 'Post Theme 3 Score' },
    T4: { Pre: 'Pre Theme 4 Score', Post: 'Post Theme 4 Score' }
  };

  const output = [];
  const issues = [];
  const summaryChecks = [];

  function cleanValue(value) {
    return String(value == null ? '' : value).trim();
  }

  function numericScore(value, max) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const n = Number(value);

    return Number.isFinite(n) && n >= 1 && n <= max
      ? n
      : null;
  }

  function readSheet(name) {
    const sheet = ss.getSheetByName(name);

    if (!sheet) {
      throw new Error('Sheet not found: ' + name);
    }

    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return { headers: [], rows: [] };
    }

    const headers = values[0].map(h => cleanValue(h));

    return {
      headers: headers,
      rows: values.slice(1).map(row => {
        const obj = {};

        headers.forEach((h, i) => {
          if (h) obj[h] = row[i];
        });

        return obj;
      })
    };
  }

  function addRecord(source, row, participantType, assessment,
                     theme, indicator, score, maxScore) {
    const region = cleanValue(row['Select your region']);
    const board = cleanValue(row['Local Board (Standardized)']);
    const rec = cleanValue(row['REC (Standardized)']);

    if (!region || !board || !rec) {
      issues.push({
        source: source,
        problem: 'Missing region or standardized geography',
        theme: theme,
        indicator: indicator
      });
      return;
    }

    const dateValue = row.start;
    const year = dateValue instanceof Date
      ? dateValue.getFullYear()
      : Number(String(dateValue || '').slice(0, 4)) || 0;

    const dimension = indicator
      ? (indicator.includes(':UA') ? 'UA' : 'A')
      : '';

    output.push({
      Year: year,
      ParticipantType: participantType,
      Assessment: assessment,
      Region: region,
      LocalBoard: board,
      REC: rec,
      ParticipantCount: 1,
      ThemeID: theme,
      DimensionID: dimension,
      IndicatorID: indicator || theme,
      Score: score,
      MaxScore: maxScore
    });
  }

  // STUDENT PRE
  const pre = readSheet('students pre assessment');
  const preHeaders = new Set(pre.headers);

  Object.keys(studentIndicators).forEach(theme => {
    studentIndicators[theme].forEach(indicator => {
      if (!preHeaders.has(indicator)) {
        issues.push({
          source: 'students pre assessment',
          problem: 'Indicator column absent; skipped',
          theme: theme,
          indicator: indicator
        });
      }
    });
  });

  pre.rows.forEach(row => {
    const phase = cleanValue(row['Specify the phase']).toLowerCase();

    if (phase && !phase.startsWith('pre-assessment')) return;

    Object.keys(studentIndicators).forEach(theme => {
      studentIndicators[theme].forEach(indicator => {
        if (!preHeaders.has(indicator)) return;

        const score = numericScore(row[indicator], 3);

        // Unmarked indicators are intentionally skipped.
        if (score === null) return;

        addRecord(
          'students pre assessment',
          row,
          'Student',
          'Pre',
          theme,
          indicator,
          score,
          3
        );
      });
    });
  });

  // STUDENT POST: exclude repeated Pre submissions.
  const post = readSheet('students post assessment');
  const postHeaders = new Set(post.headers);

  post.rows.forEach(row => {
    const phase = cleanValue(row['Specify the phase']).toLowerCase();

    if (!phase.startsWith('post-assessment')) return;

    Object.keys(studentIndicators).forEach(theme => {
      studentIndicators[theme].forEach(indicator => {
        if (!postHeaders.has(indicator)) return;

        const score = numericScore(row[indicator], 3);

        if (score === null) return;

        addRecord(
          'students post assessment',
          row,
          'Student',
          'Post',
          theme,
          indicator,
          score,
          3
        );
      });
    });
  });

  // TEACHERS: one record for each available theme/stage score.
  const teachers = readSheet('Teachers assessment');
  const teacherHeaders = new Set(teachers.headers);

  teachers.rows.forEach(row => {
    Object.keys(teacherScoreColumns).forEach(theme => {
      ['Pre', 'Post'].forEach(stage => {
        const column = teacherScoreColumns[theme][stage];

        if (!teacherHeaders.has(column)) return;

        const score = numericScore(row[column], 4);

        if (score === null) return;

        addRecord(
          'Teachers assessment',
          row,
          'Teacher',
          stage,
          theme,
          '',
          score,
          4
        );
      });
    });
  });

  // Compare calculated student theme averages with source summaries.
  ['students pre assessment', 'students post assessment'].forEach(name => {
    const data = readSheet(name);

    data.rows.forEach(row => {
      ['T1', 'T2', 'T3', 'T4'].forEach((theme, index) => {
        const sourceColumn = 'Theme' + (index + 1) + ' Average Score';

        if (!data.headers.includes(sourceColumn)) return;

        const sourceScore = numericScore(row[sourceColumn], 3);
        if (sourceScore === null) return;

        const indicatorScores = studentIndicators[theme]
          .filter(indicator => data.headers.includes(indicator))
          .map(indicator => numericScore(row[indicator], 3))
          .filter(score => score !== null);

        if (!indicatorScores.length) return;

        const calculatedAverage =
          indicatorScores.reduce((sum, score) => sum + score, 0) /
          indicatorScores.length;

        if (Math.abs(calculatedAverage - sourceScore) > 0.15) {
          summaryChecks.push({
            source: name,
            theme: theme,
            sourceAverage: sourceScore,
            indicatorAverage: Number(calculatedAverage.toFixed(2))
          });
        }
      });
    });
  });

  const counts = {};

  output.forEach(record => {
    const key = record.ParticipantType + ' ' + record.Assessment;
    counts[key] = (counts[key] || 0) + 1;
  });

  const result = {
    totalGeneratedRecords: output.length,
    countsByParticipantAndStage: counts,
    missingOrInvalidGeographyCount: issues.filter(
      x => x.problem === 'Missing region or standardized geography'
    ).length,
    absentIndicatorColumns: issues.filter(
      x => x.problem === 'Indicator column absent; skipped'
    ),
    summaryAverageDifferences: summaryChecks.length,
    summaryAverageExamples: summaryChecks.slice(0, 10),
    sampleRecords: output.slice(0, 5)
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function auditStandardizedGeography() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const records = ss.getSheetByName('APP_Records');

  if (!records) throw new Error('APP_Records not found.');

  const values = records.getDataRange().getValues();
  if (values.length < 2) throw new Error('APP_Records has no data rows.');

  const headers = values[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const required = [
    'SourceSheet', 'SourceRow', 'LocalBoard', 'REC'
  ];

  required.forEach(h => {
    if (col[h] === undefined) {
      throw new Error('APP_Records is missing column: ' + h);
    }
  });

  const cache = {};
  const findCol = (headers, name) =>
    headers.findIndex(h =>
      String(h).trim().toLowerCase() === name.toLowerCase()
    );

  let checked = 0;
  let missingSource = 0;
  let missingSourceRow = 0;
  let missingStandardizedColumns = 0;
  let emptyStandardizedValues = 0;
  let differentBoard = 0;
  let differentREC = 0;
  const samples = [];

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const sourceName = String(r[col.SourceSheet] || '')
      .trim().toLowerCase();
    const sourceRow = Number(r[col.SourceRow]);

    if (!sourceName) continue;

    if (!cache[sourceName]) {
      const sh = ss.getSheetByName(sourceName);
      if (!sh) {
        missingSource++;
        cache[sourceName] = { error: 'sheet not found' };
      } else {
        const sourceValues = sh.getDataRange().getValues();
        const sourceHeaders = sourceValues[0]
          .map(h => String(h).trim());

        const boardCol = findCol(
          sourceHeaders, 'Local Board (Standardized)'
        );
        const recCol = findCol(
          sourceHeaders, 'REC (Standardized)'
        );

        cache[sourceName] = {
          rows: sourceValues,
          boardCol,
          recCol
        };
      }
    }

    const source = cache[sourceName];

    if (source.error) continue;

    if (!Number.isInteger(sourceRow) ||
        sourceRow < 2 ||
        sourceRow >= source.rows.length + 1) {
      missingSourceRow++;
      continue;
    }

    if (source.boardCol < 0 || source.recCol < 0) {
      missingStandardizedColumns++;
      continue;
    }

    const sourceData = source.rows[sourceRow - 1];
    const board = String(sourceData[source.boardCol] || '').trim();
    const rec = String(sourceData[source.recCol] || '').trim();

    if (!board || !rec) {
      emptyStandardizedValues++;
      continue;
    }

    checked++;

    const oldBoard = String(r[col.LocalBoard] || '').trim();
    const oldREC = String(r[col.REC] || '').trim();

    if (oldBoard !== board) differentBoard++;
    if (oldREC !== rec) differentREC++;

    if (samples.length < 10 &&
        (oldBoard !== board || oldREC !== rec)) {
      samples.push({
        APP_RecordsRow: i + 1,
        SourceSheet: sourceName,
        SourceRow: sourceRow,
        CurrentLocalBoard: oldBoard,
        StandardizedLocalBoard: board,
        CurrentREC: oldREC,
        StandardizedREC: rec
      });
    }
  }

  Logger.log(JSON.stringify({
    status: 'AUDIT ONLY — NO CELLS CHANGED',
    recordsRows: values.length - 1,
    recordsMatchedToValidSource: checked,
    missingSourceSheets: missingSource,
    invalidSourceRows: missingSourceRow,
    missingStandardizedColumns: missingStandardizedColumns,
    emptyStandardizedGeography: emptyStandardizedValues,
    localBoardDifferences: differentBoard,
    recDifferences: differentREC,
    sampleDifferences: samples
  }, null, 2));
}


function updateStandardizedGeography() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const records = ss.getSheetByName('APP_Records');

  if (!records) throw new Error('APP_Records not found.');

  const data = records.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  ['SourceSheet', 'SourceRow', 'LocalBoard', 'REC']
    .forEach(h => {
      if (col[h] === undefined) {
        throw new Error('Missing APP_Records column: ' + h);
      }
    });

  const cache = {};
  const findCol = (hs, name) =>
    hs.findIndex(h =>
      String(h).trim().toLowerCase() === name.toLowerCase()
    );

  const updates = [];
  let skippedEmptyGeography = 0;
  let skippedMissingSource = 0;
  let localBoardChanges = 0;
  let recChanges = 0;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const sourceName = String(r[col.SourceSheet] || '')
      .trim().toLowerCase();
    const sourceRow = Number(r[col.SourceRow]);

    if (!sourceName) continue;

    if (!cache[sourceName]) {
      const sh = ss.getSheetByName(sourceName);
      if (!sh) {
        cache[sourceName] = null;
      } else {
        const sourceValues = sh.getDataRange().getValues();
        const hs = sourceValues[0].map(h => String(h).trim());

        cache[sourceName] = {
          rows: sourceValues,
          boardCol: findCol(hs, 'Local Board (Standardized)'),
          recCol: findCol(hs, 'REC (Standardized)')
        };
      }
    }

    const source = cache[sourceName];

    if (!source ||
        !Number.isInteger(sourceRow) ||
        sourceRow < 2 ||
        sourceRow >= source.rows.length + 1 ||
        source.boardCol < 0 ||
        source.recCol < 0) {
      skippedMissingSource++;
      continue;
    }

    const sourceData = source.rows[sourceRow - 1];
    const board = String(sourceData[source.boardCol] || '').trim();
    const rec = String(sourceData[source.recCol] || '').trim();

    // Never replace existing values with blanks.
    if (!board || !rec) {
      skippedEmptyGeography++;
      continue;
    }

    const sheetRow = i + 1;

    const oldBoard = String(r[col.LocalBoard] || '').trim();
    const oldREC = String(r[col.REC] || '').trim();

    if (oldBoard !== board) {
      updates.push({
        row: sheetRow,
        col: col.LocalBoard + 1,
        value: board
      });
      localBoardChanges++;
    }

    if (oldREC !== rec) {
      updates.push({
        row: sheetRow,
        col: col.REC + 1,
        value: rec
      });
      recChanges++;
    }
  }

  // Write only cells that actually differ in LocalBoard or REC.
  updates.forEach(u => {
    records.getRange(u.row, u.col).setValue(u.value);
  });

  Logger.log(JSON.stringify({
    status: 'STANDARDIZED GEOGRAPHY UPDATE COMPLETED',
    localBoardCellsUpdated: localBoardChanges,
    recCellsUpdated: recChanges,
    totalCellsUpdated: updates.length,
    rowsSkippedForEmptyGeography: skippedEmptyGeography,
    rowsSkippedForMissingSource: skippedMissingSource,
    otherColumnsModified: false
  }, null, 2));
}


function auditTeacherGeography() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('APP_Records');
  if (!sh) throw new Error('APP_Records not found.');

  const data = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  ['ParticipantType', 'SourceSheet', 'SourceRow',
   'LocalBoard', 'REC'].forEach(h => {
    if (col[h] === undefined) {
      throw new Error('Missing column: ' + h);
    }
  });

  const cache = {};
  let teacherRecords = 0;
  let checked = 0;
  let boardDifferences = 0;
  let recDifferences = 0;
  let missingGeography = 0;
  const samples = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (String(r[col.ParticipantType]).trim().toLowerCase()
        !== 'teacher') continue;

    teacherRecords++;

    const sourceName = String(r[col.SourceSheet] || '')
      .trim().toLowerCase();
    const sourceRow = Number(r[col.SourceRow]);

    if (!cache[sourceName]) {
      const source = ss.getSheetByName(sourceName);
      if (!source) {
        cache[sourceName] = null;
      } else {
        const v = source.getDataRange().getValues();
        const hs = v[0].map(h => String(h).trim());
        cache[sourceName] = {
          rows: v,
          board: hs.findIndex(h =>
            h.toLowerCase() === 'local board (standardized)'),
          rec: hs.findIndex(h =>
            h.toLowerCase() === 'rec (standardized)')
        };
      }
    }

    const src = cache[sourceName];
    if (!src || !Number.isInteger(sourceRow) ||
        sourceRow < 2 || sourceRow >= src.rows.length + 1 ||
        src.board < 0 || src.rec < 0) {
      missingGeography++;
      continue;
    }

    const sourceData = src.rows[sourceRow - 1];
    const board = String(sourceData[src.board] || '').trim();
    const rec = String(sourceData[src.rec] || '').trim();

    if (!board || !rec) {
      missingGeography++;
      continue;
    }

    checked++;
    const oldBoard = String(r[col.LocalBoard] || '').trim();
    const oldREC = String(r[col.REC] || '').trim();
    const boardDiff = oldBoard !== board;
    const recDiff = oldREC !== rec;

    if (boardDiff) boardDifferences++;
    if (recDiff) recDifferences++;

    if ((boardDiff || recDiff) && samples.length < 10) {
      samples.push({
        APP_RecordsRow: i + 1,
        SourceSheet: sourceName,
        SourceRow: sourceRow,
        currentBoard: oldBoard,
        standardizedBoard: board,
        currentREC: oldREC,
        standardizedREC: rec
      });
    }
  }

  Logger.log(JSON.stringify({
    status: 'AUDIT ONLY — NO CELLS CHANGED',
    teacherRecords: teacherRecords,
    teacherRecordsChecked: checked,
    localBoardDifferences: boardDifferences,
    recDifferences: recDifferences,
    missingOrUnmatchedGeography: missingGeography,
    samples: samples
  }, null, 2));
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

