import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { database } from '../models/database';

const router = Router();

// Create first location for a company
router.post('/create-first', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, address, city, state, zipCode, phone, manager } = req.body;

    // Get user's company
    const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Check if company already has locations
    const existingLocation = await database.get(
      'SELECT id FROM locations WHERE companyId = ? LIMIT 1',
      [user.companyId]
    );
    
    if (existingLocation) {
      return res.status(400).json({ error: 'Company already has locations. Use regular location creation.' });
    }

    // Generate location ID
    const locationId = Math.random().toString(36).substring(2, 15);

    // Create the location
    await database.run(
      `INSERT INTO locations (id, companyId, name, address, city, state, zipCode, phone, manager, country, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'United States', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [locationId, user.companyId, name, address, city, state, zipCode, phone, manager]
    );

    // Create default "Unassigned" list for this location
    const unassignedListId = Math.random().toString(36).substring(2, 15);
    await database.run(
      `INSERT INTO lists (id, companyId, locationId, name, color, textColor, createdAt, updatedAt)
       VALUES (?, ?, ?, 'Unassigned', '#6b7280', '#ffffff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [unassignedListId, user.companyId, locationId]
    );

    // Return the created location
    const location = await database.get('SELECT * FROM locations WHERE id = ?', [locationId]);

    res.json({
      message: 'First location created successfully',
      location,
      unassignedListId
    });
  } catch (error) {
    console.error('Error creating first location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Get all locations for current user's company
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get user's company
    const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Get all locations for the company
    const locations = await database.all(
      'SELECT * FROM locations WHERE companyId = ? AND isActive = 1 ORDER BY name',
      [user.companyId]
    );

    res.json({ locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Create a new location
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, address, city, state, zipCode, phone, manager } = req.body;

    // Get user's company
    const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Generate location ID
    const locationId = Math.random().toString(36).substring(2, 15);

    // Create the location
    await database.run(
      `INSERT INTO locations (id, companyId, name, address, city, state, zipCode, phone, manager, country, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'United States', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [locationId, user.companyId, name, address, city, state, zipCode, phone, manager]
    );

    // Create default "Unassigned" list for this location
    const unassignedListId = Math.random().toString(36).substring(2, 15);
    await database.run(
      `INSERT INTO lists (id, companyId, locationId, name, color, textColor, createdAt, updatedAt)
       VALUES (?, ?, ?, 'Unassigned', '#6b7280', '#ffffff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [unassignedListId, user.companyId, locationId]
    );

    // Return the created location
    const location = await database.get('SELECT * FROM locations WHERE id = ?', [locationId]);

    res.json({
      message: 'Location created successfully',
      location,
      unassignedListId
    });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Update a location
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const locationId = req.params.id;
    const { name, address, city, state, zipCode, phone, manager } = req.body;

    // Get user's company
    const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Verify location belongs to user's company
    const location = await database.get(
      'SELECT id FROM locations WHERE id = ? AND companyId = ?',
      [locationId, user.companyId]
    );
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Update the location
    await database.run(
      `UPDATE locations 
       SET name = ?, address = ?, city = ?, state = ?, zipCode = ?, phone = ?, manager = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, address, city, state, zipCode, phone, manager, locationId]
    );

    // Return updated location
    const updatedLocation = await database.get('SELECT * FROM locations WHERE id = ?', [locationId]);

    res.json({
      message: 'Location updated successfully',
      location: updatedLocation
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Delete a location
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const locationId = req.params.id;
    const { deleteItems } = req.body; // boolean: true = delete items, false = move to unassigned

    // Get user's company
    const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Verify location belongs to user's company
    const location = await database.get(
      'SELECT id FROM locations WHERE id = ? AND companyId = ?',
      [locationId, user.companyId]
    );
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (deleteItems) {
      // Delete all items in this location
      await database.run('DELETE FROM inventory_items WHERE locationId = ?', [locationId]);
      
      // Delete all lists in this location
      await database.run('DELETE FROM lists WHERE locationId = ?', [locationId]);
      
      // Delete user-location assignments
      await database.run('DELETE FROM user_locations WHERE locationId = ?', [locationId]);
    } else {
      // Move items to unassigned list
      // First, find or create an "Unassigned" list in another location
      const unassignedList = await database.get(
        `SELECT l.id, l.locationId FROM lists l 
         JOIN locations loc ON l.locationId = loc.id 
         WHERE l.name = 'Unassigned' AND l.companyId = ? AND l.locationId != ?
         LIMIT 1`,
        [user.companyId, locationId]
      );

      if (unassignedList) {
        // Move items to existing unassigned list
        await database.run(
          'UPDATE inventory_items SET locationId = ?, listId = ? WHERE locationId = ?',
          [unassignedList.locationId, unassignedList.id, locationId]
        );
      }
      
      // Delete lists in this location
      await database.run('DELETE FROM lists WHERE locationId = ?', [locationId]);
      
      // Delete user-location assignments
      await database.run('DELETE FROM user_locations WHERE locationId = ?', [locationId]);
    }

    // Delete the location
    await database.run('DELETE FROM locations WHERE id = ?', [locationId]);

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

export default router;
