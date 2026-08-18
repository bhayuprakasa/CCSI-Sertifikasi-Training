const express = require('express');
const router = express.Router();
const pool = require('../db');

// ─── GET all workflows ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [workflows] = await pool.query(
      'SELECT * FROM cfg_approval_workflow ORDER BY workflow_id'
    );
    const [layers] = await pool.query(
      'SELECT * FROM cfg_approval_layer ORDER BY workflow_id, layer_order'
    );
    const [approvers] = await pool.query(
      'SELECT * FROM cfg_approval_approver ORDER BY layer_id, approver_order, approver_id'
    );

    const result = workflows.map(w => ({
      ...w,
      layers: layers
        .filter(l => l.workflow_id === w.workflow_id)
        .map(l => ({
          ...l,
          approvers: approvers.filter(a => a.layer_id === l.layer_id),
        })),
    }));

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET single workflow ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [wf] = await pool.query(
      'SELECT * FROM cfg_approval_workflow WHERE workflow_id = ?',
      [req.params.id]
    );
    if (!wf.length) return res.status(404).json({ error: 'Workflow tidak ditemukan' });

    const [layers] = await pool.query(
      'SELECT * FROM cfg_approval_layer WHERE workflow_id = ? ORDER BY layer_order',
      [req.params.id]
    );
    const layerIds = layers.map(l => l.layer_id);
    let approvers = [];
    if (layerIds.length) {
      [approvers] = await pool.query(
        `SELECT * FROM cfg_approval_approver WHERE layer_id IN (${layerIds.map(() => '?').join(',')}) ORDER BY layer_id, approver_order, approver_id`,
        layerIds
      );
    }

    res.json({
      ...wf[0],
      layers: layers.map(l => ({
        ...l,
        approvers: approvers.filter(a => a.layer_id === l.layer_id),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST create workflow ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { workflow_name, form_type, description, is_active, layers } = req.body;

  if (!workflow_name || !form_type) {
    return res.status(400).json({ error: 'workflow_name dan form_type wajib diisi' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [wfResult] = await conn.query(
      'INSERT INTO cfg_approval_workflow (workflow_name, form_type, description, is_active) VALUES (?,?,?,?)',
      [workflow_name, form_type, description || null, is_active != null ? (is_active ? 1 : 0) : 1]
    );
    const workflowId = wfResult.insertId;

    for (const layer of (layers || [])) {
      const [lResult] = await conn.query(
        `INSERT INTO cfg_approval_layer
          (workflow_id, layer_order, layer_name, criteria_field, criteria_value, auto_ascend)
         VALUES (?,?,?,?,?,?)`,
        [
          workflowId,
          layer.layer_order,
          layer.layer_name,
          layer.criteria_field || 'all_employee',
          layer.criteria_value || null,
          layer.auto_ascend ? 1 : 0,
        ]
      );
      const layerId = lResult.insertId;

      for (const ap of (layer.approvers || [])) {
        await conn.query(
          `INSERT INTO cfg_approval_approver
            (layer_id, approver_order, approver_field, approver_action, approver_value, approver_display,
             approver_name, approver_email, approver_role, criteria_type)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            layerId,
            ap.approver_order || 1,
            ap.approver_field || 'employee_id',
            ap.approver_action || 'requested',
            ap.approver_value || null,
            ap.approver_display || null,
            ap.approver_name || '',
            ap.approver_email || '',
            ap.approver_role || null,
            'always',
          ]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ workflow_id: workflowId, message: 'Workflow berhasil dibuat' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// ─── PUT update workflow ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { workflow_name, form_type, description, is_active, layers } = req.body;
  const workflowId = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'UPDATE cfg_approval_workflow SET workflow_name=?, form_type=?, description=?, is_active=?, updated_at=NOW() WHERE workflow_id=?',
      [workflow_name, form_type, description || null, is_active != null ? (is_active ? 1 : 0) : 1, workflowId]
    );

    await conn.query('DELETE FROM cfg_approval_layer WHERE workflow_id = ?', [workflowId]);

    for (const layer of (layers || [])) {
      const [lResult] = await conn.query(
        `INSERT INTO cfg_approval_layer
          (workflow_id, layer_order, layer_name, criteria_field, criteria_value, auto_ascend)
         VALUES (?,?,?,?,?,?)`,
        [
          workflowId,
          layer.layer_order,
          layer.layer_name,
          layer.criteria_field || 'all_employee',
          layer.criteria_value || null,
          layer.auto_ascend ? 1 : 0,
        ]
      );
      const layerId = lResult.insertId;

      for (const ap of (layer.approvers || [])) {
        await conn.query(
          `INSERT INTO cfg_approval_approver
            (layer_id, approver_order, approver_field, approver_action, approver_value, approver_display,
             approver_name, approver_email, approver_role, criteria_type)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            layerId,
            ap.approver_order || 1,
            ap.approver_field || 'employee_id',
            ap.approver_action || 'requested',
            ap.approver_value || null,
            ap.approver_display || null,
            ap.approver_name || '',
            ap.approver_email || '',
            ap.approver_role || null,
            'always',
          ]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Workflow berhasil diperbarui' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// ─── PATCH toggle active ──────────────────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  try {
    await pool.query(
      'UPDATE cfg_approval_workflow SET is_active = NOT is_active, updated_at = NOW() WHERE workflow_id = ?',
      [req.params.id]
    );
    const [[wf]] = await pool.query('SELECT is_active FROM cfg_approval_workflow WHERE workflow_id = ?', [req.params.id]);
    res.json({ is_active: wf.is_active });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE workflow ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM cfg_approval_workflow WHERE workflow_id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET form types ───────────────────────────────────────────────────────────
router.get('/meta/form-types', (req, res) => {
  res.json([
    { value: 'training_request', label: 'Permohonan Pelatihan' },
    { value: 'training_needs',   label: 'Kebutuhan Pelatihan (TNA)' },
    { value: 'certification',    label: 'Sertifikasi' },
  ]);
});

module.exports = router;
