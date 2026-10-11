const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { getDataRoot } = require('../config/dataPaths');

function personalExploreDir() {
  return path.join(getDataRoot(), 'personal', 'exploreDemo');
}

function stubExploreDir() {
  return path.resolve(__dirname, '../../data/exploreDemo');
}

function safeDemoId(id) {
  return String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

async function importJs(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const mtime = fs.statSync(absPath).mtimeMs;
  const href = `${pathToFileURL(absPath).href}?t=${mtime}`;
  return import(href);
}

function resolveExploreFile(fileName) {
  const personal = path.join(personalExploreDir(), fileName);
  if (fs.existsSync(personal)) {
    return { path: personal, source: 'personal' };
  }
  const stub = path.join(stubExploreDir(), fileName);
  if (fs.existsSync(stub)) {
    return { path: stub, source: 'stub' };
  }
  return null;
}

async function loadProjectsModule() {
  const resolved = resolveExploreFile('projects.js');
  if (!resolved) {
    return { source: 'none', items: [] };
  }
  const mod = await importJs(resolved.path);
  const items =
    typeof mod.listExploreProjects === 'function'
      ? mod.listExploreProjects()
      : Array.isArray(mod.default)
        ? mod.default
        : [];
  return { source: resolved.source, items: Array.isArray(items) ? items : [] };
}

async function loadSpeciesOrders() {
  const resolved = resolveExploreFile('speciesOrders.js');
  if (!resolved) return { source: 'none', map: {} };
  const mod = await importJs(resolved.path);
  const map = mod.default || mod.speciesOrders || {};
  return { source: resolved.source, map: map && typeof map === 'object' ? map : {} };
}

async function loadDemoBundle(id) {
  const sid = safeDemoId(id);
  if (!sid) {
    return { ok: false, code: 'INVALID_ID', message: '无效的调查项目 id' };
  }

  const { source: projectsSource, items } = await loadProjectsModule();
  const project = items.find((p) => p && p.id === sid) || null;

  const demoResolved = resolveExploreFile(`${sid}.js`);
  if (!demoResolved) {
    return {
      ok: false,
      code: 'DEMO_NOT_FOUND',
      message: '找不到该调查项目的工作台数据',
      project,
      projectsSource,
    };
  }

  const demoMod = await importJs(demoResolved.path);
  const demo = demoMod.default || demoMod;
  const orders = await loadSpeciesOrders();

  return {
    ok: true,
    source: demoResolved.source,
    projectsSource,
    project:
      project ||
      (demo?.meta
        ? {
            id: sid,
            title: demo.meta.title || sid,
            version: demo.meta.version || '',
            regionShort: demo.meta.region || '',
            region: demo.meta.region || '',
            source: demo.meta.source || '',
            template: '地区调查模板',
            stats: {
              total: demo.metrics?.total || 0,
              recorded: demo.metrics?.withEvidence || demo.metrics?.selfConfirmed || 0,
              keyConfirmed: demo.metrics?.keyConfirmed || 0,
              keyTargets: demo.metrics?.keyTargets || 0,
              plotsFilled: `${(demo.plots || []).filter((p) => p?.['样区名称']).length}/${
                (demo.plots || []).length
              }`,
            },
          }
        : { id: sid, title: sid }),
    demo,
    speciesOrders: orders.map,
  };
}

module.exports = {
  personalExploreDir,
  loadProjectsModule,
  loadDemoBundle,
  loadSpeciesOrders,
  safeDemoId,
};
