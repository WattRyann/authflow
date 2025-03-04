import { validateUsername, validateEmail, validatePassword } from '../validation';

describe('validateUsername', () => {
  test('应该通过有效的用户名', () => {
    expect(validateUsername('user123')).toBe(true);
    expect(validateUsername('admin_user')).toBe(true);
    expect(validateUsername('abc')).toBe(true);
    expect(validateUsername('a'.repeat(50))).toBe(true);
  });

  test('应该拒绝无效的用户名', () => {
    expect(validateUsername('')).toBe(false);
    expect(validateUsername('ab')).toBe(false);
    expect(validateUsername('user@123')).toBe(false);
    expect(validateUsername('user name')).toBe(false);
    expect(validateUsername('a'.repeat(51))).toBe(false);
  });
});

describe('validateEmail', () => {
  test('应该通过有效的邮箱地址', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
    expect(validateEmail('user123@sub.example.com')).toBe(true);
    expect(validateEmail('user-name@example.com')).toBe(true);
  });

  test('应该拒绝无效的邮箱地址', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@.com')).toBe(false);
    expect(validateEmail('user@example.')).toBe(false);
    expect(validateEmail('user name@example.com')).toBe(false);
  });

  test('应该拒绝超过255字符的邮箱地址', () => {
    const longLocalPart = 'a'.repeat(300);
    const longEmail = `${longLocalPart}@example.com`;
    expect(validateEmail(longEmail)).toBe(false);
  });
});

describe('validatePassword', () => {
  test('应该通过有效的密码', () => {
    expect(validatePassword('Password123')).toBe(true);
    expect(validatePassword('Abcd1234')).toBe(true);
    expect(validatePassword('StrongP@ss1')).toBe(true);
    expect(validatePassword('A'.repeat(7) + 'b1')).toBe(true);
  });

  test('应该拒绝无效的密码', () => {
    expect(validatePassword('')).toBe(false);
    expect(validatePassword('password')).toBe(false);
    expect(validatePassword('PASSWORD')).toBe(false);
    expect(validatePassword('12345678')).toBe(false);
    expect(validatePassword('Pass123')).toBe(false);
    expect(validatePassword('password123')).toBe(false);
    expect(validatePassword('PASSWORD123')).toBe(false);
  });
});