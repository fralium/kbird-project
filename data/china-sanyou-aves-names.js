const LIST = require('./china-sanyou-aves-2023.json');

function listSanyouAvesNames() {
  return (LIST.species || []).map((row) => String(row.name || '').trim()).filter(Boolean);
}

function listSanyouAvesSpecies() {
  return LIST.species || [];
}

module.exports = {
  listSanyouAvesNames,
  listSanyouAvesSpecies,
};
