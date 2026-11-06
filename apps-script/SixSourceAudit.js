/**
 * KG II Assessment App — six-source dashboard readiness audit
 *
 * READ ONLY: this function reads the six assessment source tabs and
 * APP_Indicators. It does not write to, clear, or modify any sheet.
 *
 * Run previewSixSourceAudit() from the Apps Script editor.
 */
function previewSixSourceAudit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sources = [
    { name: 'Students Pre Assessment', kind: 'kobo', participantType: 'Student' },
    { name: 'Students Post Assessment', kind: 'kobo', participantType: 'Student' },
    { name: 'Teachers Assessment', kind: 'kobo', participantType: 'Teacher' },
    { name: 'APP_Student_Surveys', kind: 'app', participantType: 'Student' },
    { name: 'APP_Teacher_Surveys', kind: 'app', participantType: 'Teacher' },
    { name: 'APP_Teacher_Surveys_Cycle2', kind: 'app', participantType: 'Teacher' }
  ];

  const normalize = value => String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase();

  const indicatorsSheet = ss.getSheetByName('APP_Indicators');
  if (!indicatorsSheet) {
    throw new Error('APP_Indicators sheet not found.');
  }

  const indicatorValues = indicatorsSheet.getDataRange().getValues();
  if (indicatorValues.length < 1) {
    throw new Error('APP_Indicators has no header row.');
  }

  const indicatorHeaders = indicatorValues[0].map(v => String(v || '').trim());
  const indicatorIndex = {};
  indicatorHeaders.forEach((header, index) => {
    indicatorIndex[header] = index;
  });

  const requiredMappingHeaders = [
    'CycleID', 'ParticipantType', 'Assessment', 'ThemeID',
    'DimensionID', 'IndicatorID', 'MaxScore', 'SourceSheet',
    'SourceColumn', 'AppSourceSheet', 'AppSourceColumn'
  ];
  const missingMappingHeaders = requiredMappingHeaders.filter(
    header => indicatorIndex[header] === undefined
  );
  if (missingMappingHeaders.length) {
    throw new Error(
      'APP_Indicators is missing required mapping headers: ' +
      missingMappingHeaders.join(', ')
    );
  }

  const mappingRows = indicatorValues.slice(1).filter(row =>
    String(row[indicatorIndex.IndicatorID] || '').trim()
  );

  const report = {
    status: 'READ ONLY — NO DATA WRITTEN',
    spreadsheetName: ss.getName(),
    auditedAt: new Date().toISOString(),
    indicatorMappingRows: mappingRows.length,
    sources: []
  };

  sources.forEach(source => {
    const sheet = ss.getSheetByName(source.name);
    if (!sheet) {
      report.sources.push({
        sheet: source.name,
        kind: source.kind,
        participantType: source.participantType,
        exists: false,
        error: 'Source sheet not found'
      });
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (!lastColumn) {
      report.sources.push({
        sheet: source.name,
        kind: source.kind,
        participantType: source.participantType,
        exists: true,
        lastRow: lastRow,
        lastColumn: 0,
        dataRows: Math.max(0, lastRow - 1),
        headers: [],
        error: 'Sheet has no header columns'
      });
      return;
    }

    const values = sheet.getRange(1, 1, Math.max(1, lastRow), lastColumn).getValues();
    const headers = values[0].map(v => String(v || '').trim());
    const normalizedHeaders = headers.map(normalize);
    const hasHeader = name => normalizedHeaders.indexOf(normalize(name)) >= 0;
    const findHeader = name => normalizedHeaders.indexOf(normalize(name));

    const mappings = mappingRows.filter(row => {
      const participant = normalize(row[indicatorIndex.ParticipantType]);
      const expectedParticipant = normalize(source.participantType);
      const mappedSheet = source.kind === 'kobo'
        ? row[indicatorIndex.SourceSheet]
        : row[indicatorIndex.AppSourceSheet];
      return participant === expectedParticipant &&
        normalize(mappedSheet) === normalize(source.name);
    });

    const mappingIssues = [];
    const mappingGroups = {};
    mappings.forEach(row => {
      const cycle = String(row[indicatorIndex.CycleID] || '').trim();
      const assessment = String(row[indicatorIndex.Assessment] || '').trim();
      const theme = String(row[indicatorIndex.ThemeID] || '').trim();
      const indicator = String(row[indicatorIndex.IndicatorID] || '').trim();
      const columnField = source.kind === 'kobo'
        ? 'SourceColumn'
        : 'AppSourceColumn';
      const columnNumber = Number(row[indicatorIndex[columnField]]);
      const key = [cycle, source.participantType, assessment].join(' / ');
      mappingGroups[key] = (mappingGroups[key] || 0) + 1;

      if (!Number.isInteger(columnNumber) || columnNumber < 1) {
        mappingIssues.push({
          indicator: indicator,
          theme: theme,
          cycle: cycle,
          assessment: assessment,
          issue: 'Invalid or blank ' + columnField,
          configuredColumn: row[indicatorIndex[columnField]]
        });
        return;
      }

      if (columnNumber > headers.length) {
        mappingIssues.push({
          indicator: indicator,
          theme: theme,
          cycle: cycle,
          assessment: assessment,
          issue: columnField + ' exceeds source sheet column count',
          configuredColumn: columnNumber,
          sourceColumnCount: headers.length
        });
        return;
      }

      const mappedHeader = headers[columnNumber - 1];
      if (!mappedHeader) {
        mappingIssues.push({
          indicator: indicator,
          theme: theme,
          cycle: cycle,
          assessment: assessment,
          issue: 'Mapped source column has a blank header',
          configuredColumn: columnNumber
        });
      }
    });

    const identityHeaders = source.kind === 'kobo'
      ? ['_uuid']
      : ['SubmissionID'];
    const identityHeaderPresent = identityHeaders.some(hasHeader);
    const geographyHeaders = ['Region', 'LocalBoard', 'REC'];
    const geographyPresent = geographyHeaders.filter(hasHeader);
    const missingGeographyHeaders = geographyHeaders.filter(name => !hasHeader(name));

    const nonEmptyDataRows = values.slice(1).filter(row =>
      row.some(value => value !== '' && value !== null)
    ).length;

    report.sources.push({
      sheet: source.name,
      kind: source.kind,
      participantType: source.participantType,
      exists: true,
      lastRow: lastRow,
      lastColumn: lastColumn,
      dataRows: Math.max(0, lastRow - 1),
      nonEmptyDataRows: nonEmptyDataRows,
      headers: headers,
      identityHeaderPresent: identityHeaderPresent,
      identityHeaderExpected: identityHeaders,
      geographyHeadersPresent: geographyPresent,
      missingGeographyHeaders: missingGeographyHeaders,
      matchingIndicatorMappings: mappings.length,
      mappingGroups: mappingGroups,
      mappingIssues: mappingIssues
    });
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
