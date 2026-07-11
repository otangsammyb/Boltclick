// tests/carrier.test.js
const { detectCarrier } = require('../src/utils/carrier');

describe('Carrier Detection', () => {
  test('detects MTN from 6503xxxxx', () => {
    expect(detectCarrier('650312345')).toBe('MTN');
  });
  test('detects MTN from 237670123456', () => {
    expect(detectCarrier('237670123456')).toBe('MTN');
  });
  test('detects Orange from 690123456', () => {
    expect(detectCarrier('690123456')).toBe('ORANGE');
  });
  test('detects Orange from 237699123456', () => {
    expect(detectCarrier('237699123456')).toBe('ORANGE');
  });
  test('returns UNKNOWN for invalid prefix', () => {
    expect(detectCarrier('600000000')).toBe('UNKNOWN');
  });
  test('handles + prefix', () => {
    expect(detectCarrier('+237670000001')).toBe('MTN');
  });
});
