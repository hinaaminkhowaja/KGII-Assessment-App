/**
 * Read-only diagnostics for six-source direct dashboard mapping.
 * Run auditSixSourceMappingDifferences(). No sheet writes.
 */
function auditSixSourceMappingDifferences() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clean = v => String(v == null ? '' : v).replace(/\u00a0/g, ' ').trim();
  const norm = v => clean(v).toLowerCase();
  const sources = [
    {name:'Students Pre Assessment',kind:'kobo'},
    {name:'Students Post Assessment',kind:'kobo'},
    {name:'Teachers Assessment',kind:'kobo'},
    {name:'APP_Student_Surveys',kind:'app'},
    {name:'APP_Teacher_Surveys',kind:'app'},
    {name:'APP_Teacher_Surveys_Cycle2',kind:'app'}
  ];
  const mapSheet = ss.getSheetByName('APP_Indicators');
  if (!mapSheet) throw new Error('APP_Indicators not found.');
  const mv = mapSheet.getDataRange().getValues();
  const mh = mv[0].map(clean), ix = {};
  mh.forEach((h,i)=>ix[h]=i);
  const required = ['CycleID','ParticipantType','Assessment','ThemeID','DimensionID','IndicatorID','MaxScore','SourceSheet','SourceColumn','AppSourceSheet','AppSourceColumn'];
  const missing = required.filter(h=>ix[h]===undefined);
  if (missing.length) throw new Error('APP_Indicators missing headers: '+missing.join(', '));
  const mappings = mv.slice(1).filter(r=>clean(r[ix.IndicatorID]));
  const report = {status:'READ ONLY — NO DATA WRITTEN',auditedAt:new Date().toISOString(),mappingRows:mappings.length,sources:[],recordsBySourceSheet:{}};

  sources.forEach(src=>{
    const sh=ss.getSheetByName(src.name);
    if(!sh){report.sources.push({source:src.name,exists:false});return;}
    const lr=sh.getLastRow(), lc=sh.getLastColumn();
    const vals=lr&&lc?sh.getRange(1,1,lr,lc).getValues():[];
    const headers=vals.length?vals[0].map(clean):[];
    const data=vals.slice(1);
    const activeData=data.filter(row=>row.some(v=>v!==''&&v!==null&&v!==undefined));
    const field=src.kind==='kobo'?'SourceColumn':'AppSourceColumn';
    const sheetField=src.kind==='kobo'?'SourceSheet':'AppSourceSheet';
    const rows=mappings.filter(r=>norm(r[ix.ParticipantType])===norm(src.kind==='kobo'?(src.name==='Teachers Assessment'?'Teacher':'Student'):(src.name==='APP_Student_Surveys'?'Student':'Teacher')) && norm(r[ix[sheetField]])===norm(src.name));
    const mapReport=[];
    let mappedPopulated=0,blank=0,nonNumeric=0,outOfRange=0,valid=0;
    const mappingProblems=[];
    rows.forEach(m=>{
      const col=Number(m[ix[field]]);
      const entry={cycle:clean(m[ix.CycleID]),assessment:clean(m[ix.Assessment]),indicator:clean(m[ix.IndicatorID]),configuredColumn:m[ix[field]],mappedHeader:Number.isInteger(col)&&col>0&&col<=headers.length?headers[col-1]:'',populated:0,blank:0,nonNumeric:0,outOfRange:0,valid:0};
      if(!Number.isInteger(col)||col<1||col>headers.length){entry.mappingProblem='Configured column is invalid or outside current source width';mappingProblems.push(entry);mapReport.push(entry);return;}
      const expectedHeader=clean(m[ix.IndicatorID]);
      if(norm(headers[col-1])!==norm(expectedHeader)){entry.mappingProblem='Mapped header differs from IndicatorID';mappingProblems.push(entry);}
      activeData.forEach(row=>{
        const v=row[col-1];
        if(v===''||v===null||v===undefined){entry.blank++;blank++;return;}
        entry.populated++;mappedPopulated++;
        if(typeof v==='boolean'||!Number.isFinite(Number(v))){entry.nonNumeric++;nonNumeric++;return;}
        const n=Number(v), max=Number(m[ix.MaxScore]);
        if(n<0||!Number.isFinite(max)||n>max){entry.outOfRange++;outOfRange++;return;}
        entry.valid++;valid++;
      });
      mapReport.push(entry);
    });
    report.sources.push({
      source:src.name,kind:src.kind,exists:true,lastRow:lr,lastColumn:lc,
      dataRowsWithAnyValue:activeData.length,
      mappingCount:rows.length,
      mappingProblems,
      totals:{populatedIndicatorCells:mappedPopulated,blankIndicatorCells:blank,nonNumericIndicatorCells:nonNumeric,outOfRangeIndicatorCells:outOfRange,validIndicatorCells:valid}
    });
  });

  const rec=ss.getSheetByName('APP_Records');
  if(rec&&rec.getLastRow()>1){
    const values=rec.getDataRange().getValues(), h=values[0].map(clean), si=h.indexOf('SourceSheet'), ci=h.indexOf('CycleID'), pi=h.indexOf('ParticipantType'), ai=h.indexOf('Assessment'), ii=h.indexOf('IndicatorID');
    values.slice(1).forEach(row=>{
      const key=clean(row[si])||'(blank SourceSheet)';
      if(!report.recordsBySourceSheet[key])report.recordsBySourceSheet[key]={rows:0,cycles:{},participants:{},assessments:{},indicators:{}};
      const x=report.recordsBySourceSheet[key];x.rows++;
      [[ci,x.cycles],[pi,x.participants],[ai,x.assessments],[ii,x.indicators]].forEach(([col,obj])=>{const k=col<0?'(column missing)':clean(row[col])||'(blank)';obj[k]=(obj[k]||0)+1;});
    });
  }
  report.note='Blank counts are calculated only across non-empty submission rows. Counts are diagnostic indicator-cell counts, not imported record counts. No data was written.';
  report.compactSummary=report.sources.map(x=>({source:x.source,exists:x.exists,dataRowsWithAnyValue:x.dataRowsWithAnyValue,mappingCount:x.mappingCount,totals:x.totals,mappingProblems:x.mappingProblems}));
  Logger.log(JSON.stringify({status:report.status,auditedAt:report.auditedAt,compactSummary:report.compactSummary,recordsBySourceSheet:report.recordsBySourceSheet,note:report.note},null,2));
  return report;
}
