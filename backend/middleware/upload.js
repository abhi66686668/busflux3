const multer =
  require("multer");

const path =
  require("path");



// ================= STORAGE =================

const storage = multer.memoryStorage();

// ================= FILE FILTER =================

const fileFilter =
  (req, file, cb) => {

    const allowedTypes =

      /jpeg|jpg|png/;



    // CHECK EXTENSION
    const extname =
      allowedTypes.test(

        path.extname(
          file.originalname
        ).toLowerCase()

      );



    // CHECK MIME TYPE
    const mimetype =
      allowedTypes.test(
        file.mimetype
      );



    // VALIDATION
    if(

      extname &&
      mimetype

    ){

      return cb(
        null,
        true
      );

    }



    // INVALID FILE
    cb(

      new Error(

        "Only JPG, JPEG, PNG images allowed"

      )

    );

};



// ================= MULTER =================

const upload =
  multer({

    storage,

    fileFilter

});



module.exports =
  upload;

