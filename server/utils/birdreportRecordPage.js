const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PAGE_TIMEOUT_MS = 28000;
const PREFLIGHT_TIMEOUT_MS = 8000;
const VIRTUAL_TIME_BUDGET_MS = 18000;
const MAX_HTML_CHARS = 6_000_000;
const MAX_ACTIVE_LOADS = 2;
const ALLOWED_BROWSER_HOSTS = [
  'www.birdreport.cn',
  'birdreport.cn',
  'api.birdreport.cn',
];

let activeLoads = 0;

function pageError(message, statusCode = 400, code = 'BIRDREPORT_PAGE_FAILED') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function textOf(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function spanText(html, id) {
  const match = String(html || '').match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</span>`, 'i'));
  return match ? textOf(match[1]) : '';
}

function fieldText(rowHtml, field) {
  const match = String(rowHtml || '').match(
    new RegExp(`data-field="${field}"[\\s\\S]*?<div class="layui-table-cell[\\s\\S]*?>([\\s\\S]*?)</div>`, 'i')
  );
  return match ? textOf(match[1]) : '';
}

/** 记录中心 outside_type=1 时把中文名标红，表示不在该地点所在地区的常规名录。 */
function isOutsideLocalName(rowHtml) {
  const cell = String(rowHtml || '').match(/data-field="taxon_name"[\s\S]*?<\/td>/i);
  return /#FF4040/i.test(cell ? cell[0] : '');
}

function parseCount(value) {
  const digits = String(value || '').replace(/[^\d.]/g, '');
  const num = Number.parseFloat(digits);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

/** 只接受中国观鸟记录中心的单条观鸟记录页，避免服务器去打开任意网址。 */
function assertBirdreportRecordUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    throw pageError('请粘贴中国观鸟记录中心的观鸟记录链接');
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || (host !== 'www.birdreport.cn' && host !== 'birdreport.cn')) {
    throw pageError('只支持中国观鸟记录中心（birdreport.cn）的观鸟记录链接');
  }
  if (url.pathname !== '/home/record/page.html') {
    throw pageError('请粘贴单条观鸟记录页链接，不是列表或统计页');
  }
  const param = String(url.searchParams.get('param') || '').trim();
  if (!param || param.length > 800) {
    throw pageError('这条链接缺少记录参数');
  }
  const clean = new URL('https://www.birdreport.cn/home/record/page.html');
  clean.searchParams.set('param', param);
  const sign = String(url.searchParams.get('sign') || '').trim();
  if (sign) clean.searchParams.set('sign', sign.slice(0, 80));
  return clean.toString();
}

function findBrowserExecutable() {
  const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  return candidates.find((item) => item && fs.existsSync(item)) || '';
}

function stopBrowser(child) {
  if (!child?.pid || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }).on('error', () => {});
    return;
  }
  child.kill();
}

async function assertNoRedirectFromRecordPage(pageUrl, fetchImpl = fetch) {
  if (typeof fetchImpl !== 'function') return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(pageUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    if (res?.body && typeof res.body.cancel === 'function') {
      res.body.cancel().catch(() => {});
    }
    if (res.status >= 300 && res.status < 400) {
      throw pageError('记录页返回了跳转，已拒绝打开', 400, 'BIRDREPORT_PAGE_REDIRECT');
    }
  } catch (error) {
    if (error?.code === 'BIRDREPORT_PAGE_REDIRECT') throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildBrowserArgs(pageUrl, userDataDir) {
  const hostRule = `MAP * ~NOTFOUND, ${ALLOWED_BROWSER_HOSTS.map((host) => `EXCLUDE ${host}`).join(', ')}`;
  return [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--disable-sync',
    `--host-resolver-rules=${hostRule}`,
    `--user-data-dir=${userDataDir}`,
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
    '--dump-dom',
    pageUrl,
  ];
}

function dumpPageHtml(pageUrl) {
  const browser = findBrowserExecutable();
  if (!browser) {
    throw pageError('本机没有找到 Edge 或 Chrome，暂时无法打开记录链接', 503, 'BIRDREPORT_BROWSER_MISSING');
  }
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbird-birdreport-'));
  return new Promise((resolve, reject) => {
    let settled = false;
    let html = '';
    const child = spawn(browser, buildBrowserArgs(pageUrl, userDataDir), { windowsHide: true });
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.rm(userDataDir, { recursive: true, force: true }, () => {});
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      stopBrowser(child);
      finish(pageError('打开记录页超时，请稍后再试', 504, 'BIRDREPORT_PAGE_TIMEOUT'));
    }, PAGE_TIMEOUT_MS);
    child.stderr.on('data', () => {});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (html.length >= MAX_HTML_CHARS) return;
      html += chunk;
      if (html.length > MAX_HTML_CHARS) html = html.slice(0, MAX_HTML_CHARS);
    });
    child.on('error', (error) => {
      finish(pageError(error.message || '无法启动浏览器', 503, 'BIRDREPORT_BROWSER_FAILED'));
    });
    child.on('close', () => {
      finish(null, html);
    });
  });
}

function parseBirdreportRecordHtml(html) {
  const source = String(html || '');
  const main = source.match(/layui-table-main[\s\S]*?<\/tbody>/i);
  const body = main ? main[0] : '';
  const rows = [...body.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const species = [];
  rows.forEach((row) => {
    const name = fieldText(row, 'taxon_name');
    const scientificName = fieldText(row, 'latinname');
    if (!name && !scientificName) return;
    species.push({
      code: fieldText(row, 'taxon_id'),
      name,
      scientificName,
      englishName: fieldText(row, 'englishname'),
      order: fieldText(row, 'taxonordername'),
      family: fieldText(row, 'taxonfamilyname'),
      recordCount: parseCount(fieldText(row, 'taxon_count')),
      outsideLocal: isOutsideLocalName(row),
    });
  });
  if (!species.length) {
    throw pageError('页面还没有加载出鸟种表，请确认链接是已公开的观鸟记录');
  }
  if (species.length > 5000) {
    throw pageError('这条记录的鸟种超过 5000 行');
  }
  const serial = spanText(source, 'serialid');
  const timeBegin = spanText(source, 'timebegin');
  const dateMatch = timeBegin.match(/^(\d{4}-\d{2}-\d{2})/);
  return {
    fileName: serial || '观鸟记录链接',
    locationLabel: spanText(source, 'pointname').slice(0, 120),
    tripDate: dateMatch ? dateMatch[1] : '',
    species,
  };
}

async function loadBirdreportRecord(rawUrl) {
  const pageUrl = assertBirdreportRecordUrl(rawUrl);
  if (activeLoads >= MAX_ACTIVE_LOADS) {
    throw pageError('已有链接正在读取，请稍候再试', 429, 'BIRDREPORT_PAGE_BUSY');
  }
  activeLoads += 1;
  try {
    await assertNoRedirectFromRecordPage(pageUrl);
    const html = await dumpPageHtml(pageUrl);
    return parseBirdreportRecordHtml(html);
  } finally {
    activeLoads = Math.max(0, activeLoads - 1);
  }
}

module.exports = {
  assertBirdreportRecordUrl,
  assertNoRedirectFromRecordPage,
  buildBrowserArgs,
  parseBirdreportRecordHtml,
  loadBirdreportRecord,
};
