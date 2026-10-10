/**
 * 单机鸟友自用 / 功能开关（读 process.env，启动后不变则无需热更新）
 */

function envFlag(name, defaultTrue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultTrue;
  return String(raw).toLowerCase() === 'true';
}

function isSingleUserMode() {
  // 默认按单机自用：未显式设为 false 时视为开启
  const raw = process.env.SINGLE_USER_MODE;
  if (raw === undefined || raw === '') return true;
  return String(raw).toLowerCase() === 'true';
}

function isRegistrationEnabled() {
  const raw = process.env.ENABLE_REGISTRATION;
  if (raw !== undefined && raw !== '') {
    return String(raw).toLowerCase() === 'true';
  }
  // 单机默认关闭注册；多用户默认开启
  return !isSingleUserMode();
}

function isAutoLoginEnabled() {
  if (!isSingleUserMode()) return false;
  return envFlag('AUTO_LOGIN', true);
}

function getDefaultUsername() {
  const name = String(process.env.DEFAULT_USER || 'admin').trim();
  return name || 'admin';
}

function getAppModePublic() {
  return {
    singleUserMode: isSingleUserMode(),
    registrationEnabled: isRegistrationEnabled(),
    autoLogin: isAutoLoginEnabled(),
  };
}

/** 仅本机回环，忽略 X-Forwarded-For，避免误暴露时被伪造 */
function isLocalLoopbackRequest(req) {
  const candidates = [
    req.socket?.remoteAddress,
    req.connection?.remoteAddress,
    req.ip,
  ]
    .filter(Boolean)
    .map((v) => String(v).replace(/^::ffff:/i, '').toLowerCase());

  return candidates.some(
    (ip) => ip === '127.0.0.1' || ip === '::1' || ip === 'localhost'
  );
}

module.exports = {
  isSingleUserMode,
  isRegistrationEnabled,
  isAutoLoginEnabled,
  getDefaultUsername,
  getAppModePublic,
  isLocalLoopbackRequest,
};
