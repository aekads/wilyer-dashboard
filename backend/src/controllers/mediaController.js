// src/controllers/mediaController.js
// ============================================================
// AEKADS Media Library Controller with Folder Support
// ============================================================
const { query } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { deleteFile, getVideoThumbnail, getImageUrl } = require('../config/cloudinary');
const { createAuditLog } = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * POST /api/media/upload
 * Multer + Cloudinary handles the actual upload.
 * This stores metadata in PostgreSQL with folder support.
 */
const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file provided', 400);
    }

    const { orgId, userId } = req.user;
    const { name, tags, folderId } = req.body;
    const file = req.file;

    // Cloudinary metadata from multer-storage-cloudinary
    const {
      filename: publicId,
      path: secureUrl,
      mimetype,
      size,
      width,
      height,
      duration,
      format,
      resource_type
    } = file;

    // Generate thumbnail for videos
    let thumbnailUrl = null;
    if (resource_type === 'video' || mimetype?.startsWith('video/')) {
      thumbnailUrl = getVideoThumbnail(publicId);
    } else {
      thumbnailUrl = getImageUrl(publicId, { width: 400, height: 225, crop: 'fill' });
    }

    const parsedTags = tags
      ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()))
      : [];

    // Verify folder belongs to org if provided
    if (folderId) {
      const folderCheck = await query(
        'SELECT id FROM wilyer_folders WHERE id = $1 AND org_id = $2',
        [folderId, orgId]
      );
      if (!folderCheck.rows[0]) {
        throw new AppError('Folder not found', 404);
      }
    }

    const result = await query(`
      INSERT INTO wilyer_media_files (
        org_id, uploaded_by, name, original_filename,
        cloudinary_public_id, cloudinary_folder, secure_url, thumbnail_url,
        format, resource_type, file_size, width, height, duration, tags, folder_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      orgId, userId,
      name || file.originalname,
      file.originalname,
      publicId,
      `aekads/${orgId}/media`,
      secureUrl,
      thumbnailUrl,
      format || mimetype?.split('/')[1],
      resource_type || (mimetype?.startsWith('video/') ? 'video' : 'image'),
      size || file.size,
      width,
      height,
      duration,
      parsedTags,
      folderId || null
    ]);

    const media = result.rows[0];

    await createAuditLog({
      orgId, userId, action: 'media.upload',
      entityType: 'media', entityId: media.id,
      newValues: { name: media.name, resourceType: media.resource_type, folderId }
    });

    logger.info(`Media uploaded: ${media.name} by user ${userId}`);

    res.status(201).json({ success: true, data: media });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/media - List media files with folder filtering
 */
const getMedia = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const {
      type, tags, search, page = 1, limit = 24,
      sortBy = 'created_at', sortOrder = 'desc',
      folderId, includeSubfolders = 'false'
    } = req.query;

    const offset = (page - 1) * limit;
    let conditions = ['mf.org_id = $1', 'mf.is_deleted = FALSE'];
    let params = [orgId];
    let idx = 2;

    // Handle folder filtering
    if (folderId === 'root' || folderId === 'null') {
      conditions.push(`mf.folder_id IS NULL`);
    } else if (folderId) {
      if (includeSubfolders === 'true') {
        // Include files from all subfolders
        conditions.push(`
          mf.folder_id IN (
            WITH RECURSIVE folder_tree AS (
              SELECT id FROM wilyer_folders WHERE id = $${idx}
              UNION ALL
              SELECT f.id FROM wilyer_folders f
              INNER JOIN folder_tree ft ON ft.id = f.parent_id
            )
            SELECT id FROM folder_tree
          )
        `);
        params.push(folderId);
        idx++;
      } else {
        conditions.push(`mf.folder_id = $${idx++}`);
        params.push(folderId);
      }
    }

    if (type && type !== 'all') {
      conditions.push(`mf.resource_type = $${idx++}`);
      params.push(type === 'image' ? 'image' : 'video');
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      conditions.push(`mf.tags && $${idx++}::varchar[]`);
      params.push(tagArray);
    }
    
    if (search) {
      conditions.push(`(mf.name ILIKE $${idx} OR mf.original_filename ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const allowedSorts = ['created_at', 'name', 'file_size', 'play_count'];
    const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const where = conditions.join(' AND ');

    const [mediaResult, countResult] = await Promise.all([
      query(`
        SELECT 
          mf.*,
          u.first_name || ' ' || u.last_name AS uploader_name,
          f.name AS folder_name,
          (SELECT COUNT(*) FROM wilyer_playlist_items pi WHERE pi.media_id = mf.id) AS playlist_usage_count
        FROM wilyer_media_files mf
        LEFT JOIN wilyer_users u ON u.id = mf.uploaded_by
        LEFT JOIN wilyer_folders f ON f.id = mf.folder_id
        WHERE ${where}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...params, limit, offset]),
      query(`SELECT COUNT(*) FROM wilyer_media_files mf WHERE ${where}`, params)
    ]);

    res.json({
      success: true,
      data: mediaResult.rows,
      meta: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        folderId: folderId || null
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/media/:id - Get single media file
 */
const getMediaFile = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const { id } = req.params;

    const result = await query(`
      SELECT 
        mf.*,
        u.first_name || ' ' || u.last_name AS uploader_name,
        f.name AS folder_name,
        f.id AS folder_id,
        (SELECT COUNT(*) FROM wilyer_playlist_items pi WHERE pi.media_id = mf.id) AS playlist_usage_count
      FROM wilyer_media_files mf
      LEFT JOIN wilyer_users u ON u.id = mf.uploaded_by
      LEFT JOIN wilyer_folders f ON f.id = mf.folder_id
      WHERE mf.id = $1 AND mf.org_id = $2 AND mf.is_deleted = FALSE
    `, [id, orgId]);

    if (!result.rows[0]) {
      throw new AppError('Media file not found', 404);
    }

    // Increment play count (async, don't await)
    query(
      'UPDATE wilyer_media_files SET play_count = play_count + 1 WHERE id = $1',
      [id]
    ).catch(err => logger.error('Failed to increment play count:', err));

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/media/:id - Update media metadata
 */
const updateMedia = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { id } = req.params;
    const { name, tags, folderId } = req.body;

    // Get current values for audit log
    const current = await query(
      'SELECT * FROM wilyer_media_files WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (!current.rows[0]) {
      throw new AppError('Media file not found', 404);
    }

    // Verify folder belongs to org if provided
    if (folderId) {
      const folderCheck = await query(
        'SELECT id FROM wilyer_folders WHERE id = $1 AND org_id = $2',
        [folderId, orgId]
      );
      if (!folderCheck.rows[0]) {
        throw new AppError('Folder not found', 404);
      }
    }

    const parsedTags = tags
      ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()))
      : current.rows[0].tags;

    const result = await query(`
      UPDATE wilyer_media_files SET
        name = COALESCE($1, name),
        tags = $2,
        folder_id = COALESCE($3, folder_id),
        updated_at = NOW()
      WHERE id = $4 AND org_id = $5
      RETURNING *
    `, [name, parsedTags, folderId, id, orgId]);

    await createAuditLog({
      orgId, userId, action: 'media.update',
      entityType: 'media', entityId: id,
      oldValues: { name: current.rows[0].name, folderId: current.rows[0].folder_id },
      newValues: { name: name || current.rows[0].name, folderId }
    });

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/media/:id - Delete media file
 */
const deleteMedia = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { id } = req.params;

    // Check if media is used in any playlists
    const usageCheck = await query(
      'SELECT COUNT(*) FROM wilyer_playlist_items WHERE media_id = $1',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      throw new AppError('Cannot delete media that is used in playlists', 400);
    }

    // Get media info for Cloudinary deletion
    const media = await query(
      'SELECT cloudinary_public_id FROM wilyer_media_files WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (!media.rows[0]) {
      throw new AppError('Media file not found', 404);
    }

    // Delete from Cloudinary
    try {
      await deleteFile(media.rows[0].cloudinary_public_id);
    } catch (cloudinaryErr) {
      logger.error('Failed to delete from Cloudinary:', cloudinaryErr);
      // Continue with DB deletion even if Cloudinary fails
    }

    // Soft delete in database
    await query(`
      UPDATE wilyer_media_files SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1
      WHERE id = $2 AND org_id = $3
    `, [userId, id, orgId]);

    await createAuditLog({
      orgId, userId, action: 'media.delete',
      entityType: 'media', entityId: id,
      oldValues: { name: media.rows[0].cloudinary_public_id }
    });

    res.json({ success: true, message: 'Media deleted successfully' });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/media/storage-stats - Get storage statistics
 */
const getStorageStats = async (req, res, next) => {
  try {
    const { orgId } = req.user;

    const result = await query(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_bytes,
        COUNT(CASE WHEN resource_type = 'image' THEN 1 END) as image_count,
        SUM(CASE WHEN resource_type = 'image' THEN file_size ELSE 0 END) as image_bytes,
        COUNT(CASE WHEN resource_type = 'video' THEN 1 END) as video_count,
        SUM(CASE WHEN resource_type = 'video' THEN file_size ELSE 0 END) as video_bytes,
        COUNT(DISTINCT folder_id) as folder_count
      FROM wilyer_media_files
      WHERE org_id = $1 AND is_deleted = FALSE
    `, [orgId]);

    const stats = result.rows[0] || {
      total_files: 0,
      total_bytes: 0,
      image_count: 0,
      image_bytes: 0,
      video_count: 0,
      video_bytes: 0,
      folder_count: 0
    };

    res.json({ success: true, data: stats });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/media/folders - Create new folder
 */
const createFolder = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { name, parentId } = req.body;

    if (!name || name.trim() === '') {
      throw new AppError('Folder name is required', 400);
    }

    // Check for duplicate name in same parent
    const duplicateCheck = await query(
      `SELECT id FROM wilyer_folders 
       WHERE org_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3`,
      [orgId, parentId, name.trim()]
    );

    if (duplicateCheck.rows[0]) {
      throw new AppError('A folder with this name already exists', 400);
    }

    // Verify parent folder belongs to org if provided
    if (parentId) {
      const parentCheck = await query(
        'SELECT id FROM wilyer_folders WHERE id = $1 AND org_id = $2',
        [parentId, orgId]
      );
      if (!parentCheck.rows[0]) {
        throw new AppError('Parent folder not found', 404);
      }
    }

    const result = await query(`
      INSERT INTO wilyer_folders (org_id, parent_id, name, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [orgId, parentId || null, name.trim(), userId]);

    const folder = result.rows[0];

    await createAuditLog({
      orgId, userId, action: 'folder.create',
      entityType: 'folder', entityId: folder.id,
      newValues: { name: folder.name, parentId: folder.parent_id }
    });

    res.status(201).json({ success: true, data: folder });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/media/folders - Get folder tree
 */
const getFolders = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const { parentId } = req.query;

    // FIXED: Use let instead of const for the base query string
    let query_str = `
      WITH RECURSIVE folder_tree AS (
        SELECT 
          f.*,
          0 as depth,
          ARRAY[f.name]::varchar[] as path_names,
          ARRAY[f.id]::integer[] as path_ids
        FROM wilyer_folders f
        WHERE f.org_id = $1 AND f.parent_id IS NULL
        
        UNION ALL
        
        SELECT 
          f.*,
          ft.depth + 1,
          (ft.path_names || f.name)::varchar[],
          (ft.path_ids || f.id)::integer[]
        FROM wilyer_folders f
        INNER JOIN folder_tree ft ON ft.id = f.parent_id
        WHERE f.org_id = $1
      )
      SELECT 
        ft.*,
        (SELECT COUNT(*) FROM wilyer_media_files WHERE folder_id = ft.id AND is_deleted = FALSE) as file_count,
        (SELECT COUNT(*) FROM wilyer_folders WHERE parent_id = ft.id) as subfolder_count
      FROM folder_tree ft
    `;

    const params = [orgId];
    
    if (parentId) {
      // FIXED: Append to the existing query_str (now using let)
      query_str += ` WHERE ft.id = $2 OR $2 = ANY(ft.path_ids) ORDER BY ft.depth, ft.name`;
      params.push(parentId);
    } else {
      query_str += ` ORDER BY ft.depth, ft.name`;
    }

    const result = await query(query_str, params);
    res.json({ success: true, data: result.rows });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/media/folders/:id - Get single folder
 */
const getFolder = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const { id } = req.params;

    const result = await query(`
      SELECT 
        f.*,
        u.first_name || ' ' || u.last_name AS created_by_name,
        (SELECT COUNT(*) FROM wilyer_media_files WHERE folder_id = f.id AND is_deleted = FALSE) as file_count,
        (SELECT COUNT(*) FROM wilyer_folders WHERE parent_id = f.id) as subfolder_count
      FROM wilyer_folders f
      LEFT JOIN wilyer_users u ON u.id = f.created_by
      WHERE f.id = $1 AND f.org_id = $2
    `, [id, orgId]);

    if (!result.rows[0]) {
      throw new AppError('Folder not found', 404);
    }

    // Get breadcrumb path
    const breadcrumb = await query(`
      WITH RECURSIVE folder_path AS (
        SELECT id, name, parent_id, 0 as level
        FROM wilyer_folders WHERE id = $1
        UNION ALL
        SELECT f.id, f.name, f.parent_id, fp.level + 1
        FROM wilyer_folders f
        INNER JOIN folder_path fp ON fp.parent_id = f.id
      )
      SELECT id, name, parent_id
      FROM folder_path
      ORDER BY level DESC
    `, [id]);

    res.json({ 
      success: true, 
      data: {
        ...result.rows[0],
        path: breadcrumb.rows
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/media/folders/:id - Update folder
 */
const updateFolder = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { id } = req.params;
    const { name, parentId } = req.body;

    // Prevent moving folder into itself
    if (id === parentId) {
      throw new AppError('Cannot move folder into itself', 400);
    }

    if (name && name.trim() === '') {
      throw new AppError('Folder name cannot be empty', 400);
    }

    // Check if trying to move folder into its own child (circular reference)
    if (parentId) {
      const checkCircular = await query(`
        WITH RECURSIVE folder_tree AS (
          SELECT id FROM wilyer_folders WHERE id = $1
          UNION ALL
          SELECT f.id FROM wilyer_folders f
          INNER JOIN folder_tree ft ON ft.id = f.parent_id
        )
        SELECT id FROM folder_tree WHERE id = $2
      `, [id, parentId]);

      if (checkCircular.rows[0]) {
        throw new AppError('Cannot move folder into its own subfolder', 400);
      }
    }

    // Get current folder data
    const folder = await query(
      'SELECT name, parent_id FROM wilyer_folders WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    
    if (!folder.rows[0]) {
      throw new AppError('Folder not found', 404);
    }

    // Check duplicate name in new parent
    const newName = name || folder.rows[0].name;
    const newParentId = parentId !== undefined ? parentId : folder.rows[0].parent_id;

    const duplicateCheck = await query(
      `SELECT id FROM wilyer_folders 
       WHERE org_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3 AND id != $4`,
      [orgId, newParentId, newName, id]
    );

    if (duplicateCheck.rows[0]) {
      throw new AppError('A folder with this name already exists', 400);
    }

    // Verify new parent exists if provided
    if (newParentId) {
      const parentCheck = await query(
        'SELECT id FROM wilyer_folders WHERE id = $1 AND org_id = $2',
        [newParentId, orgId]
      );
      if (!parentCheck.rows[0]) {
        throw new AppError('Parent folder not found', 404);
      }
    }

    const result = await query(`
      UPDATE wilyer_folders SET
        name = $1,
        parent_id = $2,
        updated_at = NOW()
      WHERE id = $3 AND org_id = $4
      RETURNING *
    `, [newName, newParentId || null, id, orgId]);

    await createAuditLog({
      orgId, userId, action: 'folder.update',
      entityType: 'folder', entityId: id,
      oldValues: { name: folder.rows[0].name, parentId: folder.rows[0].parent_id },
      newValues: { name: newName, parentId: newParentId }
    });

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/media/folders/:id - Delete folder
 */
const deleteFolder = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { id } = req.params;
    const { moveToParent } = req.query;

    // Check if folder exists
    const folder = await query(
      'SELECT name, parent_id FROM wilyer_folders WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (!folder.rows[0]) {
      throw new AppError('Folder not found', 404);
    }

    // Check if folder has subfolders
    const subfolders = await query(
      'SELECT COUNT(*) FROM wilyer_folders WHERE parent_id = $1',
      [id]
    );

    const subfolderCount = parseInt(subfolders.rows[0].count);

    if (subfolderCount > 0 && moveToParent !== 'true') {
      throw new AppError('Folder has subfolders. Delete them first or use moveToParent=true', 400);
    }

    // Check if folder has files
    const files = await query(
      'SELECT COUNT(*) FROM wilyer_media_files WHERE folder_id = $1 AND is_deleted = FALSE',
      [id]
    );

    const fileCount = parseInt(files.rows[0].count);

    if (fileCount > 0 && moveToParent !== 'true') {
      throw new AppError('Folder contains files. Move them first or use moveToParent=true', 400);
    }

    if (moveToParent === 'true') {
      // Get parent_id before moving
      const parentId = folder.rows[0].parent_id;

      // Move files to parent folder
      if (fileCount > 0) {
        await query(
          'UPDATE wilyer_media_files SET folder_id = $1 WHERE folder_id = $2',
          [parentId, id]
        );
      }

      // Move subfolders to parent
      if (subfolderCount > 0) {
        await query(
          'UPDATE wilyer_folders SET parent_id = $1 WHERE parent_id = $2',
          [parentId, id]
        );
      }
    }

    // Delete folder
    await query(
      'DELETE FROM wilyer_folders WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    await createAuditLog({
      orgId, userId, action: 'folder.delete',
      entityType: 'folder', entityId: id,
      oldValues: { name: folder.rows[0].name }
    });

    res.json({ success: true, message: 'Folder deleted successfully' });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/media/move - Move multiple files to folder
 */
const moveFiles = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { fileIds, folderId } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new AppError('File IDs are required', 400);
    }

    // Verify folder exists if provided
    if (folderId && folderId !== 'null' && folderId !== 'root') {
      const folderCheck = await query(
        'SELECT id FROM wilyer_folders WHERE id = $1 AND org_id = $2',
        [folderId, orgId]
      );
      if (!folderCheck.rows[0]) {
        throw new AppError('Folder not found', 404);
      }
    }

    // Update files
    const targetFolder = folderId === 'null' || folderId === 'root' ? null : folderId;
    
    await query(
      `UPDATE wilyer_media_files 
       SET folder_id = $1, updated_at = NOW()
       WHERE id = ANY($2::int[]) AND org_id = $3`,
      [targetFolder, fileIds, orgId]
    );

    await createAuditLog({
      orgId, userId, action: 'media.move',
      entityType: 'media', entityId: null,
      newValues: { fileCount: fileIds.length, folderId: targetFolder }
    });

    res.json({ 
      success: true, 
      message: `${fileIds.length} files moved successfully` 
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { 
  uploadMedia, 
  getMedia, 
  getMediaFile, 
  updateMedia, 
  deleteMedia, 
  getStorageStats,
  createFolder,
  getFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  moveFiles
};