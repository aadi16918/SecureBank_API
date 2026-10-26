
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Customer Schema
const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [3, "Name must contain at least 3 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"]
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address"
      ]
    },

    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      match: [
        /^[6-9]\d{9}$/,
        "Enter a valid 10-digit Indian mobile number"
      ]
    },

    accountType: {
      type: String,
      required: [true, "Account type is required"],
      enum: ["Savings", "Current", "Salary"]
    },

    deposit: {
      type: Number,
      required: [true, "Initial deposit is required"],
      min: [500, "Minimum deposit must be Rs. 500"],
      validate: {
        validator: Number.isFinite,
        message: "Deposit must be a valid number"
      }
    }
  },
  { timestamps: true }
);

const Customer = mongoose.model("Customer", customerSchema);

// Home route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to SecureBank RESTful API",
    status: "Server is running",
    endpoints: {
      getAll: "GET /api/customers",
      getOne: "GET /api/customers/:id",
      create: "POST /api/customers",
      update: "PUT /api/customers/:id",
      delete: "DELETE /api/customers/:id"
    }
  });
});

// GET: All customers
app.get("/api/customers", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: customers.length,
      message: "Customers fetched successfully",
      customers
    });
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers"
    });
  }
});

// GET: Customer by ID
app.get("/api/customers/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer"
    });
  }
});

// POST: Create customer
app.post("/api/customers", async (req, res) => {
  try {
    const customer = await Customer.create(req.body);

    res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customer
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map(
          item => item.message
        )
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to register customer"
    });
  }
});

// PUT: Update customer
app.put("/api/customers/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map(
          item => item.message
        )
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update customer"
    });
  }
});

// DELETE: Customer
app.delete("/api/customers/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const customer = await Customer.findByIdAndDelete(
      req.params.id
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete customer"
    });
  }
});

// Unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

// Connect to MongoDB once; reuse connection in Vercel
let connectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from environment variables");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI)
      .catch(error => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}

// Vercel serverless handler
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

// Local server
if (require.main === module) {
  connectDB()
    .then(() => {
      console.log("MongoDB connected successfully");

      app.listen(PORT, () => {
        console.log(`SecureBank API running on port ${PORT}`);
      });
    })
    .catch(error => {
      console.error("Server startup failed:", error.message);
      process.exit(1);
    });
}

module.exports = app;
