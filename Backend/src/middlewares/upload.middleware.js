const multer = require('multer');

// Configure multer for memory storage (for direct upload to Supabase)
const storage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  // Check double extensions
  const nameParts = file.originalname.split('.');
  if (nameParts.length > 2) {
    const error = new Error('Invalid file name. Double extensions are not allowed.');
    error.statusCode = 400;
    return cb(error, false);
  }

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Not a valid image! Allowed formats: JPEG, PNG, WEBP.');
    error.statusCode = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;
