'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useAuth } from '../../components/AuthProvider';
import { useErrorHandler } from '../../utils/useErrorHandler';
import { api } from '../../utils/api';
import ErrorMessage from '../../components/ErrorMessage';
import styles from '../../styles/Register.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuthSession, refreshUser, appMode, loading: authLoading } = useAuth();
  const { errors, addError, removeError } = useErrorHandler();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (appMode && appMode.registrationEnabled === false) {
      router.replace('/login');
    }
  }, [appMode, authLoading, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      addError('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 6) {
      addError('密码长度至少为6位');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      addError('密码必须包含至少一个小写字母、一个大写字母和一个数字');
      return;
    }

    try {
      const data = await api.users.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      if (!data.success || !data.token) {
        throw new Error(data.message || '注册失败');
      }

      try {
        if (setAuthSession) {
          setAuthSession(data.token, data.data || null);
        } else {
          localStorage.setItem('token', data.token);
          if (data.data) {
            localStorage.setItem('user', JSON.stringify(data.data));
          }
          if (refreshUser) {
            await refreshUser();
          }
        }
      } catch {
        addError('无法保存登录信息，请检查浏览器设置');
        return;
      }

      addError('注册成功！正在跳转...', 'success');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (error) {
      console.error('注册错误:', error);
      let errorMessage = error.message || '注册过程中发生错误';

      if (error.message && error.message.includes('Failed to fetch')) {
        errorMessage = '无法连接到服务器，请检查网络连接';
      } else if (error.message && error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系管理员';
      }

      addError(errorMessage);
    }
  };

  return (
    <div className={styles.container}>
      <Navbar />

      {errors.map((error) => (
        <ErrorMessage
          key={error.id}
          error={error.message}
          type={error.type}
          onClose={() => removeError(error.id)}
        />
      ))}

      <main className={styles.main}>
        <div className={styles.registerForm}>
          <h1>注册本机账号</h1>
          <p className={styles.registerHint}>
            新建本机账号后，你的记录与清单会与其他账号隔离；鸟种库、地点词典仍全机共用。
          </p>
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
                autoComplete="new-password"
              />
              <p className={styles.fieldHint}>至少 6 位，需同时包含小写字母、大写字母和数字</p>
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
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              注册本机账号
            </button>
          </form>

          <div className={styles.loginLink}>
            已有本机账号？<Link href="/login">登录</Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
