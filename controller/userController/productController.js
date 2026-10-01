const userSchema=require('../../model/userSchema')
const productSchema=require('../../model/productSchema')
const categorySchema=require('../../model/categorySchema')
const Offer=require('../../model/offerSchema')
const Review = require('../../model/reviewSchema')



// Controller to get products by category
const getProductsByCategory = async (req, res) => {
  try {
   
      const categoryName = req.params.categoryName;
   

      // First, find the category by its name
      const category = await categorySchema.findOne({ name: categoryName });
      if (!category) {
          return res.status(404).send('Category not found');
      }
      
     
      // Then, find products that match the category's ObjectId
      const products = await productSchema.find({ category: category._id, isActive: true })
                                    .populate('category'); // populate to get category details if needed
     
    
      // Render the EJS file with the fetched products and category name
      res.render('user/categoryProducts', { products, categoryName });
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};



// Get Product Detail by ID
const getProductDetail = async (req, res) => {
    try {
        console.log("entered product detail")
        const productId = req.params.id; // Get product ID from URL params
        const product = await productSchema.findById(productId).populate('category'); // Fetch product and populate category

        if (!product) {
            return res.status(404).render('404', { message: 'Product not found' });
        }

        const currentDate = new Date();

        // Fetch applicable offers
        const applicableOffers = await Offer.find({
            $and: [
                { isActive: true },
                { startDate: { $lte: currentDate } },
                { endDate: { $gte: currentDate } },
                {
                    $or: [
                        { applicableProduct: product._id },
                        { applicableCategory: product.category }
                    ]
                }
            ]
        });

        // Prioritize product offer over category offer if both exist
        let productOffer = null;
        let categoryOffer = null;

        // Filter product and category offers
        applicableOffers.forEach((offer) => {
            if (offer.offerType === 'product' && offer.applicableProduct.toString() === product._id.toString()) {
                productOffer = offer; // Product offer takes priority
            } else if (offer.offerType === 'category' && offer.applicableCategory.toString() === product.category._id.toString()) {
                categoryOffer = offer;
            }
        });

        // If a product offer exists, apply that offer
        let appliedOffer = productOffer || categoryOffer;


        // Get the category name from the populated category object
        const categoryName = product.category.name;

        // Fetch reviews
        const reviews = await Review.find({ productId: product._id }).populate('userId', 'name');
        
        let averageRating = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
            averageRating = (sum / reviews.length).toFixed(1);
        }

        // Render the product detail page and pass product data + categoryName + the applicable offer
        res.render('user/productsDetail', { product, categoryName, applicableOffers, appliedOffer, reviews, averageRating });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Server Error');
    }
};


const imageZoom= async (req, res) => {
    try {
        const product = await productSchema.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found');
        }
        res.render('user/zoom', { product }); // Rendering a new 'zoom.ejs' view
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};
// productController.js



// Controller to fetch all products (handles ?sort= and ?category= query params)
const getAllProducts = async (req, res) => {
    try {
        console.log("getAllProducts");
        const categories = await categorySchema.find({ isDeleted: false });

        // Build query – always filter active products
        let query = { isActive: true };

        // Category filter
        if (req.query.category) {
            const cat = await categorySchema.findOne({ name: req.query.category, isDeleted: false });
            if (cat) {
                query.category = cat._id;
            }
        }

        // Sort option
        let sortOption = {};
        switch (req.query.sort) {
            case 'price_low_high':
                sortOption = { finalPrice: 1 };
                break;
            case 'price_high_low':
                sortOption = { finalPrice: -1 };
                break;
            case 'new_arrivals':
                sortOption = { createdAt: -1 };
                break;
            case 'az':
                sortOption = { name: 1 };
                break;
            case 'za':
                sortOption = { name: -1 };
                break;
            default:
                sortOption = { createdAt: -1 }; // default: newest first
        }

        const products = await productSchema.find(query).sort(sortOption);

        const message = products.length === 0 ? 'No products found.' : '';

        res.render('user/Allproduct', {
            products,
            categories,
            message,
            currentSort: req.query.sort || '',
            currentCategory: req.query.category || ''
        });
    } catch (error) {
        console.log('Error fetching products: ', error);
        res.status(500).send('Error fetching products');
    }
};

// Keep /products route working – delegates to getAllProducts logic
const sortAllproducts = async (req, res) => {
    return getAllProducts(req, res);
};


const searchbyProducts = async (req, res) => {
    try {
        const searchQuery = req.body.search || '';
        const categories = await categorySchema.find({ isDeleted: false });

        // Perform a database search for active products only
        const products = await productSchema.find({
            name: { $regex: searchQuery, $options: 'i' }, // Case-insensitive search
            isActive: true
        });

        // If no products found, show "no results" message
        const message = products.length === 0
            ? 'Sorry, no results found! Please check the spelling or try searching for something else.'
            : '';

        // Render the all-products page with the search results
        // Pass currentSort and currentCategory so the template doesn't crash
        res.render('user/Allproduct', {
            products,
            message,
            categories,
            currentSort: '',
            currentCategory: ''
        });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).send('Server Error');
    }
};
    






const addReview = async (req, res) => {
    try {
        const { productId, rating, reviewText } = req.body;
        const userId = req.session.user;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to submit a review' });
        }

        // Check if user already reviewed this product
        const existingReview = await Review.findOne({ userId, productId });
        if (existingReview) {
            return res.json({ success: false, message: 'You have already reviewed this product' });
        }

        const review = new Review({
            userId,
            productId,
            rating,
            reviewText
        });

        await review.save();
        res.json({ success: true, message: 'Review submitted successfully!' });
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getProductsByCategory,
    getProductDetail,
    imageZoom,
    getAllProducts,
    sortAllproducts,
    searchbyProducts,
    addReview
};
