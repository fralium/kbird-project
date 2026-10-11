import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { api } from '@/utils/api';
import RequestNewBirdButton from './RequestNewBirdButton';
import styles from '@/styles/SmartBirdAdder.module.css';

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

// 与 SmartBirdAdder 相同的鸟类匹配逻辑
async function searchMatchingBird(chineseName, latinName) {
  try {
    let searchQuery = chineseName;
    let data = await api.birds.getAll({ search: searchQuery, limit: '10' });

    if (data.success && data.data && data.data.length > 0) {
      const exactMatch = data.data.find(bird => bird.name === chineseName);
      if (exactMatch) return exactMatch;
      const chineseNameNoSpace = (chineseName || '').replace(/\s+/g, '');
      const partialMatch = data.data.find(bird => {
        const birdNameNoSpace = (bird.name || '').replace(/\s+/g, '');
        return birdNameNoSpace.includes(chineseNameNoSpace) || chineseNameNoSpace.includes(birdNameNoSpace);
      });
      if (partialMatch) return partialMatch;
    }

    searchQuery = latinName;
    data = await api.birds.getAll({ search: searchQuery, limit: '10' });

    if (data.success && data.data && data.data.length > 0) {
      const exactMatch = data.data.find(bird => bird.scientificName === latinName);
      if (exactMatch) return exactMatch;
      const partialMatch = data.data.find(bird =>
        (bird.scientificName || '').includes(latinName) || (latinName || '').includes(bird.scientificName || '')
      );
      if (partialMatch) return partialMatch;
    }

    return null;
  } catch (error) {
    console.error('搜索鸟类失败:', error);
    return null;
  }
}

// 解析 i中国鸟类记录中心 Excel：列 鸟种编号、中文名、拉丁名、英文名、目、科、数量
function parseExcelRows(rows) {
  if (!rows || rows.length === 0) return [];
  const birds = [];
  let dataStart = 0;
  let colId = 0, colCn = 1, colLatin = 2, colEn = 3, colOrder = 4, colFamily = 5, colCount = 6;

  const first = rows[0] || [];
  const hasHeader = first.some(c => {
    const s = String(c || '').trim();
    return s === '中文名' || s === '鸟种编号' || s === '拉丁名' || s.includes('中文名') || s.includes('拉丁名');
  });
  if (hasHeader) {
    const header = rows[0].map(c => String(c || '').trim());
    colId = header.findIndex(h => /鸟种编号|编号|id/i.test(h));
    if (colId < 0) colId = 0;
    colCn = header.findIndex(h => /中文名|中文/i.test(h));
    if (colCn < 0) colCn = 1;
    colLatin = header.findIndex(h => /拉丁名|拉丁|学名/i.test(h));
    if (colLatin < 0) colLatin = 2;
    colEn = header.findIndex(h => /英文名|英文/i.test(h));
    if (colEn < 0) colEn = 3;
    colOrder = header.findIndex(h => /^目$/i.test(h));
    if (colOrder < 0) colOrder = 4;
    colFamily = header.findIndex(h => /^科$/i.test(h));
    if (colFamily < 0) colFamily = 5;
    colCount = header.findIndex(h => /数量/i.test(h));
    if (colCount < 0) colCount = 6;
    dataStart = 1;
  }

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || [];
    const chineseName = String(row[colCn] ?? row[1] ?? '').trim();
    const latinName = String(row[colLatin] ?? row[2] ?? '').trim();
    if (!chineseName && !latinName) continue;

    birds.push({
      id: String(row[colId] ?? row[0] ?? '').trim(),
      chineseName,
      latinName: latinName || '',
      englishName: String(row[colEn] ?? row[3] ?? '').trim(),
      order: String(row[colOrder] ?? row[4] ?? '').trim(),
      family: String(row[colFamily] ?? row[5] ?? '').trim(),
      count: parseInt(row[colCount] ?? row[6], 10) || 1,
    });
  }
  return birds;
}

export default function ImportBirdAdder({ onAddBirds, existingBirds = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);
    setIsProcessing(true);

    try {
      if (file.size <= 0) {
        throw new Error('文件为空');
      }
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        throw new Error(`文件过大，最大支持 ${Math.floor(MAX_IMPORT_FILE_SIZE / (1024 * 1024))}MB`);
      }

      const lowerName = file.name.toLowerCase();
      let rows = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await readFileAsText(file);
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        if (parsed.errors?.length) {
          throw new Error(`CSV 解析失败：${parsed.errors[0].message}`);
        }
        rows = (parsed.data || []).map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []));
      } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm')) {
        const exceljsMod = await import('exceljs');
        const ExcelJS = exceljsMod.default || exceljsMod;
        const workbook = new ExcelJS.Workbook();
        const data = await readFileAsArrayBuffer(file);
        await workbook.xlsx.load(data);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
          throw new Error('工作簿中没有可用工作表');
        }
        sheet.eachRow({ includeEmpty: false }, (row) => {
          rows.push([
            String(row.getCell(1).value ?? '').trim(),
            String(row.getCell(2).value ?? '').trim(),
            String(row.getCell(3).value ?? '').trim(),
            String(row.getCell(4).value ?? '').trim(),
            String(row.getCell(5).value ?? '').trim(),
            String(row.getCell(6).value ?? '').trim(),
            String(row.getCell(7).value ?? '').trim(),
          ]);
        });
      } else {
        throw new Error('仅支持 Excel（.xlsx/.xlsm）或 CSV 文件');
      }

      if (rows.length > MAX_IMPORT_ROWS) {
        throw new Error(`行数过多(${rows.length})，最多支持 ${MAX_IMPORT_ROWS} 行`);
      }

      const headerRow = (rows[0] || []).map((c) => String(c || '').trim());
      const isReportExport =
        headerRow.some((h) => /报告编号/.test(h)) &&
        headerRow.some((h) => /观测开始|观察开始/.test(h));
      if (isReportExport) {
        setResult({
          success: false,
          message:
            '该文件是中国鸟类记录中心「报告」导出表（一场多鸟、多行）。请打开「个人中心 → 数据导入」，在「报告导出表」处上传同一文件；此处仅支持「鸟种清单」式表格（列：鸟种编号、中文名、拉丁名等）。',
        });
        return;
      }
      const parsedBirds = parseExcelRows(rows);

      if (parsedBirds.length === 0) {
        setResult({ success: false, message: '未解析到有效鸟类数据，请确认文件格式（列：鸟种编号、中文名、拉丁名、英文名、目、科、数量）' });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const isExisting = (bird) => existingBirds.some(existing => {
        if (existing.bird?.name) return existing.bird.name === bird.chineseName || existing.bird.scientificName === bird.latinName;
        return existing.chineseName === bird.chineseName || existing.latinName === bird.latinName;
      });
      const newBirds = parsedBirds.filter(bird => !isExisting(bird));
      const duplicateBirds = parsedBirds.filter(bird => isExisting(bird));

      const processedBirds = [];
      const unmatchedBirds = [];

      for (const bird of newBirds) {
        const matchedBird = await searchMatchingBird(bird.chineseName, bird.latinName);
        if (matchedBird) {
          processedBirds.push({
            birdId: matchedBird._id,
            bird: matchedBird,
            notes: `导入 - ${bird.chineseName} (${bird.latinName})`,
            images: [],
            count: bird.count,
            isMatched: true,
          });
        } else {
          unmatchedBirds.push({
            ...bird,
            birdId: null,
            notes: `导入 - ${bird.chineseName} (${bird.latinName})`,
            images: [],
            count: bird.count,
            isMatched: false,
          });
        }
      }

      setResult({
        success: true,
        total: parsedBirds.length,
        matchedBirds: processedBirds,
        unmatchedBirds,
        duplicateBirds,
      });

      if (processedBirds.length > 0) {
        onAddBirds(processedBirds);
      }
    } catch (err) {
      console.error('导入失败:', err);
      setResult({ success: false, message: err.message || '文件解析失败，请确认为 Excel（.xlsx/.xlsm）或 CSV 格式' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [isOpen]);

  return (
    <div className={styles.importWrapper}>
      <button
        type="button"
        className={styles.importButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        Excel 导入
      </button>

      {isOpen && (
        <>
          <div
            className={styles.importOverlay}
            onClick={handleClose}
            onKeyDown={(e) => e.key === 'Escape' && handleClose()}
            role="button"
            tabIndex={0}
            aria-label="关闭"
          />
          <div className={styles.importPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.panelHeader}>
              <h3>Excel 导入鸟类</h3>
              <p>支持 i中国鸟类记录中心 导出的 Excel（.xlsx / .xlsm）或 CSV，列：鸟种编号、中文名、拉丁名、英文名、目、科、数量。导入后请在下方填写本记录的地点与时间。</p>
            </div>

            <div className={styles.scrollBody}>
              <div className={styles.inputSection}>
                <label className={styles.inputLabel}>选择文件</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.csv"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  disabled={isProcessing}
                />
                {fileName && <p className={styles.fileName}>已选：{fileName}</p>}
              </div>

              {result && (
            <div className={styles.resultPanel}>
              <h4>导入结果</h4>
              {result.success ? (
                <div className={styles.successResult}>
                  <div className={styles.resultStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>总计</span>
                      <span className={styles.statValue}>{result.total}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>已匹配</span>
                      <span className={styles.statValue}>{result.matchedBirds.length}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>未匹配</span>
                      <span className={styles.statValue}>{result.unmatchedBirds.length}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>重复跳过</span>
                      <span className={styles.statValue}>{result.duplicateBirds.length}</span>
                    </div>
                  </div>
                  {result.matchedBirds.length > 0 && (
                    <div className={styles.matchedBirdsList}>
                      <h5>✅ 已匹配（已加入列表）</h5>
                      <ul>
                        {result.matchedBirds.slice(0, 10).map((bird, i) => (
                          <li key={i}>{bird.bird?.name} ({bird.bird?.scientificName})</li>
                        ))}
                        {result.matchedBirds.length > 10 && <li>…共 {result.matchedBirds.length} 种</li>}
                      </ul>
                    </div>
                  )}
                  {result.unmatchedBirds.length > 0 && (
                    <div className={styles.unmatchedBirdsList}>
                      <h5>⚠️ 未匹配（可申请入库）</h5>
                      <ul>
                        {result.unmatchedBirds.map((bird, i) => (
                          <li key={i} className={styles.unmatchedRow}>
                            <span>
                              {bird.chineseName}
                              {bird.latinName ? ` (${bird.latinName})` : ''}
                            </span>
                            <RequestNewBirdButton
                              name={bird.chineseName}
                              scientificName={bird.latinName}
                              compact
                              className={styles.requestLink}
                              onCreated={(createdBird) => {
                                const row = {
                                  birdId: createdBird._id,
                                  bird: createdBird,
                                  notes: `导入 - ${bird.chineseName}${bird.latinName ? ` (${bird.latinName})` : ''}`,
                                  images: [],
                                  count: bird.count || 1,
                                  isMatched: true,
                                };
                                onAddBirds([row]);
                                setResult((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    unmatchedBirds: (prev.unmatchedBirds || []).filter(
                                      (item) => item.chineseName !== bird.chineseName
                                    ),
                                    matchedBirds: [...(prev.matchedBirds || []), row],
                                  };
                                });
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                      <p className={styles.unmatchedNote}>
                        库中暂无的种可申请入库，成功后会自动加入本记录。
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.errorResult}>
                  <p>{result.message}</p>
                </div>
              )}
            </div>
          )}

              {isProcessing && (
                <div className={styles.resultPanel}>
                  <p>正在解析并匹配鸟类…</p>
                </div>
              )}
            </div>

            <div className={styles.actionButtons}>
              <button type="button" className={styles.closeButton} onClick={handleClose}>
                关闭
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
