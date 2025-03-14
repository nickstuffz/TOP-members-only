// Dependencies
require("dotenv").config();
const express = require("express");
const asyncHandler = require("express-async-handler");
const { engine } = require("express-handlebars");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const pgSession = require("connect-pg-simple")(session);
const flash = require("connect-flash");
const pool = require("./db/pool");

// Passport Config
passport.use(
  new LocalStrategy(
    asyncHandler(async (username, password, done) => {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE LOWER(username) = $1 LIMIT 1",
        [username]
      );
      const user = rows[0];

      if (!user) {
        return done(null, false, { message: "username not found" });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return done(null, false, { message: "incorrect password" });
      }

      return done(null, user);
    })
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(
  asyncHandler(async (id, done) => {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [id]
    );
    const user = rows[0];
    done(null, user);
  })
);

// Setup
const app = express();
app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "./views");
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    store: new pgSession({
      pool: pool,
    }),
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000, rolling: true }, // 1 day
  })
);
app.use(passport.session());
app.use(flash());

// Routes
app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

app.get("/login", (req, res) => {
  const errorMessage = req.session.flash ? req.flash("error") : null; // Retrieve the error message only if there are messages
  res.render("login", { error: errorMessage });
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err); // Handle any error during logout
    }

    // After logout, destroy the session
    req.session.destroy((err) => {
      if (err) {
        return next(err); // Handle any error during session destruction
      }

      // Redirect the user after logout and session destruction
      res.redirect("/"); // Redirect to homepage or login page
    });
  });
});

app.get("/signup", (req, res) => {
  res.render("signup");
});
app.post(
  "/signup",
  asyncHandler(async (req, res, next) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [
      req.body.username,
      hashedPassword,
    ]);
    res.redirect("/");
  })
);

// Error Handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Oops! something went wrong");
});

// Start Server
const port = process.env.PORT || 8080;
// syntax for binding to both IPv4 and IPv6
app.listen(port, "::", () => {
  console.log(`Server listening on [::]${port}`);
});
