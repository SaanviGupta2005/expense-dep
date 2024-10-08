const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://guptasaanvi2005:saanvi@expense.w5px6.mongodb.net/?retryWrites=true&w=majority&appName=expense')

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('User', userSchema);