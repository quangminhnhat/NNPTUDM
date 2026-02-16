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

//routes
const materialRoutes = require("./app/controller/materialRoutes");
const notificationRoutes = require("./app/controller/notificationsroutes");
const materialsRoutes = require("./app/controller/materialsroute");
const userRoutes = require("./app/controller/usersRoutes");
const courseRoutes = require("./app/controller/coursesRoutes");
const uploadmaterialRoutes = require("./app/controller/upload-materialRoutes");
const scheduleRoutes = require("./app/controller/scheduleRoutes");
const classesRoutes = require("./app/controller/classesRoutes");
const enrollmentsRoutes = require("./app/controller/enrollmentsRoutes");
const miscroutes = require("./app/controller/MiscRoute");
const requestRoute = require("./app/controller/requestRoute");
const examRoutes = require("./app/controller/examRoutes");

// API Routes (JSON responses)
const apiClassesRoutes = require("./app/controller/api/apiclassesRoutes");
const apiCoursesRoutes = require("./app/controller/api/apicoursesRoutes");
const apiEnrollmentsRoutes = require("./app/controller/api/apienrollmentsRoutes");
const apiExamRoutes = require("./app/controller/api/apiexamRoutes");
const apiMaterialRoutes = require("./app/controller/api/apimaterialRoutes");
const apiMaterialsRoutes = require("./app/controller/api/apimaterialsroute");
const apiMiscRoutes = require("./app/controller/api/apiMiscRoute");
const apiNotificationRoutes = require("./app/controller/api/apinotificationsroutes");
const apiRequestRoutes = require("./app/controller/api/apirequestRoute");
const apiScheduleRoutes = require("./app/controller/api/apischeduleRoutes");
const apiUploadMaterialRoutes = require("./app/controller/api/apiupload-materialRoutes");
const apiUsersRoutes = require("./app/controller/api/apiusersRoutes");


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
app.use(materialRoutes);
app.use(notificationRoutes);
app.use(materialsRoutes);
app.use(userRoutes);
app.use(courseRoutes);
app.use(uploadmaterialRoutes);
app.use(scheduleRoutes);
app.use(classesRoutes);
app.use(enrollmentsRoutes);
app.use(miscroutes);
app.use(requestRoute);
app.use(examRoutes);

// Swagger UI - MOVED TO /api-docs to avoid conflict with /api routes
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec));

//api routing
app.use("/api", apiClassesRoutes);
app.use("/api", apiCoursesRoutes);
app.use("/api", apiEnrollmentsRoutes);  
app.use("/api", apiExamRoutes);
app.use("/api", apiMaterialRoutes);
app.use("/api", apiMaterialsRoutes);
app.use("/api", apiMiscRoutes);
app.use("/api", apiNotificationRoutes);
app.use("/api", apiRequestRoutes);
app.use("/api", apiScheduleRoutes);
app.use("/api", apiUploadMaterialRoutes);
app.use("/api", apiUsersRoutes);



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
