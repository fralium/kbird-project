'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ErrorMessage from '@/components/ErrorMessage';
import { useAuth } from '@/components/AuthProvider';
import styles from '@/styles/Login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, appMode } = useAuth();
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const expiredMessage = sessionStorage.getItem('auth-expired-message');
    if (expiredMessage) {
      setError(expiredMessage);
      sessionStorage.removeItem('auth-expired-message');
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(formData.usernameOrEmail, formData.password);

      if (result.success) {
        const params = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.search : ''
        );
        const redirect = params.get('redirect') || '';
        const safeRedirect =
          redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
        router.push(safeRedirect);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('登录异常:', err);
      setError(err.message || '登录时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        {error ? (
          <ErrorMessage error={error} type="error" onClose={() => setError(null)} />
        ) : null}

        <div className={styles.loginForm}>
          <h1>登录本机账号</h1>
          <p className={styles.loginHint}>
            本机可有多个账号；记录、清单、照片按账号隔离，鸟种库与地点词典全机共享。
          </p>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="usernameOrEmail">用户名或电子邮箱</label>
              <input
                type="text"
                id="usernameOrEmail"
                name="usernameOrEmail"
                value={formData.usernameOrEmail}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">密码</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="6"
              />
            </div>

            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          {!appMode?.registrationEnabled ? (
            <div className={styles.registerLink}>
              {appMode?.singleUserMode
                ? '单机自用模式：使用初始化时创建的管理员账号登录即可。'
                : '当前已关闭注册，请使用已有账号登录。'}
            </div>
          ) : (
            <div className={styles.registerLink}>
              还没有本机账号？<Link href="/register">注册本机账号</Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
