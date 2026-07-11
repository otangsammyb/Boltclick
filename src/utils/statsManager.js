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
        // Deep clone to avoid mutating the passed object in loops or retries
        const rolloverUpdate = JSON.parse(JSON.stringify(updateParams));
        
        rolloverUpdate.$set = rolloverUpdate.$set || {};
        rolloverUpdate.$set.lastDate = today;

        // Base values after daily reset
        let todayOrdersVal = 0;
        let todayRevenueVal = 0;

        // Extract todayOrders and todayRevenue from $inc and move them to $set
        // Since we are resetting, the $inc value essentially becomes the new $set value.
        if (rolloverUpdate.$inc) {
          if (rolloverUpdate.$inc.todayOrders !== undefined) {
             todayOrdersVal = rolloverUpdate.$inc.todayOrders;
             delete rolloverUpdate.$inc.todayOrders;
          }
          if (rolloverUpdate.$inc.todayRevenue !== undefined) {
             todayRevenueVal = rolloverUpdate.$inc.todayRevenue;
             delete rolloverUpdate.$inc.todayRevenue;
          }
          
          // Remove $inc completely if empty to prevent MongoDB empty object error
          if (Object.keys(rolloverUpdate.$inc).length === 0) {
            delete rolloverUpdate.$inc;
          }
        }

        rolloverUpdate.$set.todayOrders = todayOrdersVal;
        rolloverUpdate.$set.todayRevenue = todayRevenueVal;

        stats = await DashboardStats.findOneAndUpdate(
          { _id: 'global_stats' },
          rolloverUpdate,
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
