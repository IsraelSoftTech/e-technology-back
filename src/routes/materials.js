const express = require('express');
const pool = require('../services/db');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// List materials for a class
router.get('/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const result = await pool.query(
      `SELECT id, class_id, uploader_id, title, file_url, file_type, created_at
         FROM class_materials
        WHERE class_id = $1
        ORDER BY created_at DESC`,
      [classId]
    );
    // Normalize any relative URLs to absolute
    const host = `${req.protocol}://${req.get('host')}`;
    const materials = result.rows.map(m => ({
      ...m,
      file_url: String(m.file_url || '').startsWith('/uploads') ? `${host}${m.file_url}` : m.file_url,
    }));
    res.json({ materials });
  } catch (error) {
    console.error('List materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add material (link or uploaded file data)
router.post('/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const { uploaderId, title, file_url, file_type, file_data, filename } = req.body || {};
    if (!uploaderId) return res.status(400).json({ error: 'uploaderId required' });

    let finalUrl = file_url || null;
    let finalType = file_type || null;

    // If file_data is provided, save it to disk under uploads/materials
    if (!finalUrl && file_data && filename) {
      const uploadsRoot = path.join(__dirname, '../../uploads');
      const materialsDir = path.join(uploadsRoot, 'materials');
      if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot);
      if (!fs.existsSync(materialsDir)) fs.mkdirSync(materialsDir);
      const safeName = `${Date.now()}-${String(filename).replace(/[^a-zA-Z0-9_.-]/g,'_')}`;
      const targetPath = path.join(materialsDir, safeName);
      const base64 = String(file_data).split(',').pop();
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(targetPath, buffer);
      const rel = `/uploads/materials/${safeName}`;
      finalUrl = `${req.protocol}://${req.get('host')}${rel}`;
      // Try to infer mime from extension
      const ext = path.extname(safeName).toLowerCase();
      if (!finalType) {
        if (ext === '.pdf') finalType = 'application/pdf';
        else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') finalType = `image/${ext.replace('.','')}`;
        else if (ext === '.mp4' || ext === '.mov' || ext === '.webm' || ext === '.ogg') finalType = 'video/mp4';
        else if (ext === '.ppt' || ext === '.pptx') finalType = 'application/vnd.ms-powerpoint';
        else if (ext === '.doc' || ext === '.docx') finalType = 'application/msword';
        else if (ext === '.xls' || ext === '.xlsx') finalType = 'application/vnd.ms-excel';
        else finalType = 'application/octet-stream';
      }
    }

    if (!finalUrl) return res.status(400).json({ error: 'Provide file_url or file_data+filename' });

    const result = await pool.query(
      `INSERT INTO class_materials (class_id, uploader_id, title, file_url, file_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, class_id, uploader_id, title, file_url, file_type, created_at`,
      [classId, uploaderId, title || null, finalUrl, finalType]
    );
    res.status(201).json({ message: 'Material added', material: result.rows[0] });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete material
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM class_materials WHERE id = $1', [id]);
    res.json({ message: 'Material deleted' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


