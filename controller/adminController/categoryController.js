const categorySchema = require('../../model/categorySchema');

// Add a category
const addCategory = async (req, res) => {
    try {
        let { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Category name is required' });
        }
        name = name.trim();

        // Check if category already exists (case-insensitive)
        const existingCategory = await categorySchema.findOne({
            name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });

        if (existingCategory) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const newCategory = new categorySchema({ name, isDeleted: false });
        await newCategory.save();
        
        return res.status(200).json({ success: true, message: 'Category added successfully', category: newCategory });
    } catch (error) {
        console.error(`Error while adding category: ${error.message}`);
        return res.status(500).json({ message: 'Failed to add category' });
    }
};

// Render Category list page
const geteditCategories = async (req, res) => {
    try {
        const categories = await categorySchema.find({}).sort({ createdAt: -1 });

        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.json({ success: true, categories });
        }

        res.render('admin/Categorylist', { categories });
    } catch (error) {
        console.error('Error rendering category page:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Edit a category
const editCategory = async (req, res) => {
    try {
        const { id } = req.params;
        let { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Category name cannot be empty' });
        }
        name = name.trim();

        // Check duplicate name excluding current category
        const existingCategory = await categorySchema.findOne({
            _id: { $ne: id },
            name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });

        if (existingCategory) {
            return res.status(400).json({ message: 'A category with this name already exists' });
        }

        const updatedCategory = await categorySchema.findByIdAndUpdate(id, { name }, { new: true });

        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }

        res.status(200).json({ success: true, message: 'Category updated successfully', category: updatedCategory });
    } catch (error) {
        console.error(`Error while editing category: ${error.message}`);
        res.status(500).json({ message: 'An error occurred while updating the category' });
    }
};

// Render the edit form for a specific category
const renderEditCategoryForm = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await categorySchema.findById(id);

        if (!category) {
            return res.status(404).send('Category not found');
        }

        res.render('admin/Categorylist', { categories: [category] });
    } catch (error) {
        console.error('Error rendering edit category form:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Block / Unlist a category
const blockCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        const category = await categorySchema.findByIdAndUpdate(
            categoryId,
            { isDeleted: true },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        return res.status(200).json({ success: true, message: 'Category blocked successfully', category });
    } catch (error) {
        return res.status(500).json({ message: 'Error blocking category', error: error.message });
    }
};

// Unblock / List a category
const unblockCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        const category = await categorySchema.findByIdAndUpdate(
            categoryId,
            { isDeleted: false },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        return res.status(200).json({ success: true, message: 'Category unblocked successfully', category });
    } catch (error) {
        return res.status(500).json({ message: 'Error unblocking category', error: error.message });
    }
};

// Delete a category permanently
const deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        const category = await categorySchema.findByIdAndDelete(categoryId);

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        return res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        console.error(`Error deleting category: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
    }
};

// API: Get categories for user / public dropdowns
const getCategoriesForUser = async (req, res) => {
    try {
        const categories = await categorySchema.find({ isDeleted: false });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Failed to fetch categories' });
    }
};

module.exports = {
    addCategory,
    editCategory,
    renderEditCategoryForm,
    geteditCategories,
    getCategoriesForUser,
    blockCategory,
    unblockCategory,
    deleteCategory
};

