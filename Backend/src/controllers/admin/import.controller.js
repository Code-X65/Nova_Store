const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bulkImportService = require('../../services/bulk-import.service');
const { redisClient } = require('../../config/redis');
const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../utils/logger');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `import-${suffix}${path.extname(file.originalname)}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only .xlsx / .xls workbook files are allowed'));
  },
});

const ENTITY_TYPES = ['product', 'variant', 'inventory', 'category'];

class ImportController {
  async upload(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
      const entityType = req.body.entityType;
      if (!ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ success: false, error: `entityType must be one of: ${ENTITY_TYPES.join(', ')}` });
      }

      const { data: job, error } = await supabaseAdmin
        .from('import_jobs')
        .insert({
          entity_type: entityType,
          file_format: path.extname(req.file.originalname).slice(1).toLowerCase(),
          status: 'queued',
          created_by: req.user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      const payload = JSON.stringify({ jobId: job.id, filePath: req.file.path, entityType, userId: req.user?.id });
      try {
        await redisClient.rPush('nova:import:queue', payload);
      } catch (redisErr) {
        logger.warn(`[Import] Redis unavailable, processing synchronously: ${redisErr.message}`);
        bulkImportService.processImport(job.id, req.file.path, entityType, req.user?.id).catch((e) =>
          logger.error('[Import] sync processing failed', e)
        );
      }

      res.status(202).json({ success: true, data: { jobId: job.id, status: 'queued' } });
    } catch (error) { next(error); }
  }

  async getStatus(req, res, next) {
    try {
      const { data, error } = await supabaseAdmin
        .from('import_jobs').select('*').eq('id', req.params.id).single();
      if (error || !data) return res.status(404).json({ success: false, error: 'Import job not found' });
      res.json({ success: true, data: { job: data } });
    } catch (error) { next(error); }
  }

  async getErrors(req, res, next) {
    try {
      const { data, error } = await supabaseAdmin
        .from('import_jobs').select('error_file_url').eq('id', req.params.id).single();
      if (error || !data || !data.error_file_url) {
        return res.status(404).json({ success: false, error: 'No error file available' });
      }
      const filePath = path.join(UPLOAD_DIR, path.basename(data.error_file_url));
      if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Error file missing' });
      res.download(filePath);
    } catch (error) { next(error); }
  }
}

module.exports = { ImportController: new ImportController(), upload: uploadMiddleware, ENTITY_TYPES };
