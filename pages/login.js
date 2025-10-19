import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ErrorMessage from '../components/ErrorMessage';
import { useAuth } from '../utils/useAuth';
import { useUser } from '../utils/userContext';
import styles from '../styles/Login.module.css';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const { login: loginUserContext } = useUser();
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    password: ''
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    console.log('开始登录，用户名/邮箱:', formData.usernameOrEmail);
    
    try {
      const result = await login(formData.usernameOrEmail, formData.password);
      console.log('登录结果:', result);
      
      if (result.success) {
        console.log('登录成功，更新用户上下文');
        // 同时更新用户上下文
        loginUserContext(result.user);
        console.log('跳转到dashboard');
        // 等待一小段时间确保用户状态更新完成
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
      } else {
        console.log('登录失败:', result.message);
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
      <Head>
        <title>登录 - KBird</title>
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* 错误消息显示 */}
        {error && (
          <ErrorMessage
            error={error}
            type="error"
            onClose={() => setError(null)}
          />
        )}
        
        <div className={styles.loginForm}>
          <h1>登录您的账户</h1>
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

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <div className={styles.registerLink}>
            还没有账户？<Link href="/register">立即注册</Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}