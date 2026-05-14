import { supabase } from './config';

/**
 * Create a new category
 * @param {Object} categoryData - { competition_id, name, description, is_special_category }
 * @returns {Object} - Created category data
 */
export const createCategory = async (categoryData) => {
  try {
    console.log('Creating category:', categoryData);
    
    const { data, error } = await supabase
      .from('categories')
      .insert([{
        competition_id: categoryData.competition_id,
        name: categoryData.name,
        description: categoryData.description || null,
        is_special_category: categoryData.is_special_category || false,
        type: categoryData.type || 'dance' // NEW: category type (dance, variety, special)
      }])
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Category created:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error creating category:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all categories for a competition
 * @param {string} competitionId - UUID of competition
 * @returns {Array} - List of categories
 */
export const getCompetitionCategories = async (competitionId) => {
  try {
    console.log('Fetching categories for competition:', competitionId);
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('competition_id', competitionId)
      .order('name');

    if (error) throw error;
    
    console.log('✅ Categories fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get category by ID
 * @param {string} categoryId - UUID of category
 * @returns {Object} - Category data
 */
export const getCategory = async (categoryId) => {
  try {
    console.log('Fetching category:', categoryId);
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (error) throw error;
    
    console.log('✅ Category fetched:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching category:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update category
 * @param {string} categoryId - UUID of category
 * @param {Object} updates - Fields to update
 * @returns {Object} - Updated category data
 */
export const updateCategory = async (categoryId, updates) => {
  try {
    console.log('Updating category:', categoryId, updates);
    
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Category updated:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error updating category:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete category
 * @param {string} categoryId - UUID of category
 * @returns {Object} - Success status
 */
export const deleteCategory = async (categoryId) => {
  try {
    console.log('Deleting category:', categoryId);
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
    
    console.log('✅ Category deleted');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk create categories
 * @param {Array} categoriesData - Array of category objects
 * @returns {Array} - Created categories
 */
export const bulkCreateCategories = async (categoriesData) => {
  try {
    console.log('Bulk creating categories:', categoriesData.length);
    
    const { data, error } = await supabase
      .from('categories')
      .insert(categoriesData)
      .select();

    if (error) throw error;
    
    console.log('✅ Categories bulk created:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error bulk creating categories:', error);
    return { success: false, error: error.message };
  }
};

