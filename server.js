if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
require("events").EventEmitter.defaultMaxListeners = 20;

const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const sql = require("msnodesqlv8");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { authenticateRole } = require("./app/middleware/roleAuth");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const https = require("https");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("./app/middleware/upload");
const courseImageUpload = require("./app/middleware/courseImageUpload");
const executeQuery = require("./app/middleware/executeQuery");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("./app/middleware/auth");
const validateSchedule = require("./app/middleware/validateSchedule");

// Static files
app.use(express.static(path.join(__dirname, "app/public")));

//Controller
const materialController = require("./app/controller/materialController");
const notificationController = require("./app/controller/notificationsController");
const materialsController = require("./app/controller/materialsroute");
const userController = require("./app/controller/usersController");
const courseController = require("./app/controller/coursesController");
const uploadmaterialController = require("./app/controller/upload-materialController");
const scheduleController = require("./app/controller/scheduleController");
const classesController = require("./app/controller/classesController");
const enrollmentsController = require("./app/controller/enrollmentsController");
const miscController = require("./app/controller/MiscRoute");
const requestRoute = require("./app/controller/requestRoute");
const examController = require("./app/controller/examController");

// API Controller (JSON responses)
const apiClassesController = require("./app/controller/api/apiclassesController");
const apiCoursesController = require("./app/controller/api/apicoursesController");
const apiEnrollmentsController = require("./app/controller/api/apienrollmentsController");
const apiExamController = require("./app/controller/api/apiexamController");
const apiMaterialController = require("./app/controller/api/apimaterialController");
const apiMaterialsController = require("./app/controller/api/apimaterialsroute");
const apiMiscController = require("./app/controller/api/apiMiscRoute");
const apiNotificationController = require("./app/controller/api/apinotificationsController");
const apiRequestController = require("./app/controller/api/apirequestRoute");
const apiScheduleController = require("./app/controller/api/apischeduleController");
const apiUploadMaterialController = require("./app/controller/api/apiupload-materialController");
const apiUsersController = require("./app/controller/api/apiusersController");


// Essential middleware
app.use(express.json());
// Use extended: true so nested form fields like scores[123] are parsed into objects
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride("_method"));

// Session setup
app.use(flash());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

const initalizePassport = require("./app/middleware/pass-config");
initalizePassport(
  passport,
  (email) => {
    console.log("Looking up user by email:", email);
    // Lookup directly on users.email (students/teachers/admins don't have an email column)
    const query = `
      SELECT u.*
      FROM users u
      WHERE u.email = ?
    `;
    return new Promise((resolve, reject) => {
      sql.query(connectionString, query, [email], (err, rows) => {
        if (err) {
          console.error("SQL error:", err);
          return reject(new Error(err));
        }
        if (rows.length > 0) {
          resolve(rows[0]);
        } else {
          resolve(null);
        }
      });
    });
  },
  (id) => {
    const query = `SELECT * FROM users WHERE id = ?`;
    return new Promise((resolve, reject) => {
      sql.query(connectionString, query, [id], (err, rows) => {
        if (err) {
          console.error("SQL error:", err);
          return reject(new Error(err));
        }
        if (rows.length > 0) {
          resolve(rows[0]);
        } else {
          resolve(null);
        }
      });
    });
  }
);

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Your API',
      version: '1.0.0',
      description: 'API documentation for your application',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [path.join(__dirname, 'controller/api/*.js'), path.join(__dirname, 'server.js')], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware to ensure res.locals.user is always defined for views
app.use((req, res, next) => {
  if (req.isAuthenticated()) {
    res.locals.user = req.user;
  } else {
    // Check JWT in cookies
    let token = req.cookies?.authToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        res.locals.user = decoded;
        req.user = decoded;
        return next();
      } catch (error) {
        // Token invalid, continue without user
      }
    }
    // No user authenticated
    res.locals.user = null;
  }
  next();
});

// Serve uploaded files statically

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//routing
app.use(materialController);
app.use(notificationController);
app.use(materialsController);
app.use(userController);
app.use(courseController);
app.use(uploadmaterialController);
app.use(scheduleController);
app.use(classesController);
app.use(enrollmentsController);
app.use(miscController);
app.use(requestRoute);
app.use(examController);

// Swagger UI - MOVED TO /api-docs to avoid conflict with /api Controller
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec));

//api routing
app.use("/api", apiClassesController);
app.use("/api", apiCoursesController);
app.use("/api", apiEnrollmentsController);  
app.use("/api", apiExamController);
app.use("/api", apiMaterialController);
app.use("/api", apiMaterialsController);
app.use("/api", apiMiscController);
app.use("/api", apiNotificationController);
app.use("/api", apiRequestController);
app.use("/api", apiScheduleController);
app.use("/api", apiUploadMaterialController);
app.use("/api", apiUsersController);



// Test route
app.get('/test', (req, res) => {
  res.send('Test route works');
});

// Swagger JSON
app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

// API Login Route for Flutter App
/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Login failed
 *       500:
 *         description: Internal server error
 */
app.post("/api/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: "Internal server error" });
    }
    if (!user) {
      return res.status(401).json({ error: info.message || "Login failed" });
    }
    
    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // For web sessions, also maintain session
    req.logIn(user, (err) => {
      if (err) {
        console.error('Session login error:', err);
      }
    });

    // Set JWT in cookie (before sending response)
    res.cookie('authToken', token, { 
      httpOnly: false,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });

    return res.json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        profile_pic: user.profile_pic
      }
    });
  })(req, res, next);
});

app.delete("/api/logout", (req, res) => {
  res.clearCookie('authToken');
  req.logOut((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

/**
 * @swagger
 * /api/logout:
 *   delete:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       500:
 *         description: Logout failed
 */

app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});

app.delete("/logout", (req, res) => {
  res.clearCookie('authToken');
  req.logOut((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Logout error");
    }
    res.redirect("/login");
  });
});


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "app/views"));

//route end

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DOMAIN_NAME = process.env.DOMAIN_NAME || null;
const dns = require("dns").promises;
const multicastDns = require("multicast-dns");

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

app.listen(PORT, HOST, async () => {
  console.log(`\nServer is online on port ${PORT}`);
  console.log(`- Local: http://localhost:${PORT}`);

  const ips = getLocalIPs();
  if (ips.length > 0) {
    for (const ip of ips) {
      console.log(`- On Your Network: http://${ip}:${PORT}`);
    }
  } else {
    console.warn("⚠ Warning: No non-internal network interfaces detected.");
  }

  // Broadcast service on the local network using mDNS (.local domain)
  const serviceName = DOMAIN_NAME
    ? DOMAIN_NAME.replace(/\.local$/, "")
    : "my-app";
  const localDomain = `${serviceName}.local`;

  const mdns = multicastDns();

  mdns.on("query", (query) => {
    // Find all A (IPv4) and AAAA (IPv6) queries for our local domain
    const questions = query.questions.filter(
      (q) =>
        (q.type === "A" || q.type === "AAAA") && q.name.toLowerCase() === localDomain.toLowerCase()
    );

    if (questions.length === 0) return;

    // Respond with all local IP addresses
    const localIPs = getLocalIPs();
    const answers = localIPs.map((ip) => ({
      name: localDomain,
      type: "A",
      ttl: 300, // 5 minutes
      data: ip,
    }));

    mdns.respond({
      answers: answers,
    });
  });
  console.log(`- On Your Network (mDNS): http://${localDomain}:${PORT}`);
  console.log(`  (Resolves on devices with mDNS/Bonjour support)`);
});

// Configure connection pool
const pool = {
  max: 10, // Maximum number of connections
  min: 0, // Minimum number of connections
  idleTimeoutMillis: 30000, // How long a connection can be idle before being released
};

// Test database connection on startup
async function testConnection() {
  try {
    await executeQuery("SELECT 1");
    console.log("Database connection successful");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1); // Exit if we can't connect to database
  }
}

testConnection();

// Add error handler middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err.code === "ECONNREFUSED") {
    return res.status(503).json({
      error: "Database connection failed",
      details: "Unable to connect to database server",
    });
  }

  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    return res.status(503).json({
      error: "Database connection lost",
      details: "Connection to database was lost",
    });
  }

  res.status(500).json({
    error: "Internal server error",
    details: err.message,
  });
});
