import { supabase } from './config';

/**
 * Subscribe to real-time score updates for a competition
 * @param {string} competitionId - UUID of competition
 * @param {Function} callback - Function to call when scores change
 * @returns {Object} - Subscription channel
 */
export const subscribeToScores = (competitionId, callback) => {
  console.log('📡 Subscribing to scores for competition:', competitionId);
  
  const channel = supabase
    .channel(`scores-${competitionId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'scores',
        filter: `competition_id=eq.${competitionId}`
      },
      (payload) => {
        console.log('📡 Score update received:', payload);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Scores subscription status:', status);
    });
  
  return channel;
};

/**
 * Subscribe to real-time entry updates for a competition
 * @param {string} competitionId - UUID of competition
 * @param {Function} callback - Function to call when entries change
 * @returns {Object} - Subscription channel
 */
export const subscribeToEntries = (competitionId, callback) => {
  console.log('📡 Subscribing to entries for competition:', competitionId);
  
  const channel = supabase
    .channel(`entries-${competitionId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'entries',
        filter: `competition_id=eq.${competitionId}`
      },
      (payload) => {
        console.log('📡 Entry update received:', payload);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Entries subscription status:', status);
    });
  
  return channel;
};

/**
 * Subscribe to medal standings updates
 * @param {string} competitionId - UUID of competition
 * @param {Function} callback - Function to call when medal standings change
 * @returns {Object} - Subscription channel
 */
export const subscribeToMedalStandings = (competitionId, callback) => {
  console.log('📡 Subscribing to medal standings for competition:', competitionId);
  
  const channel = supabase
    .channel(`medal-standings-${competitionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medal_standings',
        filter: `competition_id=eq.${competitionId}`
      },
      (payload) => {
        console.log('📡 Medal standings update received:', payload);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Medal standings subscription status:', status);
    });
  
  return channel;
};

/**
 * Subscribe to competition updates
 * @param {string} competitionId - UUID of competition
 * @param {Function} callback - Function to call when competition changes
 * @returns {Object} - Subscription channel
 */
export const subscribeToCompetition = (competitionId, callback) => {
  console.log('📡 Subscribing to competition:', competitionId);
  
  const channel = supabase
    .channel(`competition-${competitionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'competitions',
        filter: `id=eq.${competitionId}`
      },
      (payload) => {
        console.log('📡 Competition update received:', payload);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Competition subscription status:', status);
    });
  
  return channel;
};

/**
 * Subscribe to any table in real-time
 * @param {string} tableName - Name of the table to subscribe to
 * @param {Function} callback - Function to call when table changes
 * @param {string} filter - Optional filter (e.g., 'competition_id=eq.123')
 * @returns {Object} - Subscription channel
 */
export const subscribeToTable = (tableName, callback, filter = null) => {
  console.log(`📡 Subscribing to table: ${tableName}`, filter ? `with filter: ${filter}` : '');
  
  const channelName = filter ? `${tableName}-${filter}` : `${tableName}-all`;
  
  const channelConfig = {
    event: '*',
    schema: 'public',
    table: tableName
  };
  
  if (filter) {
    channelConfig.filter = filter;
  }
  
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', channelConfig, (payload) => {
      console.log(`📡 ${tableName} update received:`, payload);
      callback(payload);
    })
    .subscribe((status) => {
      console.log(`📡 ${tableName} subscription status:`, status);
    });
  
  return channel;
};

/**
 * Unsubscribe from a channel
 * @param {Object} channel - Channel object to unsubscribe from
 * @returns {Promise} - Unsubscribe promise
 */
export const unsubscribeFromChannel = async (channel) => {
  try {
    console.log('📡 Unsubscribing from channel');
    
    if (channel) {
      await supabase.removeChannel(channel);
      console.log('✅ Unsubscribed successfully');
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error unsubscribing:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to multiple tables at once
 * @param {string} competitionId - UUID of competition
 * @param {Object} callbacks - Object with callback functions { onScores, onEntries, onMedalStandings }
 * @returns {Array} - Array of subscription channels
 */
export const subscribeToCompetitionData = (competitionId, callbacks) => {
  console.log('📡 Subscribing to all competition data:', competitionId);
  
  const channels = [];
  
  if (callbacks.onScores) {
    channels.push(subscribeToScores(competitionId, callbacks.onScores));
  }
  
  if (callbacks.onEntries) {
    channels.push(subscribeToEntries(competitionId, callbacks.onEntries));
  }
  
  if (callbacks.onMedalStandings) {
    channels.push(subscribeToMedalStandings(competitionId, callbacks.onMedalStandings));
  }
  
  if (callbacks.onCompetition) {
    channels.push(subscribeToCompetition(competitionId, callbacks.onCompetition));
  }
  
  console.log('✅ Subscribed to', channels.length, 'channels');
  return channels;
};

/**
 * Unsubscribe from multiple channels
 * @param {Array} channels - Array of channel objects
 * @returns {Promise} - Unsubscribe promise
 */
export const unsubscribeFromAllChannels = async (channels) => {
  try {
    console.log('📡 Unsubscribing from all channels:', channels.length);
    
    const unsubscribePromises = channels.map(channel => 
      unsubscribeFromChannel(channel)
    );
    
    await Promise.all(unsubscribePromises);
    
    console.log('✅ Unsubscribed from all channels');
    return { success: true };
  } catch (error) {
    console.error('❌ Error unsubscribing from channels:', error);
    return { success: false, error: error.message };
  }
};

