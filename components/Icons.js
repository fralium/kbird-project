// 鸟类主题图标 - 简约线型，统一 stroke 与 viewBox
/* 细线图标 2px 统一线宽，配合湿地晨曦风格 */
const strokeProps = (color, w = 2) => ({ stroke: color, strokeWidth: w, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' });

// 鸟类图标 - 极简侧影（单线体+翼）
export const BirdIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M12 3c-3 0-5 2.5-5 6s2 6 5 6 5-2.5 5-6-2-6-5-6z" />
    <path d="M7 9c1 1 2.5 1.5 5 1.5s4-.5 5-1.5" />
  </svg>
);

// 简洁鸟类轮廓
export const SimpleBirdIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M12 5a4 4 0 0 0-4 4c0 2 1.5 3.5 4 5s4-3 4-5a4 4 0 0 0-4-4z" />
    <path d="M8 9h8" />
  </svg>
);

// 飞翔的鸟 - 单线抽象
export const FlyingBirdIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M4 12s2-3 8-3 8 3 8 3-2 3-8 3-8-3-8-3z" />
    <path d="M4 12h16" />
  </svg>
);

// 相机 - 线框
export const CameraIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <rect x="2" y="6" width="20" height="14" rx="2" />
    <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

// 位置 - 图钉
export const LocationIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M12 22s8-6 8-12a8 8 0 1 0-16 0c0 6 8 12 8 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

// 搜索 - 放大镜
export const SearchIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

// 添加 - 正圆加号
export const AddIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

// 编辑 - 笔
export const EditIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// 删除图标 - 简化设计
export const DeleteIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

// 心形图标 - 简化设计
export const HeartIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

// 星形图标 - 简化设计
export const StarIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
  </svg>
);

// 日历图标 - 简化设计
export const CalendarIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

// 用户图标 - 简化设计
export const UserIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// 眼睛图标 - 简化设计
export const EyeIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

// 信息图标 - 简化设计
export const InfoIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

// 警告图标 - 简化设计
export const WarningIcon = ({ size = 24, color = "#F59E0B" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// 成功图标 - 简化设计
export const SuccessIcon = ({ size = 24, color = "#219EBC" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22,4 12,14.01 9,11.01"/>
  </svg>
);

// 错误图标 - 简化设计
export const ErrorIcon = ({ size = 24, color = "#EF4444" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

// 奖杯 - 线型
export const TrophyIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M8 4H6a2 2 0 0 0-2 2v2h4V4z" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2h-4V4z" />
    <path d="M4 8v2a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V8H4z" />
    <path d="M4 20h16" />
    <path d="M12 12v8M8 20h8" />
    <path d="M12 4v2" />
  </svg>
);

// 地图 - 折线
export const MapIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M1 6v14l7-3 8 3 7-3V3l-7 3-8-3-7 3z" />
    <path d="M8 3v14M16 6v14" />
  </svg>
);

// 登出图标 - 简化设计
export const LogoutIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16,17 21,12 16,7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// 下拉箭头图标 - 简化设计
export const ChevronDownIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <polyline points="6,9 12,15 18,9"/>
  </svg>
);

// 左箭头图标
export const ChevronLeftIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
);

// 右箭头图标
export const ChevronRightIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <polyline points="9,18 15,12 9,6"/>
  </svg>
);

// 上箭头图标
export const ChevronUpIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <polyline points="18,15 12,9 6,15"/>
  </svg>
);

// 关闭图标
export const CloseIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// 菜单图标
export const MenuIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

// 书本/知识 - 线型
export const BookIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8M8 11h8" />
  </svg>
);

// 记录/文档 - 线型（单页带横线）
export const DocumentIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps(color)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 11h8M8 15h8M8 19h4" />
  </svg>
);

// 设置图标
export const SettingsIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// 地点类型图标 - 现代化设计
export const WetlandIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <path d="M8 12c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z"/>
  </svg>
);

export const LakeIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M3 12h18"/>
    <path d="M6 8h12"/>
    <path d="M9 6h6"/>
    <path d="M12 16h0"/>
    <path d="M9 18h6"/>
  </svg>
);

export const ForestIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M8 21l4-7 4 7"/>
    <path d="M12 3l1 7-1 7"/>
    <path d="M8 14l4-4 4 4"/>
  </svg>
);

export const MountainIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M8 21l4-7 4 7"/>
    <path d="M3 21h18"/>
    <path d="M8 21V9l4 4 4-4v12"/>
  </svg>
);

export const ParkIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M8 21l4-7 4 7"/>
    <path d="M12 3l1 7-1 7"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

export const CoastIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M3 12h18"/>
    <path d="M2 8h20"/>
    <path d="M4 16h16"/>
    <path d="M12 2v20"/>
  </svg>
);

export const RiverIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M2 12h20"/>
    <path d="M6 8h12"/>
    <path d="M8 16h8"/>
    <path d="M12 2v20"/>
  </svg>
);

export const CityIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M3 21h18"/>
    <path d="M5 21V7l8-4v18"/>
    <path d="M19 21V11l-6-4"/>
    <path d="M9 9v4"/>
    <path d="M15 9v4"/>
    <path d="M9 15v4"/>
    <path d="M15 15v4"/>
  </svg>
);

export const VillageIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M3 21h18"/>
    <path d="M5 21V7l8-4v18"/>
    <path d="M19 21V11l-6-4"/>
    <path d="M9 9v4"/>
    <path d="M15 9v4"/>
  </svg>
);

export const OtherIcon = ({ size = 24, color = "#6B7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 12h8"/>
    <path d="M12 8v8"/>
  </svg>
);

// 地点类型图标映射
export const getLocationTypeIcon = (type, size = 20, color = "#6B7280") => {
  const iconMap = {
    '湿地': WetlandIcon,
    '湖泊': LakeIcon,
    '森林': ForestIcon,
    '山区': MountainIcon,
    '公园': ParkIcon,
    '海岸': CoastIcon,
    '河流': RiverIcon,
    '城市': CityIcon,
    '乡村': VillageIcon,
    '自然保护区': ParkIcon,
    '其他': OtherIcon
  };
  
  const IconComponent = iconMap[type] || OtherIcon;
  return <IconComponent size={size} color={color} />;
};

// 特殊颜色变体 - 用于强调和状态
export const getColoredIcon = (IconComponent, color = "#6B7280", size = 24) => (
  <IconComponent size={size} color={color} />
);

// 主题颜色
export const colors = {
  primary: "#4F46E5",      // 靛蓝色
  secondary: "#6B7280",    // 灰色
  success: "#219EBC",      // 湖泊蓝
  warning: "#F59E0B",      // 橙色
  error: "#EF4444",        // 红色
  info: "#3B82F6",         // 蓝色
  muted: "#9CA3AF",        // 浅灰色
  accent: "#8B5CF6"        // 紫色
};