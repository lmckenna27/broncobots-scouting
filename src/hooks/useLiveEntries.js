import { useState, useEffect, useCallback } from 'react';
import { 
  subscribeToEntries, 
  saveEntry, 
  updateEntry as updateEntryInFirebase,
  deleteEntry as deleteEntryFromFirebase,
  clearTeamEntries as clearTeamEntriesInFirebase
} from '../utils/firebase';

export default function useLiveEntries(user) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase entries for real-time updates
  // Only subscribe when user is authenticated
  useEffect(() => {
    setLoading(true);
    
    // Don't subscribe if user is not authenticated
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    
    const unsubscribe = subscribeToEntries((firebaseEntries) => {
      setEntries(firebaseEntries);
      setLoading(false);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user]);

  const addEntry = useCallback(async (entry) => {
    try {
      // Optimistically update local state first
      const newEntryId = entry.id || Date.now().toString();
      const newEntry = { ...entry, id: newEntryId };
      
      setEntries((prev) => {
        // Filter out any existing entry for this team (override behavior)
        const next = prev.filter((e) => e.teamNumber !== entry.teamNumber);
        // Add the new entry
        return [...next, newEntry];
      });
      
      // Then save to Firebase
      await saveEntry(newEntry);
      console.log('Entry added successfully:', newEntry);
    } catch (error) {
      console.error('Error adding entry:', error);
      // Rollback on error - remove the optimistic entry
      setEntries((prev) => prev.filter(e => e.id !== entry.id));
    }
  }, []);

  const updateEntry = useCallback(async (updatedEntry) => {
    try {
      await updateEntryInFirebase(updatedEntry);
      // The subscription will automatically update the state
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  }, []);

  const clearEntries = useCallback(async () => {
    // This clears all team entries - in practice, you'd want to handle this differently
    // For now, we'll clear each team's entries individually
    try {
      const teamNumbers = [...new Set(entries.map(e => e.teamNumber))];
      for (const teamNum of teamNumbers) {
        await clearTeamEntriesInFirebase(teamNum);
      }
    } catch (error) {
      console.error('Error clearing entries:', error);
    }
  }, [entries]);

  const deleteEntry = useCallback(async (entryId) => {
    try {
      // Find the entry to get the team number
      const entry = entries.find(e => e.id === entryId);
      if (entry) {
        await deleteEntryFromFirebase(entryId, entry.teamNumber);
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  }, [entries]);

  const clearEntriesByTeam = useCallback(async (teamNumber) => {
    try {
      await clearTeamEntriesInFirebase(teamNumber);
    } catch (error) {
      console.error('Error clearing team entries:', error);
    }
  }, []);

  return { entries, addEntry, updateEntry, clearEntries, deleteEntry, clearEntriesByTeam, loading };
}

