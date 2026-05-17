const express = require('express');
const router = express.Router();

// Base rates per hour (mock data for deterministic pricing)
const BASE_RATES = {
  cleaning: 800,
  laundry: 600,
  cooking: 1000,
  childcare: 1200,
};

/**
 * POST /api/pricing/calculate
 * Calculates a deterministic price range based on requested services and complexity.
 */
router.post('/calculate', (req, res) => {
  try {
    const { service_types = [], complexity = {} } = req.body;
    
    if (!service_types.length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'service_types is required' });
    }

    let baseHourlyRate = 0;
    service_types.forEach(type => {
      baseHourlyRate += BASE_RATES[type] || 800; // default 800 if unknown
    });

    // Determine estimated duration
    let durationHours = complexity.duration_hours || 2; 
    
    // Add time for rooms if it's cleaning
    if (service_types.includes('cleaning') && complexity.rooms) {
      durationHours = Math.max(durationHours, complexity.rooms * 0.75);
    }

    // Baseline calculation
    let recommendedPrice = Math.round(baseHourlyRate * durationHours);
    
    // Add extra cost for specific extra tasks (e.g., deep cleaning, ironing)
    if (complexity.tasks && complexity.tasks.length > 0) {
       recommendedPrice += (complexity.tasks.length * 300);
    }

    // Create a realistic min/max range around the recommended price (±15%)
    // Round to nearest 50
    const priceMin = Math.round((recommendedPrice * 0.85) / 50) * 50;
    const priceMax = Math.round((recommendedPrice * 1.15) / 50) * 50;

    return res.json({
      recommended_price: recommendedPrice,
      price_min: priceMin,
      price_max: priceMax,
      breakdown: {
        base_rate: baseHourlyRate,
        estimated_hours: durationHours.toFixed(1),
        tasks_extra: complexity.tasks?.length ? complexity.tasks.length * 300 : 0
      }
    });

  } catch (err) {
    console.error('[POST /pricing/calculate]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
