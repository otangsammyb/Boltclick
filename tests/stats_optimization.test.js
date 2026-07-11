const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/app');
const DashboardStats = require('../src/models/DashboardStats');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');
const { auth } = require('../src/config/env');

describe('Dashboard Stats Optimization', () => {
  let token;

  beforeAll(async () => {
    token = jwt.sign({ email: auth.adminEmail, role: 'admin' }, auth.jwtSecret);
    
    // Ensure stats are initialized if not already
    const stats = await DashboardStats.findOne({ _id: 'global_stats' });
    if (!stats) {
        await DashboardStats.create({
            _id: 'global_stats',
            lastDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' })
        });
    }
  });

  it('should return 200 and stats from the materialized collection', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalOrders');
    expect(res.headers.etag).toBeDefined();
  });

  it('should return 304 when ETag matches', async () => {
    const res1 = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    
    const eTag = res1.headers.etag;

    const res2 = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', eTag);
    
    expect(res2.status).toBe(304);
  });

  // Since we are mocking life in the real DB for a full integration test, 
  // we could verify that calling the payment handler actually updates stats.
  // But for this verification, checking the endpoint logic and ETag is the priority.
});
