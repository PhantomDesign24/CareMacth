const { fetchAlimtalkHistory } = require('./dist/services/aligoService');
(async () => {
  const today = new Date(Date.now() + 9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
  const map = await fetchAlimtalkHistory({ startdate: today, limit: 500, page: 1 });
  const targets = ['1414559390', '1414559397'];
  console.log('이력 조회 결과 (' + Object.keys(map).length + '건 중)');
  for (const mid of targets) {
    const via = map[mid];
    const label = mid === '1414559390' ? '① 승인 템플릿(UH_5878)' : '② 심사중 템플릿(UK_0272)';
    console.log('  ' + label + ' mid=' + mid + ' → ' + (via || '(이력 미반영, 잠시 후 재확인)'));
  }
  process.exit(0);
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
