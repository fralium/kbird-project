const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertBirdreportRecordUrl,
  parseBirdreportRecordHtml,
} = require('../server/utils/birdreportRecordPage');

const SAMPLE = `
<span id="serialid">2026101801790观鸟报告</span>
<span id="timebegin">2026-10-18 14:00</span>
<span id="pointname">北京市延庆区野鸭湖</span>
<div class="layui-table-main">
<table><tbody>
<tr>
<td data-field="taxon_id"><div class="layui-table-cell">4079</div></td>
<td data-field="taxon_name"><div class="layui-table-cell"><span>鸿雁</span></div></td>
<td data-field="latinname"><div class="layui-table-cell"><i>Anser cygnoides</i></div></td>
<td data-field="englishname"><div class="layui-table-cell">Swan Goose</div></td>
<td data-field="taxonordername"><div class="layui-table-cell">雁形目</div></td>
<td data-field="taxonfamilyname"><div class="layui-table-cell">鸭科</div></td>
<td data-field="taxon_count"><div class="layui-table-cell">2</div></td>
</tr>
<tr>
<td data-field="taxon_name"><div class="layui-table-cell">黑鹳</div></td>
<td data-field="latinname"><div class="layui-table-cell">Ciconia nigra</div></td>
<td data-field="taxon_count"><div class="layui-table-cell">1</div></td>
</tr>
</tbody></table>
</div>
`;

test('accepts only a birdreport record page', () => {
  const url = assertBirdreportRecordUrl(
    'https://www.birdreport.cn/home/record/page.html?param=abc&sign=d41d8cd98f00b204e9800998ecf8427e&extra=1'
  );
  assert.equal(
    url,
    'https://www.birdreport.cn/home/record/page.html?param=abc&sign=d41d8cd98f00b204e9800998ecf8427e'
  );
  assert.throws(() => assertBirdreportRecordUrl('https://example.com/home/record/page.html?param=abc'));
  assert.throws(() => assertBirdreportRecordUrl('https://www.birdreport.cn/home/index.html?param=abc'));
});

test('parses the loaded species table', () => {
  const page = parseBirdreportRecordHtml(SAMPLE);
  assert.equal(page.fileName, '2026101801790观鸟报告');
  assert.equal(page.locationLabel, '北京市延庆区野鸭湖');
  assert.equal(page.tripDate, '2026-10-18');
  assert.equal(page.species.length, 2);
  assert.deepEqual(page.species[0], {
    code: '4079',
    name: '鸿雁',
    scientificName: 'Anser cygnoides',
    englishName: 'Swan Goose',
    order: '雁形目',
    family: '鸭科',
    recordCount: 2,
  });
  assert.equal(page.species[1].name, '黑鹳');
});
