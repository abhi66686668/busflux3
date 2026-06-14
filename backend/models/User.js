
const mongoose =
  require("mongoose");



const userSchema =
  new mongoose.Schema(

    {

      // NAME
      name: {

        type: String,

        default: ""

      },



      // EMAIL
      email: {

        type: String,

        required: true,

        unique: true,

        default: ""

      },



      // PASSWORD
      password: {

        type: String,

        default: ""

      },



      // PHONE NUMBER
      phone: {

        type: String,

        default: ""

      },



      // GENDER
      gender: {
        type: String,
        default: ""
      },

      // AGE
      age: {

        type: Number,

        default: 0

      },



      // AGE GROUP
      ageGroup: {

        type: String,

        default: ""

      },



      // AADHAAR NUMBER
      aadhaarNumber: {

        type: String,

        default: ""

      },



      // COLLEGE ID
      collegeId: {
        type: String,
        default: ""
      },

      // STUDENT ID NUMBER
      studentIdNumber: {
        type: String,
        default: ""
      },
      
      // PASSING YEAR
      passingYear: {
        type: Number,
        default: null
      },

      // INSTITUTION TYPE
      institutionType: {
        type: String,
        default: ""
      },
      
      // INSTITUTION NAME
      institutionName: {
        type: String,
        default: ""
      },
      
      // COURSE
      course: {
        type: String,
        default: ""
      },
      
      // STUDENT ID PHOTO
      studentIdPhoto: {
        type: String,
        default: ""
      },

      // PROFILE PHOTO
      userPhoto: {

        type: String,

        default: ""

      },



      // ID CARD PHOTO
      idCardPhoto: {

        type: String,

        default: ""

      },



      // EMAIL OTP
      otp: {

        type: String,

        default: ""

      },



      // EMAIL VERIFIED
      isVerified: {

        type: Boolean,

        default: false

      },



      // RESET PASSWORD OTP
      resetOtp: {

        type: String,

        default: ""

      },



      // USER ROLE
      role: {

        type: String,

        default: "user"

      },



      // WALLET BALANCE
      balance: {
        type: Number,
        default: 0
      },

      // CONDUCTOR EXPERIENCE (IN YEARS)
      experience: {
        type: Number,
        default: 0
      },

      // LAST UPI ID USED
      lastUpiIdUsed: {
        type: String,
        default: ""
      }
    },

    {

      timestamps: true

    }

  );



module.exports =

  mongoose.model(

    "User",

    userSchema

  );

