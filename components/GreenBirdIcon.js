// 绿色鸟类图标组件
export const GreenBirdIcon = ({ size = 24, className = "", style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="#219EBC"
    className={className}
    style={style}
  >
    <path d="M12 2C8.5 2 5.73 4.11 5.18 7h3.64c.45-1.25 1.63-2 3.18-2s2.73.75 3.18 2h3.64C18.27 4.11 15.5 2 12 2zM5 9h2v4H5V9zm12 0h2v4h-2V9zM9 9h6v4H9V9zm-3 6h12c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2z"/>
  </svg>
);

// 更简洁的鸟类轮廓图标
export const SimpleBirdIcon = ({ size = 24, className = "", style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="#219EBC"
    className={className}
    style={style}
  >
    <path d="M12 2c-2.76 0-5 2.24-5 5 0 1.38.56 2.63 1.46 3.54L12 18l3.54-3.46c.9-.91 1.46-2.16 1.46-3.54 0-2.76-2.24-5-5-5zm0 7.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>
);

// 飞翔的鸟类图标
export const FlyingBirdIcon = ({ size = 24, className = "", style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="#219EBC"
    className={className}
    style={style}
  >
    <path d="M2.5 19h19v2h-19v-2zm16.84-3.15c.08-.53.16-1.06.16-1.6 0-.54-.08-1.07-.16-1.6l1.95-1.95c.51-.51.51-1.34 0-1.85l-1.85-1.85c-.51-.51-1.34-.51-1.85 0L14.65 8.5c-.53-.08-1.06-.16-1.6-.16s-1.07.08-1.6.16L9.5 6.55c-.51-.51-1.34-.51-1.85 0L5.8 8.4c-.51.51-.51 1.34 0 1.85L7.75 12.2c-.08.53-.16 1.06-.16 1.6 0 .54.08 1.07.16 1.6L5.8 17.55c-.51.51-.51 1.34 0 1.85l1.85 1.85c.51.51 1.34.51 1.85 0L10.35 19.5c.53.08 1.06.16 1.6.16s1.07-.08 1.6-.16l1.95 1.95c.51.51 1.34.51 1.85 0l1.85-1.85c.51-.51.51-1.34 0-1.85L19.34 15.85z"/>
  </svg>
);
