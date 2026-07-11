// tests/haversine.test.js
const { haversine } = require('../src/utils/haversine');

describe('Haversine Distance', () => {
  test('same point returns 0', () => {
    expect(haversine(4.05, 9.76, 4.05, 9.76)).toBeCloseTo(0, 3);
  });

  test('Douala Bonamoussadi to Akwa (~5km)', () => {
    // Bonamoussadi: 4.0511, 9.7679
    // Akwa: 4.0495, 9.6966
    const dist = haversine(4.0511, 9.7679, 4.0495, 9.6966);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(9);
  });

  test('calculates delivery fee correctly (200 fcfa/km)', () => {
    const km = haversine(4.0511, 9.7679, 4.0495, 9.6966);
    const fee = Math.round(km * 200);
    expect(fee).toBeGreaterThan(800);
    expect(fee).toBeLessThan(2000);
  });
});
