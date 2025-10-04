import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BirdIcon, AddIcon, UserIcon, TrophyIcon, MapIcon, LogoutIcon, ChevronDownIcon } from './Icons';
import { useUser } from '../utils/userContext';
import styles from '../styles/Navbar.module.css';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, loading, logout } = useUser();
  
  const isLoggedIn = !!user;
  const userRole = user?.role;

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserMenuOpen && !event.target.closest(`.${styles.userMenuContainer}`)) {
        setIsUserMenuOpen(false);
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isUserMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  const handleLogout = () => {
    // 安全退出：使用UserContext的logout功能
    logout();
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
    // 使用 Next.js 路由进行安全重定向
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          <BirdIcon size={32} color="white" />
          <span className={styles.logoText}>KBird</span>
        </Link>

        <div className={styles.menuIcon} onClick={toggleMenu}>
          <div className={`${styles.menuBar} ${isMenuOpen ? styles.open : ''}`}></div>
          <div className={`${styles.menuBar} ${isMenuOpen ? styles.open : ''}`}></div>
          <div className={`${styles.menuBar} ${isMenuOpen ? styles.open : ''}`}></div>
        </div>

        <ul className={`${styles.navMenu} ${isMenuOpen ? styles.active : ''}`}>
          <li className={styles.navItem}>
            <Link href="/" className={styles.navLink} onClick={closeMenu}>
              首页
            </Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/birds" className={styles.navLink} onClick={closeMenu}>
              鸟类图鉴
            </Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/birds/catalog" className={styles.navLink} onClick={closeMenu}>
              鸟类名录
            </Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/records" className={styles.navLink} onClick={closeMenu}>
              观鸟记录
            </Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/locations" className={styles.navLink} onClick={closeMenu}>
              地点名录
            </Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/leaderboard" className={styles.navLink} onClick={closeMenu}>
              成就榜
            </Link>
          </li>
          {isLoggedIn ? (
            <>
              <li className={styles.navItem}>
                <Link href="/records/add" className={`${styles.navLink} ${styles.recordButton}`} onClick={closeMenu}>
                  <AddIcon size={16} color="white" />
                  新增记录
                </Link>
              </li>
              <li className={`${styles.navItem} ${styles.userMenuContainer}`}>
                <button 
                  className={`${styles.navLink} ${styles.userMenuButton}`}
                  onClick={toggleUserMenu}
                >
                  <UserIcon size={16} color="white" />
                  我的主页
                  <ChevronDownIcon size={14} color="white" />
                </button>
                {isUserMenuOpen && (
                  <div className={styles.userDropdown}>
                    <Link href="/dashboard" className={styles.dropdownItem} onClick={closeUserMenu}>
                      <UserIcon size={16} color="white" />
                      个人中心
                    </Link>
                    <Link href="/reports/submit" className={styles.dropdownItem} onClick={closeUserMenu}>
                      <UserIcon size={16} color="white" />
                      提交报告
                    </Link>
                    {userRole === 'admin' && (
                      <>
                        <Link href="/birds/add" className={styles.dropdownItem} onClick={closeUserMenu}>
                          <AddIcon size={16} color="white" />
                          添加鸟类品种
                        </Link>
                        <Link href="/admin/review" className={styles.dropdownItem} onClick={closeUserMenu}>
                          <UserIcon size={16} color="white" />
                          管理员审核
                        </Link>
                      </>
                    )}
                    <button className={styles.dropdownItem} onClick={handleLogout}>
                      <LogoutIcon size={16} color="white" />
                      退出登录
                    </button>
                  </div>
                )}
              </li>
            </>
          ) : (
            <>
              <li className={styles.navItem}>
                <Link href="/login" className={`${styles.navLink} ${styles.loginButton}`} onClick={closeMenu}>
                  登录
                </Link>
              </li>
              <li className={styles.navItem}>
                <Link href="/register" className={`${styles.navLink} ${styles.registerButton}`} onClick={closeMenu}>
                  注册
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;