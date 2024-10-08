const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Expense = require('./models/expense');
const userModel = require('./models/user');
const app = express();

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs');

// Routes
app.get('/home', async (req, res) => {
    const { sortBy } = req.query;
    let sortQuery = {};

    switch (sortBy) {
        case 'date_asc':
            sortQuery = { date: 1 };
            break;
        case 'date_desc':
            sortQuery = { date: -1 };
            break;
        case 'amount_asc':
            sortQuery = { amount: 1 };
            break;
        case 'amount_desc':
            sortQuery = { amount: -1 };
            break;
        default:
            sortQuery = { date: -1 };
    }

    const expenses = await Expense.find().sort(sortQuery);
    res.render('index', { expenses, sortBy });
});

app.get('/add', (req, res) => {
    res.render('add');
});

app.post('/add', async (req, res) => {
    const { amount, description, category,date } = req.body;
    let expenseCreated = await Expense.insertMany({ amount, description, category, date })
    res.redirect('/home')
});

app.get('/edit/:id', async (req, res) => {
    const expense = await Expense.findOne({ _id: req.params.id });
    res.render('edit', { expense });
});

app.post('/edit/:id', async (req, res) => {
    const { amount, description, category, date } = req.body;
    await Expense.findOneAndUpdate({ _id: req.params.id }, { amount, description, category, date });
    res.redirect('/home');
});

app.post('/delete/:id', async (req, res) => {
    let expense = await Expense.findOneAndDelete({_id: req.params.id });
    res.redirect('/home');
});

app.get('/analysis', async (req, res) => {
    const expenses = await Expense.find();

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate start of the week (assuming week starts on Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Calculate start of the month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let dailyTotal = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;

    // Group by category and sum up amounts
    const expenseSummary = expenses.reduce((acc, expense) => {
        const { category, amount, date } = expense;
        const expenseDate = new Date(date);

        // Daily total
        if (expenseDate >= today) {
            dailyTotal += amount;
        }

        // Weekly total
        if (expenseDate >= startOfWeek) {
            weeklyTotal += amount;
        }

        // Monthly total
        if (expenseDate >= startOfMonth) {
            monthlyTotal += amount;
        }

        // Group by category for the pie chart
        if (!acc[category]) {
            acc[category] = 0;
        }
        acc[category] += amount;
        return acc;
    }, {});

    const categories = Object.keys(expenseSummary);
    const totalAmounts = Object.values(expenseSummary);

    const monthlyTotals = Array(12).fill(0);
    expenses.forEach(expense => {
        const date = new Date(expense.date);
        const month = date.getMonth();
        monthlyTotals[month] += expense.amount;
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    res.render('analysis', {
        categories,
        totalAmounts,
        dailyTotal,
        weeklyTotal,
        monthlyTotal,
        monthNames,
        monthlyTotals
    });
});

app.get('/savings', async (req, res) => {
    const currentMonth = new Date().getMonth();  // Get current month (0-11)
    const currentYear = new Date().getFullYear();  // Get current year

    const expenses = await Expense.find({
        category: 'Entertainment',
        date: {
            $gte: new Date(currentYear, currentMonth, 1),  // Start of the current month
            $lt: new Date(currentYear, currentMonth + 1, 1)  // Start of the next month
        }
    });

    // Calculate the total non-essential spending for the current month
    const totalNonEssential = expenses.reduce((total, expense) => total + expense.amount, 0);

    // Calculate 10% savings
    const tenPercentSavings = totalNonEssential * 0.1;

    // Calculate compound savings over 10 years with 5% interest compounded monthly
    const months = 10 * 12;
    const monthlyInterestRate = 0.05 / 12;
    const futureValue = tenPercentSavings * (Math.pow(1 + monthlyInterestRate, months) - 1) / monthlyInterestRate;

    res.render('savings', {
        totalNonEssential,
        tenPercentSavings: tenPercentSavings.toFixed(2),
        futureValue: futureValue.toFixed(2),
    });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const saltRounds = 10;

    try {
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password, salt);

        await userModel.insertMany({ email, password: hash });
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/register');
    }
});

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            res.render('login', { error: 'Invalid email or password' });
            return;
        }

        const result = await bcrypt.compare(password, user.password);
        if (result) {
            const token = jwt.sign({ email: user.email }, "secretKey");
            res.cookie('token', token);
            res.redirect('/home');
        } else {
            res.render('login', { error: 'Invalid email or password' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'An error occurred' });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

app.listen(3000, () => {
    console.log(`Server listening on port 3000`);
});

