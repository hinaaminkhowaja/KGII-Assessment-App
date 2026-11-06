/**
 * READ-ONLY preview of the six direct assessment sources.
 * Reads Kobo source sheets and APP survey source sheets using APP_Indicators.
 * Does not write to APP_Records, source sheets, or Script Properties.
 *
 * Run: previewSixSourceDashboardData()
 */
function previewSixSourceDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clean = v => String(v == null ? '' : v).replace(/\u00a0/g, ' ').trim();
  const norm = v => clean(v).toLowerCase();
  const findCol = (headers, candidates) => {
    for (const candidate of candidates) {
      const index = headers.findIndex(h => norm(h) === norm(candidate));
      if (index >= 0) return index;
    }
    return -1;
  };
  const valueAt = (row, headers, candidates) => {
    const index = findCol(headers, candidates);
    return index < 0 ? '' : row[index];
  };
  const hashId = value => {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8
    );
    return 'KOBO-' + bytes.map(b =>
      ('0' + ((b + 256) % 256).toString(16)).slice(-2)
    ).join('').substring(0, 24);
  };

  const expectedSources = [
    { name: 'Students Pre Assessment', kind: 'kobo' },
    { name: 'Students Post Assessment', kind: 'kobo' },
    { name: 'Teachers Assessment', kind: 'kobo' },
    { name: 'APP_Student_Surveys', kind: 'app' },
    { name: 'APP_Teacher_Surveys', kind: 'app' },
    { name: 'APP_Teacher_Surveys_Cycle2', kind: 'app' }
  ];

  const indicatorSheet = ss.getSheetByName('APP_Indicators');
  if (!indicatorSheet) throw new Error('APP_Indicators sheet not found.');
  const indicatorValues = indicatorSheet.getDataRange().getValues();
  if (indicatorValues.length < 2) throw new Error('APP_Indicators has no mappings.');
  const mapHeaders = indicatorValues[0].map(clean);
  const mi = {};
  mapHeaders.forEach((h, i) => mi[h] = i);
  [
    'CycleID', 'ParticipantType', 'Assessment', 'ThemeID',
    'DimensionID', 'IndicatorID', 'MaxScore', 'SourceSheet', 'SourceColumn',
    'AppSourceSheet', 'AppSourceColumn'
  ].forEach(h => {
    if (mi[h] === undefined) throw new Error('APP_Indicators missing column: ' + h);
  });
  const mappings = indicatorValues.slice(1).filter(r => clean(r[mi.IndicatorID])).map(r => ({
    cycle: clean(r[mi.CycleID]),
    year: mi.Year === undefined ? '' : r[mi.Year],
    participant: clean(r[mi.ParticipantType]),
    assessment: clean(r[mi.Assessment]),
    theme: clean(r[mi.ThemeID]),
    dimension: clean(r[mi.DimensionID]),
    indicator: clean(r[mi.IndicatorID]),
    maxScore: Number(r[mi.MaxScore]),
    koboSheet: clean(r[mi.SourceSheet]),
    koboColumn: Number(r[mi.SourceColumn]),
    appSheet: clean(r[mi.AppSourceSheet]),
    appColumn: Number(r[mi.AppSourceColumn])
  }));

  const report = {
    status: 'READ ONLY — NO DATA WRITTEN',
    spreadsheetName: ss.getName(),
    auditedAt: new Date().toISOString(),
    sourceSummaries: [],
    totalNormalizedRecords: 0,
    totalSourceRowsRead: 0,
    totalBlankOrInvalidScores: 0,
    samples: []
  };

  const recordsSheet = ss.getSheetByName('APP_Records');
  const recordHeaders = recordsSheet && recordsSheet.getLastColumn()
    ? recordsSheet.getRange(1, 1, 1, recordsSheet.getLastColumn()).getValues()[0].map(clean)
    : [];
  const requiredOutput = [
    'RecordID', 'CycleID', 'Year', 'ParticipantType', 'Assessment', 'Region',
    'LocalBoard', 'REC', 'ParticipantCount', 'Phase', 'ThemeID', 'DimensionID',
    'IndicatorID', 'Score', 'MaxScore', 'SourceSheet', 'SourceRow',
    'SourceRecordID', 'ChildName', 'TeacherName'
  ];
  const missingOutputHeaders = requiredOutput.filter(h => recordHeaders.indexOf(h) < 0);
  if (missingOutputHeaders.length) {
    throw new Error('APP_Records is missing expected headers: ' + missingOutputHeaders.join(', '));
  }

  const sourceNames = new Set();
  expectedSources.forEach(source => {
    const sheet = ss.getSheetByName(source.name);
    if (!sheet) {
      report.sourceSummaries.push({ sourceSheet: source.name, kind: source.kind, exists: false });
      return;
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (!lastColumn) {
      report.sourceSummaries.push({
        sourceSheet: source.name, kind: source.kind, exists: true,
        sourceRows: 0, mappings: 0, normalizedRecords: 0,
        skippedScores: 0, note: 'No header columns'
      });
      return;
    }
    const values = sheet.getRange(1, 1, Math.max(1, lastRow), lastColumn).getValues();
    const headers = values[0].map(clean);
    const sourceMappings = mappings.filter(m =>
      norm(source.kind === 'kobo' ? m.koboSheet : m.appSheet) === norm(source.name) &&
      Number(source.kind === 'kobo' ? m.koboColumn : m.appColumn) > 0
    );
    let rowCount = 0;
    let normalized = 0;
    let skippedScores = 0;
    const assessmentCounts = {};
    const yearCounts = {};
    let missingYearRows = 0;
    const sourceRecords = [];

    values.slice(1).forEach((row, index) => {
      if (!row.some(v => v !== '' && v !== null)) return;
      rowCount++;
      const sourceRow = index + 2;
      const participant = sourceMappings.length ? sourceMappings[0].participant : '';
      const isStudent = norm(participant) === 'student';
      // Assessment year is derived from the submission timestamps when no
      // explicit Year field exists. Kobo exports provide start/end columns.
      const explicitYear = clean(valueAt(row, headers, ['Year', 'Assessment Year']));
      const startValue = valueAt(row, headers, ['start', 'Start', 'SubmissionDate', 'SubmittedAt', 'CreatedAt']);
      const endValue = valueAt(row, headers, ['end', 'End']);
      const yearFromDate = value => {
        if (value instanceof Date && !isNaN(value.getTime())) return String(value.getFullYear());
        const raw = clean(value);
        if (!raw) return '';
        const match = raw.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
        if (match) return match[1];
        const parsed = new Date(raw);
        return !isNaN(parsed.getTime()) ? String(parsed.getFullYear()) : '';
      };
      const year = explicitYear || yearFromDate(startValue) || yearFromDate(endValue);
      const region = clean(valueAt(row, headers, source.kind === 'kobo'
        ? ['1. Select your region', 'Select your region', 'Region']
        : ['Region']));
      const board = clean(valueAt(row, headers, ['LocalBoard', 'Local Board (Standardized)']));
      const rec = clean(valueAt(row, headers, ['REC', 'REC (Standardized)']));
      const childName = clean(valueAt(row, headers, ['Name of a child:', 'Name of a child', 'ChildName']));
      const teacherName = clean(valueAt(row, headers, ['Name of participant', 'Your Name', 'TeacherName']));
      const participantName = isStudent ? childName : teacherName;

      let sourceId = clean(valueAt(row, headers, source.kind === 'kobo'
        ? ['_uuid', '_id', 'meta/rootUuid']
        : ['SubmissionID']));
      if (!sourceId && source.kind === 'kobo') {
        sourceId = hashId([
          valueAt(row, headers, ['start']), valueAt(row, headers, ['end']),
          participantName, region, board, rec, sourceRow
        ].map(clean).join('|'));
      }
      if (!sourceId && source.kind === 'app') {
        sourceId = 'APP-' + source.name + '-ROW-' + sourceRow;
      }

      if (year) yearCounts[year] = (yearCounts[year] || 0) + 1; else missingYearRows++;
      if (!region || !board || !rec) {
        skippedScores += sourceMappings.length;
        return;
      }

      sourceMappings.forEach(m => {
        const col = (source.kind === 'kobo' ? m.koboColumn : m.appColumn) - 1;
        if (col < 0 || col >= row.length) {
          skippedScores++;
          return;
        }
        const raw = row[col];
        if (raw === '' || raw === null || raw === undefined || !Number.isFinite(Number(raw))) {
          skippedScores++;
          return;
        }
        const score = Number(raw);
        if (!Number.isFinite(m.maxScore) || score < 0 || score > m.maxScore) {
          skippedScores++;
          return;
        }
        const assessmentKey = m.cycle + ' / ' + m.assessment;
        assessmentCounts[assessmentKey] = (assessmentCounts[assessmentKey] || 0) + 1;
        normalized++;
        if (report.samples.length < 12) {
          report.samples.push({
            sourceSheet: source.name,
            sourceRow: sourceRow,
            sourceRecordID: sourceId,
            cycleID: m.cycle,
            year: m.year || year,
            participantType: m.participant,
            assessment: m.assessment,
            region: region,
            localBoard: board,
            rec: rec,
            indicatorID: m.indicator,
            score: score,
            maxScore: m.maxScore
          });
        }
      });
      if (sourceId) sourceRecords.push(sourceId);
    });

    report.totalSourceRowsRead += rowCount;
    report.totalNormalizedRecords += normalized;
    report.totalBlankOrInvalidScores += skippedScores;
    report.sourceSummaries.push({
      sourceSheet: source.name,
      kind: source.kind,
      exists: true,
      lastRow: lastRow,
      sourceRowsWithData: rowCount,
      mappings: sourceMappings.length,
      normalizedIndicatorRecords: normalized,
      blankOrInvalidScoresOrMissingGeography: skippedScores,
      assessmentCounts: assessmentCounts,
      yearCounts: yearCounts,
      missingYearRows: missingYearRows,
      yearSource: findCol(headers, ['Year', 'Assessment Year']) >= 0 ? 'Year column' :
        (findCol(headers, ['start', 'Start', 'SubmissionDate', 'SubmittedAt', 'CreatedAt']) >= 0 ? 'start timestamp, then end fallback' : 'end timestamp fallback'),
      yearHeaderPresent: findCol(headers, ['Year', 'Assessment Year']) >= 0,
      uniqueSourceIDsObserved: new Set(sourceRecords).size,
      identityHeader: source.kind === 'kobo'
        ? (findCol(headers, ['_uuid', '_id', 'meta/rootUuid']) >= 0 ? headers[findCol(headers, ['_uuid', '_id', 'meta/rootUuid'])] : 'Deterministic fallback')
        : (findCol(headers, ['SubmissionID']) >= 0 ? 'SubmissionID' : 'Generated row fallback')
    });
  });

  report.appRecordsRowsForComparison = recordsSheet ? Math.max(0, recordsSheet.getLastRow() - 1) : null;
  report.note = 'Preview only. This function does not append, update, delete, or change watermarks.';
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
