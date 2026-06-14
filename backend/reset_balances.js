const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://abhishek:Abhi123456789@cluster0.kis8mkj.mongodb.net/busflux?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
    const res = await mongoose.connection.db.collection('users').updateMany({}, { $set: { balance: 0 } });
    console.log('Updated', res.modifiedCount);
    process.exit(0);
})
.catch(e => {
    console.error(e);
    process.exit(1);
});
