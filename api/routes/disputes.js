const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { callGemini } = require('../lib/gemini');

const COMPLAINT_WINDOW_MS = 2 * 60 * 60 * 1000;   // 2 hours
const NOSHOW_GRACE_MS     = 30 * 60 * 1000;          // 30 minutes

/**
 * POST /api/disputes
 * Files a dispute, calls DisputeAgent (Gemini) for AI resolution, logs trace.
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  try {
    const { booking_id, session_id, dispute_type, description } = req.body;
    console.log('[DISPUTE] Body received:', JSON.stringify(req.body));
    console.log('[DISPUTE] Headers:', req.headers['content-type']);

    if (!booking_id || !session_id || !dispute_type) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'booking_id, session_id, dispute_type required' });
    }

    // Fetch booking + maid details for AI context
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, maids(*)')
      .eq('id', booking_id)
      .single();

    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.session_id !== session_id) return res.status(403).json({ error: 'FORBIDDEN' });

    const now = Date.now();

    if (dispute_type === 'quality_complaint') {
      const completedAt = new Date(booking.updated_at).getTime();
      if (now - completedAt > COMPLAINT_WINDOW_MS) {
        return res.status(400).json({ error: 'WINDOW_EXPIRED', message: 'Quality complaint window is 2 hours after job completion' });
      }
    }

    if (dispute_type === 'no_show') {
      const scheduledAt = new Date(`${booking.scheduled_date}T${booking.scheduled_start || '00:00'}`).getTime();
      if (now - scheduledAt < NOSHOW_GRACE_MS) {
        return res.status(400).json({ error: 'TOO_EARLY', message: 'Please wait 30 minutes past scheduled start before reporting a no-show' });
      }
    }

    // ── DisputeAgent: AI-powered resolution ──────────────────────────────────
    const serviceName = (booking?.service_types || []).join(', ') || 'home service';
    const maidName = booking?.maids?.name || booking?.maid_name || 'Unknown';
    const rating = booking?.maids?.avg_rating || 'N/A';
    const jobs = booking?.maids?.jobs_completed || 0;
    const price = booking?.agreed_price || booking?.total_price || 0;

    const prompt = `You are a fair AI dispute resolution agent for HomeMaid, a domestic services platform in Pakistan.

Booking details:
- Service: ${serviceName}
- Date: ${booking?.scheduled_date || 'unknown'}
- Maid: ${maidName} (Rating: ${rating}/5, Jobs: ${jobs})
- Price paid: Rs. ${price}
- Dispute type: ${dispute_type}
- User's description: "${description || 'No description provided'}"

Be fair to both the homeowner and the maid. Consider the maid's track record.
For no_show disputes with verified maids, lean towards refund_full.
For quality_complaint disputes, lean towards refund_partial or discount_next.
For price_dispute, lean towards discount_next unless price was clearly wrong.

Respond ONLY with valid JSON matching this exact schema:
{
  "assessment": "brief 1-sentence assessment in Roman Urdu",
  "resolution": "one of: refund_full|refund_partial|discount_next|no_action|escalate_human",
  "refund_percentage": 0,
  "message_to_user": "friendly 1-2 sentence Roman Urdu message explaining the decision",
  "reasoning": "brief English reasoning for audit log"
}`;

    let resolution = null;
    try {
      const aiResult = await callGemini(
        'DisputeAgent',
        prompt,
        'dispute',
        booking_id,
        true, // expect JSON
        session_id
      );
      resolution = typeof aiResult === 'object' ? aiResult : JSON.parse(aiResult);
    } catch (aiErr) {
      console.warn('[DISPUTE] AI resolution failed, using fallback:', aiErr.message);
      resolution = {
        assessment: 'Aap ki shikayat darj ho gayi hai.',
        resolution: 'escalate_human',
        refund_percentage: 0,
        message_to_user: 'Hamara team 24 ghante mein aap se rabita karega aur masle ka hal nikaala jayega.',
        reasoning: 'AI fallback due to error',
      };
    }

    // Insert dispute record
    const { data: disputeRecord, error: insertErr } = await supabase
      .from('disputes')
      .insert({
        booking_id,
        session_id,
        dispute_type,
        description: description || '',
        status: 'open',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Update booking status to 'disputed'
    await supabase
      .from('bookings')
      .update({ status: 'disputed', updated_at: new Date().toISOString() })
      .eq('id', booking_id);

    console.log(`[DISPUTE] Resolved: ${dispute_type} → ${resolution.resolution} (${Date.now() - startTime}ms)`);

    return res.status(201).json({
      success: true,
      dispute_id: disputeRecord?.id,
      resolution,
    });
  } catch (err) {
    console.error('[POST /disputes]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
