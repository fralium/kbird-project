'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader, {
  HeaderPrimaryButton,
  HeaderTextLink,
} from '@/components/SimplePageHeader';
import styles from '@/styles/PersonalGuide.module.css';

const CATEGORIES = [
  { id: 'all', label: '全部功能' },
  { id: 'new', label: '✨ 近期新功能' },
  { id: 'record', label: '📝 野外记录与导图' },
  { id: 'taxonomy', label: '📖 图鉴与物种辨识' },
  { id: 'patch', label: '📍 自留地与空间物候' },
  { id: 'stats', label: '📊 统计、加新与分享' },
  { id: 'tools', label: '🤖 AI 与数据管理' },
];

const FEATURE_SECTIONS = [
  {
    id: 'record',
    title: '一、野外记录与智能照片归档',
    hint: '从一分钟极速勾选、文字草稿识别，到本地硬盘鸟照 EXIF 自动解析与按日成稿。',
    items: [
      {
        id: 'folder-photos-exif',
        title: '本地文件夹智能导入照片 & 按日生成记录草稿',
        isNew: true,
        badge: '近期重磅升级',
        menuPath: '我的 → 数据管理 → 导入照片',
        summary:
          '无需手动一张张上传！直接将硬盘上按「鸟种名」或「目/科/鸟种名」整理的文件夹扫入对应鸟种详情页，并自动提取拍摄元数据。',
        bullets: [
          '<strong>EXIF 真实快门与 GPS 解析</strong>：直接读取 JPEG/WebP 头部快门时间与经纬度，无 EXIF 时自动从文件名（如 2025-11-08）兜底提取日期。',
          '<strong>文件名智能识别标签与地点</strong>：文件名或目录含「雄、雌、亚成、幼鸟、繁殖羽、飞翔、取食」自动打上标签；同时自动匹配「地点词典」中的观鸟点名称或 6km 内最近坐标。',
          '<strong>顺手生成当日观察记录</strong>：扫描后自动按拍摄日期聚类当天拍到的全部鸟种，点击「一键生成观察记录草稿」即可带入日期、地点与鸟种清单跳转录入页。',
        ],
        tip: '窍门：推荐将本地照片按「红胁蓝尾鸲/20251108_圆明园_雄鸟_IMG001.jpg」命名，一次扫描即可同时完成相册归档与观察记录创建。',
        links: [
          { label: '前往导入照片', href: '/personal/manage?tab=photos', primary: true },
          { label: '浏览个人照片库', href: '/personal/photos' },
        ],
      },
      {
        id: 'behavior-tags',
        title: '观察记录：鸟种行为与状态微标签',
        isNew: true,
        badge: '新增功能',
        menuPath: '记一笔 → 快速记录 / 详细记录 / 记录详情',
        summary:
          '在记录鸟种数量之外，用轻量化胶囊标签记录当时的生态行为与发现方式，让每一次遇见更具博物学价值。',
        bullets: [
          '<strong>8 项高频野外微标签</strong>：支持多选「目击、听音、飞过、求偶、筑巢/携巢材、育雏/喂食、取食、集群」。',
          '<strong>全链路打通</strong>：在「快速记录」、「详细记录」与「记录详情编辑」中均可一键点选，并同步展示在出野报告物种表、鸟种详情页足迹流与博物手账卡中。',
        ],
        tip: '窍门：只闻其声未见其影的林鸟，直接点选「听音」，日后回顾物候时一目了然。',
        links: [
          { label: '去记一笔（详细）', href: '/records/add', primary: true },
          { label: '去快速记录', href: '/records/quick' },
        ],
      },
      {
        id: 'three-recording-modes',
        title: '三种「记一笔」工作流：快速 / 详细 / 文字草稿',
        isNew: false,
        badge: '核心常用',
        menuPath: '顶部导航 → 记一笔',
        summary:
          '针对野外实时速记、收队后完整复盘、以及从微信备忘录粘贴文本三种不同场景，提供最顺手的录入方式。',
        bullets: [
          '<strong>快速记录</strong>：极简表单，选定地点与日期后连续输入鸟名与数量，1 分钟内完成单次出野录入。',
          '<strong>详细记录</strong>：完整支持天气、温湿度、风力、eBird 标准观察努力量（起止时间、时长、距离、人数、完整清单）、生境实拍图与单鸟种多图上传。',
          '<strong>文字草稿</strong>：把野外随手记在手机备忘录或微信里的流水账粘贴进来，系统自动分词匹配中国鸟类名称并一键转为正式记录草稿。',
        ],
        tip: '窍门：不确定名字怎么写时，鸟种输入框支持中文模糊搜索、拉丁学名与拼音首字母匹配。',
        links: [
          { label: '快速记录', href: '/records/quick', primary: true },
          { label: '详细记录', href: '/records/add' },
          { label: '文字草稿识别', href: '/records/draft' },
        ],
      },
    ],
  },
  {
    id: 'taxonomy',
    title: '二、鸟类图鉴、物候热力条与相似种同屏对比',
    hint: '不仅是静态词典，更融合了你的个人观察物候与近缘种并排辨识工作台。',
    items: [
      {
        id: 'taxon-compare-workbench',
        title: '相似种同屏对比台 (Compare Workbench)',
        isNew: true,
        badge: '新增功能',
        menuPath: '观鸟档案 → 已见鸟种 / 任意鸟种详情页',
        summary:
          '面对柳莺、鹨、鸻鹬等脸盲类群，支持将 2～3 种鸟类放进同屏工作台，逐行比对关键鉴别特征与在当地出现的月份差异。',
        bullets: [
          '<strong>图鉴列表自由选种</strong>：在「已见鸟种」每张卡片右上角点击「+对比」，页面底部自动浮出对比托盘。',
          '<strong>详情页一键关联相似种</strong>：在任意鸟种详情页顶部点击「相似种对比」，系统自动解析该鸟种「相似种」字段中提及的物种（或同科物种）直接打开对比台。',
          '<strong>11 维同屏比对</strong>：并排展示代表照、1–12月个人物候条、分类学、保护级别、鉴别要点、羽色、体型/喙/脚、栖息地、迁徙习性与鸣声试听。',
        ],
        tip: '窍门：对比台内置了紧凑版 1–12 月物候条，很多外观极像的迁徙鸟在当地过境月份不同，结合物候更容易排除混淆种。',
        links: [
          { label: '前往已见鸟种体验对比', href: '/birds', primary: true },
          { label: '查阅全鸟种名录', href: '/birds/catalog' },
        ],
      },
      {
        id: 'phenology-month-bar',
        title: '1–12 月个人物候频次热力条',
        isNew: true,
        badge: '新增功能',
        menuPath: '观鸟档案 → 已见鸟种 → 点击任意鸟种详情页',
        summary:
          '在每个鸟种详情页自动汇总你历年 1–12 月的观察与拍摄记录，生成专属你自己的本地物候图谱。',
        bullets: [
          '<strong>居留型与高峰月推导</strong>：综合你的实际观察月份与物种迁徙习性，自动标注「留鸟 / 夏候鸟 / 冬候鸟 / 旅鸟」徽章与活跃月份数。',
          '<strong>月度明细下钻</strong>：点击热力条上任意有记录的月份，即可查看该月累计观察次数、跨年分布、最常遇见的观鸟点以及当月记录到的行为标签。',
          '<strong>双视图无缝适配</strong>：无论你偏好「手账双页视图」还是「经典页签视图」，均内置了物候热力条。',
        ],
        tip: '窍门：在鸟种详情页右上角可随时切换「手账双页 / 经典页签」两种排版风格。',
        links: [
          { label: '打开已见鸟种图鉴', href: '/birds', primary: true },
        ],
      },
      {
        id: 'catalog-and-regions',
        title: '中国鸟类全名录、各地鸟种与 PDF 图鉴导出',
        isNew: false,
        badge: '核心常用',
        menuPath: '数据库 → 鸟种名录 / 各地鸟种',
        summary:
          '内置中国鸟类分类名录，支持多维筛选、地区分布检索、xeno-canto 鸣声在线试听，以及将个人已见鸟种导出为排版精美的 PDF 图鉴。',
        bullets: [
          '<strong>多维折叠筛选</strong>：支持按目、科、国家保护级别、IUCN 濒危等级、居留型、翼型与体色快速筛选。',
          '<strong>各地鸟种与省份点亮</strong>：按行政区划查看各省市分布鸟种，结合你的观察记录点亮全国观鸟版图。',
          '<strong>PDF 个人图鉴导出</strong>：在「已见鸟种」页面支持一键将你拍到或见过的鸟种编译导出为带目录与封面的 PDF 册子。',
        ],
        tip: '窍门：在「已见鸟种」右上角可切换「野外卡片」与「剪贴画报」两种卡片视觉风格。',
        links: [
          { label: '鸟种名录', href: '/birds/catalog', primary: true },
          { label: '各地鸟种分布', href: '/birds/regions' },
        ],
      },
    ],
  },
  {
    id: 'patch',
    title: '三、自留地 (Patch) 监测、地点词典与跨年物候',
    hint: '深耕身边常去的公园、湿地与校园，追踪每一年的物种更替与候鸟早晚到访变化。',
    items: [
      {
        id: 'patch-phenology-retention',
        title: '自留地：跨年物候对比、场地加新与常客留存率',
        isNew: true,
        badge: '新增功能',
        menuPath: '数据库 → 地点词典 → 点击任意地点详情页',
        summary:
          '将单一的「地点鸟历」升级为跨年度的生态监测面板，量化你在同一个观鸟点多年的观察积累。',
        bullets: [
          '<strong>年度监测总览卡片</strong>：按年份统计在该地点的出野天数、记录鸟种数、当年<strong>场地首见加新种 (+N 种)</strong>，以及上年鸟种在今年再次见到的<strong>常客留存率 (%)</strong>。',
          '<strong>跨年首见物候偏差表</strong>：针对跨多年出现的驻地常客，自动比对最近一年首见日期 (MM-DD) 与往年平均首见日，直观标出「<strong>早到 X 天</strong> / <strong>晚到 X 天</strong> / 与往年持平」。',
          '<strong>1–12月本场活跃点阵</strong>：每行物种附带 1–12 月本场活跃格，一眼看清哪些是全年驻留种、哪些是春秋窄窗过境种。',
        ],
        tip: '窍门：在地点详情页「自留地鸟历与物候监测」标题右侧，可一键切换「1–12月鸟历」与「跨年物候与留存」两个视图。',
        links: [
          { label: '进入地点词典', href: '/locations', primary: true },
          { label: '查看自留地样方', href: '/records/plots' },
        ],
      },
      {
        id: 'locations-and-plots',
        title: '地点词典、地图坐标校准与生境实拍墙',
        isNew: false,
        badge: '核心常用',
        menuPath: '数据库 → 地点词典 / 观鸟档案 → 自留地',
        summary:
          '集中管理你去过的每一个观鸟点（湿地、森林公园、海岸、水库、高校等），沉淀地点专属的生境影像与历史名录。',
        bullets: [
          '<strong>经纬度与行政区划管理</strong>：支持地图选点或坐标录入，历史记录若缺失坐标可一键「从地点词典同步坐标」。',
          '<strong>生境照片墙 (Habitat Gallery)</strong>：为每个地点上传四季生境照片，记录水位涨落、植被演替或滩涂变化。',
          '<strong>地点累计名录</strong>：自动汇总在该地点见过的全部鸟种、目科分布、最高单次数量与历次观察记录时间线。',
        ],
        tip: '窍门：先把常去的公园加入「地点词典」，后续无论是「记一笔」还是「导入照片」都能自动匹配该地点。',
        links: [
          { label: '管理地点词典', href: '/locations', primary: true },
          { label: '自留地概览', href: '/records/plots' },
        ],
      },
    ],
  },
  {
    id: 'stats',
    title: '四、博物手账分享、加新之旅与多维统计',
    hint: '把枯燥的名单变成值得珍藏的博物手账海报、生涯加新里程碑与可视化图表。',
    items: [
      {
        id: 'outing-journal-card',
        title: '观察记录：生成「野外博物手账卡」与文字战报',
        isNew: true,
        badge: '新增功能',
        menuPath: '观鸟档案 → 观察记录 → 点击任意记录详情 → 生成手账卡',
        summary:
          '每次观鸟归来，在记录详情页顶部点击「生成手账卡」，即可将当次行程排版成一张精美的博物志风格长图或群聊战报。',
        bullets: [
          '<strong>双主题纸张风格</strong>：内置「宣纸米白」与「深林墨绿」两套博物手账配色，适配白昼林间与夜观/水鸟不同氛围。',
          '<strong>高信息密度排版</strong>：自动整合日期星期、地点天气、观察努力量、四大核心指标（鸟种/个体/科数/重点保护种）、国家一二级保护鸟种高亮徽章、实拍代表照、带行为微标签的物种名录与野外手记。',
          '<strong>一键导出 PNG 与复制文字战报</strong>：支持 2x 超清分辨率 PNG 本地下载，或一键复制带 Emoji 排版的纯文字战报直接发到鸟友微信群。',
        ],
        tip: '窍门：如果给当次记录或对应鸟种上传了照片，手账卡会自动挑选前 4 张代表作拼入画框。',
        links: [
          { label: '前往观察记录列表体验', href: '/records', primary: true },
        ],
      },
      {
        id: 'goals-and-stats',
        title: '加新之旅 (Life List)、个人统计与 3D 探索实验场',
        isNew: false,
        badge: '核心常用',
        menuPath: '观鸟档案 → 加新之旅 / 我的 → 个人统计 / 探索 Demo',
        summary:
          '全方位追踪你的观鸟生涯进度，从第一只首见鸟种到年度目标达成，并提供酷炫的 3D 视觉化回顾。',
        bullets: [
          '<strong>加新之旅</strong>：自动计算生涯首见（Lifer）时间轴、年度加新曲线，并支持设定年度目标种数与心愿目标鸟种。',
          '<strong>个人统计看板</strong>：涵盖月度出野频次、目/科覆盖度、最常去地点、高频遇见鸟种以及中国省份点亮热力图。',
          '<strong>探索 Demo (3D 可视化)</strong>：包含 3D 照片星系（PhotoGalaxy3D）与 3D 地球足迹轨道（FootprintOrbit3D），用沉浸视角重温你的观鸟足迹。',
        ],
        tip: '窍门：在「我的 → 个人设置」中还可以切换全局界面主题风格。',
        links: [
          { label: '加新之旅', href: '/personal/goals', primary: true },
          { label: '个人统计', href: '/personal/stats' },
          { label: '探索 Demo', href: '/personal/projects' },
        ],
      },
    ],
  },
  {
    id: 'tools',
    title: '五、AI 观鸟助手、知识便签与数据备份安全',
    hint: '100% 本地数据自主可控，支持标准格式互通、整库一键备份与 AI 辅助检索。',
    items: [
      {
        id: 'data-import-export-backup',
        title: '多源数据导入、标准导出、整库备份与年度报告',
        isNew: false,
        badge: '数据安全',
        menuPath: '我的 → 数据管理',
        summary:
          '你的数据完全保存在本机。支持与国内外主流观鸟平台表格双向互通，并提供换机无忧的整库打包备份。',
        bullets: [
          '<strong>导入记录</strong>：支持从中国观鸟记录中心 (CBRC) Excel/CSV、eBird CSV 或 JSON 文件批量导入历史记录。',
          '<strong>导出记录与报告</strong>：按年份导出 CBRC / eBird 标准表格，或一键生成你的年度/月度观鸟摘要报告。',
          '<strong>整库备份与恢复</strong>：一键打包导出全量数据库与上传图片，换电脑或重装系统时可完整还原。',
        ],
        tip: '窍门：建议每季度在「我的 → 数据管理 → 备份数据」中下载一份整库备份包留存。',
        links: [
          { label: '打开数据管理中心', href: '/personal/manage', primary: true },
          { label: '个人设置与环境配置', href: '/personal/settings' },
        ],
      },
      {
        id: 'ai-knowledge-notepad',
        title: '观鸟 AI 助手、鸟类知识库、我的便签与全局搜索',
        isNew: false,
        badge: '效率工具',
        menuPath: '顶部导航 → 观鸟助手 / 搜索 / 数据库 → 鸟类知识 / 我的 → 我的便签',
        summary:
          '把野外辨识百科、AI 问答助手与个人随手便签结合在一起，随时解答观鸟疑惑。',
        bullets: [
          '<strong>观鸟助手 (AI)</strong>：配置大模型 API Key 后，可自然语言询问相似种区分技巧、季节性观鸟推荐或检索个人记录。',
          '<strong>鸟类知识与我的便签</strong>：整理分类学常识、野外辨识专题文章，并在「我的便签」中随手记录待去的鸟点或装备清单。',
          '<strong>全局搜索</strong>：一个搜索框同时检索鸟种、观察记录、观鸟地点与知识库内容。',
        ],
        tip: '窍门：可在「我的 → 个人设置 → 服务配置」中配置地图 Key 与 AI 模型参数。',
        links: [
          { label: '观鸟 AI 助手', href: '/ai', primary: true },
          { label: '鸟类知识库', href: '/knowledge' },
          { label: '我的便签', href: '/personal/notepad' },
          { label: '全局搜索', href: '/search' },
        ],
      },
    ],
  },
];

const FAQ_LIST = [
  {
    q: '1. 我电脑里存了几年按鸟名分类的照片，怎么最快导入 KBird？',
    a: '前往「我的 → 数据管理 → 导入照片」，填入你存放照片的根目录（支持「鸟种名」单层目录或「目/科/鸟种名」三层目录）。点击「扫描并核对」，系统会自动读取照片 EXIF 快门日期与 GPS、识别文件名里的「雄/雌/亚成/飞翔」等标签，并在底部按日期汇总「顺手生成当日观察记录」，一键即可既入库相册又生成观鸟记录。',
  },
  {
    q: '2. 野外遇到柳莺、鹨或鸻鹬分不清，怎么在软件里对比？',
    a: '有两种方式：① 在「已见鸟种」列表卡片右上角点「+对比」（最多选 3 种），点底部浮出的「开始同屏对比」；② 直接进任意一种鸟的详情页，点击顶部的「相似种对比」按钮，系统会自动把它常被混淆的相似种拉入同屏对比台，并排对比鉴别特征与 1–12 月出现月份。',
  },
  {
    q: '3. 怎么看我常去的公园（自留地）今年候鸟比往年早到了还是晚到了？',
    a: '打开「数据库 → 地点词典」，点击你常去的观鸟点进入详情页。在「自留地鸟历与物候监测」区块右上角切换到「跨年物候与留存」页签，即可查看每年的常客留存率、场地加新种数，以及每个跨年常客今年首见日相比往年平均首见日是「早到 X 天」还是「晚到 X 天」。',
  },
  {
    q: '4. 每次观鸟回来怎么发朋友圈或鸟友群战报？',
    a: '进入该次「观察记录」详情页，点击右上角的「生成手账卡」按钮。你可以在「宣纸米白」与「深林墨绿」两种风格间切换，点击「保存高清手账长图 (PNG)」即可下载 2x 超清海报；或者点击「复制文字战报」直接粘贴到微信群。',
  },
];

export default function PersonalGuidePage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [keyword, setKeyword] = useState('');

  const filteredSections = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    return FEATURE_SECTIONS.map((section) => {
      const matchedItems = section.items.filter((item) => {
        if (activeCategory === 'new' && !item.isNew) return false;
        if (
          activeCategory !== 'all' &&
          activeCategory !== 'new' &&
          section.id !== activeCategory
        ) {
          return false;
        }
        if (!kw) return true;
        const haystack = [
          item.title,
          item.menuPath,
          item.summary,
          item.tip,
          ...(item.bullets || []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(kw);
      });

      return {
        ...section,
        items: matchedItems,
      };
    }).filter((section) => section.items.length > 0);
  }, [activeCategory, keyword]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          category="使用手册与功能全景 · User Guide"
          title="KBird 软件功能指南"
          description="欢迎使用 KBird 个人本地观鸟笔记本！本页面汇总了从历代核心功能到最新上线的 EXIF 智能导图、1–12月物候热力条、相似种同屏对比台、自留地跨年物候监测与野外博物手账卡等全部特性。"
          actions={
            <>
              <HeaderPrimaryButton href="/records/add">立即记一笔</HeaderPrimaryButton>
              <HeaderTextLink href="/personal/manage?tab=photos">导入本地照片</HeaderTextLink>
            </>
          }
        />

        {/* 新手 3 步快速上手 */}
        <section className={styles.quickStartBanner} aria-label="新用户三步快速上手">
          <div className={styles.quickStartHead}>
            <h2 className={styles.quickStartTitle}>🚀 新用户 3 步快速上手</h2>
            <p className={styles.quickStartSub}>
              无论你是刚入坑的观鸟新手，还是手里有上万张老照片的资深鸟友，都可以按以下三步开启你的个人博物志：
            </p>
          </div>
          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepBadgeRow}>
                <span className={styles.stepNumber}>1</span>
                <h3 className={styles.stepTitle}>收拢你的第一批观鸟数据</h3>
              </div>
              <p className={styles.stepDesc}>
                如果你硬盘里有按鸟名分好文件夹的照片，直接用「导入照片」自动提取 EXIF 日期并生成观察草稿；如果有 CBRC/eBird 表格可一键导入；或者直接点「记一笔」手工录入。
              </p>
              <div className={styles.stepLinks}>
                <Link href="/personal/manage?tab=photos" className={styles.stepLink}>
                  本地照片智能导入 →
                </Link>
                <Link href="/personal/manage?tab=import" className={styles.stepLink}>
                  导入表格记录 →
                </Link>
                <Link href="/records/quick" className={styles.stepLink}>
                  快速记一笔 →
                </Link>
              </div>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepBadgeRow}>
                <span className={styles.stepNumber}>2</span>
                <h3 className={styles.stepTitle}>点亮个人图鉴与对比辨识</h3>
              </div>
              <p className={styles.stepDesc}>
                进入「已见鸟种」查看你点亮的物种图鉴。点进详情页查看专属「1–12月物候频次热力条」，遇到容易混淆的近缘种时，开启「相似种同屏对比台」并排核对特征。
              </p>
              <div className={styles.stepLinks}>
                <Link href="/birds" className={styles.stepLink}>
                  浏览已见鸟种 →
                </Link>
                <Link href="/birds/catalog" className={styles.stepLink}>
                  查阅中国鸟种名录 →
                </Link>
              </div>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepBadgeRow}>
                <span className={styles.stepNumber}>3</span>
                <h3 className={styles.stepTitle}>深耕自留地与分享博物手账</h3>
              </div>
              <p className={styles.stepDesc}>
                在「地点词典」查看常去公园的「月度鸟历」与「跨年物候早晚到访对比」；在任意观察记录详情页点击「生成手账卡」，一键导出 2x 高清博物手账长图 (PNG)。
              </p>
              <div className={styles.stepLinks}>
                <Link href="/locations" className={styles.stepLink}>
                  地点词典与跨年物候 →
                </Link>
                <Link href="/records" className={styles.stepLink}>
                  观察记录生成手账卡 →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 分类筛选与关键词搜索 */}
        <div className={styles.filterToolbar} role="region" aria-label="功能筛选与检索">
          <div className={styles.categoryTabs} role="tablist">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.id}
                className={`${styles.categoryTab} ${
                  activeCategory === cat.id ? styles.categoryTabActive : ''
                }`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className={styles.searchWrap}>
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索功能关键词（如：EXIF、对比、物候、手账、备份）…"
              className={styles.searchInput}
              aria-label="搜索功能说明"
            />
          </div>
        </div>

        {/* 功能全景列表 */}
        {filteredSections.length === 0 ? (
          <div className={styles.emptyResult}>
            <p>未找到匹配「{keyword}」的功能说明，请尝试切换上方分类或清空搜索词。</p>
          </div>
        ) : (
          filteredSections.map((section) => (
            <section key={section.id} className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <p className={styles.sectionHint}>{section.hint}</p>
              </div>

              <div className={styles.featureGrid}>
                {section.items.map((item) => (
                  <article
                    key={item.id}
                    className={`${styles.featureCard} ${
                      item.isNew ? styles.featureCardNew : ''
                    }`}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleGroup}>
                        <div className={styles.cardTitleRow}>
                          <h3 className={styles.cardTitle}>{item.title}</h3>
                          <span className={item.isNew ? styles.badgeNew : styles.badgeCore}>
                            {item.badge}
                          </span>
                        </div>
                        <span className={styles.cardPathHint}>📍 菜单位置：{item.menuPath}</span>
                      </div>
                    </div>

                    <p className={styles.cardSummary}>{item.summary}</p>

                    <ul className={styles.bulletList}>
                      {item.bullets.map((html, idx) => (
                        <li
                          key={idx}
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                      ))}
                    </ul>

                    {item.tip ? <div className={styles.tipBox}>💡 {item.tip}</div> : null}

                    {Array.isArray(item.links) && item.links.length > 0 ? (
                      <div className={styles.cardActions}>
                        {item.links.map((lnk, idx) => (
                          <Link
                            key={idx}
                            href={lnk.href}
                            className={lnk.primary ? styles.primaryLink : styles.secondaryLink}
                          >
                            {lnk.label} →
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))
        )}

        {/* 常见问题 FAQ */}
        <section className={styles.faqSection} aria-label="常见问题解答">
          <h2 className={styles.faqTitle}>❓ 常见问题与实用技巧 (FAQ)</h2>
          <div className={styles.faqGrid}>
            {FAQ_LIST.map((item, idx) => (
              <div key={idx} className={styles.faqItem}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
