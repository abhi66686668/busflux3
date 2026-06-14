const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {

  try {

    // GET TOKEN FROM HEADER
    const authHeader = req.headers.authorization;

    // CHECK TOKEN
    if (!authHeader) {
      return res.status(401).json({
        message: "No token, authorization denied"
      });
    }

    // REMOVE "Bearer "
    const token = authHeader.split(" ")[1];

    // VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch (error) {

    res.status(400).json({
      message: "Invalid token"
    });

  }

};
