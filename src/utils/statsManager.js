const DashboardStats = require('../models/DashboardStats');

/**
 * statsManager — Centralized atomic stats updates (Compute-on-Write)
 */
class StatsManager {
  /**
   * Get current date in Africa/Douala for rollover logic
   */
  getTodayString() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });
  }

  /**
   * Core atomic update function with date rollover logic
   */
  async updateStats(updateParams) {
    const today = this.getTodayString();

    try {
      // Step 1: Attempt to update assuming the date is still the same
      // This is the common case and remains fully atomic.
      let stats = await DashboardStats.findOneAndUpdate(
        { _id: 'global_stats', lastDate: today },
        updateParams,
        { new: true }
      );

      // Step 2: If the date has changed (or first run), perform rollover reset
      if (!stats) {
        stats = await DashboardStats.findOneAndUpdate(
          { _id: 'global_stats' },
          {
            ...updateParams,
            $set: { 
              ...(updateParams.$set || {}), 
              lastDate: today, 
              todayOrders: 0, 
              todayRevenue: 0 
            }
          },
          { upsert: true, new: true }
        );
      }
      return stats;
    } catch (err) {
      console.error('Error updating stats:', err);
    }
  }

  // Wrappers for specific events
  async onOrderCreated(total, status = 'PENDING') {
    const inc = {
      totalOrders: 1,
      todayOrders: 1
    };

    if (this._isRevenueStatus(status)) {
      inc.totalRevenue = total;
      inc.todayRevenue = total;
    }

    if (this._isPendingStatus(status)) {
      inc.pendingOrders = 1;
    }

    return this.updateStats({ $inc: inc });
  }

  async onOrderStatusChange(oldStatus, newStatus, total) {
    const inc = {};

    // 1. Total consistency
    if (oldStatus !== 'CANCELLED' && newStatus === 'CANCELLED') {
      inc.totalOrders = -1;
      inc.todayOrders = -1; // Assuming it was created today; simplified but consistent with dashboard query
    }

    // 2. Revenue transitions
    const wasRev = this._isRevenueStatus(oldStatus);
    const isRev = this._isRevenueStatus(newStatus);
    if (!wasRev && isRev) {
      inc.totalRevenue = total;
      inc.todayRevenue = total;
    } else if (wasRev && !isRev) {
      inc.totalRevenue = -total;
      inc.todayRevenue = -total;
    }

    // 3. Pending transitions
    const wasPending = this._isPendingStatus(oldStatus);
    const isPending = this._isPendingStatus(newStatus);
    if (!wasPending && isPending) {
      inc.pendingOrders = 1;
    } else if (wasPending && !isPending) {
      inc.pendingOrders = -1;
    }

    if (Object.keys(inc).length > 0) {
      return this.updateStats({ $inc: inc });
    }
  }

  _isRevenueStatus(status) {
    return ['PAID', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status);
  }

  _isPendingStatus(status) {
    return ['PAID', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(status);
  }

  async onUserCreated() {
    return this.updateStats({ $inc: { totalUsers: 1 } });
  }

  async onRatingCreated(score) {
    return this.updateStats({
      $inc: {
        ratingSum: score,
        ratingCount: 1
      }
    });
  }

  async onBookingStatusChange(delta) {
    return this.updateStats({ $inc: { activeBookings: delta } });
  }

  async onHandoffChange(delta) {
    return this.updateStats({ $inc: { pendingHandoffs: delta } });
  }
}

module.exports = new StatsManager();
