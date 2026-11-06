const express = require('express');
const router = express.Router();
const { getAllFaculty, upsertFaculty, bulkUpsertFaculty, deleteFaculty, getOfficeMetadata, saveOfficeMetadata } = require('../controllers/faculty.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/faculty
router.get('/', roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN', 'AO', 'OFFICE']), getAllFaculty);

// POST /api/faculty
router.post('/', roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN', 'AO']), upsertFaculty);

// POST /api/faculty/bulk
router.post('/bulk', roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN', 'AO']), bulkUpsertFaculty);


// GET /api/faculty/office-metadata
router.get('/office-metadata', roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN', 'AO', 'OFFICE']), getOfficeMetadata);

// POST /api/faculty/office-metadata
router.post('/office-metadata', roleMiddleware(['HOD', 'SUPER_ADMIN', 'AO']), saveOfficeMetadata);

// DELETE /api/faculty/:id
router.delete('/:id', roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN', 'AO']), deleteFaculty);

module.exports = router;
