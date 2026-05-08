import express from 'express';
import cookieParser from 'cookie-parser';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
import { createClient } from '@supabase/supabase-js';
import bodyParser from 'body-parser';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cookieParser());
const supabase = createClient(process.env.supaURL, process.env.supaKEY);


app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'views')));
app.use(bodyParser.urlencoded({ extended: true }));

app.route('/').get((req, res) => {
    res.render('index');
});
app.route('/login').get((req, res) => {
    res.render('login');
});
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
});
app.route('/create').get((req, res) =>{
    res.render('signup');
});

//TESTING USE ONLY
app.route('/dashboard').get((req,res) => {
    res.render('dashboard', { title: "OneStore Web" });
});

/*
THIS IS THE 404 ROUTE
>>>DO NOT ADD ANYTHING BEYOND THIS<<<
*/
app.route('/:id').get((req, res) => {
    res.status(404).render('404');
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});