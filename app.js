// Dependencies
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const pool = require("./db/pool");
const passport = require("passport");
const { engine } = require("express-handlebars");
const bcrypt = require("bcryptjs");
const LocalStrategy = require("passport-local").Strategy;
const asyncHandler = require("express-async-handler");

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

// Express Setup
const app = express();
app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "./views");

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.session());

// Routes
app.get("/", (req, res) => {
  console.log(req.user);
  res.render("index", { user: req.user });
});

app.get("/login", (req, res) => {
  res.render("login");
});
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
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
