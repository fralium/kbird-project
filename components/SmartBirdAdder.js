import { useState } from 'react';
import { SuccessIcon, colors } from './Icons';
import styles from '../styles/SmartBirdAdder.module.css';

export default function SmartBirdAdder({ onAddBirds, existingBirds = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [birdListText, setBirdListText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  // 解析鸟类列表文本
  const parseBirdList = (text) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const birds = [];
    
    console.log('原始数据行数:', lines.length);
    console.log('原始数据前10行:', lines.slice(0, 10));
    
    for (let i = 0; i < lines.length; i += 8) {
      if (i + 7 < lines.length) {
        try {
          console.log(`解析第${Math.floor(i/8) + 1}组数据 (行${i}-${i+7}):`);
          console.log(`  行${i}: "${lines[i]}" (序号)`);
          console.log(`  行${i+1}: "${lines[i+1]}" (系统编号)`);
          console.log(`  行${i+2}: "${lines[i+2]}" (中文名)`);
          console.log(`  行${i+3}: "${lines[i+3]}" (拉丁名)`);
          console.log(`  行${i+4}: "${lines[i+4]}" (英文名)`);
          console.log(`  行${i+5}: "${lines[i+5]}" (目)`);
          console.log(`  行${i+6}: "${lines[i+6]}" (科)`);
          console.log(`  行${i+7}: "${lines[i+7]}" (数量)`);
          
          const bird = {
            id: lines[i + 1].trim(), // 系统编号（4225, 4290...）
            chineseName: lines[i + 2].trim(), // 中文名（白胸苦恶鸟...）
            latinName: lines[i + 3].trim(), // 拉丁名（Amaurornis phoenicurus...）
            englishName: lines[i + 4].trim(), // 英文名
            order: lines[i + 5].trim(), // 目
            family: lines[i + 6].trim(), // 科
            count: parseInt(lines[i + 7].trim()) || 1, // 数量
            notes: `智能添加 - ${lines[i + 2].trim()} (${lines[i + 3].trim()})` // 使用中文名和拉丁名
          };
          
          console.log(`  解析结果:`, bird);
          
          // 检查是否已存在（比较bird对象的中文名）
          const exists = existingBirds.some(existing => {
            if (existing.bird && existing.bird.name) {
              return existing.bird.name === bird.chineseName || 
                     existing.bird.scientificName === bird.latinName;
            }
            return existing.chineseName === bird.chineseName || 
                   existing.latinName === bird.latinName;
          });
          
          birds.push({
            ...bird,
            exists: exists
          });
        } catch (error) {
          console.error('解析鸟类数据失败:', error);
        }
      }
    }
    
    return birds;
  };

  // 搜索匹配的鸟类
  const searchMatchingBird = async (chineseName, latinName) => {
    try {
      console.log('搜索鸟类:', { chineseName, latinName });
      
      // 优先用中文名搜索
      let searchQuery = chineseName;
      let response = await fetch(`/api/birds?search=${encodeURIComponent(searchQuery)}&limit=10`);
      let data = await response.json();
      
      console.log('中文名搜索结果:', data);
      
      if (data.success && data.data && data.data.length > 0) {
        // 找到精确匹配的中文名
        const exactMatch = data.data.find(bird => bird.name === chineseName);
        if (exactMatch) {
          console.log('找到精确匹配:', exactMatch);
          return exactMatch;
        }
        
        // 找到包含该中文名的鸟类（去掉空格进行匹配）
        const chineseNameNoSpace = chineseName.replace(/\s+/g, '');
        const partialMatch = data.data.find(bird => {
          const birdNameNoSpace = bird.name.replace(/\s+/g, '');
          return birdNameNoSpace.includes(chineseNameNoSpace) || chineseNameNoSpace.includes(birdNameNoSpace);
        });
        if (partialMatch) {
          console.log('找到部分匹配:', partialMatch);
          return partialMatch;
        }
      }
      
      // 如果中文名没找到，用拉丁名搜索
      searchQuery = latinName;
      response = await fetch(`/api/birds?search=${encodeURIComponent(searchQuery)}&limit=10`);
      data = await response.json();
      
      console.log('拉丁名搜索结果:', data);
      
      if (data.success && data.data && data.data.length > 0) {
        // 找到精确匹配的拉丁名
        const exactMatch = data.data.find(bird => bird.scientificName === latinName);
        if (exactMatch) {
          console.log('找到拉丁名精确匹配:', exactMatch);
          return exactMatch;
        }
        
        // 找到包含该拉丁名的鸟类
        const partialMatch = data.data.find(bird => 
          bird.scientificName.includes(latinName) || latinName.includes(bird.scientificName)
        );
        if (partialMatch) {
          console.log('找到拉丁名部分匹配:', partialMatch);
          return partialMatch;
        }
      }
      
      console.log('未找到匹配的鸟类');
      return null;
    } catch (error) {
      console.error('搜索鸟类失败:', error);
      return null;
    }
  };

  // 处理智能添加
  const handleSmartAdd = async () => {
    setIsProcessing(true);
    
    try {
      console.log('开始处理智能添加...');
      const parsedBirds = parseBirdList(birdListText);
      console.log('解析的鸟类数据:', parsedBirds);
      
      if (parsedBirds.length === 0) {
        setResult({
          success: false,
          message: '没有找到有效的鸟类数据'
        });
        return;
      }
      
      // 过滤出不重复的鸟类
      const newBirds = parsedBirds.filter(bird => !bird.exists);
      const duplicateBirds = parsedBirds.filter(bird => bird.exists);
      
      console.log('新鸟类:', newBirds.map(b => b.chineseName));
      console.log('重复鸟类:', duplicateBirds.map(b => b.chineseName));
      
      // 为每个新鸟类搜索匹配的数据库记录
      const processedBirds = [];
      const unmatchedBirds = [];
      
      for (const bird of newBirds) {
        console.log(`\n处理鸟类: ${bird.chineseName} (${bird.latinName})`);
        const matchedBird = await searchMatchingBird(bird.chineseName, bird.latinName);
        
        if (matchedBird) {
          console.log(`✅ 匹配成功: ${matchedBird.name}`);
          processedBirds.push({
            birdId: matchedBird._id,
            bird: matchedBird, // 完整的鸟类对象
            notes: `智能添加 - ${bird.chineseName} (${bird.latinName})`,
            images: [],
            count: bird.count,
            isMatched: true // 标记为已匹配
          });
        } else {
          console.log(`❌ 未找到匹配: ${bird.chineseName}`);
          unmatchedBirds.push({
            ...bird,
            birdId: null,
            notes: `智能添加 - ${bird.chineseName} (${bird.latinName})`,
            images: [],
            isMatched: false // 标记为未匹配
          });
        }
      }
      
      console.log('\n最终结果:');
      console.log('已匹配:', processedBirds.length);
      console.log('未匹配:', unmatchedBirds.length);
      console.log('重复:', duplicateBirds.length);
      
      setResult({
        success: true,
        matchedBirds: processedBirds,
        unmatchedBirds: unmatchedBirds,
        duplicateBirds: duplicateBirds,
        total: parsedBirds.length
      });
      
      // 如果有匹配或未匹配的鸟类，都添加到表单中
      const allBirdsToAdd = [...processedBirds, ...unmatchedBirds];
      if (allBirdsToAdd.length > 0) {
        onAddBirds(allBirdsToAdd);
      }
      
    } catch (error) {
      console.error('智能添加处理失败:', error);
      setResult({
        success: false,
        message: `处理失败: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    setBirdListText('');
    setResult(null);
    setIsOpen(false);
  };

  // 示例数据
  const exampleData = `1
4225
白胸苦恶鸟
Amaurornis phoenicurus
White-breasted Waterhen
鹤形目
秧鸡科
1
2
4290
夜鹭
Nycticorax nycticorax
Black-crowned Night-heron
鹈形目
鹭科
1`;

  return (
    <>
      <button 
        className={styles.smartAddButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.plusIcon}>+</span>
        智能添加鸟类
      </button>

      {isOpen && (
        <div className={styles.smartAddPanel}>
          <div className={styles.panelHeader}>
            <h3>智能添加鸟类</h3>
            <p>粘贴鸟类列表数据，系统将自动解析并添加到记录中</p>
          </div>

          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>
              鸟类数据列表（每8行一组）:
            </label>
            <textarea
              className={styles.birdListInput}
              value={birdListText}
              onChange={(e) => setBirdListText(e.target.value)}
              placeholder={`请粘贴鸟类数据，格式如下：
${exampleData}

每8行为一组鸟类数据：
1. 序号
2. 中文名
3. 拉丁名
4. 英文名
5. 目
6. 科
7. 数量
8. 备注（可选）`}
              rows={12}
            />
          </div>

          <div className={styles.actionButtons}>
            <button 
              className={styles.addButton}
              onClick={handleSmartAdd}
              disabled={isProcessing || !birdListText.trim()}
            >
              {isProcessing ? '处理中...' : '智能添加'}
            </button>
            <button 
              className={styles.resetButton}
              onClick={handleReset}
            >
              重置
            </button>
            <button 
              className={styles.closeButton}
              onClick={() => setIsOpen(false)}
            >
              关闭
            </button>
          </div>

          {result && (
            <div className={styles.resultPanel}>
              <h4>处理结果</h4>
              {result.success ? (
                <div className={styles.successResult}>
                  <div className={styles.resultStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>总计:</span>
                      <span className={styles.statValue}>{result.total}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>已匹配:</span>
                      <span className={styles.statValue}>{result.matchedBirds.length}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>未匹配:</span>
                      <span className={styles.statValue}>{result.unmatchedBirds.length}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>重复:</span>
                      <span className={styles.statValue}>{result.duplicateBirds.length}</span>
                    </div>
                  </div>

                  {result.matchedBirds.length > 0 && (
                    <div className={styles.matchedBirdsList}>
                      <h5>✅ 已匹配鸟类（已自动选择）:</h5>
                      <ul>
                        {result.matchedBirds.map((bird, index) => (
                          <li key={index}>
                            {bird.bird.name} ({bird.bird.scientificName})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.unmatchedBirds.length > 0 && (
                    <div className={styles.unmatchedBirdsList}>
                      <h5>⚠️ 未匹配鸟类（需要手动选择）:</h5>
                      <ul>
                        {result.unmatchedBirds.map((bird, index) => (
                          <li key={index}>
                            {bird.chineseName} ({bird.latinName})
                          </li>
                        ))}
                      </ul>
                      <p className={styles.unmatchedNote}>
                        这些鸟类在数据库中未找到匹配记录，请手动搜索选择正确的鸟类。
                      </p>
                    </div>
                  )}

                  {result.duplicateBirds.length > 0 && (
                    <div className={styles.duplicateBirdsList}>
                      <h5>重复鸟类（已跳过）:</h5>
                      <ul>
                        {result.duplicateBirds.map((bird, index) => (
                          <li key={index}>
                            {bird.chineseName} ({bird.latinName})
                          </li>
                        ))}
                      </ul>
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
        </div>
      )}
    </>
  );
}
