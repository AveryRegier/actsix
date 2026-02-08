import { getLogger } from '../util/logger.js';
import { ApiError } from '../util/error.js';
import { safeCollectionFind, safeCollectionInsert, safeCollectionUpdate } from '../util/helpers.js';
import { verifyRole } from '../auth/auth.js';

/**
 * Validate address object
 */
function validateAddress(address) {
  if (!address) {
    return { error: 'Validation failed', message: 'Address is required' };
  }
  if (!address.street || typeof address.street !== 'string' || address.street.trim().length === 0) {
    return { error: 'Validation failed', message: 'Street address is required' };
  }
  if (!address.city || typeof address.city !== 'string' || address.city.trim().length === 0) {
    return { error: 'Validation failed', message: 'City is required' };
  }
  if (!address.state || typeof address.state !== 'string' || address.state.length !== 2) {
    return { error: 'Validation failed', message: 'State must be a 2-letter code' };
  }
  if (!address.zipCode || !/^[0-9]{5}(?:-[0-9]{4})?$/.test(address.zipCode)) {
    return { error: 'Validation failed', message: 'Zip code must be a valid US zip code (12345 or 12345-6789)' };
  }
  return null;
}

/**
 * Validate phone number format
 */
function validatePhone(phone) {
  if (!phone) return null;
  // Allow formats: (515) 241-6212, 515-241-6212, 5152416212
  const phoneRegex = /^[\d\s\-\(\)]+$/;
  if (!phoneRegex.test(phone)) {
    return { error: 'Validation failed', message: 'Phone number contains invalid characters' };
  }
  return null;
}

/**
 * Validate URL format
 */
function validateUrl(url) {
  if (!url) return null;
  try {
    new URL(url);
    return null;
  } catch {
    return { error: 'Validation failed', message: 'Website must be a valid URL' };
  }
}

/**
 * Validate location type
 */
function validateLocationType(type) {
  const validTypes = ['hospital', 'nursing_home', 'assisted_living', 'rehab'];
  if (!validTypes.includes(type)) {
    return { 
      error: 'Validation failed', 
      message: `Location type must be one of: ${validTypes.join(', ')}` 
    };
  }
  return null;
}

/**
 * Validate and prepare location data
 */
function validateLocationData(data, isUpdate = false) {
  const errors = [];

  // Name validation
  if (!isUpdate || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Name is required');
    } else if (data.name.length > 200) {
      errors.push('Name must be 200 characters or less');
    }
  }

  // Type validation
  if (!isUpdate || data.type !== undefined) {
    if (!data.type) {
      errors.push('Type is required');
    } else {
      const typeError = validateLocationType(data.type);
      if (typeError) errors.push(typeError.message);
    }
  }

  // Address validation
  if (!isUpdate || data.address !== undefined) {
    const addressError = validateAddress(data.address);
    if (addressError) errors.push(addressError.message);
  }

  // Phone validation (optional)
  if (data.phone) {
    const phoneError = validatePhone(data.phone);
    if (phoneError) errors.push(phoneError.message);
  }

  // Website validation (optional)
  if (data.website) {
    const urlError = validateUrl(data.website);
    if (urlError) errors.push(urlError.message);
  }

  // Visiting hours validation (optional, but limit length)
  if (data.visitingHours && data.visitingHours.length > 200) {
    errors.push('Visiting hours must be 200 characters or less');
  }

  if (errors.length > 0) {
    return { error: 'Validation failed', message: errors.join('; ') };
  }

  return null;
}

export default function registerCommonLocationRoutes(app) {
  /**
   * GET /api/common-locations
   * List all active common locations
   * Auth: All authenticated users (deacon, staff, member)
   */
  app.get('/api/common-locations', async (c) => {
    try {
      // Get all active locations
      const locations = await safeCollectionFind('common_locations', { isActive: true });
      
      // Sort by type, then name
      locations.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.name.localeCompare(b.name);
      });

      getLogger().debug('GET /api/common-locations - Returning locations:', locations.map(l => ({ name: l.name, _id: l._id, type: l.type })));
      return c.json({ locations, count: locations.length });
    } catch (error) {
      getLogger().error(error, 'Error fetching common locations');
      return c.json({ error: 'Failed to fetch common locations', message: error.message }, 500);
    }
  });

  /**
   * GET /api/common-locations/:id
   * Get specific location details
   * Auth: All authenticated users
   */
  app.get('/api/common-locations/:id', async (c) => {
    try {
      const locationId = c.req.param('id');
      const locations = await safeCollectionFind('common_locations', { _id: locationId });
      
      if (!locations || locations.length === 0) {
        return c.json({ error: 'Location not found', message: 'No location found with the given ID' }, 404);
      }

      const location = locations[0];
      
      // Return 404 for soft-deleted locations
      if (!location.isActive) {
        return c.json({ error: 'Location not found', message: 'Location has been deleted' }, 404);
      }

      return c.json({ location });
    } catch (error) {
      getLogger().error(error, 'Error fetching common location');
      return c.json({ error: 'Failed to fetch location', message: error.message }, 500);
    }
  });

  /**
   * POST /api/common-locations
   * Add new common location
   * Auth: Staff only
   */
  app.post('/api/common-locations', async (c) => {
    if (!verifyRole(c, ['staff'])) {
      return c.json({ error: 'Unauthorized', message: 'Only staff can create locations' }, 403);
    }

    try {
      const body = await c.req.json();

      // Validate all required fields
      const validationError = validateLocationData(body, false);
      if (validationError) {
        return c.json(validationError, 400);
      }

      // Prepare location document
      const location = {
        name: body.name.trim(),
        type: body.type,
        address: {
          street: body.address.street.trim(),
          city: body.address.city.trim(),
          state: body.address.state.toUpperCase(),
          zipCode: body.address.zipCode.trim()
        },
        phone: body.phone?.trim() || '',
        website: body.website?.trim() || '',
        visitingHours: body.visitingHours?.trim() || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await safeCollectionInsert('common_locations', location);
      const locationId = result.insertedId?.toString();

      getLogger().info({ locationId, name: location.name }, 'Created common location');

      return c.json({ 
        success: true,
        locationId,
        location: { ...location, _id: locationId }
      }, 201);
    } catch (error) {
      getLogger().error(error, 'Error creating common location');
      return c.json({ error: 'Failed to create location', message: error.message }, 500);
    }
  });

  /**
   * PUT /api/common-locations/:id
   * Update existing location
   * Auth: Staff only
   */
  app.put('/api/common-locations/:id', async (c) => {
    if (!verifyRole(c, ['staff'])) {
      return c.json({ error: 'Unauthorized', message: 'Only staff can update locations' }, 403);
    }

    try {
      const locationId = c.req.param('id');
      const body = await c.req.json();

      // Check if location exists
      const existing = await safeCollectionFind('common_locations', { _id: locationId });
      if (!existing || existing.length === 0) {
        return c.json({ error: 'Location not found', message: 'No location found with the given ID' }, 404);
      }

      // Validate update data
      const validationError = validateLocationData(body, true);
      if (validationError) {
        return c.json(validationError, 400);
      }

      // Build update object (only include provided fields)
      const updates = {
        updatedAt: new Date().toISOString()
      };

      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.type !== undefined) updates.type = body.type;
      if (body.address !== undefined) {
        updates.address = {
          street: body.address.street.trim(),
          city: body.address.city.trim(),
          state: body.address.state.toUpperCase(),
          zipCode: body.address.zipCode.trim()
        };
      }
      if (body.phone !== undefined) updates.phone = body.phone.trim();
      if (body.website !== undefined) updates.website = body.website.trim();
      if (body.visitingHours !== undefined) updates.visitingHours = body.visitingHours.trim();

      await safeCollectionUpdate('common_locations', { _id: locationId }, updates);

      getLogger().info({ locationId, updates }, 'Updated common location');

      // Fetch and return updated location
      const updated = await safeCollectionFind('common_locations', { _id: locationId });

      return c.json({ 
        success: true,
        location: updated[0]
      });
    } catch (error) {
      getLogger().error(error, 'Error updating common location');
      return c.json({ error: 'Failed to update location', message: error.message }, 500);
    }
  });

  /**
   * DELETE /api/common-locations/:id
   * Soft delete location (set isActive = false)
   * Auth: Staff only
   */
  app.delete('/api/common-locations/:id', async (c) => {
    if (!verifyRole(c, ['staff'])) {
      return c.json({ error: 'Unauthorized', message: 'Only staff can delete locations' }, 403);
    }

    try {
      const locationId = c.req.param('id');

      // Check if location exists
      const existing = await safeCollectionFind('common_locations', { _id: locationId });
      if (!existing || existing.length === 0) {
        return c.json({ error: 'Location not found', message: 'No location found with the given ID' }, 404);
      }

      if (!existing[0].isActive) {
        return c.json({ error: 'Location already deleted' }, 400);
      }

      // Check if any members are currently at this location
      const membersAtLocation = await safeCollectionFind('members', {
        'temporaryAddress.locationId': locationId,
        'temporaryAddress.isActive': true
      });

      if (membersAtLocation && membersAtLocation.length > 0) {
        return c.json({ 
          error: 'Cannot delete location',
          message: `${membersAtLocation.length} member(s) currently at this location. Please reassign them first.`
        }, 400);
      }

      // Soft delete: set isActive = false
      await safeCollectionUpdate('common_locations', { _id: locationId }, {
        isActive: false,
        updatedAt: new Date().toISOString()
      });

      getLogger().info({ locationId }, 'Soft deleted common location');

      return c.json({ success: true });
    } catch (error) {
      getLogger().error(error, 'Error deleting common location');
      return c.json({ error: 'Failed to delete location', message: error.message }, 500);
    }
  });
}
