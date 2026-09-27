# Echo Emporium - E-Commerce Platform

A fully functional, responsive, and feature-rich E-Commerce web application built using the MVC (Model-View-Controller) architecture with Node.js, Express, EJS, and MongoDB.

---

## 🚀 Features

### 👤 User Module
*   **Authentication & Security:** 
    *   Secure local sign-up and login with password hashing using `bcrypt`.
    *   One-Time Password (OTP) verification sent via email using `Nodemailer`.
    *   Google OAuth 2.0 integration via `Passport.js`.
*   **User Profile & Address Book:**
    *   Manage personal details and change passwords securely.
    *   Address book management (add, edit, and delete multiple shipping addresses).
*   **Product Catalog:**
    *   Browse products by categories.
    *   Live product search (case-insensitive) and sorting (Price low-high/high-low, A-Z/Z-A, New Arrivals).
    *   Detailed product view pages with image zoom functionality.
*   **Shopping Cart & Wishlist:**
    *   Add/remove items and adjust quantities (with real-time stock and quantity limit checks).
    *   Wishlist to save favorite items for later.
*   **Checkout & Payments:**
    *   Multi-stage checkout with coupon application.
    *   Integrated payment methods: **Cash on Delivery (COD)**, **Razorpay Online Payments**, and **User Wallet**.
*   **Order & Invoice Management:**
    *   Track order status and history.
    *   Request order cancellations and returns.
    *   Download detailed invoices in PDF format.

### 👑 Admin Module
*   **Admin Dashboard:** Comprehensive overview of business metrics and sales analytics.
*   **User Management:** View registered users and block/unblock accounts to control access.
*   **Product Management:** Full CRUD operations for products, including multi-image uploads and image processing/cropping.
*   **Category Management:** Add, edit, block, and unblock product categories.
*   **Coupon & Offer Management:** 
    *   Create and manage percentage-based or flat discount coupons.
    *   Configure product-specific or category-wide active discounts and offers.
*   **Order & Inventory Management:** 
    *   Manage order status flow (Pending, Shipped, Delivered, Cancelled, Returned).
    *   Update stock quantities directly from the inventory dashboard.
*   **Sales Reports:** 
    *   Generate and filter sales reports by timeframes (Day, Week, Month, Year).
    *   Download reports instantly in **Excel (.xlsx)** or **PDF** format.

---

## 🛠️ Tech Stack

*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB with Mongoose ODM
*   **Frontend:** EJS (Embedded JavaScript) Templates, Express EJS Layouts, CSS/Bootstrap
*   **Authentication:** Passport.js (Google Strategy), Express Session
*   **Payments:** Razorpay Node SDK
*   **File Uploads:** Multer, Sharp (image optimization)
*   **Reporting:** ExcelJS, PDFKit, PDFKit-Table

---

## ⚙️ Environment Variables Configuration

Create a `.env` file in the root directory of your project and configure the following variables:

```env
# Server Port
PORT=1233

# Database Connection
MONGODB_CONNECTION_STRING=mongodb://localhost:27017/ECHOEMPORIUM

# Email SMTP configuration (for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
MAIL=your-email@gmail.com
PASS=your-app-specific-password

# Admin Credentials
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=admin@123

# Razorpay Integration (Optional/Required for Online Payments)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Google OAuth Integration (Optional/Required for Google Sign-in)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:1233/auth/google/callback
```

---

## 📦 Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/echo-emporium.git
    cd echo-emporium
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Environment Variables:**
    Create your `.env` file as described in the section above.

4.  **Run the Database:**
    Ensure your local MongoDB instance is running, or verify your MongoDB Atlas connection string in `.env`.

5.  **Start the Application:**
    *   **Development Mode:**
        ```bash
        npm start
        ```
    *   The app will run at: `http://localhost:1233` (or the configured `PORT`).

---

## 📂 Project Structure

```text
├── config/             # Database connection setup
├── controller/         # Request handlers (User and Admin)
├── middleware/         # Session checks, Multer configuration
├── model/              # MongoDB Mongoose schemas
├── public/             # Static files (CSS, JS, images)
├── routes/             # App routing definitions (userRoute, adminRoute)
├── services/           # Passport configurations, Nodemailer, OTP service
├── uploads/            # Uploaded product images
├── views/              # EJS templates (Layouts, User, Admin views)
├── .env                # App configuration variables (gitignored)
├── app.js              # Application entry point
├── package.json        # Node.js dependencies and scripts
└── README.md           # Documentation
```
