import { useState, useEffect, useId, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BirdIcon, AddIcon, UserIcon, TrophyIcon, MapIcon, LogoutIcon, ChevronDownIcon, colors } from './Icons';
import { useAuth } from './AuthProvider';
import styles from '@/styles/Navbar.module.css';

const Navbar = () => {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isArchiveMenuOpen, setIsArchiveMenuOpen] = useState(false);
  const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useState(false);
  const [isRecordMenuOpen, setIsRecordMenuOpen] = useState(false);
  const [homeScrolled, setHomeScrolled] = useState(false);
  const [homeNavReady, setHomeNavReady] = useState(false);
  const { user, loading, logout, appMode } = useAuth();
  const archiveMenuId = useId();
  const libraryMenuId = useId();
  const recordMenuId = useId();
  const userMenuId = useId();
  const archiveMenuButtonRef = useRef(null);
  const libraryMenuButtonRef = useRef(null);
  const recordMenuButtonRef = useRef(null);
  const userMenuButtonRef = useRef(null);
  
  const isLoggedIn = !!user;
  const userRole = user?.role;
  const authPending = loading && !user;

  const isPathActive = (href, { exact = false } = {}) => {
    if (!pathname || !href) return false;
    if (exact || href === '/') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isRecordsArchiveActive =
    pathname === '/records' ||
    (typeof pathname === 'string' &&
      pathname.startsWith('/records/') &&
      !pathname.startsWith('/records/plots'));

  const isSeenBirdsActive =
    pathname === '/birds' ||
    (typeof pathname === 'string' &&
      /^\/birds\/(?!catalog|regions|add|edit)[^/]+/.test(pathname));

  const dropdownItemClass = (active) =>
    `${styles.dropdownItem}${active ? ` ${styles.dropdownItemActive}` : ''}`;

  // 首页：滚过英雄区后恢复实底页眉。挂载后再套 blend/solid，避免 SSR 水合不一致
  useEffect(() => {
    if (!isHome) {
      setHomeScrolled(false);
      setHomeNavReady(false);
      return undefined;
    }
    const onScroll = () => {
      const threshold = Math.max(120, Math.round(window.innerHeight * 0.55));
      setHomeScrolled(window.scrollY > threshold);
    };
    onScroll();
    setHomeNavReady(true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const closeAllDropdowns = () => {
    setIsUserMenuOpen(false);
    setIsArchiveMenuOpen(false);
    setIsLibraryMenuOpen(false);
    setIsRecordMenuOpen(false);
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserMenuOpen && !event.target.closest(`.${styles.userMenuContainer}`)) {
        setIsUserMenuOpen(false);
      }
      if (isArchiveMenuOpen && !event.target.closest(`.${styles.archiveMenuContainer}`)) {
        setIsArchiveMenuOpen(false);
      }
      if (isLibraryMenuOpen && !event.target.closest(`.${styles.libraryMenuContainer}`)) {
        setIsLibraryMenuOpen(false);
      }
      if (isRecordMenuOpen && !event.target.closest(`.${styles.recordMenuContainer}`)) {
        setIsRecordMenuOpen(false);
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isUserMenuOpen, isArchiveMenuOpen, isLibraryMenuOpen, isRecordMenuOpen]);

  // ESC 键统一关闭所有菜单，提升键盘导航体验
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key !== 'Escape') return;
      setIsMenuOpen(false);
      closeAllDropdowns();
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    closeAllDropdowns();
  };

  const toggleUserMenu = () => {
    const next = !isUserMenuOpen;
    closeAllDropdowns();
    setIsUserMenuOpen(next);
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  const toggleArchiveMenu = () => {
    const next = !isArchiveMenuOpen;
    closeAllDropdowns();
    setIsArchiveMenuOpen(next);
  };

  const closeArchiveMenu = () => {
    setIsArchiveMenuOpen(false);
  };

  const toggleLibraryMenu = () => {
    const next = !isLibraryMenuOpen;
    closeAllDropdowns();
    setIsLibraryMenuOpen(next);
  };

  const closeLibraryMenu = () => {
    setIsLibraryMenuOpen(false);
  };

  const toggleRecordMenu = () => {
    const next = !isRecordMenuOpen;
    closeAllDropdowns();
    setIsRecordMenuOpen(next);
  };

  const closeRecordMenu = () => {
    setIsRecordMenuOpen(false);
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
    logout();
  };

  const getMenuItems = (menuId) => {
    if (typeof window === 'undefined') return [];
    const menu = document.getElementById(menuId);
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
  };

  const focusMenuBoundaryItem = (menuId, type = 'first') => {
    const items = getMenuItems(menuId);
    if (items.length === 0) return;
    const target = type === 'last' ? items[items.length - 1] : items[0];
    target.focus();
  };

  const focusRelativeMenuItem = (menuId, currentElement, step) => {
    const items = getMenuItems(menuId);
    if (items.length === 0) return;
    const currentIndex = items.indexOf(currentElement);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + step + items.length) % items.length;
    items[nextIndex].focus();
  };

  const handleTriggerKeyDown = (event, { isOpen, openMenu, closeMenu, menuId }) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) openMenu();
      setTimeout(() => focusMenuBoundaryItem(menuId, 'first'), 0);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) openMenu();
      setTimeout(() => focusMenuBoundaryItem(menuId, 'last'), 0);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };

  const handleDropdownItemKeyDown = (event, { menuId, closeMenu, triggerRef }) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRelativeMenuItem(menuId, event.currentTarget, 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRelativeMenuItem(menuId, event.currentTarget, -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusMenuBoundaryItem(menuId, 'first');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusMenuBoundaryItem(menuId, 'last');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      triggerRef?.current?.focus();
    }
  };

  return (
    <nav
      className={`${styles.navbar}${
        isHome && homeNavReady && !homeScrolled ? ` ${styles.homeBlend}` : ''
      }${isHome && homeNavReady && homeScrolled ? ` ${styles.homeSolid}` : ''}`}
    >
      <div className={styles.container}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          <span className={styles.logoMark} aria-hidden="true">
            <Image
              src="/logo-wetland.png"
              alt=""
              width={40}
              height={40}
              className={styles.logoImage}
              onError={(e) => {
                e.target.style.display = 'none';
                const sibling = e.target.nextElementSibling;
                if (sibling) sibling.style.display = 'block';
              }}
            />
            <svg
              className={styles.logoFallback}
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ display: 'none' }}
            >
              <path d="M12 2C8.5 2 5.73 4.11 5.18 7h3.64c.45-1.25 1.63-2 3.18-2s2.73.75 3.18 2h3.64C18.27 4.11 15.5 2 12 2zM5 9h2v4H5V9zm12 0h2v4h-2V9zM9 9h6v4H9V9zm-3 6h12c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2z" />
            </svg>
          </span>
          <span className={styles.logoText}>KBird</span>
        </Link>

        <button
          type="button"
          className={styles.menuIcon}
          onClick={toggleMenu}
          aria-label={isMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
          aria-expanded={isMenuOpen}
          aria-controls="kbird-main-navigation"
        >
          <div className={`${styles.menuBar} ${isMenuOpen ? styles.open : ''}`}></div>
          <div className={`${styles.menuBar} ${isMenuOpen ? styles.open : ''}`}></div>
          <div className={`${styles.menuBar} ${isMenuOpen ? styles.open : ''}`}></div>
        </button>

        <ul id="kbird-main-navigation" className={`${styles.navMenu} ${isMenuOpen ? styles.active : ''}`}>
          <li className={styles.navItem}>
            <Link href="/" className={styles.navLink} onClick={closeMenu}>
              首页
            </Link>
          </li>

          {/* 记录：回看档案 */}
          <li className={`${styles.navItem} ${styles.archiveMenuContainer}`}>
            <button
              type="button"
              className={styles.navLink}
              onClick={toggleArchiveMenu}
              onKeyDown={(event) =>
                handleTriggerKeyDown(event, {
                  isOpen: isArchiveMenuOpen,
                  openMenu: () => {
                    closeAllDropdowns();
                    setIsArchiveMenuOpen(true);
                  },
                  closeMenu: closeArchiveMenu,
                  menuId: archiveMenuId,
                })
              }
              ref={archiveMenuButtonRef}
              aria-expanded={isArchiveMenuOpen}
              aria-haspopup="menu"
              aria-controls={archiveMenuId}
            >
              记录
              <span className={`${styles.chevron}${isArchiveMenuOpen ? ` ${styles.chevronOpen}` : ''}`} aria-hidden="true">
                <ChevronDownIcon size={14} color="white" />
              </span>
            </button>
            {isArchiveMenuOpen && (
              <div id={archiveMenuId} className={styles.navDropdown} role="menu" aria-label="记录菜单">
                <Link
                  href="/records"
                  className={dropdownItemClass(isRecordsArchiveActive)}
                  role="menuitem"
                  aria-current={isRecordsArchiveActive ? 'page' : undefined}
                  onClick={closeArchiveMenu}
                  onKeyDown={(event) =>
                    handleDropdownItemKeyDown(event, {
                      menuId: archiveMenuId,
                      closeMenu: closeArchiveMenu,
                      triggerRef: archiveMenuButtonRef,
                    })
                  }
                >
                  观察记录
                </Link>
                <Link
                  href="/birds"
                  className={dropdownItemClass(isSeenBirdsActive)}
                  role="menuitem"
                  aria-current={isSeenBirdsActive ? 'page' : undefined}
                  onClick={closeArchiveMenu}
                  onKeyDown={(event) =>
                    handleDropdownItemKeyDown(event, {
                      menuId: archiveMenuId,
                      closeMenu: closeArchiveMenu,
                      triggerRef: archiveMenuButtonRef,
                    })
                  }
                >
                  已见鸟种
                </Link>
                {isLoggedIn ? <div className={styles.dropdownDivider} role="separator" /> : null}
                {isLoggedIn && (
                  <Link
                    href="/records/plots"
                    className={dropdownItemClass(isPathActive('/records/plots'))}
                    role="menuitem"
                    aria-current={isPathActive('/records/plots') ? 'page' : undefined}
                    onClick={closeArchiveMenu}
                    onKeyDown={(event) =>
                      handleDropdownItemKeyDown(event, {
                        menuId: archiveMenuId,
                        closeMenu: closeArchiveMenu,
                        triggerRef: archiveMenuButtonRef,
                      })
                    }
                  >
                    自留地
                  </Link>
                )}
                {isLoggedIn && (
                  <Link
                    href="/personal/goals"
                    className={dropdownItemClass(isPathActive('/personal/goals'))}
                    role="menuitem"
                    aria-current={isPathActive('/personal/goals') ? 'page' : undefined}
                    onClick={closeArchiveMenu}
                    onKeyDown={(event) =>
                      handleDropdownItemKeyDown(event, {
                        menuId: archiveMenuId,
                        closeMenu: closeArchiveMenu,
                        triggerRef: archiveMenuButtonRef,
                      })
                    }
                  >
                    加新之旅
                  </Link>
                )}
              </div>
            )}
          </li>

          {/* 数据库：地点词典 / 鸟种名录 / 各地鸟种 / 照片库 / 鸟类知识 */}
          <li className={`${styles.navItem} ${styles.libraryMenuContainer}`}>
            <button
              type="button"
              className={styles.navLink}
              onClick={toggleLibraryMenu}
              onKeyDown={(event) =>
                handleTriggerKeyDown(event, {
                  isOpen: isLibraryMenuOpen,
                  openMenu: () => {
                    closeAllDropdowns();
                    setIsLibraryMenuOpen(true);
                  },
                  closeMenu: closeLibraryMenu,
                  menuId: libraryMenuId,
                })
              }
              ref={libraryMenuButtonRef}
              aria-expanded={isLibraryMenuOpen}
              aria-haspopup="menu"
              aria-controls={libraryMenuId}
            >
              数据库
              <span className={`${styles.chevron}${isLibraryMenuOpen ? ` ${styles.chevronOpen}` : ''}`} aria-hidden="true">
                <ChevronDownIcon size={14} color="white" />
              </span>
            </button>
            {isLibraryMenuOpen && (
              <div id={libraryMenuId} className={styles.navDropdown} role="menu" aria-label="数据库菜单">
                <Link
                  href="/locations"
                  className={dropdownItemClass(isPathActive('/locations'))}
                  role="menuitem"
                  aria-current={isPathActive('/locations') ? 'page' : undefined}
                  onClick={closeLibraryMenu}
                  onKeyDown={(event) =>
                    handleDropdownItemKeyDown(event, {
                      menuId: libraryMenuId,
                      closeMenu: closeLibraryMenu,
                      triggerRef: libraryMenuButtonRef,
                    })
                  }
                >
                  地点词典
                </Link>
                <Link
                  href="/birds/catalog"
                  className={dropdownItemClass(isPathActive('/birds/catalog'))}
                  role="menuitem"
                  aria-current={isPathActive('/birds/catalog') ? 'page' : undefined}
                  onClick={closeLibraryMenu}
                  onKeyDown={(event) =>
                    handleDropdownItemKeyDown(event, {
                      menuId: libraryMenuId,
                      closeMenu: closeLibraryMenu,
                      triggerRef: libraryMenuButtonRef,
                    })
                  }
                >
                  鸟种名录
                </Link>
                <Link
                  href="/birds/regions"
                  className={dropdownItemClass(isPathActive('/birds/regions'))}
                  role="menuitem"
                  aria-current={isPathActive('/birds/regions') ? 'page' : undefined}
                  onClick={closeLibraryMenu}
                  onKeyDown={(event) =>
                    handleDropdownItemKeyDown(event, {
                      menuId: libraryMenuId,
                      closeMenu: closeLibraryMenu,
                      triggerRef: libraryMenuButtonRef,
                    })
                  }
                >
                  各地鸟种
                </Link>
                {isLoggedIn && (
                  <Link
                    href="/personal/photos"
                    className={dropdownItemClass(isPathActive('/personal/photos'))}
                    role="menuitem"
                    aria-current={isPathActive('/personal/photos') ? 'page' : undefined}
                    onClick={closeLibraryMenu}
                    onKeyDown={(event) =>
                      handleDropdownItemKeyDown(event, {
                        menuId: libraryMenuId,
                        closeMenu: closeLibraryMenu,
                        triggerRef: libraryMenuButtonRef,
                      })
                    }
                  >
                    照片库
                  </Link>
                )}
                <div className={styles.dropdownDivider} role="separator" />
                <Link
                  href="/knowledge"
                  className={dropdownItemClass(isPathActive('/knowledge'))}
                  role="menuitem"
                  aria-current={isPathActive('/knowledge') ? 'page' : undefined}
                  onClick={closeLibraryMenu}
                  onKeyDown={(event) =>
                    handleDropdownItemKeyDown(event, {
                      menuId: libraryMenuId,
                      closeMenu: closeLibraryMenu,
                      triggerRef: libraryMenuButtonRef,
                    })
                  }
                >
                  鸟类知识
                </Link>
              </div>
            )}
          </li>

          <li className={styles.navItem}>
            <Link href="/ai" className={styles.navLink} onClick={closeMenu}>
              观鸟助手
            </Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/search" className={styles.navLink} onClick={closeMenu}>
              搜索
            </Link>
          </li>

          {authPending ? (
            <li className={styles.navItem}>
              <span className={styles.navLink} aria-hidden="true" style={{ opacity: 0.55 }}>
                …
              </span>
            </li>
          ) : isLoggedIn ? (
            <>
              {/* 记录菜单（快速记录和详细记录） */}
              <li className={`${styles.navItem} ${styles.recordMenuContainer}`}>
                <button 
                  type="button"
                  className={styles.navLink}
                  onClick={toggleRecordMenu}
                  onKeyDown={(event) =>
                    handleTriggerKeyDown(event, {
                      isOpen: isRecordMenuOpen,
                      openMenu: () => {
                        closeAllDropdowns();
                        setIsRecordMenuOpen(true);
                      },
                      closeMenu: closeRecordMenu,
                      menuId: recordMenuId,
                    })
                  }
                  ref={recordMenuButtonRef}
                  aria-expanded={isRecordMenuOpen}
                  aria-haspopup="menu"
                  aria-controls={recordMenuId}
                >
                  记一笔
                  <span className={`${styles.chevron}${isRecordMenuOpen ? ` ${styles.chevronOpen}` : ''}`} aria-hidden="true">
                    <ChevronDownIcon size={14} color="white" />
                  </span>
                </button>
                {isRecordMenuOpen && (
                  <div id={recordMenuId} className={styles.navDropdown} role="menu" aria-label="记一笔菜单">
                    <Link
                      href="/records/quick"
                      className={dropdownItemClass(isPathActive('/records/quick', { exact: true }))}
                      role="menuitem"
                      aria-current={isPathActive('/records/quick', { exact: true }) ? 'page' : undefined}
                      onClick={closeRecordMenu}
                      onKeyDown={(event) =>
                        handleDropdownItemKeyDown(event, {
                          menuId: recordMenuId,
                          closeMenu: closeRecordMenu,
                          triggerRef: recordMenuButtonRef,
                        })
                      }
                    >
                      快速记录
                    </Link>
                    <Link
                      href="/records/add"
                      className={dropdownItemClass(isPathActive('/records/add', { exact: true }))}
                      role="menuitem"
                      aria-current={isPathActive('/records/add', { exact: true }) ? 'page' : undefined}
                      onClick={closeRecordMenu}
                      onKeyDown={(event) =>
                        handleDropdownItemKeyDown(event, {
                          menuId: recordMenuId,
                          closeMenu: closeRecordMenu,
                          triggerRef: recordMenuButtonRef,
                        })
                      }
                    >
                      详细记录
                    </Link>
                    <Link
                      href="/records/draft"
                      className={dropdownItemClass(isPathActive('/records/draft', { exact: true }))}
                      role="menuitem"
                      aria-current={isPathActive('/records/draft', { exact: true }) ? 'page' : undefined}
                      onClick={closeRecordMenu}
                      onKeyDown={(event) =>
                        handleDropdownItemKeyDown(event, {
                          menuId: recordMenuId,
                          closeMenu: closeRecordMenu,
                          triggerRef: recordMenuButtonRef,
                        })
                      }
                    >
                      文字草稿
                    </Link>
                  </div>
                )}
              </li>
              
              {/* 用户菜单 */}
              <li className={`${styles.navItem} ${styles.userMenuContainer}`}>
                <button 
                  type="button"
                  className={styles.navLink}
                  onClick={toggleUserMenu}
                  onKeyDown={(event) =>
                    handleTriggerKeyDown(event, {
                      isOpen: isUserMenuOpen,
                      openMenu: () => {
                        closeAllDropdowns();
                        setIsUserMenuOpen(true);
                      },
                      closeMenu: closeUserMenu,
                      menuId: userMenuId,
                    })
                  }
                  ref={userMenuButtonRef}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  aria-controls={userMenuId}
                >
                  我的
                  <span className={`${styles.chevron}${isUserMenuOpen ? ` ${styles.chevronOpen}` : ''}`} aria-hidden="true">
                    <ChevronDownIcon size={14} color="white" />
                  </span>
                </button>
                {isUserMenuOpen && (
                  <div id={userMenuId} className={styles.userDropdown} role="menu" aria-label="我的菜单">
                    {/* 统计 / 探索 / 便签 */}
                    <div className={styles.dropdownGroup}>
                      <Link
                        href="/personal/stats"
                        className={styles.dropdownItem}
                        role="menuitem"
                        onClick={closeUserMenu}
                        onKeyDown={(event) =>
                          handleDropdownItemKeyDown(event, {
                            menuId: userMenuId,
                            closeMenu: closeUserMenu,
                            triggerRef: userMenuButtonRef,
                          })
                        }
                      >
                        个人统计
                      </Link>
                      <Link
                        href="/personal/projects"
                        className={styles.dropdownItem}
                        role="menuitem"
                        onClick={closeUserMenu}
                        onKeyDown={(event) =>
                          handleDropdownItemKeyDown(event, {
                            menuId: userMenuId,
                            closeMenu: closeUserMenu,
                            triggerRef: userMenuButtonRef,
                          })
                        }
                      >
                        探索 Demo
                      </Link>
                      <Link
                        href="/personal/notepad"
                        className={styles.dropdownItem}
                        role="menuitem"
                        onClick={closeUserMenu}
                        onKeyDown={(event) =>
                          handleDropdownItemKeyDown(event, {
                            menuId: userMenuId,
                            closeMenu: closeUserMenu,
                            triggerRef: userMenuButtonRef,
                          })
                        }
                      >
                        我的便签
                      </Link>
                    </div>
                    
                    <div className={styles.dropdownDivider}></div>
                    
                    <div className={styles.dropdownGroup}>
                      <Link
                        href="/personal/manage"
                        className={styles.dropdownItem}
                        role="menuitem"
                        onClick={closeUserMenu}
                        onKeyDown={(event) =>
                          handleDropdownItemKeyDown(event, {
                            menuId: userMenuId,
                            closeMenu: closeUserMenu,
                            triggerRef: userMenuButtonRef,
                          })
                        }
                      >
                        数据管理
                      </Link>
                      <Link
                        href="/personal/settings"
                        className={styles.dropdownItem}
                        role="menuitem"
                        onClick={closeUserMenu}
                        onKeyDown={(event) =>
                          handleDropdownItemKeyDown(event, {
                            menuId: userMenuId,
                            closeMenu: closeUserMenu,
                            triggerRef: userMenuButtonRef,
                          })
                        }
                      >
                        个人设置
                      </Link>
                    </div>
                    {userRole === 'admin' && (
                      <>
                        <div className={styles.dropdownDivider}></div>
                        <Link
                          href="/birds/add"
                          className={styles.dropdownItem}
                          role="menuitem"
                          onClick={closeUserMenu}
                          onKeyDown={(event) =>
                            handleDropdownItemKeyDown(event, {
                              menuId: userMenuId,
                              closeMenu: closeUserMenu,
                              triggerRef: userMenuButtonRef,
                            })
                          }
                        >
                          添加鸟类品种
                        </Link>
                        <Link
                          href="/admin/observability"
                          className={styles.dropdownItem}
                          role="menuitem"
                          onClick={closeUserMenu}
                          onKeyDown={(event) =>
                            handleDropdownItemKeyDown(event, {
                              menuId: userMenuId,
                              closeMenu: closeUserMenu,
                              triggerRef: userMenuButtonRef,
                            })
                          }
                        >
                          错误率看板
                        </Link>
                      </>
                    )}
                    <div className={styles.dropdownDivider}></div>
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      role="menuitem"
                      onClick={handleLogout}
                      onKeyDown={(event) =>
                        handleDropdownItemKeyDown(event, {
                          menuId: userMenuId,
                          closeMenu: closeUserMenu,
                          triggerRef: userMenuButtonRef,
                        })
                      }
                    >
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
              {appMode?.registrationEnabled ? (
                <li className={styles.navItem}>
                  <Link href="/register" className={`${styles.navLink} ${styles.registerButton}`} onClick={closeMenu}>
                    注册本机账号
                  </Link>
                </li>
              ) : null}
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;