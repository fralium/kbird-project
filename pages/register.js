import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import styles from '../styles/Register.module.css';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        }),
      });

      // 首先检查响应内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || '服务器返回了非JSON响应');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `注册失败: ${response.statusText}`);
      }

      // 注册成功，保存token并跳转到用户中心
      localStorage.setItem('token', data.token);
      alert('注册成功！');
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('注册错误:', error);
      let errorMessage = error.message || '注册过程中发生错误';
      
      // 处理网络错误
      if (error.message.includes('Failed to fetch')) {
        errorMessage = '无法连接到服务器，请检查网络连接';
      }
      // 处理500错误
      else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系管理员';
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>注册 - KBird</title>
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.registerForm}>
          <h1>创建账户</h1>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="name">用户名</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">电子邮箱</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
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

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">确认密码</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength="6"
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              注册
            </button>
          </form>

          <div className={styles.loginLink}>
            已有账户？<Link href="/login">登录</Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}