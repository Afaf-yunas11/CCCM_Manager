const { Camp, User, Disaster, CampNgo } = require('../models');
const { sanitize, escapeHtml } = require('../utils/sanitize');

// ── Admin: Get all camps with status checks and statistics ─────────────────
async function getCamps(req, res) {
  try {
    const { status, search, disasterId, managerId } = req.query;
    const filter = {};

    if (disasterId) filter.disasterId = disasterId;
    if (managerId) filter.managerId = managerId;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { 'location.name': regex },
      ];
    }

    const now = new Date();

    // Fetch all camps matching basic filter
    const camps = await Camp.find(filter)
      .populate('managerId', 'fullName email role')
      .populate('disasterId', 'title type severity status location')
      .sort({ createdAt: -1 });

    // Check closureDue flag dynamically:
    // Camps NEVER close automatically. If plannedClosureDate <= now and status === 'active',
    // it is flagged as 'closureDue' for manager/admin action.
    const processedCamps = await Promise.all(
      camps.map(async (camp) => {
        if (
          camp.status === 'active' &&
          camp.plannedClosureDate &&
          new Date(camp.plannedClosureDate) <= now
        ) {
          // Update status in DB to closureDue so queries are consistent
          camp.status = 'closureDue';
          await camp.save();
        }
        return camp;
      })
    );

    // Filter by status if requested (after closureDue evaluation)
    const filteredCamps = status
      ? processedCamps.filter((c) => c.status === status)
      : processedCamps;

    // Calculate summary statistics
    const total = processedCamps.length;
    const active = processedCamps.filter((c) => c.status === 'active').length;
    const closureDue = processedCamps.filter((c) => c.status === 'closureDue').length;
    const extended = processedCamps.filter((c) => c.status === 'extended').length;
    const closed = processedCamps.filter((c) => c.status === 'closed').length;

    let totalCapacity = 0;
    let totalPopulation = 0;
    processedCamps.forEach((c) => {
      totalCapacity += c.capacity || 0;
      totalPopulation += c.population || 0;
    });

    const summary = {
      total,
      active,
      closureDue,
      extended,
      closed,
      totalCapacity,
      totalPopulation,
      occupancyRate: totalCapacity > 0 ? Math.round((totalPopulation / totalCapacity) * 100) : 0,
    };

    // Fetch available managers & disasters for form dropdowns
    const [managers, disasters] = await Promise.all([
      User.find({ role: { $in: ['campManager', 'admin'] } }).select('fullName email role'),
      Disaster.find({ status: { $ne: 'closed' } }).select('title type severity location status'),
    ]);

    return res.json({
      camps: filteredCamps,
      summary,
      availableManagers: managers,
      activeDisasters: disasters,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve camps.' });
  }
}

// ── Admin: Create a new Camp ────────────────────────────────────────────────
async function createCamp(req, res) {
  try {
    const {
      name,
      capacity,
      population,
      managerId,
      disasterId,
      location,
      plannedClosureDate,
      facilities,
      resources,
    } = req.body;

    const cleanName = escapeHtml(sanitize(name));
    if (!cleanName) {
      return res.status(400).json({ message: 'Camp name is required.' });
    }

    if (!capacity || Number(capacity) <= 0) {
      return res.status(400).json({ message: 'Valid maximum capacity is required.' });
    }

    // Default to current user if managerId not provided
    const targetManagerId = managerId || req.user._id;

    // Default 4 core resources if not provided
    const defaultResources = [
      { name: 'water', level: 'sufficient' },
      { name: 'food', level: 'sufficient' },
      { name: 'medicine', level: 'sufficient' },
      { name: 'shelter', level: 'sufficient' },
    ];

    const camp = await Camp.create({
      name: cleanName,
      capacity: Number(capacity),
      population: Number(population) || 0,
      managerId: targetManagerId,
      disasterId: disasterId || undefined,
      location: typeof location === 'object' ? location : { name: String(location || '').trim() },
      plannedClosureDate: plannedClosureDate || undefined,
      facilities: Array.isArray(facilities) ? facilities : [],
      resources: Array.isArray(resources) && resources.length > 0 ? resources : defaultResources,
      status: 'active',
    });

    const populated = await Camp.findById(camp._id)
      .populate('managerId', 'fullName email role')
      .populate('disasterId', 'title type severity status location');

    return res.status(201).json({ message: 'Camp created successfully.', camp: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create camp.' });
  }
}

// ── Admin or Manager: Update Camp details ───────────────────────────────────
async function updateCamp(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      capacity,
      population,
      managerId,
      disasterId,
      location,
      facilities,
      resources,
    } = req.body;

    const camp = await Camp.findById(id);
    if (!camp) return res.status(404).json({ message: 'Camp not found.' });

    if (name !== undefined) camp.name = escapeHtml(sanitize(name));
    if (capacity !== undefined) camp.capacity = Number(capacity);
    if (population !== undefined) camp.population = Number(population);
    if (managerId !== undefined) camp.managerId = managerId;
    if (disasterId !== undefined) camp.disasterId = disasterId || null;
    if (location !== undefined) {
      camp.location = typeof location === 'object' ? location : { name: String(location || '').trim() };
    }
    if (facilities !== undefined) {
      camp.facilities = Array.isArray(facilities) ? facilities : [];
    }
    if (resources !== undefined && Array.isArray(resources)) {
      camp.resources = resources;
    }

    await camp.save();

    const populated = await Camp.findById(camp._id)
      .populate('managerId', 'fullName email role')
      .populate('disasterId', 'title type severity status location');

    return res.json({ message: 'Camp updated successfully.', camp: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update camp.' });
  }
}

// ── Extend Camp: Manager / Admin sets a new planned closure date ────────────
async function extendCamp(req, res) {
  try {
    const { id } = req.params;
    const { newClosureDate, daysToAdd, reason } = req.body;

    const camp = await Camp.findById(id);
    if (!camp) return res.status(404).json({ message: 'Camp not found.' });

    let nextDate;
    if (newClosureDate) {
      nextDate = new Date(newClosureDate);
    } else if (daysToAdd) {
      const baseDate = camp.plannedClosureDate && new Date(camp.plannedClosureDate) > new Date()
        ? new Date(camp.plannedClosureDate)
        : new Date();
      nextDate = new Date(baseDate.getTime() + Number(daysToAdd) * 24 * 60 * 60 * 1000);
    } else {
      // Default extension is +30 days
      const baseDate = camp.plannedClosureDate && new Date(camp.plannedClosureDate) > new Date()
        ? new Date(camp.plannedClosureDate)
        : new Date();
      nextDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    camp.plannedClosureDate = nextDate;
    camp.status = 'extended';
    await camp.save();

    const populated = await Camp.findById(camp._id)
      .populate('managerId', 'fullName email role')
      .populate('disasterId', 'title type severity status location');

    return res.json({
      message: `Camp extension granted until ${nextDate.toLocaleDateString()}.`,
      camp: populated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to extend camp.' });
  }
}

// ── Confirm Closure: Manager / Admin explicitly decommissions the camp ──────
async function closeCamp(req, res) {
  try {
    const { id } = req.params;
    const camp = await Camp.findById(id);
    if (!camp) return res.status(404).json({ message: 'Camp not found.' });

    camp.status = 'closed';
    camp.closedAt = new Date();
    await camp.save();

    const populated = await Camp.findById(camp._id)
      .populate('managerId', 'fullName email role')
      .populate('disasterId', 'title type severity status location');

    return res.json({
      message: `Closure confirmed for camp "${camp.name}". Decommissioned on ${camp.closedAt.toLocaleDateString()}.`,
      camp: populated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to close camp.' });
  }
}

// ── Reopen Camp: Reactivates a closed camp ──────────────────────────────────
async function reopenCamp(req, res) {
  try {
    const { id } = req.params;
    const { plannedClosureDate } = req.body;

    const camp = await Camp.findById(id);
    if (!camp) return res.status(404).json({ message: 'Camp not found.' });

    camp.status = 'active';
    camp.closedAt = null;
    if (plannedClosureDate) {
      camp.plannedClosureDate = new Date(plannedClosureDate);
    } else {
      // Default to 60 days in the future
      camp.plannedClosureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    }
    await camp.save();

    const populated = await Camp.findById(camp._id)
      .populate('managerId', 'fullName email role')
      .populate('disasterId', 'title type severity status location');

    return res.json({ message: `Camp "${camp.name}" reactivated.`, camp: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to reopen camp.' });
  }
}

// ── Admin: Delete a camp ────────────────────────────────────────────────────
async function deleteCamp(req, res) {
  try {
    const { id } = req.params;
    const camp = await Camp.findByIdAndDelete(id);
    if (!camp) return res.status(404).json({ message: 'Camp not found.' });

    await CampNgo.deleteMany({ campId: id });
    return res.json({ message: 'Camp deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to delete camp.' });
  }
}

// ── Camp Manager: Get camps assigned to current user ────────────────────────
async function getMyAssignedCamps(req, res) {
  try {
    const now = new Date();
    const camps = await Camp.find({ managerId: req.user._id })
      .populate('disasterId', 'title type severity status location')
      .sort({ createdAt: -1 });

    const processed = await Promise.all(
      camps.map(async (camp) => {
        if (
          camp.status === 'active' &&
          camp.plannedClosureDate &&
          new Date(camp.plannedClosureDate) <= now
        ) {
          camp.status = 'closureDue';
          await camp.save();
        }
        return camp;
      })
    );

    return res.json(processed);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve assigned camps.' });
  }
}

module.exports = {
  getCamps,
  createCamp,
  updateCamp,
  extendCamp,
  closeCamp,
  reopenCamp,
  deleteCamp,
  getMyAssignedCamps,
};
