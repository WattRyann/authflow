/**
 * 验证用户名
 * 3-50字符，仅字母、数字、下划线
 */
export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  return usernameRegex.test(username);
}

/**
 * 验证邮箱
 * RFC 5322 格式，最大255字符
 */
export function validateEmail(email: string): boolean {
  if (email.length > 255) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * 验证密码强度
 * 最少8字符，至少包含一个大写字母、一个小写字母和一个数字
 */
export function validatePassword(password: string): boolean {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
}