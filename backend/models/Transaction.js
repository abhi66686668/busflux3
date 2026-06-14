const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    bonus: {
      type: Number,
      default: 0
    },
    totalCredit: {
      type: Number,
      required: true
    },
    method: {
      type: String,
      required: true
    },
    status: {
      type: String,
      default: "Completed"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
